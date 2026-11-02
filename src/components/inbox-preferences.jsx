"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inboxPreferencesRequest, saveInboxPreferencesRequest } from "@/lib/api-client";
import styles from "./inbox-preferences.module.css";

export function InboxPreferences({ accessToken, tenantId, onBusy }) {
  const heading = useId(); const [data, setData] = useState(null); const [disabled, setDisabled] = useState([]);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [reload, setReload] = useState(0);
  const token = useRef(accessToken); token.current = accessToken; const mutation = useRef(null); const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { onBusy(saving); }, [saving, onBusy]);
  useEffect(() => () => { mutation.current?.abort(); onBusy(false); }, [onBusy]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setMessage("");
    inboxPreferencesRequest("admin", { accessToken: token.current, tenantId, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then((next) => { if (!controller.signal.aborted) { setData(next); setDisabled(next.options.filter((item) => !item.enabled).map((item) => item.category)); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || "Preferences could not be loaded. Try reloading."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tenantId, reload]);
  const saved = data?.options.filter((item) => !item.enabled).map((item) => item.category).sort() || [];
  const dirty = JSON.stringify([...disabled].sort()) !== JSON.stringify(saved);
  async function save(event) {
    event.preventDefault(); if (!data || mutation.current || !dirty) return;
    const controller = new AbortController(); mutation.current = controller; setSaving(true); setError(""); setMessage("");
    try {
      const next = await saveInboxPreferencesRequest("admin", { revision: data.revision, disabledCategories: disabled },
        { accessToken: token.current, tenantId, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
      if (controller.signal.aborted) return;
      setData(next); setDisabled(next.options.filter((item) => !item.enabled).map((item) => item.category));
      setMessage("Preferences saved for future in-app deliveries. Existing inbox history is unchanged.");
    } catch (failure) { if (!controller.signal.aborted) setError(failure.message || "Preferences could not be saved. Try again."); }
    finally { if (mutation.current === controller) mutation.current = null; if (!controller.signal.aborted) setSaving(false); }
  }
  return <section className={styles.panel} aria-labelledby={heading}>
    <h3 id={heading} ref={headingRef} tabIndex={-1}>Notification preferences</h3>
    <p>Choose optional in-app updates for this workspace. These settings do not change emails or newsletter subscriptions.</p>
    {loading ? <p role="status">Loading preferences…</p> : data ? <form onSubmit={save} aria-busy={saving}>
      <fieldset disabled={saving}><legend>Optional updates</legend>{data.options.map((item) => <label className={styles.option} key={item.category}>
        <input type="checkbox" checked={!disabled.includes(item.category)} onChange={(event) => {
          setDisabled((current) => event.target.checked ? current.filter((category) => category !== item.category) : [...current, item.category]); setMessage("");
        }} /><span>{item.label}</span>
      </label>)}</fieldset>
      <div className={styles.required}><strong>Always enabled</strong><p>{data.required.map((item) => item.label).join(" · ")}</p><small>Account and security emails are not controlled here.</small></div>
      <p>Changes apply to new deliveries, including queued events not yet processed. Previously muted deliveries are not restored when re-enabled.</p>
      <div className={styles.actions}><button type="button" disabled={saving} onClick={() => { setDisabled([]); setMessage(""); }}>Enable all optional updates</button><button className={styles.save} type="submit" disabled={saving || !dirty}>{saving ? "Saving…" : "Save preferences"}</button></div>
      {dirty ? <p className={styles.unsaved}>Changes are not saved yet.</p> : null}
    </form> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {message ? <p className={styles.success} role="status">{message}</p> : null}
    <button className={styles.reload} type="button" disabled={saving || loading} onClick={() => setReload((value) => value + 1)}>Reload saved preferences{dirty ? " (discard edits)" : ""}</button>
  </section>;
}
