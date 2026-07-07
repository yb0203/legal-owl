-- eCourts field expansion — store all fields the partner API returns.
-- Field names verified against the live API response (fixture: MPHC030028202013).
--
-- All additions use `if not exists` so this migration is safe to re-apply.
-- No new RLS policies needed: existing per-lawyer policies on matters/tasks cover
-- the new columns; sync_runs and documents already have RLS.

-- ── matters: eCourts-sourced fields ─────────────────────────────────────────
alter table matters
  add column if not exists filing_date           date,
  add column if not exists registration_number   text,
  add column if not exists court_code            text,     -- cnrCourtCode e.g. "MPHC03"
  add column if not exists court_name            text,     -- display e.g. "High Court of MP"
  add column if not exists disposal_type         text,     -- e.g. "ALLOWED"
  add column if not exists judges                text[],   -- case-level judge list (often empty)
  add column if not exists petitioner_advocates  text[],   -- petitionerAdvocates from API
  add column if not exists respondent_advocates  text[],   -- respondentAdvocates from API
  add column if not exists connected_cnrs        text[],   -- taggedMatters from API
  add column if not exists state                 text,
  add column if not exists state_code            text;

-- ── tasks: hearing-row supplement ───────────────────────────────────────────
-- businessOnDate = what actually happened, distinct from purposeOfListing.
alter table tasks
  add column if not exists business_on_date text;

-- ── sync_runs: raw response preservation ────────────────────────────────────
alter table sync_runs
  add column if not exists raw_response jsonb;

-- ── documents: OCR + eCourts order metadata ─────────────────────────────────
alter table documents
  add column if not exists ecourts_order_date date,
  add column if not exists ecourts_order_type text,
  add column if not exists ocr_text           text,
  add column if not exists ocr_status         text not null default 'na';

create index if not exists idx_documents_ocr_pending
  on documents (matter_id)
  where ocr_status = 'pending';
