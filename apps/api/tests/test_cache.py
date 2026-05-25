import sqlite3
from datetime import UTC, datetime

from proventl_api.cache import PredictionResultCache, TargetMetadataCache


def test_target_metadata_cache_migrations_are_idempotent_and_tracked(tmp_path):
    database_path = tmp_path / "cache.sqlite3"
    metadata_cache = TargetMetadataCache(database_path)

    metadata_cache.migrate()
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
        fetched_at=datetime(2026, 5, 23, tzinfo=UTC),
    )

    cached_entry = metadata_cache.get("Q9Y6K9")
    assert cached_entry is not None
    assert cached_entry.metadata["gene"] == "IKKB"

    with sqlite3.connect(database_path) as connection:
        applied_migrations = connection.execute(
            "SELECT name FROM applied_migrations ORDER BY name"
        ).fetchall()

    assert applied_migrations == [("0001_target_metadata_cache",)]


def test_prediction_result_cache_migrations_are_idempotent_and_round_trip_probabilities(
    tmp_path,
):
    database_path = tmp_path / "cache.sqlite3"
    prediction_cache = PredictionResultCache(database_path)

    prediction_cache.migrate()
    prediction_cache.migrate()
    prediction_cache.upsert(
        target_uniprot_id="p01133",
        model_hash="model-full-hash",
        peptide_embeddings_hash="peptide-full-hash",
        protein_embeddings_hash="protein-full-hash",
        probabilities=(0.4, 0.7, 0.5),
        created_at=datetime(2026, 5, 23, tzinfo=UTC),
    )

    cached_entry = prediction_cache.get(
        target_uniprot_id=" P01133 ",
        model_hash="model-full-hash",
        peptide_embeddings_hash="peptide-full-hash",
        protein_embeddings_hash="protein-full-hash",
    )
    assert cached_entry is not None
    assert cached_entry.target_uniprot_id == "P01133"
    assert cached_entry.probabilities == (0.4, 0.7, 0.5)

    with sqlite3.connect(database_path) as connection:
        applied_migrations = connection.execute(
            "SELECT name FROM applied_migrations ORDER BY name"
        ).fetchall()

    assert applied_migrations == [("0002_prediction_result_cache",)]


def test_prediction_result_cache_key_includes_all_artifact_hashes(tmp_path):
    database_path = tmp_path / "cache.sqlite3"
    prediction_cache = PredictionResultCache(database_path)
    prediction_cache.migrate()
    prediction_cache.upsert(
        target_uniprot_id="P01133",
        model_hash="model-a",
        peptide_embeddings_hash="peptide-a",
        protein_embeddings_hash="protein-a",
        probabilities=(0.4, 0.7, 0.5),
        created_at=datetime(2026, 5, 23, tzinfo=UTC),
    )

    assert (
        prediction_cache.get(
            target_uniprot_id="P01133",
            model_hash="model-b",
            peptide_embeddings_hash="peptide-a",
            protein_embeddings_hash="protein-a",
        )
        is None
    )
    assert (
        prediction_cache.get(
            target_uniprot_id="P01133",
            model_hash="model-a",
            peptide_embeddings_hash="peptide-b",
            protein_embeddings_hash="protein-a",
        )
        is None
    )
    assert (
        prediction_cache.get(
            target_uniprot_id="P01133",
            model_hash="model-a",
            peptide_embeddings_hash="peptide-a",
            protein_embeddings_hash="protein-b",
        )
        is None
    )
