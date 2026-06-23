"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { FORUM_TYPES, FORUM_LABELS, type ForumType, type Parties } from "@/lib/types";
import { updateMatter } from "@/app/(app)/matters/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/native-select";

export function EditDetailsDialog({
  matter,
}: {
  matter: {
    id: string;
    title: string;
    case_type: string | null;
    forum_type: ForumType;
    cnr: string | null;
    parties: Parties;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Edit details
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit matter</DialogTitle>
        </DialogHeader>
        <form
          action={async (fd) => {
            await updateMatter(fd);
            setOpen(false);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="matter_id" value={matter.id} />
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required defaultValue={matter.title} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="forum_type">Forum</Label>
              <NativeSelect
                id="forum_type"
                name="forum_type"
                defaultValue={matter.forum_type}
              >
                {FORUM_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {FORUM_LABELS[f]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case_type">Case type</Label>
              <Input id="case_type" name="case_type" defaultValue={matter.case_type ?? ""} placeholder="e.g. W.P.(C)" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnr">CNR</Label>
            <Input id="cnr" name="cnr" defaultValue={matter.cnr ?? ""} className="font-mono" placeholder="optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="petitioners">Petitioners</Label>
              <Textarea
                id="petitioners"
                name="petitioners"
                rows={3}
                defaultValue={(matter.parties?.petitioners ?? []).join("\n")}
                placeholder="One per line"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="respondents">Respondents</Label>
              <Textarea
                id="respondents"
                name="respondents"
                rows={3}
                defaultValue={(matter.parties?.respondents ?? []).join("\n")}
                placeholder="One per line"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
