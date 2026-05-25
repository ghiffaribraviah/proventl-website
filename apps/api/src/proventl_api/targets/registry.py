import csv
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from proventl_api.core.config import BackendConfig

SEARCHABLE_TARGET_FIELDS = (
    "uniprot_id",
    "gene",
    "protein_name",
    "organism",
    "protein_families",
)
UNIPROT_ACCESSION_PATTERN = re.compile(
    r"^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9][A-Z][A-Z0-9]{2}[0-9])$"
)
DEFAULT_EXAMPLE_TARGET_IDS = ("P01133", "P00749", "P04637")


@dataclass(frozen=True)
class CuratedTargetRegistry:
    targets: list[dict[str, str]]
    provenance: dict[str, object]
    warnings: list[dict[str, str]]


class TargetRegistryValidationError(Exception):
    def __init__(self, issues: list[dict[str, str]]) -> None:
        super().__init__("Target registry validation failed.")
        self.issues = issues


def validate_curated_target_registry(
    *,
    targets: list[dict[str, str]],
    protein_embedding_ids: list[str],
) -> None:
    issues = []
    seen_registry_ids = set()
    duplicate_registry_ids = []
    registry_ids = set()
    for index, target in enumerate(targets):
        if not target.get("uniprot_id"):
            issues.append(
                {
                    "code": "MALFORMED_TARGET_RECORD",
                    "message": f"Registry target at index {index} is missing uniprot_id.",
                }
            )
            continue
        target_id = _normalize_uniprot_id(target["uniprot_id"])
        if target_id in seen_registry_ids and target_id not in duplicate_registry_ids:
            duplicate_registry_ids.append(target_id)
        seen_registry_ids.add(target_id)
        registry_ids.add(target_id)

    embedding_ids = {_normalize_uniprot_id(target_id) for target_id in protein_embedding_ids}
    issues.extend(
        {
            "code": "DUPLICATE_TARGET_ID",
            "target_id": target_id,
            "message": f"Target ID {target_id} appears more than once.",
        }
        for target_id in duplicate_registry_ids
    )

    issues.extend(
        {
            "code": "MISSING_EMBEDDING_BACKED_TARGET",
            "target_id": target_id,
            "message": (
                f"Embedding-backed target ID {target_id} is missing from the registry."
            ),
        }
        for target_id in sorted(embedding_ids - registry_ids)
    )
    issues.extend(
        {
            "code": "EXTRA_REGISTRY_TARGET",
            "target_id": target_id,
            "message": (
                f"Registry target ID {target_id} is not backed by a protein embedding."
            ),
        }
        for target_id in sorted(registry_ids - embedding_ids)
    )

    if issues:
        raise TargetRegistryValidationError(issues)


def generate_curated_target_registry(
    *,
    protein_embeddings_path: Path,
    target_metadata_path: Path,
    generated_at: datetime,
) -> CuratedTargetRegistry:
    embedding_rows = _read_csv_rows(protein_embeddings_path)
    duplicate_issues = _duplicate_target_issues(embedding_rows)
    if duplicate_issues:
        raise TargetRegistryValidationError(duplicate_issues)

    metadata_rows = _read_csv_rows(target_metadata_path)
    metadata_by_id = _metadata_by_id(metadata_rows)

    targets = []
    warnings = []
    for row in embedding_rows:
        uniprot_id = _normalize_uniprot_id(row["Uniprot_id"])
        target = {"uniprot_id": uniprot_id}
        metadata = metadata_by_id.get(uniprot_id)
        for source_field, target_field in (
            ("gene", "gene"),
            ("protein_name", "protein_name"),
            ("organism", "organism"),
        ):
            if metadata and metadata.get(source_field):
                target[target_field] = metadata[source_field]
        protein_families = (
            _clean_metadata_value(metadata.get("protein_families")) if metadata else None
        )
        if protein_families:
            target["protein_families"] = protein_families
        else:
            warnings.append(
                {
                    "code": "MISSING_OPTIONAL_METADATA",
                    "target_id": uniprot_id,
                    "field": "protein_families",
                    "message": (
                        "Optional metadata field protein_families "
                        f"is missing for {uniprot_id}."
                    ),
                }
            )
        targets.append(target)

    return CuratedTargetRegistry(
        targets=targets,
        provenance={
            "generated_at": generated_at.isoformat(),
            "sources": [
                _source_provenance("protein_embeddings", protein_embeddings_path),
                _source_provenance("target_metadata", target_metadata_path),
            ],
            "counts": {
                "protein_embedding_rows": len(embedding_rows),
                "curated_targets": len(targets),
                "metadata_rows": len(metadata_rows),
                "metadata_only_rows": len(
                    set(metadata_by_id) - {target["uniprot_id"] for target in targets}
                ),
            },
        },
        warnings=warnings,
    )


def generate_configured_curated_target_registry(
    *,
    config: BackendConfig,
    generated_at: datetime,
) -> CuratedTargetRegistry:
    artifact_paths = {artifact.name: artifact.path for artifact in config.artifacts}
    return generate_curated_target_registry(
        protein_embeddings_path=artifact_paths["protein_embeddings"],
        target_metadata_path=artifact_paths["target_metadata"],
        generated_at=generated_at,
    )


def search_curated_targets(
    *,
    targets: list[dict[str, str]],
    query: str,
) -> dict[str, object]:
    normalized_query = _normalize_search_text(query)
    if len(normalized_query) < 2:
        return {
            "query": query,
            "normalized_query": normalized_query,
            "count": 0,
            "results": [],
        }

    results = [
        target_preview(target)
        for target in targets
        if _target_matches_query(target, normalized_query)
    ]
    return {
        "query": query,
        "normalized_query": normalized_query,
        "count": len(results),
        "results": results,
    }


def lookup_curated_target(
    *,
    targets: list[dict[str, str]],
    accession: str,
) -> dict[str, object]:
    normalized_accession = _normalize_uniprot_id(accession)
    if not UNIPROT_ACCESSION_PATTERN.fullmatch(normalized_accession):
        return {
            "query": accession,
            "normalized_accession": normalized_accession,
            "state": "invalid-accession",
            "error": {
                "code": "INVALID_ACCESSION",
                "message": "Enter a valid UniProt accession.",
            },
        }

    targets_by_id = {
        _normalize_uniprot_id(target["uniprot_id"]): target for target in targets
    }
    target = targets_by_id[normalized_accession]
    return {
        "query": accession,
        "normalized_accession": normalized_accession,
        "state": "available-curated",
        "target": target_preview(target),
    }


def select_curated_example_targets(
    *,
    targets: list[dict[str, str]],
    preferred_target_ids: tuple[str, ...] = DEFAULT_EXAMPLE_TARGET_IDS,
) -> dict[str, object]:
    targets_by_id = {
        _normalize_uniprot_id(target["uniprot_id"]): target for target in targets
    }
    selected_ids = [
        _normalize_uniprot_id(target_id)
        for target_id in preferred_target_ids
        if _normalize_uniprot_id(target_id) in targets_by_id
    ]

    for target_id in sorted(targets_by_id):
        if len(selected_ids) >= len(preferred_target_ids):
            break
        if target_id not in selected_ids:
            selected_ids.append(target_id)

    examples = [target_preview(targets_by_id[target_id]) for target_id in selected_ids]
    return {
        "count": len(examples),
        "examples": examples,
    }


def registry_metadata(registry: CuratedTargetRegistry) -> dict[str, object]:
    return {
        "target_count": len(registry.targets),
        "hash": _short_registry_hash(registry.targets),
        "provenance": {
            **registry.provenance,
            "sources": [
                {
                    **source,
                    "sha256": source["sha256"][:8],
                }
                for source in registry.provenance["sources"]
            ],
        },
    }


def _read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def _metadata_by_id(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    return {
        _normalize_uniprot_id(row["Uniprot_id"]): row
        for row in rows
        if row.get("Uniprot_id")
    }


def _normalize_uniprot_id(value: str) -> str:
    return value.strip().upper()


def _normalize_search_text(value: str) -> str:
    return " ".join(value.strip().casefold().split())


def _target_matches_query(target: dict[str, str], normalized_query: str) -> bool:
    return any(
        normalized_query in _normalize_search_text(target.get(field, ""))
        for field in SEARCHABLE_TARGET_FIELDS
    )


def target_preview(target: dict[str, str]) -> dict[str, str]:
    preview = {"uniprot_id": target["uniprot_id"]}
    for source_field, response_field in (
        ("gene", "gene"),
        ("protein_name", "protein_name"),
        ("organism", "organism"),
        ("protein_families", "protein_family"),
    ):
        if target.get(source_field):
            preview[response_field] = target[source_field]
    return preview


def _clean_metadata_value(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned or cleaned.casefold() == "unknown_from_uniprot":
        return None
    return cleaned


def _duplicate_target_issues(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    seen = set()
    duplicate_ids = []
    for row in rows:
        target_id = _normalize_uniprot_id(row["Uniprot_id"])
        if target_id in seen and target_id not in duplicate_ids:
            duplicate_ids.append(target_id)
        seen.add(target_id)

    return [
        {
            "code": "DUPLICATE_TARGET_ID",
            "target_id": target_id,
            "message": f"Target ID {target_id} appears more than once.",
        }
        for target_id in duplicate_ids
    ]


def _source_provenance(name: str, path: Path) -> dict[str, str]:
    return {
        "name": name,
        "path": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def _short_registry_hash(targets: list[dict[str, str]]) -> str:
    payload = json.dumps(targets, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:8]
