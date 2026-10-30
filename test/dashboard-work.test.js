import test from "node:test";
import assert from "node:assert/strict";
import { dashboardWork, dashboardCount, dashboardDate, dashboardAge, dashboardCanOpen } from "../src/lib/dashboard-work.js";

const tenantId = "tenant-a";
const permissions = ["order.read", "inventory.stock.read", "return.read", "vendor.read"];
const paths = ["/admin/orders", "/admin/inventory", "/admin/returns", "/admin/vendors"];
const user = { ui: { capabilities: { admin: { [tenantId]: permissions } }, navigation: { admin: { [tenantId]: paths.map(href => ({ href })) } } } };
const metrics = { lowStock: 3, awaitingFulfillment: 28, pendingReturns: 2, pendingVendors: 0 };
test("priority counts use full metrics, never the six-record preview", () => {
  const result = dashboardWork({ metrics, queue: [{ type: "ORDER", reference: "ORD-1" }] }, user, tenantId);
  assert.deepEqual(result.groups.map(g => g.count), [3, 28, 2, 0]);
  assert.equal(result.attentionAreas, 3);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].destination.href, "/admin/orders");
  assert.equal(result.allClear, false);
});
test("queue visibility requires both capability and implemented navigation for this tenant", () => {
  const limited = { ui: { capabilities: { admin: { [tenantId]: ["order.read", "vendor.read"] } }, navigation: { admin: { [tenantId]: [{ href: "/admin/orders" }, { href: "/admin/inventory" }] } } } };
  const result = dashboardWork({ metrics, queue: [{ type: "ORDER" }, { type: "INVENTORY" }, { type: "VENDOR" }, { type: "UNRECOGNISED" }] }, limited, tenantId);
  assert.deepEqual(result.groups.map(g => g.type), ["ORDER"]);
  assert.equal(result.records.length, 1);
  assert.equal(dashboardWork({ metrics }, user, "tenant-b").groups.length, 0);
  assert.equal(dashboardWork({ metrics }, user, null).groups.length, 0);
  assert.equal(dashboardCanOpen(user, tenantId, "https://example.com", "order.read"), false);
});
test("unknown counts and unavailable queues never imply all clear", () => {
  assert.equal(dashboardWork({}, user, tenantId).allClear, false);
  assert.equal(dashboardWork({}, {}, tenantId).allClear, false);
  const clear = { lowStock: 0, awaitingFulfillment: 0, pendingReturns: 0, pendingVendors: 0 };
  assert.equal(dashboardWork({ metrics: clear }, user, tenantId).allClear, true);
  assert.equal(dashboardWork({ metrics: { ...clear, lowStock: null } }, user, tenantId).allClear, false);
  for (const value of [null, undefined, "", -1, 1.5, NaN, Infinity, "broken"]) assert.equal(dashboardCount(value), null);
  assert.equal(dashboardCount("28"), 28);
});
test("nonempty work sorts ahead of clear queues, without changing priority among pending types", () => {
  const result = dashboardWork({ metrics: { ...metrics, lowStock: 0, pendingVendors: 4 } }, user, tenantId);
  assert.deepEqual(result.groups.map(g => g.type), ["ORDER", "RETURN", "VENDOR", "INVENTORY"]);
});
test("dates accept date-only and ISO strings safely and ages clamp clock skew", () => {
  assert.equal(dashboardDate("2026-10-29"), dashboardDate("2026-10-29T12:00:00.000Z"));
  for (const value of [null, "", "invalid"]) {
    assert.equal(dashboardDate(value), "Date unavailable");
    assert.equal(dashboardAge(value), "Date unavailable");
  }
  const now = Date.parse("2026-10-29T12:00:00Z");
  assert.equal(dashboardAge("2026-10-29T13:00:00Z", now), "Just now");
  assert.equal(dashboardAge("2026-10-29T11:00:00Z", now), "1h ago");
});
