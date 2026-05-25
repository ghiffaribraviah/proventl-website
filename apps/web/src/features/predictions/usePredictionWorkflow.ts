import { useCallback, useRef, useState } from "react";

import {
  DEFAULT_APPLIED_THRESHOLD,
  PredictionApiError,
  runPrediction,
  type PredictionResponse,
} from "../../api/predictions";
import type { TargetFetch, TargetPreview } from "../../api/targets";
import {
  acceptPredictionFailure,
  acceptPredictionSuccess,
  clearPredictionResults,
  initialPredictionWorkflowState,
  startPrediction,
  type PredictionWorkflowState,
} from "./predictionWorkflow";

type UsePredictionWorkflowOptions = {
  fetcher?: TargetFetch;
};

export function usePredictionWorkflow({
  fetcher,
}: UsePredictionWorkflowOptions = {}) {
  const [state, setState] = useState<PredictionWorkflowState>(
    initialPredictionWorkflowState,
  );
  const activeController = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  const clearForTargetChange = useCallback(() => {
    activeController.current?.abort();
    activeController.current = null;
    setState(clearPredictionResults());
  }, []);

  const predict = useCallback(
    async (
      target: TargetPreview,
      threshold = DEFAULT_APPLIED_THRESHOLD,
    ): Promise<PredictionResponse | null> => {
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      const nextRequestId = requestId.current + 1;
      requestId.current = nextRequestId;

      setState(startPrediction(target, nextRequestId));

      try {
        const result = await runPrediction(
          { targetUniprotId: target.uniprotId, threshold },
          fetcher,
          controller.signal,
        );
        setState((currentState) =>
          acceptPredictionSuccess(currentState, {
            requestId: nextRequestId,
            result,
            targetUniprotId: target.uniprotId,
          }),
        );
        return result;
      } catch (error: unknown) {
        if (isAbortError(error)) {
          return null;
        }
        const message =
          error instanceof PredictionApiError
            ? error.message
            : "Prediction could not be completed. Please try again.";

        setState((currentState) =>
          acceptPredictionFailure(currentState, {
            error: message,
            requestId: nextRequestId,
            targetUniprotId: target.uniprotId,
          }),
        );
        return null;
      } finally {
        if (activeController.current === controller) {
          activeController.current = null;
        }
      }
    },
    [fetcher],
  );

  return {
    clearForTargetChange,
    predict,
    state,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
