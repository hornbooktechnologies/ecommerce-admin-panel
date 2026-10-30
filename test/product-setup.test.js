import test from "node:test";
import assert from "node:assert/strict";
import { productSetupProblems, productSetupSteps } from "../src/lib/product-setup.js";

const form = { productCode: "COTTON-01", name: "Cotton trouser", vertical: "CLOTHING", countryOfOrigin: "IN", customFields: [] };
const row = { key: "blue:m", name: "Blue / M", sku: "COTTON-BLUE-M", listPrice: "1500", salePrice: "1200", costPrice: "" };
const allowed = [{ vertical: "CLOTHING" }];
test("five guided steps keep valid drafts and optional imagery/stock separate", () => {
  assert.equal(productSetupSteps.length, 5);
  assert.deepEqual(productSetupProblems(form, [row], allowed), []);
  assert.deepEqual(productSetupProblems({ ...form, productKind: "BUNDLE" }, [row], allowed), []);
});
test("validate tenant types, trimmed names, product codes and country", () => {
  const result = productSetupProblems({ ...form, vertical: "GENERAL", productCode: "bad code", name: " ", countryOfOrigin: "IND" }, [row], allowed);
  assert.deepEqual(result.map(item => item.field), ["vertical", "productCode", "name", "countryOfOrigin"]);
  assert.ok(result.every(item => item.step === 0));
});
test("prices are required, finite, positive and never above MRP", () => {
  for (const salePrice of ["", "0", "-1", "Infinity", "NaN", "1501"]) {
    assert.ok(productSetupProblems(form, [{ ...row, salePrice }], allowed).some(item => item.field.endsWith(":salePrice")));
  }
  assert.ok(productSetupProblems(form, [{ ...row, costPrice: "-1" }], allowed).some(item => item.field.endsWith(":costPrice")));
});
test("SKUs and custom field names are unique after normalisation", () => {
  assert.ok(productSetupProblems(form, [row, { ...row, key: "blue:l", sku: " cotton-blue-m " }], allowed).some(item => item.message.includes("unique SKU")));
  assert.ok(productSetupProblems({ ...form, customFields: [{ label: "Care" }, { label: " care " }] }, [row], allowed).some(item => item.field === "customFields"));
});
test("grocery validates weight step and bounds without affecting other types", () => {
  const grocery = { ...form, vertical: "GROCERY", soldByWeight: true, weightStep: "", minimumWeight: "2", maximumWeight: "1" };
  assert.deepEqual(productSetupProblems(grocery, [row], [{ vertical: "GROCERY" }]).map(item => item.field), ["weightStep", "maximumWeight"]);
  assert.deepEqual(productSetupProblems({ ...grocery, weightStep: "0.1", maximumWeight: "3" }, [row], [{ vertical: "GROCERY" }]), []);
});
