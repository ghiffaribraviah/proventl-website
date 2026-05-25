from fastapi import FastAPI

from proventl_api.api.health import router as health_router
from proventl_api.api.predictions import router as predictions_router
from proventl_api.api.targets import router as targets_router
from proventl_api.lookup import UniProtClient, UniProtRestClient
from proventl_api.rate_limit import (
    RateLimiter,
    rate_limit_route,
    rate_limited_response,
    request_client_id,
)


def create_app(
    uniprot_client: UniProtClient | None = None,
    model_loader=None,
) -> FastAPI:
    app = FastAPI(
        title="ProVenTL Internal API",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.uniprot_client = uniprot_client or UniProtRestClient()
    app.state.model_loader = model_loader
    app.state.rate_limiter = RateLimiter()

    @app.middleware("http")
    async def enforce_route_rate_limits(request, call_next):
        route = rate_limit_route(request)
        if route is not None and not app.state.rate_limiter.allow(
            route=route,
            client=request_client_id(request),
        ):
            return rate_limited_response(route)
        return await call_next(request)

    app.include_router(health_router)
    app.include_router(targets_router)
    app.include_router(predictions_router)

    return app


app = create_app()
