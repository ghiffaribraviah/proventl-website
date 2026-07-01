import {
  MAX_THRESHOLD,
  MIN_THRESHOLD,
  normalizeThreshold,
  THRESHOLD_STEP,
  thresholdInputValue,
} from "./thresholdInterpretation";

type ThresholdControlProps = {
  appliedThreshold: number;
  disabled?: boolean;
  draftThreshold: string;
  label?: string;
  onApply: () => void;
  onDraftChange: (value: string) => void;
};

export function ThresholdControl({
  appliedThreshold,
  disabled = false,
  draftThreshold,
  label = "Threshold",
  onApply,
  onDraftChange,
}: ThresholdControlProps) {
  const draftNormalized = normalizeThreshold(draftThreshold);
  const isDraftDifferent = draftNormalized !== appliedThreshold;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex min-w-[240px] flex-1 flex-col gap-2">
        <div className="flex justify-between text-[0.75rem] font-bold uppercase tracking-wider text-ipb-blue">
          <span>{label}</span>
          <span className="font-mono font-extrabold">
            {appliedThreshold.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={MIN_THRESHOLD}
          max={MAX_THRESHOLD}
          step={THRESHOLD_STEP}
          value={draftNormalized}
          onChange={(event) => onDraftChange(event.target.value)}
          disabled={disabled}
          className="h-1.5 accent-ipb-blue disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Threshold slider"
        />
      </label>
      <input
        type="number"
        min={MIN_THRESHOLD}
        max={MAX_THRESHOLD}
        step={THRESHOLD_STEP}
        value={draftThreshold}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={() => onDraftChange(thresholdInputValue(draftNormalized))}
        disabled={disabled}
        className="batch-input batch-input-mono w-[88px] py-2 text-center text-[0.8125rem]"
        aria-label="Threshold value"
      />
      <button
        type="button"
        onClick={onApply}
        disabled={disabled}
        className={[
          "batch-apply-btn",
          isDraftDifferent ? "batch-apply-btn--pending" : "",
        ].join(" ")}
      >
        Apply Threshold
      </button>
    </div>
  );
}