// In-app Help content, authored as structured data so the /help page TOC, the
// command palette, and the per-surface "?" deep-links all reference one anchor
// registry (anchors can't drift — a bad anchor is a type error).
//
// Glossary field names are user-facing prose; keep them in sync with the schema
// in lib/types.ts when entities change.

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

export interface GlossaryEntry {
  term: string;
  whatItIs: string;
  properties: { label: string; meaning: string }[];
  relatesTo: string[];
}

export type HelpBlock =
  | { kind: "prose"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "glossary"; entries: GlossaryEntry[] };

export interface HelpSection {
  id: HelpAnchor;
  title: string;
  group: HelpGroup;
  blocks: HelpBlock[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    group: "Start",
    blocks: [
      {
        kind: "prose",
        text: "Legal Owl keeps your litigation practice in one place: it tracks your cases, turns every court update into something you can act on, and helps you keep clients informed — grounded in your real case data, not guesswork.",
      },
      {
        kind: "prose",
        text: "The core idea is a simple hierarchy: a Client is who you act for; an Engagement is a body of work for that client (every client gets a default “General” engagement); a Matter is a single case file; and an Action is a task on that matter. Hearings, deadlines, documents, and the court timeline all live on the Matter.",
      },
      {
        kind: "steps",
        items: [
          "Add your first client, or jump straight to adding a matter (a matter can create its client inline).",
          "Open the matter to see its timeline, hearings, deadlines, tasks, and documents.",
          "Watch the Home page and Inbox each morning — overdue and due-today work is surfaced first.",
        ],
      },
      {
        kind: "prose",
        text: "Tip: press ⌘K (Ctrl+K) anywhere to jump to a page or matter, or to create something new.",
      },
    ],
  },

  {
    id: "add-a-matter",
    title: "Add & manage a matter",
    group: "Workflows",
    blocks: [
      {
        kind: "prose",
        text: "A matter is a single case file. It has an internal id (e.g. M-3), an optional CNR (the court’s case number), a forum (District Court, High Court, NCLT, arbitration, …), parties, a status, and a next-hearing date.",
      },
      {
        kind: "steps",
        items: [
          "From Matters (or the “New” menu / ⌘K), choose New matter.",
          "Fill in the title, forum, parties, and optionally the CNR and client.",
          "Open the matter to add hearings, deadlines, tasks, documents, and notes.",
          "Use the matter id / CNR chips near the title to copy the case number; edit details any time from “Edit details”.",
        ],
      },
      {
        kind: "prose",
        text: "On the Matters list, filter by status (Active / On hold / Disposed / Archived) — each tab shows a count — and search by title, internal id, or CNR.",
      },
    ],
  },

  {
    id: "triage",
    title: "Triage the Inbox",
    group: "Workflows",
    blocks: [
      {
        kind: "prose",
        text: "The Inbox is where incoming updates about your matters wait for a decision. Each item names what happened (a new order, a changed hearing date, a status change) and the matter it belongs to.",
      },
      {
        kind: "steps",
        items: [
          "Accept as task — turns the update into a to-do on its matter; you set a priority and due date.",
          "Snooze — hide it until you need it: until the day before the next hearing, Tomorrow, Next week, or a date you pick.",
          "Dismiss — clear it from the list when no action is needed.",
          "Undo — a toast appears after snooze or dismiss; click Undo to bring the item back.",
        ],
      },
      {
        kind: "prose",
        text: "The sidebar shows a count of items still waiting, so you always know your triage load at a glance.",
      },
    ],
  },

  {
    id: "tasks",
    title: "Work with tasks",
    group: "Workflows",
    blocks: [
      {
        kind: "prose",
        text: "Tasks (Actions) are the things you need to do, each attached to a matter. The Tasks page gathers them across all your matters.",
      },
      {
        kind: "steps",
        items: [
          "Quick-create a task at the top of the Tasks page — type a title, pick the matter, set priority and due date.",
          "The Open view groups tasks by time horizon: Overdue, Today, This week, Later — so the most urgent work is first.",
          "Set status (To-Do, Awaiting Filing, Filed, Done, …) and priority from the badges on each row.",
          "Tick the circle to complete a task; filter chips (Open / Overdue / Done / All) carry counts.",
        ],
      },
      {
        kind: "prose",
        text: "You can also create and manage tasks inside a matter, on its Tasks tab.",
      },
    ],
  },

  {
    id: "hearings-deadlines",
    title: "Hearings & deadlines",
    group: "Workflows",
    blocks: [
      {
        kind: "prose",
        text: "Hearings are scheduled court dates; deadlines are dates you must meet (limitation, statutory, or internal). Both live on the matter and feed the Calendar and Home agenda.",
      },
      {
        kind: "steps",
        items: [
          "On a matter, open the Hearings tab to add a hearing date and purpose; record its outcome (held or adjourned) afterwards.",
          "The next-hearing date shown on the matter and lists is computed automatically from the earliest upcoming scheduled hearing.",
          "Open the Deadlines tab to add a deadline with its type and basis.",
          "Overdue and today’s dates are coloured loudest everywhere so they’re impossible to miss.",
        ],
      },
    ],
  },

  {
    id: "documents",
    title: "Documents",
    group: "Workflows",
    blocks: [
      {
        kind: "prose",
        text: "Each matter keeps its files together — court orders, judgements, and your own filings — stored privately and scoped to you.",
      },
      {
        kind: "steps",
        items: [
          "On a matter’s Documents tab, upload a file and tag its type (filing/upload, court order, judgement).",
          "Click a document name to download it via a short-lived secure link.",
          "Deleting a document asks for confirmation; uploads and deletions are recorded on the matter’s timeline.",
        ],
      },
    ],
  },

  {
    id: "clients",
    title: "Clients & conflict check",
    group: "Workflows",
    blocks: [
      {
        kind: "prose",
        text: "Clients are the people and organisations you act for. The client page shows their matters, engagements, contacts, and captured details (address, GSTIN, PAN).",
      },
      {
        kind: "steps",
        items: [
          "Add a client from Clients → New client; choose individual or organisation and capture contact details.",
          "On intake, Legal Owl runs a conflict check against the parties in your existing matters.",
          "If nothing matches you’ll see “No conflicts found”; if there’s a possible conflict, a banner lets you review and acknowledge it.",
          "Search the client list by name, email, or phone; the header shows your total client count.",
        ],
      },
    ],
  },

  {
    id: "calendar",
    title: "Calendar & overdue",
    group: "Workflows",
    blocks: [
      {
        kind: "prose",
        text: "The Calendar is one agenda of every upcoming hearing and deadline across your matters, grouped by day.",
      },
      {
        kind: "steps",
        items: [
          "Anything overdue — a missed hearing or a passed deadline — is pinned to the top in red so it never slips.",
          "Upcoming items follow, grouped by date with how soon each is due.",
          "Click any item to jump to its matter.",
        ],
      },
    ],
  },

  {
    id: "settings",
    title: "Settings",
    group: "Workflows",
    blocks: [
      {
        kind: "prose",
        text: "Settings is where you manage your profile and account.",
      },
      {
        kind: "steps",
        items: [
          "Edit your name, firm name, phone, and bar enrolment — your name and firm appear on client update emails.",
          "Load or clear sample data any time to explore the app.",
          "Your case data, documents, and identity are stored in India (Mumbai, ap-south-1) and never leave the country.",
        ],
      },
    ],
  },

  {
    id: "glossary",
    title: "Entity glossary",
    group: "Reference",
    blocks: [
      {
        kind: "prose",
        text: "The objects Legal Owl works with, and how they fit together.",
      },
      {
        kind: "glossary",
        entries: [
          {
            term: "Client",
            whatItIs: "A person or organisation you act for — the top of the hierarchy (Client → Engagement → Matter → Action).",
            properties: [
              { label: "Name", meaning: "The client’s display name." },
              { label: "Type", meaning: "One of two values: Individual or Organisation. (GSTIN/PAN apply mainly to organisations.)" },
              { label: "Status", meaning: "One of three values: Lead, Active, or Inactive. Defaults to Active." },
              { label: "Email", meaning: "Primary email — used for client update emails." },
              { label: "Phone", meaning: "Primary phone number." },
              { label: "Address", meaning: "Postal address." },
              { label: "GSTIN", meaning: "Goods & Services Tax id (organisations)." },
              { label: "PAN", meaning: "Permanent Account Number." },
              { label: "Notes", meaning: "Free-text notes about the client." },
              { label: "Created", meaning: "When the client was added." },
            ],
            relatesTo: [
              "Has one or more Engagements (a “General” engagement is auto-created on intake)",
              "Has Matters (via its engagements)",
              "Has Contacts (people attached to the client)",
              "May have Conflict flags raised at intake",
              "Isolated to you — only you can see your clients (per-lawyer access)",
            ],
          },
          {
            term: "Contact",
            whatItIs: "A person attached to a client — a point of contact, separate from the client’s own details.",
            properties: [
              { label: "Name", meaning: "The contact’s name." },
              { label: "Role", meaning: "Their role (e.g. director, spouse, accountant)." },
              { label: "Email", meaning: "The contact’s email." },
              { label: "Phone", meaning: "The contact’s phone." },
            ],
            relatesTo: ["Belongs to a Client"],
          },
          {
            term: "Engagement",
            whatItIs: "A body of work for a client (a retainer or brief). Every client gets a default “General” engagement automatically on intake.",
            properties: [
              { label: "Name", meaning: "What the engagement covers (e.g. “General”, “FY26 Retainer”)." },
              { label: "Scope note", meaning: "Optional note describing the scope of work." },
              { label: "Status", meaning: "One of three values: Open, On hold, or Closed. Defaults to Open." },
              { label: "Created", meaning: "When the engagement was created." },
            ],
            relatesTo: ["Belongs to a Client", "Groups Matters"],
          },
          {
            term: "Conflict flag",
            whatItIs: "An advisory note raised at client intake when a new client’s name matches a party in one of your existing matters.",
            properties: [
              { label: "Matched name", meaning: "The name that matched an existing party." },
              { label: "Note", meaning: "Why the flag was raised." },
              { label: "Status", meaning: "One of two values: Open or Dismissed (acknowledged)." },
            ],
            relatesTo: ["Belongs to a Client", "May point to the Matter it matched", "Advisory only — it never blocks intake"],
          },
          {
            term: "Matter",
            whatItIs: "A single case file — the unit you track in court, and the aggregate that owns hearings, deadlines, tasks, documents and the timeline.",
            properties: [
              { label: "Internal id", meaning: "A short human key like M-3, unique to you (copyable)." },
              { label: "CNR", meaning: "The court’s Case Number Record, if known — your link to eCourts. Unique per lawyer when set." },
              { label: "Title", meaning: "The case file’s title." },
              { label: "Forum", meaning: "One of eight values: District Court, High Court, Supreme Court, NCLT, NCLAT, Arbitration, Tribunal, or Other. Defaults to District Court." },
              { label: "Case type", meaning: "The kind of case (free text, e.g. writ, suit, appeal)." },
              { label: "Parties", meaning: "Petitioners, respondents, and advocates." },
              { label: "Court hierarchy", meaning: "State / district / complex / establishment, when synced from eCourts." },
              { label: "Court status", meaning: "Status text from eCourts (read-only)." },
              { label: "Status", meaning: "One of three values: Active, On hold, or Disposed. Defaults to Active. (Archiving sets an archived date.)" },
              { label: "Lifecycle", meaning: "Court-monitoring sync state — one of four values: Pending first sync, Active, Not found, or Disposed." },
              { label: "Next hearing", meaning: "Computed — the date of the earliest upcoming scheduled hearing (not set by hand)." },
              { label: "Last synced", meaning: "When the matter last successfully synced with eCourts (read-only)." },
              { label: "Last event", meaning: "When the most recent court event was detected." },
              { label: "Created", meaning: "When the matter was created." },
            ],
            relatesTo: [
              "Belongs to a Client and an Engagement",
              "Has Actions (tasks), Hearings, Deadlines, Documents",
              "Has a Timeline (court events + your remarks)",
              "Feeds the Inbox via Triage items",
              "Can carry Labels",
              "Isolated to you (per-lawyer access)",
            ],
          },
          {
            term: "Action (Task)",
            whatItIs: "Something you need to do on a matter — the ticket. Every task belongs to a matter.",
            properties: [
              { label: "Key", meaning: "A short human key like ACT-12, unique to you." },
              { label: "Title", meaning: "What needs doing." },
              { label: "Description", meaning: "Optional detail." },
              { label: "Status", meaning: "A workflow state (To-Do, Awaiting Filing, Filed, Done, …). See “Workflow state”." },
              { label: "Priority", meaning: "One of five values: No priority, Low, Medium, High, or Urgent. Defaults to No priority." },
              { label: "Due date", meaning: "When it’s due — drives the Overdue / Today / This week grouping." },
              { label: "Source", meaning: "How the task was created — one of four values: Manual, Triage (accepted from the Inbox), Template, or Deadline." },
              { label: "Completed", meaning: "When the task was marked done." },
              { label: "Anchors", meaning: "May be anchored to a specific Hearing or Deadline on the matter." },
            ],
            relatesTo: [
              "Belongs to a Matter",
              "Has a Workflow state",
              "Can be created from an Inbox (Triage) item",
              "Can carry Labels",
              "Can depend on other tasks (see “Task dependency”)",
              "May anchor to a Hearing or Deadline",
            ],
          },
          {
            term: "Task dependency",
            whatItIs: "A link between two tasks on the same matter that records how they relate.",
            properties: [
              { label: "Kind", meaning: "One of three values: Blocks (this task blocks another), Blocked by (this task waits on another), or Related." },
            ],
            relatesTo: ["Connects two Actions (tasks)", "Scoped to a single matter (no cross-matter links)", "A “blocked by” task shows a blocked indicator"],
          },
          {
            term: "Hearing",
            whatItIs: "A court date listed on a matter.",
            properties: [
              { label: "Date", meaning: "When the hearing is listed." },
              { label: "Purpose", meaning: "What it’s for (e.g. arguments, evidence)." },
              { label: "Outcome", meaning: "What happened, recorded afterwards." },
              { label: "State", meaning: "One of three values: Scheduled, Held, or Adjourned. Defaults to Scheduled." },
              { label: "Source", meaning: "Where it came from — eCourts, you, or the system." },
            ],
            relatesTo: ["Belongs to a Matter", "The earliest Scheduled hearing sets the matter’s next-hearing date", "A Deadline can be anchored to a hearing", "Appears on the Calendar and Home"],
          },
          {
            term: "Deadline",
            whatItIs: "A date you must meet on a matter — rule-computed, never guessed.",
            properties: [
              { label: "Type", meaning: "One of three values: Limitation, Statutory, or Internal." },
              { label: "Due date", meaning: "The date itself (computed by rule, not by AI)." },
              { label: "Basis", meaning: "Why this date applies (e.g. a Limitation Act article)." },
              { label: "Anchor", meaning: "Optionally tied to a hearing it’s measured from." },
            ],
            relatesTo: ["Belongs to a Matter", "May anchor to a Hearing", "Appears on the Calendar and Home"],
          },
          {
            term: "Document",
            whatItIs: "A file kept with a matter. The file itself is stored privately and scoped to you.",
            properties: [
              { label: "Name", meaning: "The file name." },
              { label: "Source", meaning: "One of four values: Court order, Judgement, Your upload, or Generated. Defaults to your upload." },
              { label: "Type", meaning: "The file’s MIME type." },
              { label: "Size", meaning: "The file size." },
              { label: "Uploaded", meaning: "When it was added." },
            ],
            relatesTo: ["Belongs to a Matter", "Upload and delete are recorded on the Timeline", "Stored privately in India, scoped to you"],
          },
          {
            term: "Court event / Timeline",
            whatItIs: "An append-only record of something that happened on a matter — a court update or document activity. Court events are merged with your remarks into one timeline. Entries can’t be edited or deleted.",
            properties: [
              { label: "Type", meaning: "What happened (order uploaded, hearing date changed, document added, …)." },
              { label: "Previous → new", meaning: "What changed, when a value moved (old value to new value)." },
              { label: "Occurred", meaning: "When it happened in court." },
              { label: "Detected", meaning: "When Legal Owl noticed it." },
              { label: "Source", meaning: "One of three values: eCourts, You, or the System." },
            ],
            relatesTo: ["Belongs to a Matter", "Shown with Remarks on the matter Timeline", "Append-only — entries are never changed", "A court event can spawn a Triage item"],
          },
          {
            term: "Remark",
            whatItIs: "A note you add to a matter’s timeline. Once saved it’s immutable — it can’t be edited or deleted.",
            properties: [
              { label: "Body", meaning: "Your note." },
              { label: "Created", meaning: "When you wrote it." },
            ],
            relatesTo: ["Belongs to a Matter", "Shown with Court events on the Timeline", "Append-only and immutable"],
          },
          {
            term: "Triage item (Inbox)",
            whatItIs: "An incoming update about a matter, waiting for your decision in the Inbox.",
            properties: [
              { label: "Kind", meaning: "What kind of update it is (new order, hearing date change, status change, …)." },
              { label: "Summary", meaning: "A one-line description of what happened." },
              { label: "State", meaning: "One of three values: Pending, Accepted (turned into a task), or Dismissed." },
              { label: "Snoozed until", meaning: "If snoozed, when it returns to the Inbox." },
            ],
            relatesTo: ["Belongs to a Matter", "May originate from a Court event", "Becomes an Action (task) when accepted"],
          },
          {
            term: "Workflow state",
            whatItIs: "The named status a task can be in. The default set is shared; the type (not the name) drives grouping, Linear-style.",
            properties: [
              { label: "Name", meaning: "The default set: Triage, To-Do, Awaiting Filing, Filed, Awaiting Hearing, In Progress, Blocked, Done, Cancelled." },
              { label: "Type", meaning: "One of six values that group states: Triage, Unstarted, Started, Blocked, Completed, or Cancelled." },
              { label: "Position", meaning: "The state’s order in the list." },
            ],
            relatesTo: ["Applied to Actions (tasks)", "The default set is system-provided"],
          },
          {
            term: "Label",
            whatItIs: "A coloured tag you create and apply to organise your work.",
            properties: [
              { label: "Name", meaning: "The tag text (unique per lawyer)." },
              { label: "Colour", meaning: "An optional colour for the chip." },
            ],
            relatesTo: ["Can be applied to Tasks (and Matters)", "Isolated to you (per-lawyer access)"],
          },
        ],
      },
    ],
  },

  {
    id: "faq",
    title: "FAQ",
    group: "Reference",
    blocks: [
      {
        kind: "glossary",
        entries: [
          {
            term: "Why is access invite-only?",
            whatItIs: "Legal Owl is in early access. Requesting an account adds you to the waitlist; you’ll be emailed when it’s approved.",
            properties: [],
            relatesTo: [],
          },
          {
            term: "Where does my data live?",
            whatItIs: "All case data, documents, and identity are stored in India (Mumbai, ap-south-1) and never leave the country.",
            properties: [],
            relatesTo: [],
          },
          {
            term: "Why does a task need a matter?",
            whatItIs: "Every task is part of a case file, so it always carries the context of which matter it advances.",
            properties: [],
            relatesTo: [],
          },
          {
            term: "How do I reset my password?",
            whatItIs: "On the sign-in page, use “Forgot password?” — we’ll email you a link to set a new one.",
            properties: [],
            relatesTo: [],
          },
        ],
      },
    ],
  },
];
