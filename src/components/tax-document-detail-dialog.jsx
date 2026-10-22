"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileCheck2, Printer, ReceiptIndianRupee, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { tenantIdForUser } from "@/lib/auth-routing";
import { getTaxDocumentPdfRequest, getTaxDocumentRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });
const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Address({ address = {} }) {
  return <>{address.line1 || "Address unavailable"}{address.line2 ? <><br />{address.line2}</> : null}<br />
    {[address.city, address.stateName, address.postalCode].filter(Boolean).join(", ")}</>;
}

function TaxAmount({ label, value }) {
  return <span><small>{label}</small><strong>{money.format(value || 0)}</strong></span>;
}

export function TaxDocumentDetailDialog({ documentId, onClose }) {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fileAction, setFileAction] = useState("");
  const [error, setError] = useState("");
  const closeRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDocument(await getTaxDocumentRequest(documentId, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "The invoice could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, documentId, tenantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    function close(event) { if (event.key === "Escape" && !fileAction) onClose(); }
    window.addEventListener("keydown", close); closeRef.current?.focus();
    return () => window.removeEventListener("keydown", close);
  }, [fileAction, onClose]);

  async function file(mode) {
    setFileAction(mode); setError("");
    try {
      const result = await getTaxDocumentPdfRequest(documentId, accessToken, tenantId,
        mode === "print" ? "inline" : "attachment");
      const url = URL.createObjectURL(result.blob);
      if (mode === "print") {
        const preview = window.open(url, "_blank", "noopener,noreferrer");
        if (!preview) throw new Error("Allow pop-ups to open the printable invoice.");
        window.setTimeout(() => { try { preview.print(); } catch { return; } }, 1200);
      } else {
        const link = window.document.createElement("a");
        link.href = url; link.download = result.filename; link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) { setError(requestError.message || "The PDF could not be prepared."); }
    finally { setFileAction(""); }
  }

  return <div className="dialog-backdrop tax-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !fileAction && onClose()} role="presentation">
    <section aria-labelledby="tax-detail-title" aria-modal="true" className="tax-detail-dialog" role="dialog">
      <header className="tax-detail-head"><span className="tax-detail-mark"><FileCheck2 aria-hidden="true" size={21} /></span><div><p className="eyebrow">Issued GST document</p><h2 id="tax-detail-title">{document?.documentNumber || "Tax invoice"}</h2></div>{document ? <Status tone="positive">{document.status.toLowerCase()}</Status> : null}<button aria-label="Close tax invoice" className="icon-button" disabled={Boolean(fileAction)} onClick={onClose} ref={closeRef} type="button"><X aria-hidden="true" size={19} /></button></header>
      <div className="tax-detail-toolbar"><span><ShieldCheck aria-hidden="true" size={16} />Immutable issued record</span><div><button className="button button-secondary" disabled={!document || Boolean(fileAction)} onClick={() => file("print")} type="button"><Printer aria-hidden="true" size={16} />{fileAction === "print" ? "Opening…" : "Print"}</button><button className="button button-success" disabled={!document || Boolean(fileAction)} onClick={() => file("download")} type="button"><Download aria-hidden="true" size={16} />{fileAction === "download" ? "Preparing…" : "Download PDF"}</button></div></div>
      <div className="tax-detail-scroll">{loading ? <div aria-label="Loading invoice" className="tax-detail-skeleton" role="status"><i /><i /><i /><i /></div> : error && !document ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : document ? <>
        <section className="tax-detail-hero"><div><p className="eyebrow">Invoice total</p><strong>{money.format(document.grandTotal)}</strong><small>{date.format(new Date(`${document.documentDate}T12:00:00`))} · FY {document.financialYear}</small></div><div className="tax-detail-meta"><span><small>Order</small><strong>{document.orderNumber}</strong></span><span><small>Seller order</small><strong>{document.sellerOrderNumber}</strong></span><span><small>Place of supply</small><strong>State code {document.placeOfSupplyStateCode}</strong></span><span><small>Reverse charge</small><strong>{document.reverseCharge ? "Yes" : "No"}</strong></span></div></section>
        <section className="tax-party-grid"><article><p className="eyebrow">Supplier</p><h3>{document.seller.legalName}</h3><code>{document.seller.gstin}</code><p><Address address={document.seller.address} /></p></article><article><p className="eyebrow">Bill to</p><h3>{document.buyer.name || "Customer"}</h3><code>{document.buyer.gstin || "Unregistered customer"}</code><p><Address address={document.buyer.billingAddress || document.buyer.shippingAddress} /></p>{document.buyer.email ? <small>{document.buyer.email}</small> : null}</article></section>
        <section className="tax-line-section"><div><p className="eyebrow">Line items</p><h3>HSN-classified supplies</h3></div><div className="tax-line-table" role="table" aria-label="Invoice line items"><div className="tax-line-header" role="row"><span>Description</span><span>HSN</span><span>Qty</span><span>Taxable</span><span>GST</span><span>Total</span></div>{document.items.map((item) => { const rate = item.igstRate || item.cgstRate + item.sgstRate + item.cessRate; return <div className="tax-line-row" key={item.id} role="row"><span><strong>{item.description}</strong><small>{money.format(item.unitPrice)} each</small></span><span data-label="HSN">{item.hsnSacCode}</span><span data-label="Qty">{number.format(item.quantity)} {item.uomCode}</span><span data-label="Taxable">{money.format(item.taxableAmount)}</span><span data-label="GST">{number.format(rate)}%</span><span data-label="Total"><strong>{money.format(item.lineTotal)}</strong></span></div>; })}</div></section>
        <section className="tax-total-section"><div><ReceiptIndianRupee aria-hidden="true" size={20} /><span><small>Tax registration</small><strong>{document.registrationGstin}</strong><em>{document.store.name} · {document.store.code}</em></span></div><div className="tax-total-grid"><TaxAmount label="Taxable value" value={document.taxableTotal} /><TaxAmount label="CGST" value={document.cgstTotal} /><TaxAmount label="SGST" value={document.sgstTotal} /><TaxAmount label="IGST" value={document.igstTotal} /><TaxAmount label="Cess" value={document.cessTotal} /><span className="tax-total-grand"><small>Grand total</small><strong>{money.format(document.grandTotal)}</strong></span></div></section>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
      </> : null}</div>
    </section>
  </div>;
}
