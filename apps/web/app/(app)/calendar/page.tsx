import { PageHeader, EmptyState } from "@/components/page-header";

export default function CalendarPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <PageHeader title="Calendar" subtitle="Hearings and deadlines across all your matters." />
      <EmptyState title="Calendar is coming soon" hint="A dates view of hearings and deadlines lands in an upcoming update." />
    </main>
  );
}
