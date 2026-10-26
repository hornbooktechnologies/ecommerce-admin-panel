import assert from "node:assert/strict";
import test from "node:test";
import { formatDateValue, toValidDate } from "../src/lib/date-format.js";

const formatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

test("date-only report values are normalized without changing the calendar day", () => {
  assert.equal(formatDateValue("2026-10-22", formatter, { dateOnly: true }), "22 Oct 2026");
});

test("full ISO timestamps are accepted without appending another time", () => {
  assert.ok(toValidDate("2026-10-22T00:00:00.000Z", { dateOnly: true }));
  assert.notEqual(formatDateValue("2026-10-22T00:00:00.000Z", formatter, { dateOnly: true }), "Not available");
});

test("missing and malformed report dates render a stable fallback", () => {
  assert.equal(formatDateValue(null, formatter, { dateOnly: true }), "Not available");
  assert.equal(formatDateValue("not-a-date", formatter, { dateOnly: true }), "Not available");
});
