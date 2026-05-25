import asyncio

import httpx

from proventl_api.app import create_app


async def get_twice(path: str) -> tuple[httpx.Response, httpx.Response]:
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        first_response = await client.get(path)
        second_response = await client.get(path)
    return first_response, second_response


async def get_sequence(paths: tuple[str, ...]) -> tuple[httpx.Response, ...]:
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return tuple([await client.get(path) for path in paths])


async def post_prediction_twice() -> tuple[httpx.Response, httpx.Response]:
    transport = httpx.ASGITransport(
        app=create_app(model_loader=lambda path: FeatureSumModel())
    )
    payload = {"target_uniprot_id": "P01133", "threshold": 0.50}
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        first_response = await client.post("/api/predictions", json=payload)
        second_response = await client.post("/api/predictions", json=payload)
    return first_response, second_response


def configure_artifacts(monkeypatch, tmp_path) -> None:
    model_path = tmp_path / "model.h5"
    peptide_embeddings_path = tmp_path / "peptides.csv"
    protein_embeddings_path = tmp_path / "proteins.csv"
    target_metadata_path = tmp_path / "targets.csv"
    app_data_dir = tmp_path / "data"

    model_path.write_bytes(b"model artifact")
    peptide_embeddings_path.write_text(
        _embedding_csv(
            id_column="pdb_chain",
            metadata_columns=["Seq", "Description", "features"],
            feature_prefix="pep_embed_",
            rows=[("VP001", ["AAAA", "Venom peptide", "venom"], 0.1)],
        ),
        encoding="utf-8",
    )
    protein_embeddings_path.write_text(
        _embedding_csv(
            id_column="Uniprot_id",
            metadata_columns=["prot_seq"],
            feature_prefix="prot_embed_",
            rows=[("P01133", ["SEQUENCE"], 0.1)],
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


def _embedding_csv(
    *,
    id_column: str,
    metadata_columns: list[str],
    feature_prefix: str,
    rows: list[tuple[str, list[str], float]],
) -> str:
    feature_columns = [f"{feature_prefix}{index}" for index in range(1024)]
    lines = [",".join([id_column, *metadata_columns, *feature_columns])]
    for row_id, metadata, first_feature in rows:
        feature_values = [str(first_feature), *["0.0" for _ in range(1023)]]
        lines.append(",".join([row_id, *metadata, *feature_values]))
    return "\n".join(lines)


class FeatureSumModel:
    input_shape = (None, 2048)
    output_shape = (None, 1)

    def predict(self, rows, verbose=0):
        return [[round(float(row[0]) + float(row[1024]), 6)] for row in rows]


def test_target_search_requests_are_rate_limited(monkeypatch, tmp_path):
    configure_artifacts(monkeypatch, tmp_path)
    monkeypatch.setenv("PROVENTL_RATE_LIMIT_SEARCH_REQUESTS", "1")
    monkeypatch.setenv("PROVENTL_RATE_LIMIT_WINDOW_SECONDS", "60")

    first_response, second_response = asyncio.run(
        get_twice("/api/targets/search?q=egfr")
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert second_response.json() == {
        "state": "rate-limited",
        "error": {
            "code": "RATE_LIMITED",
            "route": "target-search",
            "message": "Too many target search requests. Please try again shortly.",
        },
    }


def test_target_search_allows_more_requests_than_target_lookup(monkeypatch, tmp_path):
    configure_artifacts(monkeypatch, tmp_path)
    monkeypatch.setenv("PROVENTL_RATE_LIMIT_SEARCH_REQUESTS", "2")
    monkeypatch.setenv("PROVENTL_RATE_LIMIT_LOOKUP_REQUESTS", "1")
    monkeypatch.setenv("PROVENTL_RATE_LIMIT_WINDOW_SECONDS", "60")

    search_first, search_second, lookup_first, lookup_second = asyncio.run(
        get_sequence(
            (
                "/api/targets/search?q=egfr",
                "/api/targets/search?q=egfr",
                "/api/targets/lookup?accession=p01133",
                "/api/targets/lookup?accession=p01133",
            )
        )
    )

    assert search_first.status_code == 200
    assert search_second.status_code == 200
    assert lookup_first.status_code == 200
    assert lookup_second.status_code == 429
    assert lookup_second.json()["error"] == {
        "code": "RATE_LIMITED",
        "route": "target-lookup",
        "message": "Too many target lookup requests. Please try again shortly.",
    }


def test_prediction_requests_have_a_separate_configurable_limit(monkeypatch, tmp_path):
    configure_artifacts(monkeypatch, tmp_path)
    monkeypatch.setenv("PROVENTL_RATE_LIMIT_PREDICTION_REQUESTS", "1")
    monkeypatch.setenv("PROVENTL_RATE_LIMIT_WINDOW_SECONDS", "60")

    first_response, second_response = asyncio.run(post_prediction_twice())

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert second_response.json()["error"] == {
        "code": "RATE_LIMITED",
        "route": "prediction",
        "message": "Too many prediction requests. Please try again shortly.",
    }
