#!/usr/bin/env bash
set -euo pipefail

uv run python -m proventl_api.targets.registry_cli --local-only
uv run pytest apps/api/tests -q

export PROVENTL_APP_DATA_DIR="${PROVENTL_SMOKE_APP_DATA_DIR:-$(mktemp -d)}"
export PROVENTL_RATE_LIMIT_SEARCH_REQUESTS="${PROVENTL_RATE_LIMIT_SEARCH_REQUESTS:-1}"
export PROVENTL_RATE_LIMIT_WINDOW_SECONDS="${PROVENTL_RATE_LIMIT_WINDOW_SECONDS:-60}"

uv run python scripts/backend_ci_smoke.py --start-server
