"use client";

import { Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/(app)/matters/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Confirm before deleting a document — destructive + irreversible.
export function ConfirmDeleteDocument({
  docId,
  matterId,
  storagePath,
  name,
}: {
  docId: string;
  matterId: string;
  storagePath: string;
  name: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <button
            type="button"
            aria-label={`Delete ${name}`}
            className="shrink-0 text-muted-foreground transition-colors hover:text-urgent"
          />
        }
      >
        <Trash2 className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this document?</AlertDialogTitle>
          <AlertDialogDescription>
            “{name}” will be permanently removed from this matter. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button type="button" variant="outline" />}>Cancel</AlertDialogCancel>
          <form action={deleteDocument}>
            <input type="hidden" name="doc_id" value={docId} />
            <input type="hidden" name="matter_id" value={matterId} />
            <input type="hidden" name="storage_path" value={storagePath} />
            <input type="hidden" name="doc_name" value={name} />
            <AlertDialogAction render={<Button type="submit" variant="destructive" />}>
              Delete
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
