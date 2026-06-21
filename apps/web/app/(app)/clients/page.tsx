import Link from "next/link";
import { ChevronRight, Search, Building2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/page-header";
import { CLIENT_STATUS_LABELS, type ClientStatus, type ClientType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ClientRow {
  id: string;
  display_name: string;
  type: ClientType;
  status: ClientStatus;
  email: string | null;
  phone: string | null;
  matters: { count: number }[];
}

const STATUS_TONE: Record<ClientStatus, string> = {
  lead: "bg-lemon/15 text-foreground/80",
  active: "bg-primary/10 text-primary",
  inactive: "bg-muted text-muted-foreground",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("id, display_name, type, status, email, phone, matters:matters(count)")
    .order("display_name", { ascending: true });
  if (q.trim()) query = query.ilike("display_name", `%${q}%`);

  const { data: rows } = await query.returns<ClientRow[]>();
  const clients = rows ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <PageHeader title="Clients" subtitle="People and organisations you act for.">
        <Link href="/clients/new" className={buttonVariants({ size: "sm" })}>
          + New client
        </Link>
      </PageHeader>

      <form className="relative mb-4" action="/clients">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Search clients…" className="pl-9" />
      </form>

      {clients.length === 0 ? (
        <EmptyState
          title={q ? "No clients match your search" : "No clients yet"}
          hint={q ? undefined : "Add your first client — we'll run a conflict check as you go."}
          action={
            !q ? (
              <Link href="/clients/new" className={buttonVariants({ size: "sm" })}>
                + New client
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="flex items-center gap-3 bg-card px-4 py-3.5 transition-colors hover:bg-accent/40">
                {c.type === "organisation" ? (
                  <Building2 className="size-5 shrink-0 text-muted-foreground" />
                ) : (
                  <User className="size-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.email || c.phone || (c.type === "organisation" ? "Organisation" : "Individual")}
                  </div>
                </div>
                <span className="tnum text-xs text-muted-foreground">
                  {c.matters?.[0]?.count ?? 0} matter{(c.matters?.[0]?.count ?? 0) === 1 ? "" : "s"}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TONE[c.status])}>
                  {CLIENT_STATUS_LABELS[c.status]}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
