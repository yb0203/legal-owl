"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";

// Mermaid is heavy (~200KB gzipped) and touches `document`, so it must never
// run on the server and must stay out of the initial bundle. We lazy-import it
// inside the effect, render to an SVG string, and inject it. `useId()` gives
// each diagram a collision-free id even when several share a page.
function themeVariables(dark: boolean) {
  // Hex (not CSS vars — mermaid's var() support isn't stable) pulled to match
  // the off-dark mint/lemon palette in app/globals.css.
  return dark
    ? {
        darkMode: true,
        background: "#16201c",
        primaryColor: "#1f2d28",
        primaryTextColor: "#e8efe9",
        primaryBorderColor: "#3ddc97",
        secondaryColor: "#2a2f1f",
        lineColor: "#7d8a82",
        tertiaryColor: "#1b2620",
        fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
      }
    : {
        darkMode: false,
        background: "#ffffff",
        primaryColor: "#eafaf2",
        primaryTextColor: "#0f1a15",
        primaryBorderColor: "#0f9d6b",
        secondaryColor: "#fbf7df",
        lineColor: "#6b7280",
        tertiaryColor: "#f4f7f5",
        fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
      };
}

export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  // mermaid uses the id as an SVG element id; colons (React's useId) are invalid there.
  const id = "m" + useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: themeVariables(resolvedTheme !== "light"),
        });
        const { svg } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(svg);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id, resolvedTheme]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-urgent/40 bg-urgent/10 p-3 text-xs text-urgent">
        Diagram failed to render: {error}
      </pre>
    );
  }
  if (!svg) {
    return <div className="h-40 animate-pulse rounded-xl border bg-card" aria-hidden />;
  }
  return (
    <div
      className="mermaid-diagram overflow-x-auto rounded-xl border bg-card p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
