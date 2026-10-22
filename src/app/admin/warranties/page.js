"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, Check, ClipboardPlus, Cpu, FileSearch, Search,
  ShieldCheck, Stethoscope, UserRoundCheck, Wrench, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { GlobalLoader } from "@/components/global-loader";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { createWarrantyClaimRequest, listWarrantiesRequest, listWarrantyClaimsRequest,
  transitionWarrantyClaimRequest, warrantyClaimDetailsRequest, warrantyDetailsRequest,
  warrantyOptionsRequest } from "@/lib/api-client";

const warrantyLabels = { ACTIVE: "Active", EXPIRED: "Expired", VOID: "Void", REPLACED: "Replaced" };
const warrantyTones = { ACTIVE: "positive", EXPIRED: "warning", VOID: "danger", REPLACED: "neutral" };
const claimLabels = { OPEN: "Open", ASSIGNED: "Assigned", DIAGNOSED: "Diagnosed",
  RESOLVED: "Resolved", CLOSED: "Closed" };
const claimTones = { OPEN: "warning", ASSIGNED: "info", DIAGNOSED: "info",
  RESOLVED: "positive", CLOSED: "neutral" };
const claimSteps = ["OPEN", "ASSIGNED", "DIAGNOSED", "RESOLVED", "CLOSED"];

function shortDate(value) {
  if (!value) return "—";
  const normalized = String(value).length === 10 ? `${value}T00:00:00Z` : value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric",
    timeZone: "UTC" }).format(new Date(normalized));
}

function DialogHeader({ eyebrow, icon: Icon, onClose, title }) {
  return <header className="access-dialog-head warranty-dialog-head"><span className="dialog-icon" data-tone="teal"><Icon size={19} aria-hidden="true" /></span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button></header>;
}

function ClaimProgress({ status }) {
  const current = claimSteps.indexOf(status);
  return <ol aria-label="Warranty claim progress" className="warranty-progress">{claimSteps.map((step, index) => <li className={index <= current ? "is-complete" : ""} data-current={step === status || undefined} key={step}><span>{index < current ? <Check size={12} aria-hidden="true" /> : index + 1}</span><small>{claimLabels[step]}</small></li>)}</ol>;
}

function WarrantyDialog({ accessToken, canManage, onClose, onSaved, tenantId, warrantyId }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDetails(await warrantyDetailsRequest(warrantyId, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Warranty details could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, tenantId, warrantyId]);
  useEffect(() => { load(); }, [load]);
  const warranty = details?.warranty;
  const eligible = canManage && warranty?.status === "ACTIVE" && warranty.serialStatus === "SOLD"
    && warranty.openClaimCount === 0;

  async function createClaim(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const result = await createWarrantyClaimRequest({ warrantyRegistrationId: warrantyId,
        issueDescription }, accessToken, tenantId);
      onSaved(result.claim.id);
    } catch (requestError) { setError(requestError.message || "The warranty claim could not be opened."); }
    finally { setSaving(false); }
  }

  return <div className="dialog-backdrop warranty-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section aria-modal="true" className="warranty-dialog" role="dialog"><DialogHeader eyebrow="Serial warranty" icon={ShieldCheck} onClose={onClose} title={warranty?.serialNumber || "Loading warranty"} />{loading ? <GlobalLoader inline label="Loading warranty" /> : <><div className="warranty-dialog-scroll">{warranty ? <><section className="warranty-identity"><span className="warranty-device-icon"><Cpu size={23} aria-hidden="true" /></span><div><span><Status tone={warrantyTones[warranty.status]}>{warrantyLabels[warranty.status]}</Status><small>{warranty.warrantyType.toLowerCase()} warranty</small></span><h3>{warranty.productName}</h3><p>{warranty.variantName || warranty.sku} · {warranty.orderNumber}</p></div><div><small>Coverage</small><strong>{shortDate(warranty.startsAt)} – {shortDate(warranty.endsAt)}</strong></div></section><dl className="warranty-facts"><div><dt>Customer</dt><dd>{warranty.customerName}</dd><small>{warranty.customerEmail || "No email recorded"}</small></div><div><dt>Serial status</dt><dd>{warranty.serialStatus?.toLowerCase()}</dd><small>{warranty.serialNumber}</small></div><div><dt>Claims</dt><dd>{warranty.claimCount}</dd><small>{warranty.openClaimCount ? "Active case in progress" : "No active case"}</small></div></dl>{details.claims.length ? <section className="warranty-history"><header><p className="eyebrow">Claim history</p><h3>Cases for this serial</h3></header>{details.claims.map((claim) => <article key={claim.id}><span><strong>{claim.number}</strong><small>{shortDate(claim.openedAt)} · {claim.issueDescription}</small></span><Status tone={claimTones[claim.status]}>{claimLabels[claim.status]}</Status></article>)}</section> : null}{eligible ? <form className="warranty-open-claim" onSubmit={createClaim}><header><span><ClipboardPlus size={17} aria-hidden="true" /></span><div><strong>Open warranty claim</strong><small>Describe the customer-reported fault. Eligibility will be checked again when submitted.</small></div></header><label className="form-field"><span>Issue description <em>*</em></span><textarea autoFocus maxLength={4000} minLength={10} onChange={(event) => setIssueDescription(event.target.value)} required rows={4} value={issueDescription} /></label><button className="button button-primary" disabled={saving || issueDescription.trim().length < 10} type="submit">{saving ? "Opening…" : "Open claim"}<ArrowRight size={15} aria-hidden="true" /></button></form> : canManage ? <p className="warranty-ineligible"><ShieldCheck size={16} aria-hidden="true" />{warranty.openClaimCount ? "Close the active claim before opening another case." : warranty.status === "EXPIRED" ? "Coverage has expired for this serial number." : "This serial number is no longer eligible for warranty service."}</p> : null}</> : null}{error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}</div><footer className="dialog-actions"><span>Warranty eligibility is validated by the API.</span><button className="button button-secondary" onClick={onClose} type="button">Close</button></footer></>}</section></div>;
}

function ClaimDialog({ accessToken, assignees, canManage, claimId, onClose, onSaved, tenantId }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ assignedTo: assignees[0]?.id || "", notes: "",
    diagnosisNotes: "", resolutionType: "REPAIR", resolutionNotes: "" });
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDetails(await warrantyClaimDetailsRequest(claimId, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Warranty claim could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, claimId, tenantId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!form.assignedTo && assignees[0]?.id) setForm((current) => ({ ...current, assignedTo: assignees[0].id }));
  }, [assignees, form.assignedTo]);
  const claim = details?.claim;
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function run(action, body) {
    setSaving(true); setError("");
    try {
      const next = await transitionWarrantyClaimRequest(claimId, action, body, accessToken, tenantId);
      setDetails(next); setForm((current) => ({ ...current, notes: "", diagnosisNotes: "", resolutionNotes: "" }));
      onSaved();
    } catch (requestError) { setError(requestError.message || "The claim could not be updated."); }
    finally { setSaving(false); }
  }

  return <div className="dialog-backdrop warranty-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section aria-modal="true" className="warranty-dialog warranty-claim-dialog" role="dialog"><DialogHeader eyebrow="Service case" icon={Stethoscope} onClose={onClose} title={claim?.number || "Loading claim"} />{loading ? <GlobalLoader inline label="Loading warranty claim" /> : <><div className="warranty-dialog-scroll">{claim ? <><section className="warranty-claim-band"><div><span><Status tone={claimTones[claim.status]}>{claimLabels[claim.status]}</Status><small>{claim.warrantyType.toLowerCase()} warranty · ends {shortDate(claim.warrantyEndsAt)}</small></span><h3>{claim.productName}</h3><p>{claim.serialNumber} · {claim.orderNumber} · {claim.customerName}</p></div><span className="warranty-device-icon"><Cpu size={24} aria-hidden="true" /></span></section><ClaimProgress status={claim.status} /><section className="warranty-issue"><p className="eyebrow">Reported issue</p><p>{claim.issueDescription}</p>{claim.diagnosisNotes ? <div><strong>Diagnosis</strong><span>{claim.diagnosisNotes}</span></div> : null}{claim.resolutionNotes ? <div><strong>{claim.resolutionType?.replaceAll("_", " ")}</strong><span>{claim.resolutionNotes}</span></div> : null}</section>{canManage && claim.status === "OPEN" ? <section className="warranty-action-panel"><header><span><UserRoundCheck size={17} aria-hidden="true" /></span><div><strong>Assign technician</strong><small>Choose the team member responsible for diagnosis.</small></div></header><label className="form-field"><span>Assignee <em>*</em></span><select value={form.assignedTo} onChange={(event) => update("assignedTo", event.target.value)}>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select></label><label className="form-field"><span>Assignment note</span><textarea maxLength={2000} rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label><button className="button button-primary" disabled={saving || !form.assignedTo} onClick={() => run("assign", { assignedTo: form.assignedTo, notes: form.notes })} type="button">Assign claim</button></section> : null}{canManage && claim.status === "ASSIGNED" ? <section className="warranty-action-panel"><header><span><FileSearch size={17} aria-hidden="true" /></span><div><strong>Record diagnosis</strong><small>{claim.assignedToName ? `Assigned to ${claim.assignedToName}.` : "Document the verified fault."}</small></div></header><label className="form-field"><span>Diagnostic findings <em>*</em></span><textarea maxLength={4000} minLength={5} rows={4} value={form.diagnosisNotes} onChange={(event) => update("diagnosisNotes", event.target.value)} /></label><button className="button button-warning" disabled={saving || form.diagnosisNotes.trim().length < 5} onClick={() => run("diagnose", { diagnosisNotes: form.diagnosisNotes })} type="button">Confirm diagnosis</button></section> : null}{canManage && claim.status === "DIAGNOSED" ? <section className="warranty-action-panel"><header><span><Wrench size={17} aria-hidden="true" /></span><div><strong>Record resolution</strong><small>Select the actual service outcome and explain the work completed.</small></div></header><div className="form-grid"><label className="form-field"><span>Resolution <em>*</em></span><select value={form.resolutionType} onChange={(event) => update("resolutionType", event.target.value)}><option value="REPAIR">Repaired</option><option value="REPLACEMENT">Replacement approved</option><option value="REFUND">Refund approved</option><option value="NO_FAULT">No fault found</option><option value="OUT_OF_SCOPE">Outside warranty scope</option></select></label><label className="form-field"><span>Resolution notes <em>*</em></span><textarea maxLength={4000} minLength={5} rows={3} value={form.resolutionNotes} onChange={(event) => update("resolutionNotes", event.target.value)} /></label></div><button className="button button-success" disabled={saving || form.resolutionNotes.trim().length < 5} onClick={() => run("resolve", { resolutionType: form.resolutionType, resolutionNotes: form.resolutionNotes })} type="button">Resolve claim</button></section> : null}{canManage && claim.status === "RESOLVED" ? <section className="warranty-action-panel"><header><span><BadgeCheck size={17} aria-hidden="true" /></span><div><strong>Close service case</strong><small>Close after the customer has received the resolved device or outcome.</small></div></header><label className="form-field"><span>Closing note</span><textarea maxLength={2000} rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label><button className="button button-success" disabled={saving} onClick={() => run("close", { notes: form.notes })} type="button">Close claim</button></section> : null}<section className="warranty-timeline"><header><p className="eyebrow">Audit trail</p><h3>Claim activity</h3></header><ol>{details.events.map((event) => <li key={event.id}><span aria-hidden="true" /><div><strong>{event.type.replaceAll("_", " ").toLowerCase()}</strong><small>{event.notes || `${event.previousStatus || "New"} → ${event.newStatus}`} · {event.createdByName || "System"}</small></div><time>{shortDate(event.createdAt)}</time></li>)}</ol></section></> : null}{error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}</div><footer className="dialog-actions"><span>Every state change is recorded in the audit trail.</span><button className="button button-secondary" onClick={onClose} type="button">Close</button></footer></>}</section></div>;
}

export default function WarrantiesPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "warranty.manage", tenantId);
  const [view, setView] = useState("warranties");
  const [warrantyFilters, setWarrantyFilters] = useState({ search: "", status: "ALL", page: 1, pageSize: 10 });
  const [claimFilters, setClaimFilters] = useState({ search: "", status: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState({ assignees: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const filters = view === "warranties" ? warrantyFilters : claimFilters;
  const setFilters = view === "warranties" ? setWarrantyFilters : setClaimFilters;
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true); setError("");
    try {
      const [nextResult, nextOptions] = await Promise.all([
        view === "warranties" ? listWarrantiesRequest(warrantyFilters, accessToken, tenantId)
          : listWarrantyClaimsRequest(claimFilters, accessToken, tenantId),
        canManage ? warrantyOptionsRequest(accessToken, tenantId) : Promise.resolve({ assignees: [] })
      ]);
      setResult(nextResult); setOptions(nextOptions);
    } catch (requestError) { setError(requestError.message || "Warranty operations could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, canManage, claimFilters, tenantId, view, warrantyFilters]);
  useEffect(() => { load(); }, [load]);
  const summary = useMemo(() => result?.summary || {}, [result]);
  const items = result?.items || [];

  function switchView(nextView) {
    setView(nextView); setDraftSearch(""); setResult(null); setError("");
  }

  return <AppShell area="admin" currentPath="/admin/warranties" eyebrow="After-sales service" title="Warranties & claims" description="Trace serialized electronics coverage and move service claims from intake through diagnosis and resolution." action={canManage && view === "claims" ? <button className="button button-primary" onClick={() => switchView("warranties")} type="button"><Search size={16} aria-hidden="true" />Find eligible warranty</button> : null}>
    <section aria-label="Warranty operations summary" className="warranty-signal-grid">{view === "warranties" ? <><article><span data-tone="teal"><ShieldCheck size={18} aria-hidden="true" /></span><div><small>Registered</small><strong>{summary.total || 0}</strong></div></article><article><span data-tone="positive"><BadgeCheck size={18} aria-hidden="true" /></span><div><small>Active coverage</small><strong>{summary.active || 0}</strong></div></article><article><span data-tone="warning"><ShieldCheck size={18} aria-hidden="true" /></span><div><small>Expired</small><strong>{summary.expired || 0}</strong></div></article><article><span data-tone="plum"><Stethoscope size={18} aria-hidden="true" /></span><div><small>Open claims</small><strong>{summary.openClaims || 0}</strong></div></article></> : <><article><span data-tone="teal"><Stethoscope size={18} aria-hidden="true" /></span><div><small>Total claims</small><strong>{summary.total || 0}</strong></div></article><article><span data-tone="warning"><UserRoundCheck size={18} aria-hidden="true" /></span><div><small>Awaiting diagnosis</small><strong>{summary.awaitingDiagnosis || 0}</strong></div></article><article><span data-tone="plum"><FileSearch size={18} aria-hidden="true" /></span><div><small>Diagnosed</small><strong>{summary.diagnosed || 0}</strong></div></article><article><span data-tone="positive"><BadgeCheck size={18} aria-hidden="true" /></span><div><small>Resolved</small><strong>{summary.resolved || 0}</strong></div></article></>}</section>
    <section aria-labelledby="warranty-directory-title" className="tenant-directory warranty-directory"><div className="warranty-tabs" role="tablist"><button aria-selected={view === "warranties"} data-active={view === "warranties" || undefined} onClick={() => switchView("warranties")} role="tab" type="button">Warranty registry</button><button aria-selected={view === "claims"} data-active={view === "claims" || undefined} onClick={() => switchView("claims")} role="tab" type="button">Claim queue</button></div><div className="section-heading tenant-directory-heading"><div><p className="eyebrow">{view === "warranties" ? "Serial coverage" : "Service operations"}</p><h2 id="warranty-directory-title">{view === "warranties" ? "Registered warranties" : "Warranty claims"}</h2></div><form className="directory-filters warranty-filters" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 })); }} role="search"><label className="compact-search"><span className="sr-only">Search {view}</span><Search size={16} aria-hidden="true" /><input placeholder={view === "warranties" ? "Serial, product, order or customer" : "Claim, serial, product or order"} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label={`${view === "warranties" ? "Warranty" : "Claim"} status`} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="ALL">All statuses</option>{Object.entries(view === "warranties" ? warrantyLabels : claimLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="button button-secondary" type="submit">Search</button></form></div>{error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}{loading ? <GlobalLoader inline label={`Loading ${view}`} /> : !items.length ? <div className="empty-workspace"><ShieldCheck size={28} aria-hidden="true" /><h3>{view === "warranties" ? "No warranties found" : "No warranty claims found"}</h3><p>{view === "warranties" ? "Coverage is registered automatically when eligible serialized electronics are dispatched." : "Open a claim from an active warranty registration when a customer reports a fault."}</p></div> : <><div className="warranty-list">{view === "warranties" ? items.map((item) => <button className="warranty-row" key={item.id} onClick={() => setDialog({ type: "warranty", id: item.id })} type="button"><span className="warranty-row-identity"><i><Cpu size={18} aria-hidden="true" /></i><span><strong>{item.productName}</strong><small>{item.variantName || item.sku} · {item.serialNumber}</small></span></span><span><small>Customer / order</small><strong>{item.customerName}</strong><small>{item.orderNumber}</small></span><span><small>Coverage ends</small><strong>{shortDate(item.endsAt)}</strong><small>{item.warrantyType.toLowerCase()}</small></span><span><Status tone={warrantyTones[item.status]}>{warrantyLabels[item.status]}</Status><small>{item.openClaimCount ? `${item.openClaimCount} active claim` : `${item.claimCount} claims`}</small></span><ArrowRight size={17} aria-hidden="true" /></button>) : items.map((item) => <button className="warranty-row warranty-claim-row" key={item.id} onClick={() => setDialog({ type: "claim", id: item.id })} type="button"><span className="warranty-row-identity"><i><Stethoscope size={18} aria-hidden="true" /></i><span><strong>{item.number}</strong><small>{item.productName} · {item.serialNumber}</small></span></span><span><small>Customer / order</small><strong>{item.customerName}</strong><small>{item.orderNumber}</small></span><span><small>Owner</small><strong>{item.assignedToName || "Unassigned"}</strong><small>Opened {shortDate(item.openedAt)}</small></span><span><Status tone={claimTones[item.status]}>{claimLabels[item.status]}</Status><small>{item.resolutionType ? item.resolutionType.replaceAll("_", " ").toLowerCase() : "Service pending"}</small></span><ArrowRight size={17} aria-hidden="true" /></button>)}</div><TablePagination itemLabel={view === "warranties" ? "warranties" : "claims"} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></>}</section>
    {dialog?.type === "warranty" ? <WarrantyDialog accessToken={accessToken} canManage={canManage} onClose={() => setDialog(null)} onSaved={(id) => { load(); setView("claims"); setDialog({ type: "claim", id }); }} tenantId={tenantId} warrantyId={dialog.id} /> : null}
    {dialog?.type === "claim" ? <ClaimDialog accessToken={accessToken} assignees={options.assignees} canManage={canManage} claimId={dialog.id} onClose={() => setDialog(null)} onSaved={load} tenantId={tenantId} /> : null}
  </AppShell>;
}
