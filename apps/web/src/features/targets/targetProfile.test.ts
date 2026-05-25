import { describe, expect, it } from "vitest";

import type { TargetPreview } from "../../api/targets";
import { targetProfileRows, uniprotEntryUrl } from "./targetProfile";
import { TARGET_PROFILE_LAYOUT_CLASS } from "./components/TargetProfile";

describe("target profile model", () => {
  it("renders complete metadata rows and safe UniProt link", () => {
    const target: TargetPreview = {
      functionSummary: "Receptor tyrosine kinase.",
      gene: "EGFR",
      molecularWeight: "134.2 kDa",
      organism: "Homo sapiens",
      proteinFamily: "Receptor tyrosine kinase",
      proteinName: "Epidermal growth factor receptor",
      sequenceLength: "1210",
      uniprotId: "P01133",
    };

    expect(targetProfileRows(target).map((row) => row.label)).toEqual([
      "UniProt Entry",
      "Gene Symbol",
      "Protein Name",
      "Organism",
      "Protein Family",
      "Sequence Length",
      "Molecular Weight",
      "Function Summary",
    ]);
    expect(uniprotEntryUrl(target)).toBe(
      "https://www.uniprot.org/uniprotkb/P01133/entry",
    );
  });

  it("keeps sparse metadata compact", () => {
    const target: TargetPreview = { uniprotId: "P00749" };

    expect(targetProfileRows(target)).toEqual([
      { label: "UniProt Entry", mono: true, value: "P00749" },
      { label: "Gene Symbol", value: "Unavailable" },
    ]);
  });

  it("handles unsupported metadata without requiring prediction eligibility", () => {
    const target: TargetPreview = {
      gene: "IKKB",
      organism: "Homo sapiens",
      proteinName: "Inhibitor of nuclear factor kappa-B kinase subunit beta",
      uniprotId: "Q9Y6K9",
    };

    expect(targetProfileRows(target).map((row) => row.value)).toContain("IKKB");
    expect(uniprotEntryUrl(target)).toContain("Q9Y6K9");
  });

  it("uses a mobile-stacking dashboard profile layout", () => {
    expect(TARGET_PROFILE_LAYOUT_CLASS).toContain("grid");
    expect(TARGET_PROFILE_LAYOUT_CLASS).toContain("lg:grid-cols");
  });
});
