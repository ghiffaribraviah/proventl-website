import hashlib
from datetime import UTC, datetime

import pytest

from proventl_api.targets.registry_cli import validate_configured_registry
from proventl_api.targets.registry import (
    TargetRegistryValidationError,
    generate_curated_target_registry,
    validate_curated_target_registry,
)


def test_registry_generation_uses_embedding_ids_as_curated_targets(
    tmp_path,
):
    protein_embeddings_path = tmp_path / "protein_embeddings.csv"
    protein_embeddings_path.write_text(
        "\n".join(
            [
                "Uniprot_id,prot_seq,prot_embed_0",
                "p01133,SEQUENCE,0.1",
                "P00749,SEQUENCE,0.2",
            ]
        ),
        encoding="utf-8",
    )
    target_metadata_path = tmp_path / "target_metadata.csv"
    target_metadata_path.write_text(
        "\n".join(
            [
                "Uniprot_id,prot_seq,protein_families",
                "P01133,SEQUENCE,Receptor tyrosine kinase",
                "Q99999,SEQUENCE,Metadata-only family",
            ]
        ),
        encoding="utf-8",
    )

    registry = generate_curated_target_registry(
        protein_embeddings_path=protein_embeddings_path,
        target_metadata_path=target_metadata_path,
        generated_at=datetime(2026, 5, 23, 12, 0, tzinfo=UTC),
    )

    assert [target["uniprot_id"] for target in registry.targets] == [
        "P01133",
        "P00749",
    ]
    assert registry.targets[0]["protein_families"] == "Receptor tyrosine kinase"
    assert "protein_families" not in registry.targets[1]


def test_registry_generation_reports_reproducible_provenance(tmp_path):
    protein_embeddings_path = tmp_path / "protein_embeddings.csv"
    protein_embeddings_content = "\n".join(
        [
            "Uniprot_id,prot_seq,prot_embed_0",
            "P01133,SEQUENCE,0.1",
            "P00749,SEQUENCE,0.2",
        ]
    )
    protein_embeddings_path.write_text(protein_embeddings_content, encoding="utf-8")
    target_metadata_path = tmp_path / "target_metadata.csv"
    target_metadata_content = "\n".join(
        [
            "Uniprot_id,prot_seq,protein_families",
            "P01133,SEQUENCE,Receptor tyrosine kinase",
            "Q99999,SEQUENCE,Metadata-only family",
        ]
    )
    target_metadata_path.write_text(target_metadata_content, encoding="utf-8")

    registry = generate_curated_target_registry(
        protein_embeddings_path=protein_embeddings_path,
        target_metadata_path=target_metadata_path,
        generated_at=datetime(2026, 5, 23, 12, 0, tzinfo=UTC),
    )

    assert registry.provenance == {
        "generated_at": "2026-05-23T12:00:00+00:00",
        "sources": [
            {
                "name": "protein_embeddings",
                "path": "protein_embeddings.csv",
                "sha256": hashlib.sha256(
                    protein_embeddings_content.encode("utf-8")
                ).hexdigest(),
            },
            {
                "name": "target_metadata",
                "path": "target_metadata.csv",
                "sha256": hashlib.sha256(
                    target_metadata_content.encode("utf-8")
                ).hexdigest(),
            },
        ],
        "counts": {
            "protein_embedding_rows": 2,
            "curated_targets": 2,
            "metadata_rows": 2,
            "metadata_only_rows": 1,
        },
    }


def test_configured_registry_validation_cli_reports_local_metadata(
    monkeypatch,
    tmp_path,
):
    model_path = tmp_path / "model.h5"
    peptide_embeddings_path = tmp_path / "peptides.csv"
    protein_embeddings_path = tmp_path / "proteins.csv"
    target_metadata_path = tmp_path / "target_metadata.csv"
    app_data_dir = tmp_path / "data"

    model_path.write_bytes(b"model artifact")
    peptide_embeddings_path.write_text("Peptide_id,pep_seq,pep_embed_0\nVP001,AAAA,0.1\n")
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

    result = validate_configured_registry(local_only=True)

    assert result["status"] == "ok"
    assert result["mode"] == "local-only"
    assert result["registry"]["target_count"] == 2
    assert result["registry"]["provenance"]["counts"] == {
        "protein_embedding_rows": 2,
        "curated_targets": 2,
        "metadata_rows": 1,
        "metadata_only_rows": 0,
    }


def test_registry_generation_reports_missing_optional_metadata_without_failing(
    tmp_path,
):
    protein_embeddings_path = tmp_path / "protein_embeddings.csv"
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
    target_metadata_path = tmp_path / "target_metadata.csv"
    target_metadata_path.write_text(
        "\n".join(
            [
                "Uniprot_id,prot_seq,protein_families",
                "P01133,SEQUENCE,",
            ]
        ),
        encoding="utf-8",
    )

    registry = generate_curated_target_registry(
        protein_embeddings_path=protein_embeddings_path,
        target_metadata_path=target_metadata_path,
        generated_at=datetime(2026, 5, 23, 12, 0, tzinfo=UTC),
    )

    assert [target["uniprot_id"] for target in registry.targets] == [
        "P01133",
        "P00749",
    ]
    assert registry.warnings == [
        {
            "code": "MISSING_OPTIONAL_METADATA",
            "target_id": "P01133",
            "field": "protein_families",
            "message": "Optional metadata field protein_families is missing for P01133.",
        },
        {
            "code": "MISSING_OPTIONAL_METADATA",
            "target_id": "P00749",
            "field": "protein_families",
            "message": "Optional metadata field protein_families is missing for P00749.",
        },
    ]


def test_registry_generation_rejects_duplicate_embedding_target_ids(tmp_path):
    protein_embeddings_path = tmp_path / "protein_embeddings.csv"
    protein_embeddings_path.write_text(
        "\n".join(
            [
                "Uniprot_id,prot_seq,prot_embed_0",
                "P01133,SEQUENCE,0.1",
                "p01133,SEQUENCE,0.2",
            ]
        ),
        encoding="utf-8",
    )
    target_metadata_path = tmp_path / "target_metadata.csv"
    target_metadata_path.write_text(
        "\n".join(
            [
                "Uniprot_id,prot_seq,protein_families",
                "P01133,SEQUENCE,Receptor tyrosine kinase",
            ]
        ),
        encoding="utf-8",
    )

    with pytest.raises(TargetRegistryValidationError) as error:
        generate_curated_target_registry(
            protein_embeddings_path=protein_embeddings_path,
            target_metadata_path=target_metadata_path,
            generated_at=datetime(2026, 5, 23, 12, 0, tzinfo=UTC),
        )

    assert error.value.issues == [
        {
            "code": "DUPLICATE_TARGET_ID",
            "target_id": "P01133",
            "message": "Target ID P01133 appears more than once.",
        }
    ]


def test_registry_validation_rejects_target_id_set_mismatches():
    with pytest.raises(TargetRegistryValidationError) as error:
        validate_curated_target_registry(
            targets=[
                {"uniprot_id": "P01133"},
                {"uniprot_id": "Q99999"},
            ],
            protein_embedding_ids=["P01133", "P00749"],
        )

    assert error.value.issues == [
        {
            "code": "MISSING_EMBEDDING_BACKED_TARGET",
            "target_id": "P00749",
            "message": "Embedding-backed target ID P00749 is missing from the registry.",
        },
        {
            "code": "EXTRA_REGISTRY_TARGET",
            "target_id": "Q99999",
            "message": "Registry target ID Q99999 is not backed by a protein embedding.",
        },
    ]


def test_registry_validation_rejects_malformed_target_records():
    with pytest.raises(TargetRegistryValidationError) as error:
        validate_curated_target_registry(
            targets=[
                {"uniprot_id": "P01133"},
                {"protein_families": "Missing accession"},
            ],
            protein_embedding_ids=["P01133"],
        )

    assert error.value.issues == [
        {
            "code": "MALFORMED_TARGET_RECORD",
            "message": "Registry target at index 1 is missing uniprot_id.",
        }
    ]


def test_registry_validation_rejects_duplicate_registry_target_ids():
    with pytest.raises(TargetRegistryValidationError) as error:
        validate_curated_target_registry(
            targets=[
                {"uniprot_id": "P01133"},
                {"uniprot_id": "p01133"},
            ],
            protein_embedding_ids=["P01133"],
        )

    assert error.value.issues == [
        {
            "code": "DUPLICATE_TARGET_ID",
            "target_id": "P01133",
            "message": "Target ID P01133 appears more than once.",
        }
    ]
