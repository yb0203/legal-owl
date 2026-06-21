export default function TriagePage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Triage</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Court updates waiting for your review — accept into an action or dismiss to the record.
      </p>
      <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        All caught up — nothing to triage.
      </div>
    </main>
  );
}
