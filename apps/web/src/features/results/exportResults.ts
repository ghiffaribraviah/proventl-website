import type { BatchPredictionResponse, PredictionResponse } from "../../api/predictions";
import type { ResultTableRow } from "./resultTable";

export const CSV_COLUMNS = [
  "target_uniprot_id",
  "target_gene",
  "target_protein_name",
  "target_organism",
  "target_sequence",
  "rank",
  "peptide_id",
  "peptide_sequence",
  "peptide_source_protein",
  "classifier_score",
  "applied_threshold",
  "classification",
] as const;

export function copySequencePayload(row: ResultTableRow): string {
  return row.sequence;
}

export function buildCsvExportRows(
  rows: ResultTableRow[],
  response: PredictionResponse,
): string[][] {
  return rows.map((row) => [
    response.target.uniprotId,
    response.target.gene ?? "",
    response.target.proteinName ?? "",
    response.target.organism ?? "",
    response.target.sequence ?? "",
    String(row.rank),
    row.peptideId,
    row.sequence,
    row.sourceDescription,
    row.classifierScore.toFixed(6),
    response.threshold.toFixed(2),
    row.label,
  ]);
}

export function buildResultsCsv(
  rows: ResultTableRow[],
  response: PredictionResponse,
): string {
  return serializeCsv(CSV_COLUMNS, buildCsvExportRows(rows, response));
}

export function buildBatchCsvExportRows(
  response: BatchPredictionResponse,
  rowsByTarget: Map<string, ResultTableRow[]>,
): string[][] {
  const flatRows: string[][] = [];

  for (const targetResponse of response.results) {
    const rows = rowsByTarget.get(targetResponse.target.uniprotId) ?? [];
    flatRows.push(...buildCsvExportRows(rows, targetResponse));
  }

  return flatRows;
}

export function buildBatchResultsCsv(
  response: BatchPredictionResponse,
  rowsByTarget: Map<string, ResultTableRow[]>,
): string {
  return serializeCsv(
    CSV_COLUMNS,
    buildBatchCsvExportRows(response, rowsByTarget),
  );
}

export function resultCsvFilename(response: PredictionResponse): string {
  return `proventl_${response.target.uniprotId}_threshold-${response.threshold.toFixed(
    2,
  )}.csv`;
}

export function batchCsvFilename(response: BatchPredictionResponse): string {
  const targetCount = response.summary.succeeded;
  return `proventl_batch_${targetCount}targets_threshold-${response.threshold.toFixed(
    2,
  )}.csv`;
}

function serializeCsv(
  columns: readonly string[],
  rows: string[][],
): string {
  return [
    columns.join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}