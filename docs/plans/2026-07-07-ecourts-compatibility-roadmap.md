---
name: eCourts API compatibility roadmap
last_updated: 2026-07-07
status: active — prioritized roadmap for full eCourts exploitation
---

# eCourts API Compatibility Roadmap

Companion to `docs/research/2026-07-06-ecourts-integration-audit.md`. That doc is the audit; this is the actionable plan broken down into schema changes, data model updates, and product experiences.

## Current state: ~2/10 depth

| Layer | Today |
|---|---|
| API capabilities used | 1 of 6 (CNR lookup only) |
| Fields captured | ~10 of 40+ |
| Agent loop | Wired but off — `runAmbient()` never called |
| Order ingestion | None — URLs synced as text, PDFs never downloaded |
| Morning board | Not built — cause list endpoint unused |
| Intake | CNR-only — search endpoint unused |

---

## P0 — Turn the agent loop on

**What:** Call `reactToSync` (which calls `runAmbient`) from `sync.ts` after every sync that produces new events.

**Why urgent:** The entire agent value prop — Court Scout, Limitation Clerk, Intake Registrar — is built and dormant. One function call activates it.

**Schema change:** None. `runAmbient` already exists in `lib/agents/react.ts`. The typed actions and Triage task insertion are wired.

**Code change:** In `lib/ecourts/sync.ts`, after the activity upsert and triage insertion, call:
```typescript
// Pass the newly-inserted activity row IDs so agents only read fresh events
await reactToSync(supabase, lawyer_id, matter_id, events)
```

**Product experience after P0:** Every nightly sync (and every "Sync now") produces cited agent proposals in the Inbox. Court Scout interprets the diff into a human-readable summary with sources. Limitation Clerk fires on order uploads and adds deadline proposals. Intake Registrar extracts key facts. The Inbox stops being a raw notification feed and becomes a finished-work approval queue.

---

## P1 — Cause list morning board

**What:** Call `GET /causelist/search?date=YYYY-MM-DD&court=CODE` for each court the lawyer has active matters in. Build a "morning board" surface — the day's hearing schedule across all courts, each matched to a matter.

**Why:** Zero marginal API cost (cause lists are free). Highest daily-value feature for a litigator. Replaces the habit of manually checking each court's daily board before leaving for court.

**Schema changes needed:**

```sql
-- Courts reference table (replaces regex-guessing in normalize.ts)
create table courts (
  code         text primary key,          -- eCourts courtCode (e.g. "MPHC001")
  name         text not null,
  state_code   text not null,
  court_type   text not null,             -- maps to forum_type enum
  is_active    boolean not null default true
);

-- Cause list entries (daily, one row per matter+hearing slot)
create table cause_list_entries (
  id           uuid primary key default gen_random_uuid(),
  lawyer_id    uuid not null references auth.users(id) on delete cascade,
  matter_id    uuid references matters(id) on delete cascade,
  court_code   text not null references courts(code),
  listed_date  date not null,
  slot_time    time,
  serial_no    integer,
  purpose      text,
  bench        text[],                    -- judges listed
  fetched_at   timestamptz not null default now(),
  unique (matter_id, listed_date, serial_no)
);
```

**Data model updates:**
- Populate `courts` table from the `/enums` court-structure endpoint (currently called once and cached, but the hierarchy is discarded)
- Store `court_code` on matters (currently inferred from CNR; should be explicit)
- Link `matters.court_code → courts.code` for cause list lookups

**Product experience after P1:**
- Home/Today view gets a "Courts today" section: each court the lawyer is appearing in, with matters listed in serial order
- A Hearing-Prep agent generates a brief for each hearing at 8:30 IST
- Calendar view shows cause list context alongside manually-entered hearings

---

## P2 — Order PDF ingestion (the grounding bridge)

**What:** When a sync produces an `order_uploaded` event, download the PDF from `orderUrl`, store it in the `case-documents` bucket, OCR it (via the eCourts API's own OCR markdown field or an external OCR service), and run Intake Registrar to extract span-cited facts.

**Why:** This is the bridge between eCourts (the sensor) and the citation ledger (the AI moat). Today, the citation ledger exists but has no eCourts-sourced facts in it. After P2, every court order becomes a grounded source for the assistant.

**Schema changes needed:**

```sql
-- Add eCourts-specific fields to documents
alter table documents
  add column ecourts_order_date   date,
  add column ecourts_order_type   text,        -- 'judgment' | 'interim' | 'order'
  add column ecourts_order_url    text,        -- source URL from eCourts
  add column ocr_text             text,        -- extracted text for fact extraction
  add column ocr_status           text not null default 'pending',   -- 'pending' | 'done' | 'failed'
  add column ocr_completed_at     timestamptz;

-- Index for the OCR queue
create index idx_documents_ocr_pending on documents (matter_id) where ocr_status = 'pending';
```

**Data model updates:**
- `normalize.ts`: instead of pushing `order_uploaded` events with just a URL, queue a download task
- New `lib/ecourts/ingest.ts`: download PDF → upload to storage → update `documents` row → trigger OCR → call Intake Registrar
- `RawCaseData` widening (see P4-cross-cutting below)

**Product experience after P2:**
- Every synced order appears in the Documents tab as a real file (not just a text event)
- The Owl assistant can answer questions about what a specific order said, with citations
- Intake Registrar proposals in the Inbox include span-cited facts from the order text
- Limitation Clerk fires automatically from order dates without the lawyer entering anything

---

## P3 — Search-driven matter intake

**What:** Implement the `/search` endpoint to let lawyers create matters by party name, FIR number, or filing number — without needing the CNR.

**Why:** CNRs are not always known at intake. A client walks in and says "I have a case in Delhi High Court." The lawyer should be able to type the client's name and find the CNR automatically.

**Schema changes needed:** None to the core schema. The search results return a CNR; everything else flows through the existing connect-by-CNR path.

**New surfaces:**
- Matter creation flow: a "Search eCourts" tab alongside manual entry
- Client intake: "Find their cases" button that searches by name

**Product experience after P3:**
- Lawyer types party name → sees a list of matching cases → selects the right one → matter is created and put under monitoring in one step
- Fulfills the landing page promise ("search by party name") that is currently unbuilt

---

## P4 — Reliability, cost control, and data completeness

### Real bulk refresh
**Current:** `bulkRefresh()` loops single `getCase()` calls. **Fix:** Use the true bulk POST endpoint (≤50 CNRs per call). Reduces nightly cron duration and API latency significantly for lawyers with many active matters.

### Per-lawyer credit tracking
**Current:** Single shared `ECOURTS_API_KEY` with no visibility into spend.
**Schema:**
```sql
alter table sync_runs
  add column api_credits_used   integer,
  add column api_credits_remaining integer;

create table ecourts_credit_log (
  id           uuid primary key default gen_random_uuid(),
  lawyer_id    uuid not null references auth.users(id),
  date         date not null,
  credits_used integer not null default 0,
  budget       integer,                      -- daily cap
  unique (lawyer_id, date)
);
```

### Stop losing raw API data
**Current:** `normalize.ts` silently drops: `judges`, `filingDate`, `registrationNumber`, `businessOnDate` on each hearing, `acts_sections`, `interimApplications`, `connectedCases`, `advocates`.
**Fix:** Widen `RawCaseData` and `normalize.ts` to preserve these. Store `raw_response jsonb` on `sync_runs` so historical data survives future schema changes.

```typescript
// Add to RawCaseData in lib/ecourts/types.ts
judges?: string[];
filingDate?: string;
registrationNumber?: string;
actsAndSections?: Array<{ act: string; sections: string[] }>;
interimApplications?: Array<{ iaNumber: string; status: string; nextDate: string }>;
connectedCases?: string[];       // CNRs of related matters
advocates?: Array<{ name: string; side: 'petitioner' | 'respondent' }>;
```

**Schema additions:**
```sql
-- Add to matters
alter table matters
  add column filing_date          date,
  add column registration_number  text,
  add column judges               text[],
  add column acts_sections        jsonb,     -- [{ act, sections[] }]
  add column advocates            jsonb,     -- [{ name, side }]
  add column connected_cnrs       text[];    -- linked case CNRs

-- Add to tasks (hearing rows)
alter table tasks
  add column business_on_date     text;     -- what actually happened (businessOnDate)
```

### Staleness signaling
- Add `last_successful_sync_at` staleness badge (>24h = amber warning) on the matter detail header
- Add `days_since_sync` to the Matters list for at-a-glance monitoring health

---

## Migration sequence

The phases above can be shipped independently. Recommended order:

1. **P0** — one-week work, activates the entire agent layer. Ship first.
2. **P4 (data widening only)** — widen `RawCaseData` + `normalize.ts` immediately alongside P0, before re-billing the eCourts API for data you'll start dropping again.
3. **P1** — cause list board. Two-week feature, zero API cost, highest daily value.
4. **P2** — order ingestion. Requires OCR pipeline decision; three-to-four weeks.
5. **P3** — search intake. Two-week feature; UI-heavy.
6. **P4 (bulk + credits)** — infrastructure; ship when the lawyer base grows to where single-threaded crons become slow.
