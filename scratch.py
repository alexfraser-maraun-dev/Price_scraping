from google.cloud import bigquery
client = bigquery.Client()
query_job = client.query("""
SELECT table_name FROM `bici-klaviyo-datasync.light_speed_retailne.INFORMATION_SCHEMA.TABLES` WHERE table_name LIKE "%sales%"
""")
for row in query_job:
    print(row.table_name)
