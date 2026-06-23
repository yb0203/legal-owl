import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { MermaidDiagram } from "@/components/mermaid-diagram";

// Renders first-party GitHub-flavored Markdown with design-system styling.
// react-markdown strips raw HTML by default (no rehype-raw) — content is
// first-party, so we keep that safe default. A ```mermaid fenced block is
// routed to the client-side <MermaidDiagram> island; all other elements map
// to the app's type scale and surfaces (Geist / Source Serif, off-dark theme).
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 mb-3 font-serif text-xl font-semibold tracking-tight first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2 font-serif text-lg font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 mb-2 text-sm font-semibold tracking-tight first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="my-3 text-sm leading-relaxed text-foreground/90 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="my-3 ml-5 list-disc space-y-1.5 text-sm text-foreground/90">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 ml-5 list-decimal space-y-1.5 text-sm text-foreground/90">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed [&>p]:my-0">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} className="font-medium text-primary underline underline-offset-2 hover:no-underline">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border pl-3 text-sm text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b bg-muted/40 text-left">{children}</thead>,
  tr: ({ children }) => <tr className="border-b last:border-0">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 align-top text-foreground/90">{children}</td>,
  code: ({ className, children }) => {
    // A fenced ```mermaid block carries className "language-mermaid"; inline
    // code never does. (react-markdown v10 dropped the `inline` arg, so the
    // language class is the reliable signal.)
    if (className === "language-mermaid") {
      return <MermaidDiagram code={String(children).trim()} />;
    }
    if (className?.startsWith("language-")) {
      return (
        <code className="font-mono text-[0.85em]">{children}</code>
      );
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
    );
  },
  pre: ({ children, node }) => {
    // A fenced block is <pre><code>. When it's a mermaid diagram, the `code`
    // override already returned <MermaidDiagram>; render it bare (the diagram
    // carries its own card chrome) instead of wrapping it in a code <pre>.
    const child = node?.children?.[0];
    const cls =
      child && child.type === "element" ? child.properties?.className : undefined;
    const isMermaid = Array.isArray(cls)
      ? cls.includes("language-mermaid")
      : cls === "language-mermaid";
    if (isMermaid) return <>{children}</>;
    return (
      <pre className="my-3 overflow-x-auto rounded-xl border bg-card p-3 font-mono text-xs">{children}</pre>
    );
  },
};

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn(className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
