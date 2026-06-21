import Link from "next/link";

// "LO" monogram + serif wordmark. Restrained, no stock legal iconography.
export function Wordmark({
  href = "/",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label="Legal Owl home"
    >
      <span className="grid size-6 place-items-center rounded-[6px] bg-primary font-serif text-[11px] font-semibold text-primary-foreground">
        LO
      </span>
      <span className="font-serif text-lg font-semibold tracking-tight">
        Legal&nbsp;Owl
      </span>
    </Link>
  );
}
