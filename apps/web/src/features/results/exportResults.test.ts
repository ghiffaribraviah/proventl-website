import { describe, expect, it } from "vitest";

import type { PredictionResponse } from "../../api/predictions";
import type { ResultTableRow } from "./resultTable";
import {
  buildCsvExportRows,
  buildResultsCsv,
  copySequencePayload,
  resultCsvFilename,
} from "./exportResults";

const response: PredictionResponse = {
  data: {
    peptideEmbeddingsHash: "pep",
    proteinEmbeddingsHash: "prot",
  },
  model: {
    hash: "model",
    version: "sae-dnn-v1",
  },
  predictions: [],
  summary: {
    belowThreshold: 1,
    highConfidence: 1,
    total: 2,
  },
  target: {
    uniprotId: "P01133",
  },
  threshold: 0.95,
};

const highRow = row("pep-1", 0.99123456, "High confidence");
const belowRow = row("pep-2", 0.501, "Below threshold");

describe("result export model", () => {
  it("copies only the plain peptide sequence", () => {
    expect(copySequencePayload(highRow)).toBe("SLLEFG");
  });

  it("builds CSV columns and formats scores", () => {
    const csv = buildResultsCsv([highRow], response);

    expect(csv.split("\n")[0]).toBe(
      "rank,peptide_id,peptide_sequence,peptide_source_protein,classifier_score,applied_threshold,classification,model_version",
    );
    expect(csv).toContain(
      "1,pep-1,SLLEFG,Source protein,0.991235,0.95,High confidence,sae-dnn-v1",
    );
  });

  it("uses active filtered rows and does not depend on pagination rows", () => {
    expect(buildCsvExportRows([highRow, belowRow], response)).toHaveLength(2);
    expect(buildCsvExportRows([highRow], response)).toEqual([
      [
        "1",
        "pep-1",
        "SLLEFG",
        "Source protein",
        "0.991235",
        "0.95",
        "High confidence",
        "sae-dnn-v1",
      ],
    ]);
  });

  it("includes target accession and applied threshold in the filename", () => {
    expect(resultCsvFilename(response)).toBe(
      "proventl_P01133_threshold-0.95.csv",
    );
  });
});

function row(
  peptideId: string,
  classifierScore: number,
  label: "Below threshold" | "High confidence",
): ResultTableRow {
  return {
    classification: label.toLowerCase(),
    classifierScore,
    classifierScoreLabel: `${(classifierScore * 100).toFixed(1)}%`,
    label,
    peptideId,
    rank: peptideId === "pep-1" ? 1 : 2,
    sequence: "SLLEFG",
    sequenceLength: 6,
    sourceDescription: "Source protein",
  };
}
