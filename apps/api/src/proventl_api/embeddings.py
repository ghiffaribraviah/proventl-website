import csv
from dataclasses import dataclass

from proventl_api.core.config import ArtifactConfig

PEPTIDE_ID_COLUMN = "pdb_chain"
PROTEIN_ID_COLUMN = "Uniprot_id"
PEPTIDE_FEATURE_PREFIX = "pep_embed_"
PROTEIN_FEATURE_PREFIX = "prot_embed_"
EMBEDDING_FEATURE_WIDTH = 1024


@dataclass(frozen=True)
class PeptideMetadata:
    peptide_id: str
    sequence: str
    description: str
    features_label: str


@dataclass(frozen=True)
class ProteinMetadata:
    uniprot_id: str
    sequence: str


@dataclass(frozen=True)
class ProteinEmbedding:
    metadata: ProteinMetadata
    features: tuple[float, ...]


class EmbeddingValidationError(Exception):
    def __init__(self, issues: list[dict[str, object]]) -> None:
        super().__init__("Embedding artifact validation failed.")
        self.issues = issues


@dataclass(frozen=True)
class PeptideEmbeddings:
    metadata: tuple[PeptideMetadata, ...]
    features: tuple[tuple[float, ...], ...]


@dataclass(frozen=True)
class ProteinEmbeddings:
    metadata_by_id: dict[str, ProteinMetadata]
    features_by_id: dict[str, tuple[float, ...]]

    def lookup(self, uniprot_id: str) -> ProteinEmbedding:
        normalized_id = _normalize_uniprot_id(uniprot_id)
        return ProteinEmbedding(
            metadata=self.metadata_by_id[normalized_id],
            features=self.features_by_id[normalized_id],
        )


@dataclass(frozen=True)
class EmbeddingArtifacts:
    peptides: PeptideEmbeddings
    proteins: ProteinEmbeddings
    peptide_artifact: ArtifactConfig
    protein_artifact: ArtifactConfig


def load_embedding_artifacts(
    *,
    peptide_artifact: ArtifactConfig,
    protein_artifact: ArtifactConfig,
) -> EmbeddingArtifacts:
    peptide_rows = _read_csv_rows(peptide_artifact)
    protein_rows = _read_csv_rows(protein_artifact)

    peptide_feature_columns = _feature_columns(
        peptide_rows,
        prefix=PEPTIDE_FEATURE_PREFIX,
    )
    protein_feature_columns = _feature_columns(
        protein_rows,
        prefix=PROTEIN_FEATURE_PREFIX,
    )
    _validate_feature_width(
        artifact="peptide_embeddings",
        label="Peptide embeddings",
        prefix=PEPTIDE_FEATURE_PREFIX,
        columns=peptide_feature_columns,
    )
    _validate_feature_width(
        artifact="protein_embeddings",
        label="Protein embeddings",
        prefix=PROTEIN_FEATURE_PREFIX,
        columns=protein_feature_columns,
    )
    _validate_peptide_ids(peptide_rows)
    _validate_protein_ids(protein_rows)

    return EmbeddingArtifacts(
        peptides=PeptideEmbeddings(
            metadata=tuple(
                PeptideMetadata(
                    peptide_id=row[PEPTIDE_ID_COLUMN].strip(),
                    sequence=row.get("Seq", ""),
                    description=row.get("Description", ""),
                    features_label=row.get("features", ""),
                )
                for row in peptide_rows
            ),
            features=tuple(
                _parse_feature_row(
                    row,
                    peptide_feature_columns,
                    artifact="peptide_embeddings",
                    label="Peptide embedding",
                    row_index=index,
                )
                for index, row in enumerate(peptide_rows)
            ),
        ),
        proteins=_load_protein_embeddings(protein_rows, protein_feature_columns),
        peptide_artifact=peptide_artifact,
        protein_artifact=protein_artifact,
    )


def _read_csv_rows(artifact: ArtifactConfig) -> list[dict[str, str]]:
    with artifact.path.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def _feature_columns(rows: list[dict[str, str]], *, prefix: str) -> list[str]:
    if not rows:
        return []
    return [column for column in rows[0] if column.startswith(prefix)]


def _validate_feature_width(
    *,
    artifact: str,
    label: str,
    prefix: str,
    columns: list[str],
) -> None:
    if len(columns) == EMBEDDING_FEATURE_WIDTH:
        return

    raise EmbeddingValidationError(
        [
            {
                "code": "FEATURE_WIDTH_MISMATCH",
                "artifact": artifact,
                "expected": EMBEDDING_FEATURE_WIDTH,
                "actual": len(columns),
                "message": (
                    f"{label} must have exactly {EMBEDDING_FEATURE_WIDTH} "
                    f"{prefix} feature columns."
                ),
            }
        ]
    )


def _validate_peptide_ids(rows: list[dict[str, str]]) -> None:
    issues = [
        {
            "code": "MISSING_PEPTIDE_ID",
            "artifact": "peptide_embeddings",
            "row_index": index,
            "message": f"Peptide embedding row {index} is missing {PEPTIDE_ID_COLUMN}.",
        }
        for index, row in enumerate(rows)
        if not row.get(PEPTIDE_ID_COLUMN, "").strip()
    ]
    if issues:
        raise EmbeddingValidationError(issues)


def _validate_protein_ids(rows: list[dict[str, str]]) -> None:
    issues = []
    seen_ids = set()
    duplicate_ids = []
    for index, row in enumerate(rows):
        raw_id = row.get(PROTEIN_ID_COLUMN, "")
        if not raw_id.strip():
            issues.append(
                {
                    "code": "MISSING_PROTEIN_UNIPROT_ID",
                    "artifact": "protein_embeddings",
                    "row_index": index,
                    "message": (
                        f"Protein embedding row {index} is missing "
                        f"{PROTEIN_ID_COLUMN}."
                    ),
                }
            )
            continue

        uniprot_id = _normalize_uniprot_id(raw_id)
        if uniprot_id in seen_ids and uniprot_id not in duplicate_ids:
            duplicate_ids.append(uniprot_id)
        seen_ids.add(uniprot_id)

    issues.extend(
        {
            "code": "DUPLICATE_PROTEIN_UNIPROT_ID",
            "artifact": "protein_embeddings",
            "uniprot_id": uniprot_id,
            "message": f"Protein UniProt ID {uniprot_id} appears more than once.",
        }
        for uniprot_id in duplicate_ids
    )
    if issues:
        raise EmbeddingValidationError(issues)


def _parse_feature_row(
    row: dict[str, str],
    feature_columns: list[str],
    *,
    artifact: str,
    label: str,
    row_index: int,
) -> tuple[float, ...]:
    values = []
    for column in feature_columns:
        try:
            values.append(float(row[column]))
        except (TypeError, ValueError) as error:
            raise EmbeddingValidationError(
                [
                    {
                        "code": "NON_NUMERIC_FEATURE_VALUE",
                        "artifact": artifact,
                        "row_index": row_index,
                        "column": column,
                        "message": (
                            f"{label} row {row_index} has a non-numeric value "
                            f"in {column}."
                        ),
                    }
                ]
            ) from error
    return tuple(values)


def _load_protein_embeddings(
    rows: list[dict[str, str]],
    feature_columns: list[str],
) -> ProteinEmbeddings:
    metadata_by_id = {}
    features_by_id = {}
    for index, row in enumerate(rows):
        uniprot_id = _normalize_uniprot_id(row[PROTEIN_ID_COLUMN])
        metadata_by_id[uniprot_id] = ProteinMetadata(
            uniprot_id=uniprot_id,
            sequence=row.get("prot_seq", ""),
        )
        features_by_id[uniprot_id] = _parse_feature_row(
            row,
            feature_columns,
            artifact="protein_embeddings",
            label="Protein embedding",
            row_index=index,
        )

    return ProteinEmbeddings(
        metadata_by_id=metadata_by_id,
        features_by_id=features_by_id,
    )


def _normalize_uniprot_id(value: str) -> str:
    return value.strip().upper()
