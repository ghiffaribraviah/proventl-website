import type { PredictionResponse, PredictionRow } from "../../api/predictions";
import { formatSelectedTargetInput } from "../targets/targetDiscovery";

export type ResultFilter = "all" | "high-confidence";
export type ResultSortKey =
  | "confidence"
  | "peptide-id"
  | "sequence-length"
  | "source-description";

export type ResultTableOptions = {
  filter: ResultFilter;
  page: number;
  pageSize?: number;
  search: string;
  sortKey: ResultSortKey;
};

export type ResultTableRow = PredictionRow & {
  classifierScoreLabel: string;
  label: "Below threshold" | "High confidence";
  sequenceLength: number;
};

export type ResultTableView = {
  filteredRows: ResultTableRow[];
  highConfidenceCount: number;
  page: number;
  pageCount: number;
  pageRows: ResultTableRow[];
  pageSize: number;
  summaryText: string;
  totalRows: number;
};

export const RESULT_PAGE_SIZE = 10;
export const CLASSIFIER_SCORE_TOOLTIP =
  "Classifier score from 0 to 1. Higher scores indicate stronger model support, but predictions require experimental validation.";

export function buildResultTableView(
  response: PredictionResponse,
  options: ResultTableOptions,
): ResultTableView {
  const pageSize = options.pageSize ?? RESULT_PAGE_SIZE;
  const rows = response.predictions.map(toResultTableRow);
  const filteredRows = sortRows(
    rows.filter((row) => rowMatchesFilter(row, options.filter)),
    options.sortKey,
  ).filter((row) => rowMatchesSearch(row, options.search));
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const page = clampPage(options.page, pageCount);
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const highConfidenceCount = filteredRows.filter(
    (row) => row.label === "High confidence",
  ).length;

  return {
    filteredRows,
    highConfidenceCount,
    page,
    pageCount,
    pageRows,
    pageSize,
    summaryText: resultSummaryText({
      filteredCount: filteredRows.length,
      highConfidenceCount,
      targetLabel: formatSelectedTargetInput(response.target),
      threshold: response.threshold,
      totalCount: rows.length,
    }),
    totalRows: rows.length,
  };
}

export function toResultTableRow(row: PredictionRow): ResultTableRow {
  return {
    ...row,
    classifierScoreLabel: formatClassifierScore(row.classifierScore),
    label: convertClassificationLabel(row.classification),
    sequenceLength: row.sequence.length,
  };
}

export function convertClassificationLabel(
  classification: string,
): "Below threshold" | "High confidence" {
  return classification.trim().toLowerCase() === "high confidence"
    ? "High confidence"
    : "Below threshold";
}

export function formatClassifierScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

export function resultHeaderText(response: PredictionResponse): string {
  return `Prediction results for ${formatSelectedTargetInput(response.target)}`;
}

export function resultSummaryText({
  filteredCount,
  highConfidenceCount,
  targetLabel: _targetLabel,
  threshold,
  totalCount,
}: {
  filteredCount: number;
  highConfidenceCount: number;
  targetLabel: string;
  threshold: number;
  totalCount: number;
}): string {
  const prefix =
    filteredCount === totalCount
      ? `${totalCount} peptides`
      : `${filteredCount} of ${totalCount} peptides`;

  return `${prefix} · ${highConfidenceCount} high confidence · threshold ${threshold.toFixed(2)}`;
}

export function shouldResetResultPagination(
  previous: Omit<ResultTableOptions, "page" | "pageSize">,
  next: Omit<ResultTableOptions, "page" | "pageSize">,
): boolean {
  return (
    previous.filter !== next.filter ||
    previous.search !== next.search ||
    previous.sortKey !== next.sortKey
  );
}

function rowMatchesFilter(row: ResultTableRow, filter: ResultFilter): boolean {
  return filter === "all" || row.label === "High confidence";
}

function rowMatchesSearch(row: ResultTableRow, search: string): boolean {
  const normalizedSearch = normalizeSearch(search);
  if (!normalizedSearch) {
    return true;
  }

  return [row.peptideId, row.sequence, row.sourceDescription].some((value) =>
    normalizeSearch(value).includes(normalizedSearch),
  );
}

function sortRows(
  rows: ResultTableRow[],
  sortKey: ResultSortKey,
): ResultTableRow[] {
  return [...rows].sort((left, right) => {
    if (sortKey === "confidence") {
      return right.classifierScore - left.classifierScore;
    }
    if (sortKey === "sequence-length") {
      return left.sequenceLength - right.sequenceLength;
    }
    if (sortKey === "source-description") {
      return left.sourceDescription.localeCompare(right.sourceDescription);
    }

    return left.peptideId.localeCompare(right.peptideId);
  });
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function clampPage(page: number, pageCount: number): number {
  if (page < 1) {
    return 1;
  }
  if (page > pageCount) {
    return pageCount;
  }

  return page;
}
