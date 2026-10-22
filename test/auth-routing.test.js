import assert from "node:assert/strict";
import test from "node:test";
import { canAccessArea, canUser, homeForUser } from "../src/lib/auth-routing.js";

test("users land in the workspace selected by their authenticated role", () => {
  assert.equal(homeForUser({ defaultArea: "platform", areas: ["platform"] }), "/platform");
  assert.equal(homeForUser({ defaultArea: "vendor", areas: ["vendor"] }), "/vendor");
  assert.equal(homeForUser({ defaultArea: "admin", areas: ["admin"] }), "/admin");
});

test("workspace access is denied when the authenticated area is absent", () => {
  const user = { areas: ["vendor"] };
  assert.equal(canAccessArea(user, "vendor"), true);
  assert.equal(canAccessArea(user, "admin"), false);
  assert.equal(canAccessArea(null, "vendor"), false);
});

test("API capabilities are authoritative for UI actions", () => {
  const tenantId = "018f47f2-6b6d-7c34-ae31-8f4f17b79b79";
  const user = { ui: { capabilities: { admin: { [tenantId]: ["catalog.product.read"] } } } };
  assert.equal(canUser(user, "admin", "catalog.product.read", tenantId), true);
  assert.equal(canUser(user, "admin", "catalog.product.update", tenantId), false);
});
