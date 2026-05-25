import asyncio
import socket
from datetime import UTC, datetime, timedelta

import httpx

from proventl_api.app import create_app
from proventl_api.cache import (
    TARGET_METADATA_CACHE_TTL,
    TargetMetadataCache,
    cache_database_path,
)
from proventl_api.lookup import UniProtLookupResult


async def get(path: str, *, uniprot_client=None) -> httpx.Response:
    transport = httpx.ASGITransport(app=create_app(uniprot_client=uniprot_client))
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.get(path)


def configure_artifacts(monkeypatch, tmp_path) -> None:
    model_path = tmp_path / "model.h5"
    peptide_embeddings_path = tmp_path / "peptides.csv"
    protein_embeddings_path = tmp_path / "proteins.csv"
    target_metadata_path = tmp_path / "targets.csv"
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
                "Q99999,FAKE,Metadata only protein,Homo sapiens,Metadata-only family",
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


def test_target_search_returns_curated_registry_matches_by_uniprot_id(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(get("/api/targets/search?q=p01133"))

    assert response.status_code == 200
    assert response.json() == {
        "query": "p01133",
        "normalized_query": "p01133",
        "count": 1,
        "results": [
            {
                "uniprot_id": "P01133",
                "gene": "EGFR",
                "protein_name": "Epidermal growth factor receptor",
                "organism": "Homo sapiens",
                "protein_family": "Receptor tyrosine kinase",
            }
        ],
    }


def test_target_lookup_returns_curated_target_after_normalizing_accession(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(get("/api/targets/lookup?accession=%20p01133%20"))

    assert response.status_code == 200
    assert response.json() == {
        "query": " p01133 ",
        "normalized_accession": "P01133",
        "state": "available-curated",
        "prediction_eligible": True,
        "target": {
            "uniprot_id": "P01133",
            "gene": "EGFR",
            "protein_name": "Epidermal growth factor receptor",
            "organism": "Homo sapiens",
            "protein_family": "Receptor tyrosine kinase",
        },
    }


def test_target_lookup_returns_valid_unsupported_uniprot_metadata(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    class FakeUniProtClient:
        def lookup(self, accession: str) -> UniProtLookupResult:
            assert accession == "Q9Y6K9"
            return UniProtLookupResult.found(
                {
                    "uniprot_id": accession,
                    "gene": "IKKB",
                    "protein_name": "Inhibitor of nuclear factor kappa-B kinase subunit beta",
                    "organism": "Homo sapiens",
                }
            )

    response = asyncio.run(
        get("/api/targets/lookup?accession=%20q9y6k9%20", uniprot_client=FakeUniProtClient())
    )

    assert response.status_code == 200
    assert response.json() == {
        "query": " q9y6k9 ",
        "normalized_accession": "Q9Y6K9",
        "state": "valid-but-not-available",
        "prediction_eligible": False,
        "target": {
            "uniprot_id": "Q9Y6K9",
            "gene": "IKKB",
            "protein_name": "Inhibitor of nuclear factor kappa-B kinase subunit beta",
            "organism": "Homo sapiens",
        },
        "provenance": {
            "source": "uniprot",
        },
    }


def test_target_lookup_uses_fresh_cached_unsupported_metadata_without_calling_uniprot(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    class CountingUniProtClient:
        def __init__(self) -> None:
            self.calls = 0

        def lookup(self, accession: str) -> UniProtLookupResult:
            self.calls += 1
            assert accession == "Q9Y6K9"
            return UniProtLookupResult.found(
                {
                    "uniprot_id": accession,
                    "gene": "IKKB",
                    "protein_name": "Inhibitor of nuclear factor kappa-B kinase subunit beta",
                    "organism": "Homo sapiens",
                }
            )

    uniprot_client = CountingUniProtClient()

    first_response = asyncio.run(
        get("/api/targets/lookup?accession=q9y6k9", uniprot_client=uniprot_client)
    )
    second_response = asyncio.run(
        get("/api/targets/lookup?accession=q9y6k9", uniprot_client=uniprot_client)
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert uniprot_client.calls == 1
    assert second_response.json() == {
        "query": "q9y6k9",
        "normalized_accession": "Q9Y6K9",
        "state": "valid-but-not-available",
        "prediction_eligible": False,
        "target": {
            "uniprot_id": "Q9Y6K9",
            "gene": "IKKB",
            "protein_name": "Inhibitor of nuclear factor kappa-B kinase subunit beta",
            "organism": "Homo sapiens",
        },
        "provenance": {
            "source": "cache",
            "cache_status": "fresh",
            "cached_source": "uniprot",
        },
    }


def test_target_lookup_refreshes_stale_cached_unsupported_metadata(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)
    app_data_dir = tmp_path / "data"
    metadata_cache = TargetMetadataCache(cache_database_path(app_data_dir))
    metadata_cache.migrate()
    metadata_cache.upsert(
        accession="Q9Y6K9",
        metadata={
            "uniprot_id": "Q9Y6K9",
            "gene": "OLD",
            "protein_name": "Old protein name",
            "organism": "Homo sapiens",
        },
        source="uniprot",
        fetched_at=datetime.now(UTC) - TARGET_METADATA_CACHE_TTL - timedelta(seconds=1),
    )

    class RefreshingUniProtClient:
        def __init__(self) -> None:
            self.calls = 0

        def lookup(self, accession: str) -> UniProtLookupResult:
            self.calls += 1
            assert accession == "Q9Y6K9"
            return UniProtLookupResult.found(
                {
                    "uniprot_id": accession,
                    "gene": "IKKB",
                    "protein_name": "Inhibitor of nuclear factor kappa-B kinase subunit beta",
                    "organism": "Homo sapiens",
                }
            )

    uniprot_client = RefreshingUniProtClient()

    response = asyncio.run(
        get("/api/targets/lookup?accession=q9y6k9", uniprot_client=uniprot_client)
    )

    assert response.status_code == 200
    assert uniprot_client.calls == 1
    assert response.json() == {
        "query": "q9y6k9",
        "normalized_accession": "Q9Y6K9",
        "state": "valid-but-not-available",
        "prediction_eligible": False,
        "target": {
            "uniprot_id": "Q9Y6K9",
            "gene": "IKKB",
            "protein_name": "Inhibitor of nuclear factor kappa-B kinase subunit beta",
            "organism": "Homo sapiens",
        },
        "provenance": {
            "source": "uniprot",
            "cache_status": "refreshed",
        },
    }


def test_target_lookup_returns_stale_cached_metadata_when_refresh_fails(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)
    app_data_dir = tmp_path / "data"
    metadata_cache = TargetMetadataCache(cache_database_path(app_data_dir))
    metadata_cache.migrate()
    metadata_cache.upsert(
        accession="Q9Y6K9",
        metadata={
            "uniprot_id": "Q9Y6K9",
            "gene": "IKKB",
            "protein_name": "Inhibitor of nuclear factor kappa-B kinase subunit beta",
            "organism": "Homo sapiens",
        },
        source="uniprot",
        fetched_at=datetime.now(UTC) - TARGET_METADATA_CACHE_TTL - timedelta(seconds=1),
    )

    class FailingUniProtClient:
        def lookup(self, accession: str) -> UniProtLookupResult:
            assert accession == "Q9Y6K9"
            raise TimeoutError("UniProt request timed out")

    response = asyncio.run(
        get("/api/targets/lookup?accession=q9y6k9", uniprot_client=FailingUniProtClient())
    )

    assert response.status_code == 200
    assert response.json() == {
        "query": "q9y6k9",
        "normalized_accession": "Q9Y6K9",
        "state": "valid-but-not-available",
        "prediction_eligible": False,
        "target": {
            "uniprot_id": "Q9Y6K9",
            "gene": "IKKB",
            "protein_name": "Inhibitor of nuclear factor kappa-B kinase subunit beta",
            "organism": "Homo sapiens",
        },
        "provenance": {
            "source": "cache",
            "cache_status": "stale",
            "cached_source": "uniprot",
            "refresh_status": "failed",
        },
    }


def test_target_lookup_returns_uniprot_not_found_state(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    class FakeUniProtClient:
        def lookup(self, accession: str) -> UniProtLookupResult:
            assert accession == "Q9Y6K9"
            return UniProtLookupResult.not_found()

    response = asyncio.run(
        get("/api/targets/lookup?accession=q9y6k9", uniprot_client=FakeUniProtClient())
    )

    assert response.status_code == 200
    assert response.json() == {
        "query": "q9y6k9",
        "normalized_accession": "Q9Y6K9",
        "state": "not-found",
        "prediction_eligible": False,
        "error": {
            "code": "UNIPROT_TARGET_NOT_FOUND",
            "message": "No UniProt record was found for this accession.",
        },
    }


def test_target_lookup_returns_lookup_unavailable_when_uniprot_client_fails(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    class FailingUniProtClient:
        def lookup(self, accession: str) -> UniProtLookupResult:
            assert accession == "Q9Y6K9"
            raise TimeoutError("UniProt request timed out")

    response = asyncio.run(
        get("/api/targets/lookup?accession=q9y6k9", uniprot_client=FailingUniProtClient())
    )

    assert response.status_code == 200
    assert response.json() == {
        "query": "q9y6k9",
        "normalized_accession": "Q9Y6K9",
        "state": "lookup-unavailable",
        "prediction_eligible": False,
        "error": {
            "code": "UNIPROT_LOOKUP_UNAVAILABLE",
            "message": "UniProt lookup is currently unavailable.",
        },
    }


def test_target_lookup_returns_invalid_accession_state_for_malformed_input(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(get("/api/targets/lookup?accession=not-a-uniprot-id"))

    assert response.status_code == 200
    assert response.json() == {
        "query": "not-a-uniprot-id",
        "normalized_accession": "NOT-A-UNIPROT-ID",
        "state": "invalid-accession",
        "error": {
            "code": "INVALID_ACCESSION",
            "message": "Enter a valid UniProt accession.",
        },
    }


def test_target_lookup_for_curated_accession_does_not_require_network_access(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    async def get_with_network_disabled(path: str) -> httpx.Response:
        def fail_on_socket(*args, **kwargs):
            raise AssertionError("curated target lookup must not open network sockets")

        monkeypatch.setattr(socket, "socket", fail_on_socket)
        return await get(path)

    response = asyncio.run(
        get_with_network_disabled("/api/targets/lookup?accession=p01133")
    )

    assert response.status_code == 200
    assert response.json()["state"] == "available-curated"
    assert response.json()["target"]["uniprot_id"] == "P01133"


def test_target_lookup_enriches_sparse_curated_metadata_from_uniprot(
    monkeypatch,
    tmp_path,
):
    model_path = tmp_path / "model.h5"
    peptide_embeddings_path = tmp_path / "peptides.csv"
    protein_embeddings_path = tmp_path / "proteins.csv"
    target_metadata_path = tmp_path / "targets.csv"
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
            ]
        ),
        encoding="utf-8",
    )
    target_metadata_path.write_text(
        "\n".join(
            [
                "Uniprot_id,prot_seq,protein_families",
                "P01133,SEQUENCE,Unknown_from_uniprot",
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

    class EnrichingUniProtClient:
        def lookup(self, accession: str) -> UniProtLookupResult:
            assert accession == "P01133"
            return UniProtLookupResult.found(
                {
                    "uniprot_id": "P01133",
                    "gene": "EGFR",
                    "protein_name": "Epidermal growth factor receptor",
                    "organism": "Homo sapiens",
                    "protein_families": "Receptor tyrosine kinase",
                }
            )

    response = asyncio.run(
        get("/api/targets/lookup?accession=p01133", uniprot_client=EnrichingUniProtClient())
    )

    assert response.status_code == 200
    assert response.json() == {
        "query": "p01133",
        "normalized_accession": "P01133",
        "state": "available-curated",
        "prediction_eligible": True,
        "target": {
            "uniprot_id": "P01133",
            "gene": "EGFR",
            "protein_name": "Epidermal growth factor receptor",
            "organism": "Homo sapiens",
            "protein_family": "Receptor tyrosine kinase",
        },
        "provenance": {
            "source": "uniprot",
        },
    }


def test_target_search_matches_available_metadata_fields_with_normalization(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    searches = {
        " egfr ": "P01133",
        "EPIDERMAL   GROWTH": "P01133",
        "homo SAPIENS": "P01133",
        "receptor   tyrosine": "P01133",
    }

    for query, expected_target_id in searches.items():
        response = asyncio.run(get(f"/api/targets/search?q={query}"))

        assert response.status_code == 200
        assert response.json()["count"] == 1
        assert response.json()["results"][0]["uniprot_id"] == expected_target_id


def test_target_search_returns_stable_empty_responses_for_empty_short_and_no_match_queries(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    searches = {
        "": "",
        "e": "e",
        "no-such-target": "no-such-target",
    }

    for query, normalized_query in searches.items():
        response = asyncio.run(get(f"/api/targets/search?q={query}"))

        assert response.status_code == 200
        assert response.json() == {
            "query": query,
            "normalized_query": normalized_query,
            "count": 0,
            "results": [],
        }


def test_target_search_never_returns_metadata_only_targets(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(get("/api/targets/search?q=metadata-only"))

    assert response.status_code == 200
    assert response.json() == {
        "query": "metadata-only",
        "normalized_query": "metadata-only",
        "count": 0,
        "results": [],
    }


def test_target_search_does_not_require_network_access(monkeypatch, tmp_path):
    configure_artifacts(monkeypatch, tmp_path)

    async def get_with_network_disabled(path: str) -> httpx.Response:
        def fail_on_socket(*args, **kwargs):
            raise AssertionError("target search must not open network sockets")

        monkeypatch.setattr(socket, "socket", fail_on_socket)
        return await get(path)

    response = asyncio.run(get_with_network_disabled("/api/targets/search?q=egfr"))

    assert response.status_code == 200
    assert response.json()["results"][0]["uniprot_id"] == "P01133"


def test_target_examples_return_supported_curated_target_previews(
    monkeypatch,
    tmp_path,
):
    configure_artifacts(monkeypatch, tmp_path)

    response = asyncio.run(get("/api/targets/examples"))

    assert response.status_code == 200
    assert response.json() == {
        "count": 2,
        "examples": [
            {
                "uniprot_id": "P01133",
                "gene": "EGFR",
                "protein_name": "Epidermal growth factor receptor",
                "organism": "Homo sapiens",
                "protein_family": "Receptor tyrosine kinase",
            },
            {
                "uniprot_id": "P00749",
            },
        ],
    }


def test_target_examples_fall_back_deterministically_when_preferred_targets_are_absent(
    monkeypatch,
    tmp_path,
):
    model_path = tmp_path / "model.h5"
    peptide_embeddings_path = tmp_path / "peptides.csv"
    protein_embeddings_path = tmp_path / "proteins.csv"
    target_metadata_path = tmp_path / "targets.csv"
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
                "Q22222,SEQUENCE,0.2",
                "A11111,SEQUENCE,0.1",
            ]
        ),
        encoding="utf-8",
    )
    target_metadata_path.write_text(
        "\n".join(
            [
                "Uniprot_id,gene,protein_name,organism,protein_families",
                "Q99999,FAKE,Metadata only protein,Homo sapiens,Metadata-only family",
                "A11111,FALLBACK1,Supported fallback one,Homo sapiens,Family A",
                "Q22222,FALLBACK2,Supported fallback two,Homo sapiens,Family Q",
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

    response = asyncio.run(get("/api/targets/examples"))

    assert response.status_code == 200
    assert [example["uniprot_id"] for example in response.json()["examples"]] == [
        "A11111",
        "Q22222",
    ]
