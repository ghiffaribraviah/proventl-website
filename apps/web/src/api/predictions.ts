import { normalizeTargetPreview, type TargetFetch, type TargetPreview } from "./targets";

export const DEFAULT_APPLIED_THRESHOLD = 0.95;
export const DEFAULT_BATCH_MAX_TARGETS = 50;

export type BatchRejectedCode =
  | "INVALID_ACCESSION"
  | "MISSING_TARGET_EMBEDDING"
  | "UNSUPPORTED_TARGET";

export type BatchRejectedEntry = {
  code: BatchRejectedCode;
  input: string;
  message: string;
  normalizedTargetUniprotId: string;
};

export type BatchSummary = {
  deduped: number;
  rejected: number;
  submitted: number;
  succeeded: number;
};

export type BatchPredictionResponse = {
  cap: number;
  data: {
    peptideEmbeddingsHash: string;
    proteinEmbeddingsHash: string;
  };
  model: {
    hash: string;
    version: string;
  };
  rejected: BatchRejectedEntry[];
  results: PredictionResponse[];
  summary: BatchSummary;
  threshold: number;
};

export type PredictionRow = {
  classification: string;
  classifierScore: number;
  peptideId: string;
  rank: number;
  sequence: string;
  sourceDescription: string;
};

export type PredictionResponse = {
  data: {
    peptideEmbeddingsHash: string;
    proteinEmbeddingsHash: string;
  };
  model: {
    hash: string;
    version: string;
  };
  predictions: PredictionRow[];
  summary: {
    belowThreshold: number;
    highConfidence: number;
    total: number;
  };
  target: TargetPreview;
  threshold: number;
};

type BackendPredictionResponse = {
  data: {
    peptide_embeddings_hash: string;
    protein_embeddings_hash: string;
  };
  model: {
    hash: string;
    version: string;
  };
  predictions: Array<{
    classification: string;
    classifier_score: number;
    peptide_id: string;
    rank: number;
    sequence: string;
    source_description: string;
  }>;
  summary: {
    below_threshold: number;
    high_confidence: number;
    total: number;
  };
  target: Parameters<typeof normalizeTargetPreview>[0];
  threshold: number;
};

type BackendBatchPredictionResponse = {
  cap: number;
  data: {
    peptide_embeddings_hash: string;
    protein_embeddings_hash: string;
  };
  model: {
    hash: string;
    version: string;
  };
  rejected: Array<{
    code: BatchRejectedCode;
    input: string;
    message: string;
    normalized_target_uniprot_id: string;
  }>;
  results: BackendPredictionResponse[];
  summary: {
    deduped: number;
    rejected: number;
    submitted: number;
    succeeded: number;
  };
  threshold: number;
};

type BackendPredictionError = {
  error?: {
    code?: string;
    message?: string;
  };
  state?: string;
};

export class PredictionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly state: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "PredictionApiError";
  }
}

export async function runPrediction(
  request: { targetUniprotId: string; threshold: number },
  fetcher: TargetFetch = fetch,
  signal?: AbortSignal,
): Promise<PredictionResponse> {
  const response = await fetcher("/api/predictions", {
    body: JSON.stringify({
      target_uniprot_id: request.targetUniprotId,
      threshold: request.threshold,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
  const payload = (await response.json()) as
    | BackendPredictionError
    | BackendPredictionResponse;

  if (!response.ok) {
    const errorPayload = payload as BackendPredictionError;
    throw new PredictionApiError(
      predictionErrorMessage(errorPayload),
      response.status,
      errorPayload.state ?? "prediction-failed",
      errorPayload.error?.code ?? null,
    );
  }

  return normalizePredictionResponse(payload as BackendPredictionResponse);
}

export function normalizePredictionResponse(
  payload: BackendPredictionResponse,
): PredictionResponse {
  return {
    data: {
      peptideEmbeddingsHash: payload.data.peptide_embeddings_hash,
      proteinEmbeddingsHash: payload.data.protein_embeddings_hash,
    },
    model: payload.model,
    predictions: payload.predictions.map((row) => ({
      classification: row.classification,
      classifierScore: row.classifier_score,
      peptideId: row.peptide_id,
      rank: row.rank,
      sequence: row.sequence,
      sourceDescription: row.source_description,
    })),
    summary: {
      belowThreshold: payload.summary.below_threshold,
      highConfidence: payload.summary.high_confidence,
      total: payload.summary.total,
    },
    target: normalizeTargetPreview(payload.target),
    threshold: payload.threshold,
  };
}

export function predictionErrorMessage(payload: BackendPredictionError): string {
  switch (payload.state) {
    case "not-ready":
      return "Prediction backend is not ready. Check model and data configuration.";
    case "unsupported-target":
      return "Target is not available for prediction.";
    case "artifacts-unavailable":
      return "Prediction embeddings are unavailable.";
    case "model-unavailable":
      return "Prediction model is unavailable.";
    case "missing-target-embedding":
      return "Target is missing the embedding required for prediction.";
    case "rate-limited":
      return "Too many prediction requests. Please wait before retrying.";
    case "invalid-request":
    case "prediction-failed":
      return (
        payload.error?.message ??
        "Prediction could not be completed. Please try again."
      );
    default:
      return (
        payload.error?.message ??
        "Prediction could not be completed. Please try again."
      );
  }
}

export async function runBatchPrediction(
  request: { targetUniprotIds: string[]; threshold: number },
  fetcher: TargetFetch = fetch,
  signal?: AbortSignal,
): Promise<BatchPredictionResponse> {
  const response = await fetcher("/api/predictions/batch", {
    body: JSON.stringify({
      target_uniprot_ids: request.targetUniprotIds,
      threshold: request.threshold,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
  const payload = (await response.json()) as
    | BackendPredictionError
    | BackendBatchPredictionResponse;

  if (!response.ok) {
    const errorPayload = payload as BackendPredictionError;
    throw new PredictionApiError(
      batchErrorMessage(errorPayload),
      response.status,
      errorPayload.state ?? "prediction-failed",
      errorPayload.error?.code ?? null,
    );
  }

  return normalizeBatchPredictionResponse(
    payload as BackendBatchPredictionResponse,
  );
}

export function normalizeBatchPredictionResponse(
  payload: BackendBatchPredictionResponse,
): BatchPredictionResponse {
  return {
    cap: payload.cap,
    data: {
      peptideEmbeddingsHash: payload.data.peptide_embeddings_hash,
      proteinEmbeddingsHash: payload.data.protein_embeddings_hash,
    },
    model: payload.model,
    rejected: payload.rejected.map((entry) => ({
      code: entry.code,
      input: entry.input,
      message: entry.message,
      normalizedTargetUniprotId: entry.normalized_target_uniprot_id,
    })),
    results: payload.results.map(normalizePredictionResponse),
    summary: {
      deduped: payload.summary.deduped,
      rejected: payload.summary.rejected,
      submitted: payload.summary.submitted,
      succeeded: payload.summary.succeeded,
    },
    threshold: payload.threshold,
  };
}

export function batchErrorMessage(payload: BackendPredictionError): string {
  if (
    payload.error?.code === "BATCH_TOO_LARGE" &&
    payload.error?.message
  ) {
    return payload.error.message;
  }

  switch (payload.state) {
    case "not-ready":
      return "Batch prediction backend is not ready. Check model and data configuration.";
    case "artifacts-unavailable":
      return "Batch prediction embeddings are unavailable.";
    case "model-unavailable":
      return "Batch prediction model is unavailable.";
    case "rate-limited":
      return "Too many batch prediction requests. Please wait before retrying.";
    case "invalid-request":
    case "prediction-failed":
      return (
        payload.error?.message ??
        "Batch prediction could not be completed. Please try again."
      );
    default:
      return (
        payload.error?.message ??
        "Batch prediction could not be completed. Please try again."
      );
  }
}
