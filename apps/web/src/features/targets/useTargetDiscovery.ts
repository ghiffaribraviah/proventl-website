import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchTargetExamples,
  lookupTarget,
  searchTargets,
  type TargetFetch,
  type TargetLookupResult,
  type TargetPreview,
} from "../../api/targets";
import {
  selectTarget,
  shouldSearchTargets,
  TARGET_SEARCH_DEBOUNCE_MS,
  updateQueryAndMaybeClearSelection,
} from "./targetDiscovery";

type AsyncTargetState = {
  error: string | null;
  isLoading: boolean;
};

type UseTargetDiscoveryOptions = {
  fetcher?: TargetFetch;
  onClearResults?: () => void;
};

export function useTargetDiscovery({
  fetcher,
  onClearResults,
}: UseTargetDiscoveryOptions = {}) {
  const [examples, setExamples] = useState<TargetPreview[]>([]);
  const [examplesState, setExamplesState] = useState<AsyncTargetState>({
    error: null,
    isLoading: true,
  });
  const [query, setQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<TargetPreview | null>(
    null,
  );
  const [lookupResult, setLookupResult] = useState<TargetLookupResult | null>(
    null,
  );
  const [lookupState, setLookupState] = useState<AsyncTargetState>({
    error: null,
    isLoading: false,
  });
  const [searchResults, setSearchResults] = useState<TargetPreview[]>([]);
  const [searchState, setSearchState] = useState<AsyncTargetState>({
    error: null,
    isLoading: false,
  });
  const selectionLookupRequestId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();

    setExamplesState({ error: null, isLoading: true });
    fetchTargetExamples(fetcher, controller.signal)
      .then((loadedExamples) => {
        setExamples(loadedExamples);
        setExamplesState({ error: null, isLoading: false });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }
        setExamples([]);
        setExamplesState({
          error: "Curated examples could not be loaded.",
          isLoading: false,
        });
      });

    return () => controller.abort();
  }, [fetcher]);

  useEffect(() => {
    if (selectedTarget || !shouldSearchTargets(query)) {
      setSearchResults([]);
      setSearchState({ error: null, isLoading: false });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setSearchState({ error: null, isLoading: true });
      searchTargets(query, fetcher, controller.signal)
        .then((results) => {
          setSearchResults(results);
          setSearchState({ error: null, isLoading: false });
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }
          setSearchResults([]);
          setSearchState({
            error: "Target search could not be completed.",
            isLoading: false,
          });
        });
    }, TARGET_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetcher, query, selectedTarget]);

  const handleQueryChange = useCallback(
    (nextQuery: string) => {
      const nextState = updateQueryAndMaybeClearSelection(
        { query, selectedTarget },
        nextQuery,
      );

      setQuery(nextState.query);
      setSelectedTarget(nextState.selectedTarget);

      if (nextState.clearedSelection) {
        selectionLookupRequestId.current += 1;
        setLookupResult(null);
        setSearchResults([]);
        onClearResults?.();
      }
    },
    [onClearResults, query, selectedTarget],
  );

  const handleSelectTarget = useCallback(
    (target: TargetPreview) => {
      const nextState = selectTarget({ query, selectedTarget }, target);
      setQuery(nextState.query);
      setSelectedTarget(nextState.selectedTarget);
      setLookupResult(null);
      setSearchResults([]);
      onClearResults?.();

      const requestId = selectionLookupRequestId.current + 1;
      selectionLookupRequestId.current = requestId;
      const controller = new AbortController();
      setLookupState({ error: null, isLoading: true });
      lookupTarget(target.uniprotId, fetcher, controller.signal)
        .then((result) => {
          if (selectionLookupRequestId.current !== requestId) {
            return;
          }
          setLookupState({ error: null, isLoading: false });
          if (result.state !== "available-curated" || !result.target) {
            setLookupResult(result);
            return;
          }

          const enrichedState = selectTarget(
            { query: nextState.query, selectedTarget: nextState.selectedTarget },
            result.target,
          );
          setQuery(enrichedState.query);
          setSelectedTarget(enrichedState.selectedTarget);
          setLookupResult(null);
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }
          if (selectionLookupRequestId.current !== requestId) {
            return;
          }
          setLookupState({ error: null, isLoading: false });
        });
    },
    [fetcher, onClearResults, query, selectedTarget],
  );

  const handleLookupSubmit = useCallback(async () => {
    const accession = query.trim();
    if (!accession) {
      return;
    }

    const controller = new AbortController();
    selectionLookupRequestId.current += 1;
    setLookupState({ error: null, isLoading: true });
    setSearchResults([]);

    try {
      const result = await lookupTarget(accession, fetcher, controller.signal);
      setLookupResult(result);
      setLookupState({ error: null, isLoading: false });

      if (result.state === "available-curated" && result.target) {
        const nextState = selectTarget(
          { query, selectedTarget },
          result.target,
        );
        setQuery(nextState.query);
        setSelectedTarget(nextState.selectedTarget);
        onClearResults?.();
        return;
      }

      setSelectedTarget(null);
      onClearResults?.();
    } catch (error: unknown) {
      if (isAbortError(error)) {
        return;
      }
      setLookupResult(null);
      setSelectedTarget(null);
      setLookupState({
        error: "Target lookup could not be completed. Please try again.",
        isLoading: false,
      });
    }
  }, [fetcher, onClearResults, query, selectedTarget]);

  return {
    examples,
    examplesState,
    handleLookupSubmit,
    handleQueryChange,
    handleSelectTarget,
    lookupResult,
    lookupState,
    query,
    searchResults,
    searchState,
    selectedTarget,
    shouldShowExamples: !selectedTarget && query.trim().length === 0,
    shouldShowSearchResults: !selectedTarget && shouldSearchTargets(query),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
