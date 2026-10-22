"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Check, ExternalLink, FileImage, ImagePlus, Images, Pencil,
  RefreshCw, Search, ShieldCheck, Star, Trash2, UploadCloud, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CatalogTabs } from "@/components/catalog-tabs";
import { GlobalLoader } from "@/components/global-loader";
import { Status } from "@/components/dashboard-primitives";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { catalogProductMediaRequest,
  deleteCatalogProductMediaRequest, listCatalogProductsRequest,
  reorderCatalogProductMediaRequest, replaceCatalogProductMediaFileRequest,
  setCatalogProductPrimaryMediaRequest, uploadCatalogProductMediaRequest,
  updateCatalogProductMediaRequest } from "@/lib/api-client";

const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const maxImageBytes = 8 * 1024 * 1024;

function Portal({ children }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

function useModal(onClose, ref, blocked = false) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const listener = (event) => { if (event.key === "Escape" && !blocked) onClose(); };
    window.addEventListener("keydown", listener);
    requestAnimationFrame(() => ref.current?.querySelector("[data-autofocus], input:not([type='file']), select, button")?.focus());
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", listener);
    };
  }, [blocked, onClose, ref]);
}

function scopeValue(item, initialScope) {
  if (item?.colorOptionId || initialScope?.colorOptionId) {
    return `color:${item?.colorOptionId || initialScope.colorOptionId}`;
  }
  if (item?.variantId || initialScope?.variantId) {
    return `variant:${item?.variantId || initialScope.variantId}`;
  }
  return "general";
}

function mediaPayload(form, url) {
  const [type, id] = form.scope.split(":");
  return { ...(url ? { url } : {}), altText: form.altText,
    colorOptionId: type === "color" ? id : null,
    variantId: type === "variant" ? id : null };
}

function readableBytes(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function MediaDialog({ accessToken, initialScope, item, media, onClose, onSaved, productId, tenantId }) {
  const [form, setForm] = useState({ altText: item?.altText || "",
    scope: scopeValue(item, initialScope) });
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(item?.url || "");
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  useModal(onClose, ref, saving);

  useEffect(() => {
    if (!file) { setPreviewUrl(item?.url || ""); return undefined; }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, item]);

  function chooseFile(nextFile) {
    setError("");
    if (!nextFile) return;
    if (!acceptedImageTypes.includes(nextFile.type)) {
      setError("Choose a JPEG, PNG, WebP or AVIF image."); return;
    }
    if (nextFile.size > maxImageBytes) {
      setError("Product images must be 8 MB or smaller."); return;
    }
    setFile(nextFile);
  }

  async function submit(event) {
    event.preventDefault();
    if (!item && !file) { setError("Choose an image file to upload."); return; }
    setSaving(true); setError("");
    try {
      const result = item && file
        ? await replaceCatalogProductMediaFileRequest(productId, item.id, file,
          mediaPayload(form), accessToken, tenantId)
        : item
          ? await updateCatalogProductMediaRequest(productId, item.id,
            mediaPayload(form, item.url), accessToken, tenantId)
          : await uploadCatalogProductMediaRequest(productId, file,
            mediaPayload(form), accessToken, tenantId);
      onSaved(result);
    } catch (requestError) {
      setError(requestError.message || `Image could not be ${item ? "updated" : "added"}.`);
    } finally {
      setSaving(false);
    }
  }

  return <Portal><div className="procurement-dialog-backdrop"><form aria-labelledby="media-dialog-title"
    aria-modal="true" className="procurement-dialog procurement-dialog-compact media-editor-dialog"
    onSubmit={submit} ref={ref} role="dialog">
    <header><div><p className="eyebrow">Product media</p>
      <h2 id="media-dialog-title">{item ? "Edit catalog image" : "Upload product image"}</h2>
      <p>{item ? "Upload a replacement or improve how this image is described and assigned." : "Upload once and share it across every size carrying the selected colour."}</p>
    </div><button aria-label="Close" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={20} /></button></header>
    <div className="procurement-dialog-body">
      {error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}
      <div className="form-grid">
        <div className="form-field catalog-span-2"><span>Product image {!item ? <em>*</em> : null}</span>
          <label className="media-upload-dropzone" data-active={dragging || undefined}
            data-has-preview={Boolean(previewUrl) || undefined} data-autofocus
            aria-label={item ? "Choose a replacement product image" : "Choose a product image"}
            role="button" tabIndex={0}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.currentTarget.querySelector("input")?.click(); }}>
            <input accept={acceptedImageTypes.join(",")} aria-label={item ? "Choose replacement image" : "Choose product image"}
              onChange={(event) => chooseFile(event.target.files[0])} type="file" />
            {previewUrl ? <span className="media-upload-preview" style={{ backgroundImage: `url("${previewUrl.replaceAll('"', '%22')}")` }}
              role="img" aria-label={form.altText || "Selected product image preview"} />
              : <span className="media-upload-icon"><UploadCloud size={26} /></span>}
            <span className="media-upload-copy"><strong>{file ? file.name : item ? "Current catalog image" : "Drop an image here"}</strong>
              <small>{file ? `${readableBytes(file.size)} · Ready to upload` : item
                ? "Choose a file to replace it, or keep the current image" : "JPEG, PNG, WebP or AVIF · up to 8 MB"}</small>
              <span className="button button-secondary">{file ? <RefreshCw size={15} /> : <FileImage size={15} />}
                {file ? "Choose another" : item ? "Choose replacement" : "Browse files"}</span>
            </span>
            {file ? <span className="media-upload-ready"><Check size={15} />Selected</span> : null}
          </label>
          <small>{item ? "A replacement keeps this image's gallery position and primary-image setting." : "For sharp listings, use a square image at least 1200 × 1200 px."}</small>
        </div>
        <label className="form-field catalog-span-2"><span>Alternative text</span>
          <input maxLength={500} placeholder="Describe the product shown" value={form.altText}
            onChange={(event) => setForm((current) => ({ ...current, altText: event.target.value }))} />
          <small>Describe the visible product, colour and angle for screen-reader users.</small>
        </label>
        <label className="form-field catalog-span-2"><span>Image gallery</span>
          <select value={form.scope} onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value }))}>
            <option value="general">General product gallery</option>
            {(media.colors || []).map((color) => <option key={color.id} value={`color:${color.id}`}>
              Colour · {color.name} · all {color.variants.length} size variant{color.variants.length === 1 ? "" : "s"}
            </option>)}
            {item?.variantId ? <option value={`variant:${item.variantId}`}>
              Exact variant · {item.variantName || item.variantSku}
            </option> : null}
          </select>
          <small>Colour galleries automatically serve every size with the selected colour.</small>
        </label>
      </div>
    </div>
    <footer><span><ShieldCheck size={15} />{item ? "Changes apply immediately and are audited." : "Secure upload managed by Commerce OS"}</span>
      <div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button>
        <button className="button button-primary" disabled={saving} type="submit">
          {item ? <Pencil size={16} /> : <UploadCloud size={16} />}{saving ? "Saving…" : item ? "Save image" : "Upload image"}
        </button></div>
    </footer>
  </form></div></Portal>;
}

function DeleteDialog({ item, onClose, onConfirm, saving }) {
  const ref = useRef(null);
  useModal(onClose, ref, saving);
  return <Portal><div className="procurement-dialog-backdrop"><section aria-labelledby="delete-media-title"
    aria-modal="true" className="procurement-dialog procurement-dialog-compact" ref={ref} role="alertdialog">
    <header><div><p className="eyebrow">Remove image</p><h2 id="delete-media-title">Delete this catalog image?</h2>
      <p>The image will be removed from this product gallery immediately.</p></div>
      <button aria-label="Close" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={20} /></button>
    </header>
    <div className="procurement-dialog-body"><div className="media-delete-preview"
      style={{ backgroundImage: `url("${item.url.replaceAll('"', '%22')}")` }} role="img"
      aria-label={item.altText || "Product image"} /></div>
    <footer><span>This action is recorded in the audit trail.</span><div>
      <button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Keep image</button>
      <button className="button button-danger" disabled={saving} onClick={onConfirm} type="button">
        <Trash2 size={16} />{saving ? "Deleting…" : "Delete image"}
      </button></div></footer>
  </section></div></Portal>;
}

function MediaCard({ canManage, index, item, length, onDelete, onEdit, onMove, onPrimary, working }) {
  return <article className="media-card" data-primary={item.role === "PRIMARY" || undefined}>
    <div className="media-card-image" style={{ backgroundImage: `url("${item.url.replaceAll('"', '%22')}")` }}
      role="img" aria-label={item.altText || "Product image"}>
      <a aria-label="Open original image" href={item.url} rel="noreferrer" target="_blank"><ExternalLink size={16} /></a>
      {item.role === "PRIMARY" ? <Status tone="positive"><Star size={12} />Primary</Status> : null}
    </div>
    <div className="media-card-copy"><strong>{item.altText || "Alternative text not set"}</strong>
      <small>{item.colorName || item.variantName || "General product image"}</small></div>
    {canManage ? <div className="media-card-actions">
      <button aria-label="Move image earlier" className="icon-button" disabled={working || index === 0}
        onClick={() => onMove(-1)} type="button"><ArrowUp size={16} /></button>
      <button aria-label="Move image later" className="icon-button" disabled={working || index === length - 1}
        onClick={() => onMove(1)} type="button"><ArrowDown size={16} /></button>
      <button aria-label="Edit or replace image" className="icon-button media-edit-button" disabled={working}
        onClick={onEdit} type="button"><Pencil size={16} /></button>
      {item.role !== "PRIMARY" ? <button aria-label="Set as primary image" className="icon-button media-primary-button"
        disabled={working} onClick={onPrimary} type="button"><Star size={16} /></button> : null}
      <button aria-label="Delete image" className="icon-button media-delete-button" disabled={working}
        onClick={onDelete} type="button"><Trash2 size={16} /></button>
    </div> : null}
  </article>;
}

export default function CatalogMediaPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "catalog.product.update", tenantId);
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [media, setMedia] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const loadProducts = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true); setError("");
    try {
      const result = await listCatalogProductsRequest({ search: "", status: "ALL",
        vertical: "ALL", page: 1, pageSize: 100 }, accessToken, tenantId);
      setProducts(result.items);
      setSelectedId((current) => current || result.items[0]?.id || "");
    } catch (requestError) {
      setError(requestError.message || "Products could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId]);

  const loadMedia = useCallback(async () => {
    if (!selectedId) { setMedia(null); return; }
    setWorking("load"); setError("");
    try {
      setMedia(await catalogProductMediaRequest(selectedId, accessToken, tenantId));
    } catch (requestError) {
      setError(requestError.message || "Product media could not be loaded.");
    } finally {
      setWorking("");
    }
  }, [accessToken, selectedId, tenantId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadMedia(); }, [loadMedia]);

  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.productCode}`
    .toLowerCase().includes(search.toLowerCase())), [products, search]);
  const groups = useMemo(() => {
    if (!media) return [];
    const map = new Map([["general", { key: "general", label: "General gallery",
      hint: "Fallback imagery used across every variant", items: [] }]]);
    for (const color of media.colors || []) {
      map.set(`color:${color.id}`, { key: `color:${color.id}`, colorOptionId: color.id,
        label: color.name, swatchValue: color.swatchValue,
        hint: `Shared by ${color.variants.map((variant) => variant.name).join(", ")}`, items: [] });
    }
    for (const item of media.items) {
      const key = item.colorOptionId ? `color:${item.colorOptionId}`
        : item.variantId ? `variant:${item.variantId}` : "general";
      if (!map.has(key)) map.set(key, { key, variantId: item.variantId,
        label: item.colorName || item.variantName || "Exact variant",
        hint: `${item.variantName || "Variant"} · ${item.variantSku || ""}`, items: [] });
      map.get(key).items.push(item);
    }
    return [...map.values()];
  }, [media]);

  async function primary(item) {
    setWorking(item.id); setError("");
    try { setMedia(await setCatalogProductPrimaryMediaRequest(selectedId, item.id, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message); }
    finally { setWorking(""); }
  }

  async function move(group, item, direction) {
    const index = group.items.findIndex((entry) => entry.id === item.id);
    const next = [...group.items];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setWorking(item.id); setError("");
    try {
      setMedia(await reorderCatalogProductMediaRequest(selectedId, item.id,
        next.map((entry) => entry.id), accessToken, tenantId));
    } catch (requestError) { setError(requestError.message); }
    finally { setWorking(""); }
  }

  async function remove() {
    setWorking(deleting.id); setError("");
    try {
      setMedia(await deleteCatalogProductMediaRequest(selectedId, deleting.id, accessToken, tenantId));
      setDeleting(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setWorking(""); }
  }

  return <AppShell area="admin" currentPath="/admin/catalog/media" eyebrow="Merchandising" title="Product media"
    description="Manage general imagery, shared colour galleries, ordering, primary images and accessible descriptions."
    action={canManage && selectedId ? <button className="button button-primary" disabled={!media}
      onClick={() => setAdding({})} type="button"><ImagePlus size={17} />Add image</button> : null}>
    <CatalogTabs currentPath="/admin/catalog/media" />
    {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span>
      <button onClick={() => setError("")} type="button">Dismiss</button></div> : null}
    <div className="media-workspace">
      <aside className="media-product-rail" aria-label="Products">
        <div><p className="eyebrow">Catalog</p><h2>Choose a product</h2></div>
        <label className="compact-search"><Search aria-hidden="true" size={16} />
          <span className="sr-only">Search products</span><input placeholder="Name or code" value={search}
            onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="media-product-list">{loading ? <GlobalLoader inline label="Loading products" />
          : filtered.map((product) => <button data-active={selectedId === product.id || undefined} key={product.id}
            onClick={() => setSelectedId(product.id)} type="button"><span>{product.primaryImageUrl
              ? <i style={{ backgroundImage: `url("${product.primaryImageUrl.replaceAll('"', '%22')}")` }} />
              : <i><Images size={16} /></i>}</span><span><strong>{product.name}</strong>
              <small>{product.productCode} · {product.variantCount} variant{product.variantCount === 1 ? "" : "s"}</small>
            </span></button>)}</div>
      </aside>
      <section className="media-gallery" aria-labelledby="media-gallery-title">
        {!selectedId ? <div className="empty-workspace"><Images size={28} /><h3>No catalog products</h3>
          <p>Create a product before adding gallery media.</p></div>
          : working === "load" || !media ? <GlobalLoader inline label="Loading media gallery" /> : <>
            <div className="media-gallery-head"><div><p className="eyebrow">{media.product.productCode}</p>
              <h2 id="media-gallery-title">{media.product.name}</h2>
              <p>{media.items.length} image{media.items.length === 1 ? "" : "s"} · {(media.colors || []).length} colour galler{(media.colors || []).length === 1 ? "y" : "ies"}</p>
            </div><Status tone="positive"><ShieldCheck size={13} />Managed uploads</Status></div>
            <div className="media-storage-note"><UploadCloud size={18} /><span>
              <strong>Upload-ready product galleries</strong>
              <small>Files are securely accepted by the API now; production object storage can be connected after hosting is selected.</small>
            </span></div>
            <div className="media-groups">{groups.map((group) => <section className="media-group" key={group.key}>
              <header><div className="media-group-title"><i aria-hidden="true"
                style={group.swatchValue ? { background: group.swatchValue } : undefined} /><div>
                <h3>{group.label}</h3><p>{group.hint}</p></div></div>
                <div className="media-group-actions"><span>{group.items.length} image{group.items.length === 1 ? "" : "s"}</span>
                  {canManage ? <button className="button button-secondary"
                    onClick={() => setAdding({ colorOptionId: group.colorOptionId, variantId: group.variantId })}
                    type="button"><ImagePlus size={15} />Add</button> : null}</div></header>
              {group.items.length ? <div className="media-grid">{group.items.map((item, index) => <MediaCard
                canManage={canManage} index={index} item={item} key={item.id} length={group.items.length}
                onDelete={() => setDeleting(item)} onEdit={() => setEditing(item)}
                onMove={(direction) => move(group, item, direction)} onPrimary={() => primary(item)}
                working={Boolean(working)} />)}</div>
                : <div className="media-group-empty"><Images size={19} /><span>No images assigned to this gallery.</span></div>}
            </section>)}</div>
          </>}
      </section>
    </div>
    {adding && media ? <MediaDialog accessToken={accessToken} initialScope={adding} media={media}
      onClose={() => setAdding(null)} onSaved={(result) => { setMedia(result); setAdding(null); }}
      productId={selectedId} tenantId={tenantId} /> : null}
    {editing && media ? <MediaDialog accessToken={accessToken} item={editing} media={media}
      onClose={() => setEditing(null)} onSaved={(result) => { setMedia(result); setEditing(null); }}
      productId={selectedId} tenantId={tenantId} /> : null}
    {deleting ? <DeleteDialog item={deleting} onClose={() => setDeleting(null)} onConfirm={remove}
      saving={working === deleting.id} /> : null}
  </AppShell>;
}
