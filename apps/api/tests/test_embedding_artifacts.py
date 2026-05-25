import hashlib
from pathlib import Path

import pytest

from proventl_api.core.config import ArtifactConfig
from proventl_api.embeddings import EmbeddingValidationError, load_embedding_artifacts


def test_valid_embedding_artifacts_load_with_ordered_peptides_and_protein_lookup(
    tmp_path,
):
    peptide_content = _embedding_csv(
        id_column="pdb_chain",
        metadata_columns=["Seq", "Description", "features"],
        feature_prefix="pep_embed_",
        rows=[
            ("VP002", ["CCCC", "Second peptide", "venom"], 2000),
            ("VP001", ["AAAA", "First peptide", "venom"], 1000),
        ],
    )
    protein_content = _embedding_csv(
        id_column="Uniprot_id",
        metadata_columns=["prot_seq"],
        feature_prefix="prot_embed_",
        rows=[
            ("p01133", ["PROTEIN_A"], 3000),
            ("P00749", ["PROTEIN_B"], 4000),
        ],
    )
    peptide_path = tmp_path / "peptides.csv"
    protein_path = tmp_path / "proteins.csv"
    peptide_path.write_text(peptide_content, encoding="utf-8")
    protein_path.write_text(protein_content, encoding="utf-8")

    embeddings = load_embedding_artifacts(
        peptide_artifact=_artifact("peptide_embeddings", peptide_path, peptide_content),
        protein_artifact=_artifact("protein_embeddings", protein_path, protein_content),
    )

    assert [peptide.peptide_id for peptide in embeddings.peptides.metadata] == [
        "VP002",
        "VP001",
    ]
    assert embeddings.peptides.features[0][0:3] == (2000.0, 2001.0, 2002.0)
    assert len(embeddings.peptides.features[0]) == 1024
    assert len(embeddings.proteins.features_by_id["P01133"]) == 1024
    assert embeddings.proteins.lookup(" p01133 ").features[0:3] == (
        3000.0,
        3001.0,
        3002.0,
    )
    assert embeddings.peptide_artifact.full_hash == hashlib.sha256(
        peptide_content.encode("utf-8")
    ).hexdigest()
    assert embeddings.protein_artifact.short_hash == hashlib.sha256(
        protein_content.encode("utf-8")
    ).hexdigest()[:8]


def test_peptide_embeddings_with_wrong_feature_width_fail_validation(tmp_path):
    peptide_content = _embedding_csv(
        id_column="pdb_chain",
        metadata_columns=["Seq", "Description", "features"],
        feature_prefix="pep_embed_",
        feature_count=1023,
        rows=[("VP001", ["AAAA", "First peptide", "venom"], 1000)],
    )
    protein_content = _embedding_csv(
        id_column="Uniprot_id",
        metadata_columns=["prot_seq"],
        feature_prefix="prot_embed_",
        rows=[("P01133", ["PROTEIN_A"], 3000)],
    )
    peptide_path = tmp_path / "peptides.csv"
    protein_path = tmp_path / "proteins.csv"
    peptide_path.write_text(peptide_content, encoding="utf-8")
    protein_path.write_text(protein_content, encoding="utf-8")

    with pytest.raises(EmbeddingValidationError) as error:
        load_embedding_artifacts(
            peptide_artifact=_artifact(
                "peptide_embeddings",
                peptide_path,
                peptide_content,
            ),
            protein_artifact=_artifact(
                "protein_embeddings",
                protein_path,
                protein_content,
            ),
        )

    assert error.value.issues == [
        {
            "code": "FEATURE_WIDTH_MISMATCH",
            "artifact": "peptide_embeddings",
            "expected": 1024,
            "actual": 1023,
            "message": (
                "Peptide embeddings must have exactly 1024 pep_embed_ "
                "feature columns."
            ),
        }
    ]


def test_protein_embeddings_with_wrong_feature_width_fail_validation(tmp_path):
    peptide_content = _embedding_csv(
        id_column="pdb_chain",
        metadata_columns=["Seq", "Description", "features"],
        feature_prefix="pep_embed_",
        rows=[("VP001", ["AAAA", "First peptide", "venom"], 1000)],
    )
    protein_content = _embedding_csv(
        id_column="Uniprot_id",
        metadata_columns=["prot_seq"],
        feature_prefix="prot_embed_",
        feature_count=1023,
        rows=[("P01133", ["PROTEIN_A"], 3000)],
    )
    peptide_path = tmp_path / "peptides.csv"
    protein_path = tmp_path / "proteins.csv"
    peptide_path.write_text(peptide_content, encoding="utf-8")
    protein_path.write_text(protein_content, encoding="utf-8")

    with pytest.raises(EmbeddingValidationError) as error:
        load_embedding_artifacts(
            peptide_artifact=_artifact(
                "peptide_embeddings",
                peptide_path,
                peptide_content,
            ),
            protein_artifact=_artifact(
                "protein_embeddings",
                protein_path,
                protein_content,
            ),
        )

    assert error.value.issues == [
        {
            "code": "FEATURE_WIDTH_MISMATCH",
            "artifact": "protein_embeddings",
            "expected": 1024,
            "actual": 1023,
            "message": (
                "Protein embeddings must have exactly 1024 prot_embed_ "
                "feature columns."
            ),
        }
    ]


def test_peptide_embeddings_with_missing_ids_fail_validation(tmp_path):
    peptide_content = _embedding_csv(
        id_column="pdb_chain",
        metadata_columns=["Seq", "Description", "features"],
        feature_prefix="pep_embed_",
        rows=[("", ["AAAA", "First peptide", "venom"], 1000)],
    )
    protein_content = _embedding_csv(
        id_column="Uniprot_id",
        metadata_columns=["prot_seq"],
        feature_prefix="prot_embed_",
        rows=[("P01133", ["PROTEIN_A"], 3000)],
    )
    peptide_path = tmp_path / "peptides.csv"
    protein_path = tmp_path / "proteins.csv"
    peptide_path.write_text(peptide_content, encoding="utf-8")
    protein_path.write_text(protein_content, encoding="utf-8")

    with pytest.raises(EmbeddingValidationError) as error:
        load_embedding_artifacts(
            peptide_artifact=_artifact(
                "peptide_embeddings",
                peptide_path,
                peptide_content,
            ),
            protein_artifact=_artifact(
                "protein_embeddings",
                protein_path,
                protein_content,
            ),
        )

    assert error.value.issues == [
        {
            "code": "MISSING_PEPTIDE_ID",
            "artifact": "peptide_embeddings",
            "row_index": 0,
            "message": "Peptide embedding row 0 is missing pdb_chain.",
        }
    ]


def test_protein_embeddings_with_missing_uniprot_ids_fail_validation(tmp_path):
    peptide_content = _embedding_csv(
        id_column="pdb_chain",
        metadata_columns=["Seq", "Description", "features"],
        feature_prefix="pep_embed_",
        rows=[("VP001", ["AAAA", "First peptide", "venom"], 1000)],
    )
    protein_content = _embedding_csv(
        id_column="Uniprot_id",
        metadata_columns=["prot_seq"],
        feature_prefix="prot_embed_",
        rows=[("", ["PROTEIN_A"], 3000)],
    )
    peptide_path = tmp_path / "peptides.csv"
    protein_path = tmp_path / "proteins.csv"
    peptide_path.write_text(peptide_content, encoding="utf-8")
    protein_path.write_text(protein_content, encoding="utf-8")

    with pytest.raises(EmbeddingValidationError) as error:
        load_embedding_artifacts(
            peptide_artifact=_artifact(
                "peptide_embeddings",
                peptide_path,
                peptide_content,
            ),
            protein_artifact=_artifact(
                "protein_embeddings",
                protein_path,
                protein_content,
            ),
        )

    assert error.value.issues == [
        {
            "code": "MISSING_PROTEIN_UNIPROT_ID",
            "artifact": "protein_embeddings",
            "row_index": 0,
            "message": "Protein embedding row 0 is missing Uniprot_id.",
        }
    ]


def test_duplicate_normalized_protein_uniprot_ids_fail_validation(tmp_path):
    peptide_content = _embedding_csv(
        id_column="pdb_chain",
        metadata_columns=["Seq", "Description", "features"],
        feature_prefix="pep_embed_",
        rows=[("VP001", ["AAAA", "First peptide", "venom"], 1000)],
    )
    protein_content = _embedding_csv(
        id_column="Uniprot_id",
        metadata_columns=["prot_seq"],
        feature_prefix="prot_embed_",
        rows=[
            ("P01133", ["PROTEIN_A"], 3000),
            (" p01133 ", ["PROTEIN_A_DUPLICATE"], 4000),
        ],
    )
    peptide_path = tmp_path / "peptides.csv"
    protein_path = tmp_path / "proteins.csv"
    peptide_path.write_text(peptide_content, encoding="utf-8")
    protein_path.write_text(protein_content, encoding="utf-8")

    with pytest.raises(EmbeddingValidationError) as error:
        load_embedding_artifacts(
            peptide_artifact=_artifact(
                "peptide_embeddings",
                peptide_path,
                peptide_content,
            ),
            protein_artifact=_artifact(
                "protein_embeddings",
                protein_path,
                protein_content,
            ),
        )

    assert error.value.issues == [
        {
            "code": "DUPLICATE_PROTEIN_UNIPROT_ID",
            "artifact": "protein_embeddings",
            "uniprot_id": "P01133",
            "message": "Protein UniProt ID P01133 appears more than once.",
        }
    ]


def test_non_numeric_peptide_feature_values_fail_validation(tmp_path):
    peptide_content = _embedding_csv(
        id_column="pdb_chain",
        metadata_columns=["Seq", "Description", "features"],
        feature_prefix="pep_embed_",
        rows=[("VP001", ["AAAA", "First peptide", "venom"], 1000)],
    ).replace(",1002,", ",not-a-number,", 1)
    protein_content = _embedding_csv(
        id_column="Uniprot_id",
        metadata_columns=["prot_seq"],
        feature_prefix="prot_embed_",
        rows=[("P01133", ["PROTEIN_A"], 3000)],
    )
    peptide_path = tmp_path / "peptides.csv"
    protein_path = tmp_path / "proteins.csv"
    peptide_path.write_text(peptide_content, encoding="utf-8")
    protein_path.write_text(protein_content, encoding="utf-8")

    with pytest.raises(EmbeddingValidationError) as error:
        load_embedding_artifacts(
            peptide_artifact=_artifact(
                "peptide_embeddings",
                peptide_path,
                peptide_content,
            ),
            protein_artifact=_artifact(
                "protein_embeddings",
                protein_path,
                protein_content,
            ),
        )

    assert error.value.issues == [
        {
            "code": "NON_NUMERIC_FEATURE_VALUE",
            "artifact": "peptide_embeddings",
            "row_index": 0,
            "column": "pep_embed_2",
            "message": (
                "Peptide embedding row 0 has a non-numeric value in pep_embed_2."
            ),
        }
    ]


def test_committed_embedding_artifacts_satisfy_v1_contract():
    repo_root = Path(__file__).resolve().parents[3]
    peptide_path = repo_root / "model/data_testing/Pep_Ular_ProtT5.csv"
    protein_path = repo_root / "model/data_testing/Prot_Cancer_ProtT5.csv"

    embeddings = load_embedding_artifacts(
        peptide_artifact=_artifact_from_path("peptide_embeddings", peptide_path),
        protein_artifact=_artifact_from_path("protein_embeddings", protein_path),
    )

    assert len(embeddings.peptides.metadata) == 145
    assert len(embeddings.peptides.features) == 145
    assert all(len(features) == 1024 for features in embeddings.peptides.features)
    assert len(embeddings.proteins.metadata_by_id) == 895
    assert all(
        len(features) == 1024
        for features in embeddings.proteins.features_by_id.values()
    )
    assert embeddings.proteins.lookup("p01133").metadata.uniprot_id == "P01133"


def _embedding_csv(
    *,
    id_column: str,
    metadata_columns: list[str],
    feature_prefix: str,
    feature_count: int = 1024,
    rows: list[tuple[str, list[str], int]],
) -> str:
    header = [id_column, *metadata_columns] + [
        f"{feature_prefix}{index}" for index in range(feature_count)
    ]
    lines = [",".join(header)]
    for row_id, metadata, start in rows:
        feature_values = [str(start + index) for index in range(feature_count)]
        lines.append(",".join([row_id, *metadata, *feature_values]))
    return "\n".join(lines)


def _artifact(name, path, content) -> ArtifactConfig:
    return ArtifactConfig(
        name=name,
        path=path,
        full_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
    )


def _artifact_from_path(name, path) -> ArtifactConfig:
    return ArtifactConfig(
        name=name,
        path=path,
        full_hash=hashlib.sha256(path.read_bytes()).hexdigest(),
    )
