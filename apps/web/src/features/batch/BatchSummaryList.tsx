import { formatProteinName } from "../targets/targetDiscovery";
import type { BatchSummaryRow } from "./basket";

type BatchSummaryListProps = {
  onSelectTarget: (uniprotId: string) => void;
  rows: BatchSummaryRow[];
  selectedUniprotId: string | null;
};

export function BatchSummaryList({
  onSelectTarget,
  rows,
  selectedUniprotId,
}: BatchSummaryListProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className="table-heading">Target ID</th>
            <th className="table-heading">Name / Gene</th>
            <th className="table-heading">High Confidence</th>
            <th className="table-heading">Top Peptide</th>
            <th
              className="table-heading text-right"
              style={{ width: "100px" }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody id="summary-table-body">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-5 py-16 text-center text-[0.8125rem] font-semibold text-muted"
              >
                No successfully scored targets in this batch.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <SummaryRow
                key={row.uniprotId}
                isSelected={row.uniprotId === selectedUniprotId}
                onSelect={onSelectTarget}
                row={row}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

type SummaryRowProps = {
  isSelected: boolean;
  onSelect: (uniprotId: string) => void;
  row: BatchSummaryRow;
};

function SummaryRow({ isSelected, onSelect, row }: SummaryRowProps) {
  const preview = row.response.target;
  const label = preview.gene
    ? `${preview.gene} — ${formatProteinName(preview)}`
    : formatProteinName(preview);
  const highRatio = row.total > 0 ? row.highConfidence / row.total : 0;

  return (
    <tr
      data-label={row.uniprotId}
      onClick={() => onSelect(row.uniprotId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(row.uniprotId);
        }
      }}
      tabIndex={0}
      aria-label={`Open ${preview.uniprotId} detail`}
      className={[
        "cursor-pointer border-b border-black/[0.03] transition hover:bg-ipb-blue/[0.03]",
        isSelected ? "bg-ipb-blue/[0.05]" : "",
      ].join(" ")}
    >
      <td
        data-label="Target ID"
        className="px-5 py-5 font-mono text-[0.8125rem] font-extrabold text-ipb-blue"
      >
        {preview.uniprotId}
      </td>
      <td data-label="Name / Gene" className="px-5 py-5">
        <div className="font-bold text-fg">{label}</div>
        {preview.organism ? (
          <div className="mt-1 text-[0.75rem] font-semibold text-muted">
            {preview.organism}
          </div>
        ) : null}
      </td>
      <td data-label="High Confidence" className="px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.8125rem] font-bold text-fg">
            {row.highConfidence} / {row.total}
          </span>
          <div className="h-1 w-10 overflow-hidden rounded-full bg-black/[0.05]">
            <div
              className="h-full bg-ipb-blue"
              style={{ width: `${Math.round(highRatio * 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td
        data-label="Top Peptide"
        className="px-5 py-5 font-mono text-[0.8125rem] text-muted"
      >
        {row.topPeptideId ?? "-"}
      </td>
      <td data-label="Action" className="px-5 py-5 text-right">
        <span className="inline-flex items-center gap-1 rounded-lg border border-ipb-blue bg-transparent px-2 py-1 text-[0.75rem] font-bold text-ipb-blue">
          View
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </td>
    </tr>
  );
}