import os
import subprocess
import sys
import time

import httpx


BASE_URL = f"http://127.0.0.1:{os.environ.get('PROVENTL_SMOKE_PORT', '8000')}"


def main() -> int:
    server = _start_server() if "--start-server" in sys.argv else None
    try:
        with httpx.Client(base_url=BASE_URL, timeout=120.0) as client:
            _wait_for_readiness(client)
            _verify_curated_search_and_rate_limit(client)
            _verify_curated_lookup(client)
            _verify_machine_readable_prediction_error(client)
            _verify_real_prediction_and_cache_reuse(client)
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=10)
    return 0


def _start_server() -> subprocess.Popen:
    port = os.environ.get("PROVENTL_SMOKE_PORT", "8000")
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "proventl_api.app:app",
            "--host",
            "127.0.0.1",
            "--port",
            port,
        ]
    )


def _wait_for_readiness(client: httpx.Client) -> None:
    deadline = time.monotonic() + 120
    last_error = None
    while time.monotonic() < deadline:
        try:
            response = client.get("/api/health/ready")
            if response.status_code == 200 and response.json().get("ready") is True:
                return
            last_error = f"{response.status_code} {response.text}"
        except httpx.HTTPError as error:
            last_error = str(error)
        time.sleep(1)
    raise AssertionError(f"Backend did not become ready: {last_error}")


def _verify_curated_search_and_rate_limit(client: httpx.Client) -> None:
    response = client.get("/api/targets/search", params={"q": "p01133"})
    _assert_status(response, 200)
    payload = response.json()
    assert payload["count"] >= 1
    assert any(result["uniprot_id"] == "P01133" for result in payload["results"])

    limited_response = client.get("/api/targets/search", params={"q": "p01133"})
    _assert_status(limited_response, 429)
    assert limited_response.json()["error"]["code"] == "RATE_LIMITED"


def _verify_curated_lookup(client: httpx.Client) -> None:
    response = client.get("/api/targets/lookup", params={"accession": " p01133 "})
    _assert_status(response, 200)
    payload = response.json()
    assert payload["state"] == "available-curated"
    assert payload["prediction_eligible"] is True
    assert payload["target"]["uniprot_id"] == "P01133"


def _verify_machine_readable_prediction_error(client: httpx.Client) -> None:
    response = client.post(
        "/api/predictions",
        json={"target_uniprot_id": "P01133", "threshold": 0.10},
    )
    _assert_status(response, 400)
    payload = response.json()
    assert payload["state"] == "invalid-request"
    assert payload["error"]["code"] == "INVALID_THRESHOLD"


def _verify_real_prediction_and_cache_reuse(client: httpx.Client) -> None:
    request = {"target_uniprot_id": "P01133", "threshold": 0.95}
    first_response = client.post("/api/predictions", json=request)
    second_response = client.post("/api/predictions", json=request)
    _assert_status(first_response, 200)
    _assert_status(second_response, 200)

    first_payload = first_response.json()
    second_payload = second_response.json()
    assert len(first_payload["predictions"]) == 145
    assert first_payload == second_payload


def _assert_status(response: httpx.Response, expected_status: int) -> None:
    assert response.status_code == expected_status, response.text


if __name__ == "__main__":
    raise SystemExit(main())
