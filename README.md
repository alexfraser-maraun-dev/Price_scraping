# Bici Price Intelligence

A full-stack price intelligence dashboard that pulls live product data from Lightspeed Retail via BigQuery, benchmarks it against Google Merchant Center competitor pricing, and surfaces actionable margin and market-position insights through an interactive React UI.

---

## Overview

This tool is built for a bike-shop retail context ("Bici"). It solves the problem of manually tracking whether your current prices are above or below what competitors charge. The pipeline is:

1. **BigQuery** – runs a recursive SQL query against the Lightspeed Retail data sync to surface the top 1,000 revenue-generating SKUs (last 3 months), with cost, price, margin, and 3-level category hierarchy.
2. **Google Merchant Center API** – fetches benchmark prices from the `PriceCompetitivenessProductView`, mapped to products by GTIN/UPC.
3. **FastAPI backend** – merges both data sources and serves a single `/api/products` endpoint.
4. **React + MUI frontend** – displays the data as a sortable, filterable table with live pricing strategy simulation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3, FastAPI, Uvicorn |
| **Data Warehouse** | Google BigQuery (`bici-klaviyo-datasync`) |
| **Competitor Benchmark** | Google Shopping Merchant Reports API v1 |
| **POS Integration** | Lightspeed Retail R-Series (OAuth2 REST client) |
| **Frontend** | React 19, Vite, Material UI v7 |
| **HTTP Client** | Axios |
| **Auth** | Google Service Account (two separate credentials) |

---

## Project Structure

```
Price_scraping/
├── backend/
│   ├── main.py                  # FastAPI app, API routes, Merchant API logic
│   ├── bigquery_client.py       # BigQuery read/write client (streaming inserts)
│   ├── lightspeed_client.py     # Lightspeed OAuth2 REST client (read + future write)
│   ├── requirements.txt
│   └── .env                     # Secrets (not committed)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Products.jsx     # Main dashboard: table, filters, pricing rules, metric tiles
│   │   │   └── Reports.jsx      # Reporting page
│   │   ├── components/
│   │   │   └── Logo.jsx
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
└── product_source.sql           # Source query: 3-mo revenue, cost, price, margin, categories
```

---

## Environment Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Two Google Cloud Service Account JSON key files:
  - One with BigQuery Data Viewer access (`bici-klaviyo-datasync`)
  - One with Merchant Center Reports API access

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
# BigQuery credentials (service account JSON path)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/bq-service-account.json

# Google Merchant Center credentials and account ID
MERCHANT_APPLICATION_CREDENTIALS=/path/to/merchant-service-account.json
MERCHANT_ID=123456789

# Lightspeed Retail API (optional, for future price-write functionality)
LIGHTSPEED_CLIENT_ID=your_client_id
LIGHTSPEED_CLIENT_SECRET=your_client_secret
LIGHTSPEED_REFRESH_TOKEN=your_refresh_token
LIGHTSPEED_ACCOUNT_ID=your_account_id
```

Start the backend:

```bash
.venv/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app opens at `http://localhost:5173`. It proxies API calls to `http://localhost:8000`.

> **Fallback mode**: If the backend is unreachable, the frontend automatically falls back to built-in mock data so the UI can be tested independently.

---

## Key Features

### Products Dashboard (`/`)

- **Metric tiles** — Live counts and aggregates: Average Margin, Proposed Margin, Below Market UPCs, Above Market UPCs, $ Total Below, % Total Below. All tiles scope to the current row selection when checkboxes are active.
- **Pricing strategy simulator** — Choose from 5 rule presets (match lowest, undercut by 1%, match average, beat average by 2%, match highest), then stack a % or $ adjustment on top. The "Change Result" column and "Proposed Margin" tile update in real time without touching any live data.
- **Google Benchmark column** — Shows the `PriceCompetitivenessProductView` benchmark price per UPC with a signed % delta vs. your price.
- **Competitor columns** — One column per enabled competitor in the registry, with color-coded price deltas, links to the competitor's product page, and a `≈` marker on low-confidence (fuzzy title) matches. Competitors are added/toggled live from the "Competitors" dialog.
- **Filters** — Search by product name or UPC, filter by Category, Brand, and market position (above/below). "Benchmarked Only" toggle limits the view to SKUs that have a Google benchmark match.
- **CSV import/export** — Upload a CSV with the required headers to override BigQuery data locally; export the current price list.
- **Run Scrape** — Re-fetches from the backend (BigQuery + Merchant API) on demand with a progress indicator.

### BigQuery Data Pipeline (`product_source.sql`)

The SQL query uses a recursive CTE to:
1. Pull the top 1,000 items by revenue over the trailing 3 months from `light_speed_retailne.sale_history`.
2. Walk the `light_speed_retailne.category_history` parent chain (up to 10 levels) to produce `category_main`, `subcategory_1`, `subcategory_2`.
3. Join item cost (`avg_cost`), default price (`item_price_history WHERE use_type = 'Default'`), and manufacturer name.
4. Compute `prospective_margin_pct = (price - cost) / price * 100`.

### Supported BigQuery Tables (Dataset: `bici-klaviyo-datasync.light_speed_retailne`)

| Table | Purpose |
|---|---|
| `sale_history` | Completed, non-voided sale headers |
| `sale_line_history` | Line-level revenue |
| `item_history` | SKU, UPC, cost |
| `item_price_history` | Default price per item |
| `category_history` | Category hierarchy |
| `manufacturer_history` | Brand names |

### Lightspeed Client (`lightspeed_client.py`)

Implements OAuth2 (refresh-token flow) against the Lightspeed R-Series REST API. Currently provides:
- `get_item(item_id)` – fetch item details by Lightspeed Item ID.
- `update_item_price()` – **disabled for safety**, full implementation drafted in comments for future use.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/products` | Merged BigQuery + Merchant API + scraped competitor prices |
| `GET` | `/api/competitors` | List the competitor registry |
| `POST` | `/api/competitors` | Add a competitor (auto-detects the data source) |
| `PATCH` | `/api/competitors/{domain}` | Enable/disable or edit a competitor |
| `POST` | `/api/scrape/run` | Trigger a scrape of all enabled competitors |
| `GET` | `/api/scrape/status` | Poll the running/last scrape |

### `ProductComparison` Response Schema

```json
{
  "item_id": 12345,
  "system_sku": "ELE-30451",
  "custom_sku": "SHI-RD-8150",
  "upc": "123456789012",
  "product_name": "Shimano Dura-Ace RD-R9200",
  "brand_name": "Shimano",
  "category_main": "Drivetrain",
  "subcategory_1": "Derailleurs",
  "subcategory_2": null,
  "current_cost": 145.00,
  "our_price": 289.99,
  "total_revenue": 8750.00,
  "prospective_margin_pct": 50.0,
  "competitors": [
    {
      "business_name": "Google Benchmark",
      "url": "",
      "price": 295.00,
      "price_diff_pct": 1.7
    }
  ]
}
```

---

## CSV Upload Format

The upload parser requires **exactly** these headers (case-insensitive):

```
brand_name, product_name, category_main, subcategory_1, subcategory_2,
custom_sku, total_revenue, current_default_price, upc, current_cost, prospective_margin_pct
```

Any missing header will cause the upload to reject the file with a descriptive error.

---

## Competitor Price Sourcing

The Merchant API v1 only exposes an aggregated benchmark price, so per-competitor prices are sourced by our own scrape pipeline (`backend/scrapers/` + `backend/run_scrape.py`).

Competitors live in the BigQuery table `BiciPricingScraper.Competitor_Registry` and are managed from the dashboard ("Competitors" button) or via `GET/POST/PATCH /api/competitors` — **no redeploy needed to add or swap one**. When a domain is added, the backend probes it and picks the cheapest working connector:

| Connector | How it reads prices | Example |
|---|---|---|
| `shopify_json` | Paginates the store's public `/products.json` (full catalog incl. barcode/sku) | thebikeshop.com, steedcycles.com |
| `shopify_html` | Walks `sitemap.xml` product URLs, parses JSON-LD on each page | enroute.cc |
| `serp_api` | Looks up our top-revenue GTINs on Google Shopping via DataForSEO (paid, needs `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`) and keeps listings sold by the domain | primeauvelo.com |

Scraped offers are matched to our catalog by GTIN/UPC (leading zeros stripped), then brand+SKU, then fuzzy title match (flagged `≈` in the UI as low-confidence). Results are written to:

- `bici-klaviyo-datasync.BiciPricingScraper.BiciPricingScraper_Runs` — one row per domain per run
- `bici-klaviyo-datasync.BiciPricingScraper.BiciPricingScraper_Competitors` — matched offers

`/api/products` merges the latest successful run per competitor into each product's `competitors[]`, alongside the Google Benchmark.

### Running a scrape

```bash
cd backend
python run_scrape.py --dry-run                   # fetch + match, no BQ writes
python run_scrape.py --domain thebikeshop.com    # one competitor
python run_scrape.py                             # all enabled competitors
```

A nightly Render Cron Job (`price-intelligence-scraper` in `render.yaml`) runs the full scrape at 09:00 UTC. The dashboard "Run Scrape" button triggers the same pipeline on demand via `POST /api/scrape/run`.

Scraping etiquette is built in: ~1 request/second per domain, identifiable User-Agent, robots.txt honored, public price data only.

---

## Development Notes

- **Mock data** is always available in `Products.jsx` and activates automatically when the backend API call fails. This allows full frontend development without GCP credentials.
- **`update_item_price()`** in `lightspeed_client.py` is intentionally disabled. Re-enabling it will allow the app to push suggested prices back to Lightspeed — treat this as a high-risk, two-step change.
- **CORS** is currently set to `allow_origins=["*"]` for development. Restrict this before any production deployment.
- The Merchant API GTIN-to-UPC match strips leading zeros on both sides to handle GTIN-14 vs. UPC-12 format differences.
