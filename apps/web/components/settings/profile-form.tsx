"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ProfileValues {
  full_name: string | null;
  firm_name: string | null;
  phone: string | null;
  bar_enrolment: string | null;
}

export function ProfileForm({ email, profile }: { email?: string | null; profile: ProfileValues | null }) {
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) =>
        start(async () => {
          try {
            await updateProfile(fd);
            toast.success("Profile saved");
          } catch {
            toast.error("Couldn't save your profile — please try again.");
          }
        })
      }
      className="space-y-4 p-4"
    >
      <div className="space-y-1.5">
        <Label>Email</Label>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="full_name">Your name</Label>
        <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} placeholder="Adv. Asha Rao" />
        <p className="text-xs text-muted-foreground">Appears on client update emails.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="firm_name">Firm name</Label>
        <Input id="firm_name" name="firm_name" defaultValue={profile?.firm_name ?? ""} placeholder="Rao & Associates" />
        <p className="text-xs text-muted-foreground">Shown to clients on updates and (later) the client portal.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} placeholder="+91 …" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bar_enrolment">Bar enrolment no.</Label>
          <Input id="bar_enrolment" name="bar_enrolment" defaultValue={profile?.bar_enrolment ?? ""} />
        </div>
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
