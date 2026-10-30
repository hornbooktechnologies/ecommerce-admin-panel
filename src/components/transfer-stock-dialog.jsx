"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRightLeft, Check, Hash, X } from "lucide-react";
import { GlobalLoader } from "@/components/global-loader";
import { useUnsavedChanges } from "@/components/use-unsaved-changes";
import { inventoryBalanceRequest, inventoryOptionsRequest, transferInventoryRequest } from "@/lib/api-client";
import styles from "./receive-stock-dialog.module.css";
import transferStyles from "./transfer-stock-dialog.module.css";

const empty = { destinationWarehouseId: "", sourceLotId: "", quantity: "", serialIds: [], notes: "" };
const round = value => Number(Number(value).toFixed(6));
const format = value => Number.isFinite(value) ? value.toLocaleString("en-IN", { maximumFractionDigits: 6 }) : "Unavailable";
const availableFor = value => value ? round(Number(value.onHandQuantity) - Number(value.reservedQuantity) - Number(value.quarantineQuantity)) : NaN;
const destinationsFor = data => data ? data.warehouses.filter(warehouse => warehouse.status === "ACTIVE"
  && warehouse.id !== data.balance.warehouseId && warehouse.merchantId === data.balance.merchantId) : [];
function snapshot(data, form) {
  const b = data?.balance, lot = data?.lots?.find(row => row.id === form.sourceLotId);
  const destination = destinationsFor(data).find(row => row.id === form.destinationWarehouseId);
  const quantities = value => [value?.onHandQuantity, value?.reservedQuantity, value?.quarantineQuantity];
  return JSON.stringify([b?.warehouseId, b?.warehouseName, b?.merchantId, b?.serialTrackingEnabled,
    b?.lotTrackingEnabled, quantities(b), lot?.id, lot?.lotNumber, quantities(lot),
    destination?.id, destination?.name, destination?.code, destination?.merchantName,
    form.serialIds.map(id => { const serial = data?.serials?.find(row => row.id === id);
      return [id, serial?.serialNumber, serial?.lotId, serial?.lotNumber]; })]);
}

export function TransferStockDialog({ accessToken, item, onClose, onSaved, tenantId }) {
  const [details, setDetails] = useState(null), [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [review, setReview] = useState(false), [error, setError] = useState("");
  const [fieldIssue, setFieldIssue] = useState(null), [serialPage, setSerialPage] = useState(1);
  const token = useRef(accessToken), active = useRef(true), saveLock = useRef(false), version = useRef(0);
  const formRef = useRef(null), headingRef = useRef(null), errorRef = useRef(null);
  useEffect(() => { token.current = accessToken; }, [accessToken]);
  const leave = useUnsavedChanges({ dirty: JSON.stringify(form) !== JSON.stringify(empty), busy: saving,
    onLeave: onClose, title: "Discard this transfer?",
    description: "Unsaved transfer details will be discarded. Closing does not reverse a transfer already posted. After an interrupted request, check stock history before trying again." });
  const fetchDetails = useCallback(async () => {
    const [stock, options] = await Promise.all([
      inventoryBalanceRequest(item.id, token.current, tenantId), inventoryOptionsRequest(token.current, tenantId)
    ]);
    return { ...stock, warehouses: options.warehouses };
  }, [item.id, tenantId]);
  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true); setError(""); setReview(false);
    try { const data = await fetchDetails(); if (active.current && current === version.current) setDetails(data); }
    catch (requestError) { if (active.current && current === version.current) { setDetails(null); setError(requestError.message || "Transfer details could not be loaded."); } }
    finally { if (active.current && current === version.current) setLoading(false); }
  }, [fetchDetails]);
  useEffect(() => {
    active.current = true;
    const previous = document.activeElement;
    load();
    return () => { active.current = false; version.current += 1; if (previous?.isConnected) previous.focus?.(); };
  }, [load]);
  useEffect(() => {
    if (loading) return;
    headingRef.current?.focus();
    const scroll = headingRef.current?.closest(".catalog-form-scroll");
    if (scroll) scroll.scrollTop = 0;
  }, [loading, review]);
  useEffect(() => { if (error && !loading) errorRef.current?.focus(); }, [error, loading]);

  const balance = details?.balance, serialized = Boolean(balance?.serialTrackingEnabled);
  const batch = Boolean(balance?.lotTrackingEnabled && !serialized);
  const destinations = destinationsFor(details);
  const destination = destinations.find(row => row.id === form.destinationWarehouseId);
  const lot = details?.lots?.find(row => row.id === form.sourceLotId);
  const sourceAvailable = availableFor(balance);
  const available = batch ? Math.min(sourceAvailable, availableFor(lot)) : sourceAvailable;
  const serials = details?.serials || [];
  const serialMap = new Map(serials.map(row => [row.id, row]));
  const missingIds = form.serialIds.filter(id => !serialMap.has(id));
  const amount = serialized ? form.serialIds.length : form.quantity.trim() === "" ? NaN : Number(form.quantity);
  const serialLimit = Math.max(0, Math.min(500, Math.floor(sourceAvailable || 0), serials.length));
  const pageCount = Math.max(1, Math.ceil(serials.length / 10));
  const page = Math.min(serialPage, pageCount);
  const shownSerials = serials.slice((page - 1) * 10, page * 10);
  const canTransfer = Boolean(balance && destinations.length);

  function update(field, value) {
    if (saveLock.current) return;
    setError(""); setFieldIssue(null);
    setForm(previous => ({ ...previous, [field]: value }));
  }
  function toggleSerial(id) {
    const selected = form.serialIds.includes(id);
    if (!selected && form.serialIds.length >= serialLimit) {
      setError(`Select at most ${serialLimit} serials, based on available stock and the 500-serial limit.`); return;
    }
    update("serialIds", selected ? form.serialIds.filter(value => value !== id) : [...form.serialIds, id]);
  }
  function problem(field, message) { setFieldIssue(field); setError(message); return false; }
  function validate() {
    if (!balance) return problem(null, "Load stock details before transferring.");
    if (!destination) return problem("destinationWarehouseId", "Choose another active warehouse for the same seller.");
    if (batch && !lot) return problem("sourceLotId", "Choose the batch to move.");
    if (!Number.isFinite(amount) || amount <= 0 || round(amount) !== amount)
      return problem(serialized ? null : "quantity", "Enter a positive quantity with up to six decimal places, or select serials.");
    if (!Number.isFinite(available) || amount > available)
      return problem(serialized ? null : "quantity", `Only ${format(available)} are available in this source scope.`);
    if (serialized && (missingIds.length || amount > 500 || new Set(form.serialIds).size !== amount))
      return problem(null, "Select up to 500 unique available serials. Remove any serials no longer available.");
    if (form.notes.trim().length < 3) return problem("notes", "Explain this transfer using at least three characters.");
    return true;
  }
  function reviewTransfer(event) {
    event.preventDefault();
    if (review || saveLock.current) return;
    setError(""); setFieldIssue(null);
    if (formRef.current.reportValidity() && validate()) setReview(true);
  }
  async function postTransfer() {
    if (!review || saveLock.current || !validate()) return;
    saveLock.current = true; setSaving(true); setError("");
    let posting = false;
    try {
      const fresh = await fetchDetails();
      if (!active.current) return;
      if (snapshot(fresh, form) !== snapshot(details, form)) {
        setDetails(fresh); setReview(false);
        setError("Stock, serial availability or the destination changed. Your entries are retained. Check the updated details and review again; no transfer was sent.");
        return;
      }
      posting = true;
      await transferInventoryRequest({ sourceBalanceId: item.id, destinationWarehouseId: form.destinationWarehouseId,
        sourceLotId: batch ? form.sourceLotId : null, quantity: amount,
        serialIds: serialized ? form.serialIds : [], notes: form.notes.trim() }, token.current, tenantId);
      if (active.current) onSaved();
    } catch (requestError) {
      if (active.current) setError(`${requestError.message || "Transfer could not be confirmed."}${posting ? " If the connection was interrupted, check both warehouses and stock history before retrying to avoid moving stock twice." : " No transfer was sent. Try again when stock details are available."}`);
    } finally { saveLock.current = false; if (active.current) setSaving(false); }
  }
  const invalid = field => ({ "aria-invalid": fieldIssue === field || undefined, "aria-describedby": fieldIssue === field ? "transfer-error" : undefined });

  return createPortal(<div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) leave.requestClose(); }}>
    <section className={`catalog-dialog inventory-operation-dialog ${styles.dialog} ${transferStyles.transfer}`} role="dialog" aria-modal="true" aria-labelledby="transfer-stock-title"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')].filter(node => node.getClientRects().length && !node.closest("[inert]"));
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <header className="access-dialog-head catalog-dialog-head"><div className="dialog-icon" data-tone="positive"><ArrowRightLeft size={19} aria-hidden="true" /></div><div><p className="eyebrow">Warehouse movement</p><h2 id="transfer-stock-title">Transfer stock</h2></div><button className="icon-button" aria-label="Close stock transfer" disabled={saving} onClick={leave.requestClose} type="button"><X size={18} /></button></header>
      <ol className={styles.steps} aria-label="Transfer progress"><li aria-current={!review ? "step" : undefined}><span>1</span>Transfer details</li><li aria-current={review ? "step" : undefined}><span>2</span>Review &amp; transfer</li></ol>
      {loading ? <GlobalLoader inline label="Loading transferable stock" /> : <form ref={formRef} onSubmit={reviewTransfer} noValidate>
        <div className="catalog-form-scroll">
          <h3 className={styles.heading} ref={headingRef} tabIndex={-1}>{review ? "Review the warehouse movement" : "Choose the destination and stock to move"}</h3>
          <p className={styles.help}>{balance?.productName || item.productName} · {balance?.sku || item.sku}<br />From {balance?.warehouseName || item.warehouseName}. Reserved and quarantined stock cannot be transferred.</p>
          {!balance ? <p className={styles.notice}>Stock details are unavailable. Transfer is disabled.</p> : !destinations.length ? <p className={styles.notice}>No eligible destination. Add another active warehouse for this seller before transferring stock.</p> : review ? <div className={styles.review}>
            <dl><div><dt>Source warehouse</dt><dd>{balance.warehouseName}</dd></div><div><dt>Destination warehouse</dt><dd>{destination?.name}<small>{destination?.code} · {destination?.merchantName}</small></dd></div><div><dt>Source scope</dt><dd>{serialized ? "Selected physical serials" : batch ? `Batch ${lot.lotNumber}` : "This SKU's warehouse balance"}</dd></div><div><dt>Quantity moving</dt><dd>{format(amount)}{serialized ? " serials" : ""}</dd></div><div><dt>Source on hand (snapshot → expected)</dt><dd>{format(Number(balance.onHandQuantity))} → {format(round(Number(balance.onHandQuantity) - amount))}</dd></div><div><dt>Destination change</dt><dd>Increase by {format(amount)}</dd></div>{batch ? <div><dt>Batch available (snapshot → expected)</dt><dd>{format(availableFor(lot))} → {format(round(availableFor(lot) - amount))}</dd></div> : null}</dl>
            {serialized ? <details open><summary>{amount} selected serials</summary><ul className={styles.serials}>{form.serialIds.map(id => <li key={id}>{serialMap.get(id)?.serialNumber || id}{serialMap.get(id)?.lotNumber ? ` · Batch ${serialMap.get(id).lotNumber}` : ""}</li>)}</ul></details> : null}
            <div className={styles.notes}><strong>Transfer notes</strong><p>{form.notes.trim()}</p></div>
            <p className={styles.notice}>Confirming immediately deducts stock from the source and adds it to the destination, with permanent ledger entries. This is not a dispatch or in-transit workflow. Stock and destination are rechecked before sending; the server validates live availability during the transaction.</p>
          </div> : <div className="form-grid inventory-form-grid" inert={saving}>
            <label className="form-field catalog-span-2"><span>Destination warehouse <em>*</em></span><select name="destinationWarehouseId" required value={destination ? form.destinationWarehouseId : ""} {...invalid("destinationWarehouseId")} onChange={event => update("destinationWarehouseId", event.target.value)}><option value="">Select destination</option>{destinations.map(row => <option key={row.id} value={row.id}>{row.name} · {row.code} · {row.merchantName}</option>)}</select></label>
            {serialized ? <fieldset className="catalog-fieldset serial-transfer-picker catalog-span-2"><legend>Select physical serials</legend>
              <div className="serial-transfer-head"><span><strong>Available serials</strong><small aria-live="polite">{form.serialIds.length} selected · limit {serialLimit} per transfer</small></span><button className="serial-select-all" disabled={!form.serialIds.length} onClick={() => update("serialIds", [])} type="button">Clear selection</button></div>
              {missingIds.length ? <div className={styles.notice}><p>Some selected serials are no longer available. Remove them before reviewing.</p>{missingIds.map(id => <button className="button button-secondary" key={id} onClick={() => toggleSerial(id)} type="button">Remove unavailable serial {id}</button>)}</div> : null}
              {serials.length ? <><div className="serial-transfer-grid">{shownSerials.map(serial => { const selected = form.serialIds.includes(serial.id); return <button aria-pressed={selected} className={selected ? "is-selected" : ""} key={serial.id} disabled={!selected && form.serialIds.length >= serialLimit} onClick={() => toggleSerial(serial.id)} type="button"><span className="serial-check" aria-hidden="true">{selected ? <Check size={14} /> : <Hash size={14} />}</span><span><strong>{serial.serialNumber}</strong><small>{serial.lotNumber ? `Batch ${serial.lotNumber}` : "Unit tracked"}</small></span></button>; })}</div><div className="serial-transfer-head"><button className="button button-secondary" disabled={page <= 1} onClick={() => setSerialPage(page - 1)} type="button">Previous serials</button><span>Page {page} of {pageCount} · {serials.length} available serials</span><button className="button button-secondary" disabled={page >= pageCount} onClick={() => setSerialPage(page + 1)} type="button">Next serials</button></div></> : <p className={styles.notice}>No transferable serials are available.</p>}
            </fieldset> : <>{batch ? <label className="form-field catalog-span-2"><span>Batch / lot <em>*</em></span><select name="sourceLotId" required value={lot ? form.sourceLotId : ""} {...invalid("sourceLotId")} onChange={event => update("sourceLotId", event.target.value)}><option value="">Select source batch</option>{details.lots.map(row => <option key={row.id} value={row.id}>{row.lotNumber} · {format(availableFor(row))} available{row.expiresAt ? ` · expires ${row.expiresAt}` : ""}</option>)}</select></label> : null}<label className="form-field"><span>Quantity to move <em>*</em></span><input name="quantity" min="0.000001" max={Number.isFinite(available) ? Math.max(0, available) : undefined} step="0.000001" inputMode="decimal" type="number" required value={form.quantity} {...invalid("quantity")} onChange={event => update("quantity", event.target.value)} /><small>{format(available)} available in the selected scope.</small></label></>}
            <label className="form-field catalog-span-2"><span>Transfer notes <em>*</em></span><textarea name="notes" minLength={3} required rows={3} value={form.notes} {...invalid("notes")} onChange={event => update("notes", event.target.value)} /></label>
          </div>}
          {error ? <div id="transfer-error" ref={errorRef} tabIndex={-1} className="inline-state inline-state-error catalog-error" role="alert"><span>{error}</span>{fieldIssue && !review && canTransfer ? <button type="button" onClick={() => formRef.current?.elements.namedItem(fieldIssue)?.focus()}>Go to field</button> : null}</div> : null}
        </div>
        <footer className="dialog-actions catalog-dialog-actions"><span>{saving ? "Rechecking and transferring…" : review ? "Step 2 of 2 · Immediate stock movement" : "Step 1 of 2 · No stock moved yet"}</span><div><button className="button button-secondary" disabled={saving} onClick={leave.requestClose} type="button">{canTransfer ? "Cancel" : "Close"}</button>{!balance ? <button className="button button-secondary" onClick={load} type="button">Reload details</button> : canTransfer ? review ? <><button className="button button-secondary" disabled={saving} onClick={() => { setReview(false); setError(""); }} type="button"><ArrowLeft size={16} aria-hidden="true" />Edit transfer</button><button className="button button-success" disabled={saving} onClick={postTransfer} type="button">{saving ? "Transferring…" : "Confirm transfer"}</button></> : <button className="button button-primary" type="submit">Review transfer</button> : null}</div></footer>
      </form>}
    </section>{leave.confirmation}
  </div>, document.body);
}
