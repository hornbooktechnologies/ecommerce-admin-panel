import { Plus } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { MetricStrip, QueueTable, SectionHeading, Status } from "@/components/dashboard-primitives";

export const metadata = { title: "Platform operations" };

export default function PlatformDashboard() {
  const columns = [
    { key: "tenant", label: "Tenant" },
    { key: "stores", label: "Stores" },
    { key: "users", label: "Users" },
    { key: "lastActivity", label: "Last activity" },
    { key: "status", label: "Status" }
  ];
  const rows = [
    { id: 1, tenant: "Northstar Retail", stores: "3", users: "48", lastActivity: "2 min ago", status: <Status tone="positive">Active</Status> },
    { id: 2, tenant: "Urban Pantry", stores: "1", users: "19", lastActivity: "8 min ago", status: <Status tone="positive">Active</Status> },
    { id: 3, tenant: "Aster Home", stores: "2", users: "27", lastActivity: "41 min ago", status: <Status tone="warning">Setup</Status> },
    { id: 4, tenant: "Kite Bazaar", stores: "1", users: "8", lastActivity: "Yesterday", status: <Status tone="neutral">Suspended</Status> }
  ];

  return (
    <AppShell
      action={<Link className="button button-primary" href="/platform/tenants/new"><Plus size={16} />Create tenant</Link>}
      area="platform"
      currentPath="/platform"
      description="Tenant lifecycle, job health, and privileged activity across the platform."
      eyebrow="Platform control"
      title="System overview"
    >
      <MetricStrip metrics={[
        { label: "Active tenants", value: "42", context: "3 onboarding", tone: "positive" },
        { label: "Active users", value: "1,284", context: "Across 61 stores", tone: "neutral" },
        { label: "Failed jobs", value: "3", context: "2 safe to retry", tone: "warning" },
        { label: "API availability", value: "99.98%", context: "Last 30 days", tone: "positive" }
      ]} />
      <section className="primary-work full-width-section">
        <SectionHeading eyebrow="Tenant directory" title="Recently active" actionHref="/platform/tenants" actionLabel="View all tenants" />
        <QueueTable columns={columns} rows={rows} />
      </section>
    </AppShell>
  );
}
