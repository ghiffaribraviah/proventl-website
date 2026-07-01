import { describe, expect, it } from "vitest";

import type {
  BatchPredictionResponse,
  PredictionResponse,
} from "../../api/predictions";
import type { ResultTableRow } from "./resultTable";
import {
  batchCsvFilename,
  buildBatchCsvExportRows,
  buildBatchResultsCsv,
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
      "target_uniprot_id,target_gene,target_protein_name,target_organism,target_sequence,rank,peptide_id,peptide_sequence,peptide_source_protein,classifier_score,applied_threshold,classification",
    );
    expect(csv).toContain(
      "P01133,,,,,1,pep-1,SLLEFG,Source protein,0.991235,0.95,High confidence",
    );
  });

  it("includes target identity fields when target preview provides them", () => {
    const enrichedResponse: PredictionResponse = {
      ...response,
      target: {
        ...response.target,
        gene: "EGFR",
        organism: "Homo sapiens",
        proteinName: "Epidermal growth factor receptor",
        sequence: "MKLW",
      },
    };

    const csv = buildResultsCsv([highRow], enrichedResponse);
    expect(csv.split("\n")[1]).toBe(
      "P01133,EGFR,Epidermal growth factor receptor,Homo sapiens,MKLW,1,pep-1,SLLEFG,Source protein,0.991235,0.95,High confidence",
    );
  });

  it("uses active filtered rows and does not depend on pagination rows", () => {
    expect(buildCsvExportRows([highRow, belowRow], response)).toHaveLength(2);
    expect(buildCsvExportRows([highRow], response)).toEqual([
      [
        "P01133",
        "",
        "",
        "",
        "",
        "1",
        "pep-1",
        "SLLEFG",
        "Source protein",
        "0.991235",
        "0.95",
        "High confidence",
      ],
    ]);
  });

  it("includes target accession and applied threshold in the filename", () => {
    expect(resultCsvFilename(response)).toBe(
      "proventl_P01133_threshold-0.95.csv",
    );
  });
});

describe("batch export model", () => {
  const secondResponse: PredictionResponse = {
    ...response,
    target: { sequence: "TARGET_B", uniprotId: "P00749" },
    threshold: 0.95,
  };
  const batchResponse: BatchPredictionResponse = {
    cap: 50,
    data: response.data,
    model: response.model,
    rejected: [],
    results: [response, secondResponse],
    summary: {
      deduped: 0,
      rejected: 0,
      submitted: 2,
      succeeded: 2,
    },
    threshold: 0.95,
  };
  const rowsByTarget = new Map<string, ResultTableRow[]>([
    ["P01133", [highRow]],
    ["P00749", [belowRow]],
  ]);

  it("concatenates per-target rows in submitted order with target identity columns", () => {
    const rows = buildBatchCsvExportRows(batchResponse, rowsByTarget);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.[0]).toBe("P01133");
    expect(rows[1]?.[0]).toBe("P00749");
  });

  it("emits one combined CSV with target identity columns and classification", () => {
    const csv = buildBatchResultsCsv(batchResponse, rowsByTarget);
    const [header, ...dataLines] = csv.split("\n");
    expect(header).toBe(
      "target_uniprot_id,target_gene,target_protein_name,target_organism,target_sequence,rank,peptide_id,peptide_sequence,peptide_source_protein,classifier_score,applied_threshold,classification",
    );
    expect(dataLines).toHaveLength(2);
    expect(dataLines[0]).toBe(
      "P01133,,,,,1,pep-1,SLLEFG,Source protein,0.991235,0.95,High confidence",
    );
    expect(dataLines[1]).toBe(
      "P00749,,,,TARGET_B,2,pep-2,SLLEFG,Source protein,0.501000,0.95,Below threshold",
    );
  });

  it("naming pattern follows batch target count and applied threshold", () => {
    expect(batchCsvFilename(batchResponse)).toBe(
      "proventl_batch_2targets_threshold-0.95.csv",
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
