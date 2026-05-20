import {
  ChevronLeft,
  ChevronRight,
  Download,
  Github,
  Search,
} from "lucide-react";

const candidates = [
  {
    rank: 1,
    peptideId: "P30403_pep_9",
    sequence: "LRPGAQCGEGLCCEQCK",
    source: "Zinc metalloproteinase/disintegrin",
    probability: 0.989,
    percentile: 99.3,
  },
  {
    rank: 2,
    peptideId: "P0CB14_pep_7",
    sequence: "DFDGNTVGLAFVGGICNEKYCAGVVQDHTK",
    source: "Snake venom metalloproteinase kistomin",
    probability: 0.988,
    percentile: 98.6,
  },
  {
    rank: 3,
    peptideId: "P47797_pep_1",
    sequence: "LDSCHCDSGGPLICSEEFHGIVYR",
    source: "Thrombin-like enzyme ancrod-2",
    probability: 0.981,
    percentile: 97.9,
  },
  {
    rank: 4,
    peptideId: "Q9I841_pep_1",
    sequence: "AQENGAHLASIESNGEADFVSWLISQK",
    source: "Snaclec rhodocytin subunit alpha",
    probability: 0.944,
    percentile: 94.5,
  },
];

const target = {
  id: "P01133",
  proteinName: "Epidermal growth factor receptor",
  gene: "EGFR",
  organism: "Homo sapiens",
  functions:
    "Receptor tyrosine kinase binding ligands of the EGF family and activating signaling pathways involved in cell proliferation and survival.",
  length: "1210 AA",
  mass: "134.28 kDa",
};

const threshold = 0.95;

function statusFor(probability) {
  return probability >= threshold ? "High confidence" : "Below threshold";
}

export default function ProVenTLTailwindReference() {
  return (
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(circle_at_0%_0%,rgba(38,60,146,0.08)_0%,transparent_50%),radial-gradient(circle_at_100%_0%,rgba(254,216,11,0.10)_0%,transparent_50%),radial-gradient(circle_at_100%_100%,rgba(38,60,146,0.05)_0%,transparent_50%),radial-gradient(circle_at_0%_100%,rgba(254,216,11,0.05)_0%,transparent_50%)] bg-fixed text-slate-800 antialiased">
      <div className="mx-auto w-full max-w-[1150px] px-6 py-6">
        <header className="flex items-center justify-between pb-12 pt-2">
          <div className="flex items-center gap-5">
            <img
              src="https://www.ipb.ac.id/wp-content/uploads/2025/08/Logo-IPB-New.png"
              alt="IPB University"
              className="h-12 w-auto object-contain"
            />
            <div className="h-8 w-px bg-[#263c92]/15" />
            <a
              href="/"
              className="flex flex-col text-[1.125rem] font-extrabold leading-tight text-[#263c92] no-underline"
            >
              ProVenTL
              <span className="text-xs font-medium tracking-wide text-slate-500">
                Snake Venom Research
              </span>
            </a>
          </div>

          <nav className="hidden items-center gap-6 sm:flex">
            <a
              href="https://github.com/ghiffaribraviah/proventl-website"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-[#263c92]"
            >
              <Github className="h-4 w-4" />
              Github
            </a>
            <a
              href="/docs"
              className="text-sm font-semibold text-slate-500 transition hover:text-[#263c92]"
            >
              Docs
            </a>
          </nav>
        </header>

        <main>
          <section className="mx-auto mb-20 mt-8 max-w-[700px] text-center">
            <h1 className="mb-5 text-5xl font-bold leading-[1.08] tracking-normal text-[#263c92] max-sm:text-4xl">
              Predict venom-derived anticancer peptides.
            </h1>
            <p className="mb-10 text-lg leading-7 text-slate-500">
              ProVenTL leverages transfer learning and ProtT5 embeddings to
              identify high-confidence interactions between snake venom peptides
              and cancer-related proteins.
            </p>

            <div className="flex gap-2 rounded-3xl border border-white/60 bg-white/70 p-2 shadow-[0_4px_24px_rgba(38,60,146,0.04)] backdrop-blur-2xl transition focus-within:bg-white/85 focus-within:shadow-[0_12px_40px_rgba(38,60,146,0.10)] max-sm:flex-col">
              <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value="P01133"
                  readOnly
                  aria-label="UniProt Entry ID"
                  className="min-w-0 flex-1 border-0 bg-transparent py-3 text-[1.0625rem] text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="Enter UniProt Entry ID (e.g. P01133)"
                />
              </div>
              <button
                type="button"
                className="rounded-[18px] bg-[#263c92] px-7 py-3 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(38,60,146,0.20)] transition hover:-translate-y-px hover:bg-[#1c2d6e] hover:shadow-[0_6px_16px_rgba(38,60,146,0.30)]"
              >
                Predict Affinity
              </button>
            </div>

            <div className="mt-4 rounded-3xl border border-white/60 bg-white/70 px-6 py-4 text-left shadow-[0_4px_24px_rgba(38,60,146,0.04)] backdrop-blur-2xl">
              <div className="mb-3 flex items-center justify-between">
                <label
                  htmlFor="threshold"
                  className="text-sm font-semibold text-[#263c92]"
                >
                  Confidence Threshold
                </label>
                <span className="font-mono text-sm font-semibold text-slate-600">
                  0.95
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  id="threshold"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value="0.95"
                  readOnly
                  className="h-2 flex-1 accent-[#263c92]"
                />
                <input
                  type="number"
                  value="0.95"
                  readOnly
                  className="w-[70px] rounded-md border border-black/10 px-2.5 py-1.5 text-center font-mono text-sm text-slate-800"
                />
                <button
                  type="button"
                  className="rounded-lg border border-[#263c92]/15 bg-white/65 px-3 py-1.5 text-sm font-semibold text-[#263c92] transition hover:bg-[#263c92]/5"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <span className="text-[0.8125rem] font-medium text-slate-500">
                Examples:
              </span>
              {["P01133", "P00749", "Q9NZQ7", "Q9NWT6"].map((id) => (
                <button
                  key={id}
                  type="button"
                  className="rounded-full border border-[#263c92]/10 bg-white/50 px-3 py-1.5 font-mono text-xs font-semibold text-[#263c92] transition hover:border-[#263c92]/30 hover:bg-white/80"
                >
                  {id}
                </button>
              ))}
            </div>
          </section>

          <section className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
            <div className="rounded-3xl border border-white/60 bg-white/70 shadow-[0_4px_24px_rgba(38,60,146,0.04)] backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-black/5 px-6 py-5">
                <div>
                  <h2 className="text-lg font-bold tracking-normal text-[#263c92]">
                    Top-Ranked Peptide Candidates
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    3 of 145 above threshold
                  </p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-[#263c92]/15 bg-white/60 px-3 py-2 text-sm font-semibold text-[#263c92] transition hover:bg-[#263c92]/5"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-black/5 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <th className="w-[60px] px-6 py-4">Rank</th>
                      <th className="px-6 py-4">Peptide</th>
                      <th className="px-6 py-4">Confidence</th>
                      <th className="px-6 py-4">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate) => {
                      const highConfidence =
                        candidate.probability >= threshold;
                      return (
                        <tr
                          key={`${candidate.rank}-${candidate.peptideId}`}
                          className="border-b border-black/5 last:border-0"
                        >
                          <td className="px-6 py-4 font-semibold text-slate-500">
                            {candidate.rank}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-mono text-sm font-semibold text-slate-800">
                              {candidate.sequence}
                            </div>
                            <div className="mt-1 max-w-[340px] truncate text-xs text-slate-500">
                              {candidate.peptideId} · {candidate.source}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex min-w-[160px] items-center gap-3">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-[#263c92]"
                                  style={{
                                    width: `${candidate.probability * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="font-mono text-xs font-medium text-slate-700">
                                {candidate.probability.toFixed(3)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              Top {(100 - candidate.percentile).toFixed(1)}%
                              for this target
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                                highConfidence
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-red-500/10 text-red-500",
                              ].join(" ")}
                            >
                              {statusFor(candidate.probability)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-center gap-2 border-t border-black/5 px-6 py-4">
                <button className="grid h-9 w-9 place-items-center rounded-lg border border-[#263c92]/10 bg-white/60 text-[#263c92] disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {[1, 2, 3].map((page) => (
                  <button
                    key={page}
                    className={[
                      "h-9 min-w-9 rounded-lg px-3 text-sm font-semibold",
                      page === 1
                        ? "bg-[#263c92] text-white"
                        : "border border-[#263c92]/10 bg-white/60 text-[#263c92]",
                    ].join(" ")}
                  >
                    {page}
                  </button>
                ))}
                <button className="grid h-9 w-9 place-items-center rounded-lg border border-[#263c92]/10 bg-white/60 text-[#263c92]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <aside className="rounded-3xl border border-white/60 bg-white/70 shadow-[0_4px_24px_rgba(38,60,146,0.04)] backdrop-blur-2xl">
              <div className="border-b border-black/5 px-6 py-5">
                <h2 className="text-lg font-bold tracking-normal text-[#263c92]">
                  Target Protein Profile
                </h2>
              </div>
              <dl className="divide-y divide-black/5">
                {[
                  ["UniProt Entry ID", target.id, "font-mono text-[#263c92]"],
                  ["Protein Name", target.proteinName],
                  ["Gene", target.gene],
                  ["Organism", target.organism],
                  ["Key Functions", target.functions],
                  ["Sequence Length", target.length],
                  ["Molecular Weight", target.mass],
                ].map(([label, value, valueClass]) => (
                  <div key={label} className="px-6 py-4">
                    <dt className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                      {label}
                    </dt>
                    <dd
                      className={[
                        "text-sm font-semibold leading-6 text-slate-700",
                        valueClass || "",
                      ].join(" ")}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          </section>
        </main>

        <footer className="mt-20 border-t border-black/5 py-8 text-center text-sm text-slate-500">
          &copy; 2026 ProVenTL Framework. Adhiva et al.
          <br />
          Supported by <strong className="text-slate-700">IPB University</strong>.
        </footer>
      </div>
    </div>
  );
}
