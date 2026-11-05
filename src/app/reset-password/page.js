"use client";

import {useLocalization as useUiLocalization} from '@/localization/provider';
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Command, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { resetPasswordRequest } from "@/lib/api-client";

function PasswordControl({ autoFocus, describedBy, name, onChange, value }) {
  const [visible, setVisible] = useState(false);
  return <span className="password-field"><input autoComplete="new-password" autoFocus={autoFocus} aria-describedby={describedBy} minLength={12} name={name} onChange={onChange} required type={visible ? "text" : "password"} value={value} /><button aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible((current) => !current)} type="button">{visible ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}</button></span>;
}

export default function ResetPasswordPage() {
 const {t: _uiText}=useUiLocalization();

  const router = useRouter();
  const errorRef = useRef(null);
  const linkRead = useRef(false);
  const [token, setToken] = useState(null);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (linkRead.current) return;
    linkRead.current = true;
    const url = new URL(window.location.href);
    // New emails use fragments, which are not sent in HTTP requests/referrers.
    // Accept older links during the transition, then remove either token from URL.
    const value = new URLSearchParams(url.hash.slice(1)).get("token") || url.searchParams.get("token") || "";
    setToken(value);
    if (value) { url.searchParams.delete("token"); url.hash = ""; window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`); }
  }, []);
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); setErrors((current) => ({ ...current, [event.target.name]: undefined })); setError(""); }
  async function submit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) return setErrors({ confirmPassword: "Passwords do not match." });
    setSubmitting(true); setErrors({}); setError("");
    try { await resetPasswordRequest({ token, newPassword: form.newPassword }); router.replace("/login?passwordReset=1"); }
    catch (requestError) {
      setErrors(Object.fromEntries((requestError.details || []).filter((item) => item.field).map((item) => [item.field, item.message])));
      setError(requestError.message || "Password could not be reset.");
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally { setSubmitting(false); }
  }

  return <main className="recovery-shell"><section className="recovery-brand"><div className="brand-lockup brand-lockup-auth"><span className="brand-mark" aria-hidden="true"><Command size={17} strokeWidth={2.4} /></span><span>Commerce OS</span></div><div><span className="recovery-brand-icon"><KeyRound aria-hidden="true" size={30} /></span><p className="eyebrow eyebrow-light">One-time credential reset</p><h1>Create a secure new password.</h1><p>Completing this reset signs out every existing device and invalidates the link.</p></div><span className="secure-label"><ShieldCheck aria-hidden="true" size={14} />Session protection</span></section><section className="recovery-access" aria-labelledby="reset-title"><div className="recovery-access-top"><Link className="recovery-back" href="/login"><ArrowLeft aria-hidden="true" size={16} />Back to sign in</Link><ThemeToggle /></div><div className="recovery-card"><p className="eyebrow">Reset password</p><h2 id="reset-title">Choose your new password</h2><p className="login-intro">Use at least 12 characters and avoid reusing your current password.</p>{token === "" ? <div className="recovery-invalid" role="alert"><strong>This reset link is incomplete.</strong><p>Request a new link to continue securely.</p><Link className="button button-warning" href="/forgot-password">Request new link</Link></div> : token === null ? <div className="auth-form-skeleton" aria-label="Reading reset link" /> : <form className="login-form" onSubmit={submit} noValidate><label className="field"><span>{_uiText("New password")}</span><PasswordControl autoFocus describedBy={errors.newPassword ? "reset-password-error" : "reset-password-help"} name="newPassword" onChange={update} value={form.newPassword} /><small className={errors.newPassword ? "field-error" : "field-help"} id={errors.newPassword ? "reset-password-error" : "reset-password-help"}>{errors.newPassword || "Minimum 12 characters."}</small></label><label className="field"><span>Confirm new password</span><PasswordControl describedBy={errors.confirmPassword ? "reset-confirm-error" : undefined} name="confirmPassword" onChange={update} value={form.confirmPassword} />{errors.confirmPassword ? <small className="field-error" id="reset-confirm-error">{errors.confirmPassword}</small> : null}</label>{error ? <div className="form-error" ref={errorRef} role="alert" tabIndex={-1}>{error}</div> : null}<button className="login-submit" disabled={submitting} type="submit"><span>{submitting ? "Securing account" : "Set new password"}</span>{submitting ? <span className="button-spinner" aria-hidden="true" /> : <ArrowRight aria-hidden="true" size={17} />}</button></form>}</div></section></main>;
}
