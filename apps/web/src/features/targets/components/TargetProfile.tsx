import type { TargetPreview } from "../../../api/targets";
import { targetProfileRows, uniprotEntryUrl } from "../targetProfile";

export const TARGET_PROFILE_LAYOUT_CLASS =
  "grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]";

type TargetProfileProps = {
  target: TargetPreview;
};

export function TargetProfile({ target }: TargetProfileProps) {
  const rows = targetProfileRows(target);

  return (
    <aside className="glass-panel overflow-hidden rounded-3xl">
      <div className="border-b border-black/5 px-5 py-5 sm:px-7 sm:py-6">
        <h2 className="flex items-center gap-2.5 text-[1.0625rem] font-bold text-ipb-blue before:h-2 before:w-2 before:rounded-full before:bg-ipb-yellow before:content-['']">
          Target Profile
        </h2>
      </div>
      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="border-b border-black/[0.03] px-5 py-4 last:border-b-0 sm:px-7 sm:py-5"
          >
            <dt className="mb-1 text-xs font-bold uppercase tracking-normal text-slate-500">
              {row.label}
            </dt>
            <dd
              className={[
                "font-semibold text-slate-800",
                row.mono ? "font-mono text-ipb-blue" : "",
                row.label === "Function Summary"
                  ? "text-[0.8125rem] font-normal leading-6 text-slate-600"
                  : "",
              ].join(" ")}
            >
              {row.value}
            </dd>
          </div>
        ))}
        <div className="px-5 py-5 sm:px-7">
          <a
            href={uniprotEntryUrl(target)}
            target="_blank"
            rel="noreferrer"
            className="font-extrabold text-ipb-blue no-underline"
          >
            View on UniProt
          </a>
        </div>
      </dl>
    </aside>
  );
}
