"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Submit button with a built-in pending state for Server-Action forms. While the
// form is submitting it disables and shows a spinner + pending label, so auth
// steps (sign in, request access, send reset link, update password) give
// feedback instead of appearing to hang. A form may hold several of these
// (login has Sign in + Request access); each spins only for its own action and
// all are disabled while any submission is in flight.
export function AuthSubmitButton({
  action,
  pendingText,
  children,
  ...props
}: {
  action: (formData: FormData) => void | Promise<void>;
  pendingText: string;
} & Omit<React.ComponentProps<typeof Button>, "type" | "formAction" | "children"> & {
    children: React.ReactNode;
  }) {
  const { pending, action: active } = useFormStatus();
  const isMine = pending && active === action;
  return (
    <Button type="submit" formAction={action} disabled={pending} aria-busy={isMine} {...props}>
      {isMine ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
