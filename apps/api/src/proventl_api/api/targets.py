from datetime import UTC, datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from proventl_api.cache import TargetMetadataCache, cache_database_path
from proventl_api.core.config import BackendConfigError, load_backend_config
from proventl_api.lookup import lookup_target as lookup_target_response
from proventl_api.targets.registry import (
    generate_configured_curated_target_registry,
    select_curated_example_targets,
    search_curated_targets,
)

router = APIRouter(prefix="/api/targets", tags=["targets"])


def _backend_not_ready_response(error: BackendConfigError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "status": "not_ready",
            "errors": [
                {
                    "code": issue.code,
                    "setting": issue.setting,
                    "message": issue.message,
                }
                for issue in error.issues
            ],
        },
    )


@router.get("/search")
async def search_targets(q: str = "") -> JSONResponse:
    try:
        config = load_backend_config()
    except BackendConfigError as error:
        return _backend_not_ready_response(error)

    registry = generate_configured_curated_target_registry(
        config=config,
        generated_at=datetime.now(UTC),
    )

    return JSONResponse(
        status_code=200,
        content=search_curated_targets(targets=registry.targets, query=q),
    )


@router.get("/lookup")
async def lookup_target(request: Request, accession: str = "") -> JSONResponse:
    try:
        config = load_backend_config()
    except BackendConfigError as error:
        return _backend_not_ready_response(error)

    registry = generate_configured_curated_target_registry(
        config=config,
        generated_at=datetime.now(UTC),
    )
    metadata_cache = TargetMetadataCache(cache_database_path(config.app_data_dir))
    metadata_cache.migrate()

    return JSONResponse(
        status_code=200,
        content=lookup_target_response(
            targets=registry.targets,
            accession=accession,
            uniprot_client=request.app.state.uniprot_client,
            metadata_cache=metadata_cache,
        ),
    )


@router.get("/examples")
async def target_examples() -> JSONResponse:
    try:
        config = load_backend_config()
    except BackendConfigError as error:
        return _backend_not_ready_response(error)

    registry = generate_configured_curated_target_registry(
        config=config,
        generated_at=datetime.now(UTC),
    )

    return JSONResponse(
        status_code=200,
        content=select_curated_example_targets(targets=registry.targets),
    )
