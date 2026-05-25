import { describe, expect, it, vi } from "vitest";

import {
  predictionErrorMessage,
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

function jsonFetcher(payload: unknown, status = 200): TargetFetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
      status,
    });
  });
}
