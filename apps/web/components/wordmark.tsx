import Link from "next/link";
import { OwlMark } from "@/components/owl-mark";

// Owl mark + serif wordmark.
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
      <OwlMark className="size-7" />
      <span className="font-serif text-lg font-semibold tracking-tight">
        Legal&nbsp;Owl
      </span>
    </Link>
  );
}
