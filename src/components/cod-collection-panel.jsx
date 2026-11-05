"use client";
import {useLocalization as useUiLocalization} from '@/localization/provider';
import { useCallback, useEffect, useRef, useState } from "react";
import { Banknote, CheckCheck, RefreshCw } from "lucide-react";
import {
  getCodCollectionRequest,
  recordCodCollectionRequest,
} from "@/lib/api-client";
import styles from "./cod-collection-panel.module.css";
const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});
const date = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
const initialTime = () =>
  new Date(Date.now() + 330 * 60000).toISOString().slice(0, 19);
export function CodCollectionPanel({
  orderId,
  accessToken,
  tenantId,
  canCollect,
  onRecorded,
  onReload,
  onBusyChange,
  locked = false,
}) {
 const {t: _uiText}=useUiLocalization();

  const [view, setView] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [stale, setStale] = useState(false);
  const [form, setForm] = useState(() => ({
    reference: "",
    collectedAt: initialTime(),
    notes: "",
    confirmed: false,
  }));
  const active = useRef(true),
    saving = useRef(false),
    attempt = useRef(null),
    errorRef = useRef(null),
    headingRef = useRef(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getCodCollectionRequest(
        orderId,
        accessToken,
        tenantId,
      );
      if (active.current) setView(data);
    } catch (cause) {
      if (active.current)
        setError(cause.message || "Collection status could not be loaded.");
    } finally {
      if (active.current) setLoading(false);
    }
  }, [orderId, accessToken, tenantId]);
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
  }, [load]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    if (saving.current || locked || !view?.eligible || !form.confirmed || stale)
      return;
    const body = {
      orderVersion: view.orderVersion,
      amount: view.amount,
      reference: form.reference.trim(),
      collectedAt: `${form.collectedAt}+05:30`,
      notes: form.notes.trim(),
      confirmed: true,
    };
    const snapshot = JSON.stringify(body);
    if (attempt.current?.snapshot !== snapshot)
      attempt.current = { snapshot, requestId: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const data = await recordCodCollectionRequest(
        orderId,
        { ...body, requestId: attempt.current.requestId },
        accessToken,
        tenantId,
      );
      if (active.current) {
        setView(data);
        setOpen(false);
        onRecorded();
      }
    } catch (cause) {
      if (active.current) {
        setError(
          cause.message ||
            "The request was interrupted. Check recorded status before retrying.",
        );
        if (cause.status === 409) setStale(true);
      }
    } finally {
      saving.current = false;
      onBusyChange(false);
      if (active.current) setBusy(false);
    }
  }
  return (
    <section
      className={styles.panel}
      aria-labelledby="cod-collection-title"
      aria-busy={loading || busy}
    >
      <header className={styles.header}>
        <span className={styles.icon}>
          <Banknote size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{_uiText("Cash on delivery")}</p>
          <h3 id="cod-collection-title">{_uiText("Collection record")}</h3>
        </div>
      </header>
      {error && (
        <p role="alert" tabIndex={-1} ref={errorRef} className={styles.error}>
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className={styles.note}>
          Checking COD collection status…
        </p>
      ) : view?.collection ? (
        <>
          <p className={styles.success} role="status">
            <CheckCheck size={18} aria-hidden="true" />
            {_uiText("Full COD collection recorded")} </p>
          <dl className={styles.summary}>
            <div>
              <dt>{_uiText("Amount collected")}</dt>
              <dd>{money.format(view.collection.amount)}</dd>
            </div>
            <div>
              <dt>{_uiText("Receipt / collection reference")}</dt>
              <dd>{view.collection.reference}</dd>
            </div>
            <div>
              <dt>{_uiText("Collected at (IST)")}</dt>
              <dd>{date.format(new Date(view.collection.collectedAt))}</dd>
            </div>
            <div>
              <dt>{_uiText("Recorded by")}</dt>
              <dd>{view.collection.recordedBy.name}</dd>
            </div>
            <div>
              <dt>{_uiText("Recorded at (IST)")}</dt>
              <dd>{date.format(new Date(view.collection.recordedAt))}</dd>
            </div>
          </dl>
          {view.collection.notes && (
            <p className={styles.note}>{view.collection.notes}</p>
          )}
          <p className={styles.note}>
            Manual receipt record only. This does not confirm courier
            remittance, a bank deposit or vendor settlement.
          </p>
        </>
      ) : view ? (
        <>
          <p className={styles.note}>
            Record payment only after the full amount was actually collected.
            Delivery alone does not mark this order paid.
          </p>
          {!view.eligible ? (
            <p className={styles.note}>{view.blockedReason}</p>
          ) : !canCollect ? (
            <p className={styles.note}>
              An authorised owner, administrator or finance team member can
              record collection.
            </p>
          ) : !open ? (
            <button
              className="button button-success"
              type="button"
              disabled={locked}
              onClick={() => setOpen(true)}
            >
              <Banknote size={16} aria-hidden="true" />
              {_uiText("Record COD collection")} </button>
          ) : (
            <form onSubmit={submit}>
              <h4 tabIndex={-1} ref={headingRef}>
                {_uiText("Confirm full collection")} </h4>
              <p className={styles.amount}>
                {money.format(view.amount)}
                <small>Full final order total · INR</small>
              </p>
              <fieldset disabled={busy || locked} className={styles.fields}>
                <label className="form-field">
                  <span>
                    {_uiText("Receipt / collection reference")} <em>*</em>
                  </span>
                  <input
                    value={form.reference}
                    onChange={(e) => set("reference", e.target.value)}
                    required
                    minLength={3}
                    maxLength={120}
                    autoComplete="off"
                  />
                </label>
                <label className="form-field">
                  <span>
                    {_uiText("Collected at (IST)")} <em>*</em>
                  </span>
                  <input
                    type="datetime-local"
                    step="1"
                    value={form.collectedAt}
                    onChange={(e) => set("collectedAt", e.target.value)}
                    required
                  />
                </label>
                <label className={`form-field ${styles.wide}`}>
                  <span>{_uiText("Notes")}</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    maxLength={1000}
                    rows={2}
                  />
                  <small>
                    Do not include card numbers or bank credentials.
                  </small>
                </label>
                <label className={styles.confirm}>
                  <input
                    type="checkbox"
                    checked={form.confirmed}
                    onChange={(e) => set("confirmed", e.target.checked)}
                    required
                  />
                  <span>
                    I confirm the full amount shown above was actually collected
                    for this order.
                  </span>
                </label>
              </fieldset>
              <div className={styles.actions}>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busy || locked}
                  onClick={() => setOpen(false)}
                >
                  {_uiText("Cancel")} </button>
                {stale ? (
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={locked}
                    onClick={onReload}
                  >
                    {_uiText("Reload order")} </button>
                ) : (
                  <button
                    className="button button-success"
                    type="submit"
                    disabled={busy || locked || !form.confirmed}
                  >
                    {busy ? "Recording…" : _uiText("Confirm COD collection")}
                  </button>
                )}
              </div>
              <p className={styles.note}>
                The amount, reference, time and staff member are permanently
                audited. This action cannot be edited here. No online charge,
                refund or vendor payout is made.
              </p>
            </form>
          )}
        </>
      ) : (
        <button
          className="button button-secondary"
          type="button"
          onClick={load}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Retry collection status
        </button>
      )}
    </section>
  );
}
