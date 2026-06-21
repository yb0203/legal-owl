export default function ActionsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Actions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything you need to do across your matters.
      </p>
      <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No open actions.
      </div>
    </main>
  );
}
