import { ArrowUpRight } from "lucide-react";

import type { TargetPreview } from "../../../api/targets";
import { targetProfileRows, uniprotEntryUrl } from "../targetProfile";

export const TARGET_PROFILE_LAYOUT_CLASS =
  "grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]";

type TargetProfileProps = {
  showExternalIcon?: boolean;
  target: TargetPreview;
};

export function TargetProfile({
  showExternalIcon = false,
  target,
}: TargetProfileProps) {
  const rows = targetProfileRows(target);

  return (
    <aside className="glass-panel overflow-hidden rounded-3xl">
      <div className="border-b border-black/5 px-5 py-5 sm:px-7 sm:py-6">
        <h2 className="batch-card-title">Target Profile</h2>
      </div>
      <dl className="batch-info-list">
        {rows.map((row) => (
          <div key={row.label} className="batch-info-item">
            <dt className="mb-1 text-[0.75rem] font-bold uppercase tracking-wider text-muted">
              {row.label}
            </dt>
            <dd
              className={[
                "font-semibold text-fg",
                row.mono ? "font-mono text-ipb-blue" : "",
                row.label === "Functions"
                  ? "text-[0.8125rem] font-normal leading-6 text-slate-600"
                  : "",
              ].join(" ")}
            >
              {row.value}
            </dd>
          </div>
        ))}
        <div className="batch-info-item">
          <a
            href={uniprotEntryUrl(target)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-extrabold text-ipb-blue no-underline"
          >
            View on UniProt
            {showExternalIcon ? (
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
          </a>
        </div>
      </dl>
    </aside>
  );
}