import { Copy } from "lucide-react";

export const BIBTEX = `@article{adhiva2026proventl,
  author  = {Adhiva, Jeni and Pradana, Hanif Aditya and Kusuma, Wisnu Ananta and Haryanto, Toto and Amanda, Chairunnisa Nur and Sofyantoro, Fajar and Yudha, Donan Satria and Nuringtyas, Tri Rini and Putri, Wahyu Aristyaning and Purwestri, Yekti Asih and Lischer, Kenny and Swasono, Respati Tri},
  title   = {{ProVenTL}: a transfer-learning framework for predicting peptide--protein interactions derived from snake venom for cancer therapeutics},
  journal = {Journal of Computer-Aided Molecular Design},
  year    = {2026},
  volume  = {40},
  pages   = {90},
  doi     = {10.1007/s10822-026-00801-w},
  url     = {https://doi.org/10.1007/s10822-026-00801-w}
}`;

export const PLAIN_CITATION =
  "Adhiva et al. (2026). ProVenTL: a transfer-learning framework for predicting peptide–protein interactions derived from snake venom for cancer therapeutics";

export function CitationPage() {
  return (
    <article className="glass-panel mx-auto max-w-3xl rounded-3xl p-6 sm:p-8">
      <p className="text-sm font-bold uppercase tracking-normal text-ipb-blue">
        Citation
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-ipb-blue">
        Cite the underlying work
      </h1>
      <p className="mt-4 leading-7 text-slate-500">
        Please cite the ProVenTL paper when
        using website predictions in scientific communication.
      </p>

      <section className="mt-7 rounded-2xl border border-white/70 bg-white/50 p-5">
        <h2 className="font-display text-lg font-extrabold text-ipb-blue">
          Plain citation
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {PLAIN_CITATION}
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-white/70 bg-white/50 p-5">
        <h2 className="font-display text-lg font-extrabold text-ipb-blue">
          DOI
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          DOI: https://doi.org/10.1007/s10822-026-00801-w
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-white/70 bg-white/50 p-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-extrabold text-ipb-blue">
            BibTeX
          </h2>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-ipb-blue px-3 text-sm font-bold text-white"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          <code>{BIBTEX}</code>
        </pre>
      </section>
    </article>
  );
}
