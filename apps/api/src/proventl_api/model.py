from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Sequence

from proventl_api.core.config import ArtifactConfig

MODEL_INPUT_WIDTH = 2048
MODEL_OUTPUT_WIDTH = 1


class ModelValidationError(Exception):
    def __init__(self, issues: list[dict[str, object]]) -> None:
        super().__init__("Model artifact validation failed.")
        self.issues = issues


@dataclass(frozen=True)
class KerasModelAdapter:
    model: object
    artifact: ArtifactConfig

    @property
    def version(self) -> str:
        return self.artifact.path.stem

    @property
    def short_hash(self) -> str:
        return self.artifact.short_hash

    def predict_scores(self, rows: Sequence[Sequence[float]]) -> tuple[float, ...]:
        _validate_prediction_rows(rows)
        predictions = self.model.predict(_prediction_input(rows), verbose=0)
        return _normalize_prediction_scores(predictions, expected_count=len(rows))


def load_model_artifact(
    *,
    model_artifact: ArtifactConfig,
    model_loader: Callable[[Path], object] | None = None,
) -> KerasModelAdapter:
    loader = model_loader or _load_keras_model
    model = loader(model_artifact.path)
    _validate_model_shape(model)
    return KerasModelAdapter(model=model, artifact=model_artifact)


def _load_keras_model(path: Path) -> object:
    from tensorflow.keras.models import load_model

    return load_model(path, compile=False)


def _validate_model_shape(model: object) -> None:
    input_width = _last_shape_dimension(getattr(model, "input_shape", None))
    if input_width != MODEL_INPUT_WIDTH:
        raise ModelValidationError(
            [
                {
                    "code": "MODEL_INPUT_WIDTH_MISMATCH",
                    "expected": MODEL_INPUT_WIDTH,
                    "actual": input_width,
                    "message": (
                        f"Keras model input width must be {MODEL_INPUT_WIDTH}."
                    ),
                }
            ]
        )

    output_width = _last_shape_dimension(getattr(model, "output_shape", None))
    if output_width != MODEL_OUTPUT_WIDTH:
        raise ModelValidationError(
            [
                {
                    "code": "MODEL_OUTPUT_WIDTH_MISMATCH",
                    "expected": MODEL_OUTPUT_WIDTH,
                    "actual": output_width,
                    "message": (
                        "Keras model output must contain one classifier score "
                        "per input row."
                    ),
                }
            ]
        )


def _last_shape_dimension(shape: object) -> int | None:
    if not isinstance(shape, tuple):
        return None
    if not shape:
        return None
    value = shape[-1]
    return value if isinstance(value, int) else None


def _normalize_prediction_scores(
    predictions: object,
    *,
    expected_count: int,
) -> tuple[float, ...]:
    if hasattr(predictions, "tolist"):
        predictions = predictions.tolist()

    scores = []
    for prediction in predictions:
        if isinstance(prediction, list):
            if len(prediction) != MODEL_OUTPUT_WIDTH:
                raise ModelValidationError(
                    [
                        {
                            "code": "MODEL_OUTPUT_WIDTH_MISMATCH",
                            "expected": MODEL_OUTPUT_WIDTH,
                            "actual": len(prediction),
                            "message": (
                                "Keras model prediction output must contain one "
                                "classifier score per input row."
                            ),
                        }
                    ]
                )
            prediction = prediction[0]
        scores.append(float(prediction))

    if len(scores) != expected_count:
        raise ModelValidationError(
            [
                {
                    "code": "MODEL_OUTPUT_LENGTH_MISMATCH",
                    "expected": expected_count,
                    "actual": len(scores),
                    "message": (
                        "Keras model prediction output must contain one score "
                        "per input row."
                    ),
                }
            ]
        )
    return tuple(scores)


def _validate_prediction_rows(rows: Sequence[Sequence[float]]) -> None:
    for index, row in enumerate(rows):
        actual_width = len(row)
        if actual_width != MODEL_INPUT_WIDTH:
            raise ModelValidationError(
                [
                    {
                        "code": "MODEL_INPUT_WIDTH_MISMATCH",
                        "expected": MODEL_INPUT_WIDTH,
                        "actual": actual_width,
                        "row_index": index,
                        "message": (
                            f"Prediction input row {index} must contain "
                            f"{MODEL_INPUT_WIDTH} features."
                        ),
                    }
                ]
            )


def _prediction_input(rows: Sequence[Sequence[float]]) -> object:
    try:
        import numpy as np
    except ImportError:
        return rows

    return np.asarray(rows, dtype="float32")
