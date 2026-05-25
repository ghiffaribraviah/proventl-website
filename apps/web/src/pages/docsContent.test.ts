import { describe, expect, it } from "vitest";

import { BIBTEX, PLAIN_CITATION } from "./CitationPage";
import { DOCS_WORKFLOW_SECTIONS } from "./DocsPage";
import { METHODOLOGY_STEPS, V1_OMISSIONS } from "./MethodologyPage";

describe("website docs content", () => {
  it("covers search, prediction, threshold, filtering, and export workflow", () => {
    const text = DOCS_WORKFLOW_SECTIONS.map(
      (section) => `${section.title} ${section.body}`,
    ).join(" ");

    expect(text).toContain("Search");
    expect(text).toContain("Predict");
    expect(text).toContain("threshold");
    expect(text).toContain("Filter");
    expect(text).toContain("export");
  });

  it("includes a lightweight methodology diagram sequence", () => {
    expect(METHODOLOGY_STEPS).toEqual([
      "Curated cancer target",
      "Curated venom peptide set",
      "ProtT5 embeddings",
      "SAE-DNN classifier",
      "Ranked peptide predictions",
    ]);
  });

  it("documents V1 scientific omissions and validation limits", () => {
    expect(V1_OMISSIONS).toContain("z-score");
    expect(V1_OMISSIONS).toContain("p-value");
    expect(V1_OMISSIONS).toContain("percentile");
  });

  it("contains citation and BibTeX content", () => {
    expect(PLAIN_CITATION).toContain("Adhiva et al. (2026)");
    expect(BIBTEX).toContain("@article");
    expect(BIBTEX).toContain("adhiva2026proventl");
  });
});
