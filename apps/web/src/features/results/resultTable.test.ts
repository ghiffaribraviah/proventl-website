import { describe, expect, it } from "vitest";

import type { PredictionResponse } from "../../api/predictions";
import {
  buildResultTableView,
  convertClassificationLabel,
  formatClassifierScore,
  resultHeaderText,
  shouldResetResultPagination,
} from "./resultTable";

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
    row(3, "pep-c", "CCCC", "zeta source", 0.71, "below threshold"),
    row(1, "pep-a", "AAAAAA", "alpha source", 0.99, "high confidence"),
    row(2, "pep-b", "BBBBBBBB", "beta source", 0.96, "high confidence"),
    row(4, "venom-x", "XX", "alpha toxin", 0.51, "below threshold"),
  ],
  summary: {
    belowThreshold: 2,
    highConfidence: 2,
    total: 4,
  },
  target: {
    gene: "EGFR",
    uniprotId: "P01133",
  },
  threshold: 0.95,
};

describe("result table model", () => {
  it("formats classifier scores and user-facing labels", () => {
    expect(formatClassifierScore(0.9876)).toBe("98.8%");
    expect(convertClassificationLabel("high confidence")).toBe(
      "High confidence",
    );
    expect(convertClassificationLabel("below threshold")).toBe(
      "Below threshold",
    );
  });

  it("defaults to confidence descending", () => {
    const view = buildResultTableView(response, {
      filter: "all",
      page: 1,
      search: "",
      sortKey: "confidence",
    });

    expect(view.pageRows.map((currentRow) => currentRow.peptideId)).toEqual([
      "pep-a",
      "pep-b",
      "pep-c",
      "venom-x",
    ]);
  });

  it("sorts by peptide ID, source description, and sequence length", () => {
    expect(
      buildResultTableView(response, {
        filter: "all",
        page: 1,
        search: "",
        sortKey: "peptide-id",
      }).pageRows.map((currentRow) => currentRow.peptideId),
    ).toEqual(["pep-a", "pep-b", "pep-c", "venom-x"]);
    expect(
      buildResultTableView(response, {
        filter: "all",
        page: 1,
        search: "",
        sortKey: "source-description",
      }).pageRows.map((currentRow) => currentRow.peptideId),
    ).toEqual(["pep-a", "venom-x", "pep-b", "pep-c"]);
    expect(
      buildResultTableView(response, {
        filter: "all",
        page: 1,
        search: "",
        sortKey: "sequence-length",
      }).pageRows.map((currentRow) => currentRow.peptideId),
    ).toEqual(["venom-x", "pep-c", "pep-a", "pep-b"]);
  });

  it("combines high-confidence filtering and local peptide search with AND logic", () => {
    const view = buildResultTableView(response, {
      filter: "high-confidence",
      page: 1,
      search: "beta",
      sortKey: "confidence",
    });

    expect(view.pageRows.map((currentRow) => currentRow.peptideId)).toEqual([
      "pep-b",
    ]);
    expect(view.summaryText).toBe(
      "1 of 4 peptides · 1 high confidence · threshold 0.95",
    );
  });

  it("paginates at ten rows per page and clamps empty pages", () => {
    const expandedResponse = {
      ...response,
      predictions: Array.from({ length: 15 }, (_, index) =>
        row(
          index + 1,
          `pep-${String(index).padStart(2, "0")}`,
          "AA",
          "source",
          1 - index / 100,
          "high confidence",
        ),
      ),
    };
    const view = buildResultTableView(expandedResponse, {
      filter: "all",
      page: 2,
      search: "",
      sortKey: "confidence",
    });

    expect(view.pageRows).toHaveLength(5);
    expect(view.page).toBe(2);
    expect(view.pageCount).toBe(2);
  });

  it("builds compact result header and detects pagination reset triggers", () => {
    expect(resultHeaderText(response)).toBe("Prediction results for EGFR · P01133");
    expect(
      shouldResetResultPagination(
        { filter: "all", search: "", sortKey: "confidence" },
        { filter: "all", search: "pep", sortKey: "confidence" },
      ),
    ).toBe(true);
  });
});

function row(
  rank: number,
  peptideId: string,
  sequence: string,
  sourceDescription: string,
  classifierScore: number,
  classification: string,
) {
  return {
    classification,
    classifierScore,
    peptideId,
    rank,
    sequence,
    sourceDescription,
  };
}
