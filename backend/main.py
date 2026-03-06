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

load_dotenv()

# Explicitly set credentials if found in environment
bq_creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
merchant_creds_path = os.getenv("MERCHANT_APPLICATION_CREDENTIALS")

app = FastAPI(title="Price Comparison API")

app.add_middleware(
    SessionMiddleware, 
    secret_key=os.environ.get("SESSION_SECRET", "super-secret-default-key-change-in-prod"),
    same_site="none",
    https_only=True
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
    url: str
    price: float
    price_diff_pct: float

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
    total_revenue: float
    prospective_margin_pct: Optional[float]
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

try:
    if merchant_creds_path:
        merchant_creds = service_account.Credentials.from_service_account_file(merchant_creds_path)
        merchant_report_client = merchant_reports_v1.ReportServiceClient(credentials=merchant_creds)
        print(f"Successfully initialized Merchant API client (Reports) for ID: {os.getenv('MERCHANT_ID')}")
    else:
        print("MERCHANT_APPLICATION_CREDENTIALS not set")
except Exception as e:
    print(f"Error initializing Merchant API client: {e}")

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
        
        # Define search tasks for parallel execution
        async def fetch_comp():
            req = merchant_reports_v1.SearchRequest(parent=parent, query=comp_query)
            return merchant_report_client.search(request=req)

        async def fetch_products():
            req = merchant_reports_v1.SearchRequest(parent=parent, query=product_query)
            return merchant_report_client.search(request=req)

        print(f"Fetching Merchant insights for ID: {merchant_id} (Parallel)...")
        # Run Merchant API queries in parallel to save time
        comp_response, product_response = await asyncio.gather(fetch_comp(), fetch_products())
        
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

@app.get("/api/products", response_model=List[ProductComparison])
async def get_product_comparisons(user: dict = Depends(require_auth)):
    if not bq_client:
        print("BQ client not initialized, returning empty list")
        return []
        
    sql = get_product_source_sql()
    if not sql:
        raise HTTPException(status_code=500, detail="SQL query not found")

    overall_start = time.time()
    try:
        # 1. Fetch from BigQuery
        print("Starting BigQuery fetch...")
        bq_start = time.time()
        query_job = bq_client.query(sql)
        results = list(query_job.result())
        print(f"BigQuery fetch took {time.time() - bq_start:.2f} seconds. Found {len(results)} rows.")
        
        # 2. Fetch Price Insights from Merchant API
        merchant_id = os.getenv("MERCHANT_ID", "")
        insights: dict = await get_price_insights(merchant_id)
        
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
                prospective_margin_pct=float(row.prospective_margin_pct) if row.prospective_margin_pct is not None else None,
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
            
            products.append(product)
            
        print(f"Total /api/products request took {time.time() - overall_start:.2f} seconds for {len(products)} items.")
        return products
        
    except Exception as e:
        print(f"Error in /api/products: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
