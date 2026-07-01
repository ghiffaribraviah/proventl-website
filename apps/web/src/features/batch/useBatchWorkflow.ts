import { useCallback, useMemo, useRef, useState } from "react";

import {
  PredictionApiError,
  runBatchPrediction,
  type BatchPredictionResponse,
} from "../../api/predictions";
import type { TargetFetch } from "../../api/targets";
import { batchErrorMessage } from "../../api/predictions";
import {
  buildBatchSummaryRows,
  createBatchBasket,
  totalHighConfidenceForBatch,
  type BatchBasket,
  type BatchSummaryRow,
} from "./basket";

export type BatchWorkflowState =
  | {
      activeRequestId: null;
      appliedThreshold: number;
      error: null;
      response: null;
      status: "idle";
    }
  | {
      activeRequestId: number;
      appliedThreshold: number;
      error: null;
      response: null;
      status: "loading";
    }
  | {
      activeRequestId: null;
      appliedThreshold: number;
      error: null;
      response: BatchPredictionResponse;
      status: "success";
    }
  | {
      activeRequestId: null;
      appliedThreshold: number;
      error: string;
      response: BatchPredictionResponse | null;
      status: "error";
    };

export const initialBatchWorkflowState: BatchWorkflowState = {
  activeRequestId: null,
  appliedThreshold: 0.95,
  error: null,
  response: null,
  status: "idle",
};

type UseBatchWorkflowOptions = {
  fetcher?: TargetFetch;
};

export function useBatchWorkflow({
  fetcher,
}: UseBatchWorkflowOptions = {}) {
  const [state, setState] = useState<BatchWorkflowState>(
    initialBatchWorkflowState,
  );
  const [basket, setBasket] = useState<BatchBasket>(() => createBatchBasket());
  const activeController = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  const summaryRows = useMemo<BatchSummaryRow[]>(() => {
    if (state.status !== "success" || !state.response) {
      return [];
    }

    return buildBatchSummaryRows(state.response, state.appliedThreshold);
  }, [state]);

  const totalHighConfidence = useMemo(
    () => totalHighConfidenceForBatch(summaryRows),
    [summaryRows],
  );

  const clearResults = useCallback(() => {
    activeController.current?.abort();
    activeController.current = null;
    setState(initialBatchWorkflowState);
  }, []);

  const runBatch = useCallback(
    async (
      accessions: string[],
      threshold: number,
    ): Promise<BatchPredictionResponse | null> => {
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      const nextRequestId = requestId.current + 1;
      requestId.current = nextRequestId;

      setState({
        activeRequestId: nextRequestId,
        appliedThreshold: threshold,
        error: null,
        response: null,
        status: "loading",
      });

      try {
        const response = await runBatchPrediction(
          { targetUniprotIds: accessions, threshold },
          fetcher,
          controller.signal,
        );
        setState({
          activeRequestId: null,
          appliedThreshold: threshold,
          error: null,
          response,
          status: "success",
        });
        return response;
      } catch (error: unknown) {
        if (isAbortError(error)) {
          return null;
        }

        const message =
          error instanceof PredictionApiError
            ? error.message
            : batchErrorMessage(
                error instanceof Error
                  ? { error: { message: error.message } }
                  : {},
              ) || "Batch prediction could not be completed. Please try again.";

        setState((previous) => ({
          activeRequestId: null,
          appliedThreshold: threshold,
          error: message,
          response:
            previous.status === "success" ? previous.response : null,
          status: "error",
        }));
        return null;
      } finally {
        if (activeController.current === controller) {
          activeController.current = null;
        }
      }
    },
    [fetcher],
  );

  const setBasketState = useCallback((nextBasket: BatchBasket) => {
    setBasket(nextBasket);
  }, []);

  const applyThresholdLocally = useCallback((threshold: number) => {
    setState((previous) => {
      if (previous.status === "success" && previous.response) {
        return {
          activeRequestId: null,
          appliedThreshold: threshold,
          error: null,
          response: previous.response,
          status: "success",
        };
      }

      if (previous.status === "error" && previous.response) {
        return {
          activeRequestId: null,
          appliedThreshold: threshold,
          error: previous.error,
          response: previous.response,
          status: "error",
        };
      }

      return {
        activeRequestId: null,
        appliedThreshold: threshold,
        error: null,
        response: null,
        status: "idle",
      };
    });
  }, []);

  return {
    applyThresholdLocally,
    basket,
    clearResults,
    runBatch,
    setBasketState,
    state,
    summaryRows,
    totalHighConfidence,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}