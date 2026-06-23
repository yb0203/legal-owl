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

// Passwordless sign-in: a one-tap magic link AND a 6-digit code as a fallback
// (the code path survives email-scanner prefetch and works across devices).
export function sendSignInEmail({ to, link, code }: { to: string; link: string; code: string }) {
  const mid = Math.ceil(code.length / 2);
  const spaced = `${code.slice(0, mid)} ${code.slice(mid)}`;
  return sendEmail({
    to,
    subject: `Sign in to Legal Owl — code ${spaced}`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:440px;margin:0 auto;color:#1a1a1a">
        <h2 style="font-size:18px">Sign in to Legal Owl</h2>
        <p>Tap the button to sign in:</p>
        <p>
          <a href="${link}" style="display:inline-block;background:#0f9d6b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Sign in to Legal Owl</a>
        </p>
        <p style="color:#555">Or enter this code in the app:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;font-family:ui-monospace,Menlo,monospace">${spaced}</p>
        <p style="color:#777;font-size:13px">This link and code expire shortly and can be used once. If you didn't request this, you can ignore this email.</p>
        <p style="color:#777;font-size:13px">— Legal Owl</p>
      </div>
    `,
  });
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
