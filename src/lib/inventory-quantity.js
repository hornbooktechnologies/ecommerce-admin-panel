// Match receiveStockSchema (six decimal places) and serialized whole-unit rules.
// HTML steps are based on min, so both must use the same increment.
export function receiptQuantityAttributes(serialTrackingEnabled) {
  const increment = serialTrackingEnabled ? "1" : "0.000001";
  return { min: increment, step: increment,
    inputMode: serialTrackingEnabled ? "numeric" : "decimal" };
}
