# Price Comparison Dashboard - Implementation Plan

## Goal Description
Build a full-stack Price Comparison Dashboard. A Python FastAPI backend will retrieve up to 1,000 top products from BigQuery, query the Google Merchant API (Price Insights) using the product UPCs to find competitor prices, and calculate the price difference percentage. A React (Vite) frontend will display this data in a user-friendly dashboard. The entire application will be containerized for deployment on Google Cloud Run.

## Proposed Architecture

### Backend (Python / FastAPI)
- **Framework**: FastAPI for high performance and automatic OpenAPI documentation.> [!IMPORTANT]
> **API Migration**: We have successfully migrated from `v1beta` to `v1` (following the Feb 28 sunset). 
> 
> **Permission Split**:
> 1. **Administrative (One-Time)**: The Merchant API `v1` requires a one-time project registration (`registerGcp`). This must be done by an **Admin** user to link the GCP project.
> 2. **Operational (Ongoing)**: The actual "Price Insights" tool only requires the **Standard** role for the Service Account. This follows the "Principle of Least Privilege."

- **Data Ingestion**: Use `google-cloud-bigquery` to execute the provided `product_source.sql` script.
- **Price Sourcing**: Use `google-api-python-client` (or appropriate REST calls) to interact with the Google Merchant API for Price Insights.
## Data Mapping & Join Logic
**: 
  - Correlate BigQuery output with Merchant API responses by UPC.
  - Calculate the price difference metric: `((Competitor Price - Our Price) / Our Price) * 100`.
  - Format the final data structure containing: Our Product Details, Competitor Business Name, Competitor URL, Competitor Price, and Price Diff %.

### Frontend (React / Vite)
- **Framework**: React initialized with Vite for fast builds.
- **Styling**: Vanilla CSS or a tailored UI component library as needed, focusing on a premium, responsive data-grid layout.
- **Features**: Data fetching from the FastAPI backend, sorting, filtering, and visual indicators for price competitiveness (e.g., green for cheaper, red for more expensive).

### Deployment
- **Containerization**: Dockerfiles for both frontend and backend (or a combined deployment if serving static frontend files from FastAPI).
- **Hosting**: Google Cloud Run support.

## Verification Plan
### Automated & Manual Tests
1. **Backend Tests**: Verify BigQuery and Merchant API client connections (mocked if necessary). Assert the calculation logic is mathematically accurate.
2. **Frontend Tests**: Ensure the UI renders correctly and handles data loading states gracefully.
3. **End-to-End**: Run the app locally via Docker Compose to simulate the production environment before providing deployment instructions.
