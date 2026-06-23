"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Clock, ChevronDown } from "lucide-react";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/types";
import {
  acceptTriageItem,
  dismissTriageItem,
  reopenTriageItem,
  snoozeTriageItem,
} from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/native-select";

export interface TriageRowItem {
  id: string;
  summary: string;
  kindLabel: string;
  matter: { id: string; title: string; key: string } | null;
}

function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function TriageRow({ item }: { item: TriageRowItem }) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [pending, start] = useTransition();

  const undoToast = (label: string) =>
    toast(label, {
      action: {
        label: "Undo",
        onClick: () =>
          start(async () => {
            try {
              await reopenTriageItem(item.id);
            } catch {
              toast.error("Couldn't undo — please refresh.");
            }
          }),
      },
    });

  const snooze = (untilIso?: string, label = "Snoozed") =>
    start(async () => {
      try {
        await snoozeTriageItem(item.id, untilIso);
        undoToast(label);
      } catch {
        toast.error("Couldn't snooze — please try again.");
      }
    });

  const dismiss = () =>
    start(async () => {
      try {
        await dismissTriageItem(item.id);
        undoToast("Dismissed");
      } catch {
        toast.error("Couldn't dismiss — please try again.");
      }
    });

  const applyCustom = () => {
    if (!customDate) return;
    setCustomOpen(false);
    snooze(new Date(customDate).toISOString(), "Snoozed");
  };

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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => setOpen(true)}>
          Accept as task
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" disabled={pending} />}>
            <Clock className="size-3.5" />
            Snooze
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuItem onClick={() => snooze(undefined, "Snoozed till before next hearing")}>
              Until before next hearing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => snooze(isoInDays(1))}>Tomorrow</DropdownMenuItem>
            <DropdownMenuItem onClick={() => snooze(isoInDays(7))}>Next week</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCustomOpen(true)}>Pick a date…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={dismiss}>
          Dismiss
        </Button>
      </div>

      {customOpen && (
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="h-9 w-40"
          />
          <Button type="button" size="sm" disabled={pending || !customDate} onClick={applyCustom}>
            Snooze until
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCustomOpen(false)}>
            Cancel
          </Button>
        </div>
      )}

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
                <NativeSelect id={`pri-${item.id}`} name="priority" defaultValue="medium">
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </NativeSelect>
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
