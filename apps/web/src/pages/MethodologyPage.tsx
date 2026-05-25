export const METHODOLOGY_STEPS = [
  "Curated cancer target",
  "Curated venom peptide set",
  "ProtT5 embeddings",
  "SAE-DNN classifier",
  "Ranked peptide predictions",
];

export const V1_OMISSIONS =
  "Website predictions does not display z-score, p-value, or percentile post-processing.";

export function MethodologyPage() {
  return (
    <article className="glass-panel mx-auto max-w-4xl rounded-3xl p-6 sm:p-8">
      <p className="text-sm font-bold uppercase tracking-normal text-ipb-blue">
        Methodology
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-ipb-blue">
        ProtT5 embeddings and SAE-DNN scoring
      </h1>
      <p className="mt-4 max-w-3xl leading-7 text-slate-500">
        ProVenTL website presents a website workflow for curated protein targets and
        venom peptide candidates. The interface distinguishes model inference
        from threshold interpretation so users can inspect classifier-supported
        candidates without implying experimental validation.
      </p>

      <div
        className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        data-testid="methodology-diagram"
      >
        {METHODOLOGY_STEPS.map((label, index) => (
          <div
            key={label}
            className="rounded-2xl border border-white/70 bg-white/50 p-5 text-center"
          >
            <div className="font-mono text-xs font-extrabold text-ipb-blue">
              0{index + 1}
            </div>
            <div className="mt-2 font-display text-base font-extrabold text-ipb-blue">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/70 bg-white/45 p-5">
          <h2 className="font-display text-lg font-extrabold text-ipb-blue">
            Embeddings and classifier
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Protein targets and venom peptides are represented with ProtT5
            transfer-learning embeddings. The selected model uses an
            SAE-DNN classifier to score peptide-target pairs and rank returned
            peptide candidates.
          </p>
        </section>
        <section className="rounded-2xl border border-white/70 bg-white/45 p-5">
          <h2 className="font-display text-lg font-extrabold text-ipb-blue">
            Curated prediction scope
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            ProVenTL website runs only against curated protein embeddings and the curated
            venom peptide set available to the backend. Unsupported UniProt
            records can be recognized, but prediction remains unavailable for
            them in this release.
          </p>
        </section>
        <section className="rounded-2xl border border-white/70 bg-white/45 p-5">
          <h2 className="font-display text-lg font-extrabold text-ipb-blue">
            Results interpretation
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Threshold changes relabel returned peptide rows locally. The model
            is not rerun when the user adjusts threshold controls.
          </p>
        </section>
        <section className="rounded-2xl border border-white/70 bg-white/45 p-5">
          <h2 className="font-display text-lg font-extrabold text-ipb-blue">
            Omitted paper post-processing
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {V1_OMISSIONS} The site keeps the displayed contract limited to
            classifier scores and threshold-derived labels.
          </p>
        </section>
        <section className="rounded-2xl border border-white/70 bg-white/45 p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-extrabold text-ipb-blue">
            Scientific limitation
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Classifier scores are computational predictions, not experimental
            binding measurements or validated therapeutic claims. Candidate
            peptides require independent experimental validation before any
            biological interpretation or downstream use.
          </p>
        </section>
      </div>
    </article>
  );
}
