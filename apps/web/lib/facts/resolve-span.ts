// Deterministic span resolution — the heart of span-accurate citations.
//
// LLMs cannot count characters reliably (an intake model claimed [144,153] for
// text actually at [145,155]), so citation offsets are ALWAYS computed here by
// searching the source text for the verbatim `quote` the model returned — never
// trusted from the model. This mirrors LlamaIndex's own approach: they removed
// automatic offset tracking as "frequently not correct" and their maintainer
// recommends exactly this (str.find after the model returns text). See
// docs/research/llamaindex-span-citation-best-practices.md.

export interface SpanMatch {
  start: number; // inclusive char offset into the ORIGINAL text
  end: number; // exclusive
  confidence: number; // 1 exact, <1 tolerant match
}

/**
 * Find the true character range of `quote` within `text`, or null if it can't be
 * located (caller should fail closed — drop the citation / route to human review
 * rather than emit a wrong span). Offsets are always into the original `text`.
 */
export function resolveSpan(text: string, quote: string): SpanMatch | null {
  const q = quote.trim();
  if (!q) return null;

  // 1. Exact match — the common case with clean extracted text.
  const exact = text.indexOf(q);
  if (exact >= 0) return { start: exact, end: exact + q.length, confidence: 1 };

  // 2. Whitespace-tolerant match — models often normalise spacing / newlines that
  //    differ from the source (and OCR introduces stray whitespace). Build a regex
  //    where any run of whitespace matches any run in the source, and match against
  //    the ORIGINAL text so the returned offsets stay true to it.
  const pattern = q
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape regex metachars
    .replace(/\s+/g, "\\s+");
  const m = new RegExp(pattern).exec(text);
  if (m) return { start: m.index, end: m.index + m[0].length, confidence: 0.9 };

  // 3. Not found. Fail closed. A rapidfuzz-style fuzzy fallback with a strict
  //    threshold is the next refinement (see the research doc); until then an
  //    unresolved quote must NOT produce a fabricated span.
  return null;
}
