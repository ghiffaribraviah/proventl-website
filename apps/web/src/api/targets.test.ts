import { describe, expect, it, vi } from "vitest";

import {
  fetchTargetExamples,
  lookupTarget,
  searchTargets,
  type TargetFetch,
} from "./targets";

describe("target API client", () => {
  it("loads and normalizes curated examples from the backend", async () => {
    const fetcher = jsonFetcher({
      count: 1,
      examples: [
        {
          gene: "EGFR",
          organism: "Homo sapiens",
          protein_family: "Receptor tyrosine kinase",
          protein_name: "Epidermal growth factor receptor",
          uniprot_id: "P01133",
        },
      ],
    });

    await expect(fetchTargetExamples(fetcher)).resolves.toEqual([
      {
        gene: "EGFR",
        organism: "Homo sapiens",
        proteinFamily: "Receptor tyrosine kinase",
        proteinName: "Epidermal growth factor receptor",
        uniprotId: "P01133",
      },
    ]);
    expect(fetcher).toHaveBeenCalledWith("/api/targets/examples", {
      signal: undefined,
    });
  });

  it("calls backend curated search without embedding frontend search logic", async () => {
    const fetcher = jsonFetcher({
      count: 1,
      normalized_query: "eg",
      query: "EG",
      results: [{ uniprot_id: "P01133" }],
    });

    await expect(searchTargets("EG", fetcher)).resolves.toEqual([
      { uniprotId: "P01133" },
    ]);
    expect(fetcher).toHaveBeenCalledWith("/api/targets/search?q=EG", {
      signal: undefined,
    });
  });

  it("normalizes curated exact lookup responses", async () => {
    const fetcher = jsonFetcher({
      normalized_accession: "P01133",
      prediction_eligible: true,
      query: "p01133",
      state: "available-curated",
      target: {
        gene: "EGFR",
        protein_name: "Epidermal growth factor receptor",
        uniprot_id: "P01133",
      },
    });

    await expect(lookupTarget("p01133", fetcher)).resolves.toMatchObject({
      normalizedAccession: "P01133",
      predictionEligible: true,
      state: "available-curated",
      target: {
        gene: "EGFR",
        proteinName: "Epidermal growth factor receptor",
        uniprotId: "P01133",
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/targets/lookup?accession=p01133",
      { signal: undefined },
    );
  });

  it("normalizes invalid accession lookup responses", async () => {
    const fetcher = jsonFetcher({
      error: {
        code: "INVALID_ACCESSION",
        message: "Enter a valid UniProt accession.",
      },
      normalized_accession: "BAD",
      query: "bad",
      state: "invalid-accession",
    });

    await expect(lookupTarget("bad", fetcher)).resolves.toMatchObject({
      message: "Enter a valid UniProt accession.",
      predictionEligible: false,
      state: "invalid-accession",
      target: null,
    });
  });

  it("normalizes unsupported valid target lookup responses with sparse metadata", async () => {
    const fetcher = jsonFetcher({
      normalized_accession: "Q9Y6K9",
      prediction_eligible: false,
      query: "q9y6k9",
      state: "valid-but-not-available",
      target: {
        uniprot_id: "Q9Y6K9",
      },
    });

    await expect(lookupTarget("q9y6k9", fetcher)).resolves.toMatchObject({
      message: "Prediction is not available for this UniProt target.",
      predictionEligible: false,
      state: "valid-but-not-available",
      target: {
        uniprotId: "Q9Y6K9",
      },
    });
  });

  it("normalizes not-found lookup responses", async () => {
    const fetcher = jsonFetcher({
      error: {
        code: "UNIPROT_TARGET_NOT_FOUND",
        message: "No UniProt record was found for this accession.",
      },
      normalized_accession: "Q99999",
      prediction_eligible: false,
      query: "q99999",
      state: "not-found",
    });

    await expect(lookupTarget("q99999", fetcher)).resolves.toMatchObject({
      message: "No UniProt record was found for this accession.",
      predictionEligible: false,
      state: "not-found",
      target: null,
    });
  });

  it("normalizes lookup-unavailable responses", async () => {
    const fetcher = jsonFetcher({
      error: {
        code: "UNIPROT_LOOKUP_UNAVAILABLE",
        message: "UniProt lookup is currently unavailable.",
      },
      normalized_accession: "Q99999",
      prediction_eligible: false,
      query: "q99999",
      state: "lookup-unavailable",
    });

    await expect(lookupTarget("q99999", fetcher)).resolves.toMatchObject({
      message: "UniProt lookup is currently unavailable.",
      predictionEligible: false,
      state: "lookup-unavailable",
      target: null,
    });
  });
});

function jsonFetcher(payload: unknown): TargetFetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  });
}
