type BatchLoaderProps = {
  targetCount: number;
};

export function BatchLoader({ targetCount }: BatchLoaderProps) {
  return (
    <section
      className="my-10 px-6 py-16 text-center"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="batch-spinner mx-auto" aria-hidden="true" />
      <p className="mt-6 font-bold text-ipb-blue">
        Scoring 145 peptides against {targetCount} target
        {targetCount === 1 ? "" : "s"}...
      </p>
      <p className="mt-1 text-[0.8125rem] text-muted">
        Running SAE-DNN inference engine
      </p>
    </section>
  );
}