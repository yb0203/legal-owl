import Link from "next/link";
import { SearchX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// Standard page heading: serif title, optional subtitle, right-aligned actions.
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          {title && <h2 className="text-sm font-medium">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// Educational empty state: an icon, a title, a sentence of "what this is / why
// it helps", and up to two actions. `variant="no-results"` is for filtered-empty
// (different from never-created). `hint` is kept as a back-compat alias for
// `description`.
export function EmptyState({
  icon: Icon,
  title,
  hint,
  description,
  action,
  secondaryAction,
  variant = "default",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  variant?: "default" | "no-results";
  className?: string;
}) {
  const body = description ?? hint;
  const FallbackIcon = variant === "no-results" ? SearchX : undefined;
  const Glyph = Icon ?? FallbackIcon;
  return (
    <Empty className={cn("border bg-card/30 p-10", className)}>
      <EmptyHeader>
        {Glyph && (
          <EmptyMedia variant="icon" className="size-10 [&_svg:not([class*='size-'])]:size-5">
            <Glyph />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {body && <EmptyDescription>{body}</EmptyDescription>}
      </EmptyHeader>
      {(action || secondaryAction) && (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action}
            {secondaryAction}
          </div>
        </EmptyContent>
      )}
    </Empty>
  );
}

export function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: "default" | "urgent";
}) {
  const inner = (
    <>
      <div
        className={cn(
          "tnum font-serif text-3xl font-semibold",
          tone === "urgent" && value !== 0 && "text-urgent",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </>
  );
  if (!href) return <div className="rounded-xl border bg-card p-4">{inner}</div>;
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
      {inner}
    </Link>
  );
}
