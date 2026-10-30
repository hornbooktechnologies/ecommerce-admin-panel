"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, Eye, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { TablePagination } from "@/components/table-pagination";
import { Status } from "@/components/dashboard-primitives";
import { notificationDeliveryHistoryRequest } from "@/lib/api-client";
import styles from "./delivery-retry-history.module.css";

const dates = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata" });
const labels = { FAILED: "Failed", QUEUED: "Queued", PROCESSED: "Processed" };
const tones = { FAILED: "danger", QUEUED: "warning", PROCESSED: "positive" };
const value = (input) => input ?? "Not recorded";
function dateLabel(input) {
  const date = input ? new Date(input) : null;
  return date && Number.isFinite(date.getTime()) ? dates.format(date) : "Time not recorded";
}

export function DeliveryRetryHistory({ eventId, paused }) {
  const { accessToken } = useAuth();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || paused) return;
    const controller = new AbortController();
    let disposed = false;
    const deadline = setTimeout(() => controller.abort(), 15000);
    setData(null); setError(""); setLoading(true);
    notificationDeliveryHistoryRequest(eventId, pagination, { accessToken, signal: controller.signal })
      .then((result) => {
        if (disposed) return;
        if (controller.signal.aborted) setError("History request timed out. Try Refresh history.");
        else setData(result);
      })
      .catch((failure) => {
        if (!disposed) setError(failure.name === "AbortError" ? "History request timed out. Try Refresh history."
          : failure.message || "Could not load retry history.");
      })
      .finally(() => { clearTimeout(deadline); if (!disposed) setLoading(false); });
    return () => { disposed = true; clearTimeout(deadline); controller.abort(); };
  }, [accessToken, eventId, open, pagination, paused, revision]);

  return <div className={styles.wrapper}>
    <button type="button" className={`secondary-button ${styles.toggle}`} disabled={paused}
      aria-expanded={open} aria-controls={panelId} onClick={() => {
        setOpen((current) => !current); setData(null); setError(""); setPagination((current) => ({ ...current, page: 1 }));
      }}>
      <Eye size={16} aria-hidden="true" />{open ? "Hide retry history" : "View retry history"}
      <ChevronDown size={16} aria-hidden="true" className={open ? styles.expanded : undefined} />
    </button>
    <section id={panelId} hidden={!open} className={styles.panel} aria-labelledby={`${panelId}-title`}>
      <header className={styles.header}><div><h3 id={`${panelId}-title`}>Manual retry history</h3>
        <p>Read-only audit trail · newest first · times in IST</p></div>
        <button type="button" className="secondary-button" disabled={loading || paused} onClick={() => setRevision((current) => current + 1)}>
          <RefreshCw size={16} aria-hidden="true" />Refresh history</button>
      </header>
      <p className={styles.help}>This records accepted manual retry requests, not every automatic attempt. “Queued” records the action at that time; it does not prove successful delivery.</p>
      {paused && <p className={styles.help}>History refresh is paused while a retry is being submitted.</p>}
      <div aria-busy={loading && !paused}>
        {loading && !paused && <p role="status">Loading retry history…</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {data && <>
          <div className={styles.current}><span>Delivery status when history was loaded</span>
            <Status tone={tones[data.event.status]}>{labels[data.event.status] || "Unknown"}</Status>
            <span>{data.event.manualRetries} manual retry cycle(s)</span>
          </div>
          {!data.items.length ? <p className={styles.empty}>No accepted manual retries are recorded for this delivery.</p>
            : <ol className={styles.timeline}>{data.items.map((entry) => <li key={entry.id}>
              <div className={styles.entryHeading}><strong>Manual retry queued</strong><span>{dateLabel(entry.occurredAt)}</span></div>
              <p className={styles.actor}>Requested by <strong>{entry.actorName}</strong></p>
              <dl className={styles.changes}>
                <div><dt>Recorded status change</dt><dd>{labels[entry.before.status] || "Not recorded"} → {labels[entry.after.status] || "Not recorded"}</dd></div>
                <div><dt>Manual retry count</dt><dd>{value(entry.before.manualRetries)} → {value(entry.after.manualRetries)}</dd></div>
                <div><dt>Consecutive failed attempts</dt><dd>{value(entry.before.attempts)} → {value(entry.after.attempts)}</dd></div>
              </dl>
              <div className={styles.reason}><strong>Reason</strong><p>{entry.reason || "No reason recorded."}</p></div>
              <dl className={styles.references}><div><dt>Audit reference</dt><dd><code>{entry.id}</code></dd></div>
                {entry.requestId && <div><dt>Request reference</dt><dd><code>{entry.requestId}</code></dd></div>}</dl>
            </li>)}</ol>}
          <fieldset className={styles.pagination} disabled={paused || loading}>
            <TablePagination itemLabel="retry records" page={data.page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages}
              pageSizeOptions={[10, 20, 50]} onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
              onPageSizeChange={(pageSize) => setPagination({ page: 1, pageSize })} />
          </fieldset>
        </>}
      </div>
    </section>
  </div>;
}
