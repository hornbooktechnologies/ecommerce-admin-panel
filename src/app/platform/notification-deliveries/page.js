"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser } from "@/lib/auth-routing";
import { listNotificationDeliveriesRequest, retryNotificationDeliveryRequest } from "@/lib/api-client";
import styles from "./delivery-operations.module.css";
import { WorkerHealth } from "./worker-health";
import { DeliveryRetryHistory } from "./delivery-retry-history";

const path = "/platform/notification-deliveries";
const tones = { FAILED: "danger", QUEUED: "warning", PROCESSED: "positive" };
const labels = { FAILED: "Failed", QUEUED: "Queued", PROCESSED: "Processed" };
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? dateTime.format(date) : "—";
}

function Deliveries({ canRetry, canReadAudit }) {
  const { accessToken } = useAuth();
  const [filters, setFilters] = useState({ status: "FAILED", audience: "ALL", search: "", page: 1, pageSize: 10 });
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState("");
  const reasonRef = useRef(null);
  const submitting = useRef(false);
  const alive = useRef(false);
  const refreshRef = useRef(null);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    listNotificationDeliveriesRequest(filters, { accessToken, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || "Could not load deliveries."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accessToken, filters, revision]);
  useEffect(() => { if (selected) reasonRef.current?.focus(); }, [selected]);

  function dismiss() {
    setSelected(null); setReason(""); setConfirmed(false); setRetryError("");
    refreshRef.current?.focus();
  }
  function changeFilters(values) {
    if (submitting.current) return;
    dismiss(); setNotice(""); setFilters((current) => ({ ...current, page: 1, ...values }));
  }
  async function retry(event) {
    event.preventDefault();
    if (!selected || submitting.current || !confirmed || reason.trim().length < 10) return;
    submitting.current = true; setBusy(true); setRetryError(""); setNotice("");
    try {
      await retryNotificationDeliveryRequest(selected.id, {
        reason: reason.trim(), confirmed: true, expectedManualRetries: selected.manualRetries
      }, { accessToken });
      if (!alive.current) return;
      dismiss();
      setNotice("Retry queued. Delivery is not confirmed yet; refresh after the inbox worker processes it.");
      setRevision((value) => value + 1);
    } catch (failure) {
      if (!alive.current) return;
      setRetryError(failure.message || "Could not queue the retry. Refresh before trying again.");
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return <div className={styles.page}>
    <header className={styles.heading}>
      <div><p className="eyebrow">PLATFORM OPERATIONS</p><h1>Notification deliveries</h1>
        <p className={styles.muted}>Inspect inbox delivery failures and safely queue a single retry.</p></div>
      <button ref={refreshRef} type="button" className="secondary-button" disabled={busy || loading}
        onClick={() => { dismiss(); setRevision((value) => value + 1); }}>
        <RefreshCw size={17} aria-hidden="true" /> Refresh</button>
    </header>

    <aside className={styles.explainer}><ShieldCheck size={21} aria-hidden="true" /><div>
      <strong>Inbox recovery only</strong><p>Retries do not repeat orders, payments, emails or imports. Already-created inbox entries are preserved.
        The inbox worker must be running to process queued events. Times below are in IST.</p>
    </div></aside>
    <WorkerHealth refreshKey={revision} paused={busy} />
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error} Use Refresh to try again.</p>}

    {data && <section aria-label="All-tenant delivery totals" className={styles.summary}>
      {Object.entries(labels).map(([status, label]) => <div key={status}>
        <Status tone={tones[status]}>{label}</Status><strong>{(data.summary[status] || 0).toLocaleString("en-IN")}</strong>
        <small>All tenants · all time · ignores filters</small>
      </div>)}
    </section>}

    <section className={styles.panel} aria-labelledby="delivery-list-heading">
      <div className={styles.sectionHeading}><BellRing size={20} aria-hidden="true" /><h2 id="delivery-list-heading">Delivery queue</h2></div>
      <form onSubmit={(event) => { event.preventDefault(); changeFilters({ search: search.trim() }); }}>
        <fieldset className={styles.filters} disabled={busy}>
          <label>Search tenant code or event type<input value={search} maxLength={80} onChange={(event) => setSearch(event.target.value)} placeholder="Tenant code or event type" /></label>
          <label>Status<select value={filters.status} onChange={(event) => changeFilters({ status: event.target.value })}>
            <option value="ALL">All statuses</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Audience<select value={filters.audience} onChange={(event) => changeFilters({ audience: event.target.value })}>
            <option value="ALL">All audiences</option><option value="ADMIN">Admin</option><option value="VENDOR">Vendor</option>
            <option value="CUSTOMER">Customer</option><option value="PLATFORM">Platform</option></select></label>
          <button type="submit" className="secondary-button">Search</button>
        </fieldset>
      </form>

      {selected && <form className={styles.confirmation} onSubmit={retry} aria-labelledby="retry-title">
        <h3 id="retry-title">Confirm delivery retry</h3>
        <p><strong>{selected.tenantCode}</strong> · {selected.kind}</p><code>{selected.id}</code>
        <p>This queues manual cycle {selected.manualRetries + 1} of {data?.maxManualRetries || 3}. Fix the underlying delivery problem first.
          Existing recipients and progress will not be reset.</p>
        <label htmlFor="retry-reason">Reason for retry <span aria-hidden="true">*</span></label>
        <textarea ref={reasonRef} id="retry-reason" required minLength={10} maxLength={500} rows={3} disabled={busy}
          value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby="reason-help" />
        <small id="reason-help">10–500 characters. Recorded in the audit trail. Do not include passwords, tokens or customer details.</small>
        <label className={styles.checkbox}><input type="checkbox" required checked={confirmed} disabled={busy}
          onChange={(event) => setConfirmed(event.target.checked)} />I confirm this should retry only the failed inbox delivery.</label>
        {retryError && <p className={styles.error} role="alert">{retryError}</p>}
        <div className={styles.actions}><button type="button" className="secondary-button" disabled={busy} onClick={dismiss}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy || !confirmed || reason.trim().length < 10}>
            <RotateCcw size={16} aria-hidden="true" />{busy ? "Queueing…" : "Queue retry"}</button></div>
      </form>}

      <div aria-busy={loading}>
        {loading && <div className={styles.loading} role="status"><span>Loading deliveries…</span>{[1, 2, 3].map((key) => <div key={key} aria-hidden="true" />)}</div>}
        {!loading && data?.items.length === 0 && <div className={styles.empty}><BellRing size={28} aria-hidden="true" />
          <h3>No matching deliveries</h3><p>Try another status, audience or search. No failed deliveries in this view does not confirm worker health.</p></div>}
        {!loading && data?.items.length > 0 && <ul className={styles.list}>{data.items.map((item) => <li key={item.id}>
          <div className={styles.rowHeading}><div><strong>{item.tenantCode}</strong><p>{item.kind}</p></div><Status tone={tones[item.status]}>{labels[item.status] || item.status}</Status></div>
          <dl className={styles.details}>
            <div><dt>Audience</dt><dd>{item.audience}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(item.createdAt)}</dd></div>
            <div><dt>Recipients processed</dt><dd>{item.processedRecipients} / {item.recipientCount}</dd></div>
            <div><dt>Consecutive failed attempts</dt><dd>{item.attempts} / 5</dd></div>
            <div><dt>Manual retry cycles</dt><dd>{item.manualRetries} / {data.maxManualRetries}</dd></div>
            <div><dt>{item.status === "PROCESSED" ? "Processed at" : item.status === "QUEUED" ? "Eligible for processing" : "Failure code"}</dt>
              <dd>{item.status === "PROCESSED" ? formatDate(item.processedAt) : item.status === "QUEUED" ? formatDate(item.nextAttemptAt) : item.failureCode || "DELIVERY_FAILED"}</dd></div>
          </dl>
          <div className={styles.rowFooter}><div><small>Event ID</small><code>{item.id}</code>
            {item.lastManualRetryAt && <small>Last manual retry: {formatDate(item.lastManualRetryAt)}</small>}</div>
            {item.status === "FAILED" && (item.manualRetries >= data.maxManualRetries
              ? <span className={styles.muted}>Retry limit reached · investigation required</span>
              : canRetry ? <button type="button" className="secondary-button" disabled={busy || Boolean(selected)}
                onClick={() => { setSelected(item); setReason(""); setConfirmed(false); setRetryError(""); setNotice(""); }}>
                <RotateCcw size={16} aria-hidden="true" />Review retry</button> : <span className={styles.muted}>Retry permission required</span>)}
          </div>
          {canReadAudit && <DeliveryRetryHistory eventId={item.id} paused={busy} />}
        </li>)}</ul>}
      </div>
      {data && <fieldset className={styles.pagination} disabled={busy || loading}>
        <TablePagination itemLabel="deliveries" page={data.page} pageSize={data.pageSize} pageSizeOptions={[10, 20, 50]}
          total={data.total} totalPages={data.totalPages} onPageChange={(page) => changeFilters({ page })}
          onPageSizeChange={(pageSize) => changeFilters({ pageSize })} />
      </fieldset>}
    </section>
  </div>;
}

export default function NotificationDeliveriesPage() {
  const { user } = useAuth();
  const readable = canUser(user, "platform", "platform.notification.read");
  const retryable = canUser(user, "platform", "platform.notification.retry");
  const auditable = canUser(user, "platform", "platform.audit.read");
  return <AppShell area="platform" currentPath={path}>
    {readable ? <Deliveries key={`${user?.id}:${retryable}:${auditable}`} canRetry={retryable} canReadAudit={auditable} />
      : <section className={styles.panel}><h1>Notification deliveries</h1><p>You need notification delivery read permission to access this page.</p></section>}
  </AppShell>;
}
