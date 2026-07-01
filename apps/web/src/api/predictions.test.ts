import { describe, expect, it, vi } from "vitest";

import {
  batchErrorMessage,
  predictionErrorMessage,
  runBatchPrediction,
  runPrediction,
} from "./predictions";
import type { TargetFetch } from "./targets";

describe("prediction API client", () => {
  it("posts selected target and threshold to the backend", async () => {
    const fetcher = jsonFetcher({
      data: {
        peptide_embeddings_hash: "pep",
        protein_embeddings_hash: "prot",
      },
      model: {
        hash: "abc123",
        version: "test",
      },
      predictions: [],
      summary: {
        below_threshold: 0,
        high_confidence: 0,
        total: 0,
      },
      target: {
        gene: "EGFR",
        uniprot_id: "P01133",
      },
      threshold: 0.95,
    });

    await expect(
      runPrediction(
        { targetUniprotId: "P01133", threshold: 0.95 },
        fetcher,
      ),
    ).resolves.toMatchObject({
      summary: { total: 0 },
      target: { gene: "EGFR", uniprotId: "P01133" },
      threshold: 0.95,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/predictions",
      expect.objectContaining({
        body: JSON.stringify({
          target_uniprot_id: "P01133",
          threshold: 0.95,
        }),
        method: "POST",
      }),
    );
  });

  it("maps backend-specific error states", async () => {
    expect(
      predictionErrorMessage({
        error: { code: "MODEL_UNAVAILABLE" },
        state: "model-unavailable",
      }),
    ).toBe("Prediction model is unavailable.");
    expect(
      predictionErrorMessage({
        error: { code: "PREDICTION_FAILED" },
        state: "prediction-failed",
      }),
    ).toBe("Prediction could not be completed. Please try again.");
  });

  it("throws typed prediction errors for failed responses", async () => {
    const fetcher = jsonFetcher(
      {
        error: { code: "MODEL_UNAVAILABLE" },
        state: "model-unavailable",
      },
      503,
    );

    await expect(
      runPrediction(
        { targetUniprotId: "P01133", threshold: 0.95 },
        fetcher,
      ),
    ).rejects.toMatchObject({
      code: "MODEL_UNAVAILABLE",
      message: "Prediction model is unavailable.",
      state: "model-unavailable",
      status: 503,
    });
  });
});

describe("batch prediction API client", () => {
  it("posts the batch basket and normalizes each per-target result", async () => {
    const fetcher = jsonFetcher({
      cap: 50,
      data: {
        peptide_embeddings_hash: "pep",
        protein_embeddings_hash: "prot",
      },
      model: { hash: "abc", version: "test" },
      rejected: [
        {
          code: "INVALID_ACCESSION",
          input: "XYZ",
          message: "Enter a valid UniProt accession.",
          normalized_target_uniprot_id: "XYZ",
        },
      ],
      results: [
        {
          data: {
            peptide_embeddings_hash: "pep",
            protein_embeddings_hash: "prot",
          },
          model: { hash: "abc", version: "test" },
          predictions: [],
          summary: {
            below_threshold: 0,
            high_confidence: 0,
            total: 0,
          },
          target: { uniprot_id: "P01133", gene: "EGFR" },
          threshold: 0.95,
        },
      ],
      summary: {
        deduped: 0,
        rejected: 1,
        submitted: 2,
        succeeded: 1,
      },
      threshold: 0.95,
    });

    await expect(
      runBatchPrediction(
        { targetUniprotIds: ["P01133", "XYZ"], threshold: 0.95 },
        fetcher,
      ),
    ).resolves.toMatchObject({
      cap: 50,
      model: { hash: "abc", version: "test" },
      rejected: [
        {
          code: "INVALID_ACCESSION",
          input: "XYZ",
          normalizedTargetUniprotId: "XYZ",
        },
      ],
      results: [
        {
          summary: { total: 0 },
          target: { gene: "EGFR", uniprotId: "P01133" },
          threshold: 0.95,
        },
      ],
      summary: {
        deduped: 0,
        rejected: 1,
        submitted: 2,
        succeeded: 1,
      },
      threshold: 0.95,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/predictions/batch",
      expect.objectContaining({
        body: JSON.stringify({
          target_uniprot_ids: ["P01133", "XYZ"],
          threshold: 0.95,
        }),
        method: "POST",
      }),
    );
  });

  it("uses the BATCH_TOO_LARGE message from the backend", () => {
    expect(
      batchErrorMessage({
        error: {
          code: "BATCH_TOO_LARGE",
          message: "Batch contains 60 deduplicated targets, exceeding the cap of 50.",
        },
        state: "invalid-request",
      }),
    ).toBe(
      "Batch contains 60 deduplicated targets, exceeding the cap of 50.",
    );
  });

  it("maps batch-specific rate-limited errors", () => {
    expect(
      batchErrorMessage({ state: "rate-limited" }),
    ).toBe("Too many batch prediction requests. Please wait before retrying.");
    expect(
      batchErrorMessage({ state: "model-unavailable" }),
    ).toBe("Batch prediction model is unavailable.");
    expect(
      batchErrorMessage({ state: "artifacts-unavailable" }),
    ).toBe("Batch prediction embeddings are unavailable.");
  });

  it("throws typed errors for batch whole-request failures", async () => {
    const fetcher = jsonFetcher(
      {
        error: {
          code: "BATCH_TOO_LARGE",
          message: "Batch contains 60 deduplicated targets, exceeding the cap of 50.",
        },
        state: "invalid-request",
      },
      400,
    );

    await expect(
      runBatchPrediction(
        { targetUniprotIds: ["P01133"], threshold: 0.95 },
        fetcher,
      ),
    ).rejects.toMatchObject({
      code: "BATCH_TOO_LARGE",
      status: 400,
      state: "invalid-request",
    });
  });
});

function jsonFetcher(payload: unknown, status = 200): TargetFetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
      status,
    });
  });
}
