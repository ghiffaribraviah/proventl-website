"""Cache repositories and migrations for backend runtime state."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path


TARGET_METADATA_CACHE_TTL = timedelta(days=30)


@dataclass(frozen=True)
class TargetMetadataCacheEntry:
    accession: str
    metadata: dict[str, str]
    source: str
    fetched_at: datetime

    def is_fresh(self, now: datetime) -> bool:
        return now - self.fetched_at <= TARGET_METADATA_CACHE_TTL


@dataclass(frozen=True)
class PredictionResultCacheEntry:
    target_uniprot_id: str
    model_hash: str
    peptide_embeddings_hash: str
    protein_embeddings_hash: str
    probabilities: tuple[float, ...]
    created_at: datetime


class TargetMetadataCache:
    def __init__(self, database_path: Path) -> None:
        self._database_path = database_path

    def migrate(self) -> None:
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS applied_migrations (
                    name TEXT PRIMARY KEY,
                    applied_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS target_metadata_cache (
                    accession TEXT PRIMARY KEY,
                    metadata_json TEXT NOT NULL,
                    source TEXT NOT NULL,
                    fetched_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                INSERT OR IGNORE INTO applied_migrations (name, applied_at)
                VALUES (?, ?)
                """,
                ("0001_target_metadata_cache", datetime.now(UTC).isoformat()),
            )

    def get(self, accession: str) -> TargetMetadataCacheEntry | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT accession, metadata_json, source, fetched_at
                FROM target_metadata_cache
                WHERE accession = ?
                """,
                (accession,),
            ).fetchone()

        if row is None:
            return None

        return TargetMetadataCacheEntry(
            accession=str(row["accession"]),
            metadata={
                str(key): str(value)
                for key, value in json.loads(str(row["metadata_json"])).items()
            },
            source=str(row["source"]),
            fetched_at=datetime.fromisoformat(str(row["fetched_at"])),
        )

    def upsert(
        self,
        *,
        accession: str,
        metadata: dict[str, str],
        source: str,
        fetched_at: datetime,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO target_metadata_cache (
                    accession,
                    metadata_json,
                    source,
                    fetched_at
                )
                VALUES (?, ?, ?, ?)
                ON CONFLICT(accession) DO UPDATE SET
                    metadata_json = excluded.metadata_json,
                    source = excluded.source,
                    fetched_at = excluded.fetched_at
                """,
                (
                    accession,
                    json.dumps(metadata, sort_keys=True),
                    source,
                    fetched_at.isoformat(),
                ),
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        return connection


class PredictionResultCache:
    def __init__(self, database_path: Path) -> None:
        self._database_path = database_path

    def migrate(self) -> None:
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS applied_migrations (
                    name TEXT PRIMARY KEY,
                    applied_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS prediction_result_cache (
                    target_uniprot_id TEXT NOT NULL,
                    model_hash TEXT NOT NULL,
                    peptide_embeddings_hash TEXT NOT NULL,
                    protein_embeddings_hash TEXT NOT NULL,
                    probabilities_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (
                        target_uniprot_id,
                        model_hash,
                        peptide_embeddings_hash,
                        protein_embeddings_hash
                    )
                )
                """
            )
            connection.execute(
                """
                INSERT OR IGNORE INTO applied_migrations (name, applied_at)
                VALUES (?, ?)
                """,
                ("0002_prediction_result_cache", datetime.now(UTC).isoformat()),
            )

    def get(
        self,
        *,
        target_uniprot_id: str,
        model_hash: str,
        peptide_embeddings_hash: str,
        protein_embeddings_hash: str,
    ) -> PredictionResultCacheEntry | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    target_uniprot_id,
                    model_hash,
                    peptide_embeddings_hash,
                    protein_embeddings_hash,
                    probabilities_json,
                    created_at
                FROM prediction_result_cache
                WHERE target_uniprot_id = ?
                    AND model_hash = ?
                    AND peptide_embeddings_hash = ?
                    AND protein_embeddings_hash = ?
                """,
                (
                    _normalize_uniprot_id(target_uniprot_id),
                    model_hash,
                    peptide_embeddings_hash,
                    protein_embeddings_hash,
                ),
            ).fetchone()

        if row is None:
            return None

        return PredictionResultCacheEntry(
            target_uniprot_id=str(row["target_uniprot_id"]),
            model_hash=str(row["model_hash"]),
            peptide_embeddings_hash=str(row["peptide_embeddings_hash"]),
            protein_embeddings_hash=str(row["protein_embeddings_hash"]),
            probabilities=tuple(
                float(probability)
                for probability in json.loads(str(row["probabilities_json"]))
            ),
            created_at=datetime.fromisoformat(str(row["created_at"])),
        )

    def upsert(
        self,
        *,
        target_uniprot_id: str,
        model_hash: str,
        peptide_embeddings_hash: str,
        protein_embeddings_hash: str,
        probabilities: tuple[float, ...],
        created_at: datetime,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO prediction_result_cache (
                    target_uniprot_id,
                    model_hash,
                    peptide_embeddings_hash,
                    protein_embeddings_hash,
                    probabilities_json,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(
                    target_uniprot_id,
                    model_hash,
                    peptide_embeddings_hash,
                    protein_embeddings_hash
                ) DO UPDATE SET
                    probabilities_json = excluded.probabilities_json,
                    created_at = excluded.created_at
                """,
                (
                    _normalize_uniprot_id(target_uniprot_id),
                    model_hash,
                    peptide_embeddings_hash,
                    protein_embeddings_hash,
                    json.dumps(list(probabilities)),
                    created_at.isoformat(),
                ),
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        return connection


def cache_database_path(app_data_dir: Path) -> Path:
    return app_data_dir / "proventl-cache.sqlite3"


def _normalize_uniprot_id(value: str) -> str:
    return value.strip().upper()
