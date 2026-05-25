import { describe, expect, it } from "vitest";

import type { TargetPreview } from "../../api/targets";
import {
  formatPreviewSubtitle,
  formatProteinName,
  formatSelectedTargetInput,
  formatTargetKicker,
  formatTargetMetadata,
  selectTarget,
  shouldSearchTargets,
  TARGET_SEARCH_DEBOUNCE_MS,
  updateQueryAndMaybeClearSelection,
} from "./targetDiscovery";

const egfr: TargetPreview = {
  gene: "EGFR",
  organism: "Homo sapiens",
  proteinFamily: "Receptor tyrosine kinase",
  proteinName: "Epidermal growth factor receptor",
  uniprotId: "P01133",
};

describe("target discovery model", () => {
  it("starts backend search only after the minimum query length", () => {
    expect(shouldSearchTargets("")).toBe(false);
    expect(shouldSearchTargets("E")).toBe(false);
    expect(shouldSearchTargets("EG")).toBe(true);
    expect(TARGET_SEARCH_DEBOUNCE_MS).toBe(250);
  });

  it("selects a target without creating prediction state", () => {
    const selected = selectTarget({ query: "eg", selectedTarget: null }, egfr);

    expect(selected.query).toBe("EGFR · P01133");
    expect(selected.selectedTarget).toEqual(egfr);
  });

  it("clears selection when a selected input is edited", () => {
    const nextState = updateQueryAndMaybeClearSelection(
      { query: "EGFR · P01133", selectedTarget: egfr },
      "EGF",
    );

    expect(nextState.clearedSelection).toBe(true);
    expect(nextState.selectedTarget).toBeNull();
    expect(nextState.query).toBe("EGF");
  });

  it("keeps sparse metadata compact", () => {
    const sparseTarget: TargetPreview = { uniprotId: "P00749" };

    expect(formatSelectedTargetInput(sparseTarget)).toBe("P00749");
    expect(formatTargetKicker(sparseTarget)).toBe("P00749");
    expect(formatProteinName(sparseTarget)).toBe("Protein metadata unavailable");
    expect(formatTargetMetadata(sparseTarget)).toBe("Curated target");
    expect(formatPreviewSubtitle(sparseTarget)).toBe("Curated target");
  });

  it("formats enriched target rows with gene, accession, organism, and family", () => {
    expect(formatTargetKicker(egfr)).toBe("EGFR · P01133");
    expect(formatProteinName(egfr)).toBe("Epidermal growth factor receptor");
    expect(formatTargetMetadata(egfr)).toBe(
      "Homo sapiens · Receptor tyrosine kinase",
    );
    expect(formatPreviewSubtitle(egfr)).toBe("Homo sapiens");
  });
});
