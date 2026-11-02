"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, RefreshCcw, Search, UserMinus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { TablePagination } from "@/components/table-pagination";
import { Status } from "@/components/dashboard-primitives";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { newsletterSubscribersRequest, unsubscribeNewsletterRequest } from "@/lib/api-client";
import styles from "./newsletter.module.css";

const labels = { PENDING: "Awaiting confirmation", ACTIVE: "Subscribed", UNSUBSCRIBED: "Unsubscribed" };
const tones = { PENDING: "warning", ACTIVE: "positive", UNSUBSCRIBED: "neutral" };
const emptyFilters = { search: "", storeId: "", status: "ALL", page: 1, pageSize: 10 };
const formatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
function when(value) { const time = new Date(value); return value && Number.isFinite(time.getTime()) ? formatter.format(time) : "Not recorded"; }

export default function NewsletterPage() {
  const { user, accessToken, activeTenantId } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canRead = canUser(user, "admin", "newsletter.read", tenantId);
  const canManage = canUser(user, "admin", "newsletter.manage", tenantId);
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState(""); const [version, setVersion] = useState(0);
  const [result, setResult] = useState(null); const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true); const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState(""); const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false); const confirmRef = useRef(null);
  const requestRef = useRef(null);
  const scopeKey = `${tenantId || ""}:${accessToken || ""}`;
  const liveScope = useRef(scopeKey); liveScope.current = scopeKey;
  const resultKey = `${scopeKey}:${JSON.stringify(filters)}:${version}`;
  const visible = result?.key === resultKey ? result.data : null;

  useEffect(() => {
    setFilters(emptyFilters); setSearch(""); setSelected(null); setReason(""); setConfirmed(false); setError(""); setMessage("");
    requestRef.current?.abort(); setSaving(false);
  }, [scopeKey]);
  useEffect(() => {
    if (!tenantId || !accessToken || !canRead) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError("");
    newsletterSubscribersRequest(filters, { accessToken, tenantId, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setResult({ key: resultKey, data }); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || "Subscribers could not be loaded. Try refreshing."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accessToken, tenantId, canRead, filters, resultKey]);
  useEffect(() => { if (selected) confirmRef.current?.focus(); }, [selected]);
  useEffect(() => () => requestRef.current?.abort(), []);

  function review(item) { setSelected({ ...item, scopeKey }); setReason(""); setConfirmed(false); setError(""); setMessage(""); }
  async function unsubscribe(event) {
    event.preventDefault();
    if (!selected || selected.scopeKey !== scopeKey || !canManage || saving || !confirmed) return;
    const controller = new AbortController(); requestRef.current = controller; setSaving(true); setError("");
    const startedScope = scopeKey;
    try {
      const data = await unsubscribeNewsletterRequest(selected.id, { expectedRevision: selected.revision,
        reason: reason.trim(), confirmed: true }, { accessToken, tenantId, signal: controller.signal });
      if (controller.signal.aborted || liveScope.current !== startedScope) return;
      setMessage(data.message); setSelected(null); setVersion((value) => value + 1);
    } catch (failure) {
      if (!controller.signal.aborted && liveScope.current === startedScope) {
        const message = failure.message || "The request could not be completed. Refresh before retrying.";
        setError(message);
      }
    } finally { if (liveScope.current === startedScope) setSaving(false); }
  }

  return <AppShell area="admin" currentPath="/admin/newsletter" eyebrow="Storefront & marketing" title="Newsletter subscribers"
    description="Review confirmed consent and manage newsletter subscriptions. All times are shown in IST.">
    <div className={styles.workspace}>
      <p className={styles.notice}><Mail size={20} aria-hidden="true" /><span>Only <strong>Subscribed</strong> addresses have confirmed their email. Checkout and customer registration never subscribe people automatically. Campaign sending is not included here.</span></p>
      {!canRead ? <p role="status">Your role does not have permission to view newsletter subscribers.</p> : <>
        <section className={styles.panel} aria-labelledby="newsletter-heading">
          <div className={styles.heading}><div><p className="eyebrow">Consent directory</p><h2 id="newsletter-heading">Subscribers</h2></div>
            <button className="button button-secondary" type="button" disabled={saving || loading} onClick={() => { setSelected(null); setVersion((value) => value + 1); }}><RefreshCcw size={16} aria-hidden="true" />Refresh</button></div>
          <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); setSelected(null); setFilters((value) => ({ ...value, search: search.trim(), page: 1 })); }}>
            <label><span>Email address</span><input type="search" value={search} maxLength={254} placeholder="Search email address" onChange={(event) => setSearch(event.target.value)} disabled={saving} /></label>
            <label><span>Store</span><select value={filters.storeId} disabled={saving} onChange={(event) => { setSelected(null); setFilters((value) => ({ ...value, storeId: event.target.value, page: 1 })); }}>
              <option value="">All stores</option>{(result?.key.startsWith(`${scopeKey}:`) ? result.data.stores : []).map((store) => <option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}
            </select></label>
            <label><span>Status</span><select value={filters.status} disabled={saving} onChange={(event) => { setSelected(null); setFilters((value) => ({ ...value, status: event.target.value, page: 1 })); }}>
              <option value="ALL">All statuses</option>{Object.entries(labels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
            </select></label>
            <button className="button button-primary" type="submit" disabled={saving}><Search size={16} aria-hidden="true" />Search</button>
          </form>
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {message ? <p className={styles.success} role="status">{message}</p> : null}
          {selected?.scopeKey === scopeKey && canManage ? <form className={styles.confirmation} onSubmit={unsubscribe} aria-label="Confirm unsubscribe" ref={confirmRef} tabIndex={-1}>
            <h3>Unsubscribe {selected.email}?</h3><p>This also cancels any pending confirmation. The email owner must confirm again to subscribe later.</p>
            <label><span>Reason (required)</span><input value={reason} minLength={3} maxLength={300} required disabled={saving} onChange={(event) => setReason(event.target.value)} placeholder="For example: requested by the recipient" /></label>
            <label className={styles.checkbox}><input type="checkbox" checked={confirmed} required disabled={saving} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm this unsubscribe request.</span></label>
            <div className={styles.actions}><button className="button button-secondary" type="button" disabled={saving} onClick={() => setSelected(null)}>Cancel</button><button className="button button-danger" type="submit" disabled={!confirmed || reason.trim().length < 3 || saving}>{saving ? "Unsubscribing…" : "Confirm unsubscribe"}</button></div>
          </form> : null}
          {loading || (!visible && !error) ? <div className={styles.skeleton} role="status" aria-label="Loading subscribers">{[1, 2, 3, 4, 5].map((row) => <div key={row} />)}</div>
            : !visible ? <p role="status">Subscriber data is unavailable. Select Refresh to try again.</p>
              : !visible.items.length ? <div className={styles.empty}><Mail size={28} aria-hidden="true" /><h3>No matching subscribers</h3><p>New requests appear here after someone submits the storefront newsletter form.</p></div>
                : <>
                  <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Email & store</th><th>Status</th><th>Consent</th><th>Subscription history</th><th>Action</th></tr></thead><tbody>
                    {visible.items.map((item) => <tr key={item.id}>
                      <td data-label="Email & store"><strong>{item.email}</strong><small>{item.storeName} · {item.storeCode}</small></td>
                      <td data-label="Status"><Status tone={tones[item.status]}>{labels[item.status]}</Status>{item.status === "PENDING" && item.confirmationDelivery === "FAILED" ? <small className={styles.warning}>Confirmation email failed; the recipient can request a new link.</small> : null}</td>
                      <td data-label="Consent"><span>Requested {when(item.consentRequestedAt)}</span><small>{item.consentVersion}</small></td>
                      <td data-label="History"><span>{item.confirmedAt ? `Confirmed ${when(item.confirmedAt)}` : "Email not confirmed"}</span>{item.unsubscribedAt ? <small>Last unsubscribed {when(item.unsubscribedAt)}</small> : null}</td>
                      <td data-label="Action">{canManage && item.status !== "UNSUBSCRIBED" ? <button className="button button-danger" type="button" disabled={saving} onClick={() => review(item)}><UserMinus size={16} aria-hidden="true" />Unsubscribe</button> : <span>{item.status === "UNSUBSCRIBED" ? "No action needed" : "Read only"}</span>}</td>
                    </tr>)}
                  </tbody></table></div>
                  <TablePagination itemLabel="subscribers" page={visible.page} pageSize={visible.pageSize} total={visible.total} totalPages={visible.totalPages}
                    onPageChange={(page) => { if (!saving) { setSelected(null); setFilters((value) => ({ ...value, page })); } }}
                    onPageSizeChange={(pageSize) => { if (!saving) { setSelected(null); setFilters((value) => ({ ...value, page: 1, pageSize })); } }} />
                </>}
        </section>
      </>}
    </div>
  </AppShell>;
}
