import assert from "node:assert/strict";
import test from "node:test";
import { navigationForUser } from "../src/lib/auth-routing.js";

const tenantId = "018f47f2-6b6d-7c34-ae31-8f4f17b79b79";
const user = { ui: { navigation: {
  platform: [{ label: "Overview", href: "/platform" }],
  admin: { [tenantId]: [{ label: "Catalog", href: "/admin/catalog/products" }] },
  vendor: {}
} } };

test("navigation is read from the authenticated API response", () => {
  assert.deepEqual(navigationForUser(user, "platform"), [{ label: "Overview", href: "/platform" }]);
  assert.deepEqual(navigationForUser(user, "admin", tenantId), [
    { label: "Catalog", href: "/admin/catalog/products" }
  ]);
  assert.deepEqual(navigationForUser(user, "vendor", tenantId), []);
});
