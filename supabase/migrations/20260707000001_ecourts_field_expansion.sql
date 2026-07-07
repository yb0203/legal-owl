-- eCourts field expansion — stop losing API data.
--
-- Adds the ~30 fields the partner API returns that were previously dropped in
-- normalize.ts. Also stores the raw API response on sync_runs for historical
-- preservation, and adds OCR fields to documents for the order ingestion pipeline.
--
-- All additions use `if not exists` so this migration is safe to re-apply.
-- No new RLS policies needed: existing per-lawyer policies on matters/tasks cover
-- the new columns; sync_runs and documents already have RLS.

-- ── matters: eCourts-sourced fields ─────────────────────────────────────────
alter table matters
  add column if not exists filing_date         date,
  add column if not exists registration_number text,
  add column if not exists judges              text[],
  add column if not exists acts_sections       jsonb,    -- [{ act, sections[] }]
  add column if not exists advocates           jsonb,    -- [{ name, side }]
  add column if not exists connected_cnrs      text[],   -- CNRs of related matters
  add column if not exists state               text,     -- court state (e.g. "Madhya Pradesh")
  add column if not exists state_code          text;     -- eCourts state code

-- ── tasks: hearing-row supplement ───────────────────────────────────────────
-- businessOnDate from the API = what actually happened at the hearing,
-- distinct from purposeOfListing (what was scheduled). Only populated on
-- past hearing rows where the API provides it.
alter table tasks
  add column if not exists business_on_date text;

-- ── sync_runs: raw response preservation ────────────────────────────────────
-- Store the full API response before normalization so fields added in the future
-- can be derived from history without re-billing the eCourts API.
alter table sync_runs
  add column if not exists raw_response jsonb;

-- ── documents: OCR + eCourts order metadata ──────────────────────────────────
-- Added here (not in a separate migration) because the order ingestion pipeline
-- (U5) depends on both this migration and the matters widening above.
alter table documents
  add column if not exists ecourts_order_date date,
  add column if not exists ecourts_order_type text,     -- 'judgment' | 'interim'
  add column if not exists ocr_text           text,     -- extracted text (from eCourts OCR markdown)
  add column if not exists ocr_status         text not null default 'na';
  -- 'na' for non-eCourts uploads, 'pending', 'done', 'failed'

-- Index for the OCR queue (future retry sweep).
create index if not exists idx_documents_ocr_pending
  on documents (matter_id)
  where ocr_status = 'pending';
