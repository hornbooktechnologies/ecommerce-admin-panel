"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownLeft, ArrowUpRight, BadgeIndianRupee, CalendarClock, Edit3,
  IndianRupee, Landmark, Plus, Search, SlidersHorizontal, Store, WalletCards, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { createCommissionRuleRequest, marketplaceFinanceRequest, reconcileMarketplaceLedgerRequest,
  updateCommissionRuleRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const titleCase = (value) => value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const statusTone = { ACTIVE: "positive", INACTIVE: "neutral", UNSETTLED: "warning", IN_SETTLEMENT: "info", SETTLED: "positive" };
const localDate = (value) => { const date = value ? new Date(value) : new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };

function useDialog(onClose, dialogRef, disabled) {
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const keydown = (event) => {
      if (event.key === "Escape" && !disabled) onClose();
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled])") || [])];
      if (!focusable.length) return; const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); };
  }, [disabled, onClose, dialogRef]);
}

function ruleForm(rule) {
  return { scopeType: rule?.scopeType || "GLOBAL", merchantId: rule?.merchantId || "", storeId: rule?.storeId || "",
    commissionType: rule?.commissionType || "PERCENTAGE", commissionPercent: rule?.commissionPercent ?? "",
    commissionAmount: rule?.commissionAmount ?? "", minimumCommission: rule?.minimumCommission ?? "",
    maximumCommission: rule?.maximumCommission ?? "", appliesOn: rule?.appliesOn || "TAXABLE_VALUE",
    priority: rule?.priority ?? 0, effectiveFrom: localDate(rule?.effectiveFrom),
    effectiveTo: rule?.effectiveTo ? localDate(rule.effectiveTo) : "", status: rule?.status || "ACTIVE" };
}

function optionalNumber(value) { return value === "" ? null : Number(value); }

function RuleEditor({ accessToken, item, merchants, onClose, onSaved, stores, tenantId }) {
  const [form, setForm] = useState(() => ruleForm(item)); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const dialogRef = useRef(null); useDialog(onClose, dialogRef, saving);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function save(event) {
    event.preventDefault(); setSaving(true); setError("");
    const payload = { ...form, merchantId: form.scopeType === "MERCHANT" ? form.merchantId : null,
      storeId: form.scopeType === "STORE" ? form.storeId : null,
      commissionPercent: form.commissionType === "PERCENTAGE" ? optionalNumber(form.commissionPercent) : null,
      commissionAmount: form.commissionType === "FIXED" ? optionalNumber(form.commissionAmount) : null,
      minimumCommission: optionalNumber(form.minimumCommission), maximumCommission: optionalNumber(form.maximumCommission),
      priority: Number(form.priority || 0), effectiveFrom: new Date(form.effectiveFrom).toISOString(),
      effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null };
    try { const result = item ? await updateCommissionRuleRequest(item.id, payload, accessToken, tenantId)
      : await createCommissionRuleRequest(payload, accessToken, tenantId); onSaved(result); }
    catch (requestError) { setError(requestError.message || "The commission rule could not be saved."); }
    finally { setSaving(false); }
  }
  return createPortal(<div className="dialog-backdrop finance-dialog-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !saving) onClose();
  }} role="presentation"><section aria-labelledby="commission-rule-title" aria-modal="true" className="finance-rule-dialog" ref={dialogRef} role="dialog">
    <header><span><SlidersHorizontal aria-hidden="true" size={21} /></span><div><p className="eyebrow">Marketplace terms</p><h2 id="commission-rule-title">{item ? "Edit commission rule" : "New commission rule"}</h2><small>Define when and where platform commission applies.</small></div><button aria-label="Close commission rule editor" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button></header>
    <form id="commission-rule-form" onSubmit={save}><div className="finance-rule-grid">
      <label className="form-field"><span>Rule scope <em>*</em></span><select autoFocus value={form.scopeType} onChange={(event) => set("scopeType", event.target.value)}><option value="GLOBAL">All marketplace sales</option><option value="MERCHANT">One merchant</option><option value="STORE">One store</option></select></label>
      {form.scopeType === "MERCHANT" ? <label className="form-field"><span>Merchant <em>*</em></span><select required value={form.merchantId} onChange={(event) => set("merchantId", event.target.value)}><option value="">Select merchant</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name} · {merchant.code}</option>)}</select></label> : null}
      {form.scopeType === "STORE" ? <label className="form-field"><span>Store <em>*</em></span><select required value={form.storeId} onChange={(event) => set("storeId", event.target.value)}><option value="">Select store</option>{stores.map((storeItem) => <option key={storeItem.id} value={storeItem.id}>{storeItem.name} · {storeItem.code}</option>)}</select></label> : null}
      <label className="form-field"><span>Calculation <em>*</em></span><select value={form.commissionType} onChange={(event) => set("commissionType", event.target.value)}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed INR amount</option></select></label>
      {form.commissionType === "PERCENTAGE" ? <label className="form-field"><span>Commission (%) <em>*</em></span><input max="100" min="0" required step="0.01" type="number" value={form.commissionPercent} onChange={(event) => set("commissionPercent", event.target.value)} /></label> : <label className="form-field"><span>Commission amount (₹) <em>*</em></span><input min="0" required step="0.01" type="number" value={form.commissionAmount} onChange={(event) => set("commissionAmount", event.target.value)} /></label>}
      <label className="form-field"><span>Calculated on</span><select value={form.appliesOn} onChange={(event) => set("appliesOn", event.target.value)}><option value="TAXABLE_VALUE">Taxable value</option><option value="ITEM_TOTAL">Item total</option><option value="ORDER_TOTAL">Order total</option></select></label>
      <label className="form-field"><span>Priority</span><input max="9999" min="0" type="number" value={form.priority} onChange={(event) => set("priority", event.target.value)} /></label>
      <label className="form-field"><span>Minimum commission (₹)</span><input min="0" step="0.01" type="number" value={form.minimumCommission} onChange={(event) => set("minimumCommission", event.target.value)} /></label>
      <label className="form-field"><span>Maximum commission (₹)</span><input min="0" step="0.01" type="number" value={form.maximumCommission} onChange={(event) => set("maximumCommission", event.target.value)} /></label>
      <label className="form-field"><span>Effective from <em>*</em></span><input required type="datetime-local" value={form.effectiveFrom} onChange={(event) => set("effectiveFrom", event.target.value)} /></label>
      <label className="form-field"><span>Effective until</span><input type="datetime-local" value={form.effectiveTo} onChange={(event) => set("effectiveTo", event.target.value)} /></label>
      <label className="form-field"><span>Status</span><select value={form.status} onChange={(event) => set("status", event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
    </div>{error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}</form>
    <footer><p>Higher priority wins when active rules share the same scope.</p><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} form="commission-rule-form" type="submit">{saving ? "Saving…" : item ? "Save rule" : "Create rule"}</button></div></footer>
  </section></div>, document.body);
}

function FinanceSkeleton() {
  return <div className="finance-skeleton" aria-label="Loading marketplace finance" role="status"><div>{[1, 2, 3, 4].map((item) => <i key={item} />)}</div><section><span />{[1, 2, 3, 4, 5].map((item) => <b key={item} />)}</section></div>;
}

export default function MarketplaceFinancePage() {
  const { accessToken, activeTenantId, user } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "marketplace.settlement.manage", tenantId);
  const [tab, setTab] = useState("ledger"); const [draftSearch, setDraftSearch] = useState("");
  const [filters, setFilters] = useState({ search: "", merchantId: "", entryType: "ALL", settlementStatus: "ALL", page: 1, pageSize: 10 });
  const [result, setResult] = useState(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [editor, setEditor] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const load = useCallback(async () => { if (!accessToken || !tenantId) return; setLoading(true); setError("");
    try { setResult(await marketplaceFinanceRequest(filters, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Marketplace finance could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); }, [load]);
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  const summary = result?.summary || { currentBalance: 0, unsettledBalance: 0, grossSales: 0, commission: 0 };
  const activeRules = useMemo(() => (result?.rules || []).filter((rule) => rule.status === "ACTIVE").length, [result]);
  async function reconcile() { setReconciling(true); setError(""); setNotice("");
    try { const posted = await reconcileMarketplaceLedgerRequest(accessToken, tenantId);
      setNotice(posted.postedSellerOrders ? `${posted.postedSellerOrders} seller order${posted.postedSellerOrders === 1 ? "" : "s"} posted to the ledger.` : "No eligible completed seller orders were found.");
      await load(); }
    catch (requestError) { setError(requestError.message || "Eligible seller orders could not be posted."); }
    finally { setReconciling(false); }
  }
  const action = canManage ? <div className="finance-page-actions"><button className="button button-secondary" disabled={reconciling} onClick={reconcile} type="button"><Landmark aria-hidden="true" size={17} />{reconciling ? "Posting…" : "Post eligible orders"}</button><button className="button button-primary" onClick={() => setEditor({})} type="button"><Plus aria-hidden="true" size={17} />New commission rule</button></div> : null;
  return <AppShell action={action} area="admin" currentPath="/admin/finance" eyebrow="Marketplace finance" title="Vendor ledger" description="Review merchant balances and control effective-dated commission terms in INR.">
    {loading && !result ? <FinanceSkeleton /> : <><section className="finance-signals" aria-label="Marketplace balance summary">
      <article><span><WalletCards aria-hidden="true" size={19} /></span><div><small>Current balance</small><strong>{money.format(summary.currentBalance)}</strong><em>Net merchant payable</em></div></article>
      <article><span><CalendarClock aria-hidden="true" size={19} /></span><div><small>Unsettled</small><strong>{money.format(summary.unsettledBalance)}</strong><em>Awaiting settlement</em></div></article>
      <article><span><ArrowUpRight aria-hidden="true" size={19} /></span><div><small>Gross sales</small><strong>{money.format(summary.grossSales)}</strong><em>Ledger sale credits</em></div></article>
      <article><span><BadgeIndianRupee aria-hidden="true" size={19} /></span><div><small>Commission</small><strong>{money.format(summary.commission)}</strong><em>{activeRules} active rules</em></div></article>
    </section><section className="tenant-directory finance-workspace" aria-labelledby="finance-workspace-title"><header className="finance-workspace-head"><div><p className="eyebrow">Commercial records</p><h2 id="finance-workspace-title">Ledger and commission rules</h2></div><div className="finance-tabs" role="tablist"><button aria-selected={tab === "ledger"} onClick={() => setTab("ledger")} role="tab" type="button">Vendor ledger <span>{result?.total || 0}</span></button><button aria-selected={tab === "rules"} onClick={() => setTab("rules")} role="tab" type="button">Commission rules <span>{result?.rules?.length || 0}</span></button></div></header>
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
      {notice ? <div className="inline-state finance-notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} type="button">Dismiss</button></div> : null}
      {tab === "ledger" ? <><form className="directory-filters finance-filters" onSubmit={(event) => { event.preventDefault(); updateFilter("search", draftSearch.trim()); }} role="search"><label className="compact-search"><span className="sr-only">Search vendor ledger</span><Search aria-hidden="true" size={16} /><input placeholder="Merchant, order or description" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Merchant" value={filters.merchantId} onChange={(event) => updateFilter("merchantId", event.target.value)}><option value="">All merchants</option>{(result?.merchants || []).map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}</select><select aria-label="Entry type" value={filters.entryType} onChange={(event) => updateFilter("entryType", event.target.value)}><option value="ALL">All entry types</option><option value="SALE_CREDIT">Sale credits</option><option value="COMMISSION_DEBIT">Commission debits</option><option value="COMMISSION_GST_DEBIT">Commission GST</option><option value="RETURN_DEBIT">Return debits</option></select><select aria-label="Settlement status" value={filters.settlementStatus} onChange={(event) => updateFilter("settlementStatus", event.target.value)}><option value="ALL">All settlement states</option><option value="UNSETTLED">Unsettled</option><option value="IN_SETTLEMENT">In settlement</option><option value="SETTLED">Settled</option></select><button className="button button-secondary" type="submit">Search</button></form>
        {loading ? <div className="finance-refresh" role="status">Refreshing ledger…</div> : result?.entries?.length ? <><div className="table-wrap finance-ledger-wrap"><table className="tenant-table finance-ledger-table"><thead><tr><th>Entry</th><th>Merchant</th><th>Reference</th><th>Effective</th><th>Amount</th><th>Settlement</th></tr></thead><tbody>{result.entries.map((entry) => <tr key={entry.id}><td data-label="Entry"><span className="finance-entry"><i data-direction={entry.direction}>{entry.direction === "CREDIT" ? <ArrowDownLeft aria-hidden="true" size={16} /> : <ArrowUpRight aria-hidden="true" size={16} />}</i><span><strong>{titleCase(entry.entryType)}</strong><small>{entry.description || "Marketplace ledger entry"}</small></span></span></td><td data-label="Merchant"><strong>{entry.merchantName}</strong><small className="finance-sub">{entry.merchantCode}</small></td><td data-label="Reference"><strong>{entry.sellerOrderNumber || titleCase(entry.referenceType)}</strong><small className="finance-sub">{titleCase(entry.referenceType)}</small></td><td data-label="Effective"><strong>{dateTime.format(new Date(entry.effectiveAt))}</strong>{entry.availableAt ? <small className="finance-sub">Available {dateTime.format(new Date(entry.availableAt))}</small> : null}</td><td data-label="Amount"><strong className={entry.balanceEffect >= 0 ? "finance-credit" : "finance-debit"}>{entry.balanceEffect >= 0 ? "+" : "−"}{money.format(Math.abs(entry.balanceEffect))}</strong><small className="finance-sub">{entry.direction}</small></td><td data-label="Settlement"><Status tone={statusTone[entry.settlementStatus]}>{titleCase(entry.settlementStatus)}</Status></td></tr>)}</tbody></table></div><TablePagination itemLabel="ledger entries" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></> : <div className="empty-workspace"><Landmark aria-hidden="true" size={30} /><h3>No ledger entries yet</h3><p>Entries will appear as marketplace orders become financially eligible.</p></div>}</>
        : <div className="finance-rules-list">{(result?.rules || []).map((rule) => <article key={rule.id}><div className="finance-rule-scope"><span>{rule.scopeType === "STORE" ? <Store aria-hidden="true" size={17} /> : rule.scopeType === "MERCHANT" ? <Landmark aria-hidden="true" size={17} /> : <IndianRupee aria-hidden="true" size={17} />}</span><div><p className="eyebrow">{titleCase(rule.scopeType)} scope</p><h3>{rule.merchantName || rule.storeName || "All marketplace sales"}</h3><small>Calculated on {titleCase(rule.appliesOn)}</small></div></div><div className="finance-rule-value"><strong>{rule.commissionType === "PERCENTAGE" ? `${rule.commissionPercent}%` : money.format(rule.commissionAmount || 0)}</strong><small>{titleCase(rule.commissionType)} · priority {rule.priority}</small></div><div className="finance-rule-period"><strong>{dateTime.format(new Date(rule.effectiveFrom))}</strong><small>{rule.effectiveTo ? `Until ${dateTime.format(new Date(rule.effectiveTo))}` : "No end date"}</small></div><Status tone={statusTone[rule.status]}>{titleCase(rule.status)}</Status>{canManage ? <button aria-label={`Edit ${rule.scopeType.toLowerCase()} commission rule`} className="row-action" onClick={() => setEditor({ item: rule })} type="button"><Edit3 aria-hidden="true" size={15} />Edit</button> : null}</article>)}{!result?.rules?.length ? <div className="empty-workspace"><SlidersHorizontal aria-hidden="true" size={30} /><h3>No commission rules configured</h3><p>Create a global rule, then add higher-priority merchant or store exceptions.</p>{canManage ? <button className="button button-primary" onClick={() => setEditor({})} type="button"><Plus aria-hidden="true" size={16} />Create rule</button> : null}</div> : null}</div>}
    </section></>}
    {editor ? <RuleEditor accessToken={accessToken} item={editor.item} merchants={result?.merchants || []} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load(); }} stores={result?.stores || []} tenantId={tenantId} /> : null}
  </AppShell>;
}
