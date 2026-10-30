"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, IndianRupee, PackageCheck,
  RotateCcw, ShoppingBag, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ActivityRail, MetricStrip } from "@/components/dashboard-primitives";
import { useAuth } from "@/components/auth-provider";
import { tenantIdForUser } from "@/lib/auth-routing";
import { dashboardOverviewRequest } from "@/lib/api-client";
import { DashboardWork } from "@/components/dashboard-work";
import { dashboardCanOpen, dashboardCount, dashboardDate } from "@/lib/dashboard-work";

const mixTone = { New: "teal", Processing: "warm", Completed: "green", Cancelled: "danger", Draft: "neutral" };

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact",
    maximumFractionDigits: 1 }).format(value || 0);
}
function titleCase(value) {
  return String(value || "Activity").replaceAll(/[._]/g, " ").toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" aria-label="Loading dashboard insights" aria-live="polite" role="status"><span className="sr-only">Loading dashboard insights</span><div className="skeleton-block dashboard-priority-skeleton" aria-hidden="true" /><div className="skeleton-metrics">{Array.from({ length: 4 }, (_, index) => <span className="skeleton-block" key={index}><i /><b /><i /></span>)}</div><div className="skeleton-chart-grid"><span className="skeleton-chart skeleton-block"><i /><b /><em /></span><span className="skeleton-chart skeleton-block"><i /><b /><em /></span></div><div className="skeleton-work-grid"><span className="skeleton-table skeleton-block"><i /><b /><b /><b /><b /></span><span className="skeleton-feed skeleton-block"><i /><b /><b /><b /></span></div></div>;
}

function DashboardRouteSkeleton() {
  return <main className="workspace dashboard-route-skeleton" id="workspace"><div className="dashboard-route-skeleton-heading" aria-hidden="true"><span className="skeleton-block" /><strong className="skeleton-block" /><span className="skeleton-block" /></div><DashboardSkeleton /></main>;
}

function SalesTrendChart({ data }) {
  const [activeIndex, setActiveIndex] = useState(Math.max(0, data.length - 1));
  const width = 720; const height = 250; const left = 48; const right = 18; const top = 28; const bottom = 42;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const maxRevenue = Math.max(1, ...data.map((item) => item.revenue));
  const points = data.map((item, index) => ({ ...item,
    x: left + (data.length === 1 ? plotWidth / 2 : index * plotWidth / (data.length - 1)),
    y: top + plotHeight - (item.revenue / maxRevenue) * plotHeight }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = points.length ? `${line} L${points.at(-1).x},${top + plotHeight} L${points[0].x},${top + plotHeight} Z` : "";
  const active = points[activeIndex] || points[0];
  const dateLabel = (value) => dashboardDate(value);
  return <section className="dashboard-chart-panel sales-chart-panel" aria-labelledby="sales-chart-title"><header><div><p className="eyebrow">Last seven days</p><h2 id="sales-chart-title">Order value trend</h2></div><span className="chart-total"><IndianRupee aria-hidden="true" size={16} /><span><small>Period order value</small><strong>{formatCurrency(data.reduce((sum, item) => sum + item.revenue, 0))}</strong></span></span></header>{points.length ? <div className="sales-chart-canvas"><div className="chart-tooltip" style={{ left: `${(active.x / width) * 100}%`, top: `${Math.max(4, (active.y / height) * 100 - 6)}%` }}><strong>{formatCurrency(active.revenue)}</strong><span>{active.orders} orders · {dateLabel(active.date)}</span></div><svg aria-describedby="sales-chart-summary" aria-label="Seven day order value line chart" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}><defs><linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--positive)" stopOpacity=".24" /><stop offset="100%" stopColor="var(--positive)" stopOpacity="0" /></linearGradient></defs>{[0, .25, .5, .75, 1].map((level) => <line className="chart-grid-line" key={level} x1={left} x2={width - right} y1={top + plotHeight * level} y2={top + plotHeight * level} />)}<path className="chart-area" d={area} fill="url(#salesArea)" /><path className="chart-line" d={line} fill="none" pathLength="1" />{points.map((point, index) => <g aria-label={`${dateLabel(point.date)}: ${formatCurrency(point.revenue)}, ${point.orders} orders`} className="chart-point" data-active={index === activeIndex || undefined} key={point.date} onBlur={() => setActiveIndex(data.length - 1)} onFocus={() => setActiveIndex(index)} onMouseEnter={() => setActiveIndex(index)} role="img" tabIndex="0"><circle className="chart-point-hit" cx={point.x} cy={point.y} r="15" /><circle cx={point.x} cy={point.y} r="4" /></g>)}{points.map((point) => <text className="chart-axis-label" key={`label-${point.date}`} textAnchor="middle" x={point.x} y={height - 12}>{dateLabel(point.date)}</text>)}</svg><table className="sr-only" id="sales-chart-summary"><caption>Daily order value and orders</caption><thead><tr><th>Date</th><th>Order value</th><th>Orders</th></tr></thead><tbody>{data.map((item) => <tr key={item.date}><td>{dateLabel(item.date)}</td><td>{formatCurrency(item.revenue)}</td><td>{item.orders}</td></tr>)}</tbody></table></div> : <div className="chart-empty"><ChartNoAxesCombined aria-hidden="true" size={24} /><strong>No order trend yet</strong><span>Order values will appear as orders are created.</span></div>}</section>;
}

function OrderMixChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0); const max = Math.max(1, ...data.map((item) => item.value));
  return <section className="dashboard-chart-panel mix-chart-panel" aria-labelledby="mix-chart-title"><header><div><p className="eyebrow">Current workload</p><h2 id="mix-chart-title">Order status mix</h2></div><span className="mix-total"><ShoppingBag aria-hidden="true" size={17} /><strong>{total}</strong><small>total orders</small></span></header>{data.length && total ? <div className="mix-chart" role="img" aria-label={`Order status distribution across ${total} orders`}>{data.map((item) => <div className="mix-row" key={item.label}><span><strong>{item.label}</strong><small>{Math.round(item.value / total * 100)}%</small></span><div aria-hidden="true"><i data-tone={mixTone[item.label]} style={{ transform: `scaleX(${item.value / max})` }} /></div><strong>{item.value}</strong></div>)}</div> : <div className="chart-empty"><PackageCheck aria-hidden="true" size={24} /><strong>No orders to distribute</strong><span>Status composition will appear here.</span></div>}</section>;
}

function DashboardContent({ accessToken, tenantId, user }) {
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
  const metrics = useMemo(() => {
    const values = data?.metrics;
    if (!values) return [];
    const count = key => dashboardCount(values[key])?.toLocaleString("en-IN") ?? "Unavailable";
    const items = [];
    if (canOrders) {
      items.push({ label: "Orders today (UTC)", value: count("ordersToday"), context: "Orders created, not payments collected", tone: "neutral" });
      items.push({ label: "Awaiting fulfilment", value: count("awaitingFulfillment"), context: "Unfulfilled or partially fulfilled", tone: "neutral" });
    }
    if (dashboardCanOpen(user, tenantId, "/admin/inventory", "inventory.stock.read")) items.push({
      label: "Low-stock balances", value: count("lowStock"), context: "At or below a configured reorder level", tone: "neutral"
    });
    if (dashboardCanOpen(user, tenantId, "/admin/returns", "return.read")) items.push({
      label: "Pending returns", value: count("pendingReturns"), context: "Requests awaiting review", tone: "neutral"
    });
    return items;
  }, [data, user, tenantId, canOrders]);
  const events = (data?.activity || []).map(event => ({
    id: event.id, time: dashboardDate(event.occurredAt, { hour: "2-digit", minute: "2-digit" }),
    title: titleCase(event.action), detail: `${String(event.entityType || "Activity").replaceAll("_", " ")} · ${event.actorName || "System"}`
  }));
  return <AppShell
    action={<div className="dashboard-header-actions"><button className="button button-secondary" type="button" onClick={load} disabled={loading || !tenantId}><RotateCcw aria-hidden="true" size={16} />{loading ? "Refreshing…" : "Refresh overview"}</button>{dashboardCanOpen(user, tenantId, "/admin/catalog/products", "catalog.product.read") && <Link className="button button-primary" href="/admin/catalog/products">Products<ArrowUpRight aria-hidden="true" size={16} /></Link>}</div>}
    area="admin" currentPath="/admin" description="Start with pending work, then explore your store’s performance."
    eyebrow="Daily operations" loadingFallback={<DashboardRouteSkeleton />} title="Your next actions">
    {loading ? <DashboardSkeleton /> : error ? <section className="dashboard-error" role="alert"><span><TriangleAlert aria-hidden="true" size={22} /></span><div><strong>Dashboard data is unavailable</strong><p>{error}</p><p>No queues have been marked clear. Try loading this snapshot again.</p></div><button className="button button-secondary" onClick={load} type="button"><RotateCcw aria-hidden="true" size={15} />Try again</button></section> : data ? <>
      <p className="dashboard-refresh-status" role="status">Snapshot updated {dashboardDate(updatedAt, { hour: "2-digit", minute: "2-digit" })} UTC · Refresh after completing work.</p>
      <DashboardWork data={data} user={user} tenantId={tenantId} />
      {metrics.length > 0 && <MetricStrip metrics={metrics} />}
      {canOrders && <details className="dashboard-insights"><summary>Sales &amp; order trends</summary><p className="dashboard-insights-note">Order value excludes drafts and cancelled orders. It is not collected revenue or settled payments. Chart dates and daily counts use UTC; order counts can include cancellations.</p><div className="dashboard-chart-grid"><SalesTrendChart data={data.salesTrend || []} /><OrderMixChart data={data.orderMix || []} /></div></details>}
      <details className="dashboard-insights"><summary>Recent activity</summary><p className="dashboard-insights-note">The latest six audit entries. Times are shown in UTC; activity history is separate from pending work.</p>{events.length ? <ActivityRail events={events} /> : <div className="dashboard-clear-state"><ArrowUpRight aria-hidden="true" size={22} /><strong>No recent activity</strong><span>Audited actions will appear here.</span></div>}</details>
    </> : null}
  </AppShell>;
}

export default function AdminDashboard() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  return <DashboardContent key={`${user?.id || "anonymous"}:${tenantId || "none"}`} accessToken={accessToken} tenantId={tenantId} user={user} />;
}

