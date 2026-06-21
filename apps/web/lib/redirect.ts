import { redirect } from "next/navigation";

// Surface a Server Action error by redirecting back with an ?error= message.
export function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}
