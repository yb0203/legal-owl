import * as React from "react";
import {
  TIME_BUCKET_LABELS,
  TIME_BUCKET_ORDER,
  timeBucket,
  type TimeBucket,
} from "@/lib/format";
import { CollapsibleSection } from "@/components/collapsible-section";

export interface TimeGroup<T> {
  bucket: TimeBucket;
  label: string;
  items: T[];
}

/**
 * Group dated items into Overdue / Today / This week / Later, in that order,
 * omitting empty buckets. Items with no date go to `undated` (returned
 * separately so the caller decides where they render). Input order is preserved
 * within each bucket, so pre-sort the items by date if needed.
 */
export function groupByTimeHorizon<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
): { groups: TimeGroup<T>[]; undated: T[] } {
  const byBucket = new Map<TimeBucket, T[]>();
  const undated: T[] = [];
  for (const item of items) {
    const b = timeBucket(getDate(item));
    if (!b) {
      undated.push(item);
      continue;
    }
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b)!.push(item);
  }
  const groups: TimeGroup<T>[] = TIME_BUCKET_ORDER.filter((b) => byBucket.has(b)).map((b) => ({
    bucket: b,
    label: TIME_BUCKET_LABELS[b],
    items: byBucket.get(b)!,
  }));
  return { groups, undated };
}

/**
 * Render time-horizon groups as collapsible sections. Server component: it calls
 * `renderRow` during server render and hands the rows to the client collapse
 * wrapper as children. Overdue is loud and always open; "Later" starts collapsed.
 */
export function TimeGroups<T>({
  groups,
  renderRow,
  rowKey,
}: {
  groups: TimeGroup<T>[];
  renderRow: (item: T) => React.ReactNode;
  rowKey: (item: T) => string;
}) {
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <CollapsibleSection
          key={g.bucket}
          title={g.label}
          count={g.items.length}
          defaultOpen={g.bucket !== "later"}
          tone={g.bucket === "overdue" ? "urgent" : "default"}
        >
          <ul
            className={
              g.bucket === "overdue"
                ? "divide-y overflow-hidden rounded-xl border border-urgent/40"
                : "divide-y overflow-hidden rounded-xl border"
            }
          >
            {g.items.map((item) => (
              <React.Fragment key={rowKey(item)}>{renderRow(item)}</React.Fragment>
            ))}
          </ul>
        </CollapsibleSection>
      ))}
    </div>
  );
}
