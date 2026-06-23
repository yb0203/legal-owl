import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Props for a primitive that can render as a different element via `as` (e.g.
// `<Panel as="form">`, `<Callout as={Link} href=…>`). Forwards the chosen
// element's own props.
type AsProps<T extends React.ElementType> = {
  as?: T;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className">;

// Structural layout primitives — the boxes, lists, rows, and headings that wrap
// the semantic content (badges, status chips, properties). These exist so pages
// never hand-roll the same Tailwind container strings inline. Semantic atoms
// live in `badges.tsx`; titled cards + page headings live in `page-header.tsx`.

/** The standard page container. Every authenticated `page.tsx` wraps in this. */
export function PageShell({
  size = "lg",
  className,
  children,
}: {
  /** `lg` = max-w-3xl (default, all list/detail pages), `md` = max-w-2xl, `sm` = max-w-xl. */
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  const width = size === "sm" ? "max-w-xl" : size === "md" ? "max-w-2xl" : "max-w-3xl";
  return <main className={cn("mx-auto w-full p-6 sm:p-8", width, className)}>{children}</main>;
}

/**
 * Plain bordered card surface (no header). For a titled card, use `SectionCard`.
 * Polymorphic: `<Panel as="form" action={…}>` when the card surface is itself an
 * interactive element.
 */
export function Panel<T extends React.ElementType = "div">({
  as,
  className,
  ...props
}: AsProps<T>) {
  const Comp = as ?? "div";
  return <Comp className={cn("rounded-xl border bg-card", className)} {...props} />;
}

const CALLOUT_TONES = {
  primary: "border-primary/30 bg-primary/5 text-primary",
  lemon: "border-lemon/40 bg-lemon/10",
  urgent: "border-urgent/40 bg-urgent/10",
} as const;

/**
 * A tone-tinted banner for advisories (conflict checks, "updates to review").
 * Polymorphic so an actionable callout can render as a `Link`. Layout/padding is
 * the caller's (pass via `className`); the tone supplies the border + fill.
 */
export function Callout<T extends React.ElementType = "div">({
  as,
  tone = "primary",
  className,
  ...props
}: { tone?: keyof typeof CALLOUT_TONES } & AsProps<T>) {
  const Comp = as ?? "div";
  return <Comp className={cn("rounded-xl border", CALLOUT_TONES[tone], className)} {...props} />;
}

/** A small neutral tag/pill — enum values, type labels, counts. */
export function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The "← Section" back link at the top of a detail/new page. */
export function BackLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="size-4" /> {children}
    </Link>
  );
}

/** A muted section subheading. `variant="serif"` is the larger serif group label. */
export function SectionHeading({
  variant = "label",
  className,
  children,
}: {
  variant?: "label" | "serif";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className={cn(
        "mb-3 text-muted-foreground",
        variant === "serif"
          ? "font-serif text-base font-semibold tracking-tight"
          : "text-sm font-medium",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** A bordered, row-divided list container. `tone="urgent"` tints the border. */
export function List({
  tone = "default",
  className,
  children,
}: {
  tone?: "default" | "urgent";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ul
      className={cn(
        "divide-y overflow-hidden rounded-xl border",
        tone === "urgent" && "border-urgent/40",
        className,
      )}
    >
      {children}
    </ul>
  );
}

/**
 * A list row. The common shape is `leading` glyph + a title/subtitle stack +
 * `trailing` badge/chevron; pass `href` to make the whole row a link. For a row
 * that doesn't fit that shape (e.g. an inline form), pass `children` to take over
 * the row body entirely.
 */
export function ListRow({
  href,
  leading,
  title,
  subtitle,
  trailing,
  className,
  children,
}: {
  href?: string;
  leading?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const body = children ?? (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        {title != null && <div className="truncate font-medium">{title}</div>}
        {subtitle != null && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {trailing}
    </>
  );
  const rowClass = cn("flex items-center gap-3 bg-card px-4 py-3", className);
  if (href) {
    return (
      <li>
        <Link href={href} className={cn(rowClass, "transition-colors hover:bg-accent/40")}>
          {body}
        </Link>
      </li>
    );
  }
  return <li className={rowClass}>{body}</li>;
}
