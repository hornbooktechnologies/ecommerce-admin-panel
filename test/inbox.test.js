import test from "node:test";
import assert from "node:assert/strict";
import { groupNavigation, notificationDestination, notificationTarget, notificationTime } from "../src/lib/inbox-navigation.js";
import { listInboxRequest, inboxUnreadRequest, markInboxRequest, markAllInboxRequest } from "../src/lib/api-client.js";

const tenantId = "018f47f2-6b6d-7c34-ae31-8f4f17b79b79";
const id = "018f47f2-6b6d-7c34-ae31-8f4f17b79b88";
test("grouping uses API metadata and preserves only granted items", () => {
  const items = [{ href: "/admin/catalog/products", group: { id: "products", label: "Products & stock", order: 1 } },
    { href: "/admin/orders", group: { id: "daily", label: "Daily operations", order: 0 } }];
  assert.deepEqual(groupNavigation(items).map(g => g.id), ["daily", "products"]);
  assert.equal(groupNavigation(items).flatMap(g => g.items).length, 2);
  assert.equal(groupNavigation([{ href: "/vendor" }])[0].id, "workspace");
  assert.deepEqual(groupNavigation([]), []);
});
test("notification destinations are allowlisted, granted and merchant scoped", () => {
  const scope = { area: "admin", tenantId, items: [{ href: "/admin/orders" }, { href: "/admin/returns" }] };
  const order = { target: { type: "ORDER", id } };
  assert.ok(notificationDestination(order, scope).startsWith(`/admin/orders?notificationTarget=${id}`));
  assert.equal(notificationDestination(order, { ...scope, items: [] }), null);
  assert.equal(notificationDestination({ target: { type: "https://evil.example", id } }, scope), null);
  assert.equal(notificationDestination({ target: { type: "ORDER", id: "../other" } }, scope), null);
  const vendor = { area: "vendor", tenantId, merchantId: tenantId, items: [{ href: "/vendor/orders" }] };
  assert.equal(notificationDestination({ target: { type: "SELLER_ORDER", id, merchantId: id } }, vendor), null);
  assert.ok(notificationDestination({ target: { type: "SELLER_ORDER", id, merchantId: tenantId } }, vendor));
});
test("deep links reject wrong workspaces and invalid identifiers", () => {
  const query = new URLSearchParams({ notificationTarget: id, notificationTenant: tenantId });
  assert.equal(notificationTarget(query, tenantId), id);
  assert.equal(notificationTarget(query, id), null);
  assert.equal(notificationTarget(query, tenantId, id), null);
  assert.equal(notificationTime("invalid"), "Date unavailable");
  assert.equal(notificationTime(null), "Date unavailable");
});
test("inbox API uses ten rows, scoped headers, abort signals and snapshot read-all", async context => {
  const original = globalThis.fetch, calls = [];
  context.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), ...options });
    return new Response(JSON.stringify({ data: { unreadCount: 2 } }), { status: 200 });
  };
  const controller = new AbortController();
  const scope = { accessToken: "fixture-token", tenantId, merchantId: id, signal: controller.signal };
  await listInboxRequest("admin", {}, scope);
  await inboxUnreadRequest("vendor", scope);
  await markInboxRequest("admin", id, false, scope);
  await markAllInboxRequest("admin", id, scope);
  assert.match(calls[0].url, /pageSize=10/);
  assert.equal(calls[0].headers["x-tenant-id"], tenantId);
  assert.equal(calls[1].headers["x-merchant-id"], id);
  assert.equal(calls[0].signal, controller.signal);
  assert.equal(calls[2].method, "PATCH"); assert.deepEqual(JSON.parse(calls[2].body), { read: false });
  assert.deepEqual(JSON.parse(calls[3].body), { throughId: id });
  assert.throws(() => inboxUnreadRequest("../other", scope));
  controller.abort();
  await assert.rejects(inboxUnreadRequest("admin", scope), { name: "AbortError" });
});
