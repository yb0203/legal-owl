import { Wordmark } from "@/components/wordmark";

// Shared chrome for /login and /waitlist: centered card on the off-dark canvas
// with a soft mint glow and the owl wordmark above.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div className="size-[30rem] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <Wordmark />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-7">{children}</div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Built for India · Your case data stays in India.
        </p>
      </div>
    </main>
  );
}
