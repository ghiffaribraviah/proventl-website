"""Prediction engine and response-building modules."""

from proventl_api.embeddings import EmbeddingArtifacts
from proventl_api.model import KerasModelAdapter
from proventl_api.targets.registry import target_preview

HIGH_CONFIDENCE = "high confidence"
BELOW_THRESHOLD = "below threshold"


def build_prediction_response(
    *,
    targets: list[dict[str, str]],
    embeddings: EmbeddingArtifacts,
    model: KerasModelAdapter,
    target_uniprot_id: str,
    threshold: float,
) -> dict[str, object]:
    scores = predict_probability_array(
        embeddings=embeddings,
        model=model,
        target_uniprot_id=target_uniprot_id,
    )
    return build_prediction_response_from_probabilities(
        targets=targets,
        embeddings=embeddings,
        model=model,
        target_uniprot_id=target_uniprot_id,
        threshold=threshold,
        probabilities=scores,
    )


def predict_probability_array(
    *,
    embeddings: EmbeddingArtifacts,
    model: KerasModelAdapter,
    target_uniprot_id: str,
) -> tuple[float, ...]:
    normalized_target_id = target_uniprot_id.strip().upper()
    protein = embeddings.proteins.lookup(normalized_target_id)
    feature_rows = [
        (*peptide_features, *protein.features)
        for peptide_features in embeddings.peptides.features
    ]
    return model.predict_scores(feature_rows)


def build_prediction_response_from_probabilities(
    *,
    targets: list[dict[str, str]],
    embeddings: EmbeddingArtifacts,
    model: KerasModelAdapter,
    target_uniprot_id: str,
    threshold: float,
    probabilities: tuple[float, ...],
) -> dict[str, object]:
    normalized_target_id = target_uniprot_id.strip().upper()
    targets_by_id = {
        target["uniprot_id"].strip().upper(): target
        for target in targets
    }
    target = targets_by_id[normalized_target_id]
    if len(probabilities) != len(embeddings.peptides.metadata):
        raise ValueError("Probability count must match peptide row count.")

    rows = [
        {
            "rank": 0,
            "peptide_id": peptide.peptide_id,
            "sequence": peptide.sequence,
            "source_description": peptide.description,
            "classifier_score": probability,
            "classification": (
                HIGH_CONFIDENCE if probability >= threshold else BELOW_THRESHOLD
            ),
        }
        for peptide, probability in zip(
            embeddings.peptides.metadata,
            probabilities,
            strict=True,
        )
    ]
    rows.sort(key=lambda row: row["classifier_score"], reverse=True)
    for index, row in enumerate(rows, start=1):
        row["rank"] = index
    high_confidence_count = sum(
        1 for row in rows if row["classification"] == HIGH_CONFIDENCE
    )

    return {
        "target": target_preview(target),
        "threshold": threshold,
        "summary": {
            "total": len(rows),
            "high_confidence": high_confidence_count,
            "below_threshold": len(rows) - high_confidence_count,
        },
        "predictions": rows,
        "model": {
            "version": model.version,
            "hash": model.short_hash,
        },
        "data": {
            "peptide_embeddings_hash": embeddings.peptide_artifact.short_hash,
            "protein_embeddings_hash": embeddings.protein_artifact.short_hash,
        },
    }
