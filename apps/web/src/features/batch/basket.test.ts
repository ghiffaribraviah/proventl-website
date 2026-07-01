import { describe, expect, it } from "vitest";

import {
  addAccessionsToBasket,
  annotateBasketWithPreviews,
  BATCH_BASKET_CAP,
  basketHasAccession,
  buildBatchSummaryRows,
  clearBatchBasket,
  createBatchBasket,
  findBatchSummaryRow,
  normalizeAccession,
  parseAccessionList,
  removeAccessionFromBasket,
  totalHighConfidenceForBatch,
} from "./basket";
import type { BatchPredictionResponse, PredictionResponse } from "../../api/predictions";

function makeResponse(
  uniprotId: string,
  scores: Array<{ peptideId: string; score: number }>,
  threshold = 0.95,
): PredictionResponse {
  return {
    data: { peptideEmbeddingsHash: "p", proteinEmbeddingsHash: "q" },
    model: { hash: "h", version: "v" },
    predictions: scores.map((entry, index) => ({
      classification:
        entry.score >= threshold ? "high confidence" : "below threshold",
      classifierScore: entry.score,
      peptideId: entry.peptideId,
      rank: index + 1,
      sequence: "AAAA",
      sourceDescription: "source",
    })),
    summary: {
      belowThreshold: scores.filter((s) => s.score < threshold).length,
      highConfidence: scores.filter((s) => s.score >= threshold).length,
      total: scores.length,
    },
    target: { uniprotId },
    threshold,
  };
}

function makeBatch(
  responses: PredictionResponse[],
  threshold = 0.95,
): BatchPredictionResponse {
  return {
    cap: BATCH_BASKET_CAP,
    data: { peptideEmbeddingsHash: "p", proteinEmbeddingsHash: "q" },
    model: { hash: "h", version: "v" },
    rejected: [],
    results: responses,
    summary: {
      deduped: 0,
      rejected: 0,
      submitted: responses.length,
      succeeded: responses.length,
    },
    threshold,
  };
}

describe("batch basket helpers", () => {
  it("parses comma and newline separated accession lists and uppercases them", () => {
    expect(parseAccessionList("p01133, P00749\np04637")).toEqual([
      "P01133",
      "P00749",
      "P04637",
    ]);
    expect(parseAccessionList("  a; b c\td")).toEqual(["A", "B", "C", "D"]);
    expect(parseAccessionList("")).toEqual([]);
  });

  it("normalizes accessions via trim and upper-case", () => {
    expect(normalizeAccession("  p01133\n")).toBe("P01133");
    expect(normalizeAccession("")).toBe("");
  });

  it("adds new accessions and detects duplicates", () => {
    const basket = createBatchBasket();
    const first = addAccessionsToBasket(basket, ["P01133"]);
    expect(first.added).toHaveLength(1);
    expect(first.basket.entries.map((e) => e.accession)).toEqual(["P01133"]);

    const second = addAccessionsToBasket(first.basket, [
      "P01133",
      " P00749 ",
    ]);
    expect(second.duplicate).toBe(true);
    expect(second.basket.entries.map((e) => e.accession)).toEqual([
      "P01133",
      "P00749",
    ]);
    expect(second.added.map((e) => e.accession)).toEqual(["P00749"]);
  });

  it("blocks additions past the cap and reports the reason", () => {
    let basket = createBatchBasket(3);
    ({ basket } = addAccessionsToBasket(basket, ["P01133", "P00749", "P04637"]));
    const next = addAccessionsToBasket(basket, ["P12345"]);
    expect(next.blockedReason).toBe("full");
    expect(next.added).toHaveLength(0);
    expect(next.basket.entries).toHaveLength(3);
  });

  it("removes a single accession and clears the basket", () => {
    const basket = createBatchBasket();
    const added = addAccessionsToBasket(basket, [
      "P01133",
      "P00749",
      "P04637",
    ]).basket;
    const trimmed = removeAccessionFromBasket(added, "P00749");
    expect(trimmed.entries.map((e) => e.accession)).toEqual([
      "P01133",
      "P04637",
    ]);
    expect(clearBatchBasket(trimmed).entries).toHaveLength(0);
  });

  it("detects whether an accession is already in the basket", () => {
    const basket = addAccessionsToBasket(createBatchBasket(), [
      "P01133",
    ]).basket;
    expect(basketHasAccession(basket, "p01133")).toBe(true);
    expect(basketHasAccession(basket, "P99999")).toBe(false);
  });

  it("annotates basket entries with preview metadata when available", () => {
    const basket = addAccessionsToBasket(createBatchBasket(), [
      "P01133",
      "P99999",
    ]).basket;
    const annotated = annotateBasketWithPreviews(basket, [
      {
        gene: "EGFR",
        uniprotId: "P01133",
      },
    ]);

    expect(annotated.entries[0]?.preview).toMatchObject({
      gene: "EGFR",
      uniprotId: "P01133",
    });
    expect(annotated.entries[1]?.preview).toBeNull();
  });
});

describe("batch summary helpers", () => {
  const a = makeResponse("P01133", [
    { peptideId: "pep-1", score: 0.99 },
    { peptideId: "pep-2", score: 0.96 },
    { peptideId: "pep-3", score: 0.6 },
  ]);
  const b = makeResponse("P00749", [
    { peptideId: "pep-4", score: 0.97 },
    { peptideId: "pep-5", score: 0.5 },
  ]);
  const batch = makeBatch([a, b]);

  it("builds per-target summary rows including top peptide and high-conf count", () => {
    const rows = buildBatchSummaryRows(batch, 0.95);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      highConfidence: 2,
      topPeptideId: "pep-1",
      total: 3,
      uniprotId: "P01133",
    });
    expect(rows[1]).toMatchObject({
      highConfidence: 1,
      topPeptideId: "pep-4",
      total: 2,
      uniprotId: "P00749",
    });
  });

  it("recomputes high-confidence counts when threshold changes", () => {
    expect(buildBatchSummaryRows(batch, 0.95)[0]?.highConfidence).toBe(2);
    expect(buildBatchSummaryRows(batch, 0.97)[0]?.highConfidence).toBe(1);
  });

  it("sums high-confidence counts across the batch", () => {
    const rows = buildBatchSummaryRows(batch, 0.95);
    expect(totalHighConfidenceForBatch(rows)).toBe(3);
  });

  it("locates a summary row by accession", () => {
    const rows = buildBatchSummaryRows(batch, 0.95);
    expect(findBatchSummaryRow(rows, "p01133")?.uniprotId).toBe("P01133");
    expect(findBatchSummaryRow(rows, "P99999")).toBeNull();
  });
});