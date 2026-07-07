-- eCourts field expansion — store all fields the partner API returns.
-- Field names verified against the live API response (fixture: MPHC030028202013).

alter table matters
  add column if not exists filing_date           date,
  add column if not exists registration_number   text,
  add column if not exists court_code            text,
  add column if not exists court_name            text,
  add column if not exists disposal_type         text,
  add column if not exists judges                text[],
  add column if not exists petitioner_advocates  text[],
  add column if not exists respondent_advocates  text[],
  add column if not exists connected_cnrs        text[],
  add column if not exists state                 text,
  add column if not exists state_code            text;

alter table tasks
  add column if not exists business_on_date text;

alter table documents
  add column if not exists ecourts_order_date date,
  add column if not exists ecourts_order_type text,
  add column if not exists ocr_text           text,
  add column if not exists ocr_status         text not null default 'na';

create index if not exists idx_documents_ocr_pending
  on documents (matter_id)
  where ocr_status = 'pending';
