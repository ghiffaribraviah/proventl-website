import os
from datetime import UTC, datetime
from json import JSONDecodeError

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from proventl_api.cache import PredictionResultCache, cache_database_path
from proventl_api.core.config import (
    ArtifactConfig,
    BackendConfig,
    BackendConfigError,
    load_backend_config,
)
from proventl_api.embeddings import (
    EmbeddingArtifacts,
    EmbeddingValidationError,
    load_embedding_artifacts,
)
from proventl_api.model import (
    KerasModelAdapter,
    ModelValidationError,
    load_model_artifact,
)
from proventl_api.predictions import (
    build_prediction_response_from_probabilities,
    predict_probability_array,
)
from proventl_api.targets.registry import (
    UNIPROT_ACCESSION_PATTERN,
    generate_configured_curated_target_registry,
)

router = APIRouter(prefix="/api", tags=["predictions"])
DEFAULT_BATCH_MAX_TARGETS = 50


@router.post("/predictions")
async def run_prediction(request: Request) -> JSONResponse:
    prediction_request, validation_response = await _parse_prediction_request(request)
    if validation_response is not None:
        return validation_response
    target_uniprot_id, threshold = prediction_request

    try:
        config = load_backend_config()
    except BackendConfigError as error:
        return JSONResponse(
            status_code=503,
            content={
                "state": "not-ready",
                "error": {
                    "code": "BACKEND_NOT_READY",
                    "message": "Prediction backend is not ready.",
                    "details": [
                        {
                            "code": issue.code,
                            "setting": issue.setting,
                            "message": issue.message,
                        }
                        for issue in error.issues
                    ],
                },
            },
        )

    if threshold < 0.50 or threshold > 0.99:
        return _invalid_threshold_response()
    if not UNIPROT_ACCESSION_PATTERN.fullmatch(target_uniprot_id):
        return JSONResponse(
            status_code=400,
            content={
                "state": "invalid-request",
                "normalized_target_uniprot_id": target_uniprot_id,
                "error": {
                    "code": "INVALID_ACCESSION",
                    "field": "target_uniprot_id",
                    "message": "Enter a valid UniProt accession.",
                },
            },
        )

    artifact_by_name = {artifact.name: artifact for artifact in config.artifacts}
    registry = generate_configured_curated_target_registry(
        config=config,
        generated_at=datetime.now(UTC),
    )
    if target_uniprot_id not in {
        target["uniprot_id"].strip().upper()
        for target in registry.targets
    }:
        return JSONResponse(
            status_code=404,
            content={
                "state": "unsupported-target",
                "normalized_target_uniprot_id": target_uniprot_id,
                "error": {
                    "code": "UNSUPPORTED_TARGET",
                    "field": "target_uniprot_id",
                    "message": "Target is not available for prediction.",
                },
            },
        )

    try:
        embeddings = load_embedding_artifacts(
            peptide_artifact=artifact_by_name["peptide_embeddings"],
            protein_artifact=artifact_by_name["protein_embeddings"],
        )
    except EmbeddingValidationError as error:
        return JSONResponse(
            status_code=503,
            content={
                "state": "artifacts-unavailable",
                "error": {
                    "code": "EMBEDDINGS_UNAVAILABLE",
                    "message": "Prediction embeddings are unavailable.",
                    "details": error.issues,
                },
            },
        )
    try:
        model = load_model_artifact(
            model_artifact=artifact_by_name["model"],
            model_loader=request.app.state.model_loader,
        )
    except ModelValidationError as error:
        return JSONResponse(
            status_code=503,
            content={
                "state": "model-unavailable",
                "error": {
                    "code": "MODEL_UNAVAILABLE",
                    "message": "Prediction model is unavailable.",
                    "details": error.issues,
                },
            },
        )

    try:
        probabilities = _cached_or_inferred_probabilities(
            config=config,
            artifact_by_name=artifact_by_name,
            embeddings=embeddings,
            model=model,
            target_uniprot_id=target_uniprot_id,
        )
        content = build_prediction_response_from_probabilities(
            targets=registry.targets,
            embeddings=embeddings,
            model=model,
            target_uniprot_id=target_uniprot_id,
            threshold=threshold,
            probabilities=probabilities,
        )
    except KeyError:
        return JSONResponse(
            status_code=500,
            content={
                "state": "missing-target-embedding",
                "normalized_target_uniprot_id": target_uniprot_id,
                "error": {
                    "code": "MISSING_TARGET_EMBEDDING",
                    "field": "target_uniprot_id",
                    "message": (
                        "Target is missing the embedding required for prediction."
                    ),
                },
            },
        )
    except (ModelValidationError, RuntimeError):
        return JSONResponse(
            status_code=500,
            content={
                "state": "prediction-failed",
                "error": {
                    "code": "PREDICTION_FAILED",
                    "message": "Prediction could not be completed.",
                },
            },
        )

    return JSONResponse(
        status_code=200,
        content=content,
    )


@router.post("/predictions/batch")
async def run_batch_prediction(request: Request) -> JSONResponse:
    prediction_request, validation_response = await _parse_batch_prediction_request(
        request
    )
    if validation_response is not None:
        return validation_response
    target_entries, threshold = prediction_request
    submitted_count = len(target_entries)
    target_entries = _deduplicate_batch_entries(target_entries)
    deduped_count = submitted_count - len(target_entries)
    cap = _batch_max_targets()
    if len(target_entries) > cap:
        return JSONResponse(
            status_code=400,
            content={
                "state": "invalid-request",
                "error": {
                    "code": "BATCH_TOO_LARGE",
                    "field": "target_uniprot_ids",
                    "message": (
                        f"Batch contains {len(target_entries)} deduplicated "
                        f"targets, exceeding the cap of {cap}."
                    ),
                    "cap": cap,
                    "submitted": len(target_entries),
                },
            },
        )
    if threshold < 0.50 or threshold > 0.99:
        return _invalid_threshold_response()

    try:
        config = load_backend_config()
    except BackendConfigError as error:
        return JSONResponse(
            status_code=503,
            content={
                "state": "not-ready",
                "error": {
                    "code": "BACKEND_NOT_READY",
                    "message": "Prediction backend is not ready.",
                    "details": [
                        {
                            "code": issue.code,
                            "setting": issue.setting,
                            "message": issue.message,
                        }
                        for issue in error.issues
                    ],
                },
            },
        )

    artifact_by_name = {artifact.name: artifact for artifact in config.artifacts}
    registry = generate_configured_curated_target_registry(
        config=config,
        generated_at=datetime.now(UTC),
    )
    registry_ids = {
        target["uniprot_id"].strip().upper()
        for target in registry.targets
    }

    try:
        embeddings = load_embedding_artifacts(
            peptide_artifact=artifact_by_name["peptide_embeddings"],
            protein_artifact=artifact_by_name["protein_embeddings"],
        )
    except EmbeddingValidationError as error:
        return JSONResponse(
            status_code=503,
            content={
                "state": "artifacts-unavailable",
                "error": {
                    "code": "EMBEDDINGS_UNAVAILABLE",
                    "message": "Prediction embeddings are unavailable.",
                    "details": error.issues,
                },
            },
        )
    try:
        model = load_model_artifact(
            model_artifact=artifact_by_name["model"],
            model_loader=request.app.state.model_loader,
        )
    except ModelValidationError as error:
        return JSONResponse(
            status_code=503,
            content={
                "state": "model-unavailable",
                "error": {
                    "code": "MODEL_UNAVAILABLE",
                    "message": "Prediction model is unavailable.",
                    "details": error.issues,
                },
            },
        )

    results = []
    rejected = []
    for target_entry in target_entries:
        target_uniprot_id = target_entry["normalized_target_uniprot_id"]
        if not UNIPROT_ACCESSION_PATTERN.fullmatch(target_uniprot_id):
            rejected.append(
                _batch_rejection(
                    target_entry,
                    code="INVALID_ACCESSION",
                    message="Enter a valid UniProt accession.",
                )
            )
            continue
        if target_uniprot_id not in registry_ids:
            rejected.append(
                _batch_rejection(
                    target_entry,
                    code="UNSUPPORTED_TARGET",
                    message="Target is not available for prediction.",
                )
            )
            continue
        try:
            probabilities = _cached_or_inferred_probabilities(
                config=config,
                artifact_by_name=artifact_by_name,
                embeddings=embeddings,
                model=model,
                target_uniprot_id=target_uniprot_id,
            )
            results.append(
                build_prediction_response_from_probabilities(
                    targets=registry.targets,
                    embeddings=embeddings,
                    model=model,
                    target_uniprot_id=target_uniprot_id,
                    threshold=threshold,
                    probabilities=probabilities,
                )
            )
        except KeyError:
            rejected.append(
                _batch_rejection(
                    target_entry,
                    code="MISSING_TARGET_EMBEDDING",
                    message=(
                        "Target is missing the embedding required for prediction."
                    ),
                )
            )
        except (ModelValidationError, RuntimeError, ValueError):
            return JSONResponse(
                status_code=500,
                content={
                    "state": "prediction-failed",
                    "error": {
                        "code": "PREDICTION_FAILED",
                        "message": "Prediction could not be completed.",
                    },
                },
            )

    return JSONResponse(
        status_code=200,
        content={
            "threshold": threshold,
            "cap": cap,
            "summary": {
                "submitted": submitted_count,
                "deduped": deduped_count,
                "succeeded": len(results),
                "rejected": len(rejected),
            },
            "results": results,
            "rejected": rejected,
            "model": {
                "version": model.version,
                "hash": model.short_hash,
            },
            "data": {
                "peptide_embeddings_hash": embeddings.peptide_artifact.short_hash,
                "protein_embeddings_hash": embeddings.protein_artifact.short_hash,
            },
        },
    )


def _cached_or_inferred_probabilities(
    *,
    config: BackendConfig,
    artifact_by_name: dict[str, ArtifactConfig],
    embeddings: EmbeddingArtifacts,
    model: KerasModelAdapter,
    target_uniprot_id: str,
) -> tuple[float, ...]:
    prediction_cache = PredictionResultCache(cache_database_path(config.app_data_dir))
    prediction_cache.migrate()
    cache_key = {
        "target_uniprot_id": target_uniprot_id,
        "model_hash": artifact_by_name["model"].full_hash,
        "peptide_embeddings_hash": artifact_by_name["peptide_embeddings"].full_hash,
        "protein_embeddings_hash": artifact_by_name["protein_embeddings"].full_hash,
    }
    cached_entry = prediction_cache.get(**cache_key)
    if cached_entry is not None and len(cached_entry.probabilities) == len(
        embeddings.peptides.metadata
    ):
        return cached_entry.probabilities

    probabilities = predict_probability_array(
        embeddings=embeddings,
        model=model,
        target_uniprot_id=target_uniprot_id,
    )
    prediction_cache.upsert(
        **cache_key,
        probabilities=probabilities,
        created_at=datetime.now(UTC),
    )
    return probabilities


def _deduplicate_batch_entries(
    entries: list[dict[str, str]],
) -> list[dict[str, str]]:
    seen = set()
    deduplicated = []
    for entry in entries:
        normalized_target_id = entry["normalized_target_uniprot_id"]
        if normalized_target_id in seen:
            continue
        seen.add(normalized_target_id)
        deduplicated.append(entry)
    return deduplicated


def _batch_rejection(
    target_entry: dict[str, str],
    *,
    code: str,
    message: str,
) -> dict[str, str]:
    return {
        "input": target_entry["input"],
        "normalized_target_uniprot_id": target_entry["normalized_target_uniprot_id"],
        "code": code,
        "message": message,
    }


def _invalid_threshold_response() -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "state": "invalid-request",
            "error": {
                "code": "INVALID_THRESHOLD",
                "field": "threshold",
                "message": "Threshold must be between 0.50 and 0.99.",
            },
        },
    )


async def _parse_prediction_request(
    request: Request,
) -> tuple[tuple[str, float] | None, JSONResponse | None]:
    try:
        payload = await request.json()
    except JSONDecodeError:
        return None, _validation_error(
            [
                {
                    "code": "MALFORMED_JSON",
                    "message": "Request body must be valid JSON.",
                }
            ]
        )

    if not isinstance(payload, dict):
        return None, _validation_error(
            [
                {
                    "code": "INVALID_BODY",
                    "message": "Prediction request body must be a JSON object.",
                }
            ]
        )

    missing_field_issues = [
        {
            "code": "MISSING_FIELD",
            "field": field,
            "message": f"{field} is required.",
        }
        for field in ("target_uniprot_id", "threshold")
        if field not in payload
    ]
    if missing_field_issues:
        return None, _validation_error(missing_field_issues)

    target_uniprot_id = str(payload["target_uniprot_id"]).strip().upper()
    try:
        threshold = float(payload["threshold"])
    except (TypeError, ValueError):
        return None, _validation_error(
            [
                {
                    "code": "INVALID_FIELD",
                    "field": "threshold",
                    "message": "threshold must be a number.",
                }
            ]
        )

    return (target_uniprot_id, threshold), None


async def _parse_batch_prediction_request(
    request: Request,
) -> tuple[tuple[list[dict[str, str]], float] | None, JSONResponse | None]:
    try:
        payload = await request.json()
    except JSONDecodeError:
        return None, _validation_error(
            [
                {
                    "code": "MALFORMED_JSON",
                    "message": "Request body must be valid JSON.",
                }
            ]
        )

    if not isinstance(payload, dict):
        return None, _validation_error(
            [
                {
                    "code": "INVALID_BODY",
                    "message": "Prediction request body must be a JSON object.",
                }
            ]
        )

    missing_field_issues = [
        {
            "code": "MISSING_FIELD",
            "field": field,
            "message": f"{field} is required.",
        }
        for field in ("target_uniprot_ids", "threshold")
        if field not in payload
    ]
    if missing_field_issues:
        return None, _validation_error(missing_field_issues)

    raw_target_ids = payload["target_uniprot_ids"]
    if not isinstance(raw_target_ids, list) or not raw_target_ids:
        return None, _validation_error(
            [
                {
                    "code": "VALIDATION_ERROR",
                    "field": "target_uniprot_ids",
                    "message": "target_uniprot_ids must be a non-empty array.",
                }
            ]
        )

    target_entries = [
        {
            "input": str(target_id),
            "normalized_target_uniprot_id": str(target_id).strip().upper(),
        }
        for target_id in raw_target_ids
    ]
    try:
        threshold = float(payload["threshold"])
    except (TypeError, ValueError):
        return None, _validation_error(
            [
                {
                    "code": "INVALID_FIELD",
                    "field": "threshold",
                    "message": "threshold must be a number.",
                }
            ]
        )

    return (target_entries, threshold), None


def _batch_max_targets() -> int:
    try:
        parsed = int(os.environ.get("PROVENTL_BATCH_MAX_TARGETS", ""))
    except ValueError:
        return DEFAULT_BATCH_MAX_TARGETS
    if parsed <= 0:
        return DEFAULT_BATCH_MAX_TARGETS
    return parsed


def _validation_error(details: list[dict[str, object]]) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "state": "invalid-request",
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Prediction request is invalid.",
                "details": details,
            },
        },
    )
