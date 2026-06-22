---
title: "fix: Next.js 16 best practices — hydration warning + proxy migration"
date: 2026-06-22
status: ready
depth: lightweight
---

# fix: Next.js 16 best practices

Two small, well-bounded Next.js 16 hygiene fixes, grounded in the `vercel:nextjs` skill guidance:
silence the recurring browser-extension hydration-mismatch console error at its documented source, and
adopt the v16 `proxy` file convention to clear the deprecation warning. Paths are relative to `apps/web/`.

## Problem frame

1. **Hydration warning.** The dev console repeatedly throws a hydration mismatch on `<body>` in
   `app/layout.tsx`. The mismatched attributes (`bis_register`, `__processed_<uuid>__`) are injected
   by a browser extension before React hydrates — not app code (confirmed: the same warning appears on
   a clean tree, and Next's own error text lists browser extensions as a cause). The documented fix is
   `suppressHydrationWarning` on the element the extension mutates.
2. **Deprecation warning.** Next.js 16 renamed the `middleware` convention to `proxy`. The build/dev
   logs print: *“The ‘middleware’ file convention is deprecated. Please use ‘proxy’ instead.”* The
   project still ships `middleware.ts`.

**Success criteria:** the hydration console error no longer fires on a normal load; the
middleware-deprecation warning no longer prints on `npm run build`/`dev`; session refresh still works
on every route. Gate: `npm run build` (tsc + route gen) stays green (no test runner — see below).

## Requirements

- **R1** — Add `suppressHydrationWarning` to the root layout so extension-injected attributes on
  `<html>`/`<body>` no longer raise a hydration mismatch. Scope it to the root layout only — do not
  blanket-apply it elsewhere (it would mask real mismatches).
- **R2** — Migrate `middleware.ts` → `proxy.ts`: export `proxy()` (was `middleware()`) and
  `proxyConfig` (was `config`), preserving the existing matcher and `updateSession` wiring. The
  deprecation warning is gone afterward.

## Testing reality

The repo has **no test runner** (`CLAUDE.md`: "no test suite yet; `npm run build` is the correctness
gate"). Both units are config/convention changes with no behavioral logic to unit-test; verification
is build + manual console/log observation. Scenarios below are written accordingly.

## Key Technical Decisions

- **KTD1 — `suppressHydrationWarning` on `<body>` (and `<html>`), not a `ClientOnly`/`mounted` guard
  or extension-attribute scrubbing.** The mismatch is third-party DOM mutation on the root elements;
  `suppressHydrationWarning` is exactly the Next/React-sanctioned escape hatch and is one attribute
  deep (React only suppresses the warning for that element's own attributes, not its subtree — so real
  mismatches inside the app still surface). _Rationale:_ smallest correct fix; no runtime cost; doesn't
  hide app bugs.
- **KTD2 — Rename to `proxy.ts` by hand (or via the codemod) rather than leaving `middleware.ts`.**
  The file is a thin `updateSession` wrapper, so the rename is mechanical: `middleware`→`proxy`,
  `config`→`proxyConfig`. _Rationale:_ adopts the v16 convention and clears the warning;
  `apps/web/lib/supabase/middleware.ts` (the `updateSession` helper) is a separate internal module and
  is intentionally left named as-is — it is not the Next file convention.

## Implementation Units

### U1. Suppress extension-induced hydration warning in the root layout
**Goal:** Stop the hydration-mismatch console error caused by browser-extension attributes on the
document root.
**Requirements:** R1.
**Dependencies:** none.
**Files:** `app/layout.tsx`.
**Approach:** Add `suppressHydrationWarning` to the `<html>` and `<body>` elements in `RootLayout`.
Leave everything else (font variable classNames, metadata) unchanged. Do not add it to any other
component — it must stay scoped to the root document elements that extensions mutate.
**Patterns to follow:** the existing `RootLayout` in `app/layout.tsx`; Next.js hydration-error
guidance (browser-extension cause).
**Test scenarios:**
- Load any page in a browser with the offending extension active → no hydration-mismatch error in the
  console (previously thrown on `<body>`).
- A deliberately-introduced *real* mismatch inside a page component still warns (confirms the
  suppression is root-scoped, not global) — spot-check only; revert after.
- `npm run build` succeeds; pages render unchanged.
**Verification:** console is clean of the `bis_register`/`__processed_` mismatch on a normal load;
build green.

### U2. Migrate `middleware.ts` to the v16 `proxy.ts` convention
**Goal:** Adopt the Next 16 `proxy` file convention and clear the deprecation warning, with session
refresh unchanged.
**Requirements:** R2.
**Dependencies:** none.
**Files:** delete `middleware.ts`, create `proxy.ts` (same directory, `apps/web/`).
**Approach:** Recreate the file as `proxy.ts`: export `async function proxy(request)` delegating to
`updateSession` (import unchanged from `@/lib/supabase/middleware`), and rename `export const config`
to `export const proxyConfig` with the same matcher array. The `@next/codemod upgrade` codemod can do
this automatically; doing it by hand is equally safe given the file's size. Do **not** rename the
internal `lib/supabase/middleware.ts` helper — only the root Next file convention changes.
**Patterns to follow:** current `middleware.ts` (wrapper + matcher); `vercel:nextjs` file-conventions
(`proxy()` / `proxyConfig`, v16 table).
**Test scenarios:**
- `npm run build` no longer prints the “middleware file convention is deprecated” warning.
- Build output still lists `ƒ Proxy (Middleware)` (the proxy is wired).
- Hit an authenticated route signed-out → still redirects to `/login` (session refresh + gating
  intact); hit it signed-in → loads (the matcher still excludes static assets).
**Verification:** deprecation warning gone; auth/session behavior unchanged across a protected and a
public route; build green.

## Scope Boundaries

**In scope:** U1 (root-layout hydration suppression) and U2 (proxy migration).

### Deferred to Follow-Up Work
- None planned. Other Next.js best-practice checks were verified already-clean during research and need
  no work: **no `<img>`** usage (so `next/image` isn't needed), **`next/font`** already used for
  Geist/Source Serif, pages use **async `searchParams`** (server) rather than the client
  `useSearchParams` hook (so no Suspense bailout), and the IST `greeting()` timezone issue was already
  fixed in earlier work. If `<img>` tags or client-side `useSearchParams` are introduced later, revisit
  `next/image` and Suspense boundaries respectively.

## Risks & Mitigations

- **Over-suppression hiding real mismatches (U1):** mitigated by scoping `suppressHydrationWarning` to
  the root layout only — React limits it to that element's own attributes, so app-level mismatches
  still surface.
- **Proxy rename breaking session refresh (U2):** the matcher and `updateSession` call are preserved
  verbatim; verify the redirect behavior on a protected route after the rename. Low risk — mechanical
  rename.

## Sources & Research

- `vercel:nextjs` skill — hydration-error guidance (browser-extension cause) and the v16
  `middleware`→`proxy` file-convention rename (`proxy()` / `proxyConfig`; codemod
  `npx @next/codemod@latest upgrade`).
- Current code: `app/layout.tsx` (root layout), `middleware.ts` (thin `updateSession` wrapper +
  matcher), `lib/supabase/middleware.ts` (the internal helper, intentionally unchanged).
- `CLAUDE.md` — `npm run build` is the correctness gate; no test runner.
