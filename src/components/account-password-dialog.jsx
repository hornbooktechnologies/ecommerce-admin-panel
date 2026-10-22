"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { changePasswordRequest } from "@/lib/api-client";

function errorsFor(error) {
  return Object.fromEntries((error?.details || []).filter((item) => item.field)
    .map((item) => [item.field, item.message]));
}

function PasswordInput({ autoFocus, describedBy, name, onChange, value }) {
  const [visible, setVisible] = useState(false);
  return <span className="password-field"><input autoComplete={name === "currentPassword" ? "current-password" : "new-password"} autoFocus={autoFocus} aria-describedby={describedBy} minLength={12} name={name} onChange={onChange} required type={visible ? "text" : "password"} value={value} /><button aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible((current) => !current)} type="button">{visible ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}</button></span>;
}

export function AccountPasswordDialog({ onClose }) {
  const router = useRouter();
  const { accessToken, logout } = useAuth();
  const errorRef = useRef(null);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function close(event) { if (event.key === "Escape" && !saving) onClose(); }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, saving]);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: undefined }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match." });
      return;
    }
    setSaving(true); setErrors({}); setError("");
    try {
      await changePasswordRequest({ currentPassword: form.currentPassword,
        newPassword: form.newPassword }, accessToken);
      await logout();
      router.replace("/login?passwordChanged=1");
    } catch (requestError) {
      setErrors(errorsFor(requestError));
      setError(requestError.message || "Password could not be changed.");
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally { setSaving(false); }
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()} role="presentation"><section aria-labelledby="change-password-title" aria-modal="true" className="access-dialog password-dialog" role="dialog"><header className="access-dialog-head"><span className="dialog-icon" data-tone="positive"><KeyRound aria-hidden="true" size={19} /></span><div><p className="eyebrow">Account security</p><h2 id="change-password-title">Change password</h2></div><button aria-label="Close change password" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button></header><form onSubmit={submit}><div className="password-dialog-body"><div className="password-security-note"><ShieldCheck aria-hidden="true" size={19} /><span><strong>All sessions will be signed out</strong><small>Sign in again with the new password after this change.</small></span></div><label className="form-field"><span>Current password <em>*</em></span><PasswordInput autoFocus describedBy={errors.currentPassword ? "current-password-error" : undefined} name="currentPassword" onChange={update} value={form.currentPassword} />{errors.currentPassword ? <small className="field-error" id="current-password-error">{errors.currentPassword}</small> : null}</label><label className="form-field"><span>New password <em>*</em></span><PasswordInput describedBy={errors.newPassword ? "new-password-error" : "new-password-help"} name="newPassword" onChange={update} value={form.newPassword} /><small className={errors.newPassword ? "field-error" : "field-help"} id={errors.newPassword ? "new-password-error" : "new-password-help"}>{errors.newPassword || "Use at least 12 characters and choose a different password."}</small></label><label className="form-field"><span>Confirm new password <em>*</em></span><PasswordInput describedBy={errors.confirmPassword ? "confirm-password-error" : undefined} name="confirmPassword" onChange={update} value={form.confirmPassword} />{errors.confirmPassword ? <small className="field-error" id="confirm-password-error">{errors.confirmPassword}</small> : null}</label>{error ? <div className="form-error" ref={errorRef} role="alert" tabIndex={-1}>{error}</div> : null}</div><footer className="dialog-actions"><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-warning" disabled={saving} type="submit"><KeyRound aria-hidden="true" size={16} />{saving ? "Changing..." : "Change password"}</button></footer></form></section></div>;
}
