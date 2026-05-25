.PHONY: api-dev api-test api-docker api-docker-test api-docker-smoke web-dev web-test web-typecheck web-build web-smoke web-docker

UV_CACHE_DIR ?= .uv-cache

api-dev:
	UV_CACHE_DIR=$(UV_CACHE_DIR) uv run uvicorn proventl_api.app:app --app-dir apps/api/src --host 0.0.0.0 --port 8000 --reload

api-test:
	UV_CACHE_DIR=$(UV_CACHE_DIR) uv run pytest apps/api/tests

api-docker:
	docker compose up api

api-docker-test:
	docker compose --profile test run --rm api-test

api-docker-smoke:
	docker compose --profile smoke build api-smoke
	docker compose --profile smoke run --rm api-smoke

web-dev:
	cd apps/web && npm run dev

web-test:
	cd apps/web && npm run test

web-typecheck:
	cd apps/web && npm run typecheck

web-build:
	cd apps/web && npm run build

web-smoke:
	cd apps/web && npm run test:browser

web-docker:
	docker compose up web
