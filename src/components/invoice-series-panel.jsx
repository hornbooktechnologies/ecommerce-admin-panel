"use client";

import { useEffect, useMemo, useState } from "react";
import { FileKey2, Pencil, Plus, ReceiptText, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { tenantIdForUser } from "@/lib/auth-routing";
import { createInvoiceSeriesRequest, updateInvoiceSeriesRequest } from "@/lib/api-client";

const documentLabels = {
  TAX_INVOICE: "Tax invoice",
  CREDIT_NOTE: "Credit note",
  DEBIT_NOTE: "Debit note"
};

function currentFinancialYear() {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const emptySeries = {
  registrationId: "", documentType: "TAX_INVOICE", financialYear: currentFinancialYear(),
  prefix: "INV/", nextNumber: "1", numberPadding: "6", version: 0
};

function errorMap(error) {
  return Object.fromEntries((error?.details || []).map((detail) => [detail.field, detail.message]));
}

function SeriesDialog({ item, registrations, onClose, onSaved }) {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [form, setForm] = useState(() => ({
    ...emptySeries, ...(item || {}), registrationId: item?.registrationId || registrations[0]?.id || "",
    nextNumber: String(item?.nextNumber ?? 1), numberPadding: String(item?.numberPadding ?? 6)
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const preview = useMemo(() => `${form.prefix || ""}${String(form.nextNumber || 1).padStart(Number(form.numberPadding || 0), "0")}`,
    [form.nextNumber, form.numberPadding, form.prefix]);

  useEffect(() => {
    function close(event) { if (event.key === "Escape" && !saving) onClose(); }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, saving]);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(""); setErrors({});
    const input = { ...form, nextNumber: Number(form.nextNumber), numberPadding: Number(form.numberPadding) };
    try {
      const data = item
        ? await updateInvoiceSeriesRequest(item.id, input, accessToken, tenantId)
        : await createInvoiceSeriesRequest(input, accessToken, tenantId);
      onSaved(data);
    } catch (requestError) {
      setError(requestError.message || "Invoice series could not be saved.");
      setErrors(errorMap(requestError));
    } finally { setSaving(false); }
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()} role="presentation">
    <section aria-labelledby="series-dialog-title" aria-modal="true" className="access-dialog tax-dialog invoice-series-dialog" role="dialog">
      <header className="access-dialog-head"><span className="dialog-icon" data-tone="positive"><FileKey2 aria-hidden="true" size={19} /></span><div><p className="eyebrow">Document numbering</p><h2 id="series-dialog-title">{item ? "Edit invoice series" : "Create invoice series"}</h2></div><button aria-label="Close dialog" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button></header>
      <form onSubmit={submit}><div className="tax-dialog-scroll"><div className="invoice-series-preview"><span><small>Next document number</small><strong>{preview}</strong></span><Status tone="neutral">{form.financialYear}</Status></div><div className="form-grid tax-form-grid">
        <label className="form-field catalog-span-2"><span>GST registration <em>*</em></span><select autoFocus required value={form.registrationId} onChange={(event) => set("registrationId", event.target.value)}><option value="">Select registration</option>{registrations.map((registration) => <option key={registration.id} value={registration.id}>{registration.legalName} · {registration.gstin}</option>)}</select>{errors.registrationId ? <small className="field-error">{errors.registrationId}</small> : null}</label>
        <label className="form-field"><span>Document type <em>*</em></span><select value={form.documentType} onChange={(event) => set("documentType", event.target.value)}>{Object.entries(documentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="form-field"><span>Financial year <em>*</em></span><input maxLength={7} pattern="[0-9]{4}-[0-9]{2}" placeholder="2026-27" required value={form.financialYear} onChange={(event) => set("financialYear", event.target.value)} />{errors.financialYear ? <small className="field-error">{errors.financialYear}</small> : null}</label>
        <label className="form-field"><span>Prefix <em>*</em></span><input maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9/-]*" required value={form.prefix} onChange={(event) => set("prefix", event.target.value.toUpperCase())} />{errors.prefix ? <small className="field-error">{errors.prefix}</small> : null}</label>
        <label className="form-field"><span>Number padding <em>*</em></span><input max="12" min="3" required type="number" value={form.numberPadding} onChange={(event) => set("numberPadding", event.target.value)} /></label>
        <label className="form-field catalog-span-2"><span>Next sequence number <em>*</em></span><input min="1" required type="number" value={form.nextNumber} onChange={(event) => set("nextNumber", event.target.value)} /><small className="field-hint-text">Use the next unused number. Issued document numbers cannot be reused.</small></label>
      </div>{error ? <div className="form-error" role="alert">{error}</div> : null}</div><footer className="dialog-actions"><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-success" disabled={saving} type="submit">{saving ? "Saving…" : item ? "Save series" : "Create series"}</button></footer></form>
    </section>
  </div>;
}

export function InvoiceSeriesPanel({ canManage, onSaved, registrations, series }) {
  const [dialog, setDialog] = useState(null);
  const activeRegistrations = registrations.filter((registration) => registration.status === "ACTIVE");
  function saved(data) { setDialog(null); onSaved(data); }
  return <section className="tax-series-section"><div className="section-heading"><div><p className="eyebrow">Controlled numbering</p><h2>Invoice series</h2></div>{canManage && activeRegistrations.length ? <button className="button button-secondary" onClick={() => setDialog({})} type="button"><Plus aria-hidden="true" size={16} />New series</button> : null}</div>
    {series.length ? <div className="tax-series-list">{series.map((item) => <article key={item.id}><span className="tax-series-icon"><ReceiptText aria-hidden="true" size={18} /></span><span className="tax-series-identity"><small>{documentLabels[item.documentType] || item.documentType} · {item.financialYear}</small><strong>{item.prefix}</strong><em>{item.registrationName} · {item.registrationGstin}</em></span><span className="tax-series-next"><small>Next number</small><strong>{item.nextDocumentNumber}</strong><em>{item.documentCount} issued {item.documentCount === 1 ? "document" : "documents"}</em></span>{canManage ? <button aria-label={`Edit series ${item.prefix}`} className="row-text-action" onClick={() => setDialog({ item })} type="button"><Pencil aria-hidden="true" size={14} />Edit</button> : null}</article>)}</div> : <div className="empty-workspace"><FileKey2 aria-hidden="true" size={28} /><h3>No invoice series configured</h3><p>Create a financial-year series before issuing tax invoices or adjustment notes.</p>{canManage && activeRegistrations.length ? <button className="button button-secondary" onClick={() => setDialog({})} type="button"><Plus aria-hidden="true" size={16} />Create invoice series</button> : null}{!activeRegistrations.length ? <small>Add an active GST registration first.</small> : null}</div>}
    {dialog ? <SeriesDialog item={dialog.item || null} onClose={() => setDialog(null)} onSaved={saved} registrations={activeRegistrations} /> : null}
  </section>;
}
