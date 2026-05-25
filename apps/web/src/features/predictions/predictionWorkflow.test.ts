import { describe, expect, it } from "vitest";

import type { PredictionResponse } from "../../api/predictions";
import type { TargetPreview } from "../../api/targets";
import {
  acceptPredictionFailure,
  acceptPredictionSuccess,
  canRetryPrediction,
  clearPredictionResults,
  initialPredictionWorkflowState,
  startPrediction,
} from "./predictionWorkflow";

const target: TargetPreview = {
  gene: "EGFR",
  uniprotId: "P01133",
};

const result: PredictionResponse = {
  data: {
    peptideEmbeddingsHash: "pep",
    proteinEmbeddingsHash: "prot",
  },
  model: {
    hash: "abc123",
    version: "test",
  },
  predictions: [],
  summary: {
    belowThreshold: 0,
    highConfidence: 0,
    total: 0,
  },
  target,
  threshold: 0.95,
};

describe("prediction workflow model", () => {
  it("starts only from an explicit trigger and clears previous results", () => {
    const state = startPrediction(target, 1);

    expect(state).toMatchObject({
      activeRequestId: 1,
      result: null,
      status: "loading",
      targetUniprotId: "P01133",
    });
  });

  it("accepts success for the active request", () => {
    const loading = startPrediction(target, 1);
    const success = acceptPredictionSuccess(loading, {
      requestId: 1,
      result,
      targetUniprotId: "P01133",
    });

    expect(success.status).toBe("success");
    expect(success.result).toEqual(result);
  });

  it("suppresses stale responses with a mismatched request id or target", () => {
    const loading = startPrediction(target, 2);

    expect(
      acceptPredictionSuccess(loading, {
        requestId: 1,
        result,
        targetUniprotId: "P01133",
      }),
    ).toEqual(loading);
    expect(
      acceptPredictionSuccess(loading, {
        requestId: 2,
        result,
        targetUniprotId: "P00749",
      }),
    ).toEqual(loading);
  });

  it("preserves target context and exposes retry after active request failure", () => {
    const loading = startPrediction(target, 3);
    const failed = acceptPredictionFailure(loading, {
      error: "Prediction model is unavailable.",
      requestId: 3,
      targetUniprotId: "P01133",
    });

    expect(failed).toMatchObject({
      error: "Prediction model is unavailable.",
      status: "error",
      targetUniprotId: "P01133",
    });
    expect(canRetryPrediction(failed)).toBe(true);
  });

  it("clears results when target changes", () => {
    expect(clearPredictionResults()).toEqual(initialPredictionWorkflowState);
  });
});
