'use client';
import {useLocalization as useUiLocalization} from '@/localization/provider';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import {
  storeCollectionsRequest,
  collectionActionRequest,
  listStoresRequest,
  homepageHeroProductsRequest,
  uploadHomepageHeroImageRequest,
} from '@/lib/api-client';
import { TablePagination } from '@/components/table-pagination';
import { ListingExcelExport } from '@/components/listing-excel-export';
import { SectionMerchandisingFields } from './section-merchandising-fields';
import styles from './page.module.css';
import layout from './collections.module.css';
const empty = () => ({
  title: '',
  description: '',
  imageUrl: '',
  altText: '',
  seoTitle: '',
  seoDescription: '',
  rule: 'NEWEST',
  productSlugs: [],
  brandId: null,
  categoryId: null,
  inStockOnly: false,
  startsAt: null,
  endsAt: null,
});
const status = (row) =>
  !row.visible
    ? 'Not live'
    : row.published?.endsAt && Date.parse(row.published.endsAt) <= Date.now()
      ? 'Ended'
      : row.published?.startsAt &&
          Date.parse(row.published.startsAt) > Date.now()
        ? 'Scheduled'
        : 'Published';
const columns = [
  { key: 'slug', label: 'Collection URL slug' },
  { key: 'draft.title', label: 'Draft title' },
  { key: 'published.title', label: 'Published title' },
  { key: 'visible', label: 'Public enabled', type: 'boolean' },
  { key: 'revision', label: 'Revision', type: 'number' },
  { key: 'publishedAt', label: 'Last published', type: 'date' },
];
export function CollectionsEditor({
  accessToken,
  tenantId,
  canRead,
  canManage,
}) {
 const {t: _uiText}=useUiLocalization();

  const [stores, setStores] = useState([]),
    [storeId, setStoreId] = useState(''),
    [term, setTerm] = useState(''),
    [query, setQuery] = useState(''),
    [error, setError] = useState('');
  const dirty = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    if (canRead)
      listStoresRequest(
        { search: query, status: 'ALL', page: 1, pageSize: 50 },
        accessToken,
        tenantId,
      )
        .then((result) => {
          if (!c.signal.aborted) {
            setStores(result.items);
            setStoreId((value) => value || result.items[0]?.id || '');
            setError('');
          }
        })
        .catch((cause) => {
          if (!c.signal.aborted) setError(cause.message);
        });
    return () => c.abort();
  }, [accessToken, tenantId, canRead, query]);
  if (!canRead)
    return <p role="alert">You do not have access to store settings.</p>;
  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <label className="form-field">
          <span>Collections store</span>
          <select
            value={storeId}
            onChange={(event) => {
              if (
                !dirty.current ||
                window.confirm(
                  'Discard unsaved collection changes and switch stores?',
                )
              )
                setStoreId(event.target.value);
            }}
          >
            <option value="" disabled>
              Select store
            </option>
            {storeId && !stores.some((row) => row.id === storeId) && (
              <option value={storeId}>Selected store</option>
            )}
            {stores.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · {row.code}
              </option>
            ))}
          </select>
        </label>
        <form
          className={styles.storeSearch}
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(term);
          }}
        >
          <label className="form-field">
            <span>Find store</span>
            <input
              value={term}
              maxLength={120}
              onChange={(event) => setTerm(event.target.value)}
            />
          </label>
          <button className="button button-secondary">{_uiText("Search")}</button>
        </form>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {storeId && (
        <StoreCollections
          key={`${tenantId}:${storeId}`}
          {...{ accessToken, tenantId, storeId, canManage, dirtyRef: dirty }}
        />
      )}
    </div>
  );
}
function StoreCollections({
  accessToken,
  tenantId,
  storeId,
  canManage,
  dirtyRef,
}) {
 const {t: _uiText}=useUiLocalization();

  const context = { accessToken, tenantId };
  const [filters, setFilters] = useState({ search: '', page: 1, pageSize: 10 }),
    [search, setSearch] = useState(''),
    [data, setData] = useState(null),
    [reload, setReload] = useState(0),
    [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null),
    [draft, setDraft] = useState(null),
    [slug, setSlug] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [preview, setPreview] = useState(null);
  const [productSearch, setProductSearch] = useState(''),
    [products, setProducts] = useState([]),
    [productError, setProductError] = useState('');
  const file = useRef(null),
    heading = useRef(null),
    alive = useRef(true),
    lock = useRef(false);
  const dirty = Boolean(
      draft &&
      (!record || JSON.stringify(draft) !== JSON.stringify(record.draft)),
    ),
    locked = !canManage || Boolean(busy);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      dirtyRef.current = false;
    };
  }, [dirtyRef]);
  useEffect(() => {
    dirtyRef.current = dirty;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    if (dirty) window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, dirtyRef]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    storeCollectionsRequest(storeId, filters, {
      ...context,
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [storeId, accessToken, tenantId, filters, reload]);
  useEffect(() => {
    if (!draft || draft.rule !== 'MANUAL') return;
    let active = true;
    const timer = setTimeout(
      () =>
        homepageHeroProductsRequest(
          storeId,
          productSearch,
          accessToken,
          tenantId,
        )
          .then((result) => {
            if (active) {
              setProducts(result.items);
              setProductError('');
            }
          })
          .catch((cause) => {
            if (active) setProductError(cause.message);
          }),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [storeId, accessToken, tenantId, productSearch, draft?.rule]);
  function open(row) {
    if (
      busy ||
      (dirty && !window.confirm('Discard unsaved collection changes?'))
    )
      return;
    setRecord(row);
    setDraft(row?.draft || empty());
    setSlug(row?.slug || '');
    setPreview(null);
    setError('');
    setNotice('');
    requestAnimationFrame(() => heading.current?.focus());
  }
  function set(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setNotice('');
  }
  async function action(mode) {
    if (lock.current) return;
    if (
      mode === 'withdraw' &&
      !window.confirm(
        'Withdraw this collection? Its page and linked homepage shelves will be hidden immediately.',
      )
    )
      return;
    lock.current = true;
    setBusy(mode);
    setError('');
    try {
      const body =
        mode === 'preview'
          ? draft
          : mode === 'create'
            ? { slug, document: draft }
            : mode === 'save'
              ? { revision: record.revision, document: draft }
              : { revision: record.revision };
      const result = await collectionActionRequest(
        storeId,
        mode === 'preview' ? null : record?.id,
        mode,
        body,
        context,
      );
      if (!alive.current) return;
      if (mode === 'preview') {
        setPreview(result);
        return;
      }
      setRecord(result);
      setDraft(result.draft);
      setSlug(result.slug);
      setReload((value) => value + 1);
      setNotice(
        mode === 'publish'
          ? 'Collection published.'
          : mode === 'withdraw'
            ? 'Collection withdrawn.'
            : 'Draft saved. Live content is unchanged.',
      );
    } catch (cause) {
      if (alive.current) setError(cause.message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy('');
    }
  }
  async function upload(image) {
    if (!image || lock.current) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(
        image.type,
      ) ||
      image.size > 8 * 1024 * 1024
    ) {
      setError('Choose a JPEG, PNG, WebP or AVIF image up to 8 MB.');
      return;
    }
    lock.current = true;
    setBusy('upload');
    setError('');
    try {
      const result = await uploadHomepageHeroImageRequest(
        storeId,
        image,
        accessToken,
        tenantId,
      );
      if (alive.current) set('imageUrl', result.url);
    } catch (cause) {
      if (alive.current) setError(cause.message);
    } finally {
      lock.current = false;
      if (alive.current) {
        setBusy('');
        if (file.current) file.current.value = '';
      }
    }
  }
  function field(key, label, max, multiline = false) {
    return (
      <label className="form-field">
        <span>{label}</span>
        {multiline ? (
          <textarea
            rows={3}
            maxLength={max}
            value={draft[key]}
            onChange={(event) => set(key, event.target.value)}
          />
        ) : (
          <input
            maxLength={max}
            value={draft[key]}
            onChange={(event) => set(key, event.target.value)}
          />
        )}
      </label>
    );
  }
  function move(index, direction) {
    const next = [...draft.productSlugs];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    set('productSlugs', next);
  }
  return (
    <>
      <section className={styles.editor}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>Reusable collections</h2>
            <p>
              Build a dedicated page once, then link it from homepage shelves,
              hero slides and banners.
            </p>
          </div>
          <button
            type="button"
            disabled={locked}
            className="button button-primary"
            onClick={() => open(null)}
          >
            New collection
          </button>
        </div>
        <form
          className={layout.search}
          onSubmit={(event) => {
            event.preventDefault();
            setFilters((value) => ({ ...value, search, page: 1 }));
          }}
        >
          <label className="form-field">
            <span>Find collection</span>
            <input
              type="search"
              maxLength={120}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button className="button button-secondary">
            Search collections
          </button>
        </form>
        {error && (
          <p role="alert" className="form-error">
            {error}{' '}
            <button
              type="button"
              className="button button-secondary"
              disabled={Boolean(busy)}
              onClick={() => setReload((value) => value + 1)}
            >
              Refresh listing
            </button>
          </p>
        )}
        {loading ? (
          <p role="status">Loading collections…</p>
        ) : (
          data && (
            <>
              <ListingExcelExport
                data={data}
                title="store collections"
                columns={columns}
              />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Collection</th>
                      <th>Public status</th>
                      <th>Selection</th>
                      <th>{_uiText("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.draft.title}</strong>
                          <small>/collections/{row.slug}</small>
                        </td>
                        <td>
                          {status(row)}
                          {row.published &&
                            JSON.stringify(row.draft) !==
                              JSON.stringify(row.published) && (
                              <small>Unpublished edits</small>
                            )}
                        </td>
                        <td>
                          {row.draft.rule === 'MANUAL'
                            ? `${row.draft.productSlugs.length} selected products`
                            : row.draft.rule.toLowerCase()}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={Boolean(busy)}
                            onClick={() => open(row)}
                          >
                            {canManage ? 'Edit collection' : 'View collection'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.items.length && (
                <p>No collections yet. Create a draft to begin.</p>
              )}
              <TablePagination
                {...data}
                pageSizeOptions={[10, 20, 50]}
                itemLabel="collections"
                onPageChange={(page) =>
                  setFilters((value) => ({ ...value, page }))
                }
                onPageSizeChange={(pageSize) =>
                  setFilters((value) => ({ ...value, pageSize, page: 1 }))
                }
              />
            </>
          )
        )}
      </section>
      {draft && (
        <section
          className={styles.editor}
          aria-label="Reusable collection editor"
        >
          <div className={styles.sectionTitle}>
            <h2 ref={heading} tabIndex={-1}>
              {record ? 'Edit collection' : 'New collection'}
            </h2>
            <button
              type="button"
              className="button button-secondary"
              disabled={Boolean(busy)}
              onClick={() => {
                if (!dirty || window.confirm('Discard unsaved changes?')) {
                  setDraft(null);
                  setRecord(null);
                  setPreview(null);
                }
              }}
            >
              Close editor
            </button>
          </div>
          <p>
            {record
              ? `Stable path: /collections/${record.slug}`
              : 'Choose a stable, lowercase URL slug. It cannot change after creation.'}
          </p>
          {notice && (
            <p role="status" className={styles.message}>
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <fieldset className={styles.fields} disabled={locked}>
            <label className="form-field">
              <span>URL slug *</span>
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={120}
                readOnly={Boolean(record)}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </label>
            {field('title', 'Collection title *', 120)}
            {field('description', 'Introduction', 1000, true)}
            <div className={styles.upload}>
              <div>
                <strong>Collection banner</strong>
                <p>Optional wide image. Up to 8 MB.</p>
              </div>
              <label
                className={`button button-secondary ${styles.uploadButton}`}
              >
                {draft.imageUrl ? 'Replace banner' : 'Upload banner'}
                <input
                  ref={file}
                  type="file"
                  aria-label="Upload collection banner"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(event) => upload(event.target.files?.[0])}
                />
              </label>
              {draft.imageUrl && (
                <button
                  type="button"
                  className="button button-danger"
                  onClick={() => set('imageUrl', '')}
                >
                  Remove banner
                </button>
              )}
            </div>
            {draft.imageUrl && (
              <img
                className={styles.bannerThumbnail}
                src={draft.imageUrl}
                alt={draft.altText || 'Uploaded banner preview'}
              />
            )}
            {field('altText', 'Banner image description', 180)}
            <SectionMerchandisingFields
              section={{ ...draft, key: 'LIBRARY' }}
              onChange={set}
              context={context}
              storeId={storeId}
            />
            <label className="form-field">
              <span>Product selection</span>
              <select
                value={draft.rule}
                onChange={(event) => set('rule', event.target.value)}
              >
                <option value="NEWEST">Newest products</option>
                <option value="DISCOUNT">Discounted products</option>
                <option value="REVIEWS">Most reviewed</option>
                <option value="MANUAL">Choose products manually</option>
              </select>
            </label>
            <small>
              Brand/category restrictions apply to every rule. Changing a rule
              does not change the collection URL.
            </small>
            {draft.rule === 'MANUAL' && (
              <div className={styles.fields}>
                <label className="form-field">
                  <span>Find products</span>
                  <input
                    type="search"
                    maxLength={190}
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                  />
                </label>
                {productError && (
                  <p role="alert" className="form-error">
                    {productError}
                  </p>
                )}
                <label className="form-field">
                  <span>Add selected product</span>
                  <select
                    value=""
                    disabled={draft.productSlugs.length >= 100}
                    onChange={(event) => {
                      if (event.target.value)
                        set('productSlugs', [
                          ...draft.productSlugs,
                          event.target.value,
                        ]);
                    }}
                  >
                    <option value="">Select a published product</option>
                    {products
                      .filter((row) => !draft.productSlugs.includes(row.slug))
                      .map((row) => (
                        <option key={row.id} value={row.slug}>
                          {row.name}
                        </option>
                      ))}
                  </select>
                </label>
                <ol className={styles.selectedProducts}>
                  {draft.productSlugs.map((product, index) => (
                    <li key={product}>
                      <span>
                        {products.find((row) => row.slug === product)?.name ||
                          product}
                      </span>
                      <div className={styles.slideActions}>
                        <button
                          type="button"
                          disabled={index === 0}
                          aria-label={`Move collection product ${index + 1} up`}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={index === draft.productSlugs.length - 1}
                          aria-label={`Move collection product ${index + 1} down`}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove collection product ${index + 1}`}
                          onClick={() =>
                            set(
                              'productSlugs',
                              draft.productSlugs.filter(
                                (value) => value !== product,
                              ),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                <small>
                  Up to 100 products. Curated sorting keeps this exact order.
                  Unavailable products stay hidden publicly.
                </small>
              </div>
            )}
            <details>
              <summary>Search engine settings</summary>
              <div className={styles.fields}>
                {field('seoTitle', 'SEO title (optional)', 70)}
                {field(
                  'seoDescription',
                  'SEO description (optional)',
                  180,
                  true,
                )}
                <small>
                  Blank fields use the collection title and introduction. The
                  public page has its own canonical URL and appears in the
                  sitemap only while published and in its date window.
                </small>
              </div>
            </details>
          </fieldset>
          <div className={`${styles.savebar} ${layout.actions}`}>
            <p>
              {dirty ? 'Unsaved draft changes' : 'Draft saved'} · Publishing is
              separate.
            </p>
            <div className={styles.saveActions}>
              <button
                type="button"
                className="button button-secondary"
                disabled={Boolean(busy)}
                onClick={() => action('preview')}
              >
                Preview collection
              </button>
              <button
                type="button"
                className="button button-secondary"
                disabled={locked || !dirty}
                onClick={() => action(record ? 'save' : 'create')}
              >
                Save collection draft
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={locked || !record || dirty}
                onClick={() => action('publish')}
              >
                Publish collection
              </button>
              {record?.visible && (
                <button
                  type="button"
                  className="button button-danger"
                  disabled={locked}
                  onClick={() => action('withdraw')}
                >
                  Withdraw collection
                </button>
              )}
            </div>
          </div>
          {busy && <p role="status">Processing collection…</p>}
          {preview && (
            <section
              aria-label="Collection preview"
              className={styles.collectionPreview}
            >
              <h3>{preview.title} · draft preview</h3>
              <p>
                Not public. Schedules are ignored. Preview shows up to 12
                eligible products.
              </p>
              {preview.imageUrl && (
                <img
                  className={styles.bannerThumbnail}
                  src={preview.imageUrl}
                  alt={preview.altText}
                />
              )}
              <p>{preview.description}</p>
              <div className={styles.previewProducts}>
                {preview.items.map((product) => (
                  <article key={product.id}>
                    {product.image && <img src={product.image} alt="" />}
                    <strong>{product.name}</strong>
                  </article>
                ))}
              </div>
              {!preview.items.length && (
                <p>No currently eligible products match this collection.</p>
              )}
            </section>
          )}
        </section>
      )}
    </>
  );
}
