import logging
import re
from typing import Any, Dict, List, Optional

from .base import CompetitorOffer

logger = logging.getLogger(__name__)

try:
    from rapidfuzz import fuzz
    def _token_set_ratio(a: str, b: str) -> float:
        return fuzz.token_set_ratio(a, b)
except ImportError:  # keep the pipeline usable before rapidfuzz is installed
    def _token_set_ratio(a: str, b: str) -> float:
        ta, tb = set(a.split()), set(b.split())
        if not ta or not tb:
            return 0.0
        return 100.0 * len(ta & tb) / len(ta | tb)

FUZZY_THRESHOLD = 90.0

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_upc(value: Optional[str]) -> Optional[str]:
    """Match Merchant API convention used in main.py: strip leading zeros on both sides."""
    if not value:
        return None
    stripped = str(value).strip().lstrip("0")
    return stripped or None


def _norm_text(value: Optional[str]) -> str:
    return _NON_ALNUM.sub(" ", str(value).lower()).strip() if value else ""


def _norm_sku(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = _NON_ALNUM.sub("", str(value).lower())
    return normalized or None


def _pick_best(offers: List[CompetitorOffer]) -> CompetitorOffer:
    """Prefer in-stock offers; among those, the lowest price (the price we compete against)."""
    in_stock = [o for o in offers if o.available is not False]
    pool = in_stock or offers
    return min(pool, key=lambda o: o.price)


def match_offers(products: List[Dict[str, Any]], offers: List[CompetitorOffer]) -> Dict[Any, Dict[str, Any]]:
    """Match one competitor's offers to our catalog.

    products: rows with item_id, upc, brand_name, custom_sku, system_sku, product_name.
    Returns {item_id: {"offer": CompetitorOffer, "match_method": str, "match_confidence": float}}.
    """
    by_barcode: Dict[str, List[CompetitorOffer]] = {}
    by_brand_sku: Dict[tuple, List[CompetitorOffer]] = {}
    by_brand: Dict[str, List[CompetitorOffer]] = {}

    for offer in offers:
        barcode = normalize_upc(offer.barcode)
        if barcode:
            by_barcode.setdefault(barcode, []).append(offer)
        brand = _norm_text(offer.brand)
        sku = _norm_sku(offer.sku)
        if brand and sku:
            by_brand_sku.setdefault((brand, sku), []).append(offer)
        if brand:
            by_brand.setdefault(brand, []).append(offer)

    matches: Dict[Any, Dict[str, Any]] = {}
    for product in products:
        item_id = product.get("item_id")
        if item_id is None:
            continue

        upc = normalize_upc(product.get("upc"))
        if upc and upc in by_barcode:
            matches[item_id] = {
                "offer": _pick_best(by_barcode[upc]),
                "match_method": "gtin",
                "match_confidence": 1.0,
            }
            continue

        brand = _norm_text(product.get("brand_name"))
        for sku_field in ("custom_sku", "system_sku"):
            sku = _norm_sku(product.get(sku_field))
            if brand and sku and (brand, sku) in by_brand_sku:
                matches[item_id] = {
                    "offer": _pick_best(by_brand_sku[(brand, sku)]),
                    "match_method": "brand_sku",
                    "match_confidence": 0.9,
                }
                break
        if item_id in matches:
            continue

        title = _norm_text(product.get("product_name"))
        if brand and title and brand in by_brand:
            best_score, best_offer = 0.0, None
            for offer in by_brand[brand]:
                score = _token_set_ratio(title, _norm_text(offer.product_title))
                if score > best_score:
                    best_score, best_offer = score, offer
            if best_offer is not None and best_score >= FUZZY_THRESHOLD:
                matches[item_id] = {
                    "offer": best_offer,
                    "match_method": "fuzzy_title",
                    "match_confidence": round(best_score / 100.0, 3),
                }

    logger.info(f"Matched {len(matches)}/{len(products)} products against {len(offers)} offers")
    return matches
