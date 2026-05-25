import os
import time
from dataclasses import dataclass, field

from fastapi import Request
from fastapi.responses import JSONResponse


DEFAULT_WINDOW_SECONDS = 60
DEFAULT_LIMITS = {
    "target-search": 120,
    "target-lookup": 30,
    "prediction": 20,
}

LIMIT_SETTINGS = {
    "target-search": "PROVENTL_RATE_LIMIT_SEARCH_REQUESTS",
    "target-lookup": "PROVENTL_RATE_LIMIT_LOOKUP_REQUESTS",
    "prediction": "PROVENTL_RATE_LIMIT_PREDICTION_REQUESTS",
}

RATE_LIMIT_MESSAGES = {
    "target-search": "Too many target search requests. Please try again shortly.",
    "target-lookup": "Too many target lookup requests. Please try again shortly.",
    "prediction": "Too many prediction requests. Please try again shortly.",
}


@dataclass
class RateLimiter:
    requests_by_key: dict[tuple[str, str], list[float]] = field(default_factory=dict)

    def allow(self, *, route: str, client: str, now: float | None = None) -> bool:
        current_time = time.monotonic() if now is None else now
        window_seconds = _window_seconds()
        limit = _request_limit(route)
        key = (route, client)
        request_times = [
            request_time
            for request_time in self.requests_by_key.get(key, [])
            if current_time - request_time < window_seconds
        ]
        self.requests_by_key[key] = request_times
        if len(request_times) >= limit:
            return False

        request_times.append(current_time)
        return True


def rate_limit_route(request: Request) -> str | None:
    if request.method == "GET" and request.url.path == "/api/targets/search":
        return "target-search"
    if request.method == "GET" and request.url.path == "/api/targets/lookup":
        return "target-lookup"
    if request.method == "POST" and request.url.path == "/api/predictions":
        return "prediction"
    return None


def rate_limited_response(route: str) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "state": "rate-limited",
            "error": {
                "code": "RATE_LIMITED",
                "route": route,
                "message": RATE_LIMIT_MESSAGES[route],
            },
        },
    )


def request_client_id(request: Request) -> str:
    if request.client is None:
        return "unknown"
    return request.client.host


def _window_seconds() -> float:
    return _positive_float(
        os.environ.get("PROVENTL_RATE_LIMIT_WINDOW_SECONDS"),
        default=DEFAULT_WINDOW_SECONDS,
    )


def _request_limit(route: str) -> int:
    return _positive_int(
        os.environ.get(LIMIT_SETTINGS[route]),
        default=DEFAULT_LIMITS[route],
    )


def _positive_float(value: str | None, *, default: float) -> float:
    if value is None:
        return default
    try:
        parsed = float(value)
    except ValueError:
        return default
    if parsed <= 0:
        return default
    return parsed


def _positive_int(value: str | None, *, default: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    if parsed <= 0:
        return default
    return parsed
