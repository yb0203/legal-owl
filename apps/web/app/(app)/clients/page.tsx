import { PageHeader, EmptyState } from "@/components/page-header";

export default function ClientsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <PageHeader title="Clients" subtitle="People and organisations you act for." />
      <EmptyState title="Clients are coming soon" hint="Client records and intake land in an upcoming update." />
    </main>
  );
}
