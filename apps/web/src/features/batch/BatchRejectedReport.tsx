import type {
  BatchPredictionResponse,
  BatchRejectedCode,
  BatchRejectedEntry,
} from "../../api/predictions";

type BatchRejectedReportProps = {
  dedupedCount: number;
  rejected: BatchRejectedEntry[];
  summary: BatchPredictionResponse["summary"];
};

const REJECTION_LABELS: Record<BatchRejectedCode, string> = {
  INVALID_ACCESSION: "Invalid accession",
  MISSING_TARGET_EMBEDDING: "Missing embedding",
  UNSUPPORTED_TARGET: "Not available for prediction",
};

const REJECTION_ORDER: BatchRejectedCode[] = [
  "UNSUPPORTED_TARGET",
  "INVALID_ACCESSION",
  "MISSING_TARGET_EMBEDDING",
];

export function BatchRejectedReport({
  dedupedCount,
  rejected,
  summary: _summary,
}: BatchRejectedReportProps) {
  if (rejected.length === 0 && dedupedCount === 0) {
    return null;
  }

  const grouped = groupByCode(rejected);

  return (
    <div id="rejected-report-container" className="batch-rejected-report">
      <div className="mb-2 flex items-center gap-2 text-[0.875rem] font-extrabold text-danger">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Some targets could not be scored
      </div>
      <ul className="ml-6 flex list-none flex-col gap-1.5 text-[0.8125rem] font-semibold">
        {REJECTION_ORDER.filter((code) => grouped[code]?.length).map((code) => (
          <li key={code} className="flex flex-wrap items-baseline gap-x-3">
            <span className="inline-block w-[220px] text-muted">
              {REJECTION_LABELS[code]}:
            </span>
            <span className="font-mono text-fg">
              {grouped[code]!.map((entry) => entry.input || entry.normalizedTargetUniprotId).join(", ")}
            </span>
          </li>
        ))}
      </ul>
      {dedupedCount > 0 ? (
        <div className="mt-3 border-t border-dashed border-danger/10 pt-3 text-[0.8125rem] font-bold text-muted">
          {dedupedCount} duplicate{dedupedCount === 1 ? " was" : "s were"} removed during parsing.
        </div>
      ) : null}
    </div>
  );
}

function groupByCode(
  entries: BatchRejectedEntry[],
): Record<BatchRejectedCode, BatchRejectedEntry[]> {
  return entries.reduce(
    (acc, entry) => {
      acc[entry.code] = [...(acc[entry.code] ?? []), entry];
      return acc;
    },
    {
      INVALID_ACCESSION: [],
      MISSING_TARGET_EMBEDDING: [],
      UNSUPPORTED_TARGET: [],
    } as Record<BatchRejectedCode, BatchRejectedEntry[]>,
  );
}