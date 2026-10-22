"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, IndianRupee, PackageCheck, Plus,
  RotateCcw, ShoppingBag, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ActivityRail, AttentionNote, MetricStrip, QueueTable, SectionHeading, Status } from "@/components/dashboard-primitives";
import { useAuth } from "@/components/auth-provider";
import { tenantIdForUser } from "@/lib/auth-routing";
import { dashboardOverviewRequest } from "@/lib/api-client";

const columns = [
  { key: "reference", label: "Reference" }, { key: "work", label: "Work item" },
  { key: "owner", label: "Owner" }, { key: "age", label: "Age" }, { key: "status", label: "Status" }
];
const queueStatus = {
  REVIEW: <Status tone="warning">Review</Status>, ACTION: <Status tone="neutral">In progress</Status>,
  RISK: <Status tone="danger">Stock risk</Status>
};
const mixTone = { New: "teal", Processing: "warm", Completed: "green", Cancelled: "danger", Draft: "neutral" };

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact",
    maximumFractionDigits: 1 }).format(value || 0);
}
function relativeAge(value) {
  if (!value) return "Now";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d`;
}
function titleCase(value) {
  return String(value || "Activity").replaceAll(/[._]/g, " ").toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" aria-label="Loading dashboard insights" aria-live="polite" role="status"><span className="sr-only">Loading dashboard insights</span><div className="skeleton-metrics">{Array.from({ length: 4 }, (_, index) => <span className="skeleton-block" key={index}><i /><b /><i /></span>)}</div><div className="skeleton-chart-grid"><span className="skeleton-chart skeleton-block"><i /><b /><em /></span><span className="skeleton-chart skeleton-block"><i /><b /><em /></span></div><div className="skeleton-work-grid"><span className="skeleton-table skeleton-block"><i /><b /><b /><b /><b /></span><span className="skeleton-feed skeleton-block"><i /><b /><b /><b /></span></div></div>;
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
  const dateLabel = (value) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
  return <section className="dashboard-chart-panel sales-chart-panel" aria-labelledby="sales-chart-title"><header><div><p className="eyebrow">Last seven days</p><h2 id="sales-chart-title">Revenue movement</h2></div><span className="chart-total"><IndianRupee aria-hidden="true" size={16} /><span><small>Period revenue</small><strong>{formatCurrency(data.reduce((sum, item) => sum + item.revenue, 0))}</strong></span></span></header>{points.length ? <div className="sales-chart-canvas"><div className="chart-tooltip" style={{ left: `${(active.x / width) * 100}%`, top: `${Math.max(4, (active.y / height) * 100 - 6)}%` }}><strong>{formatCurrency(active.revenue)}</strong><span>{active.orders} orders · {dateLabel(active.date)}</span></div><svg aria-describedby="sales-chart-summary" aria-label="Seven day revenue line chart" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}><defs><linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--positive)" stopOpacity=".24" /><stop offset="100%" stopColor="var(--positive)" stopOpacity="0" /></linearGradient></defs>{[0, .25, .5, .75, 1].map((level) => <line className="chart-grid-line" key={level} x1={left} x2={width - right} y1={top + plotHeight * level} y2={top + plotHeight * level} />)}<path className="chart-area" d={area} fill="url(#salesArea)" /><path className="chart-line" d={line} fill="none" pathLength="1" />{points.map((point, index) => <g aria-label={`${dateLabel(point.date)}: ${formatCurrency(point.revenue)}, ${point.orders} orders`} className="chart-point" data-active={index === activeIndex || undefined} key={point.date} onBlur={() => setActiveIndex(data.length - 1)} onFocus={() => setActiveIndex(index)} onMouseEnter={() => setActiveIndex(index)} role="img" tabIndex="0"><circle className="chart-point-hit" cx={point.x} cy={point.y} r="15" /><circle cx={point.x} cy={point.y} r="4" /></g>)}{points.map((point) => <text className="chart-axis-label" key={`label-${point.date}`} textAnchor="middle" x={point.x} y={height - 12}>{dateLabel(point.date)}</text>)}</svg><table className="sr-only" id="sales-chart-summary"><caption>Daily revenue and orders</caption><thead><tr><th>Date</th><th>Revenue</th><th>Orders</th></tr></thead><tbody>{data.map((item) => <tr key={item.date}><td>{dateLabel(item.date)}</td><td>{formatCurrency(item.revenue)}</td><td>{item.orders}</td></tr>)}</tbody></table></div> : <div className="chart-empty"><ChartNoAxesCombined aria-hidden="true" size={24} /><strong>No order trend yet</strong><span>Revenue will appear as orders are created.</span></div>}</section>;
}

function OrderMixChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0); const max = Math.max(1, ...data.map((item) => item.value));
  return <section className="dashboard-chart-panel mix-chart-panel" aria-labelledby="mix-chart-title"><header><div><p className="eyebrow">Current workload</p><h2 id="mix-chart-title">Order status mix</h2></div><span className="mix-total"><ShoppingBag aria-hidden="true" size={17} /><strong>{total}</strong><small>total orders</small></span></header>{data.length && total ? <div className="mix-chart" role="img" aria-label={`Order status distribution across ${total} orders`}>{data.map((item) => <div className="mix-row" key={item.label}><span><strong>{item.label}</strong><small>{Math.round(item.value / total * 100)}%</small></span><div aria-hidden="true"><i data-tone={mixTone[item.label]} style={{ transform: `scaleX(${item.value / max})` }} /></div><strong>{item.value}</strong></div>)}</div> : <div className="chart-empty"><PackageCheck aria-hidden="true" size={24} /><strong>No orders to distribute</strong><span>Status composition will appear here.</span></div>}</section>;
}

export default function AdminDashboard() {
  const { accessToken, activeTenantId, user } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { if (!accessToken || !tenantId) return; setLoading(true); setError("");
    try { setData(await dashboardOverviewRequest(accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Dashboard insights could not be loaded."); }
    finally { setLoading(false); } }, [accessToken, tenantId]);
  useEffect(() => { load(); }, [load]);
  const metrics = useMemo(() => { const values = data?.metrics; if (!values) return [];
    const delta = values.ordersToday - values.ordersYesterday;
    return [
      { label: "Orders today", value: values.ordersToday.toLocaleString("en-IN"), context: delta === 0 ? "Same as yesterday" : `${delta > 0 ? "+" : ""}${delta} from yesterday`, tone: delta >= 0 ? "positive" : "warning" },
      { label: "Awaiting fulfillment", value: values.awaitingFulfillment.toLocaleString("en-IN"), context: values.awaitingFulfillment ? "Requires warehouse action" : "Queue is clear", tone: values.awaitingFulfillment ? "warning" : "positive" },
      { label: "Low-stock offers", value: values.lowStock.toLocaleString("en-IN"), context: values.lowStock ? "At or below reorder level" : "Stock levels healthy", tone: values.lowStock ? "warning" : "positive" },
      { label: "Pending approvals", value: values.pendingApprovals.toLocaleString("en-IN"), context: `${values.pendingVendors} vendors · ${values.pendingReturns} returns`, tone: values.pendingApprovals ? "neutral" : "positive" }
    ]; }, [data]);
  const rows = (data?.queue || []).map((item) => ({ ...item, age: relativeAge(item.createdAt), status: queueStatus[item.status] }));
  const events = (data?.activity || []).map((event) => ({ id: event.id, time: new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.occurredAt)), title: titleCase(event.action), detail: `${event.entityType.replaceAll("_", " ")} · ${event.actorName}` }));
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return <AppShell action={<Link className="button button-primary" href="/admin/orders"><Plus aria-hidden="true" size={16} />Create order</Link>} area="admin" currentPath="/admin" description="Live sales, order flow, inventory risk, and work requiring attention." eyebrow={today} loadingFallback={<DashboardRouteSkeleton />} title="Operations">
    {loading ? <DashboardSkeleton /> : error ? <section className="dashboard-error" role="alert"><span><TriangleAlert aria-hidden="true" size={22} /></span><div><strong>Dashboard data is unavailable</strong><p>{error}</p></div><button className="button button-secondary" onClick={load} type="button"><RotateCcw aria-hidden="true" size={15} />Try again</button></section> : data ? <><MetricStrip metrics={metrics} /><div className="dashboard-chart-grid"><SalesTrendChart data={data.salesTrend} /><OrderMixChart data={data.orderMix} /></div><div className="workspace-grid dashboard-workspace-grid"><section className="primary-work"><SectionHeading actionHref="/admin/orders" actionLabel="Open orders" eyebrow="Priority queue" title="Needs attention" />{rows.length ? <><AttentionNote>{rows.length} operational {rows.length === 1 ? "item requires" : "items require"} review across fulfilment, stock, returns, and vendors.</AttentionNote><QueueTable columns={columns} rows={rows} /></> : <div className="dashboard-clear-state"><PackageCheck aria-hidden="true" size={24} /><strong>No urgent work</strong><span>Operational queues are currently clear.</span></div>}</section><aside className="activity-rail" aria-label="Recent activity"><SectionHeading eyebrow="Audit stream" title="Recent activity" />{events.length ? <ActivityRail events={events} /> : <div className="dashboard-clear-state"><ArrowUpRight aria-hidden="true" size={22} /><strong>No recent activity</strong><span>Audited actions will appear here.</span></div>}</aside></div></> : null}
  </AppShell>;
}
