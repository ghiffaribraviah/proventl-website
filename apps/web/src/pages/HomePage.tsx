import {
  ArrowRight,
  Info,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { DEFAULT_THRESHOLD } from "../features/results/thresholdInterpretation";
import { readResultUrlState, updateResultUrl } from "../features/results/urlState";
import { lookupTarget, type TargetLookupResult, type TargetPreview } from "../api/targets";
import type { PredictionWorkflowState } from "../features/predictions/predictionWorkflow";
import { usePredictionWorkflow } from "../features/predictions/usePredictionWorkflow";
import { ResultsDashboard } from "../features/results/ResultsDashboard";
import {
  TARGET_PROFILE_LAYOUT_CLASS,
  TargetProfile,
} from "../features/targets/components/TargetProfile";
import {
  formatPreviewSubtitle,
  formatProteinName,
  formatSelectedTargetInput,
  formatTargetKicker,
  formatTargetMetadata,
} from "../features/targets/targetDiscovery";
import { useTargetDiscovery } from "../features/targets/useTargetDiscovery";

export function HomePage() {
  const prediction = usePredictionWorkflow();
  const restoredUrl = useRef(false);
  const {
    examples,
    examplesState,
    handleLookupSubmit,
    handleQueryChange,
    handleSelectTarget,
    lookupResult,
    lookupState,
    query,
    searchResults,
    searchState,
    selectedTarget,
    shouldShowExamples,
    shouldShowSearchResults,
  } = useTargetDiscovery({
    onClearResults: prediction.clearForTargetChange,
  });

  const handlePredict = () => {
    if (!selectedTarget || prediction.state.status === "loading") {
      return;
    }

    void prediction
      .predict(selectedTarget, DEFAULT_THRESHOLD)
      .then((result) => {
        if (result) {
          updateResultUrl(result.target.uniprotId, result.threshold);
        }
      });
  };

  useEffect(() => {
    if (restoredUrl.current) {
      return;
    }
    restoredUrl.current = true;

    const urlState = readResultUrlState(window.location);
    if (!urlState.target) {
      return;
    }

    let cancelled = false;

    lookupTarget(urlState.target)
      .then((lookupResult) => {
        if (
          cancelled ||
          lookupResult.state !== "available-curated" ||
          !lookupResult.target
        ) {
          return null;
        }

        handleSelectTarget(lookupResult.target);
        return prediction.predict(lookupResult.target, urlState.threshold);
      })
      .then((result) => {
        if (!cancelled && result) {
          updateResultUrl(result.target.uniprotId, result.threshold);
        }
      })
      .catch(() => {
        // URL restoration is best-effort; the visible lookup flow remains available.
      });

    return () => {
      cancelled = true;
    };
  }, [handleSelectTarget, prediction, restoredUrl]);

  return (
    <div className="space-y-8">
      <section className="mx-auto max-w-[720px] pt-4 text-center sm:pt-8">
        <h1 className="font-display text-4xl font-extrabold leading-tight text-ipb-blue sm:text-5xl">
          Predict venom peptide interactions.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">
          Search a curated protein target, confirm prediction support, then run
          classifier scoring against the venom peptide set.
        </p>

        <form
          className="glass-panel mt-9 flex gap-2 rounded-3xl p-2 text-left max-sm:flex-col max-sm:rounded-2xl max-sm:p-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleLookupSubmit();
          }}
        >
          <label className="flex min-w-0 flex-1 items-center gap-3 px-4 max-sm:justify-center max-sm:px-3">
            <Search className="h-5 w-5 shrink-0 text-slate-400 max-sm:hidden" />
            <span className="sr-only">Target protein search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-3.5 text-[1.0625rem] text-slate-800 outline-none placeholder:text-slate-400 max-sm:text-center max-sm:text-base max-sm:placeholder:text-[0.9375rem]"
              placeholder="Search UniProt ID, gene, or protein name"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-ipb-blue px-6 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(38,60,146,0.20)] transition hover:-translate-y-0.5 hover:bg-ipb-blue-dark max-sm:py-3"
          >
            {lookupState.isLoading ? "Looking up" : "Search"}
          </button>
        </form>

        {shouldShowSearchResults ? (
          <SearchResults
            isLoading={searchState.isLoading}
            error={searchState.error}
            results={searchResults}
            onSelectTarget={handleSelectTarget}
          />
        ) : null}

        {lookupState.error ? (
          <LookupMessage tone="error" message={lookupState.error} />
        ) : null}

        {shouldShowExamples ? (
          <Examples
            examples={examples}
            error={examplesState.error}
            isLoading={examplesState.isLoading}
            onSelectTarget={handleSelectTarget}
          />
        ) : null}
      </section>

      <TargetPreviewPanel
        lookupResult={lookupResult}
        onPredict={handlePredict}
        predictionState={prediction.state}
        target={selectedTarget}
      />

      <PredictionInlineState
        onRetry={handlePredict}
        predictionState={prediction.state}
      />
    </div>
  );
}

type LookupMessageProps = {
  message: string;
  tone: "error" | "warning";
};

function LookupMessage({ message, tone }: LookupMessageProps) {
  return (
    <div
      className={[
        "glass-panel mt-3 rounded-2xl px-5 py-4 text-left text-sm font-semibold",
        tone === "error" ? "text-red-600" : "text-slate-600",
      ].join(" ")}
    >
      {message}
    </div>
  );
}

type ExamplesProps = {
  error: string | null;
  examples: TargetPreview[];
  isLoading: boolean;
  onSelectTarget: (target: TargetPreview) => void;
};

function Examples({
  error,
  examples,
  isLoading,
  onSelectTarget,
}: ExamplesProps) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      <span className="text-[0.8125rem] font-semibold text-slate-500">
        Try:
      </span>
      {isLoading ? (
        <span className="text-[0.8125rem] font-semibold text-slate-500">
          Loading curated examples...
        </span>
      ) : null}
      {error ? (
        <span className="text-[0.8125rem] font-semibold text-slate-500">
          {error}
        </span>
      ) : null}
      {!isLoading && !error
        ? examples.map((example) => (
            <button
              key={example.uniprotId}
              type="button"
              onClick={() => onSelectTarget(example)}
              className="rounded-full border border-white/70 bg-white/45 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-slate-500 transition hover:border-ipb-blue hover:bg-white hover:text-ipb-blue"
            >
              {formatSelectedTargetInput(example)}
            </button>
          ))
        : null}
    </div>
  );
}

type SearchResultsProps = {
  error: string | null;
  isLoading: boolean;
  onSelectTarget: (target: TargetPreview) => void;
  results: TargetPreview[];
};

function SearchResults({
  error,
  isLoading,
  onSelectTarget,
  results,
}: SearchResultsProps) {
  return (
    <div className="glass-panel mt-3 overflow-hidden rounded-[18px] text-left">
      {isLoading ? (
        <div className="px-5 py-4 text-sm font-semibold text-slate-500">
          Searching curated targets...
        </div>
      ) : null}
      {error ? (
        <div className="px-5 py-4 text-sm font-semibold text-slate-500">
          {error}
        </div>
      ) : null}
      {!isLoading && !error && results.length === 0 ? (
        <div className="px-5 py-4 text-sm font-semibold text-slate-500">
          No curated targets found.
        </div>
      ) : null}
      {!isLoading && !error
        ? results.map((target) => (
            <button
              key={target.uniprotId}
              type="button"
              onClick={() => onSelectTarget(target)}
              className="block w-full border-b border-ipb-blue/10 bg-white/55 px-5 py-4 text-left transition last:border-b-0 hover:bg-white"
            >
              <div className="font-mono text-xs font-extrabold text-ipb-blue">
                {formatTargetKicker(target)}
              </div>
              <div className="mt-1 font-bold text-slate-800">
                {formatProteinName(target)}
              </div>
              <div className="mt-0.5 text-[0.8125rem] text-slate-500">
                {formatTargetMetadata(target)}
              </div>
            </button>
          ))
        : null}
    </div>
  );
}

type TargetPreviewPanelProps = {
  lookupResult: TargetLookupResult | null;
  onPredict: () => void;
  predictionState: PredictionWorkflowState;
  target: TargetPreview | null;
};

function TargetPreviewPanel({
  lookupResult,
  onPredict,
  predictionState,
  target,
}: TargetPreviewPanelProps) {
  const previewTarget = target ?? lookupResult?.target ?? null;
  const predictionEligible = Boolean(target);
  const isPredicting = predictionState.status === "loading";
  const predictLabel =
    predictionState.status === "error" && predictionEligible
      ? "Retry"
      : isPredicting
        ? "Predicting"
        : "Predict";
  const unsupportedTarget =
    lookupResult?.state === "valid-but-not-available" ? lookupResult : null;
  const lookupProblem =
    lookupResult &&
    lookupResult.state !== "available-curated" &&
    lookupResult.state !== "valid-but-not-available"
      ? lookupResult
      : null;

  return (
    <section className="glass-panel mx-auto max-w-[760px] overflow-hidden rounded-3xl border-l-[6px] border-l-ipb-blue p-6 sm:p-8 lg:p-10">
      {previewTarget ? (
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-md bg-ipb-blue/10 px-3 py-1 font-mono text-xs font-bold text-ipb-blue">
                {previewTarget.uniprotId}
              </span>
              <span className="text-[0.8125rem] font-semibold uppercase tracking-normal text-slate-500">
                {formatPreviewSubtitle(previewTarget)}
              </span>
            </div>
            <h2 className="font-display text-2xl font-extrabold leading-tight text-ipb-blue sm:text-[1.75rem]">
              {formatProteinName(previewTarget)}
            </h2>
            <p className="mt-1 text-[1.0625rem] font-medium text-slate-500">
              Gene: {previewTarget.gene ?? "Unavailable"}
            </p>
            {unsupportedTarget ? (
              <p className="mt-3 rounded-xl bg-ipb-yellow/25 px-4 py-3 text-sm font-semibold text-slate-700">
                {unsupportedTarget.message}
              </p>
            ) : null}
          </div>

          <div className="flex min-w-[220px] flex-col gap-3">
            <button
              type="button"
              disabled={!predictionEligible || isPredicting}
              onClick={onPredict}
              className={[
                "inline-flex w-full items-center justify-center gap-3 rounded-2xl px-8 py-4 text-[1.0625rem] font-extrabold text-white",
                predictionEligible
                  ? "bg-ipb-blue shadow-[0_10px_25px_rgba(38,60,146,0.20)] transition hover:-translate-y-0.5 hover:bg-ipb-blue-dark"
                  : "bg-slate-300",
              ].join(" ")}
            >
              {predictLabel}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <p className="text-center text-xs font-medium text-slate-500">
              {predictionEligible
                ? "Prediction remains explicit and target-scoped."
                : "Prediction is not available."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-center">
          <h2 className="font-display text-2xl font-extrabold leading-tight text-ipb-blue">
            Select a curated target
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-6 text-slate-500">
            Curated examples and search results prepare a target preview here.<br></br>
            Prediction stays disabled until a protein target is selected.
          </p>
          {lookupProblem ? (
            <p className="mx-auto max-w-xl rounded-xl bg-white/55 px-4 py-3 text-sm font-semibold text-slate-600">
              {lookupProblem.message}
            </p>
          ) : null}
          <button
            type="button"
            disabled
            className="mx-auto mt-2 inline-flex min-w-[220px] items-center justify-center gap-3 rounded-2xl bg-slate-300 px-8 py-4 text-[1.0625rem] font-extrabold text-white"
          >
            Predict
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

type PredictionInlineStateProps = {
  onRetry: () => void;
  predictionState: PredictionWorkflowState;
};

function PredictionInlineState({
  onRetry,
  predictionState,
}: PredictionInlineStateProps) {
  if (predictionState.status === "idle") {
    return null;
  }

  if (predictionState.status === "loading") {
    return (
      <section className="glass-panel mx-auto max-w-[760px] rounded-3xl p-6 text-center">
        <p className="font-display text-xl font-extrabold text-ipb-blue">
          Running prediction
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Scoring the selected target against the curated venom peptide set.
          Target controls remain available while this request completes.
        </p>
      </section>
    );
  }

  if (predictionState.status === "error") {
    return (
      <section className="glass-panel mx-auto max-w-[760px] rounded-3xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-extrabold text-ipb-blue">
              Prediction could not be completed
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {predictionState.error}
            </p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-2xl bg-ipb-blue px-6 py-3 text-sm font-extrabold text-white"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={TARGET_PROFILE_LAYOUT_CLASS}>
      <ResultsDashboard
        response={predictionState.result}
        onThresholdApplied={updateResultUrl}
      />
      <TargetProfile target={predictionState.result.target} />
    </section>
  );
}

type WorkflowCardProps = {
  body: string;
  icon: typeof ShieldCheck;
  title: string;
};

function WorkflowCard({ body, icon: Icon, title }: WorkflowCardProps) {
  return (
    <article className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-ipb-yellow/35 text-ipb-blue">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-extrabold text-ipb-blue">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </article>
  );
}
