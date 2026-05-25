import asyncio
import hashlib
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest

from proventl_api.app import create_app
from proventl_api.cache import PredictionResultCache, cache_database_path


async def post_prediction(
    payload: dict[str, object],
    *,
    model_loader=None,
) -> httpx.Response:
    transport = httpx.ASGITransport(app=create_app(model_loader=model_loader))
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.post("/api/predictions", json=payload)


async def post_prediction_content(
    content: str,
    *,
    model_loader=None,
) -> httpx.Response:
    transport = httpx.ASGITransport(app=create_app(model_loader=model_loader))
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.post(
            "/api/predictions",
            content=content,
            headers={"content-type": "application/json"},
        )


def test_prediction_endpoint_returns_ranked_rows_for_curated_target(
    monkeypatch,
    tmp_path,
):
    artifacts = configure_prediction_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": " p01133 ", "threshold": 0.50},
            model_loader=lambda path: FeatureSumModel(),
        )
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["target"] == {
        "uniprot_id": "P01133",
        "gene": "EGFR",
        "protein_name": "Epidermal growth factor receptor",
        "organism": "Homo sapiens",
        "protein_family": "Receptor tyrosine kinase",
    }
    assert payload["threshold"] == 0.50
    assert payload["model"] == {
        "version": "best_model_auc_0.8748",
        "hash": hashlib.sha256(b"model artifact").hexdigest()[:8],
    }
    assert payload["data"] == {
        "peptide_embeddings_hash": artifacts["peptide_hash"],
        "protein_embeddings_hash": artifacts["protein_hash"],
    }
    assert payload["summary"] == {
        "total": 3,
        "high_confidence": 2,
        "below_threshold": 1,
    }
    assert payload["predictions"] == [
        {
            "rank": 1,
            "peptide_id": "VP_HIGH",
            "sequence": "HHHH",
            "source_description": "High scoring venom peptide",
            "classifier_score": 0.7,
            "classification": "high confidence",
        },
        {
            "rank": 2,
            "peptide_id": "VP_MID",
            "sequence": "MMMM",
            "source_description": "Mid scoring venom peptide",
            "classifier_score": 0.5,
            "classification": "high confidence",
        },
        {
            "rank": 3,
            "peptide_id": "VP_LOW",
            "sequence": "LLLL",
            "source_description": "Low scoring venom peptide",
            "classifier_score": 0.4,
            "classification": "below threshold",
        },
    ]


def test_prediction_endpoint_reuses_cached_probabilities_without_model_inference(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(monkeypatch, tmp_path)
    model = CountingFeatureSumModel()

    first_response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.50},
            model_loader=lambda path: model,
        )
    )
    second_response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "p01133", "threshold": 0.50},
            model_loader=lambda path: model,
        )
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert second_response.json() == first_response.json()
    assert model.predict_call_count == 1


def test_prediction_endpoint_reuses_cached_probabilities_across_thresholds(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(monkeypatch, tmp_path)
    model = CountingFeatureSumModel()

    first_response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.50},
            model_loader=lambda path: model,
        )
    )
    second_response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.60},
            model_loader=lambda path: model,
        )
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert model.predict_call_count == 1
    assert first_response.json()["summary"] == {
        "total": 3,
        "high_confidence": 2,
        "below_threshold": 1,
    }
    assert second_response.json()["summary"] == {
        "total": 3,
        "high_confidence": 1,
        "below_threshold": 2,
    }
    assert [
        row["classification"]
        for row in second_response.json()["predictions"]
    ] == ["high confidence", "below threshold", "below threshold"]


def test_prediction_endpoint_misses_cache_when_artifact_hash_changes(
    monkeypatch,
    tmp_path,
):
    artifacts = configure_prediction_artifacts(monkeypatch, tmp_path)
    model = CountingFeatureSumModel()

    first_response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.50},
            model_loader=lambda path: model,
        )
    )
    Path(artifacts["model_path"]).write_bytes(b"changed model artifact")
    second_response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.50},
            model_loader=lambda path: model,
        )
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert model.predict_call_count == 2
    assert second_response.json()["model"]["hash"] != first_response.json()["model"][
        "hash"
    ]


def test_prediction_endpoint_reconstructs_rows_from_cached_original_order_probabilities(
    monkeypatch,
    tmp_path,
):
    artifacts = configure_prediction_artifacts(monkeypatch, tmp_path)
    model = FailingPredictionModel()
    seed_prediction_cache(
        app_data_dir=Path(artifacts["app_data_dir"]),
        target_uniprot_id="P01133",
        model_hash=artifacts["model_full_hash"],
        peptide_embeddings_hash=artifacts["peptide_full_hash"],
        protein_embeddings_hash=artifacts["protein_full_hash"],
        probabilities=(0.11, 0.88, 0.44),
    )

    response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.50},
            model_loader=lambda path: model,
        )
    )

    assert response.status_code == 200
    assert response.json()["predictions"] == [
        {
            "rank": 1,
            "peptide_id": "VP_HIGH",
            "sequence": "HHHH",
            "source_description": "High scoring venom peptide",
            "classifier_score": 0.88,
            "classification": "high confidence",
        },
        {
            "rank": 2,
            "peptide_id": "VP_MID",
            "sequence": "MMMM",
            "source_description": "Mid scoring venom peptide",
            "classifier_score": 0.44,
            "classification": "below threshold",
        },
        {
            "rank": 3,
            "peptide_id": "VP_LOW",
            "sequence": "LLLL",
            "source_description": "Low scoring venom peptide",
            "classifier_score": 0.11,
            "classification": "below threshold",
        },
    ]


def test_prediction_endpoint_ignores_cached_probabilities_with_wrong_row_count(
    monkeypatch,
    tmp_path,
):
    artifacts = configure_prediction_artifacts(monkeypatch, tmp_path)
    model = CountingFeatureSumModel()
    seed_prediction_cache(
        app_data_dir=Path(artifacts["app_data_dir"]),
        target_uniprot_id="P01133",
        model_hash=artifacts["model_full_hash"],
        peptide_embeddings_hash=artifacts["peptide_full_hash"],
        protein_embeddings_hash=artifacts["protein_full_hash"],
        probabilities=(0.99,),
    )

    response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.50},
            model_loader=lambda path: model,
        )
    )

    assert response.status_code == 200
    assert model.predict_call_count == 1
    assert [
        row["classifier_score"]
        for row in response.json()["predictions"]
    ] == [0.7, 0.5, 0.4]


def test_prediction_endpoint_rejects_thresholds_outside_v1_range(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(monkeypatch, tmp_path)

    for threshold in (0.49, 1.0):
        response = asyncio.run(
            post_prediction(
                {"target_uniprot_id": "P01133", "threshold": threshold},
                model_loader=lambda path: FeatureSumModel(),
            )
        )

        assert response.status_code == 400
        assert response.json() == {
            "state": "invalid-request",
            "error": {
                "code": "INVALID_THRESHOLD",
                "field": "threshold",
                "message": "Threshold must be between 0.50 and 0.99.",
            },
        }


def test_prediction_endpoint_returns_validation_state_for_incomplete_payload(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(
        post_prediction(
            {},
            model_loader=lambda path: FeatureSumModel(),
        )
    )

    assert response.status_code == 400
    assert response.json() == {
        "state": "invalid-request",
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Prediction request is invalid.",
            "details": [
                {
                    "code": "MISSING_FIELD",
                    "field": "target_uniprot_id",
                    "message": "target_uniprot_id is required.",
                },
                {
                    "code": "MISSING_FIELD",
                    "field": "threshold",
                    "message": "threshold is required.",
                },
            ],
        },
    }


def test_prediction_endpoint_returns_validation_state_for_malformed_json(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(
        post_prediction_content(
            "{",
            model_loader=lambda path: FeatureSumModel(),
        )
    )

    assert response.status_code == 400
    assert response.json() == {
        "state": "invalid-request",
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Prediction request is invalid.",
            "details": [
                {
                    "code": "MALFORMED_JSON",
                    "message": "Request body must be valid JSON.",
                },
            ],
        },
    }


def test_prediction_endpoint_rejects_malformed_and_unsupported_targets(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(monkeypatch, tmp_path)

    cases = [
        (
            "not-a-uniprot-id",
            400,
            {
                "state": "invalid-request",
                "normalized_target_uniprot_id": "NOT-A-UNIPROT-ID",
                "error": {
                    "code": "INVALID_ACCESSION",
                    "field": "target_uniprot_id",
                    "message": "Enter a valid UniProt accession.",
                },
            },
        ),
        (
            "Q9Y6K9",
            404,
            {
                "state": "unsupported-target",
                "normalized_target_uniprot_id": "Q9Y6K9",
                "error": {
                    "code": "UNSUPPORTED_TARGET",
                    "field": "target_uniprot_id",
                    "message": "Target is not available for V1 prediction.",
                },
            },
        ),
    ]

    for target_uniprot_id, expected_status, expected_payload in cases:
        response = asyncio.run(
            post_prediction(
                {"target_uniprot_id": target_uniprot_id, "threshold": 0.95},
                model_loader=lambda path: FeatureSumModel(),
            )
        )

        assert response.status_code == expected_status
        assert response.json() == expected_payload


def test_prediction_endpoint_returns_model_unavailable_state(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.95},
            model_loader=lambda path: IncompatibleModel(),
        )
    )

    assert response.status_code == 503
    assert response.json() == {
        "state": "model-unavailable",
        "error": {
            "code": "MODEL_UNAVAILABLE",
            "message": "Prediction model is unavailable.",
            "details": [
                {
                    "code": "MODEL_INPUT_WIDTH_MISMATCH",
                    "expected": 2048,
                    "actual": 1024,
                    "message": "Keras model input width must be 2048.",
                },
            ],
        },
    }


def test_prediction_endpoint_returns_embedding_unavailable_state(
    monkeypatch,
    tmp_path,
):
    artifacts = configure_prediction_artifacts(monkeypatch, tmp_path)
    Path(artifacts["peptide_path"]).write_text(
        "\n".join(
            [
                "pdb_chain,Seq,Description,features,pep_embed_0",
                "VP_LOW,LLLL,Low scoring venom peptide,venom,0.10",
            ]
        ),
        encoding="utf-8",
    )

    response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.95},
            model_loader=lambda path: FeatureSumModel(),
        )
    )

    assert response.status_code == 503
    assert response.json() == {
        "state": "artifacts-unavailable",
        "error": {
            "code": "EMBEDDINGS_UNAVAILABLE",
            "message": "Prediction embeddings are unavailable.",
            "details": [
                {
                    "code": "FEATURE_WIDTH_MISMATCH",
                    "artifact": "peptide_embeddings",
                    "expected": 1024,
                    "actual": 1,
                    "message": (
                        "Peptide embeddings must have exactly 1024 "
                        "pep_embed_ feature columns."
                    ),
                },
            ],
        },
    }


def test_prediction_endpoint_returns_prediction_failed_state(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.95},
            model_loader=lambda path: FailingPredictionModel(),
        )
    )

    assert response.status_code == 500
    assert response.json() == {
        "state": "prediction-failed",
        "error": {
            "code": "PREDICTION_FAILED",
            "message": "Prediction could not be completed.",
        },
    }


def test_prediction_endpoint_returns_prediction_failed_for_invalid_model_output(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.95},
            model_loader=lambda path: InvalidPredictionOutputModel(),
        )
    )

    assert response.status_code == 500
    assert response.json() == {
        "state": "prediction-failed",
        "error": {
            "code": "PREDICTION_FAILED",
            "message": "Prediction could not be completed.",
        },
    }


def test_prediction_endpoint_returns_missing_embedding_state(
    monkeypatch,
    tmp_path,
):
    configure_prediction_artifacts(
        monkeypatch,
        tmp_path,
        protein_rows=[("P00749", ["PROTEIN_B"], 0.05)],
    )

    def registry_with_missing_embedding(config, generated_at):
        return type(
            "Registry",
            (),
            {
                "targets": [
                    {
                        "uniprot_id": "P01133",
                        "gene": "EGFR",
                        "protein_name": "Epidermal growth factor receptor",
                    }
                ]
            },
        )()

    monkeypatch.setattr(
        "proventl_api.api.predictions.generate_configured_curated_target_registry",
        registry_with_missing_embedding,
    )

    response = asyncio.run(
        post_prediction(
            {"target_uniprot_id": "P01133", "threshold": 0.95},
            model_loader=lambda path: FeatureSumModel(),
        )
    )

    assert response.status_code == 500
    assert response.json() == {
        "state": "missing-target-embedding",
        "normalized_target_uniprot_id": "P01133",
        "error": {
            "code": "MISSING_TARGET_EMBEDDING",
            "field": "target_uniprot_id",
            "message": "Target is missing the embedding required for prediction.",
        },
    }


def test_prediction_endpoint_runs_real_curated_prediction_smoke_path(
    monkeypatch,
    tmp_path,
):
    pytest.importorskip("tensorflow")
    repo_root = Path(__file__).resolve().parents[3]
    app_data_dir = tmp_path / "data"
    app_data_dir.mkdir()

    monkeypatch.setenv(
        "PROVENTL_MODEL_PATH",
        str(repo_root / "model/best_model_auc_0.8748.h5"),
    )
    monkeypatch.setenv(
        "PROVENTL_PEPTIDE_EMBEDDINGS_PATH",
        str(repo_root / "model/data_testing/Pep_Ular_ProtT5.csv"),
    )
    monkeypatch.setenv(
        "PROVENTL_PROTEIN_EMBEDDINGS_PATH",
        str(repo_root / "model/data_testing/Prot_Cancer_ProtT5.csv"),
    )
    monkeypatch.setenv(
        "PROVENTL_TARGET_METADATA_PATH",
        str(repo_root / "model/data_testing/data_protein_kanker_uniprot.csv"),
    )
    monkeypatch.setenv("PROVENTL_APP_DATA_DIR", str(app_data_dir))

    response = asyncio.run(
        post_prediction({"target_uniprot_id": "P01133", "threshold": 0.95})
    )

    assert response.status_code == 200
    payload = response.json()
    predictions = payload["predictions"]
    scores = [row["classifier_score"] for row in predictions]

    assert payload["target"]["uniprot_id"] == "P01133"
    assert payload["threshold"] == 0.95
    assert payload["model"]["version"] == "best_model_auc_0.8748"
    assert len(payload["model"]["hash"]) == 8
    assert len(payload["data"]["peptide_embeddings_hash"]) == 8
    assert len(payload["data"]["protein_embeddings_hash"]) == 8
    assert len(predictions) == 145
    assert [row["rank"] for row in predictions] == list(range(1, 146))
    assert scores == sorted(scores, reverse=True)
    assert all(0.0 <= score <= 1.0 for score in scores)
    assert {
        row["classification"]
        for row in predictions
    } <= {"high confidence", "below threshold"}


class FeatureSumModel:
    input_shape = (None, 2048)
    output_shape = (None, 1)

    def predict(self, rows, verbose=0):
        return [[round(float(row[0]) + float(row[1024]), 6)] for row in rows]


class CountingFeatureSumModel(FeatureSumModel):
    def __init__(self):
        self.predict_call_count = 0

    def predict(self, rows, verbose=0):
        self.predict_call_count += 1
        return super().predict(rows, verbose=verbose)


class IncompatibleModel:
    input_shape = (None, 1024)
    output_shape = (None, 1)

    def predict(self, rows, verbose=0):
        return [[0.0] for row in rows]


class FailingPredictionModel:
    input_shape = (None, 2048)
    output_shape = (None, 1)

    def predict(self, rows, verbose=0):
        raise RuntimeError("backend inference failed")


class InvalidPredictionOutputModel:
    input_shape = (None, 2048)
    output_shape = (None, 1)

    def predict(self, rows, verbose=0):
        return [[0.0, 1.0] for row in rows]


def configure_prediction_artifacts(
    monkeypatch,
    tmp_path,
    *,
    protein_rows: list[tuple[str, list[str], float]] | None = None,
) -> dict[str, str]:
    model_path = tmp_path / "best_model_auc_0.8748.h5"
    peptide_embeddings_path = tmp_path / "Pep_Ular_ProtT5.csv"
    protein_embeddings_path = tmp_path / "Prot_Cancer_ProtT5.csv"
    target_metadata_path = tmp_path / "data_protein_kanker_uniprot.csv"
    app_data_dir = tmp_path / "data"

    model_path.write_bytes(b"model artifact")
    peptide_content = _embedding_csv(
        id_column="pdb_chain",
        metadata_columns=["Seq", "Description", "features"],
        feature_prefix="pep_embed_",
        rows=[
            ("VP_LOW", ["LLLL", "Low scoring venom peptide", "venom"], 0.10),
            ("VP_HIGH", ["HHHH", "High scoring venom peptide", "venom"], 0.40),
            ("VP_MID", ["MMMM", "Mid scoring venom peptide", "venom"], 0.20),
        ],
    )
    protein_content = _embedding_csv(
        id_column="Uniprot_id",
        metadata_columns=["prot_seq"],
        feature_prefix="prot_embed_",
        rows=protein_rows
        or [
            ("P01133", ["PROTEIN_A"], 0.30),
            ("P00749", ["PROTEIN_B"], 0.05),
        ],
    )
    target_metadata_content = "\n".join(
        [
            "Uniprot_id,gene,protein_name,organism,protein_families",
            (
                "P01133,EGFR,Epidermal growth factor receptor,"
                "Homo sapiens,Receptor tyrosine kinase"
            ),
            "P00749,PLAU,Urokinase-type plasminogen activator,Homo sapiens,Peptidase",
        ]
    )

    peptide_embeddings_path.write_text(peptide_content, encoding="utf-8")
    protein_embeddings_path.write_text(protein_content, encoding="utf-8")
    target_metadata_path.write_text(target_metadata_content, encoding="utf-8")
    app_data_dir.mkdir()

    monkeypatch.setenv("PROVENTL_MODEL_PATH", str(model_path))
    monkeypatch.setenv("PROVENTL_PEPTIDE_EMBEDDINGS_PATH", str(peptide_embeddings_path))
    monkeypatch.setenv("PROVENTL_PROTEIN_EMBEDDINGS_PATH", str(protein_embeddings_path))
    monkeypatch.setenv("PROVENTL_TARGET_METADATA_PATH", str(target_metadata_path))
    monkeypatch.setenv("PROVENTL_APP_DATA_DIR", str(app_data_dir))

    return {
        "model_full_hash": hashlib.sha256(b"model artifact").hexdigest(),
        "peptide_full_hash": hashlib.sha256(
            peptide_content.encode("utf-8")
        ).hexdigest(),
        "protein_full_hash": hashlib.sha256(
            protein_content.encode("utf-8")
        ).hexdigest(),
        "peptide_hash": hashlib.sha256(peptide_content.encode("utf-8")).hexdigest()[
            :8
        ],
        "protein_hash": hashlib.sha256(protein_content.encode("utf-8")).hexdigest()[
            :8
        ],
        "app_data_dir": str(app_data_dir),
        "model_path": str(model_path),
        "peptide_path": str(peptide_embeddings_path),
        "protein_path": str(protein_embeddings_path),
    }


def seed_prediction_cache(
    *,
    app_data_dir: Path,
    target_uniprot_id: str,
    model_hash: str,
    peptide_embeddings_hash: str,
    protein_embeddings_hash: str,
    probabilities: tuple[float, ...],
) -> None:
    cache = PredictionResultCache(cache_database_path(app_data_dir))
    cache.migrate()
    cache.upsert(
        target_uniprot_id=target_uniprot_id,
        model_hash=model_hash,
        peptide_embeddings_hash=peptide_embeddings_hash,
        protein_embeddings_hash=protein_embeddings_hash,
        probabilities=probabilities,
        created_at=datetime(2026, 5, 23, tzinfo=UTC),
    )


def _embedding_csv(
    *,
    id_column: str,
    metadata_columns: list[str],
    feature_prefix: str,
    rows: list[tuple[str, list[str], float]],
) -> str:
    feature_columns = [f"{feature_prefix}{index}" for index in range(1024)]
    lines = [",".join([id_column, *metadata_columns, *feature_columns])]
    for row_id, metadata, first_feature in rows:
        feature_values = [str(first_feature), *["0.0" for _ in range(1023)]]
        lines.append(",".join([row_id, *metadata, *feature_values]))
    return "\n".join(lines)
