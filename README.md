# ProVenTL Website

ProVenTL is a web application for exploring peptide-protein interaction predictions between snake venom-derived peptides and cancer-related protein targets. The project packages a React frontend, an internal FastAPI backend, model/data artifacts, and Docker-based development workflows for the ProVenTL V1 prediction dashboard.

The app is based on the ProVenTL framework from Adhiva et al. (2026), using ProtT5 protein language model embeddings and a trained deep learning model to rank venom peptide candidates against curated UniProt cancer target proteins.

## Features

- Search curated cancer-related targets by UniProt ID, gene, protein name, organism, or family metadata.
- Run prediction against supported target proteins using local model and embedding artifacts.
- Review ranked peptide candidates with confidence scores and threshold-based classification.
- Inspect target profile metadata for selected proteins.
- Export ranked prediction results as CSV.
- Run frontend, backend, tests, and smoke checks locally or through Docker Compose.

## Repository Layout

```text
apps/api/                 FastAPI internal backend
apps/web/                 Vite React frontend
data/                     Runtime app data and SQLite cache location
docs/                     Planning, overview, references, and source material
model/                    Model notebook and required prediction artifacts
scripts/                  Utility and CI smoke scripts
compose.yml               Docker Compose development/test services
Makefile                  Common local development commands
pyproject.toml            Python project metadata
```

## Prerequisites

- Python 3.12 or newer, below 3.15
- `uv`
- Node.js and npm
- Docker and Docker Compose, for containerized development
- Required model and embedding artifacts under `model/`

The checked-in development defaults expect these files:

```text
model/best_model_auc_0.8748.h5
model/data_testing/Pep_Ular_ProtT5.csv
model/data_testing/Prot_Cancer_ProtT5.csv
model/data_testing/data_protein_kanker_uniprot.csv
model/data_testing/final_prediction_venom_results.csv
```

## Quick Start

Start the backend and frontend together with Docker Compose:

```bash
docker compose up api web
```

Then open:

```text
http://localhost:5173
```

The API runs on:

```text
http://localhost:8000
```

## Local Development

Install frontend dependencies:

```bash
cd apps/web
npm install
cd ../..
```

Run the backend:

```bash
make api-dev
```

Run the frontend in another shell:

```bash
make web-dev
```

The Vite dev server proxies `/api/...` requests to `http://localhost:8000` by default.

## Backend Configuration

The backend reads artifact paths from environment variables. Docker Compose sets these automatically. For non-Compose local runs, set:

```bash
export PROVENTL_MODEL_PATH=model/best_model_auc_0.8748.h5
export PROVENTL_PEPTIDE_EMBEDDINGS_PATH=model/data_testing/Pep_Ular_ProtT5.csv
export PROVENTL_PROTEIN_EMBEDDINGS_PATH=model/data_testing/Prot_Cancer_ProtT5.csv
export PROVENTL_TARGET_METADATA_PATH=model/data_testing/data_protein_kanker_uniprot.csv
export PROVENTL_APP_DATA_DIR=data
```

Useful backend endpoints:

```text
GET  /api/health/live
GET  /api/health/ready
GET  /api/targets/search?q=EGFR
GET  /api/targets/examples
GET  /api/targets/lookup?accession=P01133
POST /api/predictions
```

This is an internal website API and is not currently exposed as a public API contract.

## Common Commands

```bash
make api-dev            # Start FastAPI locally on port 8000
make api-test           # Run backend pytest suite
make api-docker         # Start backend through Docker Compose
make api-docker-test    # Run backend tests through Docker Compose
make api-docker-smoke   # Run backend CI smoke check through Docker Compose

make web-dev            # Start Vite frontend locally on port 5173
make web-test           # Run frontend unit tests
make web-typecheck      # Run TypeScript typecheck
make web-build          # Build the frontend
make web-smoke          # Run Playwright smoke tests
make web-docker         # Start frontend through Docker Compose
```

## Testing

Run backend tests:

```bash
make api-test
```

Run frontend checks:

```bash
make web-test
make web-typecheck
make web-build
```

Run browser smoke tests:

```bash
make web-smoke
```

## Documentation

- [Project overview](docs/overview/overview.md)
- [Backend spec](docs/planning/backend-spec.md)
- [Frontend spec](docs/planning/frontend-spec.md)
- [API README](apps/api/README.md)
- [Web README](apps/web/README.md)

## Notes

- Prediction results are cached in SQLite under the configured app data directory.
- Curated predictions are based on local embeddings and do not require live UniProt availability.
- Optional UniProt lookup is used for explicit unsupported accession checks.
- The V1 backend is intentionally app-internal, so endpoint contracts may change before a public API version exists.
