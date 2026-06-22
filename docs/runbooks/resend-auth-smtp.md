# Runbook: Resend SMTP for Supabase auth emails

Routes Supabase Auth's transactional emails (password recovery, signup confirmation, magic link,
email-change) through **Resend** via custom SMTP. This is **dashboard + DNS only — no app code.**

Auth emails are sent by Supabase, not by `apps/web/lib/email.ts` (that file only sends app mail like
the waitlist confirmation). Verifying a Resend domain here also unblocks that app mail (see step 5).

Project: `xdejlfhmoinljppivchw` (Supabase, Mumbai `ap-south-1`).

---

## 1. Verify a sending domain in Resend (prerequisite — required)

The current sender `onboarding@resend.dev` only delivers to the Resend account owner, so real users
never get their reset email. You must verify a domain.

1. Resend → **Domains → Add Domain** → enter a domain you control (e.g. `legalowl.in`, or a
   subdomain like `mail.legalowl.in`).
2. Resend shows DNS records — add them at your DNS provider:
   - **MX** + **TXT (SPF)** on the `send` subdomain,
   - **TXT (DKIM)** record,
   - (recommended) a **DMARC** TXT record at `_dmarc`.
3. Wait for Resend to show the domain **Verified**.
4. Decide a sender address on that domain, e.g. `no-reply@legalowl.in` (display name "Legal Owl").

---

## 2. Get the SMTP credential

Resend's SMTP password **is a Resend API key**.

- Reuse the existing `RESEND_API_KEY`, or (cleaner) Resend → **API Keys → Create** a key named
  `supabase-smtp` with send permission. Keep it handy for step 3.

SMTP connection values:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) — or `587` (STARTTLS) |
| Username | `resend` |
| Password | your Resend API key |
| Sender email | the verified address from step 1 (e.g. `no-reply@legalowl.in`) |
| Sender name | `Legal Owl` |

---

## 3. Configure custom SMTP in Supabase

Supabase Dashboard → **Project Settings → Authentication → SMTP Settings** (a.k.a.
Authentication → Emails):

1. Toggle **Enable Custom SMTP** on.
2. Enter the host/port/username/password/sender from step 2.
3. Save. Optionally raise the **email rate limits** (Authentication → Rate Limits) — the built-in
   sender is throttled hard; custom SMTP lets you lift it.

From now on every Supabase auth email is sent by Resend from your domain.

---

## 4. URL configuration + templates

### 4a. URL configuration (also fixes the password-reset redirect — "Blocker 2")
Authentication → **URL Configuration**:
- **Site URL** → your app origin (`http://localhost:3000` for local; the Vercel URL for prod).
- **Redirect URLs** → add `http://localhost:3000/auth/callback` and
  `https://<your-domain>/auth/callback`.

Optionally set **`NEXT_PUBLIC_SITE_URL`** in `apps/web/.env.local` (and Vercel) — the
`requestPasswordReset` action prefers it over request headers when building the reset link origin.

### 4b. Brand the templates
Authentication → **Email Templates**. Each uses Supabase variables — the important one is
`{{ .ConfirmationURL }}`, which already carries our `resetPasswordForEmail` `redirectTo`
(`/auth/callback?next=/login/update`), so the link lands in our flow. Paste the HTML from the
appendix below into **Reset Password**, **Confirm signup**, and **Magic Link**.

---

## 5. Switch app mail off the test sender (small code change — optional, do once domain is verified)

`apps/web/lib/email.ts` still uses `FROM = "Legal Owl <onboarding@resend.dev>"`. Once the domain is
verified, change it to your verified address (e.g. `Legal Owl <no-reply@legalowl.in>`) so the waitlist
confirmation (and future client-update emails) actually deliver. This is the only code touch and is
independent of the SMTP setup above.

---

## 6. Verify it works
1. App → sign-in → **Forgot password?** → enter a real inbox you control.
2. Confirm the email arrives **from your Resend domain** (not `@resend.dev`, not Supabase's sender).
3. Click the link → it hits `/auth/callback` → exchanges the code → lands on `/login/update` → set a
   new password → Home.
4. Check the Resend dashboard **Emails** log shows the send.

If the email doesn't arrive: re-check domain Verified status, the sender matches the verified domain,
and the redirect URL is allow-listed.

---

## Appendix — branded template HTML

Email-safe inline styles, light background (auth mail should read in any client). Mint accent matches
the app. Supabase substitutes `{{ .ConfirmationURL }}` at send time.

### Reset Password
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1c1c">
  <h1 style="font-size:20px;margin:0 0 12px">Reset your Legal Owl password</h1>
  <p style="font-size:14px;line-height:1.6;color:#444">
    We received a request to reset your password. Click below to choose a new one. This link expires
    shortly and can be used once.
  </p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}"
       style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">
      Set a new password
    </a>
  </p>
  <p style="font-size:12px;line-height:1.6;color:#888">
    If you didn't request this, you can safely ignore this email — your password won't change.
  </p>
  <p style="font-size:12px;color:#888;margin-top:24px">— Legal Owl · your data stays in India</p>
</div>
```

### Confirm signup
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1c1c">
  <h1 style="font-size:20px;margin:0 0 12px">Confirm your email</h1>
  <p style="font-size:14px;line-height:1.6;color:#444">
    Welcome to <strong>Legal Owl</strong>. Confirm your email to finish setting up your account.
  </p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}"
       style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">
      Confirm email
    </a>
  </p>
  <p style="font-size:12px;color:#888;margin-top:24px">— Legal Owl</p>
</div>
```

### Magic Link
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1c1c">
  <h1 style="font-size:20px;margin:0 0 12px">Your Legal Owl sign-in link</h1>
  <p style="font-size:14px;line-height:1.6;color:#444">Click below to sign in. This link expires shortly and can be used once.</p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}"
       style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">
      Sign in to Legal Owl
    </a>
  </p>
  <p style="font-size:12px;line-height:1.6;color:#888">If you didn't request this, you can ignore it.</p>
  <p style="font-size:12px;color:#888;margin-top:24px">— Legal Owl</p>
</div>
```
