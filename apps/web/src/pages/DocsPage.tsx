import {
  Download,
  Search,
  SlidersHorizontal,
  SquareMousePointer,
  TableProperties,
} from "lucide-react";

export const DOCS_WORKFLOW_SECTIONS = [
  {
    body: "Search by UniProt accession, gene symbol, protein name, organism, or family metadata when those fields are available. Examples come from the curated backend registry.",
    icon: Search,
    title: "Find a curated target",
  },
  {
    body: "Selecting a target prepares the workflow. Model scoring starts only after Predict, or when a valid shared result URL restores a target and threshold.",
    icon: SquareMousePointer,
    title: "Run prediction explicitly",
  },
  {
    body: "Adjust the draft threshold with the slider or numeric field, then apply it to relabel returned rows locally without rerunning inference.",
    icon: SlidersHorizontal,
    title: "Apply threshold interpretation",
  },
  {
    body: "Filter All or High confidence rows, search peptide ID, sequence, or source text, sort the table, and page through ten rows at a time.",
    icon: TableProperties,
    title: "Explore ranked peptides",
  },
  {
    body: "Copy plain peptide sequences from rows or export the active filtered result set as CSV. CSV export ignores pagination and includes model and threshold context.",
    icon: Download,
    title: "Copy and export",
  },
];

export function DocsPage() {
  return (
    <article className="glass-panel mx-auto max-w-3xl rounded-3xl p-6 sm:p-8">
      <p className="text-sm font-bold uppercase tracking-normal text-ipb-blue">
        Workflow docs
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-ipb-blue">
        Use ProVenTL
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-500">
        ProVenTL website is a curated website workflow for target-specific venom
        peptide prediction. It does not accept arbitrary protein sequences and
        does not expose a public API documentation surface.
      </p>
      <div className="mt-7 grid gap-4">
        {DOCS_WORKFLOW_SECTIONS.map((section) => (
          <DocStep key={section.title} {...section} />
        ))}
      </div>
    </article>
  );
}

type DocStepProps = {
  body: string;
  icon: typeof Search;
  title: string;
};

function DocStep({ body, icon: Icon, title }: DocStepProps) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/45 p-5">
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ipb-blue/10 text-ipb-blue">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-lg font-extrabold text-ipb-blue">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
        </div>
      </div>
    </section>
  );
}
