"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeIndianRupee,
  Ban,
  Building2,
  Check,
  CircleCheck,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  MapPin,
  PackageCheck,
  PauseCircle,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  Tags,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { GlobalLoader } from "@/components/global-loader";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import {
  createVendorOfferRequest,
  createVendorRequest,
  inviteVendorUserRequest,
  listVendorsRequest,
  transitionVendorRequest,
  updateVendorOfferRequest,
  updateVendorRequest,
  vendorDetailsRequest,
  vendorOptionsRequest,
} from "@/lib/api-client";

const statusLabel = {
  PENDING: "Pending review",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
};
const statusTone = {
  PENDING: "warning",
  ACTIVE: "positive",
  SUSPENDED: "danger",
};
const businessLabel = {
  PROPRIETORSHIP: "Proprietorship",
  PARTNERSHIP: "Partnership",
  PRIVATE_LIMITED: "Private limited",
  PUBLIC_LIMITED: "Public limited",
  LLP: "LLP",
};

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function DialogHeader({ eyebrow, icon: Icon, onClose, title }) {
  return (
    <header className="access-dialog-head vendor-dialog-head">
      <span className="dialog-icon" data-tone="positive">
        <Icon size={19} aria-hidden="true" />
      </span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <button
        aria-label="Close dialog"
        className="icon-button"
        onClick={onClose}
        type="button"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </header>
  );
}

function StorePicker({ selected, stores, toggle }) {
  return (
    <fieldset className="vendor-store-picker">
      <legend>
        Assigned stores <em>*</em>
      </legend>
      <div>
        {stores.map((store) => (
          <label
            className={selected.includes(store.id) ? "is-selected" : ""}
            key={store.id}
          >
            <input
              checked={selected.includes(store.id)}
              onChange={() => toggle(store.id)}
              type="checkbox"
            />
            <span>
              <Store size={16} aria-hidden="true" />
              <strong>{store.name}</strong>
              <small>{store.code}</small>
            </span>
            <Check size={15} aria-hidden="true" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CreateVendorDialog({
  accessToken,
  onClose,
  onSaved,
  options,
  tenantId,
}) {
  const [form, setForm] = useState({
    merchantCode: "",
    displayName: "",
    legalName: "",
    pan: "",
    gstin: "",
    supportEmail: "",
    supportPhone: "",
    businessType: "PRIVATE_LIMITED",
    contactPerson: "",
    defaultCommissionPercent: "10",
    settlementCycleDays: "7",
    notes: "",
    storeIds: options.stores[0] ? [options.stores[0].id] : [],
    address: {
      line1: "",
      line2: "",
      city: "",
      district: "",
      stateCode: "",
      stateName: "",
      postalCode: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const updateAddress = (field, value) =>
    setForm((current) => ({
      ...current,
      address: { ...current.address, [field]: value },
    }));
  const toggleStore = (id) =>
    setForm((current) => ({
      ...current,
      storeIds: current.storeIds.includes(id)
        ? current.storeIds.filter((storeId) => storeId !== id)
        : [...current.storeIds, id],
    }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await createVendorRequest(
        {
          ...form,
          defaultCommissionPercent: Number(form.defaultCommissionPercent),
          settlementCycleDays: Number(form.settlementCycleDays),
        },
        accessToken,
        tenantId,
      );
      onSaved(result.vendor.id);
    } catch (requestError) {
      setError(requestError.message || "Vendor could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialog-backdrop vendor-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-modal="true"
        className="vendor-dialog vendor-create-dialog"
        role="dialog"
      >
        <DialogHeader
          eyebrow="Marketplace onboarding"
          icon={Building2}
          onClose={onClose}
          title="Add vendor"
        />
        <form onSubmit={submit}>
          <div className="vendor-dialog-scroll">
            <div className="vendor-guidance">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                <strong>Vendor starts in pending review</strong>
                <small>
                  Catalog offers can be assigned after approval. PAN, GSTIN,
                  store scope, and all changes remain tenant isolated.
                </small>
              </span>
            </div>
            <section className="vendor-form-section">
              <header>
                <span>01</span>
                <div>
                  <strong>Business identity</strong>
                  <small>Legal and India tax details</small>
                </div>
              </header>
              <div className="form-grid vendor-form-grid">
                <label className="form-field">
                  <span>
                    Vendor code <em>*</em>
                  </span>
                  <input
                    autoFocus
                    maxLength={40}
                    placeholder="BYTECRAFT"
                    required
                    value={form.merchantCode}
                    onChange={(event) =>
                      update("merchantCode", event.target.value.toUpperCase())
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    Trading name <em>*</em>
                  </span>
                  <input
                    maxLength={190}
                    required
                    value={form.displayName}
                    onChange={(event) =>
                      update("displayName", event.target.value)
                    }
                  />
                </label>
                <label className="form-field vendor-span-2">
                  <span>
                    Legal business name <em>*</em>
                  </span>
                  <input
                    maxLength={190}
                    required
                    value={form.legalName}
                    onChange={(event) =>
                      update("legalName", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    Business type <em>*</em>
                  </span>
                  <select
                    value={form.businessType}
                    onChange={(event) =>
                      update("businessType", event.target.value)
                    }
                  >
                    {Object.entries(businessLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>
                    Contact person <em>*</em>
                  </span>
                  <input
                    maxLength={190}
                    required
                    value={form.contactPerson}
                    onChange={(event) =>
                      update("contactPerson", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    PAN <em>*</em>
                  </span>
                  <input
                    maxLength={10}
                    minLength={10}
                    placeholder="ABCDE1234F"
                    required
                    value={form.pan}
                    onChange={(event) =>
                      update("pan", event.target.value.toUpperCase())
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    GSTIN <em>*</em>
                  </span>
                  <input
                    maxLength={15}
                    minLength={15}
                    placeholder="29ABCDE1234F1Z5"
                    required
                    value={form.gstin}
                    onChange={(event) =>
                      update("gstin", event.target.value.toUpperCase())
                    }
                  />
                </label>
              </div>
            </section>
            <section className="vendor-form-section">
              <header>
                <span>02</span>
                <div>
                  <strong>Operations</strong>
                  <small>Contacts, commercial defaults, and stores</small>
                </div>
              </header>
              <div className="form-grid vendor-form-grid">
                <label className="form-field">
                  <span>
                    Support email <em>*</em>
                  </span>
                  <input
                    required
                    type="email"
                    value={form.supportEmail}
                    onChange={(event) =>
                      update("supportEmail", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    Support phone <em>*</em>
                  </span>
                  <input
                    required
                    type="tel"
                    value={form.supportPhone}
                    onChange={(event) =>
                      update("supportPhone", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Default commission</span>
                  <span className="field-suffix">
                    <input
                      max="100"
                      min="0"
                      step="0.001"
                      type="number"
                      value={form.defaultCommissionPercent}
                      onChange={(event) =>
                        update("defaultCommissionPercent", event.target.value)
                      }
                    />
                    <i>%</i>
                  </span>
                </label>
                <label className="form-field">
                  <span>Settlement cycle</span>
                  <span className="field-suffix">
                    <input
                      max="90"
                      min="1"
                      type="number"
                      value={form.settlementCycleDays}
                      onChange={(event) =>
                        update("settlementCycleDays", event.target.value)
                      }
                    />
                    <i>days</i>
                  </span>
                </label>
              </div>
              <StorePicker
                selected={form.storeIds}
                stores={options.stores}
                toggle={toggleStore}
              />
            </section>
            <section className="vendor-form-section">
              <header>
                <span>03</span>
                <div>
                  <strong>Registered address</strong>
                  <small>Used as the initial pickup and return address</small>
                </div>
              </header>
              <div className="form-grid vendor-form-grid">
                <label className="form-field vendor-span-2">
                  <span>
                    Address line 1 <em>*</em>
                  </span>
                  <input
                    required
                    value={form.address.line1}
                    onChange={(event) =>
                      updateAddress("line1", event.target.value)
                    }
                  />
                </label>
                <label className="form-field vendor-span-2">
                  <span>Address line 2</span>
                  <input
                    value={form.address.line2}
                    onChange={(event) =>
                      updateAddress("line2", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    City <em>*</em>
                  </span>
                  <input
                    required
                    value={form.address.city}
                    onChange={(event) =>
                      updateAddress("city", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>District</span>
                  <input
                    value={form.address.district}
                    onChange={(event) =>
                      updateAddress("district", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    State code <em>*</em>
                  </span>
                  <input
                    maxLength={2}
                    placeholder="KA"
                    required
                    value={form.address.stateCode}
                    onChange={(event) =>
                      updateAddress(
                        "stateCode",
                        event.target.value.toUpperCase(),
                      )
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    State name <em>*</em>
                  </span>
                  <input
                    required
                    value={form.address.stateName}
                    onChange={(event) =>
                      updateAddress("stateName", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  <span>
                    PIN code <em>*</em>
                  </span>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={form.address.postalCode}
                    onChange={(event) =>
                      updateAddress("postalCode", event.target.value)
                    }
                  />
                </label>
                <label className="form-field vendor-span-2">
                  <span>Internal notes</span>
                  <textarea
                    maxLength={2000}
                    rows={3}
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                  />
                </label>
              </div>
            </section>
            {error ? (
              <div className="inline-state inline-state-error" role="alert">
                <span>{error}</span>
              </div>
            ) : null}
          </div>
          <footer className="dialog-actions vendor-dialog-actions">
            <span>Approval is a separate audited action.</span>
            <div>
              <button
                className="button button-secondary"
                disabled={saving}
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={saving || !form.storeIds.length}
                type="submit"
              >
                {saving ? "Creating..." : "Create vendor"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function OfferEditor({ draft, onCancel, onSave, saving }) {
  const [form, setForm] = useState({
    listPrice: String(draft.listPrice || ""),
    salePrice: String(draft.salePrice || ""),
    costPrice: draft.costPrice === null ? "" : String(draft.costPrice),
    handlingTimeHours: String(draft.handlingTimeHours || 0),
  });
  return (
    <form
      className="vendor-offer-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          listPrice: Number(form.listPrice),
          salePrice: Number(form.salePrice),
          costPrice: form.costPrice === "" ? null : Number(form.costPrice),
          handlingTimeHours: Number(form.handlingTimeHours),
        });
      }}
    >
      <div>
        <strong>Edit offer</strong>
        <small>
          {draft.productName} · {draft.variantName || draft.catalogSku}
        </small>
      </div>
      <label>
        <span>MRP</span>
        <input
          min="0.01"
          required
          step="0.01"
          type="number"
          value={form.listPrice}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              listPrice: event.target.value,
            }))
          }
        />
      </label>
      <label>
        <span>Selling price</span>
        <input
          min="0.01"
          required
          step="0.01"
          type="number"
          value={form.salePrice}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              salePrice: event.target.value,
            }))
          }
        />
      </label>
      <label>
        <span>Cost</span>
        <input
          min="0"
          step="0.01"
          type="number"
          value={form.costPrice}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              costPrice: event.target.value,
            }))
          }
        />
      </label>
      <label>
        <span>Handling hours</span>
        <input
          min="0"
          type="number"
          value={form.handlingTimeHours}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              handlingTimeHours: event.target.value,
            }))
          }
        />
      </label>
      <div className="vendor-offer-editor-actions">
        <button
          className="button button-secondary"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="button button-success"
          disabled={saving}
          type="submit"
        >
          Save price
        </button>
      </div>
    </form>
  );
}

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint32Array(16);
  window.crypto.getRandomValues(values);
  return `Tmp!${[...values].map((value) => alphabet[value % alphabet.length]).join("")}`;
}

function VendorAccessPanel({ accessToken, onClose, tenantId, vendor }) {
  const contactParts = vendor.contactPerson.trim().split(/\s+/);
  const [form, setForm] = useState({
    email: vendor.supportEmail || "",
    firstName: contactParts[0] || "",
    lastName: contactParts.slice(1).join(" "),
    temporaryPassword: "",
    roleKey: "vendor_owner",
  });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm((current) => ({
      ...current,
      temporaryPassword: temporaryPassword(),
    }));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await inviteVendorUserRequest(
        vendor.id,
        form,
        accessToken,
        tenantId,
      );
      setCreated({ ...result, temporaryPassword: form.temporaryPassword });
    } catch (requestError) {
      setError(
        requestError.message || "Vendor portal access could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyCredentials() {
    await navigator.clipboard.writeText(
      `Email: ${created.email}\nTemporary password: ${created.temporaryPassword}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="vendor-access-panel" aria-labelledby="vendor-access-title">
      <header>
        <span className="vendor-access-icon" aria-hidden="true">
          <KeyRound size={18} />
        </span>
        <div>
          <p className="eyebrow">Portal access</p>
          <h3 id="vendor-access-title">Create vendor user</h3>
          <small>Access is restricted to {vendor.displayName}.</small>
        </div>
        <button
          aria-label="Close vendor access panel"
          className="icon-button"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      {created ? (
        <div className="vendor-access-success" role="status" aria-live="polite">
          <span aria-hidden="true">
            <CircleCheck size={19} />
          </span>
          <div>
            <strong>Portal user is ready</strong>
            <p>
              Share these credentials securely. The temporary password is shown
              only while this panel remains open.
            </p>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{created.email}</dd>
              </div>
              <div>
                <dt>Temporary password</dt>
                <dd>{created.temporaryPassword}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>
                  {created.roleKey === "vendor_owner"
                    ? "Vendor owner"
                    : "Catalog manager"}
                </dd>
              </div>
            </dl>
          </div>
          <button className="button button-secondary" onClick={copyCredentials} type="button">
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? "Copied" : "Copy credentials"}
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="vendor-access-form-grid">
            <label className="form-field">
              <span>First name <em>*</em></span>
              <input
                autoFocus
                required
                value={form.firstName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, firstName: event.target.value }))
                }
              />
            </label>
            <label className="form-field">
              <span>Last name</span>
              <input
                value={form.lastName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, lastName: event.target.value }))
                }
              />
            </label>
            <label className="form-field vendor-access-span-2">
              <span>Email <em>*</em></span>
              <input
                autoComplete="email"
                required
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label className="form-field">
              <span>Portal role <em>*</em></span>
              <select
                value={form.roleKey}
                onChange={(event) =>
                  setForm((current) => ({ ...current, roleKey: event.target.value }))
                }
              >
                <option value="vendor_owner">Vendor owner</option>
                <option value="vendor_catalog_manager">Catalog manager</option>
              </select>
            </label>
            <label className="form-field">
              <span>Temporary password <em>*</em></span>
              <span className="vendor-access-password">
                <input
                  autoComplete="new-password"
                  minLength={12}
                  required
                  type={showPassword ? "text" : "password"}
                  value={form.temporaryPassword}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      temporaryPassword: event.target.value,
                    }))
                  }
                />
                <button
                  aria-label={showPassword ? "Hide temporary password" : "Show temporary password"}
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </span>
            </label>
          </div>
          <div className="vendor-access-guidance">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              The owner can edit the vendor profile and offers. A catalog manager
              can edit offers but cannot change the business profile.
            </span>
          </div>
          {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span></div> : null}
          <footer>
            <button
              className="button button-secondary"
              disabled={saving}
              onClick={() =>
                setForm((current) => ({ ...current, temporaryPassword: temporaryPassword() }))
              }
              type="button"
            >
              <RefreshCcw size={15} aria-hidden="true" />
              Generate password
            </button>
            <button className="button button-success" disabled={saving} type="submit">
              <UserPlus size={15} aria-hidden="true" />
              {saving ? "Creating access..." : "Create portal user"}
            </button>
          </footer>
        </form>
      )}
    </section>
  );
}

function VendorDetailDialog({
  accessToken,
  canManage,
  onClose,
  onSaved,
  options,
  tenantId,
  vendorId,
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [offerDraft, setOfferDraft] = useState(null);
  const [profile, setProfile] = useState({});
  const [newOffer, setNewOffer] = useState({
    storeId: "",
    variantId: "",
    sellerSku: "",
    fulfillmentType: "MERCHANT",
    handlingTimeHours: "24",
    listPrice: "",
    salePrice: "",
    costPrice: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await vendorDetailsRequest(
        vendorId,
        accessToken,
        tenantId,
      );
      setDetails(result);
      setProfile({
        displayName: result.vendor.displayName,
        legalName: result.vendor.legalName,
        supportEmail: result.vendor.supportEmail,
        supportPhone: result.vendor.supportPhone,
        contactPerson: result.vendor.contactPerson,
        businessType: result.vendor.businessType,
        defaultCommissionPercent: String(
          result.vendor.defaultCommissionPercent || 0,
        ),
        settlementCycleDays: String(result.vendor.settlementCycleDays || 7),
        notes: result.vendor.notes || "",
        storeIds: result.stores
          .filter((store) => store.status === "ACTIVE")
          .map((store) => store.id),
      });
      const firstStore = result.stores.find(
        (store) => store.status === "ACTIVE",
      );
      setNewOffer((current) => ({
        ...current,
        storeId: current.storeId || firstStore?.id || "",
      }));
    } catch (requestError) {
      setError(requestError.message || "Vendor details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, vendorId]);
  useEffect(() => {
    load();
  }, [load]);
  const vendor = details?.vendor;
  const assignedStoreIds =
    details?.stores
      .filter((store) => store.status === "ACTIVE")
      .map((store) => store.id) || [];
  const assignedStores = options.stores.filter((store) =>
    assignedStoreIds.includes(store.id),
  );

  async function lifecycle(action) {
    setSaving(true);
    setError("");
    try {
      const result = await transitionVendorRequest(
        vendorId,
        action,
        "Updated from vendor operations",
        accessToken,
        tenantId,
      );
      setDetails(result);
      onSaved();
    } catch (requestError) {
      setError(requestError.message || "Vendor status could not be updated.");
    } finally {
      setSaving(false);
    }
  }
  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await updateVendorRequest(
        vendorId,
        {
          ...profile,
          defaultCommissionPercent: Number(profile.defaultCommissionPercent),
          settlementCycleDays: Number(profile.settlementCycleDays),
        },
        accessToken,
        tenantId,
      );
      setDetails(result);
      setEditingProfile(false);
      onSaved();
    } catch (requestError) {
      setError(requestError.message || "Vendor profile could not be updated.");
    } finally {
      setSaving(false);
    }
  }
  async function addOffer(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await createVendorOfferRequest(
        vendorId,
        {
          ...newOffer,
          handlingTimeHours: Number(newOffer.handlingTimeHours),
          listPrice: Number(newOffer.listPrice),
          salePrice: Number(newOffer.salePrice),
          costPrice:
            newOffer.costPrice === "" ? null : Number(newOffer.costPrice),
        },
        accessToken,
        tenantId,
      );
      setDetails(result);
      setNewOffer((current) => ({
        ...current,
        variantId: "",
        sellerSku: "",
        listPrice: "",
        salePrice: "",
        costPrice: "",
      }));
      onSaved();
    } catch (requestError) {
      setError(requestError.message || "Catalog offer could not be added.");
    } finally {
      setSaving(false);
    }
  }
  async function updateOffer(offerId, input) {
    setSaving(true);
    setError("");
    try {
      const result = await updateVendorOfferRequest(
        vendorId,
        offerId,
        input,
        accessToken,
        tenantId,
      );
      setDetails(result);
      setOfferDraft(null);
      onSaved();
    } catch (requestError) {
      setError(requestError.message || "Catalog offer could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialog-backdrop vendor-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-modal="true"
        className="vendor-dialog vendor-detail-dialog"
        role="dialog"
      >
        <DialogHeader
          eyebrow="Vendor workspace"
          icon={Building2}
          onClose={onClose}
          title={vendor?.displayName || "Loading vendor"}
        />
        {loading ? (
          <GlobalLoader inline label="Loading vendor" />
        ) : (
          <>
            <div className="vendor-dialog-scroll">
              {vendor ? (
                <>
                  <section className="vendor-profile-hero">
                    <div className="vendor-avatar" aria-hidden="true">
                      {vendor.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span>
                        <Status tone={statusTone[vendor.status]}>
                          {statusLabel[vendor.status]}
                        </Status>
                        <small>{vendor.merchantCode}</small>
                      </span>
                      <h3>{vendor.legalName}</h3>
                      <p>
                        <MapPin size={14} aria-hidden="true" />
                        {vendor.address?.city}, {vendor.address?.stateName} ·{" "}
                        {vendor.address?.postalCode}
                      </p>
                    </div>
                    <div className="vendor-profile-actions">
                      {canManage && vendor.status === "PENDING" ? (
                        <button
                          className="button button-success"
                          disabled={saving}
                          onClick={() => lifecycle("approve")}
                          type="button"
                        >
                          <CircleCheck size={16} aria-hidden="true" />
                          Approve
                        </button>
                      ) : null}
                      {canManage && vendor.status === "ACTIVE" ? (
                        <button
                          aria-expanded={creatingAccess}
                          className="button button-secondary"
                          disabled={saving}
                          onClick={() => setCreatingAccess((current) => !current)}
                          type="button"
                        >
                          <UserPlus size={16} aria-hidden="true" />
                          Portal user
                        </button>
                      ) : null}
                      {canManage && vendor.status === "ACTIVE" ? (
                        <button
                          className="button button-danger"
                          disabled={saving}
                          onClick={() => lifecycle("suspend")}
                          type="button"
                        >
                          <Ban size={16} aria-hidden="true" />
                          Suspend
                        </button>
                      ) : null}
                      {canManage && vendor.status === "SUSPENDED" ? (
                        <button
                          className="button button-success"
                          disabled={saving}
                          onClick={() => lifecycle("restore")}
                          type="button"
                        >
                          <RefreshCcw size={16} aria-hidden="true" />
                          Restore
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          aria-label="Edit vendor profile"
                          className="icon-button"
                          onClick={() =>
                            setEditingProfile((current) => !current)
                          }
                          type="button"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </section>
                  {creatingAccess ? (
                    <VendorAccessPanel
                      accessToken={accessToken}
                      onClose={() => setCreatingAccess(false)}
                      tenantId={tenantId}
                      vendor={vendor}
                    />
                  ) : null}
                  <section
                    aria-label="Vendor performance"
                    className="vendor-metric-strip"
                  >
                    <span>
                      <Tags size={17} aria-hidden="true" />
                      <small>Products</small>
                      <strong>{vendor.productCount}</strong>
                    </span>
                    <span>
                      <PackageCheck size={17} aria-hidden="true" />
                      <small>Active offers</small>
                      <strong>{vendor.activeOfferCount}</strong>
                    </span>
                    <span>
                      <BadgeIndianRupee size={17} aria-hidden="true" />
                      <small>Gross sales</small>
                      <strong>{money(vendor.grossSales)}</strong>
                    </span>
                    <span>
                      <Store size={17} aria-hidden="true" />
                      <small>Available units</small>
                      <strong>
                        {vendor.availableUnits.toLocaleString("en-IN")}
                      </strong>
                    </span>
                  </section>
                  {editingProfile ? (
                    <form
                      className="vendor-profile-editor"
                      onSubmit={saveProfile}
                    >
                      <header>
                        <div>
                          <strong>Edit operating profile</strong>
                          <small>
                            Tax identifiers remain locked after onboarding.
                          </small>
                        </div>
                        <button
                          aria-label="Close profile editor"
                          className="icon-button"
                          onClick={() => setEditingProfile(false)}
                          type="button"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </header>
                      <div className="form-grid vendor-form-grid">
                        <label className="form-field">
                          <span>Trading name</span>
                          <input
                            required
                            value={profile.displayName}
                            onChange={(event) =>
                              setProfile((current) => ({
                                ...current,
                                displayName: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Contact person</span>
                          <input
                            required
                            value={profile.contactPerson}
                            onChange={(event) =>
                              setProfile((current) => ({
                                ...current,
                                contactPerson: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Email</span>
                          <input
                            required
                            type="email"
                            value={profile.supportEmail}
                            onChange={(event) =>
                              setProfile((current) => ({
                                ...current,
                                supportEmail: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Phone</span>
                          <input
                            required
                            type="tel"
                            value={profile.supportPhone}
                            onChange={(event) =>
                              setProfile((current) => ({
                                ...current,
                                supportPhone: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Commission %</span>
                          <input
                            max="100"
                            min="0"
                            step="0.001"
                            type="number"
                            value={profile.defaultCommissionPercent}
                            onChange={(event) =>
                              setProfile((current) => ({
                                ...current,
                                defaultCommissionPercent: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Settlement days</span>
                          <input
                            max="90"
                            min="1"
                            type="number"
                            value={profile.settlementCycleDays}
                            onChange={(event) =>
                              setProfile((current) => ({
                                ...current,
                                settlementCycleDays: event.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                      <StorePicker
                        selected={profile.storeIds}
                        stores={options.stores}
                        toggle={(id) =>
                          setProfile((current) => ({
                            ...current,
                            storeIds: current.storeIds.includes(id)
                              ? current.storeIds.filter((entry) => entry !== id)
                              : [...current.storeIds, id],
                          }))
                        }
                      />
                      <button
                        className="button button-success"
                        disabled={saving || !profile.storeIds.length}
                        type="submit"
                      >
                        Save profile
                      </button>
                    </form>
                  ) : (
                    <section className="vendor-facts">
                      <div>
                        <span>
                          <UserRound size={16} aria-hidden="true" />
                        </span>
                        <small>Primary contact</small>
                        <strong>{vendor.contactPerson}</strong>
                        <p>
                          {vendor.supportEmail} · {vendor.supportPhone}
                        </p>
                      </div>
                      <div>
                        <span>
                          <ShieldCheck size={16} aria-hidden="true" />
                        </span>
                        <small>Tax registration</small>
                        <strong>{vendor.gstin}</strong>
                        <p>
                          PAN {vendor.pan} ·{" "}
                          {businessLabel[vendor.businessType]}
                        </p>
                      </div>
                      <div>
                        <span>
                          <Clock3 size={16} aria-hidden="true" />
                        </span>
                        <small>Commercial defaults</small>
                        <strong>
                          {vendor.defaultCommissionPercent}% commission
                        </strong>
                        <p>
                          {vendor.settlementCycleDays}-day manual settlement
                          cycle
                        </p>
                      </div>
                    </section>
                  )}
                  <section className="vendor-catalog-section">
                    <header>
                      <div>
                        <p className="eyebrow">Seller catalog</p>
                        <h3>Offers and pricing</h3>
                      </div>
                      <span>
                        {details.offers.length} offer
                        {details.offers.length === 1 ? "" : "s"}
                      </span>
                    </header>
                    {canManage && vendor.status === "ACTIVE" ? (
                      <form className="vendor-add-offer" onSubmit={addOffer}>
                        <div className="vendor-add-offer-title">
                          <Plus size={16} aria-hidden="true" />
                          <span>
                            <strong>Assign catalog variant</strong>
                            <small>
                              Create an approved seller offer for this vendor.
                            </small>
                          </span>
                        </div>
                        <label>
                          <span>Store</span>
                          <select
                            required
                            value={newOffer.storeId}
                            onChange={(event) =>
                              setNewOffer((current) => ({
                                ...current,
                                storeId: event.target.value,
                              }))
                            }
                          >
                            {assignedStores.map((store) => (
                              <option key={store.id} value={store.id}>
                                {store.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="vendor-offer-product">
                          <span>Product variant</span>
                          <select
                            required
                            value={newOffer.variantId}
                            onChange={(event) => {
                              const variant = options.variants.find(
                                (entry) => entry.id === event.target.value,
                              );
                              setNewOffer((current) => ({
                                ...current,
                                variantId: event.target.value,
                                sellerSku: variant?.sku || current.sellerSku,
                              }));
                            }}
                          >
                            <option value="">Select a variant</option>
                            {options.variants.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.productName} ·{" "}
                                {variant.variantName || variant.sku}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Seller SKU</span>
                          <input
                            required
                            value={newOffer.sellerSku}
                            onChange={(event) =>
                              setNewOffer((current) => ({
                                ...current,
                                sellerSku: event.target.value.toUpperCase(),
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>MRP</span>
                          <input
                            min="0.01"
                            required
                            step="0.01"
                            type="number"
                            value={newOffer.listPrice}
                            onChange={(event) =>
                              setNewOffer((current) => ({
                                ...current,
                                listPrice: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Selling price</span>
                          <input
                            min="0.01"
                            required
                            step="0.01"
                            type="number"
                            value={newOffer.salePrice}
                            onChange={(event) =>
                              setNewOffer((current) => ({
                                ...current,
                                salePrice: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Cost</span>
                          <input
                            min="0"
                            step="0.01"
                            type="number"
                            value={newOffer.costPrice}
                            onChange={(event) =>
                              setNewOffer((current) => ({
                                ...current,
                                costPrice: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          className="button button-success"
                          disabled={saving || !newOffer.variantId}
                          type="submit"
                        >
                          Add offer
                        </button>
                      </form>
                    ) : null}
                    {offerDraft ? (
                      <OfferEditor
                        draft={offerDraft}
                        onCancel={() => setOfferDraft(null)}
                        onSave={(input) => updateOffer(offerDraft.id, input)}
                        saving={saving}
                      />
                    ) : null}
                    {details.offers.length ? (
                      <div className="vendor-offer-list">
                        {details.offers.map((offer) => (
                          <article key={offer.id}>
                            <span
                              className="vendor-offer-icon"
                              data-vertical={offer.vertical}
                            >
                              <PackageCheck size={17} aria-hidden="true" />
                            </span>
                            <div>
                              <strong>{offer.productName}</strong>
                              <small>
                                {offer.variantName || offer.catalogSku} ·{" "}
                                {offer.sellerSku}
                              </small>
                            </div>
                            <span>
                              <small>Store</small>
                              <strong>{offer.storeName}</strong>
                            </span>
                            <span>
                              <small>Price</small>
                              <strong>{money(offer.salePrice)}</strong>
                              <del>
                                {offer.listPrice > offer.salePrice
                                  ? money(offer.listPrice)
                                  : ""}
                              </del>
                            </span>
                            <span>
                              <small>Stock</small>
                              <strong>
                                {offer.availableQuantity.toLocaleString(
                                  "en-IN",
                                )}
                              </strong>
                            </span>
                            <Status
                              tone={
                                offer.status === "ACTIVE"
                                  ? "positive"
                                  : "warning"
                              }
                            >
                              {offer.status === "ACTIVE" ? "Active" : "Paused"}
                            </Status>
                            {canManage ? (
                              <div className="vendor-offer-actions">
                                <button
                                  aria-label={`Edit ${offer.productName} offer`}
                                  className="icon-button"
                                  onClick={() => setOfferDraft(offer)}
                                  type="button"
                                >
                                  <Pencil size={15} aria-hidden="true" />
                                </button>
                                <button
                                  aria-label={`${offer.status === "ACTIVE" ? "Pause" : "Activate"} ${offer.productName} offer`}
                                  className={
                                    offer.status === "ACTIVE"
                                      ? "icon-button action-warning"
                                      : "icon-button action-success"
                                  }
                                  disabled={saving}
                                  onClick={() =>
                                    updateOffer(offer.id, {
                                      status:
                                        offer.status === "ACTIVE"
                                          ? "INACTIVE"
                                          : "ACTIVE",
                                    })
                                  }
                                  type="button"
                                >
                                  {offer.status === "ACTIVE" ? (
                                    <PauseCircle size={16} aria-hidden="true" />
                                  ) : (
                                    <CircleCheck size={16} aria-hidden="true" />
                                  )}
                                </button>
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="vendor-catalog-empty">
                        <Tags size={24} aria-hidden="true" />
                        <strong>No seller offers yet</strong>
                        <p>
                          {vendor.status === "ACTIVE"
                            ? "Assign a catalog variant above to start this vendor's assortment."
                            : "Approve the vendor before assigning catalog variants."}
                        </p>
                      </div>
                    )}
                  </section>
                </>
              ) : null}
              {error ? (
                <div className="inline-state inline-state-error" role="alert">
                  <span>{error}</span>
                  <button onClick={load} type="button">
                    Reload
                  </button>
                </div>
              ) : null}
            </div>
            <footer className="dialog-actions vendor-dialog-actions">
              <span>
                {vendor?.notes ||
                  "Vendor lifecycle and offer changes are audited."}
              </span>
              <button
                className="button button-secondary"
                onClick={onClose}
                type="button"
              >
                Close
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export default function VendorsPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "vendor.manage", tenantId);
  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    page: 1,
    pageSize: 10,
  });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState({ stores: [], variants: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError("");
    try {
      const [vendors, nextOptions] = await Promise.all([
        listVendorsRequest(filters, accessToken, tenantId),
        canManage
          ? vendorOptionsRequest("", accessToken, tenantId)
          : Promise.resolve({ stores: [], variants: [] }),
      ]);
      setResult(vendors);
      setOptions(nextOptions);
    } catch (requestError) {
      setError(requestError.message || "Vendors could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, canManage, filters, tenantId]);
  useEffect(() => {
    load();
  }, [load]);
  const summary = useMemo(
    () => result?.summary || { total: 0, pending: 0, active: 0, suspended: 0 },
    [result],
  );
  const items = result?.items || [];

  return (
    <AppShell
      area="admin"
      currentPath="/admin/vendors"
      eyebrow="Marketplace operations"
      title="Vendors"
      description="Onboard sellers, control store access, and manage their catalog offers and INR pricing."
      action={
        canManage ? (
          <button
            className="button button-primary"
            disabled={!options.stores.length}
            onClick={() => setDialog({ type: "create" })}
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
            Add vendor
          </button>
        ) : null
      }
    >
      <section aria-label="Vendor summary" className="vendor-signal-grid">
        <article>
          <span data-tone="teal">
            <Building2 size={18} aria-hidden="true" />
          </span>
          <div>
            <small>Marketplace vendors</small>
            <strong>{summary.total}</strong>
          </div>
        </article>
        <article>
          <span data-tone="warning">
            <Clock3 size={18} aria-hidden="true" />
          </span>
          <div>
            <small>Awaiting approval</small>
            <strong>{summary.pending}</strong>
          </div>
        </article>
        <article>
          <span data-tone="green">
            <CircleCheck size={18} aria-hidden="true" />
          </span>
          <div>
            <small>Active sellers</small>
            <strong>{summary.active}</strong>
          </div>
        </article>
        <article>
          <span data-tone="danger">
            <Ban size={18} aria-hidden="true" />
          </span>
          <div>
            <small>Suspended</small>
            <strong>{summary.suspended}</strong>
          </div>
        </article>
      </section>
      <section
        aria-labelledby="vendor-directory-title"
        className="tenant-directory vendor-directory"
      >
        <div className="section-heading tenant-directory-heading">
          <div>
            <p className="eyebrow">Seller network</p>
            <h2 id="vendor-directory-title">Vendor directory</h2>
          </div>
          <form
            className="directory-filters vendor-filters"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters((current) => ({
                ...current,
                search: draftSearch.trim(),
                page: 1,
              }));
            }}
            role="search"
          >
            <label className="compact-search">
              <span className="sr-only">Search vendors</span>
              <Search size={16} aria-hidden="true" />
              <input
                placeholder="Name, code, PAN or GSTIN"
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="Vendor status"
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                  page: 1,
                }))
              }
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending review</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <button className="button button-secondary" type="submit">
              Search
            </button>
          </form>
        </div>
        {error ? (
          <div className="inline-state inline-state-error" role="alert">
            <span>{error}</span>
            <button onClick={load} type="button">
              Try again
            </button>
          </div>
        ) : null}
        {loading ? (
          <GlobalLoader inline label="Loading vendors" />
        ) : !items.length ? (
          <div className="empty-workspace">
            <Building2 size={28} aria-hidden="true" />
            <h3>No vendors found</h3>
            <p>
              Add the first marketplace seller and submit their GST, store
              scope, and commercial defaults for review.
            </p>
            {canManage ? (
              <button
                className="button button-primary"
                onClick={() => setDialog({ type: "create" })}
                type="button"
              >
                <Plus size={16} aria-hidden="true" />
                Add first vendor
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="vendor-row-head" aria-hidden="true">
              <span>Vendor</span>
              <span>Stores</span>
              <span>Catalog</span>
              <span>Gross sales</span>
              <span>Status</span>
              <span />
            </div>
            <div className="vendor-row-list">
              {items.map((vendor) => (
                <button
                  className="vendor-row"
                  key={vendor.id}
                  onClick={() => setDialog({ type: "detail", id: vendor.id })}
                  type="button"
                >
                  <span className="vendor-row-identity">
                    <i>{vendor.displayName.slice(0, 2).toUpperCase()}</i>
                    <span>
                      <strong>{vendor.displayName}</strong>
                      <small>
                        {vendor.merchantCode} · {vendor.gstin}
                      </small>
                    </span>
                  </span>
                  <span>
                    <small>Stores</small>
                    <strong>{vendor.storeCount}</strong>
                  </span>
                  <span>
                    <small>Catalog</small>
                    <strong>{vendor.activeOfferCount} active</strong>
                    <small>{vendor.productCount} products</small>
                  </span>
                  <span>
                    <small>Gross sales</small>
                    <strong>{money(vendor.grossSales)}</strong>
                  </span>
                  <span>
                    <Status tone={statusTone[vendor.status]}>
                      {statusLabel[vendor.status]}
                    </Status>
                    <small>{vendor.contactPerson}</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              ))}
            </div>
            <TablePagination
              itemLabel="vendors"
              onPageChange={(page) =>
                setFilters((current) => ({ ...current, page }))
              }
              onPageSizeChange={(pageSize) =>
                setFilters((current) => ({ ...current, page: 1, pageSize }))
              }
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              totalPages={result.totalPages}
            />
          </>
        )}
      </section>
      {dialog?.type === "create" ? (
        <CreateVendorDialog
          accessToken={accessToken}
          onClose={() => setDialog(null)}
          onSaved={(id) => {
            load();
            setDialog({ type: "detail", id });
          }}
          options={options}
          tenantId={tenantId}
        />
      ) : null}
      {dialog?.type === "detail" ? (
        <VendorDetailDialog
          accessToken={accessToken}
          canManage={canManage}
          onClose={() => setDialog(null)}
          onSaved={load}
          options={options}
          tenantId={tenantId}
          vendorId={dialog.id}
        />
      ) : null}
    </AppShell>
  );
}
