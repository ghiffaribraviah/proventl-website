import asyncio
import hashlib
import json

import httpx

from proventl_api.app import create_app


async def get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.get(path)


def test_liveness_endpoint_reports_process_health_without_artifacts():
    response = asyncio.run(get("/api/health/live"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_public_api_documentation_routes_are_not_exposed():
    assert asyncio.run(get("/docs")).status_code == 404
    assert asyncio.run(get("/redoc")).status_code == 404
    assert asyncio.run(get("/openapi.json")).status_code == 404


def test_readiness_reports_not_ready_when_configuration_is_missing(monkeypatch):
    for name in (
        "PROVENTL_MODEL_PATH",
        "PROVENTL_PEPTIDE_EMBEDDINGS_PATH",
        "PROVENTL_PROTEIN_EMBEDDINGS_PATH",
        "PROVENTL_TARGET_METADATA_PATH",
        "PROVENTL_APP_DATA_DIR",
    ):
        monkeypatch.delenv(name, raising=False)

    response = asyncio.run(get("/api/health/ready"))

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "ready": False,
        "errors": [
            {
                "code": "CONFIGURATION_MISSING",
                "setting": "PROVENTL_MODEL_PATH",
                "message": "Required environment variable PROVENTL_MODEL_PATH is not set.",
            },
            {
                "code": "CONFIGURATION_MISSING",
                "setting": "PROVENTL_PEPTIDE_EMBEDDINGS_PATH",
                "message": (
                    "Required environment variable "
                    "PROVENTL_PEPTIDE_EMBEDDINGS_PATH is not set."
                ),
            },
            {
                "code": "CONFIGURATION_MISSING",
                "setting": "PROVENTL_PROTEIN_EMBEDDINGS_PATH",
                "message": (
                    "Required environment variable "
                    "PROVENTL_PROTEIN_EMBEDDINGS_PATH is not set."
                ),
            },
            {
                "code": "CONFIGURATION_MISSING",
                "setting": "PROVENTL_TARGET_METADATA_PATH",
                "message": (
                    "Required environment variable "
                    "PROVENTL_TARGET_METADATA_PATH is not set."
                ),
            },
            {
                "code": "CONFIGURATION_MISSING",
                "setting": "PROVENTL_APP_DATA_DIR",
                "message": "Required environment variable PROVENTL_APP_DATA_DIR is not set.",
            },
        ],
        "artifacts": [],
    }


def test_readiness_reports_ready_when_configured_artifacts_exist(
    monkeypatch,
    tmp_path,
):
    model_path = tmp_path / "best_model_auc_0.8748.h5"
    peptide_embeddings_path = tmp_path / "Pep_Ular_ProtT5.csv"
    protein_embeddings_path = tmp_path / "Prot_Cancer_ProtT5.csv"
    target_metadata_path = tmp_path / "data_protein_kanker_uniprot.csv"
    app_data_dir = tmp_path / "data"

    files = {
        "model": (model_path, b"model artifact"),
        "peptide_embeddings": (peptide_embeddings_path, b"peptide embeddings"),
        "protein_embeddings": (
            protein_embeddings_path,
            b"Uniprot_id,prot_seq,prot_embed_0\nP01133,SEQUENCE,0.1\n",
        ),
        "target_metadata": (
            target_metadata_path,
            (
                b"Uniprot_id,gene,protein_name,organism,protein_families\n"
                b"P01133,EGFR,Epidermal growth factor receptor,"
                b"Homo sapiens,Receptor tyrosine kinase\n"
            ),
        ),
    }
    for path, content in files.values():
        path.write_bytes(content)
    app_data_dir.mkdir()

    monkeypatch.setenv("PROVENTL_MODEL_PATH", str(model_path))
    monkeypatch.setenv("PROVENTL_PEPTIDE_EMBEDDINGS_PATH", str(peptide_embeddings_path))
    monkeypatch.setenv("PROVENTL_PROTEIN_EMBEDDINGS_PATH", str(protein_embeddings_path))
    monkeypatch.setenv("PROVENTL_TARGET_METADATA_PATH", str(target_metadata_path))
    monkeypatch.setenv("PROVENTL_APP_DATA_DIR", str(app_data_dir))

    response = asyncio.run(get("/api/health/ready"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["ready"] is True
    assert payload["errors"] == []
    assert payload["artifacts"] == [
        {
            "name": name,
            "hash": hashlib.sha256(content).hexdigest()[:8],
        }
        for name, (_, content) in files.items()
    ]
    assert payload["data_directory"] == {
        "name": "app_data",
        "present": True,
    }
    assert payload["registry"]["target_count"] == 1


def test_readiness_reports_registry_metadata_without_full_hashes(
    monkeypatch,
    tmp_path,
):
    model_path = tmp_path / "best_model_auc_0.8748.h5"
    peptide_embeddings_path = tmp_path / "Pep_Ular_ProtT5.csv"
    protein_embeddings_path = tmp_path / "Prot_Cancer_ProtT5.csv"
    target_metadata_path = tmp_path / "data_protein_kanker_uniprot.csv"
    app_data_dir = tmp_path / "data"

    model_path.write_bytes(b"model artifact")
    peptide_embeddings_path.write_text(
        "Peptide_id,pep_seq,pep_embed_0\nVP001,AAAA,0.1\n",
        encoding="utf-8",
    )
    protein_embeddings_path.write_text(
        "\n".join(
            [
                "Uniprot_id,prot_seq,prot_embed_0",
                "P01133,SEQUENCE,0.1",
                "P00749,SEQUENCE,0.2",
            ]
        ),
        encoding="utf-8",
    )
    target_metadata_path.write_text(
        "\n".join(
            [
                "Uniprot_id,gene,protein_name,organism,protein_families",
                (
                    "P01133,EGFR,Epidermal growth factor receptor,"
                    "Homo sapiens,Receptor tyrosine kinase"
                ),
            ]
        ),
        encoding="utf-8",
    )
    app_data_dir.mkdir()

    monkeypatch.setenv("PROVENTL_MODEL_PATH", str(model_path))
    monkeypatch.setenv("PROVENTL_PEPTIDE_EMBEDDINGS_PATH", str(peptide_embeddings_path))
    monkeypatch.setenv("PROVENTL_PROTEIN_EMBEDDINGS_PATH", str(protein_embeddings_path))
    monkeypatch.setenv("PROVENTL_TARGET_METADATA_PATH", str(target_metadata_path))
    monkeypatch.setenv("PROVENTL_APP_DATA_DIR", str(app_data_dir))

    response = asyncio.run(get("/api/health/ready"))

    registry_targets = [
        {
            "gene": "EGFR",
            "organism": "Homo sapiens",
            "protein_families": "Receptor tyrosine kinase",
            "protein_name": "Epidermal growth factor receptor",
            "uniprot_id": "P01133",
        },
        {"uniprot_id": "P00749"},
    ]
    expected_hash = hashlib.sha256(
        json.dumps(registry_targets, sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
    ).hexdigest()[:8]

    assert response.status_code == 200
    registry = response.json()["registry"]
    assert registry["target_count"] == 2
    assert registry["hash"] == expected_hash
    assert len(registry["hash"]) == 8
    assert registry["provenance"]["counts"] == {
        "protein_embedding_rows": 2,
        "curated_targets": 2,
        "metadata_rows": 1,
        "metadata_only_rows": 0,
    }
    assert all(
        len(source["sha256"]) == 8 for source in registry["provenance"]["sources"]
    )


def test_readiness_reports_not_ready_when_configured_artifacts_are_missing(
    monkeypatch,
    tmp_path,
):
    app_data_dir = tmp_path / "data"
    app_data_dir.mkdir()

    monkeypatch.setenv("PROVENTL_MODEL_PATH", str(tmp_path / "missing-model.h5"))
    monkeypatch.setenv(
        "PROVENTL_PEPTIDE_EMBEDDINGS_PATH",
        str(tmp_path / "missing-peptides.csv"),
    )
    monkeypatch.setenv(
        "PROVENTL_PROTEIN_EMBEDDINGS_PATH",
        str(tmp_path / "missing-proteins.csv"),
    )
    monkeypatch.setenv(
        "PROVENTL_TARGET_METADATA_PATH",
        str(tmp_path / "missing-target-metadata.csv"),
    )
    monkeypatch.setenv("PROVENTL_APP_DATA_DIR", str(app_data_dir))

    response = asyncio.run(get("/api/health/ready"))

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "ready": False,
        "errors": [
            {
                "code": "ARTIFACT_PATH_MISSING",
                "setting": "PROVENTL_MODEL_PATH",
                "message": (
                    "Configured artifact path for PROVENTL_MODEL_PATH does not exist."
                ),
            },
            {
                "code": "ARTIFACT_PATH_MISSING",
                "setting": "PROVENTL_PEPTIDE_EMBEDDINGS_PATH",
                "message": (
                    "Configured artifact path for "
                    "PROVENTL_PEPTIDE_EMBEDDINGS_PATH does not exist."
                ),
            },
            {
                "code": "ARTIFACT_PATH_MISSING",
                "setting": "PROVENTL_PROTEIN_EMBEDDINGS_PATH",
                "message": (
                    "Configured artifact path for "
                    "PROVENTL_PROTEIN_EMBEDDINGS_PATH does not exist."
                ),
            },
            {
                "code": "ARTIFACT_PATH_MISSING",
                "setting": "PROVENTL_TARGET_METADATA_PATH",
                "message": (
                    "Configured artifact path for "
                    "PROVENTL_TARGET_METADATA_PATH does not exist."
                ),
            },
        ],
        "artifacts": [],
    }
