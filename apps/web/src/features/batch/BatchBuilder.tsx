import { Search, Upload, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { TargetPreview } from "../../api/targets";
import {
  formatPreviewSubtitle,
  formatProteinName,
  formatTargetKicker,
  formatTargetMetadata,
} from "../targets/targetDiscovery";
import {
  addAccessionsToBasket,
  annotateBasketWithPreviews,
  basketHasAccession,
  parseAccessionList,
  removeAccessionFromBasket,
  type BatchBasket,
  type BatchBasketEntry,
} from "./basket";
import { useDebouncedTargetSearch } from "./useDebouncedTargetSearch";

type BuilderTab = "paste" | "search";

type BatchBuilderProps = {
  basket: BatchBasket;
  draftThreshold: string;
  disabled?: boolean;
  onBasketChange: (basket: BatchBasket) => void;
  onDraftThresholdChange: (value: string) => void;
  onRun: () => void;
};

const BUILDER_EXAMPLES: TargetPreview[] = [
  {
    gene: "EGFR",
    organism: "Homo sapiens",
    proteinName: "Epidermal growth factor receptor",
    uniprotId: "P01133",
  },
  {
    gene: "PLAU",
    organism: "Homo sapiens",
    proteinName: "Urokinase-type plasminogen activator",
    uniprotId: "P00749",
  },
  {
    gene: "CD274",
    organism: "Homo sapiens",
    proteinName: "Programmed cell death 1 ligand 1",
    uniprotId: "Q9NZQ7",
  },
  {
    gene: "TP53",
    organism: "Homo sapiens",
    proteinName: "Cellular tumor antigen p53",
    uniprotId: "P04637",
  },
];

export function BatchBuilder({
  basket,
  draftThreshold,
  disabled = false,
  onBasketChange,
  onDraftThresholdChange,
  onRun,
}: BatchBuilderProps) {
  const [activeTab, setActiveTab] = useState<BuilderTab>("search");
  const { query, results, searchState, setQuery } = useDebouncedTargetSearch();
  const [pasteValue, setPasteValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQuery("");
  }, [setQuery]);

  function addAccessionByPreview(accession: string, preview: TargetPreview | null) {
    const result = addAccessionsToBasket(basket, [accession]);
    if (result.blockedReason === "full" || result.added.length === 0) {
      return;
    }
    const nextBasket = preview
      ? annotateBasketWithPreviews(result.basket, [preview])
      : result.basket;
    onBasketChange(nextBasket);
  }

  function addParsedList(rawText: string) {
    const parsed = parseAccessionList(rawText);
    if (parsed.length === 0) {
      return;
    }
    const result = addAccessionsToBasket(basket, parsed);
    onBasketChange(result.basket);
  }

  function handleFileChosen(file: File) {
    file.text().then((text) => {
      addParsedList(text);
    });
  }

  function removeAccession(accession: string) {
    onBasketChange(removeAccessionFromBasket(basket, accession));
  }

  function clearBasket() {
    onBasketChange({ cap: basket.cap, entries: [] });
  }

  const isFull = basket.entries.length >= basket.cap;
  const hasEntries = basket.entries.length > 0;
  const canRun = hasEntries && !disabled && !isFull;

  return (
    <section className="glass-panel overflow-hidden rounded-3xl">
      <header className="flex items-center justify-between gap-4 border-b border-black/[0.05] px-5 py-5 sm:px-7 sm:py-6">
        <h2 className="batch-card-title">Assemble Targets</h2>
      </header>

      <div className="grid grid-cols-1 gap-8 p-5 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="lg:border-r lg:border-black/[0.06] lg:pr-8">
          <div
            role="tablist"
            aria-label="Target input source"
            className="mb-6 flex gap-4 border-b-[1.5px] border-black/[0.06]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "search"}
              onClick={() => setActiveTab("search")}
              className={[
                "batch-tab-btn",
                activeTab === "search" ? "batch-tab-btn--active" : "",
              ].join(" ")}
            >
              Target Search
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "paste"}
              onClick={() => setActiveTab("paste")}
              className={[
                "batch-tab-btn",
                activeTab === "paste" ? "batch-tab-btn--active" : "",
              ].join(" ")}
            >
              Paste / Upload List
            </button>
          </div>

          {activeTab === "search" ? (
            <SearchTab
              basket={basket}
              disabled={disabled}
              examples={BUILDER_EXAMPLES}
              isLoading={searchState.isLoading}
              query={query}
              results={results}
              onAddAccession={addAccessionByPreview}
              onQueryChange={setQuery}
            />
          ) : (
            <PasteTab
              disabled={disabled}
              fileInputRef={fileInputRef}
              onAddList={addParsedList}
              onFileChosen={handleFileChosen}
              onPickFile={() => fileInputRef.current?.click()}
              pasteValue={pasteValue}
              setPasteValue={setPasteValue}
            />
          )}
        </div>

        <div className="flex flex-col">
          <BasketPanel
            basket={basket}
            disabled={disabled}
            hasEntries={hasEntries}
            isFull={isFull}
            onClear={clearBasket}
            onRemove={removeAccession}
          />

          <RunThresholdGroup
            disabled={disabled}
            draftThreshold={draftThreshold}
            onChange={onDraftThresholdChange}
          />

          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            className="batch-run-btn mt-auto"
          >
            Run Batch Prediction
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
        </div>
      </div>
    </section>
  );
}

type SearchTabProps = {
  basket: BatchBasket;
  disabled: boolean;
  examples: TargetPreview[];
  isLoading: boolean;
  onAddAccession: (accession: string, preview: TargetPreview | null) => void;
  onQueryChange: (value: string) => void;
  query: string;
  results: TargetPreview[];
};

function SearchTab({
  basket,
  disabled,
  examples,
  isLoading,
  onAddAccession,
  onQueryChange,
  query,
  results,
}: SearchTabProps) {
  return (
    <div role="tabpanel" aria-label="Target Search" className="space-y-5">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search UniProt ID, Gene, or Protein Name..."
          autoComplete="off"
          disabled={disabled}
          className="batch-input py-3 text-[0.9375rem]"
          aria-label="Search curated targets for batch"
        />
        <Search
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      </div>

      {query.trim().length >= 2 ? (
        <BatchSearchResults
          basket={basket}
          disabled={disabled}
          isLoading={isLoading}
          onAdd={onAddAccession}
          results={results}
        />
      ) : null}

      <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap max-sm:flex-wrap max-sm:overflow-visible max-sm:whitespace-normal">
        <span className="text-[0.8125rem] font-semibold text-muted">Try:</span>
        {examples.map((example) => {
          const inBasket = basketHasAccession(basket, example.uniprotId);
          return (
            <button
              key={example.uniprotId}
              type="button"
              onClick={() => onAddAccession(example.uniprotId, example)}
              disabled={disabled || inBasket}
              className="batch-example-tag"
            >
              {example.gene} - {example.uniprotId}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type BatchSearchResultsProps = {
  basket: BatchBasket;
  disabled: boolean;
  isLoading: boolean;
  onAdd: (accession: string, preview: TargetPreview | null) => void;
  results: TargetPreview[];
};

function BatchSearchResults({
  basket,
  disabled,
  isLoading,
  onAdd,
  results,
}: BatchSearchResultsProps) {
  return (
    <div className="glass-panel max-h-[260px] overflow-y-auto rounded-xl text-left shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
      {isLoading ? (
        <div className="px-5 py-4 text-[0.8125rem] font-semibold text-muted">
          Searching curated targets...
        </div>
      ) : null}
      {!isLoading && results.length === 0 ? (
        <div className="px-5 py-4 text-[0.8125rem] font-semibold text-muted">
          No matching targets in curated index.
        </div>
      ) : null}
      {!isLoading
        ? results.map((target) => {
            const inBasket = basketHasAccession(basket, target.uniprotId);
            return (
              <div
                key={target.uniprotId}
                className="flex items-center justify-between gap-6 border-b border-ipb-blue/[0.08] bg-white/55 px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-extrabold tracking-wide text-ipb-blue">
                    {formatTargetKicker(target)}
                  </div>
                  <div className="mt-1 font-bold text-fg">
                    {formatProteinName(target)}
                  </div>
                  <div className="mt-0.5 text-[0.8125rem] text-muted">
                    {formatPreviewSubtitle(target)}
                  </div>
                  {formatTargetMetadata(target) === "Curated target" ? null : (
                    <div className="mt-0.5 text-[0.75rem] font-semibold text-muted">
                      {formatTargetMetadata(target)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(target.uniprotId, target)}
                  disabled={disabled || inBasket}
                  className={[
                    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[0.8125rem] font-bold transition",
                    inBasket
                      ? "cursor-default border border-success/40 bg-success/[0.05] text-success"
                      : "border border-ipb-blue bg-transparent text-ipb-blue hover:bg-ipb-blue/[0.08]",
                  ].join(" ")}
                  aria-label={`Add ${target.uniprotId} to batch`}
                >
                  {inBasket ? "Added" : "+ Add to batch"}
                </button>
              </div>
            );
          })
        : null}
    </div>
  );
}

type PasteTabProps = {
  disabled: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAddList: (rawText: string) => void;
  onFileChosen: (file: File) => void;
  onPickFile: () => void;
  pasteValue: string;
  setPasteValue: (value: string) => void;
};

function PasteTab({
  disabled,
  fileInputRef,
  onAddList,
  onFileChosen,
  onPickFile,
  pasteValue,
  setPasteValue,
}: PasteTabProps) {
  return (
    <div role="tabpanel" aria-label="Paste / Upload List" className="space-y-3">
      <textarea
        value={pasteValue}
        onChange={(event) => setPasteValue(event.target.value)}
        placeholder={
          "P01133, P00749\nP04637\nEnter UniProt accessions separated by commas or newlines..."
        }
        rows={5}
        disabled={disabled}
        className="batch-textarea"
        aria-label="Paste UniProt accessions"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onAddList(pasteValue)}
          disabled={disabled || pasteValue.trim().length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-ipb-blue px-5 py-2.5 text-[0.875rem] font-bold text-white transition hover:-translate-y-px hover:bg-ipb-blue-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Add List
        </button>
        <button
          type="button"
          onClick={onPickFile}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-ipb-blue/30 bg-white px-5 py-2.5 text-[0.875rem] font-bold text-ipb-blue transition hover:-translate-y-px hover:border-ipb-blue hover:bg-ipb-blue/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Upload .txt / .csv
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,text/plain,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onFileChosen(file);
              event.target.value = "";
            }
          }}
        />
        <span className="text-[0.75rem] font-semibold text-muted">
          Authorization is decided by the backend after Run batch.
        </span>
      </div>
    </div>
  );
}

type BasketPanelProps = {
  basket: BatchBasket;
  disabled: boolean;
  hasEntries: boolean;
  isFull: boolean;
  onClear: () => void;
  onRemove: (accession: string) => void;
};

function BasketPanel({
  basket,
  disabled,
  hasEntries,
  isFull,
  onClear,
  onRemove,
}: BasketPanelProps) {
  const chipList = useMemo(
    () => basket.entries.slice().sort((a, b) => a.addedAt - b.addedAt),
    [basket.entries],
  );

  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[0.875rem] font-extrabold uppercase tracking-wider text-fg">
          Targets in batch ({basket.entries.length} / {basket.cap})
        </span>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || !hasEntries}
          className="batch-clear-btn disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      <div
        className={[
          "batch-cap-warning",
          isFull ? "batch-cap-warning--visible" : "",
        ].join(" ")}
      >
        Batch is full ({basket.cap} max). Remove targets to add more.
      </div>

      <div className="mb-5 flex max-h-[180px] min-h-[100px] flex-wrap content-start gap-2 overflow-y-auto rounded-xl border-[1.5px] border-dashed border-black/[0.08] bg-black/[0.02] p-3">
        {chipList.length === 0 ? (
          <span className="m-auto py-6 text-center text-[0.8125rem] font-medium text-muted">
            Basket is empty. Search for targets on the left or paste an
            accession list to add.
          </span>
        ) : (
          chipList.map((entry) => (
            <BasketChip
              key={entry.accession}
              disabled={disabled}
              entry={entry}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </div>
  );
}

type BasketChipProps = {
  disabled: boolean;
  entry: BatchBasketEntry;
  onRemove: (accession: string) => void;
};

function BasketChip({ disabled, entry, onRemove }: BasketChipProps) {
  return (
    <span className="batch-chip">
      <span>{entry.accession}</span>
      <button
        type="button"
        onClick={() => onRemove(entry.accession)}
        disabled={disabled}
        aria-label={`Remove ${entry.accession} from batch`}
        className="inline-flex h-5 w-5 items-center justify-center text-muted transition hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

type RunThresholdGroupProps = {
  disabled: boolean;
  draftThreshold: string;
  onChange: (value: string) => void;
};

function RunThresholdGroup({
  disabled,
  draftThreshold,
  onChange,
}: RunThresholdGroupProps) {
  const id = useId();
  return (
    <div className="mb-6 rounded-xl border border-black/[0.04] bg-black/[0.02] p-3">
      <div className="mb-1.5 flex items-center justify-between text-[0.75rem] font-bold uppercase tracking-wider text-ipb-blue">
        <label htmlFor={`${id}-slider`}>Run Threshold</label>
        <span className="font-mono font-extrabold text-ipb-blue">
          {draftThreshold}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          id={`${id}-slider`}
          type="range"
          min={0.5}
          max={0.99}
          step={0.01}
          value={Number.isFinite(Number(draftThreshold)) ? draftThreshold : 0.95}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-1.5 flex-1 accent-ipb-blue disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Run threshold slider"
        />
        <input
          id={`${id}-input`}
          type="number"
          min={0.5}
          max={0.99}
          step={0.01}
          value={draftThreshold}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="batch-input batch-input-mono w-[80px] py-2 text-center text-[0.8125rem]"
          aria-label="Run threshold value"
        />
      </div>
    </div>
  );
}
