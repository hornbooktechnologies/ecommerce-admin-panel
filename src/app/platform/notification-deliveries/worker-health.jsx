"use client";

import { useEffect, useState } from "react";
import { Activity, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { notificationDeliveryHealthRequest } from "@/lib/api-client";
import styles from "./worker-health.module.css";

const labels = { RESPONDING: "Responding", DEGRADED: "Reporting failures", STARTING: "Starting",
  NO_HEARTBEAT: "No recent heartbeat", UNOBSERVED: "Not observed" };
const tones = { RESPONDING: "positive", DEGRADED: "danger", STARTING: "neutral", NO_HEARTBEAT: "warning", UNOBSERVED: "warning" };
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata" });
function displayDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? dateTime.format(date) : "Not recorded";
}

export function WorkerHealth({ refreshKey, paused }) {
  const { accessToken } = useAuth();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update(); document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!visible || paused) return;
    let disposed = false, timer, controller, deadline;
    async function load() {
      controller = new AbortController();
      setLoading(true);
      deadline = setTimeout(() => controller.abort(), 15000);
      try {
        const result = await notificationDeliveryHealthRequest({ accessToken, signal: controller.signal });
        if (!disposed && !controller.signal.aborted) { setHealth(result); setError(""); }
        else if (!disposed) { setHealth(null); setError("Health check timed out. Use Refresh to try again."); }
      } catch (failure) {
        if (!disposed) {
          setHealth(null);
          setError(failure.name === "AbortError" ? "Health check timed out. Use Refresh to try again."
            : "Worker health is unavailable. Check API access, database availability and migration 037.");
        }
      } finally {
        clearTimeout(deadline);
        if (!disposed) {
          setLoading(false);
          if (autoRefresh) timer = setTimeout(load, 30000);
        }
      }
    }
    load();
    return () => { disposed = true; clearTimeout(timer); clearTimeout(deadline); controller?.abort(); };
  }, [accessToken, autoRefresh, paused, visible, refreshKey]);

  const snapshotOnly = !autoRefresh || paused || !visible;
  const announcement = error ? "Worker health unavailable." : health
    ? `Inbox worker: ${labels[health.workerStatus] || "Unknown"}. ${health.alerts.length} active warning(s).`
    : "Checking inbox worker health.";

  return <section className={styles.panel} aria-labelledby="worker-health-title">
    <header className={styles.header}><div className={styles.title}><Activity size={21} aria-hidden="true" />
      <div><h2 id="worker-health-title">Inbox worker health</h2><p>Across all tenants · independent of delivery-list filters</p></div></div>
      <label className={styles.toggle}><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />Auto-refresh health</label>
    </header>
    <p className={styles.srOnly} role="status" aria-atomic="true">{announcement}</p>
    <div className={styles.status}>
      <Status tone={error ? "danger" : health ? tones[health.workerStatus] : "neutral"}>
        {error ? "Unavailable" : health ? labels[health.workerStatus] || "Unknown" : "Checking…"}
      </Status>
      <small>{snapshotOnly ? "Snapshot only · live refresh paused" : loading ? "Checking current state…" : "Health refreshes every 30 seconds while this page is visible"}</small>
    </div>
    {error && <p className={styles.error}>{error}</p>}
    {health && <>
      <dl className={styles.metrics}>
        <div><dt>Responsive continuous workers</dt><dd>{health.workers.responsive}</dd></div>
        <div><dt>Events due now</dt><dd>{health.queue.due}</dd></div>
        <div><dt>Potentially stalled events</dt><dd>{health.queue.stalled}</dd></div>
        <div><dt>Scheduled / in retry backoff</dt><dd>{health.queue.scheduled}</dd></div>
      </dl>
      {health.alerts.length > 0 ? <ul className={styles.alerts} aria-label="Active operational warnings">
        {health.alerts.map((alert) => <li key={alert.code} className={alert.tone === "danger" ? styles.danger : styles.warning}>
          <TriangleAlert size={19} aria-hidden="true" /><div><h3>{alert.title}</h3><p>{alert.message}</p></div>
        </li>)}
      </ul> : <p className={styles.quiet}>No warnings at this check. A responding worker does not confirm that customers have read their notifications.</p>}
      <dl className={styles.timestamps}>
        <div><dt>Health checked (IST)</dt><dd>{displayDate(health.checkedAt)}</dd></div>
        <div><dt>Last continuous-worker report (IST)</dt><dd>{displayDate(health.workers.lastHeartbeatAt)}</dd></div>
        <div><dt>Last successful cycle, including idle (IST)</dt><dd>{displayDate(health.workers.lastSuccessAt)}</dd></div>
        <div><dt>Oldest due event without progress</dt><dd>{health.queue.due ? `${Math.floor(health.queue.oldestDueIdleSeconds / 60)} min` : "No due events"}</dd></div>
      </dl>
      <p className={styles.help}>Heartbeat threshold: {health.thresholds.staleSeconds / 60} minutes. Stalled-queue threshold: {health.thresholds.stalledSeconds / 60} minutes since due time or last recorded progress, whichever is later.
        Future retries are excluded. Warnings clear on the next successful health check after the condition resolves.</p>
    </>}
    <footer className={styles.footer}>This panel monitors only the inbox delivery worker—not stock scanning, email or payment recovery.
      It does not start workers, retry deliveries or send external alerts.</footer>
  </section>;
}
