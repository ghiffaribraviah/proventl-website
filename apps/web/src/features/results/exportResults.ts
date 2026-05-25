import type { PredictionResponse } from "../../api/predictions";
import type { ResultTableRow } from "./resultTable";

export const CSV_COLUMNS = [
  "rank",
  "peptide_id",
  "peptide_sequence",
  "peptide_source_protein",
  "classifier_score",
  "applied_threshold",
  "classification",
  "model_version",
] as const;

export function copySequencePayload(row: ResultTableRow): string {
  return row.sequence;
}

export function buildCsvExportRows(
  rows: ResultTableRow[],
  response: PredictionResponse,
): string[][] {
  return rows.map((row) => [
    String(row.rank),
    row.peptideId,
    row.sequence,
    row.sourceDescription,
    row.classifierScore.toFixed(6),
    response.threshold.toFixed(2),
    row.label,
    response.model.version,
  ]);
}

export function buildResultsCsv(
  rows: ResultTableRow[],
  response: PredictionResponse,
): string {
  return [
    CSV_COLUMNS.join(","),
    ...buildCsvExportRows(rows, response).map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

export function resultCsvFilename(response: PredictionResponse): string {
  return `proventl_${response.target.uniprotId}_threshold-${response.threshold.toFixed(
    2,
  )}.csv`;
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}
