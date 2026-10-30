"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Save, Send, Trash2 } from "lucide-react";
import { listStoresRequest, homepageSectionsRequest, saveHomepageSectionsRequest,
  publishHomepageSectionsRequest, previewHomepageSectionsRequest, homepageHeroProductsRequest,
  uploadHomepageHeroImageRequest } from "@/lib/api-client";
import styles from "./page.module.css";

const names = { DEALS: "Blockbuster deals", BANNER: "Campaign banner", DISCOVER: "More to discover", FRESH: "Fresh arrivals" };
const rules = { DISCOUNT: "Highest percentage discount", REVIEWS: "Most published reviews", NEWEST: "Newest products", MANUAL: "Manually selected products" };
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);

export function SectionsEditor({ accessToken, tenantId, canRead, canManage }) {
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState(null);
  const [selectedKey, setSelectedKey] = useState("DEALS");
  const [products, setProducts] = useState([]);
  const [productNames, setProductNames] = useState({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [reload, setReload] = useState(0);
  const errorRef = useRef(null);
  const fileRef = useRef(null);
  const dirty = Boolean(record && JSON.stringify(record.draft) !== JSON.stringify(draft));
  const selectedIndex = draft?.sections.findIndex((section) => section.key === selectedKey) ?? -1;
  const selected = draft?.sections[selectedIndex];
  const locked = !canManage || Boolean(busy);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    listStoresRequest({ search: storeQuery, status: "ALL", page: 1, pageSize: 50 }, accessToken, tenantId)
      .then((result) => { if (!cancelled) { setStores(result.items); setStoreId((current) => current || result.items[0]?.id || ""); } })
      .catch((failure) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [accessToken, tenantId, canRead, storeQuery, reload]);
  useEffect(() => {
    if (!storeId || !canRead) return;
    let cancelled = false;
    setLoading(true); setRecord(null); setDraft(null); setError(""); setMessage(""); setPreview(null); setFieldErrors({});
    homepageSectionsRequest(storeId, accessToken, tenantId).then((result) => {
      if (!cancelled) { setRecord(result); setDraft(result.draft); }
    }).catch((failure) => { if (!cancelled) setError(failure.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeId, accessToken, tenantId, canRead, reload]);
  useEffect(() => {
    if (!storeId || !canRead) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await homepageHeroProductsRequest(storeId, search, accessToken, tenantId);
        if (!cancelled) {
          setProducts(result.items);
          setProductNames((current) => ({ ...current, ...Object.fromEntries(result.items.map((product) => [product.slug, product.name])) }));
        }
      } catch (failure) { if (!cancelled) setError(failure.message); }
      finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [storeId, search, accessToken, tenantId, canRead]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(next) { setDraft(next); setPreview(null); setMessage(""); setFieldErrors({}); setError(""); }
  function set(name, value) { change({ sections: draft.sections.map((section) => section.key === selectedKey ? { ...section, [name]: value } : section) }); }
  function reorder(items, index, direction) {
    const next = [...items]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next;
  }
  function showError(failure) {
    setError(failure.message || "Unable to save homepage sections.");
    setFieldErrors(Object.fromEntries((failure.details || []).map((detail) => [detail.field.replace(/^document\./, ""), detail.message])));
  }
  async function action(mode) {
    setBusy(mode); setError(""); setFieldErrors({}); setMessage("");
    try {
      if (mode === "preview") { setPreview(await previewHomepageSectionsRequest(storeId, draft, accessToken, tenantId)); return; }
      const result = mode === "publish"
        ? await publishHomepageSectionsRequest(storeId, record.revision, accessToken, tenantId)
        : await saveHomepageSectionsRequest(storeId, { revision: record.revision, document: draft }, accessToken, tenantId);
      setRecord(result); setDraft(result.draft);
      setMessage(mode === "publish" ? "Homepage sections published. Reload the storefront to see your changes." : "Sections draft saved. Live content is unchanged.");
    } catch (failure) { showError(failure); }
    finally { setBusy(""); }
  }
  async function upload(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError("Choose a JPEG, PNG, WebP or AVIF image up to 8 MB."); return;
    }
    setBusy("upload"); setError("");
    try { const result = await uploadHomepageHeroImageRequest(storeId, file, accessToken, tenantId); set("imageUrl", result.url); }
    catch (failure) { showError(failure); }
    finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  }
  function field(name, label, maxLength, multiline = false) {
    const key = `sections.${selectedIndex}.${name}`;
    const id = `section-${selectedKey}-${name}`;
    const props = { id, value: selected[name], maxLength, onChange: (event) => set(name, event.target.value),
      "aria-invalid": Boolean(fieldErrors[key]), "aria-describedby": fieldErrors[key] ? `${id}-error` : undefined };
    return <label className="form-field" htmlFor={id}><span>{label}</span>{multiline ? <textarea {...props} rows={3} /> : <input {...props} />}
      {fieldErrors[key] && <small id={`${id}-error`} className={styles.fieldError}>{fieldErrors[key]}</small>}</label>;
  }
  if (!canRead) return <p role="alert">You do not have access to store settings.</p>;
  return <div className={styles.workspace}>
    <section className={styles.toolbar}>
      <label className="form-field"><span>Store</span><select aria-label="Sections store" value={storeId} disabled={Boolean(busy)} onChange={(event) => {
        if (!dirty || window.confirm("Discard unsaved section changes and switch stores?")) setStoreId(event.target.value);
      }}><option value="" disabled>Select store</option>{storeId && !stores.some((store) => store.id === storeId) && <option value={storeId}>Selected store</option>}{stores.map((store) => <option value={store.id} key={store.id}>{store.name} · {store.code}</option>)}</select></label>
      <form className={styles.storeSearch} onSubmit={(event) => { event.preventDefault(); setStoreQuery(storeSearch); }}><label className="form-field"><span>Find store</span><input maxLength={120} value={storeSearch} onChange={(event) => setStoreSearch(event.target.value)} placeholder="Store name or code" /></label><button className="button button-secondary">Search</button></form>
      <div className={styles.status}><strong>{record?.published ? "Managed homepage sections" : "Original homepage content"}</strong><small>{dirty ? "Unsaved changes" : record?.revision ? "Draft saved" : "Not configured yet"}</small></div>
    </section>
    {error && <div ref={errorRef} role="alert" tabIndex={-1} className="inline-state inline-state-error"><div><strong>{error}</strong>{Object.entries(fieldErrors).map(([path, text]) => {
      const match = path.match(/^sections\.(\d+)\.(\w+)$/); const key = match && draft?.sections[Number(match[1])]?.key;
      return <p key={path}>{key ? <a href={`#section-${key}-${match[2]}`} onClick={() => setSelectedKey(key)}>{names[key]}: {text}</a> : text}</p>;
    })}</div><button type="button" disabled={Boolean(busy)} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes and reload?")) setReload((value) => value + 1); }}>Reload</button></div>}
    {message && <p className={styles.message} role="status">{message}</p>}
    {loading ? <div role="status" className={styles.loading}>Loading homepage sections…</div> : draft && selected ? <>
      <p>Hero slides are published separately. The category strip and service promises are unchanged. Configure the four sections below, then save and publish.</p>
      <div className={styles.layout}>
        <aside className={styles.slides} aria-label="Homepage section order"><div className={styles.sectionTitle}><h2>Section order</h2></div><p>Move sections up or down. Disabled sections stay hidden after publication.</p>
          {draft.sections.map((section, index) => <div key={section.key} className={styles.slide} data-selected={section.key === selectedKey}>
            <button className={styles.slideSelect} type="button" aria-pressed={section.key === selectedKey} disabled={Boolean(busy)} onClick={() => setSelectedKey(section.key)}><span>{index + 1}</span><span><strong>{names[section.key]}</strong><small>{section.enabled ? "Enabled" : "Disabled"}</small></span></button>
            <div className={styles.slideActions}><button type="button" disabled={locked || index === 0} aria-label={`Move ${names[section.key]} up`} onClick={() => change({ sections: reorder(draft.sections, index, -1) })}><ArrowUp size={16} /></button><button type="button" disabled={locked || index === 3} aria-label={`Move ${names[section.key]} down`} onClick={() => change({ sections: reorder(draft.sections, index, 1) })}><ArrowDown size={16} /></button></div>
          </div>)}
        </aside>
        <section className={styles.editor} aria-label="Section editor"><div className={styles.sectionTitle}><div><p className="eyebrow">Homepage content</p><h2>{names[selectedKey]}</h2></div><label className={styles.check}><input type="checkbox" checked={selected.enabled} disabled={locked} onChange={(event) => set("enabled", event.target.checked)} />Enabled</label></div>
          <fieldset className={styles.fields} disabled={locked}>
            {field("title", "Section title", 120)}{field("subtitle", selectedKey === "BANNER" ? "Banner description" : "Section subtitle", 240, selectedKey === "BANNER")}
            {selectedKey === "BANNER" ? <>
              {field("eyebrow", "Eyebrow", 80)}
              <div className={styles.upload} id="section-BANNER-imageUrl"><ImagePlus aria-hidden="true" /><div><strong>Campaign image</strong><p>Upload a wide image. JPEG, PNG, WebP or AVIF, up to 8 MB.</p></div><label className={`button button-secondary ${styles.uploadButton}`}>{busy === "upload" ? "Uploading…" : selected.imageUrl ? "Replace banner image" : "Upload banner image"}<input ref={fileRef} type="file" aria-label="Upload banner image" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => upload(event.target.files?.[0])} /></label>{selected.imageUrl && <button type="button" className="button button-danger" onClick={() => set("imageUrl", "")}>Remove image</button>}</div>
              {fieldErrors[`sections.${selectedIndex}.imageUrl`] && <p className={styles.fieldError}>{fieldErrors[`sections.${selectedIndex}.imageUrl`]}</p>}
              {selected.imageUrl && <img className={styles.bannerThumbnail} src={selected.imageUrl} alt={selected.altText || "Uploaded banner preview"} />}
              {field("altText", "Image description", 180)}{field("badgeText", "Optional badge text", 60)}<small>Only enter claims supported by your actual offers. Leave blank to hide the badge.</small>
              <div className={styles.twoColumns}>{field("ctaLabel", "Button label", 40)}{field("href", "Button destination", 325)}</div>
            </> : <>
              <div className={styles.twoColumns}><label className="form-field"><span>Product selection</span><select aria-label="Product selection" value={selected.rule} onChange={(event) => set("rule", event.target.value)}>{Object.entries(rules).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="form-field"><span>Maximum products</span><select value={selected.limit} onChange={(event) => set("limit", Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
              <small>{selected.rule === "NEWEST" ? "Sorted by product creation date, not the NEW tag." : selected.rule === "REVIEWS" ? "Sorted by published review count, not average rating." : selected.rule === "DISCOUNT" ? "Only discounted products, ranked by percentage discount." : "Pick products and arrange their order below."} Automatic rules use the full store catalog.</small>
              {selected.rule === "MANUAL" && <div id={`section-${selectedKey}-productSlugs`}>
                <label className="form-field"><span>Find products</span><input maxLength={190} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code or SKU" /></label>
                <label className="form-field"><span>Add a product</span><select aria-label="Add a product" value="" disabled={selected.productSlugs.length >= 12 || searching || locked} onChange={(event) => { if (event.target.value) set("productSlugs", [...selected.productSlugs, event.target.value]); }}><option value="">{searching ? "Searching…" : "Select a published product"}</option>{products.filter((product) => !selected.productSlugs.includes(product.slug)).map((product) => <option key={product.id} value={product.slug}>{product.name}</option>)}</select></label>
                <ol className={styles.selectedProducts}>{selected.productSlugs.map((slug, index) => <li key={slug}><span>{productNames[slug] || slug}</span><div className={styles.slideActions}><button type="button" disabled={locked || index === 0} aria-label={`Move product ${index + 1} up`} onClick={() => set("productSlugs", reorder(selected.productSlugs, index, -1))}><ArrowUp size={16} /></button><button type="button" disabled={locked || index === selected.productSlugs.length - 1} aria-label={`Move product ${index + 1} down`} onClick={() => set("productSlugs", reorder(selected.productSlugs, index, 1))}><ArrowDown size={16} /></button><button type="button" className={styles.delete} aria-label={`Remove product ${index + 1}`} onClick={() => set("productSlugs", selected.productSlugs.filter((item) => item !== slug))}><Trash2 size={16} /></button></div></li>)}</ol>
                <small>Up to 12 selections. The first {selected.limit} eligible products will display.</small>{fieldErrors[`sections.${selectedIndex}.productSlugs`] && <p className={styles.fieldError}>{fieldErrors[`sections.${selectedIndex}.productSlugs`]}</p>}
              </div>}
              <div className={styles.twoColumns}>{field("viewAllLabel", "View all label", 40)}{field("viewAllHref", "View all destination (optional)", 325)}</div>
            </>}
            <small>Destinations: / for home, /c/category-slug or /p/product-slug. Leave a shelf destination blank to hide its View all button.</small>
          </fieldset>
        </section>
      </div>
      <footer className={styles.savebar}><div><strong>{dirty ? "Unsaved changes" : "Review your homepage sections"}</strong><small>Save draft first. Publishing replaces only these four sections for this store.</small></div><div className={styles.saveActions}><button type="button" className="button button-secondary" disabled={Boolean(busy)} onClick={() => action("preview")}><Eye size={16} aria-hidden="true" />Preview sections</button><button type="button" className="button button-secondary" disabled={locked || (!dirty && record.revision > 0)} onClick={() => action("save")}><Save size={16} aria-hidden="true" />Save sections draft</button><button type="button" className="button button-primary" disabled={locked || dirty || record.revision === 0} onClick={() => action("publish")}><Send size={16} aria-hidden="true" />Publish sections</button></div></footer>
      {busy && <p role="status">{busy === "upload" ? "Uploading image…" : "Processing homepage sections…"}</p>}
      {preview && <section className={styles.editor} aria-label="Homepage sections preview"><div className={styles.sectionTitle}><h2>Preview · not published</h2></div>{!preview.sections.length && <p>No visible sections. Disabled or empty collections are hidden.</p>}{preview.sections.map((section) => <section key={section.key} className={styles.collectionPreview}><small>{section.subtitle}</small><h3>{section.title}</h3>{section.key === "BANNER" ? <><img className={styles.bannerThumbnail} src={section.imageUrl} alt={section.altText} />{section.badgeText && <p>{section.badgeText}</p>}<strong>{section.ctaLabel}</strong></> : <div className={styles.previewProducts}>{section.items.map((product) => <article key={product.id}>{product.image && <img src={product.image} alt="" />}<strong>{product.name}</strong><span>{money(product.price)}</span></article>)}</div>}</section>)}</section>}
    </> : !loading && !error && <p>Select or create a store to configure its homepage.</p>}
  </div>;
}
