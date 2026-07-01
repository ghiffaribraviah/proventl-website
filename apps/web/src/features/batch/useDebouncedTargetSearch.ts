import { useEffect, useRef, useState } from "react";

import { searchTargets, type TargetFetch, type TargetPreview } from "../../api/targets";
import {
  TARGET_SEARCH_DEBOUNCE_MS,
  TARGET_SEARCH_MIN_LENGTH,
} from "../targets/targetDiscovery";

type AsyncTargetState = {
  error: string | null;
  isLoading: boolean;
};

type UseDebouncedTargetSearchOptions = {
  fetcher?: TargetFetch;
};

export function useDebouncedTargetSearch({
  fetcher,
}: UseDebouncedTargetSearchOptions = {}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TargetPreview[]>([]);
  const [searchState, setSearchState] = useState<AsyncTargetState>({
    error: null,
    isLoading: false,
  });
  const lastQuery = useRef("");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < TARGET_SEARCH_MIN_LENGTH) {
      lastQuery.current = "";
      setResults([]);
      setSearchState({ error: null, isLoading: false });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      lastQuery.current = trimmed;
      setSearchState({ error: null, isLoading: true });
      searchTargets(trimmed, fetcher, controller.signal)
        .then((searchResults) => {
          if (lastQuery.current !== trimmed) {
            return;
          }
          setResults(searchResults);
          setSearchState({ error: null, isLoading: false });
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }
          if (lastQuery.current !== trimmed) {
            return;
          }
          setResults([]);
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
  }, [fetcher, query]);

  return {
    query,
    results,
    searchState,
    setQuery,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}