import type { TargetPreview } from "../../api/targets";

export type TargetProfileRow = {
  label: string;
  mono?: boolean;
  optional?: boolean;
  value: string;
};

export function targetProfileRows(target: TargetPreview): TargetProfileRow[] {
  return [
    { label: "UniProt Entry", mono: true, value: target.uniprotId },
    requiredRow("Gene Symbol", target.gene),
    optionalRow("Protein Name", target.proteinName),
    optionalRow("Organism", target.organism),
    optionalRow("Protein Family", target.proteinFamily),
    optionalRow("Sequence Length", target.sequenceLength),
    optionalRow("Molecular Weight", target.molecularWeight),
    optionalRow("Function Summary", target.functionSummary),
  ].filter((row): row is TargetProfileRow => row !== null);
}

export function uniprotEntryUrl(target: TargetPreview): string {
  return `https://www.uniprot.org/uniprotkb/${encodeURIComponent(
    target.uniprotId,
  )}/entry`;
}

function requiredRow(label: string, value: string | undefined): TargetProfileRow {
  return {
    label,
    value: value ?? "Unavailable",
  };
}

function optionalRow(
  label: string,
  value: string | undefined,
): TargetProfileRow | null {
  return value ? { label, optional: true, value } : null;
}
