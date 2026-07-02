import logging
import time
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

USER_AGENT = "BiciPriceIntelligence/1.0 (price comparison; contact: info@bici.cc)"
REQUEST_DELAY_SECONDS = 1.0
REQUEST_TIMEOUT_SECONDS = 20
MAX_RETRIES = 3


@dataclass
class CompetitorOffer:
    domain: str
    product_title: str
    price: float
    url: str
    brand: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    compare_at_price: Optional[float] = None
    currency: str = "CAD"
    available: Optional[bool] = None
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PoliteSession:
    """requests.Session wrapper: identifiable UA, per-request delay, retries with backoff, robots.txt check."""

    def __init__(self, domain: str):
        self.domain = domain
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self._last_request = 0.0
        # Fetch robots.txt with our own UA: robotparser.read() uses urllib's default
        # agent, which many storefronts block (403 → parser disallows everything).
        self._robots = urllib.robotparser.RobotFileParser()
        self._robots_ok = False
        try:
            resp = self.session.get(f"https://{domain}/robots.txt", timeout=REQUEST_TIMEOUT_SECONDS)
            if resp.status_code == 200:
                self._robots.parse(resp.text.splitlines())
                self._robots_ok = True
            elif resp.status_code in (401, 403):
                logger.info(f"[{domain}] robots.txt returned {resp.status_code}; treating site as disallowed")
                self._robots.parse(["User-agent: *", "Disallow: /"])
                self._robots_ok = True
        except Exception as e:
            logger.warning(f"[{domain}] Could not read robots.txt ({e}); proceeding without it")

    def allowed(self, url: str) -> bool:
        if not self._robots_ok:
            return True
        try:
            return self._robots.can_fetch(USER_AGENT, url)
        except Exception:
            return True

    def get(self, url: str, **kwargs) -> Optional[requests.Response]:
        if not self.allowed(url):
            logger.info(f"[{self.domain}] robots.txt disallows {url}, skipping")
            return None
        for attempt in range(MAX_RETRIES):
            wait = self._last_request + REQUEST_DELAY_SECONDS - time.time()
            if wait > 0:
                time.sleep(wait)
            self._last_request = time.time()
            try:
                resp = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS, **kwargs)
                if resp.status_code == 429 or resp.status_code >= 500:
                    backoff = 2 ** (attempt + 1)
                    logger.warning(f"[{self.domain}] HTTP {resp.status_code} on {url}, retrying in {backoff}s")
                    time.sleep(backoff)
                    continue
                return resp
            except requests.RequestException as e:
                logger.warning(f"[{self.domain}] Request error on {url}: {e}")
                time.sleep(2 ** (attempt + 1))
        logger.error(f"[{self.domain}] Giving up on {url} after {MAX_RETRIES} attempts")
        return None


class Connector:
    """Base interface: fetch the full public price catalog for one competitor domain."""

    connector_type = "base"

    def __init__(self, domain: str, config: Optional[Dict[str, Any]] = None):
        self.domain = domain
        self.config = config or {}

    def fetch_catalog(self) -> List[CompetitorOffer]:
        raise NotImplementedError


def get_connector(connector_type: str, domain: str, config: Optional[Dict[str, Any]] = None) -> Connector:
    from .shopify_json import ShopifyJsonConnector
    from .shopify_html import ShopifyHtmlConnector
    from .serp_api import SerpApiConnector

    registry = {
        ShopifyJsonConnector.connector_type: ShopifyJsonConnector,
        ShopifyHtmlConnector.connector_type: ShopifyHtmlConnector,
        SerpApiConnector.connector_type: SerpApiConnector,
    }
    if connector_type not in registry:
        raise ValueError(f"Unknown connector type: {connector_type}")
    return registry[connector_type](domain, config)


def detect_connector_type(domain: str) -> str:
    """Probe a domain and pick the cheapest connector that can read its prices."""
    session = PoliteSession(domain)

    resp = session.get(f"https://{domain}/products.json?limit=1")
    if resp is not None and resp.status_code == 200:
        try:
            if resp.json().get("products") is not None:
                return "shopify_json"
        except ValueError:
            pass

    resp = session.get(f"https://{domain}/sitemap.xml")
    if resp is not None and resp.status_code == 200:
        head = resp.content[:2000]
        if (b"<urlset" in head or b"<sitemapindex" in head) and (
            b"/products/" in resp.content or b"sitemap_products" in resp.content
        ):
            return "shopify_html"

    return "serp_api"
