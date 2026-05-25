import type { TargetPreview } from "../../api/targets";

export const TARGET_SEARCH_MIN_LENGTH = 2;
export const TARGET_SEARCH_DEBOUNCE_MS = 250;

export type TargetSelectionState = {
  query: string;
  selectedTarget: TargetPreview | null;
};

export function shouldSearchTargets(query: string): boolean {
  return query.trim().length >= TARGET_SEARCH_MIN_LENGTH;
}

export function selectTarget(
  state: TargetSelectionState,
  target: TargetPreview,
): TargetSelectionState {
  return {
    ...state,
    query: formatSelectedTargetInput(target),
    selectedTarget: target,
  };
}

export function updateQueryAndMaybeClearSelection(
  state: TargetSelectionState,
  nextQuery: string,
): TargetSelectionState & { clearedSelection: boolean } {
  const selectedLabel = state.selectedTarget
    ? formatSelectedTargetInput(state.selectedTarget)
    : null;
  const clearedSelection =
    state.selectedTarget !== null && nextQuery !== selectedLabel;

  return {
    query: nextQuery,
    selectedTarget: clearedSelection ? null : state.selectedTarget,
    clearedSelection,
  };
}

export function formatSelectedTargetInput(target: TargetPreview): string {
  return target.gene
    ? `${target.gene} · ${target.uniprotId}`
    : target.uniprotId;
}

export function formatTargetKicker(target: TargetPreview): string {
  return target.gene
    ? `${target.gene} · ${target.uniprotId}`
    : target.uniprotId;
}

export function formatProteinName(target: TargetPreview): string {
  return target.proteinName ?? "Protein metadata unavailable";
}

export function formatTargetMetadata(target: TargetPreview): string {
  const parts = [target.organism, target.proteinFamily].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(" · ") : "Curated target";
}

export function formatPreviewSubtitle(target: TargetPreview): string {
  return target.organism ?? target.proteinFamily ?? "Curated target";
}
