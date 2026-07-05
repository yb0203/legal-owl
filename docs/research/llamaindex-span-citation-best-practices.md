---
name: LlamaIndex best practices — span-cited agentic document extraction
last_updated: 2026-07-05
---

# Span-cited agentic document extraction — LlamaIndex best practices

Research to harden Legal Owl's span-citation pipeline (extract "facts" from court
documents, each traceable to an exact source span). Motivated by a confirmed bug:
the intake LLM returned char offsets `[144,153]` for text actually at `[145,155]`.

## Bottom line

Our approach is correct and matches LlamaIndex's own evolution. LlamaIndex **removed
automatic `start_char_idx`/`end_char_idx` tracking as unreliable**, and its
maintainer recommends exactly our pattern: the model returns text; code locates it
in the source by search. **No LLM in LlamaIndex ever emits a character offset** —
offsets are always computed by code.

Maintainer Logan Markewich ([issue #9101](https://github.com/run-llama/llama_index/issues/9101)):
> "We removed tracking for start/end_char_idx… It was frequently not correct… A
> simple fuzzy search is probably the easiest drop-in replacement."

## How LlamaIndex actually computes offsets

- `TextNode.start_char_idx`/`end_char_idx` are optional and default `None`; the
  splitters (`SentenceSplitter`) don't set them.
- The base `NodeParser._postprocess_parsed_nodes()` sets them *after* chunking by
  `parent_doc.text.find(node_content, search_start)` — a deterministic `str.find`
  with a **monotonic per-document cursor** (`positions[doc] = start + 1`) so
  duplicate substrings are disambiguated by searching forward, while +1 (not +len)
  keeps overlapping chunks findable.
- `CitationQueryEngine` cites at **node/chunk** granularity (pre-numbered "Source N"
  chunks; the LLM emits `[1]`/`[2]` markers, never offsets) — not char spans.
- The (deprecated) `FuzzyCitationQueryEngine` is essentially our architecture:
  sentence-split response + source, `thefuzz.fuzz.ratio` match above a threshold,
  then exact `.find()` for the offset. Two-stage: **fuzzy-match to narrow, exact
  find to pin.**

## Our render gate is stronger than theirs

LlamaIndex's nearest guard is `FaithfulnessEvaluator` — an LLM-as-judge groundedness
score (probabilistic). Our gate — *reject any fact whose citation doesn't resolve to
a real span* — is **structural** (deterministic pass/fail), cheaper and stronger.
Keep it; don't dilute it toward an LLM-judge.

## Failure modes & mitigations

- **Duplicate substrings** — `indexOf` grabs the first hit. Use a monotonic forward
  cursor per document/run; disambiguate with surrounding context; flag ambiguity for
  review rather than guessing.
- **OCR / whitespace drift** — normalise whitespace/unicode on both sides before
  searching (keep an offset-preserving map so the span points at the real original
  chars); fall back to fuzzy (`rapidfuzz`, not `thefuzz`) with a **strict** threshold
  (>85, not LlamaIndex's loose 50).
- **Multi-span facts** — model each fact as one-or-more `(quote, span)` pairs; require
  the smallest verbatim fragment per atomic sub-claim; never splice a discontiguous
  quote.
- **Not found at all** — hard-fail (don't render), route to human review, and use it
  as a signal to strengthen the "copy characters exactly, do not paraphrase" prompt
  or move to function-calling structured output.

## Apply to Legal Owl

1. **Prompt contract (intake-registrar):** never ask for offsets; return a verbatim
   `quote` (smallest span proving the atomic claim) + structured fields. Prefer a
   tool/function-calling schema over free-form JSON to reduce character drift. *(done:
   the agent returns `quote`.)*
2. **Offset resolution:** `apps/web/lib/facts/resolve-span.ts` — normalise + exact
   `find` (with a forward cursor for duplicates) → `rapidfuzz` fallback (strict
   threshold) → fail closed. *(done: exact + whitespace-tolerant; fuzzy + cursor are
   the next refinements.)*
3. **Render gate:** a fact whose quote doesn't resolve is not committed / not
   rendered; route to the Inbox/Triage review state instead of guessing. *(done:
   the adapter drops unresolved span citations, so the gate drops the proposal.)*
4. **Multi-span facts:** citation-ledger rows as one row per `(fact_id, quote, start,
   end)`, not one span per fact. *(schema already supports `unique(claim_id, position)`
   — multiple citation rows per claim.)*
5. **Scanned PDFs:** when eCourts docs are image-only, evaluate **LlamaParse** for its
   bounding-box output (`extract_layout=True`, `granular_bboxes`) as the grounding unit
   — page + bbox instead of char offset — rather than forcing offsets onto noisy OCR.
6. **Library:** prefer `rapidfuzz` over `thefuzz` when adding the fuzzy fallback.

## Sources

- [issue #9101](https://github.com/run-llama/llama_index/issues/9101) (maintainer on removing offset tracking / fuzzy search)
- `node_parser/interface.py` `_postprocess_parsed_nodes`, `node_parser/node_utils.py`, `schema.py` (`TextNode` char idx) — llama_index core `main`
- [CitationQueryEngine](https://developers.llamaindex.ai/python/examples/query_engine/citation_query_engine/); FuzzyCitationQueryEngine ([PyPI](https://pypi.org/project/llama-index-packs-fuzzy-citation/))
- [Structured prediction](https://developers.llamaindex.ai/python/framework/understanding/extraction/structured_prediction/), [agent structured output](https://developers.llamaindex.ai/python/framework/understanding/agent/structured_output/), [human-in-the-loop](https://developers.llamaindex.ai/python/framework/understanding/agent/human_in_the_loop/)
- [Faithfulness evaluator](https://developers.llamaindex.ai/python/examples/evaluation/faithfulness_eval/)
- LlamaParse: [legal OCR](https://www.llamaindex.ai/services/ocr-for-legal-documents), [granular bounding boxes](https://www.llamaindex.ai/blog/announcing-granular-bounding-boxes-in-llamaparse), [LiteParse visual citations](https://developers.llamaindex.ai/liteparse/guides/visual-citations/)
