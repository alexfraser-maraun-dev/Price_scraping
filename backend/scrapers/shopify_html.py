import json
import logging
import re
import xml.etree.ElementTree as ET
from typing import List, Optional

from .base import CompetitorOffer, Connector, PoliteSession

logger = logging.getLogger(__name__)

SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
LDJSON_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


class ShopifyHtmlConnector(Connector):
    """For Shopify stores that block /products.json: walks sitemap.xml product URLs
    and reads price/GTIN from the JSON-LD Product block on each product page.

    Config:
      max_products: cap on product pages fetched per run (default 2000).
    """

    connector_type = "shopify_html"

    def fetch_catalog(self) -> List[CompetitorOffer]:
        session = PoliteSession(self.domain)
        max_products = int(self.config.get("max_products", 2000))

        product_urls = self._collect_product_urls(session)
        logger.info(f"[{self.domain}] shopify_html: {len(product_urls)} product URLs in sitemap")

        offers: List[CompetitorOffer] = []
        for url in product_urls[:max_products]:
            page_offers = self._parse_product_page(session, url)
            offers.extend(page_offers)

        logger.info(f"[{self.domain}] shopify_html: {len(offers)} offers from "
                    f"{min(len(product_urls), max_products)} pages")
        return offers

    def _collect_product_urls(self, session: PoliteSession) -> List[str]:
        resp = session.get(f"https://{self.domain}/sitemap.xml")
        if resp is None or resp.status_code != 200:
            logger.error(f"[{self.domain}] sitemap.xml unavailable")
            return []

        try:
            root = ET.fromstring(resp.content)
        except ET.ParseError as e:
            logger.error(f"[{self.domain}] sitemap parse error: {e}")
            return []

        urls: List[str] = []
        if root.tag.endswith("sitemapindex"):
            # Nested sitemaps: only descend into product sitemaps when identifiable
            child_maps = [loc.text for loc in root.findall(".//sm:loc", SITEMAP_NS) if loc.text]
            for child_url in child_maps:
                if "product" not in child_url:
                    continue
                child_resp = session.get(child_url)
                if child_resp is None or child_resp.status_code != 200:
                    continue
                try:
                    child_root = ET.fromstring(child_resp.content)
                except ET.ParseError:
                    continue
                urls.extend(loc.text for loc in child_root.findall(".//sm:loc", SITEMAP_NS)
                            if loc.text and "/products/" in loc.text)
        else:
            urls = [loc.text for loc in root.findall(".//sm:loc", SITEMAP_NS)
                    if loc.text and "/products/" in loc.text]

        # De-dupe preserving order
        return list(dict.fromkeys(urls))

    def _parse_product_page(self, session: PoliteSession, url: str) -> List[CompetitorOffer]:
        resp = session.get(url)
        if resp is None or resp.status_code != 200:
            return []

        product_ld = self._extract_product_ldjson(resp.text)
        if not product_ld:
            return []

        title = product_ld.get("name") or ""
        brand = product_ld.get("brand")
        if isinstance(brand, dict):
            brand = brand.get("name")
        gtin = self._first_gtin(product_ld)

        raw_offers = product_ld.get("offers") or []
        if isinstance(raw_offers, dict):
            raw_offers = raw_offers.get("offers", [raw_offers]) if raw_offers.get("@type") == "AggregateOffer" else [raw_offers]

        offers: List[CompetitorOffer] = []
        for o in raw_offers:
            if not isinstance(o, dict) or o.get("price") in (None, ""):
                continue
            sku = o.get("sku") or product_ld.get("sku")
            availability = o.get("availability") or ""
            offers.append(CompetitorOffer(
                domain=self.domain,
                product_title=title if not sku else f"{title} - {sku}",
                brand=brand,
                sku=str(sku) if sku else None,
                barcode=str(o.get("gtin") or gtin) if (o.get("gtin") or gtin) else None,
                price=float(o["price"]),
                currency=o.get("priceCurrency", "CAD"),
                available="InStock" in availability if availability else None,
                url=o.get("url") or url,
            ))
        return offers

    @staticmethod
    def _extract_product_ldjson(html: str) -> Optional[dict]:
        for block in LDJSON_RE.findall(html):
            try:
                data = json.loads(block)
            except ValueError:
                continue
            candidates = data if isinstance(data, list) else [data]
            for d in candidates:
                if isinstance(d, dict) and d.get("@type") == "Product":
                    return d
        return None

    @staticmethod
    def _first_gtin(product_ld: dict) -> Optional[str]:
        for key in ("gtin", "gtin13", "gtin12", "gtin14", "gtin8"):
            value = product_ld.get(key)
            if value:
                return str(value)
        return None
