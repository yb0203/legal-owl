# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This is a **pre-code repository**. The only content is `STRATEGY.md`, the product strategy document. There is no application code, build system, dependency manifest, or test suite yet. When the first code lands, update this file with the actual build/lint/test commands and architecture.

## Product context

Legal Owl is a workflow-automation + case-grounded AI product for **solo lawyers and small law firms**. The core bet: AI answers/drafts must be traceable to real case data and legal domain knowledge (not generic LLM output), so lawyers can act on them. See `STRATEGY.md` for the full strategy; it is the source of truth for product direction.

The product is organized into four tracks, which is the most likely shape for how code/features will be organized:

- **Court monitoring** — automated tracking of e-courts for case status, judgements, and hearing dates (replaces manual portal checks).
- **Case management** — structured, auto-updated case records replacing Excel. This is the foundation other tracks depend on; automation "lands" here.
- **AI document assistant** — ingests/summarizes case documents and provides a chat interface grounded in specific case files. The core AI differentiator is *grounding in real case data*.
- **Client experience** — automated client update emails and a client-facing dashboard for live case status.

Explicitly **out of scope** (do not build without checking strategy): task management / associate coordination, invoice generation, enterprise law firm targeting.

## Working with the strategy doc

`STRATEGY.md` has YAML frontmatter (`name`, `last_updated`). When editing it, bump `last_updated` (today's date). Keep the document's existing structure (Target problem / Our approach / Who it's for / Key metrics / Tracks / Not working on / Marketing).
