export type TargetPreview = {
  functionSummary?: string;
  gene?: string;
  molecularWeight?: string;
  organism?: string;
  proteinFamily?: string;
  proteinName?: string;
  sequenceLength?: string;
  uniprotId: string;
};

type BackendTargetPreview = {
  function_summary?: string;
  gene?: string;
  molecular_weight?: string;
  organism?: string;
  protein_family?: string;
  protein_name?: string;
  sequence_length?: string | number;
  uniprot_id: string;
};

type TargetExamplesResponse = {
  count: number;
  examples: BackendTargetPreview[];
};

type TargetSearchResponse = {
  count: number;
  normalized_query: string;
  query: string;
  results: BackendTargetPreview[];
};

type BackendLookupState =
  | "available-curated"
  | "invalid-accession"
  | "lookup-unavailable"
  | "not-found"
  | "valid-but-not-available";

type TargetLookupResponse = {
  error?: {
    code: string;
    message: string;
  };
  normalized_accession: string;
  prediction_eligible?: boolean;
  query: string;
  state: BackendLookupState;
  target?: BackendTargetPreview;
};

export type TargetLookupResult = {
  message: string | null;
  normalizedAccession: string;
  predictionEligible: boolean;
  query: string;
  state: BackendLookupState;
  target: TargetPreview | null;
};

export type TargetFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class TargetApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TargetApiError";
  }
}

export async function fetchTargetExamples(
  fetcher: TargetFetch = fetch,
  signal?: AbortSignal,
): Promise<TargetPreview[]> {
  const response = await fetcher("/api/targets/examples", { signal });
  const payload = await readJson<TargetExamplesResponse>(response);

  return payload.examples.map(normalizeTargetPreview);
}

export async function searchTargets(
  query: string,
  fetcher: TargetFetch = fetch,
  signal?: AbortSignal,
): Promise<TargetPreview[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetcher(`/api/targets/search?${params}`, { signal });
  const payload = await readJson<TargetSearchResponse>(response);

  return payload.results.map(normalizeTargetPreview);
}

export async function lookupTarget(
  accession: string,
  fetcher: TargetFetch = fetch,
  signal?: AbortSignal,
): Promise<TargetLookupResult> {
  const params = new URLSearchParams({ accession });
  const response = await fetcher(`/api/targets/lookup?${params}`, { signal });
  const payload = await readJson<TargetLookupResponse>(response);

  return {
    message: lookupMessage(payload),
    normalizedAccession: payload.normalized_accession,
    predictionEligible: payload.prediction_eligible === true,
    query: payload.query,
    state: payload.state,
    target: payload.target ? normalizeTargetPreview(payload.target) : null,
  };
}

export function normalizeTargetPreview(
  target: BackendTargetPreview,
): TargetPreview {
  return {
    functionSummary: cleanOptional(target.function_summary),
    gene: cleanOptional(target.gene),
    molecularWeight: cleanOptional(target.molecular_weight),
    organism: cleanOptional(target.organism),
    proteinFamily: cleanOptional(target.protein_family),
    proteinName: cleanOptional(target.protein_name),
    sequenceLength:
      target.sequence_length === undefined
        ? undefined
        : cleanOptional(String(target.sequence_length)),
    uniprotId: target.uniprot_id,
  };
}

function lookupMessage(payload: TargetLookupResponse): string | null {
  if (payload.error?.message) {
    return payload.error.message;
  }

  if (payload.state === "valid-but-not-available") {
    return "Prediction is not available for this UniProt target.";
  }

  if (payload.state === "available-curated") {
    return null;
  }

  return "Target lookup could not be completed. Please try again.";
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new TargetApiError(
      "Target service is unavailable. Please try again.",
      response.status,
    );
  }

  return (await response.json()) as T;
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();

  return cleaned ? cleaned : undefined;
}
