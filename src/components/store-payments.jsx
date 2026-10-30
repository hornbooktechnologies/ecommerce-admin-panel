"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { paymentSettingsRequest, savePaymentSettingsRequest } from "@/lib/api-client";

export function StorePayments({ storeId, storeName, tenantId, accessToken, Frame }) {
  const [open, setOpen] = useState(false), [saved, setSaved] = useState(false);
  if (!storeId) return null;
  return <section className="tenant-directory" style={{ marginBottom: 24 }}>
    <div className="section-heading"><div><p className="eyebrow">Checkout payments</p><h2>{storeName}</h2><p>Cash on delivery and tenant-owned Razorpay test payments.</p></div>
      <button type="button" className="button button-primary" onClick={() => { setSaved(false); setOpen(true); }}><CreditCard size={18} aria-hidden="true" />Payment settings</button></div>
    {saved && <p role="status">Payment settings saved. No live payments are enabled.</p>}
    {open && <PaymentDialog key={`${tenantId}:${storeId}`} {...{ storeId, tenantId, accessToken, Frame }} onClose={() => setOpen(false)} onSaved={() => { setSaved(true); setOpen(false); }} />}
  </section>;
}
function PaymentDialog({ storeId, tenantId, accessToken, Frame, onClose, onSaved }) {
  const [config, setConfig] = useState(null), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [keyId, setKeyId] = useState(""), [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  useEffect(() => {
    let active = true;
    paymentSettingsRequest(storeId, accessToken, tenantId).then((data) => { if (active) setConfig(data); }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [storeId, accessToken, tenantId]);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { await savePaymentSettingsRequest(storeId, { codEnabled: config.codEnabled, onlineEnabled: config.onlineEnabled, keyId, keySecret, webhookSecret }, accessToken, tenantId); setKeySecret(""); setWebhookSecret(""); onSaved(); }
    catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  }
  return <Frame eyebrow="Tenant-owned payment account" icon={CreditCard} title="Checkout payment settings" onClose={onClose} saving={saving}>
    <form onSubmit={save}><div className="catalog-form-scroll">
      <p className="inline-state">TEST MODE ONLY. No real money will be collected. Enable automatic capture in your Razorpay Test dashboard.</p>
      {error && <p className="inline-state inline-state-error" role="alert">{error}</p>}
      {!config ? !error && <p role="status">Loading payment settings…</p> : <fieldset disabled={saving} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <div className="store-form-section"><h3>Methods for this store</h3>
          <label className="store-check"><input type="checkbox" checked={config.codEnabled} onChange={(event) => setConfig({ ...config, codEnabled: event.target.checked })} /><span><strong>Cash on delivery</strong><small>Payment remains unpaid until collected; no online charge.</small></span></label>
          <label className="store-check"><input type="checkbox" checked={config.onlineEnabled} disabled={!config.encryptionReady} onChange={(event) => setConfig({ ...config, onlineEnabled: event.target.checked })} /><span><strong>Online payment — Razorpay Test Mode</strong><small>Connect a test account below before enabling. Variable-weight orders currently use COD.</small></span></label>
          {!config.codEnabled && !config.onlineEnabled && <p role="status">Both methods are off. Customers will not be able to place new orders.</p>}
        </div>
        <div className="store-form-section"><h3>Razorpay account for this tenant</h3><p>This account is shared by the tenant’s stores. Changing keys affects new orders across those stores; pending attempts retain their original account.</p>
          <p>{config.connected ? `Connected test key: ${config.keyHint}. Leave both fields empty to keep it.` : "No payment account connected yet."}</p>
          {!config.encryptionReady && <p role="alert">Backend setup required: add a secure PAYMENT_CREDENTIALS_KEY to the backend .env and restart the API. COD settings can still be saved.</p>}
          <div className="form-grid store-form-grid">
            <label className="form-field"><span>Test Key ID</span><input disabled={!config.encryptionReady} value={keyId} placeholder="rzp_test_…" autoComplete="off" spellCheck={false} maxLength={80} onChange={(event) => setKeyId(event.target.value)} /></label>
            <label className="form-field"><span>Test Key Secret</span><input disabled={!config.encryptionReady} value={keySecret} type="password" autoComplete="new-password" maxLength={200} onChange={(event) => setKeySecret(event.target.value)} /></label>
          </div><p>Secrets are encrypted by the backend and are never returned to the browser. Live keys are rejected.</p>
        </div>
        <div className="store-form-section"><h3>Automatic payment updates</h3>
          <p>Receive payment updates even if a customer closes checkout. Configure this in the tenant’s Razorpay Test dashboard; the backend recovery worker must also be running.</p>
          <p role="status">{config.webhookConfigured ? "Webhook secret saved. Dashboard configuration is still required." : "Webhook secret not configured."}</p>
          <label className="form-field"><span>Webhook Secret</span><input type="password" autoComplete="new-password" value={webhookSecret} minLength={16} maxLength={200}
            disabled={!config.encryptionReady} aria-describedby="payment-webhook-help" onChange={(event) => setWebhookSecret(event.target.value)} /></label>
          <p id="payment-webhook-help">Use a separate secret of at least 16 characters—not your Test Key Secret. Enter the same value in Razorpay. Leave empty to keep the saved secret.</p>
          {config.webhookUrl ? <label className="form-field" htmlFor="payment-webhook-url"><span id="payment-webhook-url-label">Webhook URL</span><textarea id="payment-webhook-url" aria-labelledby="payment-webhook-url-label" readOnly rows={3} value={config.webhookUrl} aria-describedby="payment-webhook-url-help" spellCheck={false} /></label>
            : <p>Connect your test account and save, then reopen this dialog to get its webhook URL.</p>}
          <p id="payment-webhook-url-help">The URL must use your public HTTPS backend domain. Localhost cannot receive Razorpay events. After changing API keys, reopen this dialog for the new URL; retain the old endpoint for pending orders.</p>
          <p>Subscribe to <code>payment.authorized</code>, <code>payment.captured</code>, <code>payment.failed</code> and <code>order.paid</code>. Failed payments remain retryable; only verified captures mark orders paid.</p>
        </div>
      </fieldset>}
    </div><footer className="dialog-actions catalog-dialog-actions"><span>Only tenant owners can change payment accounts.</span><div><button className="button button-secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="button button-success" type="submit" disabled={!config || saving}>{saving ? "Validating & saving…" : "Save payment settings"}</button></div></footer></form>
  </Frame>;
}
