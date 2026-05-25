import { describe, expect, it } from "vitest";

import type { PredictionResponse } from "../../api/predictions";
import {
  applyThresholdToPredictionResponse,
  classifyScoreAtThreshold,
  DEFAULT_THRESHOLD,
  normalizeThreshold,
  parseUrlThreshold,
  thresholdInputValue,
} from "./thresholdInterpretation";

const response: PredictionResponse = {
  data: {
    peptideEmbeddingsHash: "pep",
    proteinEmbeddingsHash: "prot",
  },
  model: {
    hash: "model",
    version: "v1",
  },
  predictions: [
    {
      classification: "below threshold",
      classifierScore: 0.95,
      peptideId: "equal",
      rank: 1,
      sequence: "AAAA",
      sourceDescription: "source",
    },
    {
      classification: "high confidence",
      classifierScore: 0.94,
      peptideId: "below",
      rank: 2,
      sequence: "BBBB",
      sourceDescription: "source",
    },
  ],
  summary: {
    belowThreshold: 1,
    highConfidence: 1,
    total: 2,
  },
  target: {
    uniprotId: "P01133",
  },
  threshold: 0.9,
};

describe("threshold interpretation", () => {
  it("defines the V1 default threshold", () => {
    expect(DEFAULT_THRESHOLD).toBe(0.95);
  });

  it("clamps and rounds threshold inputs to 0.01 precision", () => {
    expect(normalizeThreshold(0.499)).toBe(0.5);
    expect(normalizeThreshold(1)).toBe(0.99);
    expect(normalizeThreshold(0.956)).toBe(0.96);
    expect(thresholdInputValue(0.9)).toBe("0.90");
  });

  it("falls back safely for invalid URL thresholds", () => {
    expect(parseUrlThreshold("not-a-number")).toBe(DEFAULT_THRESHOLD);
    expect(parseUrlThreshold(null)).toBe(DEFAULT_THRESHOLD);
  });

  it("counts equality with applied threshold as high confidence", () => {
    expect(classifyScoreAtThreshold(0.95, 0.95)).toBe("high confidence");
  });

  it("recomputes classifications and summary locally", () => {
    const interpreted = applyThresholdToPredictionResponse(response, 0.95);

    expect(interpreted.threshold).toBe(0.95);
    expect(interpreted.summary).toEqual({
      belowThreshold: 1,
      highConfidence: 1,
      total: 2,
    });
    expect(interpreted.predictions.map((row) => row.classification)).toEqual([
      "high confidence",
      "below threshold",
    ]);
  });
});
