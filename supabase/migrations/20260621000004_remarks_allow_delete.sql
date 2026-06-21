-- Remarks immutability: forbid UPDATE only, not DELETE.
--
-- The original trigger fired on `update or delete`, which blocked the
-- ON DELETE CASCADE from matters → remarks: deleting a Matter (or clearing
-- seed/demo data) raised "rows in remarks are immutable" and aborted the
-- whole delete. Remark *content* must stay immutable (no edits), but removing
-- a remark as part of its parent Matter's lifecycle is legitimate and already
-- permitted by the per-lawyer RLS delete policy.

drop trigger if exists remarks_immutable on remarks;
create trigger remarks_immutable before update on remarks
  for each row execute function forbid_mutation();
