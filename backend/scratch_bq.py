import os
from google.cloud import bigquery
from dotenv import load_dotenv
from collections import Counter

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

client = bigquery.Client()

sql_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'product_source.sql')
with open(sql_path) as f:
    sql = f.read()

# Remove the LIMIT clause for a full run
test_sql = sql.replace("ORDER BY i.system_sku;", "ORDER BY i.system_sku;")

print("Running FULL query (no limit) — counting results...\n")
try:
    results = list(client.query(test_sql).result())
    print(f"Total unique SKUs returned: {len(results)}\n")

    # Count how many SKUs appear in each bucket
    bucket_counter = Counter()
    multi_bucket = 0
    for row in results:
        buckets = row.qualifying_buckets.split(",") if row.qualifying_buckets else []
        for b in buckets:
            bucket_counter[b.strip()] += 1
        if len(buckets) > 1:
            multi_bucket += 1

    print("SKU count per bucket:")
    for bucket, count in sorted(bucket_counter.items()):
        print(f"  {bucket}: {count}")

    print(f"\nSKUs appearing in 2+ buckets (deduped): {multi_bucket}")
    
    # Check UPC coverage
    no_upc = sum(1 for row in results if not row.upc)
    print(f"SKUs missing UPC: {no_upc}  (should be 0)")
    
    # Sample of qualifying_buckets values
    print("\nSample rows:")
    for row in results[:5]:
        print(f"  SKU={row.system_sku}  Rev=${row.total_revenue:.2f}  Units={row.weekly_units}  Buckets={row.qualifying_buckets}")
        
except Exception as e:
    print(f"ERROR: {e}")
