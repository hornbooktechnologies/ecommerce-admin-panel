import assert from "node:assert/strict";
import test from "node:test";
import { receiptQuantityAttributes } from "../src/lib/inventory-quantity.js";

test("stock receipt increments match the API's six-decimal precision", () => {
  assert.deepEqual(receiptQuantityAttributes(false), {
    min: "0.000001", step: "0.000001", inputMode: "decimal"
  });
  assert.deepEqual(receiptQuantityAttributes(undefined), receiptQuantityAttributes(false));
});

test("serialized receipts use positive whole-unit min and step", () => {
  assert.deepEqual(receiptQuantityAttributes(true), { min: "1", step: "1", inputMode: "numeric" });
});

test("whole quantities and six-decimal quantities are aligned to the receipt step base", () => {
  // Work in millionths to avoid introducing floating-point errors in the test.
  const { min, step } = receiptQuantityAttributes(false);
  for (const quantity of [1, 10, 0.5, 0.001, 0.000001, 2.125001]) {
    const units = Math.round(quantity * 1e6);
    assert.ok(units >= Math.round(Number(min) * 1e6));
    assert.equal((units - Math.round(Number(min) * 1e6)) % Math.round(Number(step) * 1e6), 0);
  }
});
