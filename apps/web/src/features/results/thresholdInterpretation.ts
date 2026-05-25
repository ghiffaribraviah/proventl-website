import type { PredictionResponse, PredictionRow } from "../../api/predictions";

export const DEFAULT_THRESHOLD = 0.95;
export const MIN_THRESHOLD = 0.5;
export const MAX_THRESHOLD = 0.99;
export const THRESHOLD_STEP = 0.01;

export function normalizeThreshold(value: string | number): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_THRESHOLD;
  }

  const clamped = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, numericValue));
  return Math.round(clamped * 100) / 100;
}

export function thresholdInputValue(value: number): string {
  return normalizeThreshold(value).toFixed(2);
}

export function parseUrlThreshold(value: string | null): number {
  if (value === null) {
    return DEFAULT_THRESHOLD;
  }

  return normalizeThreshold(value);
}

export function classifyScoreAtThreshold(
  score: number,
  threshold: number,
): "below threshold" | "high confidence" {
  return score >= threshold ? "high confidence" : "below threshold";
}

export function applyThresholdToPredictionResponse(
  response: PredictionResponse,
  threshold: number,
): PredictionResponse {
  const appliedThreshold = normalizeThreshold(threshold);
  const predictions = response.predictions.map((row) =>
    applyThresholdToRow(row, appliedThreshold),
  );
  const highConfidence = predictions.filter(
    (row) => row.classification === "high confidence",
  ).length;

  return {
    ...response,
    predictions,
    summary: {
      belowThreshold: predictions.length - highConfidence,
      highConfidence,
      total: predictions.length,
    },
    threshold: appliedThreshold,
  };
}

function applyThresholdToRow(
  row: PredictionRow,
  threshold: number,
): PredictionRow {
  return {
    ...row,
    classification: classifyScoreAtThreshold(row.classifierScore, threshold),
  };
}
