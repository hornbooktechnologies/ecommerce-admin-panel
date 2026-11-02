"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricStrip, Status } from "@/components/dashboard-primitives";
import { useAuth } from "@/components/auth-provider";
import { canUser } from "@/lib/auth-routing";
import { platformDashboardRequest } from "@/lib/api-client";
import styles from "./platform-overview.module.css";

const number = new Intl.NumberFormat("en-IN");
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const when = (value) => { const parsed = value ? new Date(value) : null; return parsed && Number.isFinite(parsed.getTime()) ? `${date.format(parsed)} IST` : "Not available"; };
const tones = { ACTIVE: "positive", PENDING: "warning", SUSPENDED: "danger" };

function Skeleton() {
  return <div className={styles.skeleton} role="status" aria-label="Loading platform overview"><span className="sr-only">Loading platform overview</span><div className={styles.tiles}>{[1, 2, 3, 4].map((key) => <i key={key} aria-hidden="true" />)}</div><div className={styles.tableSkeleton} aria-hidden="true">{[1, 2, 3, 4].map((key) => <i key={key} />)}</div></div>;
}

function OverviewData({ user, accessToken }) {
  const [data, setData] = useState(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const tokenRef = useRef(accessToken); tokenRef.current = accessToken;
  const canRead = canUser(user, "platform", "platform.dashboard.read");
  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort("timeout"), 20000);
    let alive = true; setLoading(true); setError("");
    platformDashboardRequest({ accessToken: tokenRef.current, signal: controller.signal })
      .then((next) => { if (alive) setData(next); })
      .catch((failure) => { if (alive) setError(controller.signal.aborted ? "The overview took too long to load. Try again." : failure.message || "Platform data could not be loaded."); })
      .finally(() => { clearTimeout(timeout); if (alive) setLoading(false); });
    return () => { alive = false; clearTimeout(timeout); controller.abort(); };
  }, [user.id, canRead, retry]);
  if (!canRead) return <div className="inline-state" role="status">Your platform role does not include overview access. Use an authorised page from the sidebar or ask a super administrator for access.</div>;
  if (loading && !data) return <Skeleton />;
  return <div className={styles.content} aria-busy={loading}>
    {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}{data ? " The previous snapshot is still shown below." : " No counts are shown until data loads."}</span><button type="button" disabled={loading} onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : null}
    {data ? <>
      <MetricStrip metrics={[
        { label: "Active tenants", value: number.format(data.summary.activeTenants), context: `${number.format(data.summary.totalTenants)} total · ${number.format(data.summary.suspendedTenants)} suspended`, tone: "positive" },
        { label: "Active tenant staff", value: number.format(data.summary.activeTenantStaff), context: "Distinct active users in active tenants", tone: "neutral" },
        { label: "Active stores", value: number.format(data.summary.activeStores), context: "In active, non-deleted tenants", tone: "positive" },
        { label: "Tenants in setup", value: number.format(data.summary.pendingTenants), context: "Pending activation", tone: "warning" }
      ]} />
      <p className={styles.timestamp}>Snapshot: <time dateTime={data.generatedAt}>{when(data.generatedAt)}</time>. Customer accounts are not included in staff counts.</p>
      {data.canReadTenants ? <section className={`primary-work full-width-section ${styles.section}`} aria-labelledby="recent-tenant-heading">
        <div className="section-heading"><div><p className="eyebrow">Tenant directory</p><h2 id="recent-tenant-heading">Recently updated tenants</h2><p className={styles.note}>Latest 10 tenant records, ordered by their last update—not browsing activity.</p></div><Link className="text-action" href="/platform/tenants">View all tenants</Link></div>
        {data.recentTenants.length ? <div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Most recently updated tenants</caption><thead><tr><th scope="col">Tenant</th><th scope="col">Stores</th><th scope="col">Active staff</th><th scope="col">Updated</th><th scope="col">Status</th></tr></thead><tbody>{data.recentTenants.map((tenant) => <tr key={tenant.id}><td><Link href={`/platform/tenants/${tenant.id}`}>{tenant.name}</Link></td><td>{number.format(tenant.stores)}</td><td>{number.format(tenant.staff)}</td><td><time dateTime={tenant.updatedAt || undefined}>{when(tenant.updatedAt)}</time></td><td><Status tone={tones[tenant.status] || "neutral"}>{tenant.status.toLowerCase()}</Status></td></tr>)}</tbody></table></div>
          : <div className="empty-workspace"><h3>No tenants yet</h3><p>New businesses will appear here after a tenant is created.</p></div>}
      </section> : <p className="inline-state">Tenant-directory details require separate tenant-read permission.</p>}
    </> : null}
  </div>;
}

export default function PlatformOverview() {
  const { user, accessToken } = useAuth();
  return <AppShell area="platform" currentPath="/platform" eyebrow="Platform control" title="System overview"
    description="Current platform totals and recent tenant changes, directly from your database."
    action={canUser(user, "platform", "platform.tenant.create") ? <Link className="button button-primary" href="/platform/tenants/new"><Plus size={16} aria-hidden="true" />Create tenant</Link> : null}>
    {user && accessToken ? <OverviewData key={user.id} user={user} accessToken={accessToken} /> : <Skeleton />}
  </AppShell>;
}
