"use client";

import {useLocalization as useUiLocalization} from '@/localization/provider';
import { useEffect, useRef, useState } from "react";
import { Eye, FileText, RefreshCcw, Save, Send, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { contentStoresRequest, storeContentRequest, saveStoreContentRequest, previewStoreContentRequest,
  publishStoreContentRequest, withdrawStoreContentRequest } from "@/lib/api-client";
import styles from "./page.module.css";

const empty = { title: "", summary: "", body: "" };
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const when = (value) => { const parsed = new Date(value); return value && Number.isFinite(parsed.getTime()) ? date.format(parsed) : "Not published"; };

function ContentEditor({ tenantId, store, pageKey, accessToken, canManage, canPublish, onDirty, onBusy }) {
 const {t: _uiText}=useUiLocalization();

  const [data, setData] = useState(null); const [draft, setDraft] = useState(empty);
  const [loading, setLoading] = useState(true); const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null); const [previewMode, setPreviewMode] = useState("draft");
  const [reviewed, setReviewed] = useState(false); const [withdrawConfirmed, setWithdrawConfirmed] = useState(false);
  const [discardReload, setDiscardReload] = useState(false);
  const tokenRef = useRef(accessToken); tokenRef.current = accessToken;
  const actionRef = useRef(null); const previewRef = useRef(null);
  const fingerprint = JSON.stringify(draft);
  const dirty = Boolean(data && fingerprint !== JSON.stringify(data.draft));
  const validPreview = preview?.fingerprint === fingerprint ? preview.document : null;
  const display = previewMode === "published" ? data?.published : validPreview;
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { onBusy(Boolean(busy) || loading); }, [busy, loading, onBusy]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setMessage(""); setPreview(null); setReviewed(false); setWithdrawConfirmed(false); setPreviewMode("draft");
    storeContentRequest(store.id, pageKey, { tenantId, accessToken: tokenRef.current, signal: controller.signal })
      .then((next) => { if (!controller.signal.aborted) { setData(next); setDraft(next.draft); setPreview(null); setReviewed(false); setWithdrawConfirmed(false); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || "This page could not be loaded. Try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tenantId, store.id, pageKey, reload]);
  useEffect(() => () => actionRef.current?.abort(), []);
  useEffect(() => {
    if (!dirty) return;
    const leave = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", leave); return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  function set(field, value) { setDraft((current) => ({ ...current, [field]: value })); setReviewed(false); setPreview(null); setMessage(""); }
  function requestReload() { if (dirty) setDiscardReload(true); else setReload((value) => value + 1); }
  async function run(action) {
    if (!data || actionRef.current) return;
    if (action === "publish" && (dirty || !reviewed || !validPreview)) return;
    if (action === "withdraw" && (dirty || !withdrawConfirmed)) return;
    const controller = new AbortController(); actionRef.current = controller; setBusy(action); setError(""); setMessage("");
    const context = { tenantId, accessToken: tokenRef.current, signal: controller.signal };
    try {
      if (action === "preview") {
        const next = await previewStoreContentRequest(store.id, pageKey, draft, context);
        if (controller.signal.aborted) return;
        setPreview({ fingerprint, document: next }); setPreviewMode("draft");
        requestAnimationFrame(() => previewRef.current?.focus());
      } else {
        const next = action === "save" ? await saveStoreContentRequest(store.id, pageKey, { revision: data.revision, document: draft }, context)
          : action === "publish" ? await publishStoreContentRequest(store.id, pageKey, data.revision, context)
            : await withdrawStoreContentRequest(store.id, pageKey, data.revision, context);
        if (controller.signal.aborted) return;
        setData(next); setDraft(next.draft); setReviewed(false); setWithdrawConfirmed(false); setPreview(null); setPreviewMode("draft");
        setMessage(action === "save" ? "Draft saved. The live page has not changed." : action === "publish"
          ? "Page published. Refresh the storefront to see the page and footer link."
          : "Page withdrawn from the storefront. Its saved draft has been kept.");
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || "The page could not be updated. Keep your text and try again.");
    } finally { if (actionRef.current === controller) actionRef.current = null; if (!controller.signal.aborted) setBusy(""); }
  }
  if (loading) return <div className={styles.skeleton} role="status" aria-label="Loading store page"><i /><i /><i /></div>;
  if (!data) return <div className={styles.error} role="alert"><p>{error || "Page unavailable."}</p><button type="button" className="button button-secondary" onClick={requestReload}>{_uiText("Try again")}</button></div>;

  return <>
    <div className={styles.statusBar}><div><strong>{data.page.label}</strong><span>{data.published ? _uiText("Published") : "Not published"} · {dirty ? "Unsaved edits" : !data.revision ? "No saved draft" : data.hasUnpublishedChanges ? "Draft changes not live" : "Saved"}</span><small>Last published: {when(data.publishedAt)}{data.publishedAt ? " IST" : ""}</small></div>
      <button type="button" className="button button-secondary" disabled={Boolean(busy)} onClick={requestReload}><RefreshCcw size={16} aria-hidden="true" />Reload saved</button></div>
    {discardReload ? <div className={styles.warning} role="alert"><p>Discard your unsaved text and reload the saved version?</p><div className={styles.actions}><button type="button" className="button button-secondary" onClick={() => setDiscardReload(false)}>Keep editing</button><button type="button" className="button button-danger" onClick={() => { setDiscardReload(false); setReload((value) => value + 1); }}>Discard and reload</button></div></div> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {message ? <p className={styles.success} role="status">{message}</p> : null}
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="content-editor-heading">
        <div className={styles.sectionHeading}><div><p className="eyebrow">Saved separately from the live page</p><h2 id="content-editor-heading">Page draft</h2></div><FileText size={22} aria-hidden="true" /></div>
        {!canManage ? <p className={styles.helper}>Read-only access. A content editor can update this draft.</p> : null}
        <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); if (canManage) run("save"); }}>
          <label><span>Page title (required)</span><input value={draft.title} maxLength={120} required readOnly={!canManage} disabled={Boolean(busy)} onChange={(event) => set("title", event.target.value)} /></label>
          <label><span>Short introduction</span><textarea value={draft.summary} maxLength={500} rows={3} readOnly={!canManage} disabled={Boolean(busy)} onChange={(event) => set("summary", event.target.value)} /></label>
          <label><span>Page content</span><textarea className={styles.bodyInput} value={draft.body} maxLength={30000} rows={14} readOnly={!canManage} disabled={Boolean(busy)} onChange={(event) => set("body", event.target.value)} aria-describedby="page-content-help" /></label>
          <p className={styles.helper} id="page-content-help">Plain text only. Use blank lines between paragraphs. HTML is displayed as text. {draft.body.length.toLocaleString("en-IN")} / 30,000 characters.</p>
          <div className={styles.actions}><button className="button button-secondary" type="button" disabled={Boolean(busy) || !draft.title.trim()} onClick={() => run("preview")}><Eye size={16} aria-hidden="true" />{busy === "preview" ? "Preparing preview…" : "Preview draft"}</button>
            {canManage ? <button className="button button-primary" type="submit" disabled={Boolean(busy) || !draft.title.trim() || (!dirty && data.revision > 0)}><Save size={16} aria-hidden="true" />{busy === "save" ? _uiText("Saving…") : "Save draft"}</button> : null}</div>
        </form>
      </section>
      <section className={`${styles.panel} ${styles.preview}`} aria-label="Content preview" ref={previewRef} tabIndex={-1}>
        <div className={styles.sectionHeading}><div><p className="eyebrow">Content preview</p><h2>{previewMode === "published" ? "Currently live" : "Draft preview"}</h2></div></div>
        <div className={styles.actions}><button className="button button-secondary" type="button" aria-pressed={previewMode === "draft"} onClick={() => setPreviewMode("draft")}>{_uiText("Draft")}</button>{data.published ? <button className="button button-secondary" type="button" aria-pressed={previewMode === "published"} onClick={() => setPreviewMode("published")}>Published version</button> : null}</div>
        {display ? <article className={styles.article}><h3>{display.title}</h3>{display.summary ? <p className={styles.intro}>{display.summary}</p> : null}<div>{(display.paragraphs || display.body.split(/\n\s*\n/).filter((part) => part.trim())).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></article>
          : <p className={styles.empty}>Select Preview draft to review the content. Previews are private and do not publish anything.</p>}
        <p className={styles.helper}>Public address: <code>/pages/{data.page.slug}</code>. The storefront adds its own header and footer.</p>
      </section>
    </div>
    {canPublish ? <section className={styles.panel} aria-labelledby="publish-heading">
      <div className={styles.sectionHeading}><div><p className="eyebrow">Explicit approval required</p><h2 id="publish-heading">Publish to this store</h2></div><ShieldCheck size={22} aria-hidden="true" /></div>
      <p className={styles.helper}>Publishing changes the page customers can read. Use approved business and policy text; this tool does not validate legal compliance or change checkout, refund or shipping rules.</p>
      <label className={styles.check}><input type="checkbox" checked={reviewed} disabled={Boolean(busy) || dirty || !validPreview || !draft.body.trim() || !data.revision} onChange={(event) => setReviewed(event.target.checked)} /><span>I have reviewed this saved draft and approve it for this store.</span></label>
      <div className={styles.actions}><button className="button button-success" type="button" disabled={Boolean(busy) || dirty || !validPreview || !reviewed || !data.revision || !draft.body.trim() || Boolean(data.published && !data.hasUnpublishedChanges)} onClick={() => run("publish")}><Send size={16} aria-hidden="true" />{busy === "publish" ? "Publishing…" : "Publish approved draft"}</button></div>
      {dirty ? <p className={styles.helper}>Save your edits, then preview the saved draft before publishing.</p> : !validPreview ? <p className={styles.helper}>Preview the saved draft to enable publication approval.</p> : null}
      {data.published ? <div className={styles.withdraw}><label className={styles.check}><input type="checkbox" checked={withdrawConfirmed} disabled={Boolean(busy) || dirty} onChange={(event) => setWithdrawConfirmed(event.target.checked)} /><span>Remove this page and its footer link from the storefront. Keep its saved draft.</span></label><button className="button button-danger" type="button" disabled={Boolean(busy) || dirty || !withdrawConfirmed} onClick={() => run("withdraw")}>{busy === "withdraw" ? "Withdrawing…" : "Withdraw published page"}</button></div> : null}
    </section> : null}
  </>;
}

function PagesWorkspace({ tenantId, accessToken, canManage, canPublish }) {
 const {t: _uiText}=useUiLocalization();

  const [query, setQuery] = useState(""); const [options, setOptions] = useState(null);
  const [searching, setSearching] = useState(true); const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const [selection, setSelection] = useState({ store: null, pageKey: "ABOUT" });
  const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [pending, setPending] = useState(null);
  const tokenRef = useRef(accessToken); tokenRef.current = accessToken;
  useEffect(() => {
    const controller = new AbortController(); setSearching(true); setError("");
    const timer = setTimeout(() => {
      contentStoresRequest(query.trim(), { tenantId, accessToken: tokenRef.current, signal: controller.signal })
        .then((data) => { if (!controller.signal.aborted) { setOptions(data); setSelection((current) => current.store ? current : { ...current, store: data.items[0] || null }); } })
        .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || "Stores could not be loaded."); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tenantId, query, retry]);
  function choose(next) { if (next.store?.id === selection.store?.id && next.pageKey === selection.pageKey) return; if (dirty) setPending(next); else { setSelection(next); setDirty(false); } }
  return <div className={styles.workspace}>
    <p className={styles.notice}><ShieldCheck size={21} aria-hidden="true" /><span>Information and policy pages start empty. Save drafts privately and publish only approved content. Each store has its own six pages.</span></p>
    <section className={styles.panel} aria-label="Choose store and page"><div className={styles.selectors}>
      <label><span>Find a store</span><input type="search" value={query} disabled={busy} maxLength={190} onChange={(event) => setQuery(event.target.value)} placeholder="Search store name or code" /></label>
      <label><span>{_uiText("Store")}</span><select value={selection.store?.id || ""} disabled={busy || searching} onChange={(event) => { const store = options?.items.find((item) => item.id === event.target.value); if (store) choose({ ...selection, store }); }}>
        {!selection.store ? <option value="">{searching ? "Loading stores…" : "Choose a store"}</option> : !options?.items.some((store) => store.id === selection.store.id) ? <option value={selection.store.id}>{selection.store.name} · {selection.store.code}</option> : null}
        {options?.items.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.code}{store.status !== "ACTIVE" ? " (inactive)" : ""}</option>)}
      </select></label>
      <label><span>{_uiText("Page")}</span><select value={selection.pageKey} disabled={busy} onChange={(event) => choose({ ...selection, pageKey: event.target.value })}>{(options?.pages || [{ key: "ABOUT", label: "About us" }]).map((page) => <option value={page.key} key={page.key}>{page.label}</option>)}</select></label>
    </div>{options?.hasMore ? <p className={styles.helper}>Showing the first 50 matches. Refine the store search to find another store.</p> : null}
      {selection.store?.status !== "ACTIVE" && selection.store ? <p className={styles.helper}>This store is inactive. Content can be prepared, but public pages remain unavailable until the store is active.</p> : null}
      {error ? <div className={styles.error} role="alert"><p>{error}</p><button className="button button-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry store search</button></div> : null}
      {!searching && options && !options.items.length ? <p className={styles.helper}>No matching stores. Try a different name or code.</p> : null}
    </section>
    {pending ? <div className={styles.warning} role="alert"><p>You have unsaved changes. Discard them and open the selected store/page?</p><div className={styles.actions}><button className="button button-secondary" type="button" onClick={() => setPending(null)}>Keep editing</button><button className="button button-danger" type="button" onClick={() => { setSelection(pending); setPending(null); setDirty(false); }}>Discard and continue</button></div></div> : null}
    {selection.store ? <ContentEditor key={`${selection.store.id}:${selection.pageKey}`} tenantId={tenantId} store={selection.store} pageKey={selection.pageKey} accessToken={accessToken} canManage={canManage} canPublish={canPublish} onDirty={setDirty} onBusy={setBusy} /> : searching ? <p role="status">Loading store options…</p> : null}
  </div>;
}
export default function StorePagesPage() {
  const { user, accessToken, activeTenantId } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canRead = canUser(user, "admin", "store.content.read", tenantId);
  return <AppShell area="admin" currentPath="/admin/store-pages" eyebrow="Storefront & marketing" title="Store pages" description="Manage information and approved policy content without changing the live page while you edit.">
    {tenantId && accessToken && canRead ? <PagesWorkspace key={`${user.id}:${tenantId}`} tenantId={tenantId} accessToken={accessToken} canManage={canUser(user, "admin", "store.content.manage", tenantId)} canPublish={canUser(user, "admin", "store.content.publish", tenantId)} />
      : <p role="status">Your role does not have permission to manage store pages in this workspace.</p>}
  </AppShell>;
}
