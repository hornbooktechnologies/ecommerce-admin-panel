"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, Download, FileCheck2, FileText, ShieldAlert, Upload, X } from "lucide-react";
import { Status } from "@/components/dashboard-primitives";
import { decideVendorDocumentRequest, downloadVendorDocumentRequest,
  uploadVendorDocumentRequest } from "@/lib/api-client";
import { formatDateValue } from "@/lib/date-format";

const documentTypes = {
  PAN_CARD: "PAN card",
  GST_CERTIFICATE: "GST certificate",
  BANK_PROOF: "Bank proof",
  INCORPORATION_CERTIFICATE: "Incorporation certificate",
  ADDRESS_PROOF: "Address proof",
  OTHER: "Other document",
};
const statusTone = { PENDING: "warning", VERIFIED: "positive", REJECTED: "danger" };
const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function documentDate(value, fallback = "No expiry") {
  return formatDateValue(value, date, { dateOnly: true, fallback });
}

function fileSize(value) {
  if (!Number.isFinite(Number(value))) return "Size unavailable";
  const bytes = Number(value);
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function VendorDocumentsPanel({ accessToken, canManage, documents, onChange, tenantId, vendorId }) {
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ documentType: "GST_CERTIFICATE", documentNumber: "", expiresAt: "" });
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const counts = useMemo(() => documents.reduce((result, item) => ({ ...result,
    [item.status]: (result[item.status] || 0) + 1 }), {}), [documents]);

  async function upload(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file) { setError("Choose a PDF, PNG or JPEG document."); return; }
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
      setError("Upload a PDF, PNG or JPEG document."); return;
    }
    if (file.size > 10 * 1024 * 1024) { setError("Vendor documents must be 10 MB or smaller."); return; }
    setBusy("upload"); setError("");
    try {
      onChange(await uploadVendorDocumentRequest(vendorId, form, file, accessToken, tenantId));
      setFile(null); setForm({ documentType: "GST_CERTIFICATE", documentNumber: "", expiresAt: "" });
      setShowUpload(false); formElement.reset();
    } catch (requestError) { setError(requestError.message || "The KYC document could not be uploaded."); }
    finally { setBusy(""); }
  }

  async function download(item) {
    setBusy(`download-${item.id}`); setError("");
    try {
      const result = await downloadVendorDocumentRequest(vendorId, item.id, accessToken, tenantId);
      const href = URL.createObjectURL(result.blob); const link = window.document.createElement("a");
      link.href = href; link.download = result.filename; window.document.body.appendChild(link);
      link.click(); link.remove(); URL.revokeObjectURL(href);
    } catch (requestError) { setError(requestError.message || "The document could not be downloaded."); }
    finally { setBusy(""); }
  }

  async function decide(documentId, decision, rejectionReason = "") {
    setBusy(`review-${documentId}`); setError("");
    try {
      onChange(await decideVendorDocumentRequest(vendorId, documentId,
        { decision, rejectionReason }, accessToken, tenantId));
      setReview(null);
    } catch (requestError) { setError(requestError.message || "The review decision could not be saved."); }
    finally { setBusy(""); }
  }

  return <section className="vendor-documents-section">
    <header><div><p className="eyebrow">Compliance</p><h3>KYC documents</h3><small>Private files available only to authorised workspace users.</small></div>
      <div className="vendor-document-summary" aria-label="KYC document summary">
        <span><strong>{counts.VERIFIED || 0}</strong> verified</span><span><strong>{counts.PENDING || 0}</strong> pending</span>
        {canManage ? <button className="button button-secondary" onClick={() => { setShowUpload((value) => !value); setError(""); }} type="button">
          {showUpload ? <X aria-hidden="true" size={16} /> : <Upload aria-hidden="true" size={16} />}{showUpload ? "Close upload" : "Add document"}</button> : null}
      </div></header>
    {showUpload ? <form className="vendor-document-upload" onSubmit={upload}>
      <label className="form-field"><span>Document type <em>*</em></span><select value={form.documentType} onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}>
        {Object.entries(documentTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="form-field"><span>Document number</span><input maxLength={120} placeholder="Certificate or reference number" value={form.documentNumber} onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value }))} /></label>
      <label className="form-field"><span>Expiry date</span><input min={new Date().toISOString().slice(0, 10)} type="date" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label>
      <label className="vendor-document-file"><input accept="application/pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} required type="file" />
        <FileText aria-hidden="true" size={19} /><span><strong>{file?.name || "Choose secure file"}</strong><small>{file ? fileSize(file.size) : "PDF, PNG or JPEG - maximum 10 MB"}</small></span></label>
      <button className="button button-success" disabled={busy === "upload" || !file} type="submit"><Upload aria-hidden="true" size={16} />{busy === "upload" ? "Uploading..." : "Upload for review"}</button>
    </form> : null}
    {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={() => setError("")} type="button">Dismiss</button></div> : null}
    {documents.length ? <div className="vendor-document-list">{documents.map((document) => {
      const displayStatus = document.status;
      return <article key={document.id}>
        <span className="vendor-document-icon" data-status={displayStatus}><FileCheck2 aria-hidden="true" size={19} /></span>
        <div className="vendor-document-identity"><strong>{documentTypes[document.type] || document.type.replaceAll("_", " ")}</strong><small>{document.number || document.fileName || "No document number"}</small><em>{fileSize(document.byteSize)} - added {documentDate(document.createdAt, "date unavailable")}</em></div>
        <span className="vendor-document-expiry"><CalendarClock aria-hidden="true" size={15} /><span><small>Expiry</small><strong>{documentDate(document.expiresAt)}</strong></span></span>
        <Status tone={statusTone[document.status]}>{displayStatus.toLowerCase()}</Status>
        <div className="vendor-document-actions"><button className="row-action" disabled={Boolean(busy)} onClick={() => download(document)} type="button"><Download aria-hidden="true" size={14} />{busy === `download-${document.id}` ? "Opening..." : "Download"}</button>
          {canManage && document.status !== "VERIFIED" ? <button className="row-action row-action-positive" disabled={Boolean(busy)} onClick={() => decide(document.id, "VERIFIED")} type="button"><Check aria-hidden="true" size={14} />Verify</button> : null}
          {canManage && document.status !== "REJECTED" ? <button className="row-action vendor-document-reject" disabled={Boolean(busy)} onClick={() => setReview({ id: document.id, reason: "" })} type="button"><ShieldAlert aria-hidden="true" size={14} />Reject</button> : null}
        </div>
        {document.rejectionReason ? <p className="vendor-document-reason"><ShieldAlert aria-hidden="true" size={14} />{document.rejectionReason}</p> : null}
        {review?.id === document.id ? <form className="vendor-document-review" onSubmit={(event) => { event.preventDefault(); decide(document.id, "REJECTED", review.reason); }}>
          <label className="form-field"><span>Rejection reason <em>*</em></span><textarea autoFocus maxLength={500} minLength={3} onChange={(event) => setReview((current) => ({ ...current, reason: event.target.value }))} required rows={2} value={review.reason} /></label>
          <div><button className="button button-secondary" onClick={() => setReview(null)} type="button">Cancel</button><button className="button button-danger" disabled={busy === `review-${document.id}` || review.reason.trim().length < 3} type="submit">Confirm rejection</button></div>
        </form> : null}
      </article>;
    })}</div> : <div className="vendor-document-empty"><FileText aria-hidden="true" size={24} /><div><strong>No KYC files uploaded</strong><p>Add GST, PAN, banking or incorporation proof for compliance review.</p></div></div>}
  </section>;
}
