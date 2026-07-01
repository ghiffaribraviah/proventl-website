import type { TargetPreview } from "../../api/targets";
import {
  DEFAULT_BATCH_MAX_TARGETS,
  type BatchPredictionResponse,
  type PredictionResponse,
} from "../../api/predictions";
import { classifyScoreAtThreshold } from "../results/thresholdInterpretation";

export const BATCH_BASKET_CAP = DEFAULT_BATCH_MAX_TARGETS;

export type BatchBasketEntry = {
  addedAt: number;
  accession: string;
  preview: TargetPreview | null;
};

export type BatchBasket = {
  cap: number;
  entries: BatchBasketEntry[];
};

export function createBatchBasket(cap: number = BATCH_BASKET_CAP): BatchBasket {
  return { cap, entries: [] };
}

export function normalizeAccession(value: string): string {
  return value.trim().toUpperCase();
}

export function parseAccessionList(rawText: string): string[] {
  if (!rawText) {
    return [];
  }

  const tokens = rawText.split(/[\s,;]+/);
  const candidates: string[] = [];
  for (const token of tokens) {
    const normalized = normalizeAccession(token);
    if (normalized) {
      candidates.push(normalized);
    }
  }

  return candidates;
}

export function basketHasAccession(
  basket: BatchBasket,
  accession: string,
): boolean {
  const normalized = normalizeAccession(accession);

  return basket.entries.some(
    (entry) => entry.accession === normalized,
  );
}

export type AddToBasketResult = {
  added: BatchBasketEntry[];
  basket: BatchBasket;
  blockedReason: "full" | null;
  duplicate: boolean;
};

export function addAccessionsToBasket(
  basket: BatchBasket,
  accessions: string[],
  now: number = Date.now(),
): AddToBasketResult {
  const nextEntries = [...basket.entries];
  const added: BatchBasketEntry[] = [];
  let duplicate = false;
  let blockedReason: "full" | null = null;
  const seen = new Set(nextEntries.map((entry) => entry.accession));

  for (const rawAccession of accessions) {
    const accession = normalizeAccession(rawAccession);
    if (!accession || seen.has(accession)) {
      if (accession) {
        duplicate = true;
      }
      continue;
    }

    if (nextEntries.length >= basket.cap) {
      blockedReason = "full";
      continue;
    }

    const entry: BatchBasketEntry = {
      addedAt: now,
      accession,
      preview: null,
    };
    nextEntries.push(entry);
    seen.add(accession);
    added.push(entry);
  }

  return {
    added,
    basket: { cap: basket.cap, entries: nextEntries },
    blockedReason,
    duplicate,
  };
}

export function removeAccessionFromBasket(
  basket: BatchBasket,
  accession: string,
): BatchBasket {
  const normalized = normalizeAccession(accession);

  return {
    cap: basket.cap,
    entries: basket.entries.filter((entry) => entry.accession !== normalized),
  };
}

export function clearBatchBasket(
  basket: BatchBasket = createBatchBasket(),
): BatchBasket {
  return { cap: basket.cap, entries: [] };
}

export function annotateBasketWithPreviews(
  basket: BatchBasket,
  previews: TargetPreview[],
): BatchBasket {
  const previewByAccession = new Map(
    previews.map((preview) => [preview.uniprotId, preview] as const),
  );

  return {
    cap: basket.cap,
    entries: basket.entries.map((entry) => ({
      ...entry,
      preview: previewByAccession.get(entry.accession) ?? entry.preview,
    })),
  };
}

export type BatchSummaryRow = {
  highConfidence: number;
  response: PredictionResponse;
  topPeptideId: string | null;
  total: number;
  uniprotId: string;
};

export function buildBatchSummaryRows(
  response: BatchPredictionResponse,
  appliedThreshold: number,
): BatchSummaryRow[] {
  return response.results.map((predictionResponse) => {
    const topPeptide =
      predictionResponse.predictions.find(
        (row) => row.rank === 1,
      ) ?? null;
    const highConfidence = predictionResponse.predictions.filter(
      (row) =>
        classifyScoreAtThreshold(row.classifierScore, appliedThreshold) ===
        "high confidence",
    ).length;

    return {
      highConfidence,
      response: predictionResponse,
      topPeptideId: topPeptide?.peptideId ?? null,
      total: predictionResponse.summary.total,
      uniprotId: predictionResponse.target.uniprotId,
    };
  });
}

export function totalHighConfidenceForBatch(
  rows: BatchSummaryRow[],
): number {
  return rows.reduce((acc, row) => acc + row.highConfidence, 0);
}

export function findBatchSummaryRow(
  rows: BatchSummaryRow[],
  uniprotId: string,
): BatchSummaryRow | null {
  const normalized = normalizeAccession(uniprotId);
  return rows.find((row) => row.uniprotId === normalized) ?? null;
}