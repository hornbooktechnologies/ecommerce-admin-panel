"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Command, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { forgotPasswordRequest } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const errorRef = useRef(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault(); setSubmitting(true); setError(""); setFieldError("");
    try { setResult(await forgotPasswordRequest(email)); }
    catch (requestError) {
      setFieldError(requestError.details?.find((detail) => detail.field === "email")?.message || "");
      setError(requestError.message || "Reset instructions could not be prepared.");
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally { setSubmitting(false); }
  }

  return <main className="recovery-shell"><section className="recovery-brand"><div className="brand-lockup brand-lockup-auth"><span className="brand-mark" aria-hidden="true"><Command size={17} strokeWidth={2.4} /></span><span>Commerce OS</span></div><div><span className="recovery-brand-icon"><KeyRound aria-hidden="true" size={30} /></span><p className="eyebrow eyebrow-light">Secure account recovery</p><h1>Return to your commerce workspace.</h1><p>One-time reset links expire after 30 minutes and can only be used once.</p></div><span className="secure-label"><ShieldCheck aria-hidden="true" size={14} />Protected recovery</span></section><section className="recovery-access" aria-labelledby="recovery-title"><div className="recovery-access-top"><Link className="recovery-back" href="/login"><ArrowLeft aria-hidden="true" size={16} />Back to sign in</Link><ThemeToggle /></div><div className="recovery-card">{result ? <div className="recovery-success" role="status"><span><MailCheck aria-hidden="true" size={24} /></span><p className="eyebrow">Request accepted</p><h2 id="recovery-title">Check your reset instructions</h2><p>{result.message}</p><small>The link expires in {result.expiresInMinutes} minutes.</small>{result.developmentResetUrl ? <a className="login-submit" href={result.developmentResetUrl}><span>Open development reset link</span><ArrowRight aria-hidden="true" size={17} /></a> : null}<button className="recovery-text-action" onClick={() => setResult(null)} type="button">Use another email</button></div> : <><p className="eyebrow">Forgot password</p><h2 id="recovery-title">Request a reset link</h2><p className="login-intro">Enter the email associated with your platform, retailer, or vendor account.</p><form className="login-form" noValidate onSubmit={submit}><label className="field"><span>Email address</span><input autoComplete="email" autoFocus aria-describedby={fieldError ? "forgot-email-error" : "forgot-email-help"} aria-invalid={Boolean(fieldError)} name="email" onChange={(event) => { setEmail(event.target.value); setFieldError(""); setError(""); }} placeholder="you@company.com" required type="email" value={email} /><small className={fieldError ? "field-error" : "field-help"} id={fieldError ? "forgot-email-error" : "forgot-email-help"}>{fieldError || "For privacy, the response is the same for every email."}</small></label>{error ? <div className="form-error" ref={errorRef} role="alert" tabIndex={-1}>{error}</div> : null}<button className="login-submit" disabled={submitting} type="submit"><span>{submitting ? "Preparing instructions" : "Request reset link"}</span>{submitting ? <span className="button-spinner" aria-hidden="true" /> : <ArrowRight aria-hidden="true" size={17} />}</button></form></>}</div></section></main>;
}
