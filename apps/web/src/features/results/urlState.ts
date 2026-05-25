import { DEFAULT_THRESHOLD, parseUrlThreshold } from "./thresholdInterpretation";

export type ResultUrlState = {
  target: string | null;
  threshold: number;
};

export function readResultUrlState(location: Location): ResultUrlState {
  const params = new URLSearchParams(location.search);
  const target = params.get("target")?.trim().toUpperCase() || null;

  return {
    target,
    threshold: parseUrlThreshold(params.get("threshold")),
  };
}

export function updateResultUrl(
  targetUniprotId: string,
  threshold = DEFAULT_THRESHOLD,
  location: Pick<Location, "href"> = window.location,
  history: Pick<History, "replaceState"> = window.history,
): void {
  const url = new URL(location.href);
  url.searchParams.set("target", targetUniprotId);
  url.searchParams.set("threshold", threshold.toFixed(2));
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
