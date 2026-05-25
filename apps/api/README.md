# ProVenTL Internal API

This is the backend application entry point for ProVenTL V1. It is website-internal and does not expose public API documentation in this bootstrap slice.

## Development Commands

- `make api-test` runs the backend test suite locally.
- `make api-dev` starts the FastAPI app locally on port 8000.
- `make api-docker` starts the Docker development service.
- `make api-docker-test` runs the backend tests through Docker Compose.

## Current Slice

The current backend slice exposes process liveness at `GET /api/health/live` without loading model, embedding, metadata, cache, or UniProt resources.

It also exposes application readiness at `GET /api/health/ready`. Readiness checks the required backend environment configuration, verifies the configured model, embedding, metadata, and app data paths exist, and reports short artifact hashes for internal website metadata. This slice does not validate model shape, embedding dimensions, target registry consistency, cache migrations, UniProt, or prediction behavior.

Required readiness settings:

- `PROVENTL_MODEL_PATH`
- `PROVENTL_PEPTIDE_EMBEDDINGS_PATH`
- `PROVENTL_PROTEIN_EMBEDDINGS_PATH`
- `PROVENTL_TARGET_METADATA_PATH`
- `PROVENTL_APP_DATA_DIR`
