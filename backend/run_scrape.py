"""Competitor price scrape runner.

Iterates the enabled competitors in the BigQuery registry, runs the matching
connector for each, matches offers to our top-revenue catalog, and writes
run metadata + matched offers to BigQuery.

Usage:
    python run_scrape.py                          # scrape all enabled competitors
    python run_scrape.py --domain thebikeshop.com # scrape one competitor
    python run_scrape.py --dry-run                # fetch + match, print summary, no BQ writes
"""

import argparse
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from bigquery_client import BigQueryClient
from scrapers import get_connector
from scrapers.matcher import match_offers

logger = logging.getLogger(__name__)


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_offer_rows(run_id: str, domain: str, matches: Dict[Any, Dict[str, Any]],
                      products_by_id: Dict[Any, Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows = []
    for item_id, match in matches.items():
        offer = match["offer"]
        product = products_by_id.get(item_id, {})
        rows.append({
            "run_id": run_id,
            "domain": domain,
            "scraped_at": offer.scraped_at,
            "item_id": int(item_id),
            "upc": str(product.get("upc")) if product.get("upc") else None,
            "competitor_title": offer.product_title,
            "competitor_sku": offer.sku,
            "competitor_barcode": offer.barcode,
            "price": offer.price,
            "compare_at_price": offer.compare_at_price,
            "currency": offer.currency,
            "available": offer.available,
            "url": offer.url,
            "match_method": match["match_method"],
            "match_confidence": match["match_confidence"],
        })
    return rows


def run_scrapes(domains: Optional[List[str]] = None, dry_run: bool = False,
                bq: Optional[BigQueryClient] = None) -> Dict[str, Any]:
    """Run the scrape pipeline. Returns a per-domain summary dict."""
    bq = bq or BigQueryClient()
    if not bq.client:
        return {"error": "BigQuery client not initialized (check GOOGLE_APPLICATION_CREDENTIALS)"}

    bq.ensure_tables()
    competitors = bq.list_competitors(enabled_only=True)
    if domains:
        wanted = {d.lower() for d in domains}
        competitors = [c for c in competitors if c["domain"].lower() in wanted]
    if not competitors:
        return {"error": "No enabled competitors matched the request"}

    logger.info("Fetching product baselines from BigQuery...")
    products = bq.fetch_product_baselines()
    products_by_id = {p["item_id"]: p for p in products if p.get("item_id") is not None}
    logger.info(f"{len(products)} baseline products loaded")

    # GTINs by revenue for SERP-based connectors (they look up our products, not a catalog)
    gtins_by_revenue = [
        str(p["upc"]) for p in sorted(products, key=lambda p: p.get("total_revenue") or 0, reverse=True)
        if p.get("upc")
    ]

    summary: Dict[str, Any] = {}
    for comp in competitors:
        domain = comp["domain"]
        connector_type = comp.get("connector_type") or "serp_api"
        config = json.loads(comp["config"]) if comp.get("config") else {}
        if connector_type == "serp_api":
            config.setdefault("gtins", gtins_by_revenue)

        run_id = uuid.uuid4().hex
        started_at = _utcnow()
        status, error, offers, matches = "success", None, [], {}

        try:
            connector = get_connector(connector_type, domain, config)
            logger.info(f"[{domain}] scraping via {connector_type}...")
            offers = connector.fetch_catalog()
            matches = match_offers(products, offers)
        except Exception as e:
            status, error = "error", str(e)
            logger.exception(f"[{domain}] scrape failed")

        offer_rows = _build_offer_rows(run_id, domain, matches, products_by_id)
        run_meta = {
            "run_id": run_id,
            "domain": domain,
            "connector_type": connector_type,
            "started_at": started_at,
            "finished_at": _utcnow(),
            "offers_found": len(offers),
            "offers_matched": len(matches),
            "status": status,
            "error": error,
        }

        if dry_run:
            logger.info(f"[{domain}] DRY RUN — skipping BQ writes")
        else:
            if not bq.write_offers(offer_rows):
                run_meta["status"] = "error"
                run_meta["error"] = (run_meta["error"] or "") + " | failed to write offers"
            bq.write_run(run_meta)

        summary[domain] = {
            "status": run_meta["status"],
            "offers_found": len(offers),
            "offers_matched": len(matches),
            "error": run_meta["error"],
        }

        if dry_run and matches:
            sample = list(matches.items())[:5]
            for item_id, m in sample:
                p = products_by_id.get(item_id, {})
                logger.info(f"  sample match [{m['match_method']} {m['match_confidence']}] "
                            f"ours: {p.get('product_name')!r} @ {p.get('current_default_price')} | "
                            f"theirs: {m['offer'].product_title!r} @ {m['offer'].price}")

    return summary


def main():
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    parser = argparse.ArgumentParser(description="Scrape competitor prices and write results to BigQuery")
    parser.add_argument("--domain", action="append", help="Limit to specific domain(s); repeatable")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and match but do not write to BigQuery")
    args = parser.parse_args()

    summary = run_scrapes(domains=args.domain, dry_run=args.dry_run)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
