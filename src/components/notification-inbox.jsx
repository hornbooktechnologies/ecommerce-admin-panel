"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Boxes, Building2, ClipboardCheck, FileSpreadsheet, ShieldCheck, CheckCheck, ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, ShoppingBag, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { listInboxRequest, inboxUnreadRequest, markInboxRequest, markAllInboxRequest } from "@/lib/api-client";
import { notificationDestination, notificationTime } from "@/lib/inbox-navigation";

const typeLabels = { ORDERS: "Orders & delivery", RETURNS: "Returns & exchanges", PAYMENTS: "Payments",
  INVENTORY: "Inventory", WARRANTIES: "Warranties", IMPORTS: "Imports", APPROVALS: "Approvals", TENANTS: "Tenant updates" };

export function NotificationInbox({ area, tenantId, merchantId, items }) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false), [closing, setClosing] = useState(false);
  const [filter, setFilter] = useState("ALL"), [page, setPage] = useState(1);
  const [category, setCategory] = useState("ALL"), [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const searchRef = useRef(null);
  const narrowed = category !== "ALL" || Boolean(search);
  const [data, setData] = useState(null), [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [actionError, setActionError] = useState(""), [announcement, setAnnouncement] = useState("");
  const [pending, setPending] = useState(false), [refresh, setRefresh] = useState(0);
  const dialogRef = useRef(null), triggerRef = useRef(null), allFilterRef = useRef(null);
  const closeTimer = useRef(null), mutation = useRef(null);
  const view = `${filter}:${page}:${category}:${search}`;
  const result = data?.view === view ? data : null;

  useEffect(() => () => { mutation.current?.abort(); window.clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, [open]);

  useEffect(() => {
    if (!accessToken || (area !== "platform" && !tenantId) || pending) return;
    let active = true, controller;
    setLoading(true);
    async function load() {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      const current = new AbortController(); controller = current;
      try {
        const context = { accessToken, tenantId, merchantId, signal: current.signal };
        const next = open ? await listInboxRequest(area, { filter, page, category, search }, context) : await inboxUnreadRequest(area, context);
        if (!active || current.signal.aborted) return;
        setCount(next.unreadCount); setError("");
        if (open) {
          if (page > next.totalPages) { setPage(next.totalPages); return; }
          setData({ ...next, view: `${filter}:${page}:${category}:${search}` });
        }
      } catch (e) {
        if (!active || current.signal.aborted) return;
        setCount(null); setData(null);
        setError(e.message || "Notifications could not be loaded. Please try again.");
      } finally {
        if (active && !current.signal.aborted) setLoading(false);
      }
    }
    load();
    const timer = window.setInterval(load, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); else controller?.abort(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      active = false; controller?.abort(); window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", load);
    };
  }, [accessToken, area, tenantId, merchantId, open, filter, page, category, search, refresh, pending]);

  function close(afterClose) {
    if (closing) return;
    setClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
    closeTimer.current = window.setTimeout(() => {
      dialogRef.current?.close(); setOpen(false); setClosing(false);
      triggerRef.current?.focus(); afterClose?.();
    }, delay);
  }

  async function update(item, href) {
    if (pending || (!item && narrowed)) return;
    const controller = new AbortController(); mutation.current = controller;
    setPending(true); setActionError("");
    try {
      const context = { accessToken, tenantId, merchantId, signal: controller.signal };
      if (item) await markInboxRequest(area, item.id, href ? true : !item.readAt, context);
      else await markAllInboxRequest(area, result.readThroughId, context);
      if (controller.signal.aborted) return;
      setAnnouncement(item ? (href || !item.readAt ? "Notification marked read." : "Notification marked unread.") : "Notifications marked read. New arrivals remain unread.");
      if (href) close(() => router.push(href));
      else if (filter === "UNREAD" || !item) allFilterRef.current?.focus();
      setRefresh(n => n + 1);
    } catch (e) {
      if (!controller.signal.aborted) {
        setActionError(e.status === 404 ? "This update is no longer available. Refresh your inbox." : e.message || "Could not save the change. Please try again.");
        if ([401, 403, 404].includes(e.status)) { setData(null); setCount(null); }
      }
    } finally { if (!controller.signal.aborted) setPending(false); }
  }

  const platform = area === "platform";
  const types = platform ? ["TENANTS"] : area === "vendor" ? ["ORDERS"]
    : ["ORDERS", "RETURNS", "PAYMENTS", "INVENTORY", "WARRANTIES", "IMPORTS", "APPROVALS"];
  const scopeLabel = platform ? "Across tenants" : "Current workspace";
  const emptyMessage = platform
    ? "Tenant lifecycle updates appear here. Open a tenant to check its current status."
    : "Supported workspace updates appear here. Stock alerts are snapshots; check inventory for current quantities.";
  const badge = count > 99 ? "99+" : count;
  return <>
    <button className="icon-button notification-trigger" type="button" ref={triggerRef}
      aria-label={error ? "Notifications, unavailable" : `Notifications${count ? `, ${count} unread` : ""}`}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => { setActionError(""); setAnnouncement(""); setOpen(true); }}>
      <Bell size={19} aria-hidden="true" />{count > 0 ? <span className="notification-badge" aria-hidden="true">{badge}</span> : error ? <span className="notification-badge" aria-hidden="true">!</span> : null}
    </button>
    {!open ? <span role="status" className="sr-only">{count === null ? "" : `${count} unread notifications`}</span> : null}
    {open ? <dialog className="notification-dialog" ref={dialogRef} aria-labelledby="notification-title"
      onKeyDown={e => {
        if (e.key !== "Tab") return;
        const controls = [...e.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')]
          .filter(el => el.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }}
      data-closing={closing || undefined} onCancel={e => { e.preventDefault(); close(); }} onClick={e => {
        if (e.target !== e.currentTarget) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) close();
      }}>
      <header className="notification-header"><div><p className="eyebrow">{platform ? "Platform updates" : "Workspace updates"}</p><h2 id="notification-title">Notifications</h2><p>{count === null ? scopeLabel : `${count} unread across all types · ${scopeLabel}`}</p></div>
        <button className="icon-button" type="button" aria-label="Close notifications" autoFocus onClick={() => close()}><X size={20} aria-hidden="true" /></button></header>
      <div className="notification-toolbar">
        <div className="notification-filters" role="group" aria-label="Filter notifications">
          <button type="button" ref={allFilterRef} aria-pressed={filter === "ALL"} disabled={pending} onClick={() => { setFilter("ALL"); setPage(1); }}>All</button>
          <button type="button" aria-pressed={filter === "UNREAD"} disabled={pending} onClick={() => { setFilter("UNREAD"); setPage(1); }}>Unread</button>
        </div>
        <button type="button" className="notification-text-action" disabled={narrowed || pending || loading || !result?.readThroughId || !count}
          onClick={() => update(null)}><CheckCheck size={17} aria-hidden="true" />Mark all read</button>
        <button className="icon-button" type="button" disabled={pending || loading} aria-label="Refresh notifications" onClick={() => { setActionError(""); setRefresh(n => n + 1); }}><RefreshCw size={17} aria-hidden="true" /></button>
      </div>
      <div className="notification-scroll" aria-busy={loading || pending}>
        <form className="notification-search" role="search" aria-label="Search notifications" onSubmit={e => {
          e.preventDefault(); if (pending) return; setSearch(searchDraft.trim()); setPage(1); setActionError(""); setRefresh(n => n + 1);
        }}>
          <fieldset disabled={pending}>
            <label>Notification type<select value={category} onChange={e => { setCategory(e.target.value); setPage(1); setActionError(""); }}>
              <option value="ALL">All types</option>{types.map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
            <label>Search updates<input ref={searchRef} type="search" maxLength={100} value={searchDraft} placeholder="Title or message"
              onChange={e => setSearchDraft(e.target.value)} /></label>
            <div className="notification-search-actions"><button className="notification-text-action" type="submit">Search</button>
              <button className="notification-text-action" type="button" disabled={!narrowed && !searchDraft} onClick={() => {
                setCategory("ALL"); setSearch(""); setSearchDraft(""); setPage(1); setActionError(""); searchRef.current?.focus();
              }}>Clear search &amp; type</button></div>
          </fieldset>
          {narrowed && <p>Filtered results. Clear search and type to enable “Mark all read”.</p>}
          {search && <p>Searching for: <strong>{search}</strong></p>}
          {result && <p role="status">{result.total} {narrowed ? "matching " : ""}{filter === "UNREAD" ? "unread " : ""}updates</p>}
        </form>
        {actionError ? <p className="notification-error" role="alert">{actionError}</p> : null}
        {error ? <div className="notification-empty"><Bell size={28} aria-hidden="true" /><h3>Updates unavailable</h3><p role="alert">{error}</p><button className="button button-secondary" type="button" onClick={() => setRefresh(n => n + 1)}>Try again</button></div>
          : !result ? <div className="notification-skeleton" role="status" aria-label="Loading notifications">{[1, 2, 3].map(n => <span key={n}><i /><i /></span>)}</div>
          : !result.items.length ? <div className="notification-empty"><Bell size={30} aria-hidden="true" /><h3>{narrowed ? "No matching updates" : filter === "UNREAD" ? "You’re all caught up" : "No updates yet"}</h3><p>{narrowed ? "Try another type or search, or clear these filters to see other updates." : filter === "UNREAD" ? (platform ? "There are no unread platform updates." : "There are no unread updates in this workspace.") : emptyMessage}</p></div>
          : <ol className="notification-list">{result.items.map(item => {
            const href = notificationDestination(item, { area, tenantId, merchantId, items });
            const Icon = item.category === "RETURNS" ? RotateCcw : item.category === "INVENTORY" ? Boxes : item.category === "WARRANTIES" ? ShieldCheck : item.category === "IMPORTS" ? FileSpreadsheet : item.category === "APPROVALS" ? ClipboardCheck : item.category === "TENANTS" ? Building2 : ShoppingBag;
            return <li key={item.id} data-unread={!item.readAt || undefined}>
              <span className="notification-item-icon"><Icon size={18} aria-hidden="true" /></span>
              <div className="notification-copy"><div className="notification-item-title"><h3>{item.title}</h3>{!item.readAt ? <span>Unread</span> : null}</div>
                <p>{item.message}</p><time dateTime={item.createdAt}>{notificationTime(item.createdAt)} IST</time>
                <div className="notification-item-actions">
                  {href ? <button className="notification-text-action" type="button" disabled={pending} onClick={() => update(item, href)}>Open {item.target.type === "RETURN" ? "return" : item.target.type === "INVENTORY_BALANCE" ? "inventory" : item.target.type === "WARRANTY_CLAIM" ? "warranties" : item.target.type === "BULK_IMPORT" ? "imports" : item.target.type === "PRODUCT_APPROVAL" ? "catalog" : item.target.type === "VENDOR_APPROVAL" ? "vendors" : item.target.type === "TENANT" ? "tenant" : "order"}<ArrowUpRight size={16} aria-hidden="true" /></button> : <small>Record link unavailable</small>}
                  <button className="notification-text-action" type="button" disabled={pending} onClick={() => update(item)} aria-label={`Mark ${item.title} ${item.readAt ? "unread" : "read"}`}>Mark {item.readAt ? "unread" : "read"}</button>
                </div>
              </div>
            </li>;
          })}</ol>}
      </div>
      <footer className="notification-footer"><span role="status" className="sr-only">{announcement}</span>
        <span>{pending ? "Saving…" : result?.total ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, result.total)} of ${result.total}` : "10 updates per page"}</span>
        <nav aria-label="Notification pages"><button className="icon-button" type="button" aria-label="Previous notifications page" disabled={pending || loading || page <= 1} onClick={() => setPage(n => n - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <span>Page {page}{result ? ` of ${result.totalPages}` : ""}</span>
          <button className="icon-button" type="button" aria-label="Next notifications page" disabled={pending || loading || !result || page >= result.totalPages} onClick={() => setPage(n => n + 1)}><ChevronRight size={18} aria-hidden="true" /></button></nav>
      </footer>
    </dialog> : null}
  </>;
}
