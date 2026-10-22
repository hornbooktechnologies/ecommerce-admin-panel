"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Save, Tags, Weight, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { GlobalLoader } from "@/components/global-loader";
import { getPlatformTenantRequest, updatePlatformTenantRequest } from "@/lib/api-client";
import { catalogVerticalOptions } from "@/lib/catalog-verticals";

const verticalIcons = { GENERAL: Boxes, GROCERY: Weight, ELECTRONICS: Zap, CLOTHING: Tags };

export default function EditTenantPage() {
  const { tenantId } = useParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [fields, setFields] = useState({ displayName: "", legalName: "", timezone: "Asia/Kolkata", catalogVerticals: [] });
  const [tenantCode, setTenantCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});
  const errorRef = useRef(null);

  const loadTenant = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setMessage("");
    try {
      const data = await getPlatformTenantRequest(tenantId, accessToken);
      setFields({ displayName: data.tenant.displayName, legalName: data.tenant.legalName,
        timezone: data.tenant.timezone, catalogVerticals: data.tenant.catalogVerticals || [] });
      setTenantCode(data.tenant.code);
    } catch (requestError) {
      setMessage(requestError.message || "The tenant could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId]);

  useEffect(() => { loadTenant(); }, [loadTenant]);

  function updateField(event) {
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: undefined }));
    setMessage("");
  }

  function toggleVertical(code) {
    setFields((current) => ({ ...current, catalogVerticals: current.catalogVerticals.includes(code)
      ? current.catalogVerticals.filter((item) => item !== code)
      : [...current.catalogVerticals, code] }));
    setErrors((current) => ({ ...current, catalogVerticals: undefined }));
    setMessage("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!fields.catalogVerticals.length) {
      setErrors({ catalogVerticals: "Select at least one product type." });
      setMessage("At least one catalog product type must remain enabled.");
      return;
    }
    setSaving(true);
    setErrors({});
    setMessage("");
    try {
      await updatePlatformTenantRequest(tenantId, fields, accessToken);
      router.push(`/platform/tenants/${tenantId}`);
    } catch (requestError) {
      setMessage(requestError.message || "The tenant could not be updated.");
      setErrors(Object.fromEntries((requestError.details || []).map((detail) => [detail.field, detail.message])));
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      action={<Link className="button button-secondary" href={`/platform/tenants/${tenantId}`}><ArrowLeft size={16} aria-hidden="true" />Tenant details</Link>}
      area="platform"
      currentPath="/platform/tenants"
      description="Update the business identity. Lifecycle status is controlled separately and remains audited."
      eyebrow={tenantCode || "Tenant settings"}
      title="Edit tenant"
    >
      {loading ? <GlobalLoader inline label="Loading tenant settings" /> : (
        <form className="edit-tenant-form" onSubmit={submit} noValidate>
          <div className="form-section-heading"><div><h2>Business identity</h2><p>The tenant code is permanent after creation.</p></div></div>
          <div className="form-grid">
            <label className="form-field"><span>Display name</span><input aria-invalid={Boolean(errors.displayName)} name="displayName" onChange={updateField} required value={fields.displayName} />{errors.displayName ? <small className="field-error">{errors.displayName}</small> : null}</label>
            <label className="form-field"><span>Legal business name</span><input aria-invalid={Boolean(errors.legalName)} name="legalName" onChange={updateField} required value={fields.legalName} />{errors.legalName ? <small className="field-error">{errors.legalName}</small> : null}</label>
            <label className="form-field"><span>Tenant code</span><input disabled value={tenantCode} /><small className="field-help">Used by references and cannot be changed.</small></label>
            <label className="form-field"><span>Timezone</span><select name="timezone" onChange={updateField} value={fields.timezone}><option value="Asia/Kolkata">Asia/Kolkata (IST)</option></select></label>
          </div>
          <section className="edit-tenant-catalog" aria-labelledby="edit-catalog-title">
            <div><h3 id="edit-catalog-title">Catalog product types</h3><p>Add capabilities as the business grows. A type already used by products cannot be disabled.</p></div>
            <div className="tenant-vertical-picker tenant-vertical-picker-compact" role="group" aria-labelledby="edit-catalog-title">
              {catalogVerticalOptions.map((item) => {
                const Icon = verticalIcons[item.code];
                const selected = fields.catalogVerticals.includes(item.code);
                return <button aria-pressed={selected} data-selected={selected || undefined} key={item.code} onClick={() => toggleVertical(item.code)} type="button"><span><Icon aria-hidden="true" size={18} /></span><span><strong>{item.name}</strong><small>{item.hint}</small></span><i aria-hidden="true">{selected ? "Enabled" : "Enable"}</i></button>;
              })}
            </div>
            {errors.catalogVerticals ? <small className="field-error tenant-vertical-error">{errors.catalogVerticals}</small> : null}
          </section>
          {message ? <div className="form-error" ref={errorRef} role="alert" tabIndex={-1}>{message}</div> : null}
          <div className="form-footer"><Link className="button button-secondary" href={`/platform/tenants/${tenantId}`}>Cancel</Link><button className="button button-primary" disabled={saving} type="submit"><Save size={16} aria-hidden="true" />{saving ? "Saving…" : "Save changes"}</button></div>
        </form>
      )}
    </AppShell>
  );
}
