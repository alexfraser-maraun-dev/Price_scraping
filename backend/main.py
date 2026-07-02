import os
import json
import asyncio
import time
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import bigquery
from google.shopping import merchant_reports_v1
from google.oauth2 import service_account
import pandas as pd
from dotenv import load_dotenv
from starlette.middleware.sessions import SessionMiddleware
from bici_fastapi_auth import auth_router, require_auth, get_auth_config
from bigquery_client import BigQueryClient
from scrapers import detect_connector_type
from run_scrape import run_scrapes

load_dotenv()

# Explicitly set credentials if found in environment
bq_creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
merchant_creds_path = os.getenv("MERCHANT_APPLICATION_CREDENTIALS")

app = FastAPI(title="Price Comparison API")

app.add_middleware(
    SessionMiddleware, 
    secret_key=os.environ.get("SESSION_SECRET", "super-secret-default-key-change-in-prod"),
    same_site="none",
    https_only=os.environ.get("SESSION_HTTPS_ONLY", "True").lower() == "true"
)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class CompetitorPrice(BaseModel):
    business_name: str
    url: str = ""
    price: float
    price_diff_pct: float
    match_method: Optional[str] = None
    match_confidence: Optional[float] = None

class CompetitorEntry(BaseModel):
    domain: str
    display_name: Optional[str] = None
    connector_type: Optional[str] = None
    enabled: Optional[bool] = None

class CompetitorUpdate(BaseModel):
    display_name: Optional[str] = None
    connector_type: Optional[str] = None
    enabled: Optional[bool] = None

class ProductComparison(BaseModel):
    item_id: Optional[int]
    system_sku: str
    custom_sku: Optional[str]
    upc: Optional[str]
    product_name: str
    brand_name: Optional[str]
    category_main: Optional[str]
    subcategory_1: Optional[str]
    subcategory_2: Optional[str]
    current_cost: Optional[float]
    our_price: float
    total_revenue: float          # weekly revenue from sales_master_view
    weekly_units: Optional[int]
    prospective_margin_pct: Optional[float]
    qualifying_buckets: Optional[str]  # comma-separated list of buckets this SKU qualified through
    competitors: List[CompetitorPrice]

# Include the Auth Router
app.include_router(auth_router)

# Clients initialization
bq_client = None
merchant_report_client = None

try:
    if bq_creds_path:
        bq_creds = service_account.Credentials.from_service_account_file(bq_creds_path)
        bq_client = bigquery.Client(credentials=bq_creds, project=bq_creds.project_id)
        print(f"Successfully initialized BigQuery client for project: {bq_creds.project_id}")
    else:
        print("GOOGLE_APPLICATION_CREDENTIALS not set")
except Exception as e:
    print(f"Error initializing BigQuery client: {e}")

# Scraper-side BQ client (registry + scraped offers) reuses the same credentials
scraper_bq = BigQueryClient(client=bq_client) if bq_client else BigQueryClient()

try:
    if merchant_creds_path:
        merchant_creds = service_account.Credentials.from_service_account_file(merchant_creds_path)
        merchant_report_client = merchant_reports_v1.ReportServiceClient(credentials=merchant_creds)
        print(f"Successfully initialized Merchant API client (Reports) for ID: {os.getenv('MERCHANT_ID')}")
    else:
        print("MERCHANT_APPLICATION_CREDENTIALS not set")
except Exception as e:
    print(f"Error initializing Merchant API client: {e}")

# ---------------------------------------------------------------------------
# Response caching
# ---------------------------------------------------------------------------
# The /api/products build is expensive (full baseline SQL + Merchant API fetch),
# and it was re-run on every page load. Cache the built response and the Merchant
# insights map for a short TTL; the scrape job and /refresh invalidate on demand.
CACHE_TTL_SECONDS = float(os.getenv("CACHE_TTL_SECONDS", "300"))
_products_cache: dict = {"data": None, "ts": 0.0}
_insights_cache: dict = {"data": None, "ts": 0.0}
_products_lock = asyncio.Lock()
_insights_lock = asyncio.Lock()

@app.get("/api/health")
async def health_check():
    return {
        "bigquery_ready": bq_client is not None,
        "merchant_ready": merchant_report_client is not None,
        "merchant_id": os.getenv("MERCHANT_ID"),
        "bq_creds_path": bq_creds_path,
        "merchant_creds_path": merchant_creds_path
    }

def get_product_source_sql():
    path = os.path.join(os.path.dirname(__file__), '..', 'product_source.sql')
    if os.path.exists(path):
        with open(path, 'r') as f:
            return f.read()
    return None

async def get_price_insights(merchant_id: str):
    if not merchant_report_client or not merchant_id:
        return {}
    
    parent = f"accounts/{merchant_id}"
    
    # 1. Fetch Benchmark Prices scoped by ID
    comp_query = """
        SELECT 
            id,
            benchmark_price,
            report_country_code
        FROM price_competitiveness_product_view
        WHERE report_country_code = 'CA'
    """

    # 2. Fetch GTIN map scoped by ID (sequential join is not supported in Merchant Reports API, so we fetch both)
    product_query = """
        SELECT 
            id,
            gtin
        FROM product_view
    """

    try:
        start_time = time.time()
        
        # The Merchant client is synchronous and paginates lazily, so iterating the
        # pager also blocks. Materialize each result set inside a worker thread to
        # keep the event loop free, and run both fetches in parallel.
        def fetch_search(query: str):
            req = merchant_reports_v1.SearchRequest(parent=parent, query=query)
            return list(merchant_report_client.search(request=req))

        print(f"Fetching Merchant insights for ID: {merchant_id} (Parallel)...")
        comp_response, product_response = await asyncio.gather(
            asyncio.to_thread(fetch_search, comp_query),
            asyncio.to_thread(fetch_search, product_query),
        )
        
        benchmarks_by_id = {}
        for row in comp_response:
            comp = row.price_competitiveness_product_view
            if comp.id and comp.benchmark_price.amount_micros:
                benchmarks_by_id[comp.id] = comp.benchmark_price.amount_micros
                
        insights_by_upc: dict = {}
        for row in product_response:
            p = row.product_view
            gtin_list = list(p.gtin) if p.gtin else []
            if p.id and gtin_list and p.id in benchmarks_by_id:
                benchmark_data = {'benchmark_price_micros': benchmarks_by_id[p.id]}
                for raw_gtin in gtin_list:
                    raw_gtin = str(raw_gtin)
                    insights_by_upc[raw_gtin] = benchmark_data
                    # Index both with and without leading zeros to match BQ UPCs
                    stripped = raw_gtin.lstrip('0')
                    if stripped:
                        insights_by_upc[stripped] = benchmark_data
        
        print(f"Merchant API fetch took {time.time() - start_time:.2f} seconds. Found {len(insights_by_upc)} GTIN mappings.")
        return insights_by_upc
    except Exception as e:
        print(f"Error fetching price insights from Merchant API: {e}")
        return {}

async def get_price_insights_cached(merchant_id: str, force: bool = False) -> dict:
    """TTL-cached wrapper around get_price_insights, shared by /products and /search."""
    now = time.time()
    if not force and _insights_cache["data"] is not None and now - _insights_cache["ts"] < CACHE_TTL_SECONDS:
        return _insights_cache["data"]
    async with _insights_lock:
        now = time.time()
        if not force and _insights_cache["data"] is not None and now - _insights_cache["ts"] < CACHE_TTL_SECONDS:
            return _insights_cache["data"]
        data = await get_price_insights(merchant_id)
        _insights_cache["data"] = data
        _insights_cache["ts"] = time.time()
        return data

async def _build_product_comparisons(force_refresh: bool = False):
    """Run the full baseline query, enrich with Merchant + scraped offers, build models."""
    sql = get_product_source_sql()
    if not sql:
        raise HTTPException(status_code=500, detail="SQL query not found")

    overall_start = time.time()
    try:
        # 1. Fetch from BigQuery (blocking client → run off the event loop)
        print("Starting BigQuery fetch...")
        bq_start = time.time()
        results = await asyncio.to_thread(lambda: list(bq_client.query(sql).result()))
        print(f"BigQuery fetch took {time.time() - bq_start:.2f} seconds. Found {len(results)} rows.")

        # 2. Fetch Price Insights from Merchant API (cached)
        merchant_id = os.getenv("MERCHANT_ID", "")
        insights: dict = await get_price_insights_cached(merchant_id, force=force_refresh)

        # 2b. Fetch latest scraped competitor offers (most recent successful run per domain)
        scraped_offers_by_item: dict = {}
        display_names: dict = {}
        try:
            offers_start = time.time()
            for comp in await asyncio.to_thread(scraper_bq.list_competitors):
                display_names[comp["domain"]] = comp.get("display_name") or comp["domain"]
            for offer in await asyncio.to_thread(scraper_bq.fetch_latest_offers):
                scraped_offers_by_item.setdefault(offer["item_id"], []).append(offer)
            print(f"Scraped-offer fetch took {time.time() - offers_start:.2f} seconds "
                  f"({len(scraped_offers_by_item)} items with offers).")
        except Exception as e:
            print(f"Error fetching scraped competitor offers (continuing without): {e}")

        products = []
        for row in results:
            product = ProductComparison(
                item_id=int(row.item_id) if row.item_id else None,
                system_sku=str(row.system_sku) if row.system_sku else "",
                custom_sku=str(row.custom_sku) if row.custom_sku else None,
                upc=str(row.upc) if row.upc else None,
                product_name=row.product_name,
                brand_name=row.brand_name,
                category_main=row.category_main,
                subcategory_1=row.subcategory_1,
                subcategory_2=row.subcategory_2,
                current_cost=float(row.current_cost) if row.current_cost is not None else None,
                our_price=float(row.current_default_price) if row.current_default_price is not None else 0.0,
                total_revenue=float(row.total_revenue) if row.total_revenue is not None else 0.0,
                weekly_units=int(row.weekly_units) if row.weekly_units is not None else None,
                prospective_margin_pct=float(row.prospective_margin_pct) if row.prospective_margin_pct is not None else None,
                qualifying_buckets=str(row.qualifying_buckets) if row.qualifying_buckets else None,
                competitors=[]
            )
            
            # 3. Map Merchant Insights to Product by UPC string
            matched_insight = None
            if product.upc:
                clean_upc = str(product.upc).lstrip('0')
                if clean_upc in insights:
                    matched_insight = insights[clean_upc]
                    
            if matched_insight:
                benchmark_micros = matched_insight.get('benchmark_price_micros')
                if benchmark_micros:
                    benchmark_price = float(benchmark_micros) / 1_000_000
                    our_p = float(product.our_price) if product.our_price else 0.0
                    
                    if our_p > 0:
                        diff_pct = ((benchmark_price - our_p) / our_p) * 100
                        product.competitors.append(CompetitorPrice(
                            business_name="Google Benchmark",
                            url="",
                            price=float(round(benchmark_price, 2)),
                            price_diff_pct=float(round(diff_pct, 2))
                        ))

            # 4. Append scraped per-competitor prices
            our_p = float(product.our_price) if product.our_price else 0.0
            for offer in scraped_offers_by_item.get(product.item_id, []):
                offer_price = float(offer["price"])
                diff_pct = ((offer_price - our_p) / our_p) * 100 if our_p > 0 else 0.0
                product.competitors.append(CompetitorPrice(
                    business_name=display_names.get(offer["domain"], offer["domain"]),
                    url=offer.get("url") or "",
                    price=round(offer_price, 2),
                    price_diff_pct=round(diff_pct, 2),
                    match_method=offer.get("match_method"),
                    match_confidence=offer.get("match_confidence"),
                ))

            products.append(product)
            
        print(f"Total /api/products request took {time.time() - overall_start:.2f} seconds for {len(products)} items.")
        return products
        
    except Exception as e:
        print(f"Error in /api/products: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/products", response_model=List[ProductComparison])
async def get_product_comparisons(user: dict = Depends(require_auth), force_refresh: bool = False):
    if not bq_client:
        print("BQ client not initialized, returning empty list")
        return []

    now = time.time()
    if not force_refresh and _products_cache["data"] is not None and now - _products_cache["ts"] < CACHE_TTL_SECONDS:
        return _products_cache["data"]

    # Serialize concurrent misses so we build once, not once per waiting request
    async with _products_lock:
        now = time.time()
        if not force_refresh and _products_cache["data"] is not None and now - _products_cache["ts"] < CACHE_TTL_SECONDS:
            return _products_cache["data"]
        products = await _build_product_comparisons(force_refresh=force_refresh)
        _products_cache["data"] = products
        _products_cache["ts"] = time.time()
        return products

@app.get("/api/products/refresh")
async def refresh_products(user: dict = Depends(require_auth)):
    """Explicit endpoint to re-run the full baseline query, bypassing the cache."""
    return await get_product_comparisons(user, force_refresh=True)

# ---------------------------------------------------------------------------
# Competitor registry
# ---------------------------------------------------------------------------
@app.get("/api/competitors")
async def list_competitors(user: dict = Depends(require_auth)):
    return await asyncio.to_thread(scraper_bq.list_competitors)

@app.post("/api/competitors")
async def add_competitor(entry: CompetitorEntry, user: dict = Depends(require_auth)):
    domain = entry.domain.lower().strip().replace("https://", "").replace("http://", "").strip("/")
    if not domain or "." not in domain:
        raise HTTPException(status_code=400, detail="Invalid domain")

    connector_type = entry.connector_type
    if not connector_type:
        # Probe the site to pick the cheapest connector that can read its prices
        connector_type = await asyncio.to_thread(detect_connector_type, domain)

    ok = await asyncio.to_thread(
        scraper_bq.upsert_competitor, domain, entry.display_name, connector_type,
        entry.enabled if entry.enabled is not None else True,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save competitor")
    return {"domain": domain, "connector_type": connector_type, "enabled": entry.enabled if entry.enabled is not None else True}

@app.patch("/api/competitors/{domain}")
async def update_competitor(domain: str, update: CompetitorUpdate, user: dict = Depends(require_auth)):
    ok = await asyncio.to_thread(
        scraper_bq.upsert_competitor, domain.lower(), update.display_name,
        update.connector_type, update.enabled,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to update competitor")
    return {"domain": domain.lower(), "updated": True}

# ---------------------------------------------------------------------------
# Scrape trigger
# ---------------------------------------------------------------------------
scrape_state = {"running": False, "started_at": None, "finished_at": None, "last_result": None}

def _run_scrape_job(domains):
    try:
        result = run_scrapes(domains=domains, bq=scraper_bq)
        scrape_state["last_result"] = result
    except Exception as e:
        scrape_state["last_result"] = {"error": str(e)}
    finally:
        scrape_state["running"] = False
        scrape_state["finished_at"] = time.time()
        # Fresh offers landed — drop the cache so the next /api/products rebuilds
        _products_cache["data"] = None

@app.post("/api/scrape/run")
async def trigger_scrape(user: dict = Depends(require_auth), domain: Optional[str] = None):
    if scrape_state["running"]:
        raise HTTPException(status_code=409, detail="A scrape is already running")
    scrape_state.update({"running": True, "started_at": time.time(), "finished_at": None})
    asyncio.get_running_loop().run_in_executor(None, _run_scrape_job, [domain] if domain else None)
    return {"started": True}

@app.get("/api/scrape/status")
async def scrape_status(user: dict = Depends(require_auth)):
    return scrape_state

@app.get("/api/products/search")
async def search_products(q: str, user: dict = Depends(require_auth)):
    """Manually query BigQuery for specific products."""
    if not bq_client:
        raise HTTPException(status_code=500, detail="BigQuery client not initialized")

    # Use a faster, targeted search query
    sql = f"""
    WITH latest_items AS (
      SELECT
        id, system_sku, custom_sku, description, upc, manufacturer_id, category_id,
        CAST(avg_cost AS FLOAT64) as current_cost
      FROM `bici-klaviyo-datasync.light_speed_retailne.item_history`
      WHERE 
        LOWER(description) LIKE @q OR
        upc = @raw_q OR
        CAST(id AS STRING) = @raw_q OR
        CAST(system_sku AS STRING) = @raw_q
      QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_time DESC) = 1
      LIMIT 100
    ),
    latest_brands AS (
      SELECT id, name FROM `bici-klaviyo-datasync.light_speed_retailne.manufacturer_history`
      QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_time DESC) = 1
    ),
    latest_prices AS (
      SELECT item_id, CAST(amount AS FLOAT64) as price FROM `bici-klaviyo-datasync.light_speed_retailne.item_price_history`
      WHERE use_type = 'Default'
      QUALIFY ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY item_updated_time DESC) = 1
    )
    SELECT 
      i.id as item_id, i.system_sku, i.custom_sku, i.description as product_name, i.upc,
      b.name as brand_name, p.price as current_default_price, i.current_cost
    FROM latest_items i
    LEFT JOIN latest_brands b ON i.manufacturer_id = b.id
    LEFT JOIN latest_prices p ON i.id = p.item_id
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("q", "STRING", f"%{q.lower()}%"),
            bigquery.ScalarQueryParameter("raw_q", "STRING", q),
        ]
    )

    try:
        results = await asyncio.to_thread(
            lambda: list(bq_client.query(sql, job_config=job_config).result())
        )

        # Map to model (similar to get_products but simplified)
        merchant_id = os.getenv("MERCHANT_ID", "")
        insights = await get_price_insights_cached(merchant_id)
        
        products = []
        for row in results:
            product = ProductComparison(
                item_id=int(row.item_id) if row.item_id else None,
                system_sku=str(row.system_sku) if row.system_sku else "",
                custom_sku=str(row.custom_sku) if row.custom_sku else None,
                upc=str(row.upc) if row.upc else None,
                product_name=row.product_name,
                brand_name=row.brand_name,
                category_main=None, # Search doesn't do the recursive cat walk for speed
                subcategory_1=None,
                subcategory_2=None,
                current_cost=float(row.current_cost) if row.current_cost is not None else None,
                our_price=float(row.current_default_price) if row.current_default_price is not None else 0.0,
                total_revenue=0.0,
                weekly_units=0,
                prospective_margin_pct=None,
                qualifying_buckets="search_result",
                competitors=[]
            )
            
            # Map insights
            if product.upc:
                clean_upc = str(product.upc).lstrip('0')
                if clean_upc in insights:
                    matched = insights[clean_upc]
                    benchmark_micros = matched.get('benchmark_price_micros')
                    if benchmark_micros:
                        benchmark_price = float(benchmark_micros) / 1_000_000
                        our_p = float(product.our_price) if product.our_price else 0.0
                        diff_pct = ((benchmark_price - our_p) / our_p) * 100 if our_p > 0 else 0.0
                        product.competitors.append(CompetitorPrice(
                            business_name="Google Benchmark",
                            price=float(round(benchmark_price, 2)),
                            price_diff_pct=float(round(diff_pct, 2))
                        ))
            products.append(product)
            
        return products
    except Exception as e:
        print(f"Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
