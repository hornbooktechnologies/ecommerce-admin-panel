"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, Mail, Pencil, RotateCcw, ShieldAlert, Store, Tags, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Status } from "@/components/dashboard-primitives";
import { TenantActionDialog } from "@/components/tenant-action-dialog";
import { GlobalLoader } from "@/components/global-loader";
import { useAuth } from "@/components/auth-provider";
import { getPlatformTenantRequest, transitionPlatformTenantRequest } from "@/lib/api-client";
import { catalogVerticalByCode } from "@/lib/catalog-verticals";

const statusTone = { ACTIVE: "positive", PENDING: "warning", SUSPENDED: "danger" };

function formatDate(value, includeTime = false) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(new Date(value));
}

function actionLabel(action) {
  return action.replace("platform.tenant.", "Tenant ").replaceAll("_", " ");
}

export default function TenantDetailPage() {
  const { tenantId } = useParams();
  const { accessToken } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const actionButtonRef = useRef(null);

  const loadTenant = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError("");
    try {
      const data = await getPlatformTenantRequest(tenantId, accessToken);
      setTenant(data.tenant);
    } catch (requestError) {
      setError(requestError.message || "The tenant could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  async function confirmAction(reason) {
    setSaving(true);
    setActionError("");
    try {
      const data = await transitionPlatformTenantRequest(tenantId, action, reason, accessToken);
      setTenant(data.tenant);
      setAction(null);
      window.setTimeout(() => actionButtonRef.current?.focus(), 0);
    } catch (requestError) {
      setActionError(requestError.message || "The status could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  const actionButton = tenant?.status === "PENDING"
    ? <button className="button button-primary" onClick={() => setAction("activate")} ref={actionButtonRef} type="button"><CheckCircle2 size={16} aria-hidden="true" />Activate tenant</button>
    : tenant?.status === "ACTIVE"
      ? <button className="button button-danger-outline" onClick={() => setAction("suspend")} ref={actionButtonRef} type="button"><ShieldAlert size={16} aria-hidden="true" />Suspend access</button>
      : <button className="button button-primary" onClick={() => setAction("restore")} ref={actionButtonRef} type="button"><RotateCcw size={16} aria-hidden="true" />Restore tenant</button>;

  function closeActionDialog() {
    setAction(null);
    setActionError("");
    window.setTimeout(() => actionButtonRef.current?.focus(), 0);
  }

  return (
    <AppShell
      action={<div className="page-actions"><Link className="button button-secondary" href="/platform/tenants"><ArrowLeft size={16} aria-hidden="true" />Tenants</Link>{tenant ? <Link className="button button-secondary" href={`/platform/tenants/${tenant.id}/edit`}><Pencil size={15} aria-hidden="true" />Edit</Link> : null}{tenant ? actionButton : null}</div>}
      area="platform"
      currentPath="/platform/tenants"
      description="Business identity, default operating structure, owner access, and lifecycle history."
      eyebrow="Tenant workspace"
      title={tenant?.displayName || "Tenant details"}
    >
      {loading ? <GlobalLoader inline label="Loading tenant workspace" /> : null}
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={loadTenant} type="button">Try again</button></div> : null}

      {tenant && !loading ? (
        <>
          <section className="tenant-identity-band">
            <div><span className="tenant-monogram" aria-hidden="true">{tenant.displayName.slice(0, 2).toUpperCase()}</span><div><p className="eyebrow">{tenant.code}</p><h2>{tenant.legalName}</h2><p>Created {formatDate(tenant.createdAt)} · {tenant.timezone}</p></div></div>
            <Status tone={statusTone[tenant.status]}>{tenant.status === "PENDING" ? "In setup" : tenant.status}</Status>
          </section>

          {tenant.status === "SUSPENDED" && tenant.suspensionReason ? (
            <div className="suspension-banner"><ShieldAlert size={18} aria-hidden="true" /><div><strong>Tenant access suspended</strong><p>{tenant.suspensionReason}</p></div></div>
          ) : null}

          <div className="tenant-detail-grid">
            <div className="tenant-detail-main">
              <section className="detail-section" aria-labelledby="stores-title">
                <div className="detail-section-heading"><div><p className="eyebrow">Operating structure</p><h2 id="stores-title">Stores</h2></div><span>{tenant.stores.length} total</span></div>
                <div className="structured-list">
                  {tenant.stores.map((store) => (
                    <article key={store.id}><span className="list-icon" data-tone="store"><Store size={18} aria-hidden="true" /></span><div><strong>{store.name}</strong><small>{store.code} · {store.baseCurrency} · {store.languageCode}</small></div><div className="list-meta"><Status tone="positive">{store.status}</Status><small>{store.channelCount} channel</small></div></article>
                  ))}
                </div>
              </section>

              <section className="detail-section" aria-labelledby="merchants-title">
                <div className="detail-section-heading"><div><p className="eyebrow">Commerce ownership</p><h2 id="merchants-title">Merchants</h2></div><span>{tenant.merchants.length} total</span></div>
                <div className="structured-list">
                  {tenant.merchants.map((merchant) => (
                    <article key={merchant.id}><span className="list-icon" data-tone="merchant"><Building2 size={18} aria-hidden="true" /></span><div><strong>{merchant.displayName}</strong><small>{merchant.code} · {merchant.type.replaceAll("_", " ")}</small></div><div className="list-meta"><Status tone={statusTone[merchant.status] || "neutral"}>{merchant.status}</Status></div></article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="tenant-detail-aside">
              <section className="owner-panel tenant-catalog-panel" aria-labelledby="tenant-catalog-title">
                <p className="eyebrow">Catalog model</p><h2 id="tenant-catalog-title">Product types</h2>
                <div className="tenant-catalog-types"><Tags aria-hidden="true" size={18} /><div>{(tenant.catalogVerticals || []).map((vertical) => <span key={vertical}>{catalogVerticalByCode[vertical]?.label || vertical}</span>)}</div></div>
              </section>
              <section className="owner-panel" aria-labelledby="owner-title">
                <p className="eyebrow">Primary contact</p><h2 id="owner-title">Tenant owner</h2>
                {tenant.owner ? <div className="owner-profile"><span><UserRound size={19} aria-hidden="true" /></span><div><strong>{tenant.owner.firstName} {tenant.owner.lastName}</strong><a href={`mailto:${tenant.owner.email}`}><Mail size={14} aria-hidden="true" />{tenant.owner.email}</a><small>{tenant.owner.membershipStatus} membership</small></div></div> : <p className="muted-copy">No owner is assigned.</p>}
              </section>
              <section className="activity-panel" aria-labelledby="activity-title">
                <p className="eyebrow">Audit history</p><h2 id="activity-title">Recent activity</h2>
                {tenant.activity.length ? <ol>{tenant.activity.map((event) => <li key={event.id}><span aria-hidden="true" /><div><strong>{actionLabel(event.action)}</strong><p>{event.metadata?.reason || event.actor?.name || "Platform operation"}</p><time>{formatDate(event.occurredAt, true)}</time></div></li>)}</ol> : <p className="muted-copy">No activity recorded yet.</p>}
              </section>
            </aside>
          </div>
        </>
      ) : null}

      {action && tenant ? <TenantActionDialog action={action} busy={saving} error={actionError} onClose={closeActionDialog} onConfirm={confirmAction} tenantName={tenant.displayName} /> : null}
    </AppShell>
  );
}
