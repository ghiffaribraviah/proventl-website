import { ChevronLeft, ChevronRight, Copy, Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { PredictionResponse } from "../../api/predictions";
import {
  buildResultTableView,
  CLASSIFIER_SCORE_TOOLTIP,
  resultHeaderText,
  type ResultFilter,
  type ResultSortKey,
} from "./resultTable";
import {
  buildResultsCsv,
  copySequencePayload,
  resultCsvFilename,
} from "./exportResults";
import {
  applyThresholdToPredictionResponse,
  MAX_THRESHOLD,
  MIN_THRESHOLD,
  normalizeThreshold,
  THRESHOLD_STEP,
  thresholdInputValue,
} from "./thresholdInterpretation";

type ResultsDashboardProps = {
  onThresholdApplied?: (targetUniprotId: string, threshold: number) => void;
  response: PredictionResponse;
};

export function ResultsDashboard({
  onThresholdApplied,
  response,
}: ResultsDashboardProps) {
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<ResultSortKey>("confidence");
  const [page, setPage] = useState(1);
  const [copiedPeptideId, setCopiedPeptideId] = useState<string | null>(null);
  const [appliedThreshold, setAppliedThreshold] = useState(response.threshold);
  const [draftThreshold, setDraftThreshold] = useState(
    thresholdInputValue(response.threshold),
  );

  useEffect(() => {
    setFilter("all");
    setSearch("");
    setSortKey("confidence");
    setPage(1);
    setAppliedThreshold(response.threshold);
    setDraftThreshold(thresholdInputValue(response.threshold));
  }, [response.target.uniprotId, response.threshold]);

  const interpretedResponse = useMemo(
    () => applyThresholdToPredictionResponse(response, appliedThreshold),
    [appliedThreshold, response],
  );
  const table = useMemo(
    () =>
      buildResultTableView(interpretedResponse, {
        filter,
        page,
        search,
        sortKey,
      }),
    [filter, interpretedResponse, page, search, sortKey],
  );

  function applyDraftThreshold() {
    const nextThreshold = normalizeThreshold(draftThreshold);
    setAppliedThreshold(nextThreshold);
    setDraftThreshold(thresholdInputValue(nextThreshold));
    setPage(1);
    onThresholdApplied?.(response.target.uniprotId, nextThreshold);
  }

  async function copySequence(row: (typeof table.pageRows)[number]) {
    await navigator.clipboard.writeText(copySequencePayload(row));
    setCopiedPeptideId(row.peptideId);
    window.setTimeout(() => setCopiedPeptideId(null), 1600);
  }

  function exportCsv() {
    const csv = buildResultsCsv(table.filteredRows, interpretedResponse);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = resultCsvFilename(interpretedResponse);
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetPageAndSetFilter(nextFilter: ResultFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  function resetPageAndSetSearch(nextSearch: string) {
    setSearch(nextSearch);
    setPage(1);
  }

  function resetPageAndSetSort(nextSort: ResultSortKey) {
    setSortKey(nextSort);
    setPage(1);
  }

  return (
    <section className="glass-panel overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between gap-4 border-b border-black/5 px-5 py-5 max-lg:flex-col max-lg:items-start sm:px-7 sm:py-6">
        <div>
          <h2 className="flex items-center gap-2.5 text-[1.0625rem] font-bold text-ipb-blue before:h-2 before:w-2 before:rounded-full before:bg-ipb-yellow before:content-['']">
            {resultHeaderText(interpretedResponse)}
          </h2>
          <div className="mt-1 text-[0.8125rem] font-semibold text-slate-500">
            {table.summaryText}
          </div>
        </div>
        <button
          type="button"
          title="Exports all rows matching current filters."
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ipb-blue/30 bg-white px-3.5 py-2 text-xs font-bold text-ipb-blue shadow-[0_2px_6px_rgba(38,60,146,0.08)] transition hover:-translate-y-px hover:border-ipb-blue hover:bg-ipb-blue/5"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      <div className="border-b border-black/5 px-5 py-5 sm:px-7">
        <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-stretch">
          <label className="flex flex-1 flex-col gap-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-normal text-ipb-blue">
              <span>Threshold</span>
              <span className="font-mono font-extrabold">
                {appliedThreshold.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={MIN_THRESHOLD}
              max={MAX_THRESHOLD}
              step={THRESHOLD_STEP}
              value={normalizeThreshold(draftThreshold)}
              onChange={(event) => setDraftThreshold(event.target.value)}
              className="h-1.5 accent-ipb-blue"
              aria-label="Draft threshold"
            />
          </label>
          <input
            type="number"
            min={MIN_THRESHOLD}
            max={MAX_THRESHOLD}
            step={THRESHOLD_STEP}
            value={draftThreshold}
            onChange={(event) => setDraftThreshold(event.target.value)}
            onBlur={() =>
              setDraftThreshold(thresholdInputValue(normalizeThreshold(draftThreshold)))
            }
            className="w-[88px] rounded-[10px] border-[1.5px] border-black/15 bg-white px-3 py-2 font-mono text-[0.8125rem] font-bold text-slate-800 outline-none max-sm:w-full max-sm:text-center"
            aria-label="Threshold value"
          />
          <button
            type="button"
            onClick={applyDraftThreshold}
            className="rounded-xl border border-ipb-blue/30 bg-white px-5 py-2.5 text-[0.8125rem] font-bold text-ipb-blue shadow-[0_2px_6px_rgba(38,60,146,0.08)] transition hover:-translate-y-px hover:border-ipb-blue hover:bg-ipb-blue/5"
          >
            Apply Threshold
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.03] bg-white/20 px-5 py-4 max-lg:items-stretch sm:px-7">
        <div className="flex flex-wrap items-center gap-3 max-lg:w-full max-sm:flex-col max-sm:items-stretch">
          <div className="flex rounded-xl bg-black/[0.06] p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] max-sm:w-full">
            <button
              type="button"
              onClick={() => resetPageAndSetFilter("all")}
              className={segmentClass(filter === "all")}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => resetPageAndSetFilter("high-confidence")}
              className={segmentClass(filter === "high-confidence")}
            >
              High confidence
            </button>
          </div>
          <select
            value={sortKey}
            onChange={(event) =>
              resetPageAndSetSort(event.target.value as ResultSortKey)
            }
            className="rounded-[10px] border-[1.5px] border-black/15 bg-white px-3 py-2 text-[0.8125rem] font-bold text-slate-800 outline-none max-sm:w-full"
            aria-label="Sort result rows"
          >
            <option value="confidence">Sort: Confidence</option>
            <option value="peptide-id">Sort: Peptide ID</option>
            <option value="source-description">Sort: Source description</option>
            <option value="sequence-length">Sort: Sequence length</option>
          </select>
        </div>
        <label className="flex w-[260px] items-center gap-2 rounded-[10px] border-[1.5px] border-black/15 bg-white px-3.5 py-2 text-[0.8125rem] shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] max-lg:w-full">
          <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span className="sr-only">Search peptide results</span>
          <input
            type="search"
            value={search}
            onChange={(event) => resetPageAndSetSearch(event.target.value)}
            placeholder="Peptide ID, sequence, or source"
            className="min-w-0 flex-1 border-0 bg-transparent text-slate-800 outline-none placeholder:text-slate-500"
          />
        </label>
      </div>

      <div className="w-full overflow-x-auto max-sm:overflow-visible">
        <table className="w-full border-collapse text-left max-sm:block">
          <thead className="max-sm:absolute max-sm:left-[-9999px] max-sm:top-[-9999px]">
            <tr>
              <th className="table-heading">Rank</th>
              <th className="table-heading">Peptide</th>
              <th className="table-heading">
                <span
                  className="cursor-help border-b border-dotted border-ipb-blue/50"
                  title={CLASSIFIER_SCORE_TOOLTIP}
                >
                  Confidence
                </span>
              </th>
              <th className="table-heading">Result</th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {table.pageRows.map((row) => (
              <tr
                key={row.peptideId}
                className="border-b border-black/[0.03] max-sm:mb-4 max-sm:block max-sm:rounded-2xl max-sm:border max-sm:border-ipb-blue/10 max-sm:bg-white/40 max-sm:p-5"
              >
                <td className="responsive-cell max-sm:before:content-['Rank']">
                  <span className="font-mono text-[0.8125rem] font-bold text-slate-500">
                    {row.rank}
                  </span>
                </td>
                <td className="min-w-[280px] px-5 py-5 max-sm:block max-sm:border-b max-sm:border-ipb-blue/10 max-sm:px-0 max-sm:pb-4">
                  <div className="font-mono text-[0.8125rem] font-extrabold text-ipb-blue">
                    {row.peptideId}
                    <button
                      type="button"
                      aria-label={`Copy peptide sequence for ${row.peptideId}`}
                      title="Copy peptide sequence"
                      onClick={() => {
                        void copySequence(row);
                      }}
                      className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ipb-blue/20 bg-white text-ipb-blue transition hover:border-ipb-blue hover:bg-ipb-blue/10"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  {copiedPeptideId === row.peptideId ? (
                    <div className="mt-1 text-xs font-bold text-emerald-600">
                      Sequence copied
                    </div>
                  ) : null}
                  <div className="mt-1 max-w-[360px] truncate font-mono text-[0.8125rem] text-slate-800 max-sm:max-w-full max-sm:whitespace-normal max-sm:break-all">
                    {row.sequence}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    Source: {row.sourceDescription || "Unavailable"}
                  </div>
                </td>
                <td className="responsive-cell max-sm:before:content-['Confidence']">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-[60px] overflow-hidden rounded bg-black/5">
                      <div
                        className="h-full bg-ipb-blue"
                        style={{ width: row.classifierScoreLabel }}
                      />
                    </div>
                    <span
                      title={CLASSIFIER_SCORE_TOOLTIP}
                      className="cursor-help border-b border-dotted border-ipb-blue/50 font-mono text-[0.8125rem] font-semibold"
                    >
                      {row.classifierScoreLabel}
                    </span>
                  </div>
                </td>
                <td className="responsive-cell max-sm:before:content-['Result']">
                  <span
                    className={[
                      "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold",
                      row.label === "High confidence"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-black/5 text-slate-500",
                    ].join(" ")}
                  >
                    {row.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-black/[0.04] px-5 py-4 text-[0.8125rem] font-bold text-slate-500 max-sm:flex-col max-sm:py-6 max-sm:text-center sm:px-7">
        <span>{paginationText(table.page, table.pageSize, table.filteredRows.length)}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Previous page"
            disabled={table.page === 1}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ipb-blue/20 bg-white text-ipb-blue disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span>
            Page {table.page} of {table.pageCount}
          </span>
          <button
            type="button"
            title="Next page"
            disabled={table.page === table.pageCount}
            onClick={() =>
              setPage((currentPage) =>
                Math.min(table.pageCount, currentPage + 1),
              )
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ipb-blue/20 bg-white text-ipb-blue disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

function segmentClass(active: boolean): string {
  return [
    "rounded-[10px] px-3.5 py-1.5 text-xs font-bold transition max-sm:flex-1",
    active
      ? "bg-white text-ipb-blue shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      : "text-slate-500",
  ].join(" ");
}

function paginationText(page: number, pageSize: number, totalRows: number): string {
  if (totalRows === 0) {
    return "Showing 0 of 0 peptides";
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalRows);

  return `Showing ${start}-${end} of ${totalRows} peptides`;
}
