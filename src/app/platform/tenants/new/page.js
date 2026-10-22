"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Boxes, Building2, Eye, EyeOff, KeyRound, Store, Tags, UserRound, Weight, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { createPlatformTenantRequest } from "@/lib/api-client";
import { catalogVerticalOptions } from "@/lib/catalog-verticals";

const verticalIcons = { GENERAL: Boxes, GROCERY: Weight, ELECTRONICS: Zap, CLOTHING: Tags };

const initialFields = {
  displayName: "",
  legalName: "",
  code: "",
  ownerFirstName: "",
  ownerLastName: "",
  ownerEmail: "",
  temporaryPassword: "",
  storeName: "",
  storeCode: "MAIN",
  supportEmail: "",
  supportPhone: "",
  catalogVerticals: []
};

function toCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export default function CreateTenantPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [fields, setFields] = useState(initialFields);
  const [codeEdited, setCodeEdited] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef(null);

  function updateField(event) {
    const { name, value } = event.target;
    setFields((current) => {
      const next = { ...current, [name]: value };
      if (name === "displayName") {
        if (!codeEdited) next.code = toCode(value);
        if (!current.storeName) next.storeName = value ? `${value} Main Store` : "";
      }
      return next;
    });
    if (name === "code") setCodeEdited(true);
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  }

  function toggleVertical(code) {
    setFields((current) => ({
      ...current,
      catalogVerticals: current.catalogVerticals.includes(code)
        ? current.catalogVerticals.filter((item) => item !== code)
        : [...current.catalogVerticals, code]
    }));
    setErrors((current) => ({ ...current, catalogVerticals: undefined }));
    setMessage("");
  }

  function mapErrors(details = []) {
    const names = {
      code: "code",
      legalName: "legalName",
      displayName: "displayName",
      "owner.firstName": "ownerFirstName",
      "owner.lastName": "ownerLastName",
      "owner.email": "ownerEmail",
      "owner.temporaryPassword": "temporaryPassword",
      "defaultStore.name": "storeName",
      "defaultStore.code": "storeCode",
      "defaultStore.supportEmail": "supportEmail",
      "defaultStore.supportPhone": "supportPhone",
      catalogVerticals: "catalogVerticals"
    };
    return Object.fromEntries(details.map((detail) => [names[detail.field] || detail.field, detail.message]));
  }

  async function submit(event) {
    event.preventDefault();
    if (!accessToken) return;
    if (!fields.catalogVerticals.length) {
      setErrors({ catalogVerticals: "Select at least one product type." });
      setMessage("Select the tenant catalog model before provisioning.");
      window.setTimeout(() => errorRef.current?.focus(), 0);
      return;
    }
    setSubmitting(true);
    setErrors({});
    setMessage("");
    try {
      const data = await createPlatformTenantRequest({
        code: fields.code,
        legalName: fields.legalName,
        displayName: fields.displayName,
        defaultCurrency: "INR",
        defaultLanguage: "en-IN",
        timezone: "Asia/Kolkata",
        catalogVerticals: fields.catalogVerticals,
        owner: {
          firstName: fields.ownerFirstName,
          lastName: fields.ownerLastName,
          email: fields.ownerEmail,
          temporaryPassword: fields.temporaryPassword
        },
        defaultStore: {
          code: fields.storeCode,
          name: fields.storeName,
          supportEmail: fields.supportEmail || null,
          supportPhone: fields.supportPhone || null
        }
      }, accessToken);
      router.push(`/platform/tenants/${data.tenant.id}?created=1`);
    } catch (requestError) {
      setErrors(mapErrors(requestError.details));
      setMessage(requestError.message || "The tenant could not be created.");
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  function field(name, label, options = {}) {
    const describedBy = errors[name] ? `${name}-error` : options.help ? `${name}-help` : undefined;
    const input = (
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(errors[name])}
        autoComplete={options.autoComplete}
        minLength={options.minLength}
        name={name}
        onChange={updateField}
        placeholder={options.placeholder}
        required={!options.optional}
        type={name === "temporaryPassword" && showPassword ? "text" : options.type || "text"}
        value={fields[name]}
      />
    );
    return (
      <label className="form-field">
        <span>{label}{options.optional ? <small>Optional</small> : <em aria-hidden="true">*</em>}</span>
        {name === "temporaryPassword" ? (
          <span className="form-password-control">
            {input}
            <button aria-label={showPassword ? "Hide temporary password" : "Show temporary password"} onClick={() => setShowPassword((current) => !current)} type="button">
              {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </span>
        ) : input}
        {errors[name] ? <small className="field-error" id={`${name}-error`}>{errors[name]}</small> : options.help ? <small className="field-help" id={`${name}-help`}>{options.help}</small> : null}
      </label>
    );
  }

  return (
    <AppShell
      action={<Link className="button button-secondary" href="/platform/tenants"><ArrowLeft size={16} aria-hidden="true" />Back to tenants</Link>}
      area="platform"
      currentPath="/platform/tenants"
      description="Provision the business account, first store, first-party merchant, owner access, roles, and operational sequences together."
      eyebrow="Tenant onboarding"
      title="Create tenant"
    >
      <form className="tenant-create-layout" onSubmit={submit} noValidate>
        <div className="tenant-form-sections">
          <section className="form-section" aria-labelledby="business-section-title">
            <div className="form-section-heading" data-tone="business"><Building2 size={19} aria-hidden="true" /><div><h2 id="business-section-title">Business identity</h2><p>The permanent tenant code is used in operational references.</p></div></div>
            <div className="form-grid">
              {field("displayName", "Display name", { placeholder: "Northstar Retail", autoComplete: "organization" })}
              {field("legalName", "Legal business name", { placeholder: "Northstar Retail Private Limited", autoComplete: "organization" })}
              {field("code", "Tenant code", { placeholder: "NORTHSTAR", help: "3–40 uppercase letters, numbers, hyphens or underscores." })}
              <label className="form-field"><span>Primary market</span><input disabled value="India · INR · English" /></label>
            </div>
          </section>

          <section className="form-section" aria-labelledby="catalog-model-title">
            <div className="form-section-heading" data-tone="catalog"><Boxes size={19} aria-hidden="true" /><div><h2 id="catalog-model-title">Catalog model</h2><p>Select every product type this tenant is allowed to create.</p></div></div>
            <div className="tenant-vertical-picker" role="group" aria-describedby={errors.catalogVerticals ? "catalogVerticals-error" : "catalogVerticals-help"} aria-labelledby="catalog-model-title">
              {catalogVerticalOptions.map((item) => {
                const Icon = verticalIcons[item.code];
                const selected = fields.catalogVerticals.includes(item.code);
                return <button aria-pressed={selected} data-selected={selected || undefined} key={item.code} onClick={() => toggleVertical(item.code)} type="button"><span><Icon aria-hidden="true" size={18} /></span><span><strong>{item.name}</strong><small>{item.hint}</small></span><i aria-hidden="true">{selected ? "Selected" : "Select"}</i></button>;
              })}
            </div>
            {errors.catalogVerticals ? <small className="field-error tenant-vertical-error" id="catalogVerticals-error">{errors.catalogVerticals}</small> : <p className="field-help" id="catalogVerticals-help">Choose one for a specialist store or several for a mixed catalog.</p>}
          </section>

          <section className="form-section" aria-labelledby="owner-section-title">
            <div className="form-section-heading" data-tone="owner"><UserRound size={19} aria-hidden="true" /><div><h2 id="owner-section-title">Tenant owner</h2><p>This user receives the tenant-owner role and full tenant scope.</p></div></div>
            <div className="form-grid">
              {field("ownerFirstName", "First name", { autoComplete: "given-name" })}
              {field("ownerLastName", "Last name", { optional: true, autoComplete: "family-name" })}
              {field("ownerEmail", "Email address", { type: "email", autoComplete: "email", placeholder: "owner@business.com" })}
              {field("temporaryPassword", "Temporary password", { type: "password", autoComplete: "new-password", minLength: 12, help: "At least 12 characters. Existing users keep their current password." })}
            </div>
          </section>

          <section className="form-section" aria-labelledby="store-section-title">
            <div className="form-section-heading" data-tone="store"><Store size={19} aria-hidden="true" /><div><h2 id="store-section-title">Default store</h2><p>The admin sales channel and first-party merchant are attached automatically.</p></div></div>
            <div className="form-grid">
              {field("storeName", "Store name", { placeholder: "Northstar Main Store" })}
              {field("storeCode", "Store code", { placeholder: "MAIN" })}
              {field("supportEmail", "Support email", { optional: true, type: "email", placeholder: "help@business.com" })}
              {field("supportPhone", "Support phone", { optional: true, type: "tel", placeholder: "+91 98765 43210" })}
            </div>
          </section>
        </div>

        <aside className="provisioning-summary" aria-label="Provisioning summary">
          <p className="eyebrow">Created atomically</p>
          <h2>Ready for operations</h2>
          <ul>
            <li><span>01</span>Tenant account</li>
            <li><span>02</span>{fields.catalogVerticals.length ? `${fields.catalogVerticals.length} catalog product ${fields.catalogVerticals.length === 1 ? "type" : "types"}` : "Catalog product types required"}</li>
            <li><span>03</span>Default store and admin channel</li>
            <li><span>04</span>First-party merchant</li>
            <li><span>05</span>Owner membership and role</li>
            <li><span>06</span>Standard roles and number sequences</li>
            <li><span>07</span>Audit and outbox events</li>
          </ul>
          <div className="provisioning-note"><KeyRound size={16} aria-hidden="true" /><p>The account begins in <strong>In setup</strong>. Activate it only after verification.</p></div>
          {message ? <div className="form-error" ref={errorRef} role="alert" tabIndex={-1}>{message}</div> : null}
          <button className="button button-primary tenant-submit" disabled={submitting} type="submit">
            {submitting ? "Provisioning tenant…" : "Create tenant"}<ArrowRight size={16} aria-hidden="true" />
          </button>
        </aside>
      </form>
    </AppShell>
  );
}
