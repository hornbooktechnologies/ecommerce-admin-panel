"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, ClipboardCheck, PackagePlus, X } from "lucide-react";
import { receiveInventoryRequest } from "@/lib/api-client";
import { receiptQuantityAttributes } from "@/lib/inventory-quantity";
import { useUnsavedChanges } from "@/components/use-unsaved-changes";
import styles from "./receive-stock-dialog.module.css";

const empty = { warehouseId: "", offerId: "", quantity: "", unitCost: "",
  supplierDocumentNumber: "", notes: "", lotNumber: "", manufacturedAt: "", expiresAt: "", serialText: "" };
const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 4 }).format(value);

export function ReceiveStockDialog({ accessToken, onClose, onSaved, options, tenantId }) {
  // Keep the reviewed context stable across background token/option refreshes.
  // The API rechecks warehouse, seller and tracking rules when the receipt posts.
  const [choices] = useState(options);
  const [form, setForm] = useState(empty);
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldIssue, setFieldIssue] = useState(null);
  const formRef = useRef(null), headingRef = useRef(null), errorRef = useRef(null);
  const saveLock = useRef(false), active = useRef(true);
  const leave = useUnsavedChanges({ dirty: JSON.stringify(form) !== JSON.stringify(empty), busy: saving,
    onLeave: onClose, title: "Discard this stock receipt?",
    description: "Closing discards the details in this form; it does not undo any receipt already posted. If a request was interrupted, check stock and receipt history before creating another receipt." });
  const warehouse = choices.warehouses.find(item => item.id === form.warehouseId);
  const offers = choices.offers.filter(item => warehouse && item.merchantId === warehouse.merchantId);
  const offer = offers.find(item => item.id === form.offerId);
  const serialNumbers = offer?.serialTrackingEnabled
    ? form.serialText.split(/[\n,]+/).map(value => value.trim()).filter(Boolean) : [];
  const batch = Boolean(offer?.lotTrackingEnabled || offer?.expiryTrackingEnabled);

  useEffect(() => {
    active.current = true;
    const previous = document.activeElement;
    return () => { active.current = false; if (previous?.isConnected) previous.focus?.(); };
  }, []);
  useEffect(() => {
    headingRef.current?.focus();
    const scroll = headingRef.current?.closest(".catalog-form-scroll");
    if (scroll) scroll.scrollTop = 0;
  }, [review]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function update(field, value) {
    if (saveLock.current) return;
    setError(""); setFieldIssue(null);
    setForm(current => ({ ...current, [field]: value,
      ...(field === "warehouseId" ? { offerId: "" } : {}) }));
  }
  function problem(field, message) {
    setFieldIssue(field); setError(message); return false;
  }
  function validate() {
    if (!warehouse) return problem("warehouseId", "Select an active warehouse.");
    if (!offer) return problem("offerId", "Select a variant supplied by this warehouse's seller.");
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return problem("quantity", "Enter a received quantity greater than zero.");
    if (offer.lotTrackingEnabled && !form.lotNumber.trim()) return problem("lotNumber", "Enter the batch or lot number for this product.");
    if (batch && form.manufacturedAt && form.expiresAt && form.manufacturedAt >= form.expiresAt)
      return problem("expiresAt", "Expiry must be later than the manufacturing date.");
    if (offer.serialTrackingEnabled) {
      if (!Number.isInteger(quantity)) return problem("quantity", "Serialized products require a whole-number quantity.");
      if (serialNumbers.length > 500) return problem("serialText", "Receive a maximum of 500 serial numbers per receipt.");
      if (serialNumbers.some(value => value.length > 190)) return problem("serialText", "Each serial number must be 190 characters or fewer.");
      if (new Set(serialNumbers).size !== serialNumbers.length) return problem("serialText", "Remove duplicate serial numbers before reviewing this receipt.");
      if (serialNumbers.length !== quantity) return problem("serialText", `Enter exactly ${quantity} unique serial numbers to match the received quantity.`);
    }
    return true;
  }
  function reviewReceipt(event) {
    event.preventDefault();
    // Enter on the review screen must not accidentally post a permanent entry.
    if (review || saveLock.current) return;
    setError(""); setFieldIssue(null);
    if (!formRef.current.reportValidity() || !validate()) return;
    setReview(true);
  }
  async function postReceipt() {
    if (!review || saveLock.current || !validate()) return;
    saveLock.current = true; setSaving(true); setError("");
    try {
      await receiveInventoryRequest({ warehouseId: form.warehouseId, offerId: form.offerId,
        quantity: Number(form.quantity), unitCost: form.unitCost === "" ? null : Number(form.unitCost),
        supplierDocumentNumber: form.supplierDocumentNumber.trim(), notes: form.notes.trim(),
        lotNumber: batch ? form.lotNumber.trim() : "", manufacturedAt: batch ? form.manufacturedAt : "",
        expiresAt: batch ? form.expiresAt : "", serialNumbers }, accessToken, tenantId);
      if (active.current) onSaved();
    } catch (requestError) {
      if (active.current) setError(`${requestError.message || "The receipt could not be confirmed."} If the connection was interrupted, check stock and receipt history before trying again to avoid a duplicate receipt.`);
    } finally {
      saveLock.current = false;
      if (active.current) setSaving(false);
    }
  }
  function editDetails() { setReview(false); setError(""); setFieldIssue(null); }
  const invalid = field => ({ "aria-invalid": fieldIssue === field || undefined,
    "aria-describedby": fieldIssue === field ? "receipt-error" : undefined });

  return createPortal(<div className="dialog-backdrop" role="presentation"
    onMouseDown={event => { if (event.target === event.currentTarget) leave.requestClose(); }}>
    <section className={`catalog-dialog inventory-operation-dialog ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="receive-stock-title"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')]
          .filter(item => item.getClientRects().length && !item.closest("[inert]"));
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <header className="access-dialog-head catalog-dialog-head">
        <div className="dialog-icon" data-tone="positive"><PackagePlus size={19} aria-hidden="true" /></div>
        <div><p className="eyebrow">Goods receipt</p><h2 id="receive-stock-title">Receive stock</h2></div>
        <button className="icon-button" aria-label="Close stock receipt" disabled={saving} onClick={leave.requestClose} type="button"><X size={18} /></button>
      </header>
      <ol className={styles.steps} aria-label="Receipt progress">
        <li aria-current={!review ? "step" : undefined}><span>1</span>Receipt details</li>
        <li aria-current={review ? "step" : undefined}><span>2</span>Review &amp; post</li>
      </ol>
      <form ref={formRef} onSubmit={reviewReceipt} noValidate>
        <div className="catalog-form-scroll">
          <h3 className={styles.heading} ref={headingRef} tabIndex={-1}>{review ? "Confirm the physical stock received" : "Choose where and what you received"}</h3>
          <p className={styles.help}>{review ? "Check the exact seller, warehouse and SKU. Posting updates stock and creates a permanent ledger entry." : "Only variants belonging to the selected warehouse's seller are offered. Nothing is posted until you confirm the review."}</p>
          {!review ? <div inert={saving}>
            <div className="form-grid inventory-form-grid">
              <label className="form-field"><span>Warehouse <em>*</em></span><select name="warehouseId" required value={form.warehouseId} {...invalid("warehouseId")} onChange={event => update("warehouseId", event.target.value)}><option value="">Select warehouse</option>{choices.warehouses.map(item => <option key={item.id} value={item.id}>{item.name} · {item.code} · {item.merchantName}</option>)}</select></label>
              <label className="form-field"><span>Product variant <em>*</em></span><select name="offerId" required disabled={!warehouse} value={form.offerId} {...invalid("offerId")} onChange={event => update("offerId", event.target.value)}><option value="">Select variant</option>{offers.map(item => <option key={item.id} value={item.id}>{item.productName} · {item.variantName} · {item.sku}</option>)}</select></label>
              <label className="form-field"><span>Received quantity {offer?.uomCode ? `(${offer.uomCode})` : ""} <em>*</em></span><input name="quantity" {...receiptQuantityAttributes(offer?.serialTrackingEnabled)} required type="number" value={form.quantity} {...invalid("quantity")} onChange={event => update("quantity", event.target.value)} /></label>
              <label className="form-field"><span>Unit cost (₹, optional)</span><input min="0" step="0.0001" type="number" value={form.unitCost} onChange={event => update("unitCost", event.target.value)} /></label>
              <label className="form-field catalog-span-2"><span>Supplier document number</span><input maxLength={100} placeholder="Invoice or delivery challan" value={form.supplierDocumentNumber} onChange={event => update("supplierDocumentNumber", event.target.value)} /></label>
            </div>
            {warehouse && !offers.length ? <p className={styles.notice} role="status">No eligible variants for this seller. Add a seller offer or choose another warehouse.</p> : null}
            {batch ? <fieldset className="catalog-fieldset inventory-traceability-fieldset"><legend>Batch traceability</legend><div className="form-grid inventory-form-grid">
              <label className="form-field"><span>Batch / lot number {offer.lotTrackingEnabled ? <em>*</em> : null}</span><input name="lotNumber" maxLength={100} required={offer.lotTrackingEnabled} value={form.lotNumber} {...invalid("lotNumber")} onChange={event => update("lotNumber", event.target.value)} /></label>
              <label className="form-field"><span>Manufactured on</span><input type="date" value={form.manufacturedAt} onChange={event => update("manufacturedAt", event.target.value)} /></label>
              <label className="form-field"><span>Expires on {offer.expiryTrackingEnabled ? <em>*</em> : null}</span><input name="expiresAt" type="date" required={offer.expiryTrackingEnabled} value={form.expiresAt} {...invalid("expiresAt")} onChange={event => update("expiresAt", event.target.value)} /></label>
            </div></fieldset> : null}
            {offer?.serialTrackingEnabled ? <fieldset className="catalog-fieldset inventory-traceability-fieldset"><legend>Serial control</legend><label className="form-field"><span>Serial numbers <em>*</em></span><textarea name="serialText" rows={5} required placeholder="One serial number per line" value={form.serialText} {...invalid("serialText")} onChange={event => update("serialText", event.target.value)} /></label><p className="fieldset-help"><ClipboardCheck size={15} aria-hidden="true" />{serialNumbers.length} serials entered · must match the received quantity. Maximum 500 per receipt.</p></fieldset> : null}
            <label className="form-field inventory-notes"><span>Receiving notes</span><textarea maxLength={1000} rows={2} value={form.notes} onChange={event => update("notes", event.target.value)} /></label>
          </div> : <div className={styles.review}>
            <dl>
              <div><dt>Warehouse</dt><dd>{warehouse?.name}<small>{warehouse?.code}</small></dd></div>
              <div><dt>Seller</dt><dd>{warehouse?.merchantName}</dd></div>
              <div><dt>Product / variant</dt><dd>{offer?.productName}<small>{offer?.variantName} · {offer?.sku}</small></dd></div>
              <div><dt>Quantity to add</dt><dd>{Number(form.quantity).toLocaleString("en-IN", { maximumFractionDigits: 6 })} {offer?.uomCode}</dd></div>
              <div><dt>Unit cost</dt><dd>{form.unitCost === "" ? "Not provided" : money(Number(form.unitCost))}</dd></div>
              <div><dt>Supplier document</dt><dd>{form.supplierDocumentNumber.trim() || "Not provided"}</dd></div>
              {batch ? <><div><dt>Batch / lot</dt><dd>{form.lotNumber.trim() || "Not provided"}</dd></div><div><dt>Manufactured / expires (YYYY-MM-DD)</dt><dd>{form.manufacturedAt || "Not provided"} / {form.expiresAt || "Not provided"}</dd></div></> : null}
            </dl>
            {offer?.serialTrackingEnabled ? <details open><summary>{serialNumbers.length} serial numbers to receive</summary><ul className={styles.serials}>{serialNumbers.map(value => <li key={value}>{value}</li>)}</ul></details> : null}
            {form.notes.trim() ? <div className={styles.notes}><strong>Receiving notes</strong><p>{form.notes.trim()}</p></div> : null}
            <p className={styles.notice}>This adds physical stock; it does not publish a product or enable a seller offer. Storefront availability also depends on product, offer and warehouse rules.</p>
          </div>}
          {error ? <div ref={errorRef} id="receipt-error" tabIndex={-1} className="inline-state inline-state-error catalog-error" role="alert"><span>{error}</span>{fieldIssue && !review ? <button type="button" onClick={() => formRef.current?.elements.namedItem(fieldIssue)?.focus()}>Go to field</button> : null}</div> : null}
        </div>
        <footer className="dialog-actions catalog-dialog-actions"><span>{saving ? "Posting receipt…" : `Step ${review ? 2 : 1} of 2 · ${review ? "Review before posting" : "No stock changes yet"}`}</span><div>
          <button className="button button-secondary" disabled={saving} onClick={leave.requestClose} type="button">Cancel</button>
          {review ? <><button className="button button-secondary" disabled={saving} onClick={editDetails} type="button"><ArrowLeft size={16} aria-hidden="true" />Edit details</button><button className="button button-success" disabled={saving} onClick={postReceipt} type="button">{saving ? "Posting…" : "Confirm & post receipt"}</button></> : <button className="button button-primary" disabled={!offer} type="submit">Review receipt<ArrowRight size={16} aria-hidden="true" /></button>}
        </div></footer>
      </form>
    </section>
    {leave.confirmation}
  </div>, document.body);
}
