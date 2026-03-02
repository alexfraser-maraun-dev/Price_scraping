# Price Comparison App Tasks

## 1. Project Planning & Requirements
- [x] Save BigQuery SQL query to source the products.
- [x] Determine the tech stack (Python FastAPI, React Vite).
- [x] Identify the target for price scraping (Google Merchant API - Price Insights).
- [x] Determine deployment strategy (Containerize for Google Cloud Run).

## 2. API Backend (FastAPI) Development
- [ ] Initialize Python environment and FastAPI project.
- [ ] Set up BigQuery client to run the `product_source.sql` query.
- [ ] Set up Google Merchant API client to fetch Price Insights by UPC.
- [ ] Implement data mapping logic:
  - Fetch 1000 BigQuery products.
  - Query Google Merchant API with UPCs.
  - Map competitor business names, URLs, and prices.
  - Calculate `((Competitor Price - Our Price) / Our Price) * 100`.
- [ ] Create API endpoints to serve this data to the frontend.

## 3. Frontend (React Vite) Development
- [ ] Initialize React Vite project.
- [ ] Implement responsive Price Comparison Dashboard UI.
- [ ] Fetch data from the FastAPI backend and display it in a datagrid/table.
- [ ] Implement UI for highlighting price differences based on the calculated percentage.

## 4. Deployment
- [ ] Write `Dockerfile` for the FastAPI backend.
- [ ] Write `Dockerfile` for the React frontend (or stage it to be served via FastAPI/Nginx).
- [ ] Provide instructions/scripts for deploying to Google Cloud Run.
