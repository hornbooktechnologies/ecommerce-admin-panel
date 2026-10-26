"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeIndianRupee, Boxes, CalendarClock, ChartNoAxesCombined, Download, FileSpreadsheet,
  IndianRupee, PackageSearch, RotateCcw, Scale, Store, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { tenantIdForUser } from "@/lib/auth-routing";
import { exportReportRequest, reportsWorkspaceRequest } from "@/lib/api-client";
import { formatDateValue } from "@/lib/date-format";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const reportTypes = [
  { id: "SALES", label: "Sales", icon: ChartNoAxesCombined, description: "Orders, refunds and net revenue" },
  { id: "INVENTORY", label: "Inventory", icon: Boxes, description: "Live stock health by warehouse" },
  { id: "EXPIRY", label: "Expiry", icon: CalendarClock, description: "Lot risk and expiring units" },
  { id: "VENDOR", label: "Vendors", icon: UsersRound, description: "Marketplace sales and payable" },
  { id: "GST_TCS", label: "GST TCS", icon: BadgeIndianRupee, description: "Marketplace tax collection" },
  { id: "GST_TDS", label: "Income Tax TDS", icon: Scale, description: "Vendor tax deduction" }
];
const statusTone = { COMPLETED: "positive", ACTIVE: "positive", HEALTHY: "positive", DEPOSITED: "positive",
  PAID: "positive", LOW: "warning", EXPIRING: "warning", ACCRUED: "warning", PENDING: "warning",
  OUT: "danger", EXPIRED: "danger", CANCELLED: "danger", SUSPENDED: "danger", INACTIVE: "neutral",
  PLACED: "info", CONFIRMED: "info", PROCESSING: "info" };
const titleCase = (value) => String(value || "—").toLowerCase().replaceAll("_", " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());
const localDate = (input) => { const current = new Date(input); current.setMinutes(current.getMinutes() - current.getTimezoneOffset()); return current.toISOString().slice(0, 10); };
const addDays = (amount) => { const current = new Date(); current.setDate(current.getDate() + amount); return localDate(current); };
const datesFor = (reportType) => reportType === "EXPIRY" ? { fromDate: addDays(0), toDate: addDays(30) }
  : { fromDate: addDays(-29), toDate: addDays(0) };
const state = (value) => <Status tone={statusTone[value] || "neutral"}>{titleCase(value)}</Status>;

const configs = {
  SALES: { title: "Sales report", chartTitle: "Net sales by day", unit: "revenue",
    metrics: [["Net sales", "netSales", "money", IndianRupee], ["Gross sales", "grossSales", "money", ChartNoAxesCombined],
      ["Orders", "orderCount", "number", FileSpreadsheet], ["Average order", "averageOrderValue", "money", BadgeIndianRupee]],
    columns: [["Order", (row) => <span><strong>{row.orderNumber}</strong><small>{formatDateValue(row.orderDate, dateTime)}</small></span>],
      ["Store", (row) => row.storeName], ["Units", (row) => number.format(row.units)], ["Status", (row) => state(row.status)],
      ["Payment", (row) => titleCase(row.paymentStatus)], ["Total", (row) => <strong>{money.format(row.grandTotal)}</strong>]] },
  INVENTORY: { title: "Inventory report", chartTitle: "Available units by warehouse", unit: "units",
    metrics: [["Available units", "available", "number", Boxes], ["On hand", "onHand", "number", PackageSearch],
      ["Reserved", "reserved", "number", Store], ["Low stock", "lowStock", "number", CalendarClock]],
    columns: [["Product", (row) => <span><strong>{row.productName}</strong><small>{row.variantName || row.sku}</small></span>],
      ["SKU", (row) => row.sku], ["Warehouse", (row) => row.warehouseName], ["On hand", (row) => number.format(row.onHand)],
      ["Available", (row) => <strong>{number.format(row.available)}</strong>], ["Health", (row) => state(row.health)]] },
  EXPIRY: { title: "Expiry report", chartTitle: "Units reaching expiry", unit: "units",
    metrics: [["Affected units", "affectedUnits", "number", Boxes], ["Lots in period", "lotCount", "number", FileSpreadsheet],
      ["Expiring in 30 days", "expiringLots", "number", CalendarClock], ["Already expired", "expiredLots", "number", PackageSearch]],
    columns: [["Product", (row) => <span><strong>{row.productName}</strong><small>{row.sku}</small></span>],
      ["Lot", (row) => <span><strong>{row.lotNumber}</strong><small>{row.supplierLotNumber || "No supplier lot"}</small></span>],
      ["Warehouse", (row) => row.warehouseName], ["Expiry", (row) => formatDateValue(row.expiresAt, date, { dateOnly: true })],
      ["On hand", (row) => number.format(row.onHand)], ["Health", (row) => <Status tone={statusTone[row.health]}>{row.health === "EXPIRED" ? `${Math.abs(row.daysRemaining)} days overdue` : `${row.daysRemaining} days`}</Status>]] },
  VENDOR: { title: "Vendor report", chartTitle: "Gross sales by vendor", unit: "sales",
    metrics: [["Gross sales", "grossSales", "money", IndianRupee], ["Vendor payable", "payable", "money", BadgeIndianRupee],
      ["Commission", "commission", "money", Scale], ["Active vendors", "vendorCount", "number", UsersRound]],
    columns: [["Vendor", (row) => <span><strong>{row.merchantName}</strong><small>{row.merchantCode}</small></span>],
      ["Orders", (row) => number.format(row.orderCount)], ["Completed", (row) => number.format(row.completedOrders)],
      ["Gross sales", (row) => money.format(row.grossSales)], ["Commission", (row) => money.format(row.commission)],
      ["Payable", (row) => <strong>{money.format(row.payable)}</strong>]] }
};
const withholdingColumns = (label) => [["Vendor", (row) => <span><strong>{row.merchantName}</strong><small>{row.merchantCode}</small></span>],
  ["Seller order", (row) => row.sellerOrderNumber || "—"], ["Section", (row) => row.taxSection || "—"],
  ["Taxable base", (row) => money.format(row.taxableBase)], ["Rate", (row) => `${number.format(row.rate)}%`],
  [label, (row) => <strong>{money.format(row.amount)}</strong>], ["Status", (row) => state(row.status)]];
configs.GST_TCS = { title: "GST TCS report", chartTitle: "TCS by filing period", unit: "TCS",
  metrics: [["TCS accrued", "amount", "money", BadgeIndianRupee], ["Taxable base", "taxableBase", "money", IndianRupee],
    ["Deposited", "depositedAmount", "money", FileSpreadsheet], ["Pending deposit", "pendingAmount", "money", CalendarClock]],
  columns: withholdingColumns("TCS") };
configs.GST_TDS = { title: "Income Tax TDS report", chartTitle: "TDS by filing period", unit: "TDS",
  metrics: [["TDS accrued", "amount", "money", Scale], ["Taxable base", "taxableBase", "money", IndianRupee],
    ["Deposited", "depositedAmount", "money", FileSpreadsheet], ["Pending deposit", "pendingAmount", "money", CalendarClock]],
  columns: withholdingColumns("TDS") };

function ReportSkeleton() { return <div aria-label="Loading report" className="reports-skeleton" role="status"><div>{[1, 2, 3, 4].map((item) => <i key={item} />)}</div><section><span />{[1, 2, 3, 4].map((item) => <b key={item} />)}</section></div>; }
function MetricBand({ config, summary }) { return <section aria-label={`${config.title} summary`} className="report-metrics">{config.metrics.map(([label, key, format, Icon]) => <article key={key}><span aria-hidden="true"><Icon size={18} /></span><div><small>{label}</small><strong>{format === "money" ? money.format(summary?.[key] || 0) : number.format(summary?.[key] || 0)}</strong></div></article>)}</section>; }
function ReportChart({ config, trend }) {
  const visible = trend.slice(-12); const max = Math.max(1, ...visible.map((item) => item.value));
  const compactMoney = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
  return <section aria-labelledby="report-chart-title" className="report-chart-panel"><header><div><p className="eyebrow">Period movement</p><h2 id="report-chart-title">{config.chartTitle}</h2></div><span>{visible.length} data points</span></header>
    {visible.length ? <div className="report-chart" role="img" aria-label={config.chartTitle}>{visible.map((item) => <div className="report-chart-column" key={item.period}><span className="report-chart-value">{config.unit === "units" ? number.format(item.value) : compactMoney.format(item.value)}</span><div aria-hidden="true"><i style={{ transform: `scaleY(${Math.max(.035, item.value / max)})` }} /></div><small title={item.period}>{item.period}</small><em>{number.format(item.secondaryValue)} records</em></div>)}</div>
      : <div className="report-empty-chart"><ChartNoAxesCombined aria-hidden="true" size={25} /><strong>No movement in this period</strong><span>Adjust the date or scope filters to review another period.</span></div>}
    <table className="sr-only"><caption>{config.chartTitle}</caption><thead><tr><th>Period</th><th>Value</th><th>Records</th></tr></thead><tbody>{visible.map((item) => <tr key={item.period}><td>{item.period}</td><td>{item.value}</td><td>{item.secondaryValue}</td></tr>)}</tbody></table></section>;
}
function ReportTable({ config, result }) { return <section aria-labelledby="report-table-title" className="tenant-directory report-table-panel"><header><div><p className="eyebrow">Detailed records</p><h2 id="report-table-title">{config.title}</h2></div><span>{result.total.toLocaleString("en-IN")} rows</span></header>{result.rows.length ? <div className="table-wrap report-table-wrap"><table className="tenant-table report-table"><thead><tr>{config.columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.rows.map((row) => <tr key={row.id}>{config.columns.map(([label, render]) => <td data-label={label} key={label}>{render(row)}</td>)}</tr>)}</tbody></table></div> : <div className="empty-workspace report-empty"><FileSpreadsheet aria-hidden="true" size={30} /><h3>No records found</h3><p>This report has no data for the selected period and scope.</p></div>}</section>; }

export default function ReportsPage() {
  const { accessToken, activeTenantId, user } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [filters, setFilters] = useState({ reportType: "SALES", ...datesFor("SALES"), warehouseId: "", merchantId: "", page: 1, pageSize: 10 });
  const [result, setResult] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [exporting, setExporting] = useState(false);
  const config = configs[filters.reportType];
  const load = useCallback(async () => { if (!accessToken || !tenantId) return; setLoading(true); setError("");
    try { setResult(await reportsWorkspaceRequest(filters, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "The report could not be loaded."); }
    finally { setLoading(false); } }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); }, [load]);
  const update = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  const switchReport = (reportType) => setFilters((current) => ({ ...current, reportType, ...datesFor(reportType), warehouseId: "", merchantId: "", page: 1 }));
  const showWarehouse = ["INVENTORY", "EXPIRY"].includes(filters.reportType); const dateFiltersApply = filters.reportType !== "INVENTORY";
  const reportName = useMemo(() => reportTypes.find((item) => item.id === filters.reportType)?.label || "Report", [filters.reportType]);
  async function download() { setExporting(true); setError(""); try { const file = await exportReportRequest(filters, accessToken, tenantId); const href = URL.createObjectURL(file.blob); const link = document.createElement("a"); link.href = href; link.download = file.filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(href); } catch (requestError) { setError(requestError.message || "The CSV export could not be generated."); } finally { setExporting(false); } }
  const action = <button className="button button-primary report-export" disabled={exporting || !result} onClick={download} type="button"><Download aria-hidden="true" size={17} />{exporting ? "Preparing…" : "Export CSV"}</button>;
  return <AppShell action={action} area="admin" currentPath="/admin/reports" description="Review sales, stock, expiry, vendor and India tax performance from tenant-scoped operational data." eyebrow="Analytics & compliance" title="Reports">
    <nav aria-label="Report selection" className="report-switcher">{reportTypes.map(({ id, label, description, icon: Icon }) => <button aria-current={filters.reportType === id ? "page" : undefined} data-active={filters.reportType === id || undefined} key={id} onClick={() => switchReport(id)} type="button"><span><Icon aria-hidden="true" size={17} /></span><span><strong>{label}</strong><small>{description}</small></span></button>)}</nav>
    <section aria-labelledby="report-filters-title" className="report-filter-panel"><div><p className="eyebrow">Report scope</p><h2 id="report-filters-title">{reportName} filters</h2></div><form onSubmit={(event) => { event.preventDefault(); load(); }}>{dateFiltersApply ? <><label><span>From</span><input max={filters.toDate} onChange={(event) => update("fromDate", event.target.value)} type="date" value={filters.fromDate} /></label><label><span>To</span><input min={filters.fromDate} onChange={(event) => update("toDate", event.target.value)} type="date" value={filters.toDate} /></label></> : <div className="report-live-scope"><span aria-hidden="true" /><div><strong>Live inventory snapshot</strong><small>Current ledger position</small></div></div>}{showWarehouse ? <label><span>Warehouse</span><select onChange={(event) => update("warehouseId", event.target.value)} value={filters.warehouseId}><option value="">All warehouses</option>{(result?.options?.warehouses || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}<label><span>Vendor</span><select onChange={(event) => update("merchantId", event.target.value)} value={filters.merchantId}><option value="">All vendors</option>{(result?.options?.merchants || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="button button-secondary" disabled={loading} type="submit">{loading ? "Refreshing…" : "Apply filters"}</button></form></section>
    {error ? <section className="dashboard-error report-error" role="alert"><span><RotateCcw aria-hidden="true" size={21} /></span><div><strong>Report unavailable</strong><p>{error}</p></div><button className="button button-secondary" onClick={load} type="button">Try again</button></section> : null}
    {loading && !result ? <ReportSkeleton /> : result ? <div className="report-content" data-refreshing={loading || undefined}><MetricBand config={config} summary={result.summary} /><ReportChart config={config} trend={result.trend || []} /><ReportTable config={config} result={result} /><TablePagination itemLabel="report records" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></div> : null}
  </AppShell>;
}
