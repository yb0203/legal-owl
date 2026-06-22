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
            whatItIs: "A person or organisation you act for.",
            properties: [
              { label: "Type", meaning: "Individual or organisation." },
              { label: "Status", meaning: "Lead, Active, or Inactive." },
              { label: "Contact", meaning: "Email, phone, address." },
              { label: "Tax ids", meaning: "GSTIN and PAN (for organisations)." },
            ],
            relatesTo: ["Has one or more Engagements", "Has Matters", "Has Contacts"],
          },
          {
            term: "Engagement",
            whatItIs: "A body of work for a client. Every client gets a default “General” engagement automatically.",
            properties: [
              { label: "Name", meaning: "What the engagement covers." },
              { label: "Status", meaning: "Open, On hold, or Closed." },
            ],
            relatesTo: ["Belongs to a Client", "Groups Matters"],
          },
          {
            term: "Matter",
            whatItIs: "A single case file — the unit you track in court.",
            properties: [
              { label: "Internal id", meaning: "A short id like M-3 (copyable)." },
              { label: "CNR", meaning: "The court’s case number, if known." },
              { label: "Forum", meaning: "District Court, High Court, Supreme Court, NCLT, NCLAT, arbitration, tribunal, or other." },
              { label: "Status", meaning: "Active, On hold, or Disposed." },
              { label: "Next hearing", meaning: "The earliest upcoming scheduled hearing (computed)." },
              { label: "Parties", meaning: "Petitioners and respondents." },
            ],
            relatesTo: ["Belongs to a Client and Engagement", "Has Actions, Hearings, Deadlines, Documents", "Has a court Timeline"],
          },
          {
            term: "Action (Task)",
            whatItIs: "Something you need to do on a matter.",
            properties: [
              { label: "Title", meaning: "What needs doing." },
              { label: "Status", meaning: "A workflow state (To-Do, Awaiting Filing, Filed, Done, …)." },
              { label: "Priority", meaning: "None, Low, Medium, High, or Urgent." },
              { label: "Due date", meaning: "When it’s due — drives the Overdue / Today / This week grouping." },
            ],
            relatesTo: ["Belongs to a Matter", "Can be created from an Inbox item"],
          },
          {
            term: "Hearing",
            whatItIs: "A scheduled court date on a matter.",
            properties: [
              { label: "Date", meaning: "When the hearing is listed." },
              { label: "Purpose", meaning: "What it’s for (e.g. arguments)." },
              { label: "State", meaning: "Scheduled, Held, or Adjourned." },
            ],
            relatesTo: ["Belongs to a Matter", "Sets the matter’s next-hearing date"],
          },
          {
            term: "Deadline",
            whatItIs: "A date you must meet on a matter.",
            properties: [
              { label: "Type", meaning: "Limitation, Statutory, or Internal." },
              { label: "Due date", meaning: "The date itself." },
              { label: "Basis", meaning: "Why this date applies." },
            ],
            relatesTo: ["Belongs to a Matter", "Appears on the Calendar and Home"],
          },
          {
            term: "Document",
            whatItIs: "A file kept with a matter.",
            properties: [
              { label: "Name", meaning: "The file name." },
              { label: "Source", meaning: "Court order, judgement, your upload, or generated." },
            ],
            relatesTo: ["Belongs to a Matter", "Upload/delete is recorded on the Timeline"],
          },
          {
            term: "Court event / Timeline",
            whatItIs: "An append-only record of things that happened on a matter — court updates and document activity — merged with your notes into one timeline.",
            properties: [
              { label: "Type", meaning: "What happened (order uploaded, hearing date changed, document added, …)." },
              { label: "Source", meaning: "From eCourts or from you." },
            ],
            relatesTo: ["Belongs to a Matter", "Shown with Remarks on the matter Timeline"],
          },
          {
            term: "Remark",
            whatItIs: "A note you add to a matter’s timeline.",
            properties: [{ label: "Body", meaning: "Your note." }],
            relatesTo: ["Belongs to a Matter"],
          },
          {
            term: "Triage item (Inbox)",
            whatItIs: "An incoming update awaiting your decision.",
            properties: [
              { label: "Kind", meaning: "New order, hearing date change, status change, …" },
              { label: "State", meaning: "Pending, Accepted, or Dismissed." },
            ],
            relatesTo: ["Belongs to a Matter", "Can become an Action when accepted"],
          },
          {
            term: "Workflow state",
            whatItIs: "The named status a task can be in.",
            properties: [
              { label: "Name", meaning: "To-Do, Awaiting Filing, Filed, Awaiting Hearing, In Progress, Blocked, Done, Cancelled." },
              { label: "Type", meaning: "Groups states as triage / unstarted / started / blocked / completed / cancelled." },
            ],
            relatesTo: ["Applied to Actions (tasks)"],
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
