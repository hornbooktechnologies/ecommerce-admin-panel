const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function groupNavigation(items) {
  const groups = new Map();
  for (const item of items) {
    const group = item.group || { id: "workspace", label: "Workspace", order: 0 };
    if (!groups.has(group.id)) groups.set(group.id, { ...group, items: [] });
    groups.get(group.id).items.push(item);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order);
}

export function notificationDestination(notification, { area, tenantId, merchantId, items }) {
  const target = notification?.target;
  if (!uuid.test(target?.id || "")) return null;
  if (area === "platform") {
    return target.type === "TENANT" && items.some(item => item.href === "/platform/tenants")
      ? `/platform/tenants/${target.id}` : null;
  }
  if (!uuid.test(tenantId || "")) return null;
  const path = area === "admin" ? { ORDER: "/admin/orders", RETURN: "/admin/returns", INVENTORY_BALANCE: "/admin/inventory", WARRANTY_CLAIM: "/admin/warranties", BULK_IMPORT: "/admin/bulk-operations", PRODUCT_APPROVAL: "/admin/catalog/products", VENDOR_APPROVAL: "/admin/vendors" }[target.type]
    : area === "vendor" && target.type === "SELLER_ORDER" && target.merchantId === merchantId ? "/vendor/orders" : null;
  if (!path || !items.some(item => item.href === path)) return null;
  // These modules open their existing listing, not an unsupported record-detail modal.
  if (["INVENTORY_BALANCE", "WARRANTY_CLAIM", "BULK_IMPORT", "PRODUCT_APPROVAL", "VENDOR_APPROVAL"].includes(target.type)) return path;
  const query = new URLSearchParams({ notificationTarget: target.id, notificationTenant: tenantId });
  if (area === "vendor") query.set("notificationMerchant", merchantId);
  return `${path}?${query}`;
}

export function notificationTarget(params, tenantId, merchantId) {
  const target = params.get("notificationTarget");
  if (!uuid.test(target || "") || params.get("notificationTenant") !== tenantId) return null;
  if (merchantId && params.get("notificationMerchant") !== merchantId) return null;
  return target;
}

export function notificationTime(value) {
  const time = new Date(value);
  return value && Number.isFinite(time.getTime())
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(time)
    : "Date unavailable";
}
