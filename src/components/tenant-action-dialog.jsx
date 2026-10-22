"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const content = {
  activate: {
    title: "Activate tenant",
    description: "Tenant staff will be able to access their workspace after activation.",
    label: "Activate tenant",
    tone: "primary",
    placeholder: "Business and owner verification completed"
  },
  suspend: {
    title: "Suspend tenant",
    description: "Access will stop immediately. Business data is retained and can be restored later.",
    label: "Suspend access",
    tone: "danger",
    placeholder: "Reason for suspending this tenant"
  },
  restore: {
    title: "Restore tenant",
    description: "Tenant access will resume with the existing stores, users, and business data.",
    label: "Restore access",
    tone: "primary",
    placeholder: "Reason for restoring this tenant"
  }
};

export function TenantActionDialog({ action, tenantName, busy, error, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const copy = content[action];
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyboard(event) {
      if (event.key === "Escape" && !busy) {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll("button:not(:disabled), textarea:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, [busy, onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section aria-labelledby="tenant-action-title" aria-modal="true" className="action-dialog" ref={dialogRef} role="dialog">
        <div className="action-dialog-head">
          <span className="dialog-icon" data-tone={copy.tone}><AlertTriangle size={19} aria-hidden="true" /></span>
          <button aria-label="Close dialog" className="icon-button" disabled={busy} onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button>
        </div>
        <h2 id="tenant-action-title">{copy.title}</h2>
        <p>{copy.description}</p>
        <div className="dialog-tenant"><small>Tenant</small><strong>{tenantName}</strong></div>
        <label className="form-field">
          <span>Audit reason</span>
          <textarea autoFocus maxLength={500} minLength={3} onChange={(event) => setReason(event.target.value)} placeholder={copy.placeholder} required value={reason} />
          <small className="field-help">Required · recorded in the immutable activity history</small>
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <div className="dialog-actions">
          <button className="button button-secondary" disabled={busy} onClick={onClose} type="button">Cancel</button>
          <button className={`button ${copy.tone === "danger" ? "button-danger" : "button-primary"}`} disabled={busy || reason.trim().length < 3} onClick={() => onConfirm(reason.trim())} type="button">
            {busy ? "Saving…" : copy.label}
          </button>
        </div>
      </section>
    </div>
  );
}
