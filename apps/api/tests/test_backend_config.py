import hashlib

from proventl_api.core.config import load_backend_config


def test_backend_config_keeps_full_artifact_hashes_for_internal_use(
    monkeypatch,
    tmp_path,
):
    model_path = tmp_path / "best_model_auc_0.8748.h5"
    peptide_embeddings_path = tmp_path / "Pep_Ular_ProtT5.csv"
    protein_embeddings_path = tmp_path / "Prot_Cancer_ProtT5.csv"
    target_metadata_path = tmp_path / "data_protein_kanker_uniprot.csv"
    app_data_dir = tmp_path / "data"

    files = {
        "model": (model_path, b"model artifact"),
        "peptide_embeddings": (peptide_embeddings_path, b"peptide embeddings"),
        "protein_embeddings": (protein_embeddings_path, b"protein embeddings"),
        "target_metadata": (target_metadata_path, b"target metadata"),
    }
    for path, content in files.values():
        path.write_bytes(content)
    app_data_dir.mkdir()

    monkeypatch.setenv("PROVENTL_MODEL_PATH", str(model_path))
    monkeypatch.setenv("PROVENTL_PEPTIDE_EMBEDDINGS_PATH", str(peptide_embeddings_path))
    monkeypatch.setenv("PROVENTL_PROTEIN_EMBEDDINGS_PATH", str(protein_embeddings_path))
    monkeypatch.setenv("PROVENTL_TARGET_METADATA_PATH", str(target_metadata_path))
    monkeypatch.setenv("PROVENTL_APP_DATA_DIR", str(app_data_dir))

    config = load_backend_config()

    assert [
        {
            "name": artifact.name,
            "full_hash": artifact.full_hash,
            "short_hash": artifact.short_hash,
        }
        for artifact in config.artifacts
    ] == [
        {
            "name": name,
            "full_hash": hashlib.sha256(content).hexdigest(),
            "short_hash": hashlib.sha256(content).hexdigest()[:8],
        }
        for name, (_, content) in files.items()
    ]
    assert config.app_data_dir == app_data_dir
