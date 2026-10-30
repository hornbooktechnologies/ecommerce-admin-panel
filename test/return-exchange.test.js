import test from "node:test";
import assert from "node:assert/strict";
import { availableExchangeOffers } from "../src/lib/return-exchange.js";

test("existing exchange uses case options without new-return eligibility", () => {
  const offer = { id: "replacement", orderItemId: "original", availableQuantity: 2 };
  assert.deepEqual(availableExchangeOffers({ items: [{ orderItemId: "original", approvedQuantity: 2 }],
    replacementOffers: [offer] }), [offer]);
});

test("exchange excludes insufficient stock, unrelated items and duplicate offers", () => {
  const valid = { id: "ready", orderItemId: "original", availableQuantity: "2" };
  assert.deepEqual(availableExchangeOffers({ items: [{ orderItemId: "original", approvedQuantity: 2 }],
    replacementOffers: [{ ...valid, id: "short", availableQuantity: 1 },
      { ...valid, id: "unrelated", orderItemId: "other" }, valid, valid] }), [valid]);
});

test("missing options and zero approved quantities do not enable reservation", () => {
  assert.deepEqual(availableExchangeOffers(null), []);
  assert.deepEqual(availableExchangeOffers({ items: [{ orderItemId: "original", approvedQuantity: 0,
    requestedQuantity: 1 }], replacementOffers: [{ id: "replacement", orderItemId: "original",
    availableQuantity: 2 }] }), []);
});
