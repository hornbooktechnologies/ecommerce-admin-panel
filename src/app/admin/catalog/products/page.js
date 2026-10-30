"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, BadgeIndianRupee, Boxes, CheckCircle2, FileImage,
  Grid3X3, PackagePlus, Palette, PencilLine, Plus, RotateCcw,
  Rocket, Search, Send, ShieldCheck, Tags, Trash2, UploadCloud,
  Weight, X, XCircle, Zap
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useUnsavedChanges } from "@/components/use-unsaved-changes";
import { ProductSetupFields } from "@/components/product-setup-fields";
import { productSetupSteps, productSetupProblems } from "@/lib/product-setup";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CatalogTabs } from "@/components/catalog-tabs";
import { GlobalLoader } from "@/components/global-loader";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import {
  catalogLookupsRequest, createCatalogProductRequest, deleteCatalogProductRequest,
  getCatalogProductVariantsRequest, listCatalogProductsRequest,
  transitionCatalogProductRequest, updateCatalogProductPricesRequest,
  updateCatalogProductRequest, uploadCatalogProductMediaRequest
} from "@/lib/api-client";

const productImageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const productImageLimit = 6;
const productImageMaxBytes = 8 * 1024 * 1024;

const statusTone = {
  PUBLISHED: "positive", APPROVED: "positive", PENDING: "warning",
  REJECTED: "danger", DRAFT: "neutral", ARCHIVED: "danger"
};

function productLifecycleStage(product) {
  if (product.publicationStatus === "PUBLISHED") return { key: "PUBLISHED", label: "Published" };
  if (product.publicationStatus === "ARCHIVED") return { key: "ARCHIVED", label: "Archived" };
  if (product.approvalStatus === "PENDING") return { key: "PENDING", label: "Awaiting approval" };
  if (product.approvalStatus === "APPROVED") return { key: "APPROVED", label: "Approved" };
  if (product.approvalStatus === "REJECTED") return { key: "REJECTED", label: "Changes requested" };
  return { key: "DRAFT", label: "Draft" };
}
const verticalMeta = {
  GENERAL: { label: "General", icon: Boxes, hint: "Standard quantity-tracked merchandise." },
  GROCERY: { label: "Grocery", icon: Weight, hint: "Batch, expiry, substitutions, and variable weight ready." },
  ELECTRONICS: { label: "Electronics", icon: Zap, hint: "Serial-number and warranty ready." },
  CLOTHING: { label: "Clothing", icon: Tags, hint: "Color, size, and exchange-window ready." }
};

const blankForm = {
  productCode: "", name: "", productKind: "STANDARD", vertical: "GENERAL", brandId: "", categoryId: "",
  taxCategoryId: "", imageUrls: [], shortDescription: "",
  customFields: [],
  hsnSacCode: "", countryOfOrigin: "IN", manufacturerName: "", ingredients: "",
  storageInstructions: "", allowSubstitutions: false, modelNumber: "", gender: "",
  isReturnable: true, returnWindowDays: "7", baseUomId: "", sellingUomId: "",
  material: "", soldByWeight: false, minimumOrderQuantity: "1", quantityStep: "1",
  estimatedWeight: "", minimumWeight: "", maximumWeight: "", weightStep: "",
  warrantyMonths: "", warrantyType: "MANUFACTURER"
};

function nullableNumber(value) {
  return value === "" || value === null ? null : Number(value);
}

function skuPart(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function variantKey(color, size) {
  return `${color?.id || "none"}:${size?.id || "none"}`;
}

function generatedSku(productCode, color, size) {
  const suffix = [color?.value || color?.name, size?.value || size?.name].filter(Boolean).map(skuPart).join("-");
  return [skuPart(productCode), suffix || "DEFAULT"].filter(Boolean).join("-");
}

function makeVariant(color, size, productCode) {
  return {
    key: variantKey(color, size), colorOptionId: color?.id || "", colorName: color?.name || "",
    colorSwatch: color?.swatchValue || "", sizeOptionId: size?.id || "", sizeName: size?.name || "",
    name: [color?.name, size?.name].filter(Boolean).join(" / ") || "Standard",
    sku: generatedSku(productCode, color, size), skuTouched: false, barcode: "",
    listPrice: "", salePrice: "", costPrice: ""
  };
}

function formatPriceRange(product) {
  if (product.minimumPrice === null || product.minimumPrice === undefined) return "Not priced";
  const money = (value) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return product.minimumPrice === product.maximumPrice
    ? money(product.minimumPrice)
    : `${money(product.minimumPrice)} – ${money(product.maximumPrice)}`;
}

function AxisPicker({ icon: Icon, items, label, selected, onToggle }) {
  return <section className="variant-axis" aria-labelledby={`${label.toLowerCase()}-axis-label`}>
    <div className="variant-axis-head">
      <span className="variant-axis-icon"><Icon size={15} aria-hidden="true" /></span>
      <span><strong id={`${label.toLowerCase()}-axis-label`}>{label}</strong><small>Select any values that create distinct SKUs.</small></span>
    </div>
    <div className="variant-option-list">
      {items.map((item) => {
        const active = selected.includes(item.id);
        return <button aria-pressed={active} data-selected={active || undefined} key={item.id}
          onClick={() => onToggle(item.id)} type="button">
          {item.swatchValue ? <i aria-hidden="true" style={{ background: item.swatchValue }} /> : null}
          <span>{item.name}</span>
        </button>;
      })}
    </div>
  </section>;
}

function customFieldsPayload(fields) {
  const labels = fields.map((field) => field.label.trim().toLocaleLowerCase("en-IN"));
  if (new Set(labels).size !== labels.length) throw new Error("Use a unique name for every custom field.");
  if (fields.some((field) => field.type === "NUMBER" && String(field.value).trim() === "")) {
    throw new Error("Enter a value for every custom number field.");
  }
  return fields.map((field) => ({
    label: field.label.trim(), type: field.type,
    value: field.type === "NUMBER" ? Number(field.value) : field.value
  }));
}

function PendingImage({ disabled, file, index, productName, onRemove }) {
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <figure>{previewUrl
    ? <img alt={`${productName || "Product"} upload preview ${index + 1}`} src={previewUrl} />
    : <span className="product-image-pending-preview"><FileImage aria-hidden="true" size={20} /></span>}
    <figcaption>{index === 0 ? "Primary" : `Gallery ${index}`} · Ready to upload</figcaption>
    <button aria-label={`Remove selected image ${index + 1}`} disabled={disabled} onClick={onRemove} type="button">
      <Trash2 aria-hidden="true" size={14} />
    </button></figure>;
}

function ProductImagePicker({ disabled, existingUrls, files, onChange, onExistingChange, onError, productName }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const total = existingUrls.length + files.length;

  function selectFiles(fileList) {
    const incoming = [...fileList];
    const invalidType = incoming.find((file) => !productImageTypes.includes(file.type));
    if (invalidType) { onError("Choose JPEG, PNG, WebP or AVIF images."); return; }
    const oversized = incoming.find((file) => file.size > productImageMaxBytes);
    if (oversized) { onError(`${oversized.name} is larger than 8 MB.`); return; }
    const known = new Set(files.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    const unique = incoming.filter((file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`));
    const remaining = productImageLimit - total;
    if (unique.length > remaining) {
      onError(`You can add ${remaining} more image${remaining === 1 ? "" : "s"}.`);
    } else onError("");
    onChange([...files, ...unique.slice(0, Math.max(0, remaining))]);
  }

  return <div className="product-image-upload">
    <div aria-disabled={disabled || total >= productImageLimit} aria-label="Upload product images"
      className="product-image-dropzone" data-active={dragging || undefined} role="button" tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && total < productImageLimit && inputRef.current?.click()}
      onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false);
        if (!disabled && total < productImageLimit) selectFiles(event.dataTransfer.files); }}
      onKeyDown={(event) => {
        if (!disabled && total < productImageLimit && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault(); inputRef.current?.click();
        }
      }}>
      <input accept={productImageTypes.join(",")} disabled={disabled || total >= productImageLimit} multiple
        onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} ref={inputRef} type="file" />
      <span className="product-image-upload-icon"><UploadCloud aria-hidden="true" size={22} /></span>
      <span><strong>{total >= productImageLimit ? "Image limit reached" : "Drop product images here"}</strong>
        <small>JPEG, PNG, WebP or AVIF · up to 8 MB each</small></span>
      <span className="button button-secondary"><FileImage aria-hidden="true" size={15} />
        {total ? "Add more" : "Choose images"}</span>
    </div>
    <p className="fieldset-help">Add up to six images. The first image becomes the primary catalog image.</p>
    {total ? <div className="product-image-grid">
      {existingUrls.map((url, index) => <figure key={url}><img alt={`${productName || "Product"} preview ${index + 1}`} src={url} />
        <figcaption>{index === 0 ? "Primary" : `Gallery ${index}`}</figcaption>
        <button aria-label={`Remove image ${index + 1}`} disabled={disabled}
          onClick={() => onExistingChange(existingUrls.filter((item) => item !== url))} type="button">
          <Trash2 aria-hidden="true" size={14} />
        </button></figure>)}
      {files.map((file, fileIndex) => <PendingImage file={file} index={existingUrls.length + fileIndex}
        disabled={disabled} key={`${file.name}:${file.size}:${file.lastModified}`} productName={productName}
        onRemove={() => onChange(files.filter((item) => item !== file))} />)}
    </div> : <div className="image-empty"><UploadCloud aria-hidden="true" size={22} />
      <span>No product images selected</span></div>}
  </div>;
}

function CustomFieldsEditor({ fields, onChange, errors = [] }) {
  function addField() {
    if (fields.length >= 30) return;
    onChange([...fields, {
      clientId: crypto.randomUUID(), label: "", type: "TEXT", value: ""
    }]);
  }

  function updateField(clientId, key, value) {
    onChange(fields.map((field) => field.clientId === clientId
      ? { ...field, [key]: value, ...(key === "type" ? { value: value === "BOOLEAN" ? false : "" } : {}) }
      : field));
  }

  function removeField(clientId) {
    onChange(fields.filter((field) => field.clientId !== clientId));
  }

  return <ProductSetupFields prefix="setup-custom" errors={errors}><fieldset className="catalog-fieldset custom-fields-section">
    <legend>Additional specifications</legend>
    <div className="custom-fields-head">
      <div><strong>Need another product field?</strong><p>Add specifications that are not covered by the standard form.</p></div>
      <button className="button button-secondary" disabled={fields.length >= 30} onClick={addField} type="button">
        <Plus aria-hidden="true" size={15} />Add custom field
      </button>
    </div>
    {fields.length ? <div className="custom-fields-list">
      {fields.map((field, index) => <div className="custom-field-row" key={field.clientId}>
        <span className="custom-field-order" aria-hidden="true">{index + 1}</span>
        <label className="form-field"><span>Field name <em>*</em></span><input maxLength={120} placeholder="e.g. Screen size" required value={field.label} onChange={(event) => updateField(field.clientId, "label", event.target.value)} /></label>
        <label className="form-field"><span>Value type</span><select value={field.type} onChange={(event) => updateField(field.clientId, "type", event.target.value)}><option value="TEXT">Text</option><option value="NUMBER">Number</option><option value="BOOLEAN">Yes / No</option><option value="DATE">Date</option></select></label>
        <label className="form-field custom-field-value"><span>Value <em>*</em></span>{field.type === "BOOLEAN"
          ? <select value={String(field.value)} onChange={(event) => updateField(field.clientId, "value", event.target.value === "true")}><option value="false">No</option><option value="true">Yes</option></select>
          : <input maxLength={field.type === "TEXT" ? 2000 : undefined} required step={field.type === "NUMBER" ? "any" : undefined} type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"} value={field.value} onChange={(event) => updateField(field.clientId, "value", event.target.value)} />}</label>
        <button aria-label={`Remove ${field.label || `custom field ${index + 1}`}`} className="custom-field-remove" onClick={() => removeField(field.clientId)} type="button"><Trash2 aria-hidden="true" size={15} /></button>
      </div>)}
    </div> : <div className="custom-fields-empty"><span>No additional specifications yet.</span><small>Examples: pattern, capacity, screen size, care instructions, or shelf life.</small></div>}
  </fieldset></ProductSetupFields>;
}

function ProductDialog({ lookups, onClose, onCreated }) {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const each = lookups.units.find((unit) => unit.code === "EA") || lookups.units[0];
  const allowedProductTypes = lookups.productTypes || [];
  const initialVertical = allowedProductTypes[0]?.vertical || "";
  const initialUnit = initialVertical === "GROCERY"
    ? lookups.units.find((unit) => unit.code === "KG") || each : each;
  const [form, setForm] = useState({ ...blankForm, vertical: initialVertical,
    soldByWeight: initialVertical === "GROCERY", customFields: [], baseUomId: initialUnit?.id || "",
    sellingUomId: initialUnit?.id || "", taxCategoryId: lookups.taxCategories[0]?.id || "" });
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [variants, setVariants] = useState([makeVariant(null, null, "")]);
  const [bulkPrice, setBulkPrice] = useState({ listPrice: "", salePrice: "", costPrice: "" });
  const [imageFiles, setImageFiles] = useState([]);
  const [createdProductId, setCreatedProductId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0), [issues, setIssues] = useState([]);
  const formRef = useRef(null), dialogRef = useRef(null), errorRef = useRef(null);
  const submitLock = useRef(false);
  const imageCount = useRef(0);
  const active = useRef(true);
  const [initialSnapshot] = useState(() => JSON.stringify({ form, variants, selectedColors, selectedSizes, bulkPrice }));
  const dirty = createdProductId ? imageFiles.length > 0 : imageFiles.length > 0
    || JSON.stringify({ form, variants, selectedColors, selectedSizes, bulkPrice }) !== initialSnapshot;
  const leaveGuard = useUnsavedChanges({
    dirty, busy: saving, onLeave: closeSetup,
    ...(createdProductId ? {
      title: "Leave remaining images?",
      description: "The product draft is already saved. Remaining selected images have not been uploaded. Closing keeps the saved draft and uploaded images; you can add the remaining images later in Media.",
      discardLabel: "Close saved draft"
    } : {})
  });

  useEffect(() => {
    active.current = true;
    const previous = document.activeElement;
    return () => { active.current = false; previous?.focus?.(); };
  }, []);
  useEffect(() => {
    dialogRef.current?.querySelector(`[data-setup-step="${step}"] h3`)?.focus();
    const scroll = dialogRef.current?.querySelector(".catalog-form-scroll");
    if (scroll) scroll.scrollTop = 0;
  }, [step]);
  useEffect(() => {
    if (issues.length || error) errorRef.current?.focus();
  }, [issues, error]);

  function focusIssue(issue) {
    setStep(issue.step);
    requestAnimationFrame(() => {
      const target = document.getElementById(issue.id);
      let parent = target?.parentElement;
      while (parent && parent !== formRef.current) {
        if (parent.tagName === "DETAILS") parent.open = true;
        parent = parent.parentElement;
      }
      target?.focus();
      target?.scrollIntoView({ block: "center", behavior: "instant" });
    });
  }

  function validateSteps(steps) {
    const controls = [...formRef.current.querySelectorAll("input, select, textarea")];
    const next = [];
    for (const control of controls) {
      const section = control.closest("[data-setup-step]");
      const number = Number(section?.dataset.setupStep);
      if (!section || !steps.includes(number) || control.disabled || control.closest(".bulk-price-bar")) continue;
      if (!control.validity.valid || (control.required && !String(control.value).trim())) {
        const label = control.getAttribute("aria-label") || control.closest("label")?.querySelector("span")?.textContent?.replace("*", "").trim() || "This field";
        next.push({ step: number, id: control.id, message: `${label}: ${control.validationMessage || "Enter a value."}` });
      }
    }
    for (const problem of productSetupProblems(form, variants, allowedProductTypes).filter(item => steps.includes(item.step))) {
      const control = controls.find(item => item.dataset.field === problem.field);
      const id = control?.id || `setup-heading-${problem.step}`;
      if (!next.some(item => item.id === id)) next.push({ ...problem, id });
    }
    setIssues(next);
    if (next.length) { setStep(next[0].step); return false; }
    return true;
  }

  function goTo(next) {
    if (saving || createdProductId) return;
    if (next > step && !validateSteps(Array.from({ length: next }, (_, index) => index))) return;
    setError(""); setIssues([]); setStep(next);
  }

  function closeSetup() {
    if (submitLock.current) return;
    if (createdProductId) onCreated({ name: form.name, code: form.productCode, kind: form.productKind,
      variants: variants.length, imagesPending: imageFiles.length });
    else onClose();
  }

  useEffect(() => {
    setVariants((current) => current.map((variant) => variant.skuTouched ? variant : {
      ...variant,
      sku: generatedSku(form.productCode,
        lookups.colors.find((item) => item.id === variant.colorOptionId),
        lookups.sizes.find((item) => item.id === variant.sizeOptionId))
    }));
  }, [form.productCode, lookups.colors, lookups.sizes]);

  function update(field, value) {
    setForm((current) => {
      if (field !== "vertical") return { ...current, [field]: value };
      const preferred = value === "GROCERY"
        ? lookups.units.find((unit) => unit.code === "KG") || each
        : each;
      return { ...current, vertical: value, soldByWeight: value === "GROCERY",
        baseUomId: preferred?.id || "", sellingUomId: preferred?.id || "" };
    });
  }

  function rebuildMatrix(nextColors, nextSizes) {
    const colors = nextColors.length
      ? nextColors.map((id) => lookups.colors.find((item) => item.id === id)).filter(Boolean)
      : [null];
    const sizes = nextSizes.length
      ? nextSizes.map((id) => lookups.sizes.find((item) => item.id === id)).filter(Boolean)
      : [null];
    setVariants((current) => {
      const existing = new Map(current.map((variant) => [variant.key, variant]));
      return colors.flatMap((color) => sizes.map((size) => {
        const key = variantKey(color, size);
        return existing.get(key) || makeVariant(color, size, form.productCode);
      }));
    });
  }

  function toggleColor(id) {
    const next = selectedColors.includes(id)
      ? selectedColors.filter((item) => item !== id) : [...selectedColors, id];
    if ((next.length || 1) * (selectedSizes.length || 1) > 100) {
      setError("A product can contain up to 100 color and size combinations.");
      return;
    }
    setSelectedColors(next); rebuildMatrix(next, selectedSizes); setError("");
  }

  function toggleSize(id) {
    const next = selectedSizes.includes(id)
      ? selectedSizes.filter((item) => item !== id) : [...selectedSizes, id];
    if ((selectedColors.length || 1) * (next.length || 1) > 100) {
      setError("A product can contain up to 100 color and size combinations.");
      return;
    }
    setSelectedSizes(next); rebuildMatrix(selectedColors, next); setError("");
  }

  function updateVariant(key, field, value) {
    setVariants((current) => current.map((variant) => variant.key === key
      ? { ...variant, [field]: value, ...(field === "sku" ? { skuTouched: true } : {}) }
      : variant));
  }

  function applyBulkPrice() {
    if (!bulkPrice.listPrice || !bulkPrice.salePrice) {
      setError("Enter both MRP and selling price before applying prices to every variant.");
      return;
    }
    setVariants((current) => current.map((variant) => ({ ...variant, ...bulkPrice })));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (submitLock.current) return;
    if (step < 4) { goTo(step + 1); return; }
    if (!createdProductId && !validateSteps([0, 1, 2])) return;
    const invalidPrice = variants.find((variant) => Number(variant.salePrice) > Number(variant.listPrice));
    if (invalidPrice) {
      setError(`${invalidPrice.name}: selling price cannot be greater than MRP.`);
      return;
    }
    submitLock.current = true;
    let draftCreated = Boolean(createdProductId);
    setSaving(true); setError("");
    try {
      let productId = createdProductId;
      if (!productId) {
        const result = await createCatalogProductRequest({
          productCode: form.productCode, name: form.name, productKind: form.productKind, vertical: form.vertical,
          brandId: form.brandId || null, categoryId: form.categoryId || null,
          taxCategoryId: form.taxCategoryId || null, imageUrls: [],
          shortDescription: form.shortDescription, hsnSacCode: form.hsnSacCode,
          countryOfOrigin: form.countryOfOrigin, manufacturerName: form.manufacturerName,
          customFields: customFieldsPayload(form.customFields),
          ingredients: form.ingredients, storageInstructions: form.storageInstructions,
          allowSubstitutions: form.allowSubstitutions, modelNumber: form.modelNumber,
          gender: form.gender, isReturnable: form.isReturnable,
          returnWindowDays: form.isReturnable ? nullableNumber(form.returnWindowDays) : null,
          variants: variants.map((variant) => ({
            sku: variant.sku, barcode: variant.barcode, name: variant.name,
            colorOptionId: variant.colorOptionId || null, sizeOptionId: variant.sizeOptionId || null,
            material: form.material, baseUomId: form.baseUomId, sellingUomId: form.sellingUomId,
            soldByWeight: form.soldByWeight, minimumOrderQuantity: Number(form.minimumOrderQuantity),
            quantityStep: Number(form.quantityStep), estimatedWeight: nullableNumber(form.estimatedWeight),
            minimumWeight: nullableNumber(form.minimumWeight), maximumWeight: nullableNumber(form.maximumWeight),
            weightStep: nullableNumber(form.weightStep), warrantyMonths: nullableNumber(form.warrantyMonths),
            warrantyType: form.warrantyMonths ? form.warrantyType : null,
            pricing: { listPrice: Number(variant.listPrice), salePrice: Number(variant.salePrice),
              costPrice: nullableNumber(variant.costPrice) }
          }))
        }, accessToken, tenantId);
        productId = result.product.id;
        if (!active.current) return;
        imageCount.current = imageFiles.length;
        draftCreated = true;
        setCreatedProductId(productId);
      }
      for (const file of [...imageFiles]) {
        if (!active.current) return;
        await uploadCatalogProductMediaRequest(productId, file, {
          altText: `${form.name} product image`, variantId: null, colorOptionId: null
        }, accessToken, tenantId);
        setImageFiles((current) => current.filter((item) => item !== file));
      }
      if (active.current) onCreated({ name: form.name, code: form.productCode, kind: form.productKind, variants: variants.length, images: imageCount.current });
    } catch (requestError) {
      if (!active.current) return;
      setError(draftCreated
        ? `The product draft was created. ${requestError.message || "An image could not be uploaded."} Retry to upload the remaining images.`
        : requestError.message || "The product could not be created.");
    } finally { submitLock.current = false; if (active.current) setSaving(false); }
  }


  const meta = verticalMeta[form.vertical] || verticalMeta.GENERAL;
  const VerticalIcon = meta.icon;
  return createPortal(<div className="dialog-backdrop product-setup-backdrop" role="presentation"
    onMouseDown={(event) => event.target === event.currentTarget && !saving && leaveGuard.requestClose()}>
    <section ref={dialogRef} aria-labelledby="new-product-title" aria-modal="true" className="catalog-dialog catalog-dialog-wide product-setup" role="dialog"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary')].filter(item => item.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <header className="access-dialog-head catalog-dialog-head">
        <div className="dialog-icon" data-tone="positive"><PackagePlus size={19} aria-hidden="true" /></div>
        <div><p className="eyebrow">Guided product setup</p><h2 id="new-product-title">Add a product</h2></div>
        <button aria-label="Close product dialog" className="icon-button" disabled={saving} onClick={leaveGuard.requestClose} type="button"><X size={18} /></button>
      </header>
      <ol className="setup-steps" aria-label="Product setup steps">{productSetupSteps.map((label, index) => <li key={label}>
        <button aria-current={step === index ? "step" : undefined} disabled={saving || Boolean(createdProductId)} onClick={() => goTo(index)} type="button"><span>{index + 1}</span>{label}</button>
      </li>)}</ol>
      <form ref={formRef} noValidate onSubmit={submit} onChangeCapture={() => { if (issues.length) setIssues([]); }}>
        <div className="catalog-form-scroll">
          {issues.length || error ? <div className="setup-errors" ref={errorRef} tabIndex={-1} role="alert"><h3>{createdProductId ? "Draft saved — images need attention" : "Please check the following"}</h3>
            {error ? <p>{error}</p> : null}{issues.length ? <ul>{issues.map((issue, index) => <li key={issue.id + index}><button type="button" onClick={() => focusIssue(issue)}>{issue.message}</button></li>)}</ul> : null}
          </div> : null}
          <fieldset disabled={saving || Boolean(createdProductId)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <section className="setup-stage" data-setup-step="0" hidden={step !== 0}>
              <h3 className="setup-step-title" tabIndex={-1} id="setup-heading-0">Start with the essentials</h3>
              <p className="setup-step-help">Choose the product type and structure, then add its name and category. Standard is right for an individual product; bundles contain other products.</p>
                      {allowedProductTypes.length === 1 ? <div className="vertical-picker vertical-picker-single" aria-label="Product type"><div data-selected="true"><VerticalIcon size={17} aria-hidden="true" /><span><strong>{meta.label}</strong><small>This tenant is configured for {meta.label.toLowerCase()} products.</small></span><i>Fixed</i></div></div>
          : <div className="vertical-picker" aria-label="Product type">
            {allowedProductTypes.map((productType) => {
              const key = productType.vertical;
              const item = verticalMeta[key] || { label: productType.name, hint: "Tenant-enabled product type.", icon: Boxes };
              const Icon = item.icon;
              return <button aria-pressed={form.vertical === key} data-selected={form.vertical === key || undefined}
                key={key} onClick={() => update("vertical", key)} type="button">
                <Icon size={17} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.hint}</small></span>
              </button>;
            })}
          </div>}

              <ProductSetupFields prefix="setup-basics" errors={issues}>          <fieldset className="catalog-fieldset"><legend>Product identity</legend><div className="form-grid">
            <label className="form-field"><span>Product code <em>*</em></span><input minLength={2} maxLength={60} placeholder="TSHIRT-001" required data-field="productCode" value={form.productCode} onChange={(event) => update("productCode", event.target.value.toUpperCase())} /></label>
            <label className="form-field"><span>Product name <em>*</em></span><input minLength={2} maxLength={255} placeholder="Classic cotton t-shirt" required data-field="name" value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label className="form-field catalog-span-2"><span>Product structure</span><select data-field="productKind" value={form.productKind} onChange={(event) => update("productKind", event.target.value)}><option value="STANDARD">Standard product</option><option value="BUNDLE">Bundle / kit</option></select><small className="field-help">Bundle components are assigned after this draft is created.</small></label>
            <label className="form-field"><span>Category</span><select data-field="categoryId" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">Uncategorised</option>{lookups.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small className="field-help">Managed in Catalog Masters.</small></label>
            <label className="form-field"><span>Brand</span><select data-field="brandId" value={form.brandId} onChange={(event) => update("brandId", event.target.value)}><option value="">No brand</option>{lookups.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small className="field-help">Managed in Catalog Masters.</small></label>
</div></fieldset>
<details className="setup-advanced"><summary>Tax, origin and additional details</summary><fieldset className="catalog-fieldset"><legend>Additional details</legend><div className="form-grid">            <label className="form-field"><span>GST category</span><select data-field="taxCategoryId" value={form.taxCategoryId} onChange={(event) => update("taxCategoryId", event.target.value)}><option value="">Not assigned</option>{lookups.taxCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>HSN code</span><input maxLength={20} placeholder="6109" data-field="hsnSacCode" value={form.hsnSacCode} onChange={(event) => update("hsnSacCode", event.target.value)} /></label>
            <label className="form-field"><span>Country of origin</span><input maxLength={2} required data-field="countryOfOrigin" value={form.countryOfOrigin} onChange={(event) => update("countryOfOrigin", event.target.value.toUpperCase())} /></label>
            <label className="form-field"><span>Manufacturer</span><input maxLength={190} placeholder="Manufacturer or producer" data-field="manufacturerName" value={form.manufacturerName} onChange={(event) => update("manufacturerName", event.target.value)} /></label>
            <label className="form-field catalog-span-2"><span>Short description</span><textarea maxLength={2000} rows={2} data-field="shortDescription" value={form.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} /></label>
          </div></fieldset>
<CustomFieldsEditor fields={form.customFields} errors={issues} onChange={(customFields) => update("customFields", customFields)} /></details></ProductSetupFields>
            </section>
            <section className="setup-stage" data-setup-step="1" hidden={step !== 1}>
              <h3 className="setup-step-title" tabIndex={-1} id="setup-heading-1">Choose variants and prices</h3>
              <p className="setup-step-help">Every colour and size combination has its own SKU and price. If there are no variations, keep the Standard row.</p>
              <ProductSetupFields prefix="setup-variants" errors={issues}>          <fieldset className="catalog-fieldset variant-builder"><legend>Variant matrix and pricing</legend>
            <div className="variant-builder-intro"><span><Grid3X3 size={17} aria-hidden="true" /></span><div><strong>Build every sellable combination</strong><p>Select colors and sizes. Each combination gets an independent SKU and price in Indian rupees.</p></div><b>{variants.length} {variants.length === 1 ? "variant" : "variants"}</b></div>
            <div className="variant-axis-grid">
              <AxisPicker icon={Palette} items={lookups.colors} label="Colors" selected={selectedColors} onToggle={toggleColor} />
              <AxisPicker icon={Tags} items={lookups.sizes} label="Sizes" selected={selectedSizes} onToggle={toggleSize} />
            </div>
            <div className="variant-common-fields form-grid form-grid-four">
              <label className="form-field"><span>Selling unit <em>*</em></span><select required data-field="sellingUomId" value={form.sellingUomId} onChange={(event) => { update("sellingUomId", event.target.value); update("baseUomId", event.target.value); }}>{lookups.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>)}</select></label>
              <label className="form-field"><span>Material</span><input maxLength={190} placeholder="Cotton, steel, glass" data-field="material" value={form.material} onChange={(event) => update("material", event.target.value)} /></label>
              <label className="form-field"><span>Minimum order</span><input min="0.001" required step="0.001" type="number" data-field="minimumOrderQuantity" value={form.minimumOrderQuantity} onChange={(event) => update("minimumOrderQuantity", event.target.value)} /></label>
              <label className="form-field"><span>Quantity step</span><input min="0.001" required step="0.001" type="number" data-field="quantityStep" value={form.quantityStep} onChange={(event) => update("quantityStep", event.target.value)} /></label>
            </div>
            <div className="bulk-price-bar">
              <span className="bulk-price-title"><BadgeIndianRupee size={17} aria-hidden="true" /><span><strong>Bulk price</strong><small>Optional shortcut for all rows</small></span></span>
              <label><span>MRP</span><input aria-label="Bulk MRP" min="0.01" placeholder="0.00" step="0.01" type="number" value={bulkPrice.listPrice} onChange={(event) => setBulkPrice((current) => ({ ...current, listPrice: event.target.value }))} /></label>
              <label><span>Selling</span><input aria-label="Bulk selling price" min="0.01" placeholder="0.00" step="0.01" type="number" value={bulkPrice.salePrice} onChange={(event) => setBulkPrice((current) => ({ ...current, salePrice: event.target.value }))} /></label>
              <label><span>Cost</span><input aria-label="Bulk cost price" min="0" placeholder="Optional" step="0.01" type="number" value={bulkPrice.costPrice} onChange={(event) => setBulkPrice((current) => ({ ...current, costPrice: event.target.value }))} /></label>
              <button className="button button-secondary" onClick={applyBulkPrice} type="button">Apply to all</button>
            </div>
            <div className="variant-matrix-wrap"><table className="variant-matrix"><thead><tr><th>Combination</th><th>SKU</th><th>Barcode</th><th>MRP (₹)</th><th>Selling (₹)</th><th>Cost (₹)</th></tr></thead><tbody>
              {variants.map((variant) => <tr key={variant.key}><td><span className="variant-combination">{variant.colorSwatch ? <i aria-hidden="true" style={{ background: variant.colorSwatch }} /> : null}<span><strong>{variant.name}</strong><small>{[variant.colorName && "Color", variant.sizeName && "Size"].filter(Boolean).join(" + ") || "Base variant"}</small></span></span></td><td><input aria-label={`${variant.name} SKU`} maxLength={100} required data-field={`variant:${variant.key}:sku`} value={variant.sku} onChange={(event) => updateVariant(variant.key, "sku", event.target.value.toUpperCase())} /></td><td><input aria-label={`${variant.name} barcode`} maxLength={100} placeholder="Optional" data-field={`variant:${variant.key}:barcode`} value={variant.barcode} onChange={(event) => updateVariant(variant.key, "barcode", event.target.value)} /></td><td><input aria-label={`${variant.name} MRP`} min="0.01" required step="0.01" type="number" data-field={`variant:${variant.key}:listPrice`} value={variant.listPrice} onChange={(event) => updateVariant(variant.key, "listPrice", event.target.value)} /></td><td><input aria-label={`${variant.name} selling price`} min="0.01" required step="0.01" type="number" data-field={`variant:${variant.key}:salePrice`} value={variant.salePrice} onChange={(event) => updateVariant(variant.key, "salePrice", event.target.value)} /></td><td><input aria-label={`${variant.name} cost price`} min="0" placeholder="Optional" step="0.01" type="number" data-field={`variant:${variant.key}:costPrice`} value={variant.costPrice} onChange={(event) => updateVariant(variant.key, "costPrice", event.target.value)} /></td></tr>)}
            </tbody></table></div>
          </fieldset>
          {form.vertical === "GROCERY" ? <fieldset className="catalog-fieldset vertical-fields"><legend>Grocery handling</legend><div className="form-grid"><label className="form-field catalog-span-2"><span>Ingredients</span><textarea maxLength={2000} rows={2} data-field="ingredients" value={form.ingredients} onChange={(event) => update("ingredients", event.target.value)} /></label><label className="form-field catalog-span-2"><span>Storage instructions</span><input maxLength={1000} placeholder="Keep refrigerated between 2°C and 8°C" data-field="storageInstructions" value={form.storageInstructions} onChange={(event) => update("storageInstructions", event.target.value)} /></label></div><label className="switch-row"><input checked={form.allowSubstitutions} onChange={(event) => update("allowSubstitutions", event.target.checked)} type="checkbox" /><span><strong>Allow substitutions</strong><small>Substitute products can be assigned after this draft is created.</small></span></label><label className="switch-row"><input checked={form.soldByWeight} onChange={(event) => update("soldByWeight", event.target.checked)} type="checkbox" /><span><strong>Sell by measured weight</strong><small>Final price can use the picked weight.</small></span></label>{form.soldByWeight ? <div className="form-grid form-grid-four"><label className="form-field"><span>Estimated kg</span><input min="0" step="0.001" type="number" data-field="estimatedWeight" value={form.estimatedWeight} onChange={(event) => update("estimatedWeight", event.target.value)} /></label><label className="form-field"><span>Minimum kg</span><input min="0" step="0.001" type="number" data-field="minimumWeight" value={form.minimumWeight} onChange={(event) => update("minimumWeight", event.target.value)} /></label><label className="form-field"><span>Maximum kg</span><input min="0" step="0.001" type="number" data-field="maximumWeight" value={form.maximumWeight} onChange={(event) => update("maximumWeight", event.target.value)} /></label><label className="form-field"><span>Weight step kg <em>*</em></span><input min="0.001" required step="0.001" type="number" data-field="weightStep" value={form.weightStep} onChange={(event) => update("weightStep", event.target.value)} /></label></div> : null}</fieldset> : null}
          {form.vertical === "ELECTRONICS" ? <fieldset className="catalog-fieldset vertical-fields"><legend>Warranty and serial control</legend><div className="form-grid"><label className="form-field"><span>Model number</span><input maxLength={120} data-field="modelNumber" value={form.modelNumber} onChange={(event) => update("modelNumber", event.target.value)} /></label><label className="form-field"><span>Warranty months</span><input min="0" max="240" type="number" data-field="warrantyMonths" value={form.warrantyMonths} onChange={(event) => update("warrantyMonths", event.target.value)} /></label><label className="form-field"><span>Warranty provider</span><select disabled={!form.warrantyMonths} data-field="warrantyType" value={form.warrantyType} onChange={(event) => update("warrantyType", event.target.value)}><option value="MANUFACTURER">Manufacturer</option><option value="SELLER">Seller</option><option value="EXTENDED">Extended</option></select></label></div><p className="fieldset-help"><ShieldCheck size={15} aria-hidden="true" />Serial numbers will be captured when inventory is received.</p></fieldset> : null}
          {form.vertical === "CLOTHING" ? <fieldset className="catalog-fieldset vertical-fields"><legend>Apparel details</legend><div className="form-grid"><label className="form-field"><span>Customer group</span><select data-field="gender" value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="">Not specified</option><option value="MEN">Men</option><option value="WOMEN">Women</option><option value="UNISEX">Unisex</option><option value="KIDS">Kids</option></select></label><div className="fieldset-help apparel-hint"><Tags aria-hidden="true" size={15} />Each selected color and size combination is independently priced and stocked.</div></div></fieldset> : null}
          <fieldset className="catalog-fieldset"><legend>Returns and exchanges</legend><div className="return-policy-row"><label className="switch-row"><input checked={form.isReturnable} onChange={(event) => update("isReturnable", event.target.checked)} type="checkbox" /><span><strong>{form.vertical === "CLOTHING" ? "Allow returns and size exchanges" : "Allow returns"}</strong><small>Applied to orders after publication.</small></span></label>{form.isReturnable ? <label className="form-field compact-number"><span>Window (days)</span><input min="0" max="365" required type="number" data-field="returnWindowDays" value={form.returnWindowDays} onChange={(event) => update("returnWindowDays", event.target.value)} /></label> : null}</div></fieldset></ProductSetupFields>
            </section>
            <section className="setup-stage" data-setup-step="2" hidden={step !== 2}>
              <h3 className="setup-step-title" tabIndex={-1} id="setup-heading-2">Show the product clearly</h3>
              <p className="setup-step-help">Upload from your device. These images form the shared product gallery. After saving, use Media to create a colour gallery shared across all its sizes, order images or edit alternative text.</p>
                        <fieldset className="catalog-fieldset"><legend>Product imagery</legend><ProductImagePicker
            disabled={saving} existingUrls={[]} files={imageFiles} onChange={setImageFiles}
            onError={setError} onExistingChange={() => {}} productName={form.name} /></fieldset>

            </section>
            <section className="setup-stage" data-setup-step="3" hidden={step !== 3}>
              <h3 className="setup-step-title" tabIndex={-1} id="setup-heading-3">{form.productKind === "BUNDLE" ? "Plan the bundle components" : "Plan stock for each variant"}</h3>
              <p className="setup-step-help">Creating a product does not receive stock. Inventory must be recorded against the correct variant, seller and warehouse after the draft is saved.</p>
              <div className="setup-note"><Boxes size={24} aria-hidden="true" /><div><strong>{form.productKind === "BUNDLE" ? "Bundle stock comes from its components" : "Published does not mean available"}</strong>
                {form.productKind === "BUNDLE" ? "The smallest complete quantity supported by the required components determines bundle availability. Receiving stock directly against the bundle will not make it sellable." : "A published product can still be out of stock. Stock on a different colour, size, seller or warehouse does not make this variant available."}
              </div></div>
              <ol className="setup-next-list">
                <li><strong>Save this draft.</strong> {variants.length} variant{variants.length === 1 ? "" : "s"} will be created with the prices you entered.</li>
                <li>{form.productKind === "BUNDLE" ? <><strong>Open Bundles.</strong> Assign component variants and required quantities.</> : <><strong>Open Inventory → Receive stock.</strong> Select the exact SKU, seller and warehouse, then enter the received quantity.</>}</li>
                {form.vertical === "GROCERY" ? <li><strong>Record batches and expiry.</strong> Use the correct selling unit and weight increments for measured-weight products.</li> : null}
                {form.vertical === "ELECTRONICS" ? <li><strong>Capture serial numbers.</strong> Serial tracking and warranty controls remain part of receiving and fulfilment.</li> : null}
                <li><strong>Verify storefront availability.</strong> Check stock, seller offer, approval and publication separately before expecting customers to buy.</li>
              </ol>
            </section>
            <section className="setup-stage" data-setup-step="4" hidden={step !== 4}>
              <h3 className="setup-step-title" tabIndex={-1} id="setup-heading-4">Review before creating the draft</h3>
              <p className="setup-step-help">Nothing is published or stocked by this action. Your existing approval and publication permissions still apply.</p>
              <dl className="setup-review">
                <div><dt>Product</dt><dd>{form.name} · {form.productCode}</dd></div>
                <div><dt>Type / structure</dt><dd>{meta.label} · {form.productKind === "BUNDLE" ? "Bundle / kit" : "Standard product"}</dd></div>
                <div><dt>Category / brand</dt><dd>{lookups.categories.find(item => item.id === form.categoryId)?.name || "Uncategorised"} · {lookups.brands.find(item => item.id === form.brandId)?.name || "No brand"}</dd></div>
                <div><dt>Product images</dt><dd>{createdProductId ? imageFiles.length + " still to upload" : imageFiles.length ? imageFiles.length + " selected — upload on save" : "No images selected (optional for a draft)"}</dd></div>
                <div><dt>Publication</dt><dd>Draft — not published</dd></div>
                <div><dt>Stock</dt><dd>{form.productKind === "BUNDLE" ? "Components not assigned yet" : "No stock received by this form"}</dd></div>
              </dl>
              <ul className="setup-review-prices" aria-label="Variant prices">{variants.map(variant => <li key={variant.key}><span><strong>{variant.name}</strong><small>{variant.sku}</small></span><span>₹{Number(variant.salePrice || 0).toLocaleString("en-IN")}<small>MRP ₹{Number(variant.listPrice || 0).toLocaleString("en-IN")}</small></span></li>)}</ul>
              <div className="setup-note"><CheckCircle2 size={20} aria-hidden="true" /><span>{createdProductId ? "The draft already exists. Retry uploads without creating another product, or close the draft and manage images later in Media." : "Create the draft now. You can then receive stock, finish media or bundle setup, and submit for approval when ready."}</span></div>
            </section>
          </fieldset>
        </div>
        <footer className="dialog-actions catalog-dialog-actions"><span>Step {step + 1} of 5 · {productSetupSteps[step]}{saving ? " · Saving…" : ""}</span><div>
          <button className="button button-secondary" disabled={saving} onClick={leaveGuard.requestClose} type="button">{createdProductId ? "Close saved draft" : "Cancel"}</button>
          {step > 0 && !createdProductId ? <button className="button button-secondary" disabled={saving} onClick={() => goTo(step - 1)} type="button">Back</button> : null}
          <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving draft and images…" : createdProductId ? "Retry remaining images" : step === 4 ? "Create draft" : "Continue"}</button>
        </div></footer>
      </form>
    </section>
    {leaveGuard.confirmation}
  </div>, document.body);
}

function EditProductDialog({ product, lookups, onClose, onSaved }) {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [form, setForm] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [baseline, setBaseline] = useState(null);
  const [hasSaved, setHasSaved] = useState(false);
  const loadToken = useRef(accessToken), saveLock = useRef(false);
  useEffect(() => { loadToken.current = accessToken; }, [accessToken]);
  const leaveGuard = useUnsavedChanges({
    dirty: imageFiles.length > 0 || (form !== null && baseline !== null && JSON.stringify(form) !== baseline),
    busy: saving, onLeave: () => hasSaved ? onSaved() : onClose(),
    description: hasSaved
      ? "Some changes have already been saved and will be kept. Only unsaved edits and remaining selected images will be discarded."
      : "Unsaved product edits and selected images will be discarded. The existing saved product will remain unchanged."
  });

  useEffect(() => {
    let active = true;
    getCatalogProductVariantsRequest(product.id, loadToken.current, tenantId)
      .then((result) => {
        if (!active) return;
        const nextForm = { ...result.product,
        imageUrls: result.product.imageUrls || [],
        customFields: (result.product.customFields || []).map((field) => ({
          ...field, clientId: field.attributeId || crypto.randomUUID()
        })),
        returnWindowDays: result.product.returnWindowDays ?? "" };
        setForm(nextForm); setBaseline(JSON.stringify(nextForm));
      })
      .catch((requestError) => active && setError(requestError.message || "Product details could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [product.id, tenantId]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true;
    let productSaved = false;
    setSaving(true); setError("");
    try {
      await updateCatalogProductRequest(product.id, {
        name: form.name, brandId: form.brandId || null, categoryId: form.categoryId || null,
        taxCategoryId: form.taxCategoryId || null, imageUrls: form.imageUrls,
        shortDescription: form.shortDescription, hsnSacCode: form.hsnSacCode,
        countryOfOrigin: form.countryOfOrigin, manufacturerName: form.manufacturerName,
        customFields: customFieldsPayload(form.customFields),
        ingredients: form.ingredients, storageInstructions: form.storageInstructions,
        allowSubstitutions: form.allowSubstitutions, modelNumber: form.modelNumber,
        gender: form.gender, isReturnable: form.isReturnable,
        returnWindowDays: form.isReturnable ? nullableNumber(form.returnWindowDays) : null
      }, accessToken, tenantId);
      productSaved = true;
      let savedForm = form;
      setHasSaved(true); setBaseline(JSON.stringify(savedForm));
      for (const file of [...imageFiles]) {
        const media = await uploadCatalogProductMediaRequest(product.id, file, {
          altText: `${form.name} product image`, variantId: null, colorOptionId: null
        }, accessToken, tenantId);
        savedForm = { ...savedForm, imageUrls: media.items
          .filter((item) => !item.variantId && !item.colorOptionId).map((item) => item.url) };
        setForm(savedForm); setBaseline(JSON.stringify(savedForm));
        setImageFiles((current) => current.filter((item) => item !== file));
      }
      onSaved();
    } catch (requestError) {
      setError(productSaved && imageFiles.length
        ? `Product details were saved. ${requestError.message || "An image could not be uploaded."} Retry to upload the remaining images.`
        : requestError.message || "The product could not be updated.");
    } finally { saveLock.current = false; setSaving(false); }
  }

  const meta = verticalMeta[form?.vertical] || verticalMeta.GENERAL;
  const VerticalIcon = meta.icon;
  return <div className="dialog-backdrop" role="presentation"
    onMouseDown={(event) => event.target === event.currentTarget && !saving && leaveGuard.requestClose()}>
    <section aria-labelledby="edit-product-title" aria-modal="true" className="catalog-dialog edit-product-dialog" role="dialog">
      <header className="access-dialog-head catalog-dialog-head">
        <div className="dialog-icon" data-tone="positive"><PencilLine size={19} aria-hidden="true" /></div>
        <div><p className="eyebrow">Catalog editor</p><h2 id="edit-product-title">Edit product</h2></div>
        <button aria-label="Close edit product dialog" className="icon-button" disabled={saving} onClick={leaveGuard.requestClose} type="button"><X size={18} /></button>
      </header>
      {loading ? <GlobalLoader inline label="Loading product details" /> : form ? <form onSubmit={submit}>
        <div className="catalog-form-scroll" inert={saving}>
          <div className="edit-product-identity">
            <span className="product-glyph" data-vertical={form.vertical}><VerticalIcon size={17} aria-hidden="true" /></span>
            <span><strong>{form.productCode}</strong><small>{meta.label} · Product code and vertical are locked</small></span>
          </div>
          {form.publicationStatus === "PUBLISHED" ? <p className="field-hint" role="note">Changes go live when saved. The product stays published and its storefront URL stays the same. Category, GST category and HSN code are required.</p> : null}
          <fieldset className="catalog-fieldset"><legend>Product information</legend><div className="form-grid">
            <label className="form-field catalog-span-2"><span>Product name <em>*</em></span><input autoFocus maxLength={255} required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label className="form-field"><span>Category</span><select value={form.categoryId || ""} onChange={(event) => update("categoryId", event.target.value)}><option value="">Uncategorised</option>{lookups.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>Brand</span><select value={form.brandId || ""} onChange={(event) => update("brandId", event.target.value)}><option value="">No brand</option>{lookups.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>GST category</span><select value={form.taxCategoryId || ""} onChange={(event) => update("taxCategoryId", event.target.value)}><option value="">Not assigned</option>{lookups.taxCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>HSN code</span><input maxLength={20} value={form.hsnSacCode} onChange={(event) => update("hsnSacCode", event.target.value)} /></label>
            <label className="form-field"><span>Country of origin</span><input maxLength={2} required value={form.countryOfOrigin} onChange={(event) => update("countryOfOrigin", event.target.value.toUpperCase())} /></label>
            <label className="form-field"><span>Manufacturer</span><input maxLength={190} value={form.manufacturerName} onChange={(event) => update("manufacturerName", event.target.value)} /></label>
            <label className="form-field catalog-span-2"><span>Short description</span><textarea maxLength={2000} rows={3} value={form.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} /></label>
          </div></fieldset>
          <fieldset className="catalog-fieldset"><legend>Product imagery</legend><ProductImagePicker
            disabled={saving} existingUrls={form.imageUrls} files={imageFiles} onChange={setImageFiles}
            onError={setError} onExistingChange={(imageUrls) => update("imageUrls", imageUrls)}
            productName={form.name} /></fieldset>
          {form.vertical === "GROCERY" ? <fieldset className="catalog-fieldset vertical-fields"><legend>Grocery details</legend><div className="form-grid"><label className="form-field catalog-span-2"><span>Ingredients</span><textarea maxLength={2000} rows={2} value={form.ingredients} onChange={(event) => update("ingredients", event.target.value)} /></label><label className="form-field catalog-span-2"><span>Storage instructions</span><input maxLength={1000} value={form.storageInstructions} onChange={(event) => update("storageInstructions", event.target.value)} /></label></div><label className="switch-row"><input checked={form.allowSubstitutions} onChange={(event) => update("allowSubstitutions", event.target.checked)} type="checkbox" /><span><strong>Allow substitutions</strong><small>Customers can accept an approved substitute.</small></span></label></fieldset> : null}
          {form.vertical === "ELECTRONICS" ? <fieldset className="catalog-fieldset vertical-fields"><legend>Electronics details</legend><div className="form-grid"><label className="form-field"><span>Model number</span><input maxLength={120} value={form.modelNumber} onChange={(event) => update("modelNumber", event.target.value)} /></label></div></fieldset> : null}
          {form.vertical === "CLOTHING" ? <fieldset className="catalog-fieldset vertical-fields"><legend>Apparel details</legend><div className="form-grid"><label className="form-field"><span>Customer group</span><select value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="">Not specified</option><option value="MEN">Men</option><option value="WOMEN">Women</option><option value="UNISEX">Unisex</option><option value="KIDS">Kids</option></select></label></div></fieldset> : null}
          <CustomFieldsEditor fields={form.customFields} onChange={(customFields) => update("customFields", customFields)} />
          <fieldset className="catalog-fieldset"><legend>Returns and exchanges</legend><div className="return-policy-row"><label className="switch-row"><input checked={form.isReturnable} onChange={(event) => update("isReturnable", event.target.checked)} type="checkbox" /><span><strong>{form.vertical === "CLOTHING" ? "Allow returns and size exchanges" : "Allow returns"}</strong><small>Changes apply to future orders.</small></span></label>{form.isReturnable ? <label className="form-field compact-number"><span>Window (days)</span><input min="0" max="365" required type="number" value={form.returnWindowDays} onChange={(event) => update("returnWindowDays", event.target.value)} /></label> : null}</div></fieldset>
        </div>
        {error ? <div className="form-error catalog-error" role="alert">{error}</div> : null}
        <footer className="dialog-actions catalog-dialog-actions"><span>Variant prices are managed separately.</span><div><button className="button button-secondary" disabled={saving} onClick={leaveGuard.requestClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving and uploading…" : "Save changes"}</button></div></footer>
      </form> : <div className="inline-state inline-state-error" role="alert"><span>{error}</span></div>}
    </section>
    {leaveGuard.confirmation}
  </div>;
}

function ProductLifecycleDialog({ product, action, onClose, onDone }) {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [confirmation, setConfirmation] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const actionCopy = {
    submit: { title: "Submit for approval", description: "Catalog readiness will be checked before this product enters the approval queue.", button: "Submit product", tone: "positive", icon: Send },
    approve: { title: "Approve product", description: "Confirm that the product details, GST data, variants and prices are ready to publish.", button: "Approve product", tone: "positive", icon: CheckCircle2 },
    reject: { title: "Request product changes", description: "Return the product to its editor with a clear note describing what must be corrected.", button: "Request changes", tone: "danger", icon: XCircle },
    publish: { title: "Publish product", description: "The product and all priced seller offers become active and available to order operations.", button: "Publish product", tone: "positive", icon: Rocket },
    archive: { title: "Archive product", description: "The product and its seller offers will no longer be active. Pricing and history are retained.", button: "Archive product", tone: "warning", icon: Archive },
    restore: { title: "Restore product", description: "The product returns as a draft and must pass approval before it can be published again.", button: "Restore as draft", tone: "positive", icon: RotateCcw },
    delete: { title: "Delete draft product", description: "This removes the product from the catalog. Products with inventory or transaction history cannot be deleted.", button: "Delete product", tone: "danger", icon: Trash2 }
  };
  const copy = actionCopy[action];
  const ActionIcon = copy.icon;

  useEffect(() => {
    function closeOnEscape(event) { if (event.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  async function confirm() {
    setBusy(true); setError(null);
    try {
      if (action === "delete") {
        await deleteCatalogProductRequest(product.id, accessToken, tenantId);
      } else {
        await transitionCatalogProductRequest(product.id, action, accessToken, tenantId,
          ["approve", "reject"].includes(action) ? { note: note.trim() } : undefined);
      }
      onDone();
    } catch (requestError) {
      setError({ message: requestError.message || "The product could not be updated.",
        details: requestError.details || [] });
    } finally { setBusy(false); }
  }

  const deleteConfirmed = action !== "delete" || confirmation.trim().toUpperCase() === product.productCode.toUpperCase();
  const noteValid = action !== "reject" || note.trim().length >= 10;
  return <div className="dialog-backdrop" role="presentation"
    onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <section aria-labelledby="product-lifecycle-title" aria-modal="true" className="action-dialog product-lifecycle-dialog" role="dialog">
      <div className="action-dialog-head"><span className="dialog-icon" data-tone={copy.tone}><ActionIcon size={19} aria-hidden="true" /></span><button aria-label="Close product action dialog" className="icon-button" disabled={busy} onClick={onClose} type="button"><X size={18} /></button></div>
      <h2 id="product-lifecycle-title">{copy.title}</h2><p>{copy.description}</p>
      <div className="dialog-product"><small>Product</small><strong>{product.name}</strong><span>{product.productCode}</span></div>
      {action === "delete" ? <label className="form-field"><span>Type <strong>{product.productCode}</strong> to confirm</span><input autoFocus autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label> : null}
      {["approve", "reject"].includes(action) ? <label className="form-field lifecycle-note"><span>{action === "reject" ? "Change request note *" : "Approval note (optional)"}</span><textarea autoFocus maxLength={500} placeholder={action === "reject" ? "Explain what must be corrected before resubmission." : "Add a short approval note for the audit trail."} required={action === "reject"} rows={3} value={note} onChange={(event) => setNote(event.target.value)} /><small>{note.length}/500{action === "reject" ? " · Minimum 10 characters" : ""}</small></label> : null}
      {error ? <div className="form-error lifecycle-error" role="alert"><strong>{error.message}</strong>{error.details.length ? <ul>{error.details.map((detail, index) => <li key={`${detail.field || "detail"}-${index}`}>{detail.message}</li>)}</ul> : null}</div> : null}
      <div className="dialog-actions"><button className="button button-secondary" disabled={busy} onClick={onClose} type="button">Cancel</button><button className={`button ${["delete", "reject"].includes(action) ? "button-danger" : action === "archive" ? "button-warning" : action === "submit" ? "button-primary" : "button-success"}`} disabled={busy || !deleteConfirmed || !noteValid} onClick={confirm} type="button">{busy ? "Saving..." : copy.button}</button></div>
    </section>
  </div>;
}

function PriceDialog({ product, onClose, onSaved }) {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [details, setDetails] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [baseline, setBaseline] = useState(null);
  const loadToken = useRef(accessToken), saveLock = useRef(false);
  useEffect(() => { loadToken.current = accessToken; }, [accessToken]);
  const leaveGuard = useUnsavedChanges({
    dirty: baseline !== null && JSON.stringify(rows) !== baseline,
    busy: saving, onLeave: onClose,
    description: "Unsaved variant price changes will be discarded. Your saved prices and price history will remain unchanged."
  });

  useEffect(() => {
    let active = true;
    getCatalogProductVariantsRequest(product.id, loadToken.current, tenantId)
      .then((result) => {
        if (!active) return;
        setDetails(result);
        const nextRows = result.variants.map((variant) => ({ ...variant,
          listPrice: variant.listPrice ?? "", salePrice: variant.salePrice ?? "",
          costPrice: variant.costPrice ?? "" }));
        setRows(nextRows); setBaseline(JSON.stringify(nextRows));
      })
      .catch((requestError) => active && setError(requestError.message || "Variant prices could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [product.id, tenantId]);

  function updateRow(id, field, value) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  async function submit(event) {
    event.preventDefault();
    if (saveLock.current) return;
    const invalid = rows.find((row) => Number(row.salePrice) > Number(row.listPrice));
    if (invalid) { setError(`${invalid.name || invalid.sku}: selling price cannot exceed MRP.`); return; }
    saveLock.current = true;
    setSaving(true); setError("");
    try {
      await updateCatalogProductPricesRequest(product.id, rows.map((row) => ({
        variantId: row.id, listPrice: Number(row.listPrice), salePrice: Number(row.salePrice),
        costPrice: nullableNumber(row.costPrice)
      })), accessToken, tenantId);
      onSaved();
    } catch (requestError) {
      setError(requestError.message || "Variant prices could not be saved.");
    } finally { saveLock.current = false; setSaving(false); }
  }

  return <div className="dialog-backdrop" role="presentation"
    onMouseDown={(event) => event.target === event.currentTarget && !saving && leaveGuard.requestClose()}>
    <section aria-labelledby="price-dialog-title" aria-modal="true" className="catalog-dialog price-dialog" role="dialog">
      <header className="access-dialog-head catalog-dialog-head">
        <div className="dialog-icon" data-tone="positive"><BadgeIndianRupee size={19} aria-hidden="true" /></div>
        <div><p className="eyebrow">Variant pricing</p><h2 id="price-dialog-title">{product.name}</h2></div>
        <button aria-label="Close pricing dialog" className="icon-button" disabled={saving} onClick={leaveGuard.requestClose} type="button"><X size={18} /></button>
      </header>
      {loading ? <GlobalLoader inline label="Loading variant prices" /> : details ? <form onSubmit={submit}>
        {details ? <div className="pricing-scope"><span><strong>{details.scope.priceListName}</strong><small>{details.scope.storeName} · {details.scope.merchantName}</small></span><Status tone="positive">{details.scope.currency} · Tax inclusive</Status></div> : null}
        <div className="catalog-form-scroll price-form-scroll" inert={saving}>
          <div className="variant-matrix-wrap"><table className="variant-matrix price-matrix"><thead><tr><th>Variant</th><th>SKU</th><th>MRP (₹)</th><th>Selling (₹)</th><th>Cost (₹)</th></tr></thead><tbody>
            {rows.map((row) => <tr key={row.id}><td><span className="variant-combination">{row.colorSwatch ? <i aria-hidden="true" style={{ background: row.colorSwatch }} /> : null}<span><strong>{[row.colorName, row.sizeName].filter(Boolean).join(" / ") || row.name || "Standard"}</strong><small>{row.priceStartedAt ? "Current price" : "Not priced yet"}</small></span></span></td><td><code>{row.sku}</code></td><td><input aria-label={`${row.sku} MRP`} min="0.01" required step="0.01" type="number" value={row.listPrice} onChange={(event) => updateRow(row.id, "listPrice", event.target.value)} /></td><td><input aria-label={`${row.sku} selling price`} min="0.01" required step="0.01" type="number" value={row.salePrice} onChange={(event) => updateRow(row.id, "salePrice", event.target.value)} /></td><td><input aria-label={`${row.sku} cost price`} min="0" placeholder="Optional" step="0.01" type="number" value={row.costPrice} onChange={(event) => updateRow(row.id, "costPrice", event.target.value)} /></td></tr>)}
          </tbody></table></div>
        </div>
        {error ? <div className="form-error catalog-error" role="alert">{error}</div> : null}
        <footer className="dialog-actions catalog-dialog-actions"><span>Saving creates a new price-history entry for each variant.</span><div><button className="button button-secondary" disabled={saving} onClick={leaveGuard.requestClose} type="button">Cancel</button><button className="button button-primary" disabled={saving || !rows.length} type="submit">{saving ? "Saving…" : "Save prices"}</button></div></footer>
      </form> : null}
      {!loading && error && !details ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span></div> : null}
    </section>
    {leaveGuard.confirmation}
  </div>;
}

function ProductRow({ product, canApprove, canUpdate, onEdit, onPrices, onLifecycle }) {
  const meta = verticalMeta[product.vertical] || verticalMeta.GENERAL;
  const Icon = meta.icon;
  const archived = product.publicationStatus === "ARCHIVED";
  const published = product.publicationStatus === "PUBLISHED";
  const stage = productLifecycleStage(product);
  const editable = (published && product.approvalStatus === "APPROVED")
    || (!published && !["PENDING", "APPROVED"].includes(product.approvalStatus));
  const canSubmit = canUpdate && product.publicationStatus === "DRAFT"
    && ["DRAFT", "REJECTED"].includes(product.approvalStatus);
  const canReview = canApprove && product.publicationStatus === "DRAFT"
    && product.approvalStatus === "PENDING";
  const canPublish = canApprove && product.publicationStatus === "DRAFT"
    && product.approvalStatus === "APPROVED";
  return <tr>
    <td data-label="Product"><span className="product-cell">{product.primaryImageUrl
      ? <img alt="" className="product-thumb" src={product.primaryImageUrl} />
      : <span className="product-glyph" data-vertical={product.vertical}><Icon size={17} aria-hidden="true" /></span>}
      <span><strong>{product.name}</strong><small>{product.productCode}{product.brandName ? ` · ${product.brandName}` : ""}{product.categoryName ? ` · ${product.categoryName}` : ""}</small></span>
    </span></td>
    <td data-label="Vertical"><span className="vertical-label">{meta.label}</span></td>
    <td data-label="Variants">{product.variantCount}</td>
    <td data-label="Price"><span className="price-range" data-empty={product.minimumPrice == null || undefined}>{formatPriceRange(product)}</span></td>
    <td data-label="Available"><strong className="stock-number">{product.availableQuantity.toLocaleString("en-IN")}</strong></td>
    <td data-label="Status"><span className="product-stage"><Status tone={statusTone[stage.key] || "neutral"}>{stage.label}</Status>{stage.key === "REJECTED" && product.approvalNote ? <small title={product.approvalNote}>{product.approvalNote}</small> : null}</span></td>
    <td data-label="Actions">{canUpdate || canApprove ? <div className="product-row-actions">
      {canUpdate && editable ? <button className="row-action" data-action="edit" onClick={() => onEdit(product)} type="button"><PencilLine size={14} aria-hidden="true" />Edit</button> : null}
      {canUpdate ? <button className="row-action" data-action="pricing" onClick={() => onPrices(product)} type="button"><BadgeIndianRupee size={14} aria-hidden="true" />Prices</button> : null}
      {canSubmit ? <button className="row-action" data-action="submit" onClick={() => onLifecycle(product, "submit")} type="button"><Send size={14} aria-hidden="true" />Submit</button> : null}
      {canReview ? <><button className="row-action" data-action="approve" onClick={() => onLifecycle(product, "approve")} type="button"><CheckCircle2 size={14} aria-hidden="true" />Approve</button><button className="row-action" data-action="reject" onClick={() => onLifecycle(product, "reject")} type="button"><XCircle size={14} aria-hidden="true" />Changes</button></> : null}
      {canPublish ? <button className="row-action" data-action="publish" onClick={() => onLifecycle(product, "publish")} type="button"><Rocket size={14} aria-hidden="true" />Publish</button> : null}
      {canUpdate && (archived || published || ["PENDING", "APPROVED"].includes(product.approvalStatus)) ? <button className="row-action" data-action={archived ? "restore" : "archive"} onClick={() => onLifecycle(product, archived ? "restore" : "archive")} type="button">{archived ? <RotateCcw size={14} aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}{archived ? "Restore" : "Archive"}</button> : null}
      {canUpdate && ["DRAFT", "REJECTED"].includes(product.approvalStatus) && ["DRAFT", "ARCHIVED"].includes(product.publicationStatus)
        ? <button className="row-action" data-action="delete" onClick={() => onLifecycle(product, "delete")} type="button"><Trash2 size={14} aria-hidden="true" />Delete</button>
        : null}
    </div> : null}</td>
  </tr>;
}

export default function ProductsPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [filters, setFilters] = useState({ search: "", status: "ALL", vertical: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [lookups, setLookups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [pricingProduct, setPricingProduct] = useState(null);
  const [lifecycle, setLifecycle] = useState(null);
  const canCreate = canUser(user, "admin", "catalog.product.create", tenantId);
  const canUpdate = canUser(user, "admin", "catalog.product.update", tenantId);
  const canApprove = canUser(user, "admin", "catalog.product.approve", tenantId);
  const enabledProductTypes = lookups?.productTypes || [];
  const catalogConfigured = enabledProductTypes.length > 0;

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true); setError("");
    try {
      const [products, catalogLookups] = await Promise.all([
        listCatalogProductsRequest(filters, accessToken, tenantId),
        catalogLookupsRequest(accessToken, tenantId)
      ]);
      setResult(products); setLookups(catalogLookups);
    } catch (requestError) { setError(requestError.message || "The catalog could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, tenantId]);

  useEffect(() => { load(); }, [load]);
  const summary = useMemo(() => result?.summary || { total: 0, published: 0, draft: 0, pending: 0 }, [result]);
  const products = result?.items || [];

  return <AppShell area="admin" currentPath="/admin/catalog/products" eyebrow="Merchandising"
    title="Product catalog" description="Variant-level catalog, pricing, and retail readiness."
    action={<div className="page-actions"><Link className="button button-secondary" href="/admin/catalog/masters">Manage masters</Link>{canCreate ? <button className="button button-primary" disabled={!lookups || !catalogConfigured} onClick={() => setDialogOpen(true)} type="button"><Plus size={16} aria-hidden="true" />New product</button> : null}</div>}>
    <CatalogTabs currentPath="/admin/catalog/products" />
    {createdNotice?.tenantId === tenantId ? <section className="setup-saved" role="status"><div><h2>{createdNotice.name} was saved as a draft</h2><p>{createdNotice.imagesPending ? `${createdNotice.imagesPending} image(s) still need uploading. ` : ""}Next: {createdNotice.kind === "BUNDLE" ? "assign bundle components and verify their stock" : "receive stock for the exact variant and warehouse"}. Approval and publication remain separate.</p>
      {canUser(user, "admin", "catalog.product.update", tenantId) ? <><Link href="/admin/catalog/media">Manage images</Link>{createdNotice.kind === "BUNDLE" ? <Link href="/admin/catalog/bundles">Assign bundle components</Link> : null}</> : null}
      {createdNotice.kind !== "BUNDLE" && canUser(user, "admin", "inventory.stock.manage", tenantId) ? <Link href="/admin/inventory">Receive stock in Inventory</Link> : null}
      </div><button className="button button-secondary" onClick={() => setCreatedNotice(null)} type="button">Dismiss</button></section> : null}
    <section className="tenant-summary catalog-summary" aria-label="Catalog summary">
      {[["All products", summary.total, "ALL"], ["Published", summary.published, "PUBLISHED"], ["Drafts", summary.draft, "DRAFT"], ["Awaiting approval", summary.pending, "PENDING"]].map(([label, value, status]) => <button aria-pressed={filters.status === status} className="tenant-summary-item" data-selected={(filters.status === status) || undefined} key={status} onClick={() => setFilters((current) => ({ ...current, status, page: 1 }))} type="button"><span>{label}</span><strong>{value}</strong></button>)}
    </section>
    <section className="tenant-directory catalog-directory" aria-labelledby="catalog-directory-title">
      <div className="section-heading tenant-directory-heading"><div><p className="eyebrow">Master catalog</p><h2 id="catalog-directory-title">Products, variants and prices</h2></div><form className="directory-filters catalog-filters" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 })); }} role="search"><label className="compact-search"><span className="sr-only">Search products</span><Search size={16} aria-hidden="true" /><input placeholder="Name, code or SKU" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label>{enabledProductTypes.length > 1 ? <select aria-label="Product type" value={filters.vertical} onChange={(event) => setFilters((current) => ({ ...current, vertical: event.target.value, page: 1 }))}><option value="ALL">All product types</option>{enabledProductTypes.map((item) => <option key={item.vertical} value={item.vertical}>{verticalMeta[item.vertical]?.label || item.name}</option>)}</select> : enabledProductTypes.length === 1 ? <span className="catalog-fixed-filter"><Tags aria-hidden="true" size={15} />{verticalMeta[enabledProductTypes[0].vertical]?.label || enabledProductTypes[0].name}</span> : null}<button className="button button-secondary" type="submit">Search</button></form></div>
      {!loading && lookups && !catalogConfigured ? <div className="inline-state inline-state-error" role="alert"><span>No product types are configured for this tenant. Ask a platform administrator to update the tenant catalog model.</span></div> : null}
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
      {loading ? <GlobalLoader inline label="Loading product catalog" /> : products.length === 0
        ? <div className="empty-workspace"><Tags size={28} aria-hidden="true" /><h3>No products in this view</h3><p>{catalogConfigured ? "Create the first draft or adjust the current filters." : "Configure at least one tenant product type before creating products."}</p>{canCreate && catalogConfigured ? <button className="button button-primary" onClick={() => setDialogOpen(true)} type="button"><Plus aria-hidden="true" size={16} />Create product</button> : null}</div>
        : <><div className="table-wrap"><table className="tenant-table catalog-table catalog-lifecycle-table"><thead><tr><th>Product</th><th>Vertical</th><th>Variants</th><th>Price</th><th>Available</th><th>Status</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <ProductRow canApprove={canApprove} canUpdate={canUpdate} key={product.id} onEdit={setEditingProduct} onLifecycle={(item, action) => setLifecycle({ product: item, action })} onPrices={setPricingProduct} product={product} />)}</tbody></table></div><TablePagination itemLabel="products" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></>}
    </section>
    {dialogOpen && lookups ? <ProductDialog key={tenantId} lookups={lookups} onClose={() => setDialogOpen(false)} onCreated={(notice) => { setCreatedNotice({ ...notice, tenantId }); setDialogOpen(false); load(); }} /> : null}
    {editingProduct && lookups ? <EditProductDialog key={`${tenantId}:${editingProduct.id}`} lookups={lookups} product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={() => { setEditingProduct(null); load(); }} /> : null}
    {pricingProduct ? <PriceDialog key={`${tenantId}:${pricingProduct.id}`} product={pricingProduct} onClose={() => setPricingProduct(null)} onSaved={() => { setPricingProduct(null); load(); }} /> : null}
    {lifecycle ? <ProductLifecycleDialog action={lifecycle.action} product={lifecycle.product} onClose={() => setLifecycle(null)} onDone={() => { setLifecycle(null); load(); }} /> : null}
  </AppShell>;
}

