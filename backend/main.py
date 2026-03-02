import os
import json
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import bigquery
from googleapiclient.discovery import build
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

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
    # BigQuery Client
    # To use application-default credentials (via gcloud auth application-default login),
    # GOOGLE_APPLICATION_CREDENTIALS should NOT be set, or it should point to a valid file.
    bq_client = bigquery.Client()
    
    # Merchant API Client
    # Depending on exact API needs, 'content' v2.1 is typical for Merchant Center
    merchant_service = None
    MERCHANT_ID = os.getenv("MERCHANT_ID")
    if MERCHANT_ID:
        merchant_service = build('content', 'v2.1', cache_discovery=False)
except Exception as e:
    print(f"Warning: Failed to initialize GCP clients: {e}")
    bq_client = None
    merchant_service = None

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
    competitors: List[CompetitorPrice] = []

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

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
        
        products = []
        for row in results:
            product = ProductComparison(
                system_sku=row.system_sku,
                custom_sku=row.custom_sku,
                upc=row.upc,
                product_name=row.product_name,
                brand_name=row.brand_name,
                category_main=row.category_main,
                subcategory_1=row.subcategory_1,
                subcategory_2=row.subcategory_2,
                our_price=row.current_default_price,
                total_revenue=row.total_revenue,
                competitors=[]
            )
            
            # 2. Query Google Merchant API (Placeholder for actual implementation)
            # You will need to implement the specific Merchant API call here based on
            # the exact endpoints you have access to for Price Insights.
            
            # Example Placeholder Logic:
            # if product.upc:
            #     insights = get_price_insights(product.upc)
            #     for comp in insights:
            #         # Check if competitor URL matches our target list
            #         if any(target in comp.url for target in TARGET_COMPETITORS):
            #             diff_pct = ((comp.price - product.our_price) / product.our_price) * 100 if product.our_price else 0
            #             product.competitors.append(CompetitorPrice(
            #                 business_name=comp.name,
            #                 url=comp.url,
            #                 price=comp.price,
            #                 price_diff_pct=round(diff_pct, 2)
            #             ))
            
            products.append(product)
            
        return products
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
