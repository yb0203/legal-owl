# Auth & waitlist onboarding — UX benchmark

Surface: Login, waitlist signup, the gated `has_access` experience, and the first-run / empty-account onboarding. Benchmarked against best-in-class web flows on Mobbin. The off-dark mint/lemon dark theme is treated as a fixed constraint — we benchmark execution, not the choice of dark.

---

## Current state (Legal Owl)

The surface spans four files plus a shared shell:

- **Landing + primary waitlist capture** — `app/page.tsx`. A genuinely strong type-led marketing page: mono eyebrow ("For solo lawyers · India"), serif hero with lemon underline, an inline email-only waitlist form in the hero (`page.tsx:71-83`), a `CaseRecordCard` product mock (`page.tsx:167-201`), a numbered "How it works" roadmap, a tracks grid, and a final CTA. This is the best-executed screen in the set.
- **Login** — `app/login/page.tsx`. `AuthShell`-wrapped card: "Welcome back" serif heading, invite-only subcopy linking to the waitlist, an email + password form, an inline error slot (`login/page.tsx:36`), and two stacked buttons: `Sign in` (primary) and `Create account` (outline). Both submit the same form via `formAction` (`login/page.tsx:39-44`).
- **Login actions** — `app/login/actions.ts`. `login` does `signInWithPassword` → `/home`. `signup` does `signUp`, records the email on the waitlist via `join_waitlist` RPC, signs the user in immediately (email auto-confirmed by a DB trigger), and redirects to `/home` (`actions.ts:19-31`). Note: a user who "creates an account" lands on `/home`, but the app-layout gate immediately bounces them to `/waitlist` because `has_access` is false — they never see `/home`.
- **Waitlist / gated state** — `app/waitlist/page.tsx`. A single `Status` card (title + body + one action) covering three states: not-signed-in + just joined (`?joined=1`), signed-in-but-pending, and signed-in-and-approved (offers "Open Legal Owl"). Pending users get "Your account (email) is pending access. We'll email you the moment it's granted." with a Sign out button.
- **Waitlist action** — `app/waitlist/actions.ts`. `joinWaitlist` validates email, calls `join_waitlist` RPC, fires a best-effort Resend confirmation email (`actions.ts:20`), redirects to `/waitlist?joined=1`.
- **App gate** — `app/(app)/layout.tsx:14-19`. `getUser()` → redirect `/login` if no user; `getWaitlistAccess()` → redirect `/waitlist` if not approved.
- **First-run empty account** — `app/(app)/home/page.tsx:177-198`. When `matterCount === 0`, renders an `Onboarding` component: "Welcome to Legal Owl", one paragraph, and two buttons — "Load sample data" (primary, seeds demo data) and "Add your first matter" (outline). One line: "You can toggle sample data any time in Settings."
- **Shared chrome** — `components/auth-shell.tsx`. Centered `max-w-sm` card on the off-dark canvas with a soft mint radial glow, the owl wordmark above, and a trust line below: "Built for India · Your case data stays in India."

### Strengths

- **Coherent brand and craft.** Serif headings (Source Serif 4), mono for case numbers, the owl mark, the mint glow, and the "data stays in India" trust line read as a real, opinionated product — not a template. The landing page in particular is excellent.
- **Right-sized auth.** Email + password with auto-confirm avoids an email round-trip; sensible for an invite-gated beta.
- **The waitlist `Status` component is clean** and correctly handles the approved-but-on-/waitlist case by offering a way into the app.
- **First-run "Load sample data"** is a smart, low-friction way to let a lawyer evaluate the product before doing data entry.
- **Trust framing is on-brand** for the audience (Indian lawyers care about data residency).

### Concrete weaknesses

1. **Login lacks password recovery.** There is no "Forgot password?" link anywhere (`login/page.tsx`). Every best-in-class flow (Clerk, OpenAI, Zapier, Behance, Expedia) has it. For a paid tool a lawyer logs into infrequently, this is a guaranteed support burden / lockout.
2. **"Create account" is a trap on an invite-only product.** The button sits equal-weight under Sign in (`login/page.tsx:42-44`), but creating an account immediately dumps the user at `/waitlist` (the gate bounces them). The user took a "sign up" action and got a "you're on a waitlist" wall with no explanation of the bait-and-switch. This is the single most confusing moment in the surface.
3. **No "you're on the list" richness.** The waitlist confirmation is a flat sentence. Best-in-class (Contra, Coinbase, Amie) show a *position number*, a *referral-to-move-up* mechanism, and a clear sense of "what happens next." Legal Owl captures the email and says, essentially, "ok."
4. **No name / context captured at waitlist time.** `joinWaitlist` accepts an optional `full_name` (`waitlist/actions.ts:11-16`) but the landing form only sends `email` (`page.tsx:72-78`). Amie captures first name + a couple of qualifying questions, which both personalizes later comms and segments the funnel. For a legal product, even one question ("How many active matters do you have?" / "District court, High Court, or both?") would be gold for prioritizing invites.
5. **First-run onboarding is a dead-end two-button screen.** `Onboarding` (`home/page.tsx:177-198`) is a single moment, not a *journey*. There's no persistent "getting started" checklist, no sense of progress, no second/third step (add a client, run a conflict check, connect court monitoring, invite-a-client). Once a lawyer adds one matter the welcome vanishes with no continued guidance. Best-in-class (Adaline, Better Stack, Productboard, Apollo, Circle, Gorgias) all keep a progress-tracked checklist alive until the user is genuinely activated.
6. **Login error handling is coarse.** Errors come back as raw Supabase messages via a query param (`actions.ts:14`, rendered at `login/page.tsx:36`). No field-level errors, no distinction between "wrong password" and "no such account," no inline validation. OpenAI shows the error inline under the field with a red ring; Legal Owl shows a single line above the buttons.
7. **No password visibility toggle, no caps-lock / strength hints.** Standard affordances (eye icon — Clerk, OpenAI, Behance, Expedia) are absent.
8. **No social / SSO and no "magic link / OTP" option.** Not necessarily needed for beta, but every comparator offers at least Google, and several offer email-OTP as a password alternative. Worth noting as a gap, lower priority.
9. **Pending-waitlist screen offers no momentum.** A signed-in pending user can only "Sign out." No referral link, no position, no "update your details," no expectation-setting on timeline. It's a wall.
10. **No "Remember me / keep signed in"** affordance (Behance, Expedia both have it with shared-device guidance). Minor, but lawyers often work on shared chambers machines — a conscious "this is a personal device" toggle is on-brand for the trust positioning.

---

## Inspiration gallery

### Pattern A — Email-first / progressive auth with recovery

**Clerk** — [flow](https://mobbin.com/flows/106ca9be-209f-43e7-bc40-966464f7f09d)
- Two-step "Sign in to Clerk" → "Enter your password": the email screen is uncluttered (social buttons + single email field + Continue), and the password screen *shows the entered email with an inline edit pencil* so you never lose context.
- "Forgot password?" sits right next to the password label, and "Use another method" gives an escape hatch (OTP, etc.). Recovery is never more than one click away.
- A persistent "Secured by Clerk" footer with Support / Privacy / Terms builds trust on a security-sensitive screen — directly analogous to Legal Owl's "data stays in India" line.

**OpenAI Platform** — [flow](https://mobbin.com/flows/f71e1240-7085-49ec-8c3c-3181381039a3)
- "Welcome back" email-first screen, then a password screen that *echoes the email with an Edit link* and offers "Log in with a one-time code" as a password alternative.
- The error state is the gold standard: a red ring around the offending field plus inline "Incorrect email address or password" *under the field* — far better than Legal Owl's single line above the buttons.
- Social/alternate methods (Google, Apple, Microsoft, phone) are visually subordinate to the primary email path, so the page never feels like a wall of buttons.

**Behance** / **Expedia** — [Behance flow](https://mobbin.com/flows/26ff166f-2f45-4423-87ab-f08798c9ea6c) · [Expedia flow](https://mobbin.com/flows/61cba8c4-db06-4483-8df8-597a22ad3d0c)
- Both put a **password-visibility eye toggle** in the field and a **"Stay signed in" / "Keep me signed in"** checkbox — Expedia even adds the shared-device caution copy ("This is for personal devices only…"). Exactly the kind of trust nuance that fits Legal Owl's audience.
- Both echo the account email above the password field with a "Not you? / Sign in to a different account" escape.

### Pattern B — Waitlist with momentum (position + referral + clear next step)

**Contra** — [community waitlist flow](https://mobbin.com/flows/30589d0d-623a-4bc9-84e9-5abd204eb7cc) · [Pro waitlist flow](https://mobbin.com/flows/e6242ea3-d62d-4d71-853a-984958a1428c)
- The pre-join card shows a **live count of people already on the waitlist** ("56,460 people on the waitlist") with a big "Join the waitlist" button — instant social proof.
- The post-join state is the standout: **"Thank you for joining, Sam! You are 777th on the waitlist,"** plus a **"Move up the waitlist by referring your friends"** block with a copyable referral link and email/LinkedIn/X share buttons. It turns a dead-end into a growth loop and gives the user something to *do*.
- A toast ("You are now on the waitlist…") confirms the action without a full page reload — lighter than Legal Owl's full redirect to `/waitlist?joined=1`.

**Coinbase** — [waitlist flow](https://mobbin.com/flows/ba9eef6b-051b-4932-ae81-8169bf1a47d6)
- Minimalist, confident: a product hero ("Crypto Futures … coming soon. Sign up to join the waitlist and get early access."), a single email field + "Get access," and on submit the same screen simply swaps the button row for an inline green **"Success"** confirmation — no jarring navigation, the context (the product visual) stays put. A clean model for an inline success state on Legal Owl's landing hero.

**Amie** — [request access flow](https://mobbin.com/flows/6a8841de-f692-4bdc-8476-5e5e7f6e9081)
- Captures **email + first name** ("we also love nicknames!") with friendly, human microcopy and inline validation ("Please enter a valid email").
- Then asks **2-3 qualifying questions** ("how many of your calendar events are todos?", "which emails would you like to connect?") as tappable chips — segmenting the funnel and personalizing later comms while feeling effortless.
- The terminal state is warm and on-brand: **"thanks so much for answering our questions, we hope to give you access to Amie soon"** with the product visual and a "back to amie.so" link. This is exactly the tone Legal Owl's pending state is missing.

### Pattern C — First-run onboarding as a tracked checklist (not a one-shot screen)

**Adaline** — [onboarding checklist flow](https://mobbin.com/flows/845e623e-f833-4ae7-b8e6-149c669c7df4)
- A dedicated "Get Started" page headed **"You're on your way, Alex — 0 of 2 completed"** with a circular progress ring. Tasks are grouped into "quests" (Iterate / Evaluate), each expandable to reveal sub-steps with status pills (In progress / Not started / Completed). A pinned sidebar widget ("Complete the remaining steps… Get started →") keeps it reachable from everywhere. Completion visibly advances the ring to 2/2.

**Better Stack** — [onboarding tasks flow](https://mobbin.com/flows/e53480d9-868f-478d-9437-1df535cddaf3)
- A **"Get the most out of Better Stack" card embedded directly in the Home dashboard** with a **3/8 progress bar**. A left rail lists steps (Create monitor → Invite colleagues → Connect Slack → Create status page…) with green checks as they complete; the right panel previews/explains the *selected* step with its own CTA. The greeting even rotates by time of day ("How are you today, Jane?" → "Have a great day, Jane!"). The checklist lives *alongside* real data, not instead of it — so it doesn't block a user who already has content.

**Productboard** — [getting started flow](https://mobbin.com/flows/1eab4787-93d1-46dc-9403-b51bd3fd3528)
- **"Welcome Alex 👋 / Quick start — X/5 Completed"** with completed steps rendered as **struck-through text with a filled blue check** — a satisfying, legible sense of progress. Below the checklist: an "Integrate with your favorite tools" row and an "Invite member" affordance, so activation and team setup are one continuous surface.

**Apollo** — [home onboarding flow](https://mobbin.com/flows/24008106-068d-4871-b191-6b273c32a304)
- **"Welcome, Alex 👋 / Next steps for you — Follow the steps below to tailor Apollo to your workflow."** Each step is a labeled row (OUTBOUND / INBOUND / ENRICHMENT / ESSENTIALS) with a description and a bright per-step **"Start"** button (lemon-yellow — visually close to Legal Owl's lemon accent); completed steps show a muted "Completed." A "Setup (3)" vs "Recommendations" tab split separates must-dos from nice-to-haves. A pinned "Onboarding hub · 8% Completed" widget persists.

**Circle** — [getting started flow](https://mobbin.com/flows/333003ee-4d19-4455-bfc7-04bfecbbf192)
- A two-pane "Setup checklist": left = ordered step list (Basics → Set up your spaces → Invite your first members → Kickstart engagement), right = the active step expanded with copy + a "Continue" button, plus a "Let's take a look inside" product-tour video card. Clear, calm, and dismissible (the × on the nav item).

**Gorgias** — [home flow](https://mobbin.com/flows/c4ecf68c-d283-42ca-9a57-2df55fd53196)
- The simplest version: a **numbered two-step "Welcome 👋 / Follow the steps below to get started"** with time-estimate microcopy ("Connect your support email (1 min)") and per-row CTAs; on completion each row collapses to a single green-checked "…connected" line. A great low-effort template if a full checklist is too much for v1.

**Airbnb (host early access)** — [early access flow](https://mobbin.com/flows/489158dd-ad52-42c5-ae8b-714fdb27293c)
- "Welcome, [name]! … here's how to prepare" with a **"Your next steps"** row of icon cards (Turn on Instant Book / Set up your calendar / Add house rules…) and a persistent **"Confirm a few key details — Required to publish"** alert banner. Also a strong illustrated empty state ("You don't have any reservations") with a book illustration — a model for making Legal Owl's empty home feel intentional rather than blank.

---

## Gaps vs. best-in-class

| Gap | Legal Owl today | Best-in-class | Refs |
|---|---|---|---|
| Password recovery | None | "Forgot password?" by the field + alt methods | Clerk, OpenAI, Zapier |
| Waitlist momentum | Flat "you're on the list" | Position number + referral link + share | Contra, Coinbase |
| Funnel segmentation | Email only | Name + 2-3 qualifying questions | Amie |
| First-run onboarding | One-shot 2-button screen, then gone | Persistent progress-tracked checklist | Adaline, Better Stack, Productboard, Apollo, Circle |
| Error UX | Single line above buttons, raw msg | Inline field error + red ring, specific copy | OpenAI |
| Password field affordances | None | Eye toggle, keep-signed-in, shared-device note | Behance, Expedia, Clerk |
| "Create account" clarity | Equal-weight button that bounces to waitlist | Honest "Request access / Join waitlist" framing | (own anti-pattern) |
| Pending-state momentum | "Sign out" only | Referral, position, edit details, timeline | Contra, Amie |
| Empty home polish | Plain centered text | Illustrated, intentional empty state | Airbnb |

---

## Recommendations

Prioritized. Each notes what to build, why it matters for a busy solo lawyer, impact, effort, and the inspiration it draws from.

1. **Add "Forgot password?" recovery to login.** Add a link beside the password label → a reset-request screen (Supabase `resetPasswordForEmail`) → a reset-confirm screen. Lawyers log in infrequently and *will* forget; without this, every lockout is a manual support ticket. **Impact: high · Effort: M.** Draws from Clerk / OpenAI.

2. **Stop the "Create account" bait-and-switch on login; reframe as a single honest action.** Remove the equal-weight "Create account" button (`login/page.tsx:42-44`). Since the product is invite-only, login should be *only* sign-in. Replace the second button with a clear text link: "No account yet? Request access →" pointing to the landing/waitlist capture. If you keep self-signup, change the success copy/redirect so the user is told plainly "Account created — you're on the waitlist; we'll email you," not silently bounced. **Impact: high · Effort: S.** (Fixes own anti-pattern.)

3. **Turn the first-run screen into a persistent, progress-tracked "Get started" checklist.** Replace the one-shot `Onboarding` component (`home/page.tsx:177-198`) with a dismissible card that lives on Home and survives past the first matter, e.g.:
   - "Welcome to Legal Owl, [name] — 1 of 4 done" with a progress ring/bar.
   - Steps: **Add your first matter** (or paste a CNR) → **Add a client & run a conflict check** → **Review your first court update in the Inbox** → **Send your first client update** (or invite a client). Each row gets a description, a status pill, and a per-step CTA; completed steps strike through with a check.
   - Keep "Load sample data" as a secondary, reversible option inside the card.
   - Drive completion off real data the app already queries (matter count, client count, triage count). **Impact: high · Effort: L.** Draws from Adaline (progress ring + quests), Better Stack (dashboard-embedded checklist), Productboard (strike-through completed), Apollo (per-step Start buttons in the lemon accent).

4. **Make the waitlist confirmation a momentum moment, not a dead end.** On `/waitlist?joined=1` and for signed-in pending users, show (a) a **referral link** with copy-link + share buttons, (b) optionally a **position/"you're #N"** if you expose a count, and (c) a clear **"what happens next"** line with a realistic timeframe. Reuse the same warm tone Amie uses. **Impact: high · Effort: M** (referral) / **S** (just copy + next-steps). Draws from Contra, Amie.

5. **Capture name + one qualifying question at waitlist time.** Extend the landing hero form (`page.tsx:71-83`) to also send `full_name` (already supported by `joinWaitlist`) and add one segmenting question via chips — e.g. "Where do you practice?" (District court / High Court / Both / Tribunals) or "Roughly how many active matters?". Personalizes later emails and lets you prioritize invites to your ICP. Keep it to one extra field + one chip row so it stays a 10-second action. **Impact: med · Effort: M.** Draws from Amie.

6. **Upgrade login error UX to inline, specific, field-level.** Render errors under the relevant field with a red ring (mirror OpenAI), map common Supabase errors to human copy ("That email and password don't match"), and add basic client-side validation. **Impact: med · Effort: M.** Draws from OpenAI.

7. **Add password-field affordances:** an eye/visibility toggle and a "Keep me signed in" checkbox with a short shared-device note ("Avoid on shared chambers machines"). The note reinforces the security/trust positioning. **Impact: med · Effort: S.** Draws from Behance / Expedia / Clerk.

8. **Polish the empty/loading states with intentional visuals.** Give the empty Home (and the pending-waitlist card) a small illustration or the owl mark plus a one-line "what you'll see here," so a blank account reads as designed, not broken. **Impact: low · Effort: S.** Draws from Airbnb.

---

## Quick wins

1. **Add a "Forgot password?" link** beside the password field — even before the full reset flow ships, wire it to `resetPasswordForEmail`. (Rec 1)
2. **Demote "Create account" to a text link** ("No account yet? Request access →") and stop silently bouncing self-signups; one honest line of copy fixes the most confusing moment. (Rec 2)
3. **Add a password-visibility eye toggle** to the login password input — a few lines in the shared `Input` usage. (Rec 7)
4. **Rewrite the pending-waitlist copy** to set expectations and add a referral/share link or at least a "what happens next" line, instead of only "Sign out." (Rec 4)
5. **Send `full_name` from the landing form** (the backend already accepts it) and add a placeholder name field — zero backend work, immediately improves later email personalization. (Rec 5)
