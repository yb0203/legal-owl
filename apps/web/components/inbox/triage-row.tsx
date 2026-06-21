"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/types";
import { acceptTriageItem, dismissTriageItem, snoozeTriageItem } from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export interface TriageRowItem {
  id: string;
  summary: string;
  kindLabel: string;
  matter: { id: string; title: string; key: string } | null;
}

export function TriageRow({ item }: { item: TriageRowItem }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="min-w-0">
        <span className="rounded bg-lemon/15 px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
          {item.kindLabel}
        </span>
        <p className="mt-1.5 text-sm font-medium">{item.summary}</p>
        {item.matter && (
          <Link href={`/matters/${item.matter.id}`} className="text-xs text-muted-foreground hover:text-foreground">
            {item.matter.title} · <span className="font-mono tnum">{item.matter.key}</span>
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => setOpen(true)}>
          Accept as task
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => start(() => snoozeTriageItem(item.id))}
        >
          <Clock className="size-3.5" />
          Snooze
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => start(() => dismissTriageItem(item.id))}
        >
          Dismiss
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept as task</DialogTitle>
          </DialogHeader>
          <form
            action={async (fd) => {
              await acceptTriageItem(fd);
              setOpen(false);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="item_id" value={item.id} />
            <p className="text-sm text-muted-foreground">{item.summary}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`pri-${item.id}`}>Priority</Label>
                <select id={`pri-${item.id}`} name="priority" defaultValue="medium" className={selectCls}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`due-${item.id}`}>Due date</Label>
                <Input id={`due-${item.id}`} name="due_date" type="date" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit">Create task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </li>
  );
}
