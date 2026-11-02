"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, ArrowUpRight, Boxes, CheckCheck, ChevronRight, ClipboardCheck, Clock3,
  History, PackageCheck, ShoppingBag, Store, Tags, ChartNoAxesCombined } from "lucide-react";
import { dashboardAge, dashboardCanOpen, dashboardCount, dashboardDate, dashboardWork } from "@/lib/dashboard-work";
import styles from "./dashboard-overview-cards.module.css";

const count = value => value === null ? "Unavailable" : value.toLocaleString("en-IN");
const cardDefinitions = [
  { key: "ordersToday", label: "Orders today", hint: "Orders created today · UTC", href: "/admin/orders", permission: "order.read", action: "Open orders", icon: ShoppingBag, tone: "teal", scope: "Today" },
  { key: "awaitingFulfillment", label: "Awaiting fulfilment", hint: "Unfulfilled or partly fulfilled orders", href: "/admin/orders", permission: "order.read", action: "Manage orders", icon: PackageCheck, tone: "green", scope: "Open work" },
  { key: "lowStock", label: "Low-stock alerts", hint: "Balances at or below their reorder level", href: "/admin/inventory", permission: "inventory.stock.read", action: "Check inventory", icon: Boxes, tone: "warm", scope: "Inventory" },
  { key: "pendingReturns", label: "Return requests", hint: "Requests waiting for your review", href: "/admin/returns", permission: "return.read", action: "Review returns", icon: ClipboardCheck, tone: "plum", scope: "Open work" }
];
const queueIcons = { INVENTORY: Boxes, ORDER: ShoppingBag, RETURN: ClipboardCheck, VENDOR: Store };
const queueCopy = {
  INVENTORY: ["Stock running low", "Check the affected variant and warehouse."],
  ORDER: ["Orders to fulfil", "Review payment, then reserve, pick and pack."],
  RETURN: ["Returns to review", "Check the item and requested resolution."],
  VENDOR: ["Vendors awaiting approval", "Review business details before activation."]
};

export function DashboardQuickView({ data, user, tenantId }) {
  const cards = cardDefinitions.filter(item => dashboardCanOpen(user, tenantId, item.href, item.permission));
  if (!cards.length) return null;
  return <section aria-labelledby="quick-view-title">
    <div className={styles.sectionHeading}><div><h2 id="quick-view-title">Quick view</h2><p>Your store at a glance.</p></div><span className={styles.scope}>Current snapshot</span></div>
    <div className={styles.cards}>{cards.map(card => {
      const Icon = card.icon;
      const value = dashboardCount(data?.metrics?.[card.key]);
      return <Link className={styles.metricCard} href={card.href} key={card.key} data-tone={card.tone}>
        <div className={styles.cardTop}><span className={styles.icon}><Icon size={21} aria-hidden="true" /></span><span>{card.scope}</span></div>
        <span className={styles.cardLabel}>{card.label}</span>
        <strong className={styles.value} data-unavailable={value === null || undefined}>{count(value)}</strong>
        <p>{value === null ? "This count is unavailable. Try refreshing." : card.hint}</p>
        <span className={styles.cardFoot}>{card.action}<ArrowUpRight size={16} aria-hidden="true" /></span>
      </Link>;
    })}</div>
  </section>;
}

export function DashboardPriorities({ data, user, tenantId }) {
  const { groups, records, attentionAreas, allClear } = dashboardWork(data, user, tenantId);
  const incomplete = groups.some(group => group.count === null);
  return <section className={styles.panel} data-panel="attention" aria-labelledby="priority-title">
    <header className={styles.panelHeading}><div><span className={styles.overline}>YOUR NEXT STEPS</span><h2 id="priority-title">Needs attention</h2><p>Start with these open tasks.</p></div>
      {attentionAreas > 0 && <span className={styles.reviewBadge}>{attentionAreas} {attentionAreas === 1 ? "area" : "areas"} to review</span>}
    </header>
    {allClear && <div className={styles.clear}><CheckCheck size={21} aria-hidden="true" /><span><strong>You're all caught up</strong><small>No pending work in the queues you can access.</small></span></div>}
    {!groups.length && <div className={styles.empty}><PackageCheck size={25} aria-hidden="true" /><strong>No task queues for your role</strong><p>Use the shortcuts for your available modules.</p></div>}
    {incomplete && <p className={styles.notice}>Some counts are unavailable. Open the module or refresh to check them.</p>}
    <ul className={styles.tasks}>{groups.map(group => {
      const Icon = queueIcons[group.type];
      const [title, description] = queueCopy[group.type];
      return <li key={group.type} data-tone={group.tone === "warning" ? "warm" : group.tone}>
        <span className={styles.taskIcon}><Icon size={20} aria-hidden="true" /></span>
        <div className={styles.taskCopy}><h3>{title}</h3><p>{description}</p>
          <span className={styles.taskState} data-clear={group.count === 0 || undefined}>{group.count === null ? "Count unavailable" : group.count === 0 ? "Nothing pending" : `${count(group.count)} to review`}</span>
        </div>
        <Link href={group.href} className={styles.taskAction}>{group.action}<ArrowRight size={15} aria-hidden="true" /></Link>
      </li>;
    })}</ul>
    {records.length > 0 && <details className={styles.records}>
      <summary>View priority items<span>{records.length} shown<ChevronRight size={16} aria-hidden="true" /></span></summary>
      <p>A preview of up to six items across your accessible queues. Open a module for the full list.</p>
      <ul>{records.map(record => <li key={record.key}><div><strong>{record.reference}</strong><p>{record.work}</p><small>{record.owner} · {dashboardAge(record.createdAt)}</small></div><Link href={record.destination.href} aria-label={`${record.destination.action} for ${record.reference}`}>Review<ArrowUpRight size={15} aria-hidden="true" /></Link></li>)}</ul>
    </details>}
  </section>;
}

const shortcuts = [
  { href: "/admin/catalog/products", permission: "catalog.product.read", title: "Manage products", description: "Details, prices and publication", icon: Tags, tone: "plum" },
  { href: "/admin/inventory", permission: "inventory.stock.read", title: "Manage inventory", description: "Stock and warehouse balances", icon: Boxes, tone: "teal" },
  { href: "/admin/orders", permission: "order.read", title: "Manage orders", description: "Customer orders and fulfilment", icon: ShoppingBag, tone: "warm" },
  { href: "/admin/vendors", permission: "vendor.read", title: "Manage vendors", description: "Seller details and approvals", icon: Store, tone: "green" }
];
export function DashboardShortcuts({ user, tenantId }) {
  const items = shortcuts.filter(item => dashboardCanOpen(user, tenantId, item.href, item.permission));
  return <aside className={styles.panel} data-panel="shortcuts" aria-labelledby="shortcuts-title">
    <header className={styles.panelHeading}><div><span className={styles.overline}>SHORTCUTS</span><h2 id="shortcuts-title">Quick actions</h2><p>Go straight to your everyday work.</p></div></header>
    {items.length ? <nav className={styles.shortcuts} aria-label="Dashboard quick actions">{items.map(item => {
      const Icon = item.icon;
      return <Link href={item.href} key={item.href} data-tone={item.tone}><span className={styles.taskIcon}><Icon size={20} aria-hidden="true" /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>;
    })}</nav> : <p className={styles.notice}>No shortcuts are available for your role. Use your permitted sidebar modules.</p>}
    <details className={styles.guide}><summary>How do I make a product available?<ChevronRight size={16} aria-hidden="true" /></summary>
      <ol><li><strong>Prepare your product</strong><span>Add details, images and variant prices.</span></li><li><strong>Receive the right stock</strong><span>Use the correct variant, seller and warehouse.</span></li><li><strong>Check publication</strong><span>A published product still needs available stock.</span></li></ol>
      <p>These are workflow steps, not an automatic readiness check.</p>
    </details>
  </aside>;
}

export function DashboardActivity({ events }) {
  return <section className={styles.panel} data-panel="activity" aria-labelledby="activity-title">
    <header className={styles.panelHeading}><div><span className={styles.overline}>AUDIT TRAIL</span><h2 id="activity-title">Recent activity</h2><p>Latest recorded changes · times in UTC.</p></div><History size={21} aria-hidden="true" className={styles.headingIcon} /></header>
    {events.length ? <ol className={styles.activity}>{events.map((event, index) => <li key={`${event.id || "event"}:${index}`}><span className={styles.activityDot} aria-hidden="true" /><div><strong>{event.title}</strong><p>{event.detail}</p></div><span className={styles.activityTime}><Clock3 size={13} aria-hidden="true" />{event.time}</span></li>)}</ol> : <div className={styles.empty}><History size={26} aria-hidden="true" /><strong>No recent activity</strong><p>Recorded changes will appear here as your team works.</p></div>}
    <p className={styles.footnote}>Activity records are separate from pending tasks above.</p>
  </section>;
}

export function DashboardSkeleton() {
  return <div className={styles.skeleton} role="status" aria-live="polite"><span className="sr-only">Loading your dashboard</span>
    <div className={styles.skeletonTitle} aria-hidden="true"><i className="skeleton-block" /><i className="skeleton-block" /></div>
    <div className={styles.cards} aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className={styles.skeletonCard} key={index}><i className="skeleton-block" /><b className="skeleton-block" /><i className="skeleton-block" /><i className="skeleton-block" /></div>)}</div>
    <div className={styles.workGrid} aria-hidden="true">{[0,1].map(index => <div className={styles.skeletonPanel} key={index}><b className="skeleton-block" />{[0,1,2,3].map(row => <i className="skeleton-block" key={row} />)}</div>)}</div>
  </div>;
}
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const fullCurrency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const numeric = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const statusTones = { New: "teal", Processing: "warm", Completed: "green", Cancelled: "danger", Draft: "neutral" };

export function DashboardSalesChart({ data }) {
  const [selected, setSelected] = useState(null);
  const gradientId = useId().replaceAll(":", "");
  const source = Array.isArray(data) ? data : [];
  const unavailable = !Array.isArray(data) || source.some(row => !row || !numeric(row.revenue) || Number(row.revenue) < 0);
  const rows = unavailable ? [] : source.map(row => ({ ...row, revenue: Number(row.revenue) }));
  const maximum = Math.max(1, ...rows.map(row => row.revenue));
  const selectedIndex = selected !== null && selected < rows.length ? selected : rows.length - 1;
  const active = rows[selectedIndex];
  const width = 600, height = 200, top = 8, bottom = 190, left = 10, right = 590;
  const points = rows.map((row, index) => ({ ...row,
    x: rows.length === 1 ? width / 2 : left + index * (right - left) / (rows.length - 1),
    y: bottom - row.revenue / maximum * (bottom - top) }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = points.length ? `${line} L${points.at(-1).x},${bottom} L${points[0].x},${bottom} Z` : "";
  const day = value => dashboardDate(value, { day: "numeric", month: "short" });
  return <section className={styles.panel} data-panel="order-value" aria-labelledby="sales-chart-title">
    <header className={styles.panelHeading}><div><h3 id="sales-chart-title">Order value</h3><p>Last seven days · UTC</p></div><span className={styles.chartTotal}><small>Seven-day total</small><strong>{unavailable ? "Unavailable" : currency.format(rows.reduce((sum, row) => sum + row.revenue, 0))}</strong></span></header>
    {active ? <>
      <div className={styles.readout}><strong>{currency.format(active.revenue)}</strong><span>{day(active.date)} · {count(dashboardCount(active.orders))} orders</span></div>
      <div className={styles.plot}>
        <div className={styles.plotLabels} aria-hidden="true">{[1,.5,0].map(fraction => <span key={fraction}>{currency.format(maximum * fraction)}</span>)}</div>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Daily order values" aria-describedby="sales-data-caption" onMouseLeave={() => setSelected(null)}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".2" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
          {[0,.5,1].map(level => <line key={level} className={styles.gridLine} x1={0} x2={width} y1={top + (bottom-top)*level} y2={top + (bottom-top)*level} />)}
          <path d={area} fill={`url(#${gradientId})`} /><path d={line} className={styles.trendLine} fill="none" />
          {points.map((point, index) => <g key={`${point.date}:${index}`} className={styles.chartPoint} data-active={selectedIndex === index || undefined}
            tabIndex={0} role="img" aria-label={`${day(point.date)}: ${fullCurrency.format(point.revenue)}, ${count(dashboardCount(point.orders))} orders`}
            onFocus={() => setSelected(index)} onBlur={() => setSelected(null)} onMouseEnter={() => setSelected(index)} onTouchStart={() => setSelected(index)}>
            <circle cx={point.x} cy={point.y} r={18} /><circle cx={point.x} cy={point.y} r={selectedIndex === index ? 5 : 3.5} />
          </g>)}
        </svg>
      </div>
      <div className={styles.axis} data-dense={rows.length > 4 || undefined} style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} aria-hidden="true">{rows.map((row,index) => <span key={`${row.date}:${index}`}>{day(row.date)}</span>)}</div>
      <table className="sr-only"><caption id="sales-data-caption">Daily order value and orders, reported in UTC</caption><thead><tr><th>Date</th><th>Order value</th><th>Orders</th></tr></thead><tbody>{rows.map((row,index) => <tr key={`${row.date}:${index}`}><td>{day(row.date)}</td><td>{fullCurrency.format(row.revenue)}</td><td>{count(dashboardCount(row.orders))}</td></tr>)}</tbody></table>
    </> : <div className={styles.empty}><ChartNoAxesCombined size={28} aria-hidden="true" /><strong>{unavailable ? "Order values are unavailable" : "No order trend yet"}</strong><p>{unavailable ? "Refresh the dashboard to try again." : "Daily values will appear here as orders are created."}</p></div>}
    <p className={styles.footnote}>Order value excludes drafts and cancelled orders. It is not collected payments.</p>
  </section>;
}

export function DashboardOrderChart({ data }) {
  const rows = Array.isArray(data) ? data : [];
  const unavailable = !Array.isArray(data) || rows.some(row => !row || dashboardCount(row.value) === null);
  const total = unavailable ? null : rows.reduce((sum, row) => sum + Number(row.value), 0);
  return <section className={styles.panel} data-panel="order-status" aria-labelledby="mix-chart-title">
    <header className={styles.panelHeading}><div><h3 id="mix-chart-title">Order status</h3><p>All current orders</p></div><span className={styles.chartTotal}><small>Total orders</small><strong>{count(total)}</strong></span></header>
    {total > 0 ? <ul className={styles.statusRows}>{rows.map((row,index) => <li key={`${row.label}:${index}`}><div><strong>{row.label}</strong><span><small>{Math.round(Number(row.value) / total * 100)}%</small><b>{count(Number(row.value))}</b></span></div><span className={styles.bar} aria-hidden="true"><i data-tone={statusTones[row.label] || "neutral"} style={{ transform: `scaleX(${Number(row.value) / total})` }} /></span></li>)}</ul> : <div className={styles.empty}><PackageCheck size={28} aria-hidden="true" /><strong>{unavailable ? "Order counts are unavailable" : "No orders yet"}</strong><p>{unavailable ? "Refresh the dashboard to try again." : "Order statuses will appear here when orders are created."}</p></div>}
  </section>;
}
