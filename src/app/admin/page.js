"use client";

import {useLocalization as useUiLocalization} from '@/localization/provider';
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Clock3, RotateCcw, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { tenantIdForUser } from "@/lib/auth-routing";
import { dashboardOverviewRequest } from "@/lib/api-client";
import { dashboardCanOpen, dashboardDate } from "@/lib/dashboard-work";
import { DashboardActivity, DashboardOrderChart, DashboardPriorities, DashboardQuickView,
  DashboardSalesChart, DashboardShortcuts, DashboardSkeleton } from "@/components/dashboard-overview-cards";
import styles from "@/components/dashboard-overview-cards.module.css";

function titleCase(value) {
  return String(value || "Activity").replaceAll(/[._]/g, " ").toLowerCase()
    .replace(/(^|\s)\S/g, character => character.toUpperCase());
}

function DashboardRouteSkeleton() {
  return <main className="workspace dashboard-route-skeleton" id="workspace"><div className="dashboard-route-skeleton-heading" aria-hidden="true"><span className="skeleton-block" /><strong className="skeleton-block" /><span className="skeleton-block" /></div><DashboardSkeleton /></main>;
}

function DashboardContent({ accessToken, tenantId, user }) {
 const {t: _uiText}=useUiLocalization();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    const version = ++requestVersion.current;
    setLoading(true); setError("");
    try {
      const result = await dashboardOverviewRequest(accessToken, tenantId);
      if (version !== requestVersion.current) return;
      setData(result); setUpdatedAt(new Date().toISOString());
    } catch (requestError) {
      if (version === requestVersion.current) setError(requestError.message || "Dashboard insights could not be loaded.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [accessToken, tenantId]);
  useEffect(() => { load(); return () => { requestVersion.current += 1; }; }, [load]);
  const canOrders = dashboardCanOpen(user, tenantId, "/admin/orders", "order.read");
  const events = (Array.isArray(data?.activity) ? data.activity : []).map(event => ({
    id: event.id, time: dashboardDate(event.occurredAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    title: titleCase(event.action), detail: `${String(event.entityType || "Activity").replaceAll("_", " ")} · ${event.actorName || "System"}`
  }));
  return <AppShell
    action={dashboardCanOpen(user, tenantId, "/admin/catalog/products", "catalog.product.read") ? <div className="dashboard-header-actions"><Link className="button button-primary" href="/admin/catalog/products">{_uiText("View products")}<ArrowUpRight aria-hidden="true" size={16} /></Link></div> : null}
    area="admin" currentPath="/admin" description={_uiText("See your store at a glance, review open tasks and take the next step.")}
    eyebrow={_uiText("Daily operations")} loadingFallback={<DashboardRouteSkeleton />} title={_uiText("Dashboard")}>
    <div className={styles.dashboard}>
      {loading ? <DashboardSkeleton /> : error ? <section className="dashboard-error" role="alert"><span><TriangleAlert aria-hidden="true" size={22} /></span><div><strong>We couldn't load your dashboard</strong><p>{error}</p><p>Your task status is unknown until the data loads.</p></div><button className="button button-secondary" onClick={load} type="button"><RotateCcw aria-hidden="true" size={15} />{_uiText("Try again")}</button></section> : data ? <>
        <div className={styles.snapshot}><span><Clock3 size={14} aria-hidden="true" />Updated {dashboardDate(updatedAt, { hour: "2-digit", minute: "2-digit" })} UTC</span><span>Reload this page to update the counts.</span></div>
        <DashboardQuickView data={data} user={user} tenantId={tenantId} />
        <div className={styles.workGrid}><DashboardPriorities data={data} user={user} tenantId={tenantId} /><DashboardShortcuts user={user} tenantId={tenantId} /></div>
        {canOrders && <section aria-labelledby="performance-title"><div className={styles.sectionHeading}><div><h2 id="performance-title">{_uiText("Order performance")}</h2><p>{_uiText("Understand order value and your current workload.")}</p></div></div><div className={styles.charts}><DashboardSalesChart data={data.salesTrend} /><DashboardOrderChart data={data.orderMix} /></div></section>}
        <DashboardActivity events={events} />
      </> : null}
    </div>
  </AppShell>;
}

export default function AdminDashboard() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  return <DashboardContent key={`${user?.id || "anonymous"}:${tenantId || "none"}`} accessToken={accessToken} tenantId={tenantId} user={user} />;
}
