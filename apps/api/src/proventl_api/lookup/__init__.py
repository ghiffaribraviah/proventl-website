"""Exact target lookup and UniProt client integration modules."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

import httpx

from proventl_api.cache import TargetMetadataCache
from proventl_api.targets.registry import (
    UNIPROT_ACCESSION_PATTERN,
    target_preview,
)


@dataclass(frozen=True)
class UniProtLookupResult:
    status: str
    metadata: dict[str, str] | None = None
    message: str | None = None

    @classmethod
    def found(cls, metadata: dict[str, str]) -> "UniProtLookupResult":
        return cls(status="found", metadata=metadata)

    @classmethod
    def not_found(cls) -> "UniProtLookupResult":
        return cls(status="not_found")

    @classmethod
    def unavailable(
        cls,
        message: str = "UniProt lookup is currently unavailable.",
    ) -> "UniProtLookupResult":
        return cls(status="unavailable", message=message)


class UniProtClient(Protocol):
    def lookup(self, accession: str) -> UniProtLookupResult: ...


class UnavailableUniProtClient:
    def lookup(self, accession: str) -> UniProtLookupResult:
        return UniProtLookupResult.unavailable()


class UniProtRestClient:
    def __init__(
        self,
        *,
        http_client: httpx.Client | None = None,
        base_url: str = "https://rest.uniprot.org/uniprotkb",
    ) -> None:
        self._http_client = http_client or httpx.Client(timeout=5.0)
        self._base_url = base_url.rstrip("/")

    def lookup(self, accession: str) -> UniProtLookupResult:
        try:
            response = self._http_client.get(f"{self._base_url}/{accession}.json")
        except httpx.HTTPError:
            return UniProtLookupResult.unavailable()

        if response.status_code == 404:
            return UniProtLookupResult.not_found()
        if response.status_code != 200:
            return UniProtLookupResult.unavailable()

        return UniProtLookupResult.found(_compact_uniprot_metadata(response.json()))


def lookup_target(
    *,
    targets: list[dict[str, str]],
    accession: str,
    uniprot_client: UniProtClient,
    metadata_cache: TargetMetadataCache | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    lookup_time = now or datetime.now(UTC)
    normalized_accession = accession.strip().upper()
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

    targets_by_id = {target["uniprot_id"].strip().upper(): target for target in targets}
    if normalized_accession in targets_by_id:
        target = targets_by_id[normalized_accession]
        enriched_target, provenance = _enrich_metadata(
            base_metadata=target,
            normalized_accession=normalized_accession,
            uniprot_client=uniprot_client,
            metadata_cache=metadata_cache,
            lookup_time=lookup_time,
        )
        return {
            "query": accession,
            "normalized_accession": normalized_accession,
            "state": "available-curated",
            "prediction_eligible": True,
            "target": target_preview(enriched_target),
            **({"provenance": provenance} if provenance else {}),
        }

    cached_entry = metadata_cache.get(normalized_accession) if metadata_cache else None
    if cached_entry and cached_entry.is_fresh(lookup_time):
        return {
            "query": accession,
            "normalized_accession": normalized_accession,
            "state": "valid-but-not-available",
            "prediction_eligible": False,
            "target": target_preview(cached_entry.metadata),
            "provenance": {
                "source": "cache",
                "cache_status": "fresh",
                "cached_source": cached_entry.source,
            },
        }

    try:
        result = uniprot_client.lookup(normalized_accession)
    except Exception:
        result = UniProtLookupResult.unavailable()
    if result.status == "found" and result.metadata is not None:
        if metadata_cache:
            metadata_cache.upsert(
                accession=normalized_accession,
                metadata=result.metadata,
                source="uniprot",
                fetched_at=lookup_time,
            )
        return {
            "query": accession,
            "normalized_accession": normalized_accession,
            "state": "valid-but-not-available",
            "prediction_eligible": False,
            "target": target_preview(result.metadata),
            "provenance": {
                "source": "uniprot",
                **({"cache_status": "refreshed"} if cached_entry else {}),
            },
        }

    if cached_entry and result.status == "unavailable":
        return {
            "query": accession,
            "normalized_accession": normalized_accession,
            "state": "valid-but-not-available",
            "prediction_eligible": False,
            "target": target_preview(cached_entry.metadata),
            "provenance": {
                "source": "cache",
                "cache_status": "stale",
                "cached_source": cached_entry.source,
                "refresh_status": "failed",
            },
        }

    if result.status == "not_found":
        return {
            "query": accession,
            "normalized_accession": normalized_accession,
            "state": "not-found",
            "prediction_eligible": False,
            "error": {
                "code": "UNIPROT_TARGET_NOT_FOUND",
                "message": "No UniProt record was found for this accession.",
            },
        }

    return {
        "query": accession,
        "normalized_accession": normalized_accession,
        "state": "lookup-unavailable",
        "prediction_eligible": False,
        "error": {
            "code": "UNIPROT_LOOKUP_UNAVAILABLE",
            "message": result.message or "UniProt lookup is currently unavailable.",
        },
    }


def _compact_uniprot_metadata(record: dict[str, object]) -> dict[str, str]:
    metadata = {
        "uniprot_id": str(record.get("primaryAccession", "")),
    }
    gene = _first_gene_name(record)
    if gene:
        metadata["gene"] = gene
    protein_name = _recommended_protein_name(record)
    if protein_name:
        metadata["protein_name"] = protein_name
    organism = _organism_name(record)
    if organism:
        metadata["organism"] = organism
    protein_families = _protein_families(record)
    if protein_families:
        metadata["protein_families"] = protein_families
    return metadata


def _enrich_metadata(
    *,
    base_metadata: dict[str, str],
    normalized_accession: str,
    uniprot_client: UniProtClient,
    metadata_cache: TargetMetadataCache | None,
    lookup_time: datetime,
) -> tuple[dict[str, str], dict[str, str] | None]:
    if not _needs_enrichment(base_metadata):
        return base_metadata, None

    cached_entry = metadata_cache.get(normalized_accession) if metadata_cache else None
    if cached_entry and cached_entry.is_fresh(lookup_time):
        return _merge_metadata(base_metadata, cached_entry.metadata), {
            "source": "cache",
            "cache_status": "fresh",
            "cached_source": cached_entry.source,
        }

    try:
        result = uniprot_client.lookup(normalized_accession)
    except Exception:
        result = UniProtLookupResult.unavailable()

    if result.status == "found" and result.metadata is not None:
        merged_metadata = _merge_metadata(base_metadata, result.metadata)
        if metadata_cache:
            metadata_cache.upsert(
                accession=normalized_accession,
                metadata=merged_metadata,
                source="uniprot",
                fetched_at=lookup_time,
            )
        return merged_metadata, {
            "source": "uniprot",
            **({"cache_status": "refreshed"} if cached_entry else {}),
        }

    if cached_entry and result.status == "unavailable":
        return _merge_metadata(base_metadata, cached_entry.metadata), {
            "source": "cache",
            "cache_status": "stale",
            "cached_source": cached_entry.source,
            "refresh_status": "failed",
        }

    return base_metadata, None


def _needs_enrichment(metadata: dict[str, str]) -> bool:
    return any(
        not _usable_metadata_value(metadata.get(field))
        for field in ("gene", "protein_name", "organism", "protein_families")
    )


def _merge_metadata(
    base_metadata: dict[str, str],
    enrichment_metadata: dict[str, str],
) -> dict[str, str]:
    merged = {
        key: value
        for key, value in base_metadata.items()
        if _usable_metadata_value(value)
    }
    for key, value in enrichment_metadata.items():
        if _usable_metadata_value(value) and not _usable_metadata_value(merged.get(key)):
            merged[key] = value.strip()
    if not _usable_metadata_value(merged.get("uniprot_id")):
        merged["uniprot_id"] = base_metadata["uniprot_id"].strip().upper()
    return merged


def _usable_metadata_value(value: str | None) -> bool:
    return bool(
        value
        and value.strip()
        and value.strip().casefold() != "unknown_from_uniprot"
    )


def _first_gene_name(record: dict[str, object]) -> str | None:
    genes = record.get("genes")
    if not isinstance(genes, list) or not genes:
        return None
    first_gene = genes[0]
    if not isinstance(first_gene, dict):
        return None
    gene_name = first_gene.get("geneName")
    if not isinstance(gene_name, dict):
        return None
    value = gene_name.get("value")
    return str(value) if value else None


def _recommended_protein_name(record: dict[str, object]) -> str | None:
    protein_description = record.get("proteinDescription")
    if not isinstance(protein_description, dict):
        return None
    recommended_name = protein_description.get("recommendedName")
    if not isinstance(recommended_name, dict):
        return None
    full_name = recommended_name.get("fullName")
    if not isinstance(full_name, dict):
        return None
    value = full_name.get("value")
    return str(value) if value else None


def _organism_name(record: dict[str, object]) -> str | None:
    organism = record.get("organism")
    if not isinstance(organism, dict):
        return None
    scientific_name = organism.get("scientificName")
    return str(scientific_name) if scientific_name else None


def _protein_families(record: dict[str, object]) -> str | None:
    comments = record.get("comments")
    if not isinstance(comments, list):
        return None
    for comment in comments:
        if not isinstance(comment, dict) or comment.get("commentType") != "SIMILARITY":
            continue
        texts = comment.get("texts")
        if not isinstance(texts, list):
            continue
        for text in texts:
            if not isinstance(text, dict):
                continue
            value = text.get("value")
            if value:
                return _compact_family_text(str(value))
    return None


def _compact_family_text(value: str) -> str:
    compacted = " ".join(value.strip().split())
    prefix = "Belongs to the "
    if compacted.startswith(prefix):
        compacted = compacted[len(prefix) :]
    return compacted.rstrip(".")
