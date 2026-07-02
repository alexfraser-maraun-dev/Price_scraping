import logging
import os
import time
from typing import Any, Dict, List, Optional

import requests

from .base import CompetitorOffer, Connector

logger = logging.getLogger(__name__)

DATAFORSEO_ENDPOINT = "https://api.dataforseo.com/v3/merchant/google/products/live/advanced"
LOCATION_CODE_CANADA = 2124
DEFAULT_MAX_LOOKUPS = 500


class SerpApiConnector(Connector):
    """Looks up prices on Google Shopping (via DataForSEO) for competitors that
    cannot be scraped directly. Searches by our GTINs and keeps only listings
    sold by the registered domain.

    Requires env vars DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD.

    Config:
      gtins: list of GTIN strings to look up, ordered by priority (highest revenue first).
             Supplied by run_scrape from the BigQuery product baseline.
      max_lookups: cost cap per run (default 500 lookups ≈ a few dollars).
    """

    connector_type = "serp_api"

    def fetch_catalog(self) -> List[CompetitorOffer]:
        login = os.getenv("DATAFORSEO_LOGIN")
        password = os.getenv("DATAFORSEO_PASSWORD")
        if not login or not password:
            logger.error(f"[{self.domain}] DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set; skipping serp_api scrape")
            return []

        gtins: List[str] = [g for g in self.config.get("gtins", []) if g]
        if not gtins:
            logger.warning(f"[{self.domain}] serp_api connector received no GTINs to look up")
            return []

        max_lookups = int(self.config.get("max_lookups", DEFAULT_MAX_LOOKUPS))
        auth = (login, password)
        offers: List[CompetitorOffer] = []
        lookups = 0

        for gtin in gtins[:max_lookups]:
            items = self._search_google_shopping(auth, gtin)
            lookups += 1
            for item in items:
                offer = self._item_to_offer(item, gtin)
                if offer is not None:
                    offers.append(offer)
            time.sleep(0.2)  # stay under DataForSEO rate limits

        logger.info(f"[{self.domain}] serp_api: {len(offers)} offers from {lookups} GTIN lookups")
        return offers

    def _search_google_shopping(self, auth, gtin: str) -> List[Dict[str, Any]]:
        payload = [{
            "keyword": gtin,
            "location_code": LOCATION_CODE_CANADA,
            "language_code": "en",
        }]
        try:
            resp = requests.post(DATAFORSEO_ENDPOINT, json=payload, auth=auth, timeout=60)
            resp.raise_for_status()
            data = resp.json()
        except (requests.RequestException, ValueError) as e:
            logger.warning(f"[{self.domain}] DataForSEO lookup failed for GTIN {gtin}: {e}")
            return []

        items: List[Dict[str, Any]] = []
        for task in data.get("tasks") or []:
            for result in task.get("result") or []:
                items.extend(result.get("items") or [])
        return items

    def _item_to_offer(self, item: Dict[str, Any], gtin: str) -> Optional[CompetitorOffer]:
        seller = (item.get("seller") or item.get("domain") or "").lower()
        if self.domain.lower().replace("www.", "") not in seller.replace("www.", ""):
            return None

        price_info = item.get("price")
        if isinstance(price_info, dict):
            price = price_info.get("current")
            currency = price_info.get("currency", "CAD")
        else:
            price = price_info
            currency = "CAD"
        if price is None:
            return None

        return CompetitorOffer(
            domain=self.domain,
            product_title=item.get("title") or "",
            price=float(price),
            currency=currency,
            barcode=gtin,
            url=item.get("url") or item.get("shopping_url") or f"https://{self.domain}",
        )
