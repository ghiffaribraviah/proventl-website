import hashlib
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


ARTIFACT_SETTINGS = (
    ("model", "PROVENTL_MODEL_PATH"),
    ("peptide_embeddings", "PROVENTL_PEPTIDE_EMBEDDINGS_PATH"),
    ("protein_embeddings", "PROVENTL_PROTEIN_EMBEDDINGS_PATH"),
    ("target_metadata", "PROVENTL_TARGET_METADATA_PATH"),
)

REQUIRED_SETTINGS = tuple(
    setting for _, setting in ARTIFACT_SETTINGS
) + ("PROVENTL_APP_DATA_DIR",)


@dataclass(frozen=True)
class ArtifactConfig:
    name: str
    path: Path
    full_hash: str

    @property
    def short_hash(self) -> str:
        return self.full_hash[:8]


@dataclass(frozen=True)
class BackendConfig:
    artifacts: tuple[ArtifactConfig, ...]
    app_data_dir: Path


@dataclass(frozen=True)
class ConfigIssue:
    code: str
    setting: str
    message: str


class BackendConfigError(Exception):
    def __init__(self, issues: list[ConfigIssue]) -> None:
        super().__init__("Backend configuration is invalid.")
        self.issues = issues


def load_backend_config(
    environ: Mapping[str, str] | None = None,
) -> BackendConfig:
    source = os.environ if environ is None else environ

    issues = [
        ConfigIssue(
            code="CONFIGURATION_MISSING",
            setting=name,
            message=f"Required environment variable {name} is not set.",
        )
        for name in REQUIRED_SETTINGS
        if not source.get(name)
    ]
    if issues:
        raise BackendConfigError(issues)

    artifacts = []
    for name, setting in ARTIFACT_SETTINGS:
        path = Path(source[setting])
        if not path.is_file():
            issues.append(
                ConfigIssue(
                    code="ARTIFACT_PATH_MISSING",
                    setting=setting,
                    message=f"Configured artifact path for {setting} does not exist.",
                )
            )
            continue

        artifacts.append(
            ArtifactConfig(
                name=name,
                path=path,
                full_hash=hashlib.sha256(path.read_bytes()).hexdigest(),
            )
        )

    app_data_dir = Path(source["PROVENTL_APP_DATA_DIR"])
    if not app_data_dir.is_dir():
        issues.append(
            ConfigIssue(
                code="APP_DATA_DIR_MISSING",
                setting="PROVENTL_APP_DATA_DIR",
                message=(
                    "Configured app data directory for PROVENTL_APP_DATA_DIR "
                    "does not exist."
                ),
            )
        )

    if issues:
        raise BackendConfigError(issues)

    return BackendConfig(
        artifacts=tuple(artifacts),
        app_data_dir=app_data_dir,
    )
