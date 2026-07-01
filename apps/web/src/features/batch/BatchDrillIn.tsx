import { ArrowLeft } from "lucide-react";

import type { PredictionResponse } from "../../api/predictions";
import { TargetProfile } from "../targets/components/TargetProfile";
import { ResultsDashboard } from "../results/ResultsDashboard";

type BatchDrillInProps = {
  onBack: () => void;
  onThresholdApplied?: (threshold: number) => void;
  response: PredictionResponse;
};

export function BatchDrillIn({
  onBack,
  onThresholdApplied,
  response,
}: BatchDrillInProps) {
  return (
    <div
      id="drill-in-view"
      className="grid animate-batch-slide-up grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="results-pane min-w-0">
        <nav aria-label="Batch breadcrumb" className="batch-breadcrumb">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 border-0 bg-transparent text-ipb-blue transition hover:-translate-x-0.5 hover:text-ipb-blue-dark"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to batch
          </button>
          <span className="text-[1.125rem] text-muted" aria-hidden="true">
            ›
          </span>
          <span
            id="drill-in-target-label"
            className="font-mono text-muted"
          >
            {response.target.uniprotId}
            {response.target.gene ? ` · ${response.target.gene}` : ""}
          </span>
        </nav>

        <ResultsDashboard
          onThresholdApplied={
            onThresholdApplied
              ? (_targetUniprotId, threshold) => {
                  onThresholdApplied(threshold);
                }
              : undefined
          }
          response={response}
        />
      </div>

      <div className="sidebar-pane">
        <TargetProfile showExternalIcon target={response.target} />
      </div>
    </div>
  );
}