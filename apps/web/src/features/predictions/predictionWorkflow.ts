import type { PredictionResponse } from "../../api/predictions";
import type { TargetPreview } from "../../api/targets";

export type PredictionWorkflowState =
  | {
      activeRequestId: null;
      error: null;
      result: null;
      status: "idle";
      targetUniprotId: null;
    }
  | {
      activeRequestId: number;
      error: null;
      result: null;
      status: "loading";
      targetUniprotId: string;
    }
  | {
      activeRequestId: null;
      error: null;
      result: PredictionResponse;
      status: "success";
      targetUniprotId: string;
    }
  | {
      activeRequestId: null;
      error: string;
      result: null;
      status: "error";
      targetUniprotId: string;
    };

export const initialPredictionWorkflowState: PredictionWorkflowState = {
  activeRequestId: null,
  error: null,
  result: null,
  status: "idle",
  targetUniprotId: null,
};

export function startPrediction(
  target: TargetPreview,
  requestId: number,
): PredictionWorkflowState {
  return {
    activeRequestId: requestId,
    error: null,
    result: null,
    status: "loading",
    targetUniprotId: target.uniprotId,
  };
}

export function acceptPredictionSuccess(
  state: PredictionWorkflowState,
  request: {
    requestId: number;
    result: PredictionResponse;
    targetUniprotId: string;
  },
): PredictionWorkflowState {
  if (!isActiveRequest(state, request.requestId, request.targetUniprotId)) {
    return state;
  }

  return {
    activeRequestId: null,
    error: null,
    result: request.result,
    status: "success",
    targetUniprotId: request.targetUniprotId,
  };
}

export function acceptPredictionFailure(
  state: PredictionWorkflowState,
  request: {
    error: string;
    requestId: number;
    targetUniprotId: string;
  },
): PredictionWorkflowState {
  if (!isActiveRequest(state, request.requestId, request.targetUniprotId)) {
    return state;
  }

  return {
    activeRequestId: null,
    error: request.error,
    result: null,
    status: "error",
    targetUniprotId: request.targetUniprotId,
  };
}

export function clearPredictionResults(): PredictionWorkflowState {
  return initialPredictionWorkflowState;
}

export function canRetryPrediction(state: PredictionWorkflowState): boolean {
  return state.status === "error";
}

function isActiveRequest(
  state: PredictionWorkflowState,
  requestId: number,
  targetUniprotId: string,
): boolean {
  return (
    state.status === "loading" &&
    state.activeRequestId === requestId &&
    state.targetUniprotId === targetUniprotId
  );
}
