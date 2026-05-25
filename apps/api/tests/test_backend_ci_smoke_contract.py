from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_backend_ci_smoke_path_is_exposed_to_maintainers_and_github_actions():
    makefile = (REPO_ROOT / "Makefile").read_text(encoding="utf-8")
    compose = (REPO_ROOT / "compose.yml").read_text(encoding="utf-8")
    workflow = (
        REPO_ROOT / ".github/workflows/backend-ci-smoke.yml"
    ).read_text(encoding="utf-8")
    smoke_script = (REPO_ROOT / "scripts/backend_ci_smoke.sh").read_text(
        encoding="utf-8"
    )
    smoke_runner = (REPO_ROOT / "scripts/backend_ci_smoke.py").read_text(
        encoding="utf-8"
    )

    assert "api-docker-smoke:" in makefile
    assert "docker compose --profile smoke run --rm api-smoke" in makefile
    assert "api-smoke:" in compose
    assert "PROVENTL_MODEL_PATH: /app/model/best_model_auc_0.8748.h5" in compose
    assert "make api-docker-smoke" in workflow

    assert "python -m proventl_api.targets.registry_cli --local-only" in smoke_script
    assert "pytest apps/api/tests -q" in smoke_script
    assert "scripts/backend_ci_smoke.py --start-server" in smoke_script
    assert "\"uvicorn\"" in smoke_runner
    assert "\"proventl_api.app:app\"" in smoke_runner
