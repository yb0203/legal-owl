import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/page-header";
import { PageShell } from "@/components/layout";
import { Markdown } from "@/components/markdown";
import { HELP_SECTIONS } from "@/lib/help/content";

export const metadata = { title: "Help · Legal Owl" };

export default function HelpPage() {
  return (
    <PageShell>
      <PageHeader title="Help" subtitle="How to use Legal Owl, the core workflows, and what everything means." />

      <Link
        href="/home?tour=1"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent/40"
      >
        <Sparkles className="size-4" /> Take the guided tour
      </Link>

      <div className="mt-6 space-y-8">
        {HELP_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <h2 className="mb-3 font-serif text-xl font-semibold tracking-tight">{section.title}</h2>
            <SectionCard className="px-4 py-1">
              <Markdown content={section.body} />
            </SectionCard>
          </section>
        ))}

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Still stuck? Use the Search box in the header to jump anywhere
          <ArrowRight className="size-3.5" />
        </p>
      </div>
    </PageShell>
  );
}
