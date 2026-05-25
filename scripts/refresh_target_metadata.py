#!/usr/bin/env python
"""Refresh target metadata CSV fields from UniProt."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from proventl_api.lookup import UniProtRestClient


DEFAULT_TARGET_METADATA_PATH = Path(
    "model/data_testing/data_protein_kanker_uniprot.csv"
)
METADATA_FIELDS = ("gene", "protein_name", "organism", "protein_families")
UNKNOWN_VALUES = {"unknown_from_uniprot"}


def refresh_target_metadata(
    *,
    path: Path,
    dry_run: bool,
    fields: tuple[str, ...] = METADATA_FIELDS,
    limit: int | None = None,
) -> dict[str, int]:
    rows = _read_rows(path)
    client = UniProtRestClient()
    checked = 0
    updated = 0
    unavailable = 0

    for row in rows:
        if limit is not None and checked >= limit:
            break
        if not _needs_refresh(row, fields):
            continue

        accession = row["Uniprot_id"].strip().upper()
        checked += 1
        result = client.lookup(accession)
        if result.status != "found" or result.metadata is None:
            unavailable += 1
            continue

        changed = False
        for field in fields:
            value = result.metadata.get(field)
            if value and not _usable_value(row.get(field)):
                row[field] = value
                changed = True
        if changed:
            updated += 1

    if not dry_run:
        _write_rows(path, rows, fields)

    return {
        "checked": checked,
        "updated": updated,
        "unavailable": unavailable,
    }


def _read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def _write_rows(
    path: Path,
    rows: list[dict[str, str]],
    fields: tuple[str, ...],
) -> None:
    fieldnames = list(rows[0].keys())
    for field in fields:
        if field not in fieldnames:
            fieldnames.append(field)

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _needs_refresh(row: dict[str, str], fields: tuple[str, ...]) -> bool:
    return any(not _usable_value(row.get(field)) for field in fields)


def _usable_value(value: str | None) -> bool:
    return bool(
        value
        and value.strip()
        and value.strip().casefold() not in UNKNOWN_VALUES
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Refresh local target metadata fields from UniProt."
    )
    parser.add_argument(
        "--path",
        type=Path,
        default=DEFAULT_TARGET_METADATA_PATH,
        help="Target metadata CSV path.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and report refresh counts without writing the CSV.",
    )
    parser.add_argument(
        "--fields",
        nargs="+",
        choices=METADATA_FIELDS,
        default=METADATA_FIELDS,
        help="Metadata fields to refresh.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of UniProt records to check.",
    )
    args = parser.parse_args()

    result = refresh_target_metadata(
        path=args.path,
        dry_run=args.dry_run,
        fields=tuple(args.fields),
        limit=args.limit,
    )
    print(
        "checked={checked} updated={updated} unavailable={unavailable}".format(
            **result
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
