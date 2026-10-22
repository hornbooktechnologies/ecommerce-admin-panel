"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  IndianRupee,
  Boxes,
  Check,
  Command,
  Eye,
  EyeOff,
  LockKeyhole,
  ShoppingBag,
  ShieldCheck,
  Store,
  Truck,
  Warehouse
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";
import { homeForUser } from "@/lib/auth-routing";

const signals = [
  { icon: Store, value: "Multi-store", label: "Retail and marketplace operations" },
  { icon: Boxes, value: "Traceable stock", label: "Lots, expiry, serials and weight" },
  { icon: ShieldCheck, value: "Scoped access", label: "Platform, tenant and vendor roles" }
];

const workflow = [
  { icon: ShoppingBag, label: "Order", detail: "Captured" },
  { icon: Warehouse, label: "Inventory", detail: "Reserved" },
  { icon: Store, label: "Sellers", detail: "Split" },
  { icon: Truck, label: "Fulfilment", detail: "Dispatched" },
  { icon: IndianRupee, label: "Finance", detail: "Reconciled" }
];

export default function LoginPage() {
  const router = useRouter();
  const { status, user, login } = useAuth();
  const errorRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [fields, setFields] = useState({ email: "", password: "" });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(homeForUser(user));
    }
  }, [router, status, user]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("passwordReset")) setNotice("Password reset complete. Sign in with your new password.");
    else if (query.has("passwordChanged")) setNotice("Password changed. Sign in again on this device.");
  }, []);

  function updateField(event) {
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [event.target.name]: undefined }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      const authenticatedUser = await login({
        email: fields.email,
        password: fields.password,
        deviceName: "Commerce OS web admin"
      });
      router.replace(homeForUser(authenticatedUser));
    } catch (requestError) {
      setError(requestError.message || "Sign in failed. Try again.");
      setFieldErrors(Object.fromEntries(
        (requestError.details || [])
          .filter((detail) => detail.field)
          .map((detail) => [detail.field, detail.message])
      ));
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-visual" aria-label="Commerce OS platform overview">
        <div className="login-visual-head">
          <div className="brand-lockup brand-lockup-auth">
            <span className="brand-mark" aria-hidden="true"><Command size={17} strokeWidth={2.4} /></span>
            <span>Commerce OS</span>
          </div>
          <span className="secure-label"><LockKeyhole size={14} aria-hidden="true" />Secure operations</span>
        </div>

        <div className="login-statement">
          <p className="eyebrow eyebrow-light">Unified commerce control</p>
          <h1>Every store.<br />One operating view.</h1>
          <p>Run catalog, stock, marketplace sellers, fulfilment and finance from a single accountable workspace.</p>
        </div>

        <div className="commerce-flow" aria-label="Order operations workflow">
          <div className="commerce-flow-head">
            <span><i />Order operations</span>
            <span>Example order &middot; <strong>ORD-10498</strong></span>
          </div>
          <div className="commerce-flow-route">
            <div className="commerce-flow-track" aria-hidden="true">
              <span className="commerce-flow-progress" />
              <span className="commerce-flow-packet" />
            </div>
            <ol>
              {workflow.map(({ icon: Icon, label, detail }) => (
                <li key={label}>
                  <span className="commerce-flow-node"><Icon size={17} aria-hidden="true" /></span>
                  <span><strong>{label}</strong><small>{detail}</small></span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="login-signals">
          {signals.map(({ icon: Icon, value, label }) => (
            <div className="login-signal" key={value}>
              <Icon size={17} aria-hidden="true" />
              <span><strong>{value}</strong><small>{label}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section className="login-access" aria-labelledby="login-title">
        <div className="login-access-top"><ThemeToggle /></div>
        <div className="login-form-wrap">
          <p className="eyebrow">Authorised access</p>
          <h2 id="login-title">Welcome back</h2>
          <p className="login-intro">Sign in with your platform, business or vendor account.</p>
          {notice ? <div className="login-notice" role="status"><Check aria-hidden="true" size={16} />{notice}</div> : null}

          <form className="login-form" onSubmit={submit} noValidate>
            <label className="field">
              <span>Email address</span>
              <input
                autoComplete="email"
                autoFocus
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                aria-invalid={Boolean(fieldErrors.email)}
                name="email"
                onChange={updateField}
                placeholder="you@company.com"
                required
                type="email"
                value={fields.email}
              />
              {fieldErrors.email ? <small className="field-error" id="email-error">{fieldErrors.email}</small> : null}
            </label>

            <div className="login-form-meta"><Link href="/forgot-password">Forgot password?</Link></div>

            <label className="field">
              <span>Password</span>
              <span className="password-field">
                <input
                  autoComplete="current-password"
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.password)}
                  minLength={12}
                  name="password"
                  onChange={updateField}
                  placeholder="Enter your password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={fields.password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </span>
              {fieldErrors.password ? <small className="field-error" id="password-error">{fieldErrors.password}</small> : null}
            </label>

            {error ? <div className="form-error" ref={errorRef} role="alert" tabIndex={-1}>{error}</div> : null}

            <button className="login-submit" disabled={submitting} type="submit">
              <span>{submitting ? "Verifying account" : "Continue to workspace"}</span>
              {submitting ? <span className="button-spinner" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </form>

          <div className="login-assurance">
            <Check size={15} aria-hidden="true" />
            <span>Protected by rotating sessions and scoped permissions</span>
          </div>
        </div>
        <p className="login-support">Access problems? Contact your organisation administrator.</p>
      </section>
    </main>
  );
}
