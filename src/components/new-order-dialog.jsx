"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, MapPin, Minus, PackageSearch, Plus,
  Search, ShoppingBag, Store, TicketPercent, Trash2, UserRound, X
} from "lucide-react";
import { GlobalLoader } from "@/components/global-loader";
import { createOrderRequest, orderCreationOptionsRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
});
const slotTime = new Intl.DateTimeFormat("en-IN", {
  weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"
});
const steps = ["Customer", "Products", "Review"];
const states = [
  ["AN", "Andaman and Nicobar Islands"], ["AP", "Andhra Pradesh"], ["AR", "Arunachal Pradesh"],
  ["AS", "Assam"], ["BR", "Bihar"], ["CH", "Chandigarh"], ["CG", "Chhattisgarh"],
  ["DN", "Dadra and Nagar Haveli and Daman and Diu"], ["DL", "Delhi"], ["GA", "Goa"],
  ["GJ", "Gujarat"], ["HR", "Haryana"], ["HP", "Himachal Pradesh"], ["JK", "Jammu and Kashmir"],
  ["JH", "Jharkhand"], ["KA", "Karnataka"], ["KL", "Kerala"], ["LA", "Ladakh"],
  ["LD", "Lakshadweep"], ["MP", "Madhya Pradesh"], ["MH", "Maharashtra"], ["MN", "Manipur"],
  ["ML", "Meghalaya"], ["MZ", "Mizoram"], ["NL", "Nagaland"], ["OD", "Odisha"],
  ["PY", "Puducherry"], ["PB", "Punjab"], ["RJ", "Rajasthan"], ["SK", "Sikkim"],
  ["TN", "Tamil Nadu"], ["TS", "Telangana"], ["TR", "Tripura"], ["UP", "Uttar Pradesh"],
  ["UK", "Uttarakhand"], ["WB", "West Bengal"]
];

const initialForm = {
  storeId: "", firstName: "", lastName: "", email: "", phone: "",
  line1: "", line2: "", landmark: "", city: "", stateCode: "", postalCode: "",
  deliverySlotId: "", promotionId: "", couponCode: "", customerNotes: "", internalNotes: ""
};

function quantityLabel(offer, quantity) {
  return offer.soldByWeight ? `${quantity} kg` : `${quantity} unit${Number(quantity) === 1 ? "" : "s"}`;
}

function includedTax(offer, quantity) {
  if (!offer.taxConfigured) return 0;
  const gross = offer.salePrice * Number(quantity || 0);
  const fixedCess = (offer.cessAmount || 0) * Number(quantity || 0);
  const percentage = (offer.gstRate || 0) + (offer.cessRate || 0);
  return gross - Math.max(0, gross - fixedCess) / (1 + percentage / 100);
}

export function NewOrderDialog({ accessToken, onClose, onCreated, tenantId }) {
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [items, setItems] = useState([]);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await orderCreationOptionsRequest(accessToken, tenantId);
        if (!active) return;
        setOptions(result);
        setForm((current) => ({ ...current, storeId: result.stores[0]?.id || "" }));
      } catch (requestError) {
        if (active) setError(requestError.message || "Order options could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [accessToken, tenantId]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  const offers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (options?.offers || []).filter((offer) => offer.storeId === form.storeId
      && (!query || [offer.productName, offer.variantName, offer.sku, offer.merchantName]
        .some((value) => value?.toLowerCase().includes(query))));
  }, [form.storeId, options, search]);
  const selected = useMemo(() => items.map((item) => ({
    ...item, offer: options?.offers.find((offer) => offer.id === item.offerId)
  })).filter((item) => item.offer), [items, options]);
  const validSlots = useMemo(() => (options?.deliverySlots || []).filter((slot) =>
    slot.storeId === form.storeId && (!slot.postalCodes.length || !form.postalCode
      || slot.postalCodes.includes(form.postalCode))), [form.postalCode, form.storeId, options]);
  const promotions = useMemo(() => (options?.promotions || []).filter((promotion) =>
    !promotion.storeId || promotion.storeId === form.storeId), [form.storeId, options]);
  const totals = useMemo(() => {
    const list = selected.reduce((sum, item) => sum + item.offer.listPrice * Number(item.quantity || 0), 0);
    const selling = selected.reduce((sum, item) => sum + item.offer.salePrice * Number(item.quantity || 0), 0);
    const tax = selected.reduce((sum, item) => sum + includedTax(item.offer, item.quantity), 0);
    const shipping = validSlots.find((slot) => slot.id === form.deliverySlotId)?.deliveryFee || 0;
    const promotion = promotions.find((item) => item.id === form.promotionId);
    let promotionDiscount = 0;
    if (promotion && selling >= promotion.minimumOrderAmount) {
      if (promotion.type === "PERCENTAGE") promotionDiscount = selling * promotion.discountValue / 100;
      if (promotion.maxDiscountAmount) promotionDiscount = Math.min(promotionDiscount, promotion.maxDiscountAmount);
      if (promotion.type === "FIXED_AMOUNT") promotionDiscount = Math.min(selling, promotion.discountValue);
      if (promotion.type === "FREE_SHIPPING") promotionDiscount = shipping;
    }
    return { list, discount: list - selling + promotionDiscount, baseDiscount: list - selling,
      promotionDiscount, tax, shipping, grand: selling + shipping - promotionDiscount };
  }, [form.deliverySlotId, form.promotionId, promotions, selected, validSlots]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeStore(storeId) {
    setForm((current) => ({ ...current, storeId, deliverySlotId: "", promotionId: "", couponCode: "" }));
    setItems([]);
  }

  function addOffer(offer) {
    setItems((current) => current.some((item) => item.offerId === offer.id) ? current : [...current, {
      offerId: offer.id, quantity: String(offer.minimumOrderQuantity), substitutionPreference: "CONTACT_ME"
    }]);
  }

  function updateItem(offerId, patch) {
    setItems((current) => current.map((item) => item.offerId === offerId ? { ...item, ...patch } : item));
  }

  function removeItem(offerId) {
    setItems((current) => current.filter((item) => item.offerId !== offerId));
  }

  function stepError() {
    if (step === 0) {
      if (!form.storeId) return "Select a store.";
      if (!form.firstName.trim()) return "Enter the customer's first name.";
      if (!form.email.trim() && !form.phone.trim()) return "Enter a customer email address or phone number.";
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return "Enter a valid email address.";
      if (form.line1.trim().length < 3 || !form.city.trim() || !form.stateCode) return "Complete the shipping address.";
      if (!/^\d{6}$/.test(form.postalCode)) return "Enter a valid 6-digit PIN code.";
    }
    if (step === 1) {
      if (!selected.length) return "Add at least one product to the order.";
      const invalid = selected.find(({ offer, quantity }) => {
        const amount = Number(quantity);
        const offset = (amount - offer.minimumOrderQuantity) / offer.quantityStep;
        return !Number.isFinite(amount) || amount < offer.minimumOrderQuantity
          || (offer.maximumOrderQuantity !== null && amount > offer.maximumOrderQuantity)
          || Math.abs(offset - Math.round(offset)) > 0.000001;
      });
      if (invalid) return `Check the quantity for ${invalid.offer.productName}.`;
    }
    return "";
  }

  function goNext() {
    const message = stepError();
    if (message) return setError(message);
    setError("");
    setStep((current) => Math.min(2, current + 1));
  }

  async function submit() {
    const selectedPromotion = promotions.find((promotion) => promotion.id === form.promotionId);
    if (selectedPromotion?.couponRequired && !form.couponCode.trim()) {
      setError("Enter a coupon code for the selected offer."); return;
    }
    setSaving(true); setError("");
    const state = states.find(([code]) => code === form.stateCode);
    try {
      const created = await createOrderRequest({
        storeId: form.storeId,
        customer: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone },
        shippingAddress: {
          line1: form.line1, line2: form.line2, landmark: form.landmark, city: form.city,
          stateCode: form.stateCode, stateName: state?.[1] || form.stateCode, postalCode: form.postalCode
        },
        deliverySlotId: form.deliverySlotId || null,
        promotionId: form.promotionId || null, couponCode: form.couponCode,
        items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })),
        customerNotes: form.customerNotes, internalNotes: form.internalNotes
      }, accessToken, tenantId);
      onCreated(created.order.id);
    } catch (requestError) {
      setError(requestError.details?.[0]?.message || requestError.message || "The order could not be created.");
    } finally { setSaving(false); }
  }

  return <div className="dialog-backdrop order-dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !saving) onClose();
  }}>
    <section aria-labelledby="new-order-title" aria-modal="true" className="order-dialog manual-order-dialog" role="dialog">
      <header className="order-dialog-header">
        <div className="order-dialog-title"><span className="dialog-icon" data-tone="positive"><ShoppingBag size={19} aria-hidden="true" /></span><div><p className="eyebrow">Manual order</p><h2 id="new-order-title">Create customer order</h2><span>Securely capture an assisted order in three steps.</span></div></div>
        <button aria-label="Close new order" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button>
      </header>
      <nav className="order-stepper" aria-label="Order creation progress">
        {steps.map((label, index) => <div className={index === step ? "is-current" : index < step ? "is-complete" : ""} key={label}><span>{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span><strong>{label}</strong></div>)}
      </nav>
      <div className="order-dialog-scroll manual-order-scroll">
        {loading ? <GlobalLoader inline label="Preparing order workspace" /> : !options ? <div className="inline-state inline-state-error" role="alert">{error}</div> : <>
          {step === 0 ? <div className="manual-order-section">
            <section className="manual-form-card"><header><span className="signal-icon" data-tone="teal"><Store size={17} aria-hidden="true" /></span><div><h3>Store and customer</h3><p>Choose the selling store and identify the customer.</p></div></header><div className="form-grid">
              <label className="form-field manual-span-2"><span>Store <em>*</em></span><select value={form.storeId} onChange={(event) => changeStore(event.target.value)}>{options.stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}</select></label>
              <label className="form-field"><span>First name <em>*</em></span><input autoFocus maxLength={100} value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
              <label className="form-field"><span>Last name</span><input maxLength={100} value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
              <label className="form-field"><span>Email</span><input inputMode="email" maxLength={254} placeholder="customer@example.com" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
              <label className="form-field"><span>Phone</span><input inputMode="tel" maxLength={32} placeholder="+91 98765 43210" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
            </div><p className="field-hint"><UserRound size={14} aria-hidden="true" />Email or phone is required. Existing customers are matched automatically.</p></section>
            <section className="manual-form-card"><header><span className="signal-icon" data-tone="warm"><MapPin size={17} aria-hidden="true" /></span><div><h3>Shipping and delivery</h3><p>India is the default country for this release.</p></div></header><div className="form-grid">
              <label className="form-field manual-span-2"><span>Address line 1 <em>*</em></span><input maxLength={255} value={form.line1} onChange={(event) => update("line1", event.target.value)} /></label>
              <label className="form-field"><span>Address line 2</span><input maxLength={255} value={form.line2} onChange={(event) => update("line2", event.target.value)} /></label>
              <label className="form-field"><span>Landmark</span><input maxLength={190} value={form.landmark} onChange={(event) => update("landmark", event.target.value)} /></label>
              <label className="form-field"><span>City <em>*</em></span><input maxLength={120} value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
              <label className="form-field"><span>State <em>*</em></span><select value={form.stateCode} onChange={(event) => update("stateCode", event.target.value)}><option value="">Select state</option>{states.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
              <label className="form-field"><span>PIN code <em>*</em></span><input inputMode="numeric" maxLength={6} value={form.postalCode} onChange={(event) => update("postalCode", event.target.value.replace(/\D/g, ""))} /></label>
              <label className="form-field"><span>Delivery slot</span><select value={form.deliverySlotId} onChange={(event) => update("deliverySlotId", event.target.value)}><option value="">No slot / arrange later</option>{validSlots.map((slot) => <option key={slot.id} value={slot.id}>{slot.zoneName} · {slotTime.format(new Date(slot.startsAt))} · {money.format(slot.deliveryFee)}</option>)}</select></label>
            </div></section>
          </div> : null}

          {step === 1 ? <div className="manual-order-products">
            <section className="order-catalog-pane"><div className="manual-pane-head"><div><p className="eyebrow">Available catalog</p><h3>Add products</h3></div><span>{offers.length} options</span></div><label className="compact-search manual-product-search"><span className="sr-only">Search products</span><Search size={16} aria-hidden="true" /><input autoFocus placeholder="Search name, SKU or seller" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="manual-offer-list">{offers.map((offer) => {
              const added = items.some((item) => item.offerId === offer.id);
              const unavailable = !offer.taxConfigured;
              const taxStatus = unavailable ? offer.taxSetupIssues?.[0] || "GST setup required"
                : `${offer.gstRate}% GST included · HSN ${offer.hsnSacCode}`;
              return <article key={offer.id}><span className="manual-offer-icon"><PackageSearch size={18} aria-hidden="true" /></span><div><strong>{offer.productName}</strong><span>{offer.variantName || "Standard"} · {offer.sku}</span><small>{offer.merchantName} · {offer.availableQuantity} available</small><small className={unavailable ? "offer-tax-status is-missing" : "offer-tax-status"}>{taxStatus}</small></div><div><strong>{money.format(offer.salePrice)}</strong>{offer.listPrice > offer.salePrice ? <small>{money.format(offer.listPrice)}</small> : null}</div><button aria-label={unavailable ? `${offer.productName}: ${taxStatus}` : `${added ? "Added" : "Add"} ${offer.productName}`} className={added ? "offer-add is-added" : "offer-add"} disabled={added || unavailable} onClick={() => addOffer(offer)} type="button">{added ? <Check size={15} /> : <Plus size={15} />}{unavailable ? "Setup" : added ? "Added" : "Add"}</button></article>;
            })}{offers.length === 0 ? <div className="manual-empty"><PackageSearch size={24} aria-hidden="true" /><strong>No matching offers</strong><span>Try another search or store.</span></div> : null}</div></section>
            <aside className="order-basket-pane"><div className="manual-pane-head"><div><p className="eyebrow">Current order</p><h3>{selected.length} product line{selected.length === 1 ? "" : "s"}</h3></div><strong>{money.format(totals.grand)}</strong></div><div className="manual-basket-list">{selected.map(({ offer, quantity, substitutionPreference }) => <article key={offer.id}><div><strong>{offer.productName}</strong><span>{offer.variantName || offer.sku}</span></div><button aria-label={`Remove ${offer.productName}`} className="basket-remove" onClick={() => removeItem(offer.id)} type="button"><Trash2 size={15} /></button><label><span>Quantity {offer.soldByWeight ? "(kg)" : ""}</span><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => updateItem(offer.id, { quantity: String(Math.max(offer.minimumOrderQuantity, Number(quantity) - offer.quantityStep)) })} type="button"><Minus size={14} /></button><input min={offer.minimumOrderQuantity} max={offer.maximumOrderQuantity || undefined} step={offer.quantityStep} type="number" value={quantity} onChange={(event) => updateItem(offer.id, { quantity: event.target.value })} /><button aria-label="Increase quantity" onClick={() => updateItem(offer.id, { quantity: String(Number(quantity || 0) + offer.quantityStep) })} type="button"><Plus size={14} /></button></div></label>{offer.vertical === "GROCERY" ? <label className="basket-substitution"><span>If unavailable</span><select value={substitutionPreference} onChange={(event) => updateItem(offer.id, { substitutionPreference: event.target.value })}><option value="CONTACT_ME">Contact customer</option><option value="ALLOW_SIMILAR">Allow similar</option><option value="NO_SUBSTITUTION">No substitution</option></select></label> : null}<footer><span>{quantityLabel(offer, quantity)}</span><strong>{money.format(offer.salePrice * Number(quantity || 0))}</strong></footer></article>)}{!selected.length ? <div className="manual-empty"><ShoppingBag size={24} aria-hidden="true" /><strong>Your order is empty</strong><span>Add products from the catalog.</span></div> : null}</div></aside>
          </div> : null}

          {step === 2 ? <div className="manual-review-grid">
            <section className="manual-review-main"><div className="manual-pane-head"><div><p className="eyebrow">Final check</p><h3>Review order</h3></div><span>{selected.length} lines</span></div><div className="review-line-list">{selected.map(({ offer, quantity }) => <article key={offer.id}><span className="manual-offer-icon"><PackageSearch size={17} aria-hidden="true" /></span><div><strong>{offer.productName}</strong><span>{offer.variantName || offer.sku} · {offer.merchantName}</span></div><span>{quantityLabel(offer, quantity)}</span><strong>{money.format(offer.salePrice * Number(quantity))}</strong></article>)}</div><label className="form-field"><span>Customer notes</span><textarea maxLength={1000} placeholder="Visible to the fulfilment team" rows={3} value={form.customerNotes} onChange={(event) => update("customerNotes", event.target.value)} /></label><label className="form-field"><span>Internal notes</span><textarea maxLength={1000} placeholder="Private operational context" rows={3} value={form.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></label></section>
            <aside className="manual-review-side"><section><small>Customer</small><strong>{form.firstName} {form.lastName}</strong><p>{form.email || form.phone}<br />{form.line1}, {form.city}, {states.find(([code]) => code === form.stateCode)?.[1]} {form.postalCode}</p></section><section className="manual-promotion-select"><div><TicketPercent size={17} aria-hidden="true" /><span><small>Offer</small><strong>Apply promotion</strong></span></div><label className="form-field"><span>Available offer</span><select value={form.promotionId} onChange={(event) => { update("promotionId", event.target.value); update("couponCode", ""); }}><option value="">No additional offer</option>{promotions.map((promotion) => <option disabled={promotion.couponRequired && !promotion.activeCouponCount} key={promotion.id} value={promotion.id}>{promotion.name}{promotion.minimumOrderAmount ? ` · Min. ${money.format(promotion.minimumOrderAmount)}` : ""}</option>)}</select></label>{promotions.find((promotion) => promotion.id === form.promotionId)?.couponRequired ? <label className="form-field"><span>Coupon code <em>*</em></span><input maxLength={80} placeholder="Enter active code" value={form.couponCode} onChange={(event) => update("couponCode", event.target.value.toUpperCase())} /></label> : null}{form.promotionId && !totals.promotionDiscount ? <small className="promotion-order-hint">The offer threshold is not met or delivery has no charge.</small> : null}</section><section className="review-totals"><span><small>List subtotal</small><strong>{money.format(totals.list)}</strong></span><span><small>Product discount</small><strong>−{money.format(totals.baseDiscount)}</strong></span>{totals.promotionDiscount ? <span className="review-promotion-discount"><small>Offer discount</small><strong>−{money.format(totals.promotionDiscount)}</strong></span> : null}<span className="review-tax"><small>Included GST</small><strong>{money.format(totals.tax)}</strong></span><span><small>Delivery</small><strong>{totals.shipping ? money.format(totals.shipping) : "Free / later"}</strong></span><span className="review-grand"><small>Order total</small><strong>{money.format(totals.grand)}</strong></span></section><p className="review-note"><Check size={15} aria-hidden="true" />GST is included in product prices. The API revalidates tax, promotion eligibility, coupon limits, and final totals before placing the order.</p></aside>
          </div> : null}
          {error ? <div className="inline-state inline-state-error manual-order-error" role="alert">{error}</div> : null}
        </>}
      </div>
      {!loading && options ? <footer className="order-dialog-actions manual-order-actions"><span>Step {step + 1} of {steps.length} · {steps[step]}</span><div>{step > 0 ? <button className="button button-secondary" disabled={saving} onClick={() => { setError(""); setStep((current) => current - 1); }} type="button"><ArrowLeft size={16} aria-hidden="true" />Back</button> : <button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button>}{step < 2 ? <button className="button button-primary" onClick={goNext} type="button">Continue<ArrowRight size={16} aria-hidden="true" /></button> : <button className="button button-success" disabled={saving} onClick={submit} type="button"><Check size={16} aria-hidden="true" />{saving ? "Creating order…" : `Create order · ${money.format(totals.grand)}`}</button>}</div></footer> : null}
    </section>
  </div>;
}
