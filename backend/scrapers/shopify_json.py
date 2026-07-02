import logging
from typing import List

from .base import CompetitorOffer, Connector, PoliteSession

logger = logging.getLogger(__name__)

PAGE_LIMIT = 250
MAX_PAGES = 200  # hard stop: 50k products


class ShopifyJsonConnector(Connector):
    """Reads the full catalog from a Shopify store's public /products.json endpoint."""

    connector_type = "shopify_json"

    def fetch_catalog(self) -> List[CompetitorOffer]:
        session = PoliteSession(self.domain)
        offers: List[CompetitorOffer] = []
        page = 1

        while page <= MAX_PAGES:
            url = f"https://{self.domain}/products.json?limit={PAGE_LIMIT}&page={page}"
            resp = session.get(url)
            if resp is None or resp.status_code != 200:
                logger.warning(f"[{self.domain}] products.json page {page} failed "
                               f"(status {resp.status_code if resp else 'n/a'}), stopping")
                break

            try:
                products = resp.json().get("products", [])
            except ValueError:
                logger.error(f"[{self.domain}] Non-JSON response on page {page}, stopping")
                break

            if not products:
                break

            for product in products:
                title = product.get("title") or ""
                vendor = product.get("vendor")
                handle = product.get("handle")
                product_url = f"https://{self.domain}/products/{handle}" if handle else f"https://{self.domain}"
                for variant in product.get("variants", []):
                    price = variant.get("price")
                    if price is None:
                        continue
                    variant_title = variant.get("title")
                    full_title = title if variant_title in (None, "Default Title") else f"{title} - {variant_title}"
                    compare_at = variant.get("compare_at_price")
                    offers.append(CompetitorOffer(
                        domain=self.domain,
                        product_title=full_title,
                        brand=vendor,
                        sku=variant.get("sku") or None,
                        barcode=str(variant["barcode"]) if variant.get("barcode") else None,
                        price=float(price),
                        compare_at_price=float(compare_at) if compare_at else None,
                        available=variant.get("available"),
                        url=product_url,
                    ))
            page += 1

        logger.info(f"[{self.domain}] shopify_json: {len(offers)} variant offers across {page - 1} pages")
        return offers
