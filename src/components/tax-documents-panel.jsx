"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileCheck2, Plus, ReceiptText, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { tenantIdForUser } from "@/lib/auth-routing";
import { issueTaxInvoiceRequest } from "@/lib/api-client";
import { TaxDocumentDetailDialog } from "@/components/tax-document-detail-dialog";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function financialYearFor(value) {
  const [year, month] = value.split("-").map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function IssueInvoiceDialog({ candidates, invoiceSeries, onClose, onSaved }) {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const today = localDateValue();
  const [form, setForm] = useState({ sellerOrderId: candidates[0]?.sellerOrderId || "",
    seriesId: "", documentDate: today });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const matchingSeries = useMemo(() => invoiceSeries.filter((series) => series.documentType === "TAX_INVOICE"
    && series.financialYear === financialYearFor(form.documentDate)), [form.documentDate, invoiceSeries]);
  const selectedOrder = candidates.find((candidate) => candidate.sellerOrderId === form.sellerOrderId);

  useEffect(() => {
    if (!matchingSeries.some((series) => series.id === form.seriesId)) {
      setForm((current) => ({ ...current, seriesId: matchingSeries[0]?.id || "" }));
    }
  }, [form.seriesId, matchingSeries]);

  useEffect(() => {
    function close(event) { if (event.key === "Escape" && !saving) onClose(); }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, saving]);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      onSaved(await issueTaxInvoiceRequest(form, accessToken, tenantId));
    } catch (requestError) {
      setError(requestError.message || "The tax invoice could not be issued.");
    } finally { setSaving(false); }
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()} role="presentation">
    <section aria-labelledby="issue-invoice-title" aria-modal="true" className="access-dialog tax-dialog tax-document-dialog" role="dialog">
      <header className="access-dialog-head"><span className="dialog-icon" data-tone="positive"><ReceiptText aria-hidden="true" size={19} /></span><div><p className="eyebrow">Immutable tax document</p><h2 id="issue-invoice-title">Issue tax invoice</h2></div><button aria-label="Close dialog" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button></header>
      <form onSubmit={submit}><div className="tax-dialog-scroll"><div className="tax-document-notice"><ShieldCheck aria-hidden="true" size={20} /><span><strong>Number allocation is permanent</strong><small>The API validates totals and reserves the next invoice number in one transaction.</small></span></div><div className="form-grid tax-form-grid">
        <label className="form-field catalog-span-2"><span>Completed seller order <em>*</em></span><select autoFocus required value={form.sellerOrderId} onChange={(event) => setForm((current) => ({ ...current, sellerOrderId: event.target.value }))}>{candidates.map((candidate) => <option key={candidate.sellerOrderId} value={candidate.sellerOrderId}>{candidate.sellerOrderNumber} · {candidate.customerName} · {money.format(candidate.grandTotal)}</option>)}</select></label>
        <label className="form-field"><span>Document date <em>*</em></span><input max={today} required type="date" value={form.documentDate} onChange={(event) => setForm((current) => ({ ...current, documentDate: event.target.value }))} /></label>
        <label className="form-field"><span>Invoice series <em>*</em></span><select disabled={!matchingSeries.length} required value={form.seriesId} onChange={(event) => setForm((current) => ({ ...current, seriesId: event.target.value }))}><option value="">{matchingSeries.length ? "Select series" : `No ${financialYearFor(form.documentDate)} series`}</option>{matchingSeries.map((series) => <option key={series.id} value={series.id}>{series.prefix} · next {series.nextDocumentNumber}</option>)}</select></label>
      </div>{selectedOrder ? <div className="tax-document-order-preview"><span><small>Parent order</small><strong>{selectedOrder.orderNumber}</strong></span><span><small>Store</small><strong>{selectedOrder.storeName}</strong></span><span><small>Items</small><strong>{selectedOrder.itemCount}</strong></span><span><small>Invoice total</small><strong>{money.format(selectedOrder.grandTotal)}</strong></span></div> : null}{error ? <div className="form-error" role="alert">{error}</div> : null}</div><footer className="dialog-actions"><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-success" disabled={saving || !form.seriesId || !form.sellerOrderId} type="submit"><FileCheck2 aria-hidden="true" size={16} />{saving ? "Issuing…" : "Issue invoice"}</button></footer></form>
    </section>
  </div>;
}

export function TaxDocumentsPanel({ canManage, candidates, documents, invoiceSeries, onSaved }) {
  const [open, setOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const taxInvoiceSeries = invoiceSeries.filter((series) => series.documentType === "TAX_INVOICE");
  function saved(data) { setOpen(false); onSaved(data); }
  return <section className="tax-documents-section"><div className="section-heading"><div><p className="eyebrow">Issued records</p><h2>Tax invoices</h2></div>{canManage && candidates.length > 0 && taxInvoiceSeries.length > 0 ? <button className="button button-success" onClick={() => setOpen(true)} type="button"><Plus aria-hidden="true" size={16} />Issue invoice</button> : null}</div>
    {documents.length ? <div className="tax-document-list">{documents.map((document) => <article key={document.id}><span className="tax-document-icon"><FileCheck2 aria-hidden="true" size={18} /></span><span className="tax-document-identity"><small>{document.sellerOrderNumber} · {document.customerName}</small><strong>{document.documentNumber}</strong><em>{document.registrationGstin} · FY {document.financialYear}</em></span><span><small>Document date</small><strong>{dateFormat.format(new Date(`${document.documentDate}T12:00:00`))}</strong><em>Place of supply · {document.placeOfSupplyStateCode}</em></span><span className="tax-document-total"><small>Invoice total</small><strong>{money.format(document.grandTotal)}</strong><em>Taxable {money.format(document.taxableTotal)}</em></span><Status tone={document.status === "ISSUED" ? "positive" : "neutral"}>{document.status.toLowerCase()}</Status><span className="tax-document-actions"><button aria-label={`View ${document.documentNumber}`} className="row-text-action table-view-action" onClick={() => setSelectedDocumentId(document.id)} type="button"><Eye aria-hidden="true" size={14} />View</button><button aria-label={`Download ${document.documentNumber} PDF`} className="row-text-action tax-pdf-action" onClick={() => setSelectedDocumentId(document.id)} type="button"><Download aria-hidden="true" size={14} />PDF</button></span></article>)}</div> : <div className="empty-workspace"><ReceiptText aria-hidden="true" size={28} /><h3>No tax invoices issued</h3><p>Completed first-party seller orders with verified GST snapshots and balanced totals will appear here.</p>{canManage && candidates.length && taxInvoiceSeries.length ? <button className="button button-success" onClick={() => setOpen(true)} type="button"><Plus aria-hidden="true" size={16} />Issue first invoice</button> : null}{!taxInvoiceSeries.length ? <small>Create a tax-invoice series before issuing documents.</small> : !candidates.length ? <small>Complete a new tax-ready first-party order to make it available for invoicing.</small> : null}</div>}
    {open ? <IssueInvoiceDialog candidates={candidates} invoiceSeries={invoiceSeries} onClose={() => setOpen(false)} onSaved={saved} /> : null}
    {selectedDocumentId ? <TaxDocumentDetailDialog documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} /> : null}
  </section>;
}
