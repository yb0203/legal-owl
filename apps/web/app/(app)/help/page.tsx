import { ArrowRight } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/page-header";
import { PageShell } from "@/components/layout";
import { HELP_SECTIONS, type HelpBlock, type GlossaryEntry } from "@/lib/help/content";

export const metadata = { title: "Help · Legal Owl" };

function GlossaryItem({ entry }: { entry: GlossaryEntry }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="text-sm font-medium">{entry.term}</div>
      <p className="mt-0.5 text-sm text-muted-foreground">{entry.whatItIs}</p>
      {entry.properties.length > 0 && (
        <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[10rem_1fr]">
          {entry.properties.map((p) => (
            <div key={p.label} className="sm:contents">
              <dt className="text-xs font-medium text-foreground/80">{p.label}</dt>
              <dd className="text-xs text-muted-foreground">{p.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
      {entry.relatesTo.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entry.relatesTo.map((r) => (
            <li key={r} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Block({ block }: { block: HelpBlock }) {
  if (block.kind === "prose") {
    return <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>;
  }
  if (block.kind === "steps") {
    return (
      <ol className="ml-5 list-decimal space-y-1.5 text-sm leading-relaxed marker:text-muted-foreground">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    );
  }
  // glossary
  return (
    <div className="divide-y">
      {block.entries.map((entry) => (
        <GlossaryItem key={entry.term} entry={entry} />
      ))}
    </div>
  );
}

export default function HelpPage() {
  return (
    <PageShell>
      <PageHeader title="Help" subtitle="How to use Legal Owl, the core workflows, and what everything means." />

      <div className="mt-2 space-y-8">
        {HELP_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <h2 className="mb-3 font-serif text-xl font-semibold tracking-tight">{section.title}</h2>
            <SectionCard className="space-y-4 p-4">
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </SectionCard>
          </section>
        ))}

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Still stuck? Use the in-app search (<kbd className="rounded bg-muted px-1 text-xs">⌘K</kbd>) to jump anywhere
          <ArrowRight className="size-3.5" />
        </p>
      </div>
    </PageShell>
  );
}
