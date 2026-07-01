import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BatchBuilder } from "../features/batch/BatchBuilder";
import { BatchDrillIn } from "../features/batch/BatchDrillIn";
import { BatchLoader } from "../features/batch/BatchLoader";
import { BatchRejectedReport } from "../features/batch/BatchRejectedReport";
import { BatchSummaryList } from "../features/batch/BatchSummaryList";
import {
  findBatchSummaryRow,
  type BatchBasket,
  type BatchSummaryRow,
} from "../features/batch/basket";
import { useBatchWorkflow } from "../features/batch/useBatchWorkflow";
import { ThresholdControl } from "../features/results/ThresholdControl";
import {
  batchCsvFilename,
  buildBatchResultsCsv,
} from "../features/results/exportResults";
import { toResultTableRow } from "../features/results/resultTable";
import {
  applyThresholdToPredictionResponse,
  normalizeThreshold,
  thresholdInputValue,
} from "../features/results/thresholdInterpretation";
import {
  readBatchUrlState,
  updateBatchUrl,
} from "../features/results/urlState";

export function BatchPage() {
  const initialThreshold = useMemo(
    () => readBatchUrlState(window.location).threshold,
    [],
  );

  const workflow = useBatchWorkflow();
  const {
    applyThresholdLocally,
    basket,
    clearResults,
    runBatch,
    setBasketState,
    state,
    summaryRows,
    totalHighConfidence,
  } = workflow;

  const [draftThreshold, setDraftThreshold] = useState<string>(() =>
    thresholdInputValue(initialThreshold),
  );
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const urlInitialized = useRef(false);

  useEffect(() => {
    if (urlInitialized.current) {
      return;
    }
    urlInitialized.current = true;
    updateBatchUrl(normalizeThreshold(draftThreshold));
  }, [draftThreshold]);

  const handleRun = useCallback(async () => {
    if (basket.entries.length === 0 || state.status === "loading") {
      return;
    }
    const threshold = normalizeThreshold(draftThreshold);
    setSelectedTargetId(null);
    const response = await runBatch(
      basket.entries.map((entry) => entry.accession),
      threshold,
    );
    if (response) {
      updateBatchUrl(response.threshold);
    }
  }, [basket.entries, draftThreshold, runBatch, state.status]);

  const handleApplyThreshold = useCallback(() => {
    const threshold = normalizeThreshold(draftThreshold);
    applyThresholdLocally(threshold);
    updateBatchUrl(threshold);
  }, [applyThresholdLocally, draftThreshold]);

  const handleDrillThresholdApplied = useCallback(
    (threshold: number) => {
      applyThresholdLocally(threshold);
      updateBatchUrl(threshold);
      setDraftThreshold(thresholdInputValue(threshold));
    },
    [applyThresholdLocally],
  );

  const handleClearResults = useCallback(() => {
    clearResults();
    setSelectedTargetId(null);
  }, [clearResults]);

  const handleBasketChange = useCallback(
    (nextBasket: BatchBasket) => {
      setBasketState(nextBasket);
    },
    [setBasketState],
  );

  const handleExportBatchCsv = useCallback(() => {
    if (state.status !== "success" || !state.response) {
      return;
    }
    const rowsByTarget = new Map<string, ReturnType<typeof toResultTableRow>[]>();
    for (const result of state.response.results) {
      const accession = result.target.uniprotId;
      rowsByTarget.set(
        accession,
        result.predictions.map(toResultTableRow),
      );
    }
    const csv = buildBatchResultsCsv(state.response, rowsByTarget);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = batchCsvFilename(state.response);
    link.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const isRunning = state.status === "loading";
  const selectedRow =
    selectedTargetId && state.status === "success" && state.response
      ? findBatchSummaryRow(summaryRows, selectedTargetId)
      : null;
  const drillInResponse =
    selectedRow && state.status === "success" && state.response
      ? applyThresholdToPredictionResponse(
          selectedRow.response,
          state.appliedThreshold,
        )
      : null;
  const showResultsPanel = !isRunning && state.status === "success";
  const showErrorPanel = !isRunning && state.status === "error";

  return (
    <div className="space-y-12">
      <header className="mx-auto max-w-none pt-2 text-center sm:pt-6">
        <h1 className="font-display text-4xl font-extrabold leading-tight text-ipb-blue sm:text-5xl">
          Batch Prediction Dashboard
        </h1>
        <p className="mt-4 text-base text-muted sm:text-lg">
          Run prediction across many curated targets at once. Up to 50 targets
          per batch.
        </p>
      </header>

      <BatchBuilder
        basket={basket}
        disabled={isRunning}
        draftThreshold={draftThreshold}
        onBasketChange={handleBasketChange}
        onDraftThresholdChange={setDraftThreshold}
        onRun={() => void handleRun()}
      />

      {isRunning ? <BatchLoader targetCount={basket.entries.length} /> : null}

      {showErrorPanel ? (
        <section
          id="error-panel"
          className="glass-panel rounded-3xl border-l-[6px] border-l-danger px-7 py-6"
        >
          <div className="text-danger">
            <p className="font-extrabold">Prediction could not be completed.</p>
          </div>
          <p className="mt-1 text-sm font-semibold text-muted">
            {state.error ??
              "The selected targets remain available in the basket. Use Retry after checking the backend connection or model status."}
          </p>
          <button
            type="button"
            onClick={() => void handleRun()}
            className="batch-run-btn mt-5 max-w-[260px]"
          >
            Retry
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </section>
      ) : null}

      {showResultsPanel && state.response ? (
        <BatchResultsCard
          appliedThreshold={state.appliedThreshold}
          canApplyThreshold={!isRunning}
          drillInResponse={drillInResponse}
          draftThreshold={draftThreshold}
          onApplyThreshold={handleApplyThreshold}
          onDrillThresholdApplied={handleDrillThresholdApplied}
          onDraftThresholdChange={setDraftThreshold}
          onExport={handleExportBatchCsv}
          onSelectTarget={setSelectedTargetId}
          response={state.response}
          selectedRow={selectedRow}
          summaryRows={summaryRows}
          totalHighConfidence={totalHighConfidence}
        />
      ) : null}
    </div>
  );
}

type BatchResultsCardProps = {
  appliedThreshold: number;
  canApplyThreshold: boolean;
  drillInResponse: ReturnType<typeof applyThresholdToPredictionResponse> | null;
  draftThreshold: string;
  onApplyThreshold: () => void;
  onDrillThresholdApplied: (threshold: number) => void;
  onDraftThresholdChange: (value: string) => void;
  onExport: () => void;
  onSelectTarget: (uniprotId: string | null) => void;
  response: NonNullable<
    ReturnType<typeof useBatchWorkflow>["state"] extends infer S
      ? S extends { status: "success"; response: infer R }
        ? R
        : never
      : never
  >;
  selectedRow: BatchSummaryRow | null;
  summaryRows: BatchSummaryRow[];
  totalHighConfidence: number;
};

function BatchResultsCard({
  appliedThreshold,
  canApplyThreshold,
  drillInResponse,
  draftThreshold,
  onApplyThreshold,
  onDrillThresholdApplied,
  onDraftThresholdChange,
  onExport,
  onSelectTarget,
  response,
  selectedRow,
  summaryRows,
  totalHighConfidence,
}: BatchResultsCardProps) {
  if (selectedRow && drillInResponse) {
    return (
      <BatchDrillIn
        onBack={() => onSelectTarget(null)}
        onThresholdApplied={onDrillThresholdApplied}
        response={drillInResponse}
      />
    );
  }

  return (
    <>
      <section
        id="batch-results-panel"
        className="glass-panel overflow-hidden rounded-3xl"
      >
        <header className="flex flex-col gap-3 border-b border-black/[0.05] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div>
            <h2 id="batch-results-title" className="batch-card-title">
              Batch Results
            </h2>
            <div id="batch-results-summary" className="mt-1 text-[0.8125rem] font-semibold text-muted">
              {response.summary.succeeded} of {response.summary.submitted} targets
              predicted · {response.summary.rejected} rejected ·{" "}
              {totalHighConfidence} high-confidence peptides total · threshold{" "}
              {appliedThreshold.toFixed(2)}
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onExport}
              className="batch-apply-btn"
              title="Exports all targets × all peptides in the batch."
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export Batch CSV
            </button>
          </div>
        </header>

        <div className="border-b border-black/[0.05] px-5 py-5 sm:px-7">
          <ThresholdControl
            appliedThreshold={appliedThreshold}
            disabled={!canApplyThreshold}
            draftThreshold={draftThreshold}
            label="Threshold (Governs All Targets)"
            onApply={onApplyThreshold}
            onDraftChange={onDraftThresholdChange}
          />
        </div>

        {response.rejected.length > 0 || response.summary.deduped > 0 ? (
          <BatchRejectedReport
            dedupedCount={response.summary.deduped}
            rejected={response.rejected}
            summary={response.summary}
          />
        ) : null}

        <BatchSummaryList
          onSelectTarget={onSelectTarget}
          rows={summaryRows}
          selectedUniprotId={selectedRow?.uniprotId ?? null}
        />

        <div className="batch-summary-note">
          <span className="font-bold text-ipb-blue">
            Note: Click on any row to drill into individual predictions and
            filters.
          </span>
          <span className="font-semibold text-muted">
            Max 50 rows per batch
          </span>
        </div>
      </section>
    </>
  );
}