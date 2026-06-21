import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Until a domain is verified in Resend, sends use the shared onboarding sender
// and only reach the Resend account owner. Swap to a verified domain for prod.
const FROM = "Legal Owl <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) return { skipped: true as const };
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error("resend error:", error);
      return { error };
    }
    return { data };
  } catch (e) {
    console.error("resend exception:", e);
    return { error: e };
  }
}

export function sendWaitlistConfirmation(to: string) {
  return sendEmail({
    to,
    subject: "You're on the Legal Owl waitlist",
    html: `
      <p>Thanks for your interest in <strong>Legal Owl</strong> — the AI-native legal office for solo lawyers.</p>
      <p>You're on the waitlist. We'll email you the moment your access is ready.</p>
      <p>— Legal Owl</p>
    `,
  });
}
