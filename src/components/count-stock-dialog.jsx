"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ClipboardCheck, X } from "lucide-react";
import { GlobalLoader } from "@/components/global-loader";
import { useUnsavedChanges } from "@/components/use-unsaved-changes";
import { adjustInventoryRequest, inventoryBalanceRequest } from "@/lib/api-client";
// Use the same responsive layout and theme as Receive stock.
import styles from "./receive-stock-dialog.module.css";

const empty = { lotId: "", countedQuantity: "", reasonCode: "CYCLE_COUNT", notes: "" };
const reasons = { CYCLE_COUNT: "Cycle count", DAMAGE: "Damage", LOSS: "Loss", FOUND: "Found stock", DATA_CORRECTION: "Data correction" };
const rounded = value => Number(Number(value).toFixed(6));
const quantity = value => Number.isFinite(value) ? value.toLocaleString("en-IN", { maximumFractionDigits: 6 }) : "Unavailable";
function snapshot(data, lotId) {
  const b = data?.balance, lot = data?.lots?.find(row => row.id === lotId);
  return JSON.stringify([b?.onHandQuantity, b?.reservedQuantity, b?.quarantineQuantity,
    b?.lotTrackingEnabled, b?.serialTrackingEnabled, lot?.id, lot?.onHandQuantity,
    lot?.reservedQuantity, lot?.quarantineQuantity]);
}

export function CountStockDialog({ accessToken, item, onClose, onSaved, tenantId }) {
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [review, setReview] = useState(false), [error, setError] = useState("");
  const [fieldIssue, setFieldIssue] = useState(null);
  const formRef = useRef(null), headingRef = useRef(null), errorRef = useRef(null);
  const active = useRef(true), saveLock = useRef(false), requestVersion = useRef(0), token = useRef(accessToken);
  useEffect(() => { token.current = accessToken; }, [accessToken]);
  const leave = useUnsavedChanges({ dirty: JSON.stringify(form) !== JSON.stringify(empty), busy: saving,
    onLeave: onClose, title: "Discard this stock count?",
    description: "Unsaved count details will be discarded. Closing does not reverse an adjustment already posted. If a request was interrupted, check stock history before trying again." });

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError(""); setReview(false);
    try {
      const result = await inventoryBalanceRequest(item.id, token.current, tenantId);
      if (active.current && version === requestVersion.current) setDetails(result);
    } catch (requestError) {
      if (active.current && version === requestVersion.current) { setDetails(null); setError(requestError.message || "Stock details could not be loaded."); }
    } finally { if (active.current && version === requestVersion.current) setLoading(false); }
  }, [item.id, tenantId]);
  useEffect(() => {
    active.current = true;
    const previous = document.activeElement;
    load();
    return () => { active.current = false; requestVersion.current += 1; if (previous?.isConnected) previous.focus?.(); };
  }, [load]);
  useEffect(() => {
    if (loading) return;
    headingRef.current?.focus();
    const scroll = headingRef.current?.closest(".catalog-form-scroll");
    if (scroll) scroll.scrollTop = 0;
  }, [loading, review]);
  useEffect(() => { if (error && !loading) errorRef.current?.focus(); }, [error, loading]);

  const balance = details?.balance;
  const lot = details?.lots?.find(row => row.id === form.lotId);
  const target = balance?.lotTrackingEnabled ? lot : balance;
  const current = target ? Number(target.onHandQuantity) : NaN;
  const counted = form.countedQuantity.trim() === "" ? NaN : Number(form.countedQuantity);
  const delta = rounded(counted - current);
  const committed = target ? rounded(Number(target.reservedQuantity) + Number(target.quarantineQuantity)) : NaN;
  const totalAfter = balance ? rounded(Number(balance.onHandQuantity) + delta) : NaN;
  const serialized = Boolean(balance?.serialTrackingEnabled);
  const canCount = Boolean(balance && !serialized && (!balance.lotTrackingEnabled || details.lots.length));

  function update(field, value) {
    if (saveLock.current) return;
    setError(""); setFieldIssue(null);
    // A different batch needs a new physical count, never a copied system count.
    setForm(previous => ({ ...previous, [field]: value, ...(field === "lotId" ? { countedQuantity: "" } : {}) }));
  }
  function problem(field, message) { setFieldIssue(field); setError(message); return false; }
  function validate() {
    if (!canCount) return problem(null, "This stock cannot be counted using a quantity adjustment.");
    if (!target) return problem("lotId", "Select the batch you physically counted.");
    if (!Number.isFinite(counted) || counted < 0 || rounded(counted) !== counted)
      return problem("countedQuantity", "Enter a non-negative physical count with up to six decimal places.");
    if (!Number.isFinite(current) || !Number.isFinite(committed) || !Number.isFinite(totalAfter))
      return problem(null, "Stock totals are unavailable. Close and reopen this count to load current details.");
    if (delta === 0) return problem("countedQuantity", "The count matches system stock. No adjustment is needed.");
    if (counted < committed) return problem("countedQuantity", `Count cannot be below ${quantity(committed)} already reserved or quarantined.`);
    if (totalAfter < rounded(Number(balance.reservedQuantity) + Number(balance.quarantineQuantity)))
      return problem("countedQuantity", "This count would reduce warehouse stock below its reserved and quarantined quantity.");
    if (form.notes.trim().length < 3) return problem("notes", "Explain this adjustment using at least three characters.");
    return true;
  }
  function reviewCount(event) {
    event.preventDefault();
    if (review || saveLock.current) return;
    setError(""); setFieldIssue(null);
    if (formRef.current.reportValidity() && validate()) setReview(true);
  }
  async function postCount() {
    if (!review || saveLock.current || !validate()) return;
    saveLock.current = true; setSaving(true); setError("");
    let posting = false;
    try {
      const fresh = await inventoryBalanceRequest(item.id, token.current, tenantId);
      if (!active.current) return;
      if (snapshot(fresh, form.lotId) !== snapshot(details, form.lotId)) {
        setDetails(fresh); setReview(false);
        setError("Stock or reservations changed since your review. Your count is retained. Check the updated figures and review again before posting.");
        return;
      }
      posting = true;
      await adjustInventoryRequest({ balanceId: item.id, lotId: balance.lotTrackingEnabled ? form.lotId : null,
        countedQuantity: counted, reasonCode: form.reasonCode, notes: form.notes.trim() }, token.current, tenantId);
      if (active.current) onSaved();
    } catch (requestError) {
      if (active.current) setError(`${requestError.message || "The count could not be confirmed."}${posting ? " If the connection was interrupted, check stock history before trying again." : " No adjustment was sent. Try again after stock details are available."}`);
    } finally { saveLock.current = false; if (active.current) setSaving(false); }
  }
  const invalid = field => ({ "aria-invalid": fieldIssue === field || undefined, "aria-describedby": fieldIssue === field ? "count-error" : undefined });

  return createPortal(<div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) leave.requestClose(); }}>
    <section className={`catalog-dialog inventory-operation-dialog ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="count-stock-title"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length && !node.closest("[inert]"));
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <header className="access-dialog-head catalog-dialog-head"><div className="dialog-icon" data-tone="warning"><ClipboardCheck size={19} aria-hidden="true" /></div><div><p className="eyebrow">Controlled correction</p><h2 id="count-stock-title">Count stock</h2></div><button className="icon-button" aria-label="Close stock count" disabled={saving} onClick={leave.requestClose} type="button"><X size={18} /></button></header>
      <ol className={styles.steps} aria-label="Stock count progress"><li aria-current={!review ? "step" : undefined}><span>1</span>Physical count</li><li aria-current={review ? "step" : undefined}><span>2</span>Review adjustment</li></ol>
      {loading ? <GlobalLoader inline label="Loading stock details" /> : <form ref={formRef} onSubmit={reviewCount} noValidate>
        <div className="catalog-form-scroll">
          <h3 ref={headingRef} tabIndex={-1} className={styles.heading}>{review ? "Review the stock correction" : "Enter the quantity you physically counted"}</h3>
          <p className={styles.help}>{balance?.productName || item.productName} · {balance?.sku || item.sku}<br />{balance?.warehouseName || item.warehouseName}</p>
          {!balance ? <p className={styles.notice}>Stock details are unavailable. Posting is disabled.</p> : serialized ? <p className={styles.notice}>Serial-level reconciliation required. Quantity-only adjustments are blocked; close this form and use Inventory → Traceability to reconcile individual serial numbers.</p> : !canCount ? <p className={styles.notice}>No batch is available to count. Receive stock against a batch first.</p> : review ? <div className={styles.review}>
            <dl><div><dt>Count scope</dt><dd>{lot ? `Batch ${lot.lotNumber}` : "Whole warehouse balance for this SKU"}</dd></div><div><dt>Reason</dt><dd>{reasons[form.reasonCode]}</dd></div><div><dt>System quantity (snapshot)</dt><dd>{quantity(current)}</dd></div><div><dt>Physical count to set</dt><dd>{quantity(counted)}</dd></div><div><dt>Expected adjustment</dt><dd>{delta < 0 ? "Decrease" : "Increase"} by {quantity(Math.abs(delta))}</dd></div><div><dt>Reserved + quarantined in this scope</dt><dd>{quantity(committed)}</dd></div>{lot ? <div><dt>Expected total warehouse on hand for this SKU</dt><dd>{quantity(totalAfter)}</dd></div> : null}</dl>
            <div className={styles.notes}><strong>Adjustment notes</strong><p>{form.notes.trim()}</p></div>
            <p className={styles.notice}>This sets on-hand stock to your physical count for the selected scope; it does not add that quantity. Posting creates a permanent audit and ledger entry. Stock is rechecked before sending; the server calculates the final adjustment against live stock, which can still change during posting.</p>
          </div> : <div className="form-grid inventory-form-grid" inert={saving}>
            {balance.lotTrackingEnabled ? <label className="form-field catalog-span-2"><span>Batch / lot <em>*</em></span><select name="lotId" required value={form.lotId} {...invalid("lotId")} onChange={event => update("lotId", event.target.value)}><option value="">Select the batch counted</option>{details.lots.map(row => <option key={row.id} value={row.id}>{row.lotNumber} · {quantity(Number(row.onHandQuantity))} on hand</option>)}</select></label> : null}
            <label className="form-field"><span>Physical count <em>*</em></span><input name="countedQuantity" min="0" step="0.000001" inputMode="decimal" type="number" required value={form.countedQuantity} {...invalid("countedQuantity")} onChange={event => update("countedQuantity", event.target.value)} /><small>Enter the final quantity present, not the quantity to add or remove. System snapshot: {quantity(current)}.</small></label>
            <label className="form-field"><span>Reason <em>*</em></span><select value={form.reasonCode} onChange={event => update("reasonCode", event.target.value)}>{Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="form-field catalog-span-2"><span>Adjustment notes <em>*</em></span><textarea name="notes" minLength={3} required rows={3} value={form.notes} {...invalid("notes")} onChange={event => update("notes", event.target.value)} /></label>
          </div>}
          {error ? <div id="count-error" ref={errorRef} tabIndex={-1} className="inline-state inline-state-error catalog-error" role="alert"><span>{error}</span>{fieldIssue && !review && canCount ? <button type="button" onClick={() => formRef.current?.elements.namedItem(fieldIssue)?.focus()}>Go to field</button> : null}</div> : null}
        </div>
        <footer className="dialog-actions catalog-dialog-actions"><span>{saving ? "Rechecking and posting…" : review ? "Step 2 of 2 · Permanent stock correction" : "Step 1 of 2 · No stock changes yet"}</span><div><button className="button button-secondary" disabled={saving} onClick={leave.requestClose} type="button">{canCount ? "Cancel" : "Close"}</button>
          {!balance ? <button className="button button-secondary" onClick={load} type="button">Reload details</button> : canCount ? review ? <><button className="button button-secondary" disabled={saving} onClick={() => { setReview(false); setError(""); }} type="button"><ArrowLeft size={16} aria-hidden="true" />Edit count</button><button className="button button-warning" disabled={saving} onClick={postCount} type="button">{saving ? "Posting…" : "Confirm adjustment"}</button></> : <button className="button button-primary" type="submit">Review adjustment</button> : null}
        </div></footer>
      </form>}
    </section>{leave.confirmation}
  </div>, document.body);
}
