import os
import json
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import bigquery
from google.shopping import merchant_reports_v1
from google.oauth2 import service_account
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# Explicitly set credentials if found in environment
bq_creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
merchant_creds_path = os.getenv("MERCHANT_APPLICATION_CREDENTIALS")

app = FastAPI(title="Price Comparison API")

# Target Competitors
TARGET_COMPETITORS = [
    "primeauvelo.com",
    "enroute.cc",
    "thebikeshop.com",
    "steedcycles.com"
]

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize GCP Clients
try:
    # 1. BigQuery Client (using bici-klaviyo-datasync credentials)
    if bq_creds_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = bq_creds_path
    bq_client = bigquery.Client()
    print("Successfully initialized BigQuery client")
    
    # 2. Merchant API Client (using bici-price-compare credentials)
    merchant_report_client = None
    MERCHANT_ID = os.getenv("MERCHANT_ID")
    if merchant_creds_path:
        # Use service_account.Credentials to initialize the new Merchant API client
        creds = service_account.Credentials.from_service_account_file(merchant_creds_path)
        merchant_report_client = merchant_reports_v1.ReportServiceClient(credentials=creds)
        print(f"Successfully initialized Merchant API client (Reports) for ID: {MERCHANT_ID}")
    
    # Reset credentials to default BQ key for subsequent BQ operations if needed
    if bq_creds_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = bq_creds_path

except Exception as e:
    print(f"Warning: Failed to initialize GCP clients: {e}")
    bq_client = None
    merchant_report_client = None

# Load the SQL query
def get_product_source_sql() -> str:
    sql_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'product_source.sql')
    try:
        with open(sql_path, 'r') as file:
            return file.read()
    except FileNotFoundError:
        print(f"Error: Could not find {sql_path}")
        return ""

class CompetitorPrice(BaseModel):
    business_name: str
    url: str
    price: float
    price_diff_pct: float

class ProductComparison(BaseModel):
    item_id: Optional[int] = None
    system_sku: str
    custom_sku: Optional[str] = None
    upc: Optional[str] = None
    product_name: Optional[str] = None
    brand_name: Optional[str] = None
    category_main: Optional[str] = None
    subcategory_1: Optional[str] = None
    subcategory_2: Optional[str] = None
    our_price: Optional[float] = None
    total_revenue: Optional[float] = None
    avg_margin_pct: Optional[float] = None
    competitors: List[CompetitorPrice] = []

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

async def get_price_insights(merchant_id: str) -> dict:
    """
    Fetches benchmark price insights from Google Merchant Center.
    Uses the PriceCompetitivenessProductView to get the current Google Benchmark.
    Maps by GTIN to align with LightSpeed UPCs.
    """
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

    # 2. Fetch GTIN map scoped by ID
    product_query = """
        SELECT 
            id,
            gtin
        FROM product_view
    """

    try:
        # Get Benchmarks
        comp_request = merchant_reports_v1.SearchRequest(parent=parent, query=comp_query)
        comp_response = merchant_report_client.search(request=comp_request)
        
        benchmarks_by_id = {}
        for row in comp_response:
            comp = row.price_competitiveness_product_view
            if comp.id and comp.benchmark_price.amount_micros:
                benchmarks_by_id[comp.id] = comp.benchmark_price.amount_micros
                
        # Get GTINs
        product_request = merchant_reports_v1.SearchRequest(parent=parent, query=product_query)
        product_response = merchant_report_client.search(request=product_request)
        
        insights_by_upc: dict = {}
        for row in product_response:
            p = row.product_view
            # gtin is a repeated protobuf field, access first element
            gtin_list = list(p.gtin) if p.gtin else []
            if p.id and gtin_list and p.id in benchmarks_by_id:
                benchmark_data = {'benchmark_price_micros': benchmarks_by_id[p.id]}
                for raw_gtin in gtin_list:
                    raw_gtin = str(raw_gtin)
                    # Index both with and without leading zeros to match BQ UPCs
                    insights_by_upc[raw_gtin] = benchmark_data
                    stripped = raw_gtin.lstrip('0')
                    if stripped:
                        insights_by_upc[stripped] = benchmark_data
        
        return insights_by_upc
    except Exception as e:
        print(f"Error fetching price insights from new Merchant API: {e}")
        return {}

@app.get("/api/products", response_model=List[ProductComparison])
async def get_product_comparisons():
    if not bq_client:
        # Fallback for development if BQ is not configured
        print("BQ client not initialized, returning empty list")
        return []
        
    sql = get_product_source_sql()
    if not sql:
        raise HTTPException(status_code=500, detail="SQL query not found")

    try:
        # 1. Fetch from BigQuery
        query_job = bq_client.query(sql)
        results = query_job.result()
        
        # 2. Fetch Price Insights from Merchant API
        merchant_id = os.getenv("MERCHANT_ID", "")
        insights = await get_price_insights(merchant_id)
        
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
                our_price=float(row.current_default_price) if row.current_default_price else 0.0,
                total_revenue=float(row.total_revenue) if row.total_revenue else 0.0,
                avg_margin_pct=float(row.avg_margin_pct) if row.avg_margin_pct is not None else None,
                competitors=[]
            )
            
            # 3. Map Merchant Insights to Product by UPC string
            # We strip leading zeros to ensure generic GTIN vs UPC-12 equality
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
            
        return products
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
