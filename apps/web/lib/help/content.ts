// In-app Help content, authored as Markdown (GitHub-flavored) per section. The
// /help page renders each `body` through <Markdown>, which also draws ```mermaid
// fenced blocks. The anchor registry below is the single source of truth for the
// command palette and the per-surface "?" deep-links — a bad anchor is a type
// error, so anchors can't drift.

export const HELP_ANCHORS = [
  "getting-started",
  "add-a-matter",
  "triage",
  "tasks",
  "hearings-deadlines",
  "documents",
  "clients",
  "calendar",
  "settings",
  "glossary",
  "faq",
] as const;

export type HelpAnchor = (typeof HELP_ANCHORS)[number];

export type HelpGroup = "Start" | "Workflows" | "Reference";

export interface HelpSection {
  id: HelpAnchor;
  title: string;
  group: HelpGroup;
  body: string;
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    group: "Start",
    body: `
Legal Owl keeps your litigation practice in one place — it tracks your cases, turns every court update into something you can act on, and helps you keep clients informed, grounded in your real case data.

Everything hangs off one hierarchy: a **Client** is who you act for, an **Engagement** is a body of work for them, a **Matter** is a single case file, and an **Action** is a task on that matter.

\`\`\`mermaid
flowchart LR
  Client["Client"] --> Engagement["Engagement"] --> Matter["Matter"] --> Action["Action (task)"]
\`\`\`

Then a court update flows into work you can see and act on:

\`\`\`mermaid
flowchart LR
  Court["Court update (eCourts)"] --> Event["Court event"] --> Inbox["Inbox"]
  Inbox -->|accept as task| Task["Task"]
  Matter["Matter"] --> Hearing["Hearing"]
  Matter --> Deadline["Deadline"]
  Hearing --> Agenda["Calendar + Home"]
  Deadline --> Agenda
  Task --> Agenda
  Event -.-> Matter
\`\`\`

**To get going:**

1. Add a client, or jump straight to a matter (a matter can create its client inline).
2. Open the matter to see its timeline, hearings, deadlines, tasks, and documents.
3. Check **Home** and the **Inbox** each morning — overdue and due-today work is surfaced first.

> Tip: use the **Search** box in the header to jump to a page or matter, or to create something new.
`,
  },

  {
    id: "add-a-matter",
    title: "Add & manage a matter",
    group: "Workflows",
    body: `
A **matter** is a single case file: an internal id (e.g. \`M-3\`), an optional **CNR** (the court's case number), a forum, parties, a status, and a next-hearing date.

1. From **Matters** (or the "New" menu / Search), choose **New matter**.
2. Fill in the title, forum, and parties — optionally the CNR and client.
3. Open the matter to add hearings, deadlines, tasks, documents, and notes.

The id / CNR chips by the title copy the case number; edit anything from **Edit details**. On the Matters list, filter by status (each tab carries a count) and search by title, id, or CNR.
`,
  },

  {
    id: "triage",
    title: "Triage the Inbox",
    group: "Workflows",
    body: `
The **Inbox** is where updates about your matters wait for a decision — each names what happened (a new order, a changed hearing date, a status change) and which matter it belongs to.

| Action | What it does |
| --- | --- |
| **Accept as task** | Turns the update into a to-do on its matter (you set priority + due date). |
| **Snooze** | Hides it until you need it — day before the next hearing, tomorrow, next week, or a date you pick. |
| **Dismiss** | Clears it when no action is needed. |
| **Undo** | A toast after snooze/dismiss brings the item back. |

The sidebar shows a count of items still waiting, so your triage load is always visible.
`,
  },

  {
    id: "tasks",
    title: "Work with tasks",
    group: "Workflows",
    body: `
**Tasks** (Actions) are the things you need to do, each attached to a matter. The Tasks page gathers them across every matter.

- **Quick-create** at the top — type a title, pick the matter, set priority and due date.
- The **Open** view groups by time horizon — **Overdue → Today → This week → Later** — so the most urgent work is first.
- Set status (To-Do, Awaiting Filing, Done, …) and priority from the badges on each row; tick the circle to complete.
- Filter chips (Open / Overdue / Done / All) carry counts.

You can also manage tasks inside a matter, on its **Tasks** tab.
`,
  },

  {
    id: "hearings-deadlines",
    title: "Hearings & deadlines",
    group: "Workflows",
    body: `
**Hearings** are scheduled court dates; **deadlines** are dates you must meet (limitation, statutory, or internal). Both live on the matter and feed the Calendar and Home agenda.

- On a matter's **Hearings** tab, add a date and purpose; record the outcome (held / adjourned) afterwards.
- The matter's **next-hearing date** is computed automatically from the earliest upcoming scheduled hearing.
- On the **Deadlines** tab, add a deadline with its type and basis — deadlines are rule-based dates, never guessed.

Overdue and today's dates are coloured loudest everywhere, so they're impossible to miss.
`,
  },

  {
    id: "documents",
    title: "Documents",
    group: "Workflows",
    body: `
Each matter keeps its files together — court orders, judgements, and your own filings — stored privately and scoped to you.

- On a matter's **Documents** tab, upload a file and tag its type (filing/upload, court order, judgement).
- Click a name to download via a short-lived secure link.
- Deleting asks for confirmation; uploads and deletions are recorded on the matter's timeline.
`,
  },

  {
    id: "clients",
    title: "Clients & conflict check",
    group: "Workflows",
    body: `
**Clients** are the people and organisations you act for. A client page shows their matters, engagements, contacts, and details (address, GSTIN, PAN).

- Add one from **Clients → New client** — individual or organisation, with contact details.
- On intake, Legal Owl runs a **conflict check** against the parties in your existing matters.
- No match → "No conflicts found"; a possible conflict raises a banner to review and acknowledge (advisory — it never blocks intake).
- Search by name, email, or phone; the header shows your total client count.
`,
  },

  {
    id: "calendar",
    title: "Calendar & overdue",
    group: "Workflows",
    body: `
The **Calendar** is one agenda of every upcoming hearing and deadline across your matters, grouped by day.

- Anything **overdue** — a missed hearing or a passed deadline — is pinned to the top in red so it never slips.
- Upcoming items follow, grouped by date with how soon each is due.
- Click any item to jump to its matter.
`,
  },

  {
    id: "settings",
    title: "Settings",
    group: "Workflows",
    body: `
**Settings** is where you manage your profile and account.

- Edit your name, firm, phone, and bar enrolment — your name and firm appear on client update emails.
- Load or clear **sample data** any time to explore the app.
- Your case data, documents, and identity are stored in India (Mumbai, \`ap-south-1\`) and never leave the country.
`,
  },

  {
    id: "glossary",
    title: "How it all connects",
    group: "Reference",
    body: `
The objects Legal Owl works with, and how they fit together. A **Matter** is the hub: hearings, deadlines, documents, the timeline, and inbox updates all hang off it, while Clients and Engagements sit above it and Labels tag across.

\`\`\`mermaid
flowchart TD
  Client["Client"] --> Engagement["Engagement"]
  Engagement --> Matter["Matter"]
  Matter --> Action["Action (task)"]
  Client --> Contact["Contact"]
  Matter --> Hearing["Hearing"]
  Matter --> Deadline["Deadline"]
  Matter --> Document["Document"]
  Matter --> Timeline["Court events + remarks"]
  Matter --> Triage["Inbox (triage)"]
  Triage -->|accept| Action
  Action --> State["Workflow state"]
  Label["Label"] -.-> Matter
  Label -.-> Action
\`\`\`

| Entity | What it is |
| --- | --- |
| **Client** | A person or organisation you act for — top of the hierarchy. Has engagements, contacts, and conflict flags. |
| **Engagement** | A body of work for a client (a retainer or brief). Every client gets a default "General" engagement. |
| **Matter** | A single case file — the hub that owns hearings, deadlines, tasks, documents, and the timeline. Linked to a client + engagement. |
| **Action (Task)** | Something to do on a matter. Carries a status (workflow state), priority, due date, and source. |
| **Hearing** | A court date on a matter; the earliest scheduled one sets the next-hearing date. |
| **Deadline** | A date you must meet (limitation / statutory / internal), rule-computed — never guessed. |
| **Document** | A file kept with a matter (court order, judgement, your upload), stored privately. |
| **Court event & Timeline** | An append-only record of what happened on a matter; merged with your **remarks** into one immutable timeline. |
| **Triage item (Inbox)** | An incoming update awaiting your decision; can come from a court event and becomes a task when accepted. |
| **Workflow state** | The named status a task is in (To-Do, Awaiting Filing, Done, …); its *type* drives grouping. |
| **Label** | A coloured tag you create and apply to matters and tasks. |
| **Conflict flag** | An advisory note raised at intake when a new client matches a party in an existing matter. |

Your data is **isolated to you** — only you can see your clients and matters (per-lawyer access throughout).
`,
  },

  {
    id: "faq",
    title: "FAQ",
    group: "Reference",
    body: `
**Why is access invite-only?** Legal Owl is in early access — requesting an account adds you to the waitlist, and you're emailed when it's approved.

**Where does my data live?** All case data, documents, and identity are stored in India (Mumbai, \`ap-south-1\`) and never leave the country.

**Why does a task need a matter?** Every task is part of a case file, so it always carries the context of which matter it advances.

**How do I reset my password?** On the sign-in page, use "Forgot password?" — we'll email a link to set a new one.
`,
  },
];
