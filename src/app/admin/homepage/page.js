"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowRight, ImagePlus, Plus, Save, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { homepageHeroRequest, homepageHeroProductsRequest, listStoresRequest,
  saveHomepageHeroRequest, publishHomepageHeroRequest, uploadHomepageHeroImageRequest } from "@/lib/api-client";
import styles from "./page.module.css";
import { SectionsEditor } from "./sections-editor";

function SlideEditor({ slide, storeId, accessToken, tenantId, onChange, disabled, onUploading }) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [productPreview, setProductPreview] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await homepageHeroProductsRequest(storeId, search, accessToken, tenantId, slide.productSlug);
        if (!cancelled) { setProducts(result.items); setProductPreview(result.selectedProduct || null); setError(""); }
      } catch (failure) { if (!cancelled) setError(failure.message); }
      finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [storeId, search, accessToken, tenantId, slide.productSlug]);
  const linked = products.find((product) => product.slug === slide.productSlug)
    || (productPreview?.slug === slide.productSlug ? productPreview : null);
  const previewImage = slide.imageUrl || linked?.image;
  const set = (key, value) => onChange({ ...slide, [key]: value });
  async function upload(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError("Choose a JPEG, PNG, WebP or AVIF image up to 8 MB."); return;
    }
    setUploading(true); onUploading(true); setError("");
    try {
      const asset = await uploadHomepageHeroImageRequest(storeId, file, accessToken, tenantId);
      onChange({ ...slide, imageUrl: asset.url });
    } catch (failure) { setError(failure.message); }
    finally { setUploading(false); onUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  return <section className={styles.editor}>
    <div className={styles.sectionTitle}><div><p className="eyebrow">Slide content</p><h2>{slide.title || linked?.name || "New hero slide"}</h2></div>
      <label className={styles.check}><input type="checkbox" checked={slide.enabled} disabled={disabled || uploading} onChange={(event) => set("enabled", event.target.checked)} />Enabled</label>
    </div>
    {error && <p className="inline-state inline-state-error" role="alert">{error}</p>}
    <fieldset className={styles.fields} disabled={disabled || uploading}>
      <label className="form-field"><span>Find a product</span><input value={search} maxLength={190} placeholder="Search name, code or SKU" onChange={(event) => setSearch(event.target.value)} /><small>Search the complete published catalog for this store, not just the homepage products.</small></label>
      <label className="form-field"><span>Linked product</span><select aria-label="Linked product" value={slide.productSlug} onChange={(event) => {
        const product = products.find((item) => item.slug === event.target.value);
        setProductPreview(product || null);
        onChange({ ...slide, productSlug: event.target.value, href: product ? `/p/${product.slug}` : "/" });
      }}>
        <option value="">No product — custom campaign</option>
        {slide.productSlug && !products.some((product) => product.slug === slide.productSlug) && <option value={slide.productSlug}>{slide.productSlug} (selected)</option>}
        {products.map((product) => <option key={product.id} value={product.slug}>{product.name}</option>)}
      </select><small>{searching ? "Searching products…" : "Product slides use current catalog prices and availability. Blank headline/image uses the product."}</small></label>
      <div className={styles.twoColumns}>
        <label className="form-field"><span>Eyebrow</span><input value={slide.eyebrow} maxLength={80} onChange={(event) => set("eyebrow", event.target.value)} placeholder="NEW COLLECTION" /></label>
        <label className="form-field"><span>Slide palette</span><select value={slide.tone} onChange={(event) => set("tone", event.target.value)}><option value="sage">Sage</option><option value="rose">Rose</option><option value="sand">Sand</option></select></label>
      </div>
      <label className="form-field"><span>Headline{!slide.productSlug && " *"}</span><input value={slide.title} maxLength={120} onChange={(event) => set("title", event.target.value)} placeholder={linked?.name || "Your campaign headline"} /></label>
      <label className="form-field"><span>Description</span><textarea rows={3} value={slide.description} maxLength={300} onChange={(event) => set("description", event.target.value)} placeholder="A short introduction to the collection" /></label>
      <div className={styles.upload}>
        <ImagePlus size={24} aria-hidden="true" /><div><strong>Campaign image</strong><p>Recommended: 1400 × 1200 px. Keep important details near the centre.</p><small>JPEG, PNG, WebP or AVIF · Maximum 8 MB</small></div>
        <label className={`button button-secondary ${styles.uploadButton}`}>
          {uploading ? "Uploading…" : slide.imageUrl ? "Replace image" : "Upload image"}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => upload(event.target.files?.[0])} aria-label="Upload hero image" />
        </label>
        {slide.imageUrl && <button className="button button-danger" type="button" onClick={() => set("imageUrl", "")}>Remove custom image</button>}
      </div>
      <label className="form-field"><span>Image description{slide.imageUrl && " *"}</span><input value={slide.altText} maxLength={180} onChange={(event) => set("altText", event.target.value)} placeholder="Describe the visible product or campaign" /></label>
      <div className={styles.twoColumns}>
        <label className="form-field"><span>Button label *</span><input value={slide.ctaLabel} maxLength={40} onChange={(event) => set("ctaLabel", event.target.value)} /></label>
        <label className="form-field"><span>Button destination *</span><input value={slide.productSlug ? `/p/${slide.productSlug}` : slide.href} disabled={Boolean(slide.productSlug)} onChange={(event) => set("href", event.target.value)} placeholder="/ or /c/category-slug" /><small>{slide.productSlug ? "Automatically linked to the selected product." : "Use / for homepage or /c/category-slug for a category."}</small></label>
      </div>
      <label className={styles.check}><input type="checkbox" checked={slide.showPrice} disabled={!slide.productSlug} onChange={(event) => set("showPrice", event.target.checked)} />Show live product price and discount</label>
    </fieldset>
    <div className={styles.previewTitle}><strong>Slide preview</strong><small>Illustrative preview · not published</small></div>
    <div className={`${styles.preview} ${styles[slide.tone]}`}>
      <div><small>{slide.eyebrow || "YOUR COLLECTION"}</small><h3>{slide.title || linked?.name || "Your headline appears here"}</h3><p>{slide.description || linked?.description || "Add a short campaign description."}</p>
        {slide.productSlug && slide.showPrice && <strong>{linked ? `₹${Number(linked.price).toLocaleString("en-IN")}` : "Live catalog price"}</strong>}
        <span className={styles.previewCta}>{slide.ctaLabel || "Explore"}<ArrowRight size={16} aria-hidden="true" /></span></div>
      {previewImage ? <img src={previewImage} alt={slide.altText || linked?.name || "Hero preview"} /> : <div className={styles.imagePlaceholder}><ImagePlus size={40} /><span>Upload an image or select a product</span></div>}
    </div>
  </section>;
}

function HeroWorkspace({ accessToken, tenantId, canRead, canManage }) {
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const busy = saving || uploadBusy;
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [storeSearch, setStoreSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const errorRef = useRef(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const dirty = Boolean(record && JSON.stringify(draft) !== JSON.stringify(record.draft));
  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    listStoresRequest({ search: storeSearch, status: "ALL", page: 1, pageSize: 50 }, accessToken, tenantId)
      .then((result) => { if (!cancelled) { setStores(result.items); setStoreId((current) => current || result.items[0]?.id || ""); setLoading(false); } })
      .catch((failure) => { if (!cancelled) { setError(failure.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [accessToken, tenantId, canRead, storeSearch, attempt]);
  useEffect(() => {
    if (!storeId || !canRead) return;
    let cancelled = false;
    setLoading(true); setRecord(null); setDraft(null); setError(""); setMessage("");
    homepageHeroRequest(storeId, accessToken, tenantId).then((result) => {
      if (!cancelled) { setRecord(result); setDraft(result.draft); setSelectedId(result.draft.slides[0]?.id || ""); }
    }).catch((failure) => { if (!cancelled) setError(failure.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeId, accessToken, tenantId, canRead, attempt]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(publish = false) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = publish
        ? await publishHomepageHeroRequest(storeId, record.revision, accessToken, tenantId)
        : await saveHomepageHeroRequest(storeId, { revision: record.revision, document: draft }, accessToken, tenantId);
      setRecord(result); setDraft(result.draft);
      setMessage(publish ? "Hero published. Reload the storefront to see your changes." : "Draft saved. The live homepage is unchanged.");
    } catch (failure) { setError(failure.details?.length ? failure.details.map((item) => item.message).join(" ") : failure.message); }
    finally { setBusy(false); }
  }
  function changeDraft(next) { setDraft(next); setMessage(""); }
  function addSlide() {
    const slide = { id: crypto.randomUUID(), enabled: true, eyebrow: "", title: "", description: "",
      imageUrl: "", altText: "", productSlug: "", href: "/", ctaLabel: "Explore collection", tone: "sage", showPrice: true };
    changeDraft({ ...draft, slides: [...draft.slides, slide] }); setSelectedId(slide.id);
  }
  function move(index, direction) {
    const slides = [...draft.slides];
    [slides[index], slides[index + direction]] = [slides[index + direction], slides[index]];
    changeDraft({ ...draft, slides });
  }
  function remove(id) {
    if (!window.confirm("Remove this slide from the draft? The live hero stays unchanged until you publish.")) return;
    const slides = draft.slides.filter((slide) => slide.id !== id);
    changeDraft({ ...draft, slides });
    if (selectedId === id) setSelectedId(slides[0]?.id || "");
  }
  if (!canRead) return <p role="alert">You do not have permission to view store settings.</p>;
  const selected = draft?.slides.find((slide) => slide.id === selectedId);
  return <div className={styles.workspace}>
    <section className={styles.toolbar}>
      <label className="form-field"><span>Store</span><select aria-label="Store" value={storeId} disabled={busy} onChange={(event) => {
        if (!dirty || window.confirm("Discard your unsaved hero changes and switch stores?")) setStoreId(event.target.value);
      }}>
        <option value="" disabled>Select a store</option>
        {storeId && !stores.some((store) => store.id === storeId) && <option value={storeId}>Selected store</option>}
        {stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}
      </select></label>
      <form className={styles.storeSearch} onSubmit={(event) => { event.preventDefault(); setStoreSearch(searchDraft); }}><label className="form-field"><span>Find store</span><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} maxLength={120} placeholder="Store name or code" /></label><button className="button button-secondary">Search</button></form>
      <div className={styles.status}><strong>{record?.published ? "Published hero" : "Automatic product hero"}</strong><small>{dirty ? "Unsaved draft changes" : record?.revision ? "Draft saved" : "Create your first draft"}</small></div>
    </section>
    {error && <div className="inline-state inline-state-error" role="alert" tabIndex={-1} ref={errorRef}><span>{error}</span><button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes and reload?")) setAttempt((value) => value + 1); }}>Reload</button></div>}
    {message && <p className={styles.message} role="status">{message}</p>}
    {loading ? <div className={styles.loading} role="status">Loading hero editor…</div> : draft ? <>
      <section className={styles.settings}>
        <label className={styles.check}><input disabled={!canManage || busy} type="checkbox" checked={draft.enabled} onChange={(event) => changeDraft({ ...draft, enabled: event.target.checked })} />Show hero on homepage</label>
        <label className={styles.check}><input disabled={!canManage || busy} type="checkbox" checked={draft.autoplay} onChange={(event) => changeDraft({ ...draft, autoplay: event.target.checked })} />Auto-rotate slides</label>
        <label className={styles.interval}>Slide duration<select aria-label="Slide duration" disabled={!canManage || busy || !draft.autoplay} value={draft.intervalSeconds} onChange={(event) => changeDraft({ ...draft, intervalSeconds: Number(event.target.value) })}>{Array.from({ length: 16 }, (_, index) => index + 5).map((value) => <option value={value} key={value}>{value} seconds</option>)}</select></label>
      </section>
      <div className={styles.layout}>
        <aside className={styles.slides} aria-label="Hero slides">
          <div className={styles.sectionTitle}><h2>Slides <small>{draft.slides.length}/10</small></h2><button className="button button-secondary" disabled={!canManage || busy || draft.slides.length >= 10} onClick={addSlide} type="button"><Plus size={16} aria-hidden="true" />Add</button></div>
          <p>Slides appear in this order. Disabled slides stay private.</p>
          {draft.slides.map((slide, index) => <div className={styles.slide} data-selected={slide.id === selectedId} key={slide.id}>
            <button className={styles.slideSelect} disabled={busy} onClick={() => setSelectedId(slide.id)} aria-pressed={slide.id === selectedId} type="button"><span>{String(index + 1).padStart(2, "0")}</span><span><strong>{slide.title || slide.productSlug || "Untitled slide"}</strong><small>{slide.enabled ? "Enabled" : "Disabled"}</small></span></button>
            <div className={styles.slideActions}>
              <button type="button" aria-label={`Move slide ${index + 1} up`} disabled={!canManage || busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
              <button type="button" aria-label={`Move slide ${index + 1} down`} disabled={!canManage || busy || index === draft.slides.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
              <button className={styles.delete} type="button" aria-label={`Remove slide ${index + 1}`} disabled={!canManage || busy} onClick={() => remove(slide.id)}><Trash2 size={16} /></button>
            </div>
          </div>)}
          {!draft.slides.length && <p>Add a product-led slide or upload a custom campaign image.</p>}
        </aside>
        {selected ? <SlideEditor key={`${storeId}-${selected.id}`} slide={selected} storeId={storeId} accessToken={accessToken} tenantId={tenantId} disabled={!canManage || busy} onUploading={setUploadBusy}
          onChange={(slide) => changeDraft({ ...draft, slides: draft.slides.map((item) => item.id === slide.id ? slide : item) })} />
          : <section className={styles.empty}><ImagePlus size={42} aria-hidden="true" /><h2>Your storefront’s first impression</h2><p>Select a product or create a campaign. Preview it here, save your draft, then publish when you are ready.</p><button className="button button-primary" type="button" disabled={!canManage || busy} onClick={addSlide}>Create first slide</button></section>}
      </div>
      <footer className={styles.savebar}><div><strong>{dirty ? "You have unsaved changes" : "Ready for review"}</strong><small>Saving a draft does not change the storefront. Publish applies the saved draft.</small></div><div className={styles.saveActions}>
        <button className="button button-secondary" disabled={!canManage || busy || (!dirty && record.revision > 0)} onClick={() => save()} type="button"><Save size={17} aria-hidden="true" />{busy ? "Please wait…" : "Save draft"}</button>
        <button className="button button-primary" disabled={!canManage || busy || dirty || record.revision === 0} onClick={() => save(true)} type="button"><Send size={17} aria-hidden="true" />Publish hero</button>
      </div></footer>
    </> : !error && <p>No stores found. Create a store first or change your search.</p>}
  </div>;
}

export default function HomepagePage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [tab, setTab] = useState("hero");
  const [sectionsVisited, setSectionsVisited] = useState(false);
  function selectTab(key) { setTab(key); if (key === "sections") setSectionsVisited(true); }
  return <AppShell area="admin" currentPath="/admin/homepage" eyebrow="Storefront content" title="Homepage management" description="Curate your storefront. Build, preview and publish store-specific content.">
    <div role="tablist" aria-label="Homepage editor" className={styles.tabs}>{[["hero", "Hero slides"], ["sections", "Homepage sections"]].map(([key, label]) => <button type="button" role="tab" id={`homepage-tab-${key}`} key={key} tabIndex={tab === key ? 0 : -1} aria-selected={tab === key} aria-controls={`homepage-panel-${key}`} onClick={() => selectTab(key)} onKeyDown={(event) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault(); const next = event.key === "Home" ? "hero" : event.key === "End" ? "sections" : key === "hero" ? "sections" : "hero";
        selectTab(next); document.getElementById(`homepage-tab-${next}`)?.focus();
      }
    }}>{label}</button>)}</div>
    {accessToken && tenantId && <><div role="tabpanel" id="homepage-panel-hero" aria-labelledby="homepage-tab-hero" hidden={tab !== "hero"}><HeroWorkspace key={tenantId} accessToken={accessToken} tenantId={tenantId}
      canRead={canUser(user, "admin", "settings.store.read", tenantId)} canManage={canUser(user, "admin", "settings.store.manage", tenantId)} /></div>
      <div role="tabpanel" id="homepage-panel-sections" aria-labelledby="homepage-tab-sections" hidden={tab !== "sections"}>{sectionsVisited && <SectionsEditor key={tenantId} accessToken={accessToken} tenantId={tenantId}
        canRead={canUser(user, "admin", "settings.store.read", tenantId)} canManage={canUser(user, "admin", "settings.store.manage", tenantId)} />}</div></>}
  </AppShell>;
}
