// Existing cases must not depend on eligibility to create another return.
export function availableExchangeOffers(details) {
  const required = new Map((details?.items || []).map((item) => [item.orderItemId,
    Number(item.approvedQuantity ?? item.requestedQuantity)]));
  const seen = new Set();
  return (details?.replacementOffers || []).filter((offer) => {
    const quantity = required.get(offer.orderItemId);
    if (!(quantity > 0) || Number(offer.availableQuantity) < quantity || seen.has(offer.id)) return false;
    seen.add(offer.id);
    return true;
  });
}
