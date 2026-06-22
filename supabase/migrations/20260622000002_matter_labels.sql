-- Matter labels — tagging on matters, mirroring the existing action_labels join.
-- Lets a lawyer organise their case list with the same labels they tag tasks
-- with. RLS: every row scoped to its owning lawyer (auth.uid() = lawyer_id).

create table if not exists matter_labels (
  lawyer_id uuid not null references auth.users(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  label_id  uuid not null references labels(id) on delete cascade,
  primary key (matter_id, label_id)
);

alter table matter_labels enable row level security;

-- drop-if-exists keeps the migration safe to re-apply (CI reset / rollback),
-- mirroring the style in 20260622000001_profiles.sql.
drop policy if exists "matter_labels_sel" on matter_labels;
create policy "matter_labels_sel"
  on matter_labels for select
  using (auth.uid() = lawyer_id);

drop policy if exists "matter_labels_ins" on matter_labels;
create policy "matter_labels_ins"
  on matter_labels for insert
  with check (auth.uid() = lawyer_id);

drop policy if exists "matter_labels_del" on matter_labels;
create policy "matter_labels_del"
  on matter_labels for delete
  using (auth.uid() = lawyer_id);
