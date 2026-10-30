import { canUser, navigationForUser } from "./auth-routing.js";

const workTypes = [
  { type: "INVENTORY", metric: "lowStock", title: "Stock checks", action: "Check inventory", href: "/admin/inventory", permission: "inventory.stock.read", tone: "warning", description: "Review balances at or below their reorder level. Check the exact variant, seller and warehouse." },
  { type: "ORDER", metric: "awaitingFulfillment", title: "Orders awaiting fulfilment", action: "Open orders", href: "/admin/orders", permission: "order.read", tone: "teal", description: "Review payment status, then reserve, pick and pack stock. An order is not proof of payment." },
  { type: "RETURN", metric: "pendingReturns", title: "Return requests", action: "Review returns", href: "/admin/returns", permission: "return.read", tone: "plum", description: "Check eligibility, item condition and replacement availability before approving a request." },
  { type: "VENDOR", metric: "pendingVendors", title: "Vendor approvals", action: "Review vendors", href: "/admin/vendors", permission: "vendor.read", tone: "warm", description: "Review pending marketplace vendors and their business details before activation." }
];

export function dashboardCanOpen(user, tenantId, href, permission) {
  return Boolean(tenantId && canUser(user, "admin", permission, tenantId)
    && navigationForUser(user, "admin", tenantId).some(item => item.href === href));
}

export function dashboardWork(data, user, tenantId) {
  const groups = workTypes.filter(item => dashboardCanOpen(user, tenantId, item.href, item.permission))
    .map(item => ({ ...item, count: dashboardCount(data?.metrics?.[item.metric]) }))
    .sort((a, b) => Number(b.count > 0) - Number(a.count > 0));
  const permitted = new Map(groups.map(item => [item.type, item]));
  const records = (Array.isArray(data?.queue) ? data.queue : []).filter(item => permitted.has(item.type))
    .map((item, index) => ({ ...item, key: `${item.type}:${item.id || item.reference}:${index}`, destination: permitted.get(item.type) }));
  return { groups, records, attentionAreas: groups.filter(item => item.count > 0).length,
    allClear: groups.length > 0 && groups.every(item => item.count === 0) };
}

export function dashboardCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function dashboardAge(value, now = Date.now()) {
  const timestamp = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return "Date unavailable";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export function dashboardDate(value, options = { weekday: "short", day: "numeric" }) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(date) : "Date unavailable";
}
