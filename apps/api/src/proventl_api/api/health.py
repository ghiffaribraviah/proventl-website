from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from proventl_api.core.config import BackendConfigError, load_backend_config
from proventl_api.targets.registry import (
    generate_configured_curated_target_registry,
    registry_metadata,
)

router = APIRouter(prefix="/api/health", tags=["health"])

@router.get("/live")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def readiness() -> JSONResponse:
    try:
        config = load_backend_config()
    except BackendConfigError as error:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "ready": False,
                "errors": [
                    {
                        "code": issue.code,
                        "setting": issue.setting,
                        "message": issue.message,
                    }
                    for issue in error.issues
                ],
                "artifacts": [],
            },
        )

    registry = generate_configured_curated_target_registry(
        config=config,
        generated_at=datetime.now(UTC),
    )

    return JSONResponse(
        status_code=200,
        content={
            "status": "ready",
            "ready": True,
            "errors": [],
            "artifacts": [
                {
                    "name": artifact.name,
                    "hash": artifact.short_hash,
                }
                for artifact in config.artifacts
            ],
            "data_directory": {
                "name": "app_data",
                "present": True,
            },
            "registry": registry_metadata(registry),
        },
    )
