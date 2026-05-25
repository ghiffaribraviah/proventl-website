import hashlib
from pathlib import Path

import pytest

from proventl_api.core.config import ArtifactConfig
from proventl_api.model import ModelValidationError, load_model_artifact


def test_valid_model_artifact_loads_and_predicts_one_score_per_input_row(tmp_path):
    model_path = tmp_path / "best_model_auc_0.8748.h5"
    model_path.write_bytes(b"model artifact")
    fake_model = FakeKerasModel(
        input_shape=(None, 2048),
        output_shape=(None, 1),
        predictions=[[0.25], [0.75]],
    )
    loaded_paths = []

    adapter = load_model_artifact(
        model_artifact=_artifact_from_path("model", model_path),
        model_loader=lambda path: _record_load(path, loaded_paths, fake_model),
    )

    assert loaded_paths == [model_path]
    assert adapter.version == "best_model_auc_0.8748"
    assert adapter.short_hash == hashlib.sha256(b"model artifact").hexdigest()[:8]
    assert adapter.predict_scores([[0.0] * 2048, [1.0] * 2048]) == (0.25, 0.75)


def test_model_artifact_with_wrong_input_width_fails_validation(tmp_path):
    model_path = tmp_path / "wrong-input.h5"
    model_path.write_bytes(b"model artifact")
    fake_model = FakeKerasModel(
        input_shape=(None, 1024),
        output_shape=(None, 1),
        predictions=[[0.25]],
    )

    with pytest.raises(ModelValidationError) as error:
        load_model_artifact(
            model_artifact=_artifact_from_path("model", model_path),
            model_loader=lambda path: fake_model,
        )

    assert error.value.issues == [
        {
            "code": "MODEL_INPUT_WIDTH_MISMATCH",
            "expected": 2048,
            "actual": 1024,
            "message": "Keras model input width must be 2048.",
        }
    ]


def test_model_artifact_with_multiple_output_scores_fails_validation(tmp_path):
    model_path = tmp_path / "wrong-output.h5"
    model_path.write_bytes(b"model artifact")
    fake_model = FakeKerasModel(
        input_shape=(None, 2048),
        output_shape=(None, 2),
        predictions=[[0.25, 0.75]],
    )

    with pytest.raises(ModelValidationError) as error:
        load_model_artifact(
            model_artifact=_artifact_from_path("model", model_path),
            model_loader=lambda path: fake_model,
        )

    assert error.value.issues == [
        {
            "code": "MODEL_OUTPUT_WIDTH_MISMATCH",
            "expected": 1,
            "actual": 2,
            "message": (
                "Keras model output must contain one classifier score "
                "per input row."
            ),
        }
    ]


def test_prediction_output_length_mismatch_fails_validation(tmp_path):
    model_path = tmp_path / "best_model_auc_0.8748.h5"
    model_path.write_bytes(b"model artifact")
    fake_model = FakeKerasModel(
        input_shape=(None, 2048),
        output_shape=(None, 1),
        predictions=[[0.25]],
    )
    adapter = load_model_artifact(
        model_artifact=_artifact_from_path("model", model_path),
        model_loader=lambda path: fake_model,
    )

    with pytest.raises(ModelValidationError) as error:
        adapter.predict_scores([[0.0] * 2048, [1.0] * 2048])

    assert error.value.issues == [
        {
            "code": "MODEL_OUTPUT_LENGTH_MISMATCH",
            "expected": 2,
            "actual": 1,
            "message": (
                "Keras model prediction output must contain one score "
                "per input row."
            ),
        }
    ]


def test_prediction_with_multiple_scores_per_row_fails_validation(tmp_path):
    model_path = tmp_path / "best_model_auc_0.8748.h5"
    model_path.write_bytes(b"model artifact")
    fake_model = FakeKerasModel(
        input_shape=(None, 2048),
        output_shape=(None, 1),
        predictions=[[0.25, 0.75]],
    )
    adapter = load_model_artifact(
        model_artifact=_artifact_from_path("model", model_path),
        model_loader=lambda path: fake_model,
    )

    with pytest.raises(ModelValidationError) as error:
        adapter.predict_scores([[0.0] * 2048])

    assert error.value.issues == [
        {
            "code": "MODEL_OUTPUT_WIDTH_MISMATCH",
            "expected": 1,
            "actual": 2,
            "message": (
                "Keras model prediction output must contain one classifier score "
                "per input row."
            ),
        }
    ]


def test_prediction_with_wrong_input_row_width_fails_validation(tmp_path):
    model_path = tmp_path / "best_model_auc_0.8748.h5"
    model_path.write_bytes(b"model artifact")
    fake_model = FakeKerasModel(
        input_shape=(None, 2048),
        output_shape=(None, 1),
        predictions=[[0.25]],
    )
    adapter = load_model_artifact(
        model_artifact=_artifact_from_path("model", model_path),
        model_loader=lambda path: fake_model,
    )

    with pytest.raises(ModelValidationError) as error:
        adapter.predict_scores([[0.0] * 2047])

    assert error.value.issues == [
        {
            "code": "MODEL_INPUT_WIDTH_MISMATCH",
            "expected": 2048,
            "actual": 2047,
            "row_index": 0,
            "message": "Prediction input row 0 must contain 2048 features.",
        }
    ]


def test_shipped_tensorflow_model_loads_and_predicts_dummy_score():
    pytest.importorskip("tensorflow")
    repo_root = Path(__file__).resolve().parents[3]
    model_path = repo_root / "model/best_model_auc_0.8748.h5"

    adapter = load_model_artifact(
        model_artifact=_artifact_from_path("model", model_path),
    )
    scores = adapter.predict_scores([[0.0] * 2048])

    assert len(scores) == 1
    assert 0.0 <= scores[0] <= 1.0


class FakeKerasModel:
    def __init__(self, *, input_shape, output_shape, predictions):
        self.input_shape = input_shape
        self.output_shape = output_shape
        self.predictions = predictions

    def predict(self, rows, verbose=0):
        self.rows = rows
        self.verbose = verbose
        return self.predictions


def _artifact_from_path(name, path) -> ArtifactConfig:
    return ArtifactConfig(
        name=name,
        path=path,
        full_hash=hashlib.sha256(path.read_bytes()).hexdigest(),
    )


def _record_load(path, loaded_paths, model):
    loaded_paths.append(path)
    return model
