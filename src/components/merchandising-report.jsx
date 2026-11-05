'use client';
import {useLocalization as useUiLocalization} from '@/localization/provider';
import { useEffect, useState } from 'react';
import {
  merchandisingReportRequest,
  merchandisingStoresRequest,
} from '@/lib/api-client';
import { ListingExcelExport } from './listing-excel-export';
import { TablePagination } from './table-pagination';
import styles from './merchandising-report.module.css';
const day = (offset) =>
  new Date(Date.now() + 330 * 60000 + offset * 86400000)
    .toISOString()
    .slice(0, 10);
const kinds = {
  ALL: 'All placements',
  COLLECTION: 'Collection page',
  HERO: 'Hero',
  BANNER: 'Banner',
  SHELF: 'Homepage shelf',
};
const exportColumns = [
  { key: 'collectionTitle', label: 'Collection' },
  { key: 'sourceLabel', label: 'Placement label' },
  { key: 'kind', label: 'Placement type' },
  { key: 'views', label: 'Views (30-min dedup)', type: 'number' },
  { key: 'opens', label: 'Collection opens (30-min dedup)', type: 'number' },
  { key: 'clicks', label: 'Product clicks (30-min dedup)', type: 'number' },
  { key: 'adds', label: 'Bag additions', type: 'number' },
  { key: 'orders', label: 'Attributed non-test orders', type: 'number' },
  { key: 'testOrders', label: 'Test orders (not revenue)', type: 'number' },
  {
    key: 'paidValue',
    label: 'Paid attributed item value (INR)',
    type: 'number',
  },
];
export function MerchandisingReport({ accessToken, tenantId }) {
 const {t: _uiText}=useUiLocalization();

  const [stores, setStores] = useState([]),
    [storeId, setStoreId] = useState(''),
    [storeSearch, setStoreSearch] = useState(''),
    [storeQuery, setStoreQuery] = useState(''),
    [more, setMore] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState(() => ({
      fromDate: day(-29),
      toDate: day(0),
      kind: 'ALL',
      search: '',
      page: 1,
      pageSize: 10,
    })),
    [draft, setDraft] = useState(filters),
    [snapshot, setSnapshot] = useState(null),
    [error, setError] = useState(''),
    [storeError, setStoreError] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    merchandisingStoresRequest(storeQuery, {
      accessToken,
      tenantId,
      signal: c.signal,
    })
      .then((data) => {
        if (!c.signal.aborted) {
          setStores(data.items);
          setMore(data.hasMore);
          setStoreId((value) => value || data.items[0]?.id || '');
          setStoreError('');
        }
      })
      .catch((cause) => {
        if (!c.signal.aborted) setStoreError(cause.message);
      });
    return () => c.abort();
  }, [accessToken, tenantId, storeQuery, attempt]);
  useEffect(() => {
    if (!storeId) return;
    const c = new AbortController();
    setLoading(true);
    setError('');
    merchandisingReportRequest(storeId, filters, {
      accessToken,
      tenantId,
      signal: c.signal,
    })
      .then((data) => {
        if (!c.signal.aborted) setSnapshot({ storeId, tenantId, data });
      })
      .catch((cause) => {
        if (!c.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [accessToken, tenantId, storeId, filters, attempt]);
  const data =
      snapshot?.storeId === storeId && snapshot?.tenantId === tenantId
        ? snapshot.data
        : null,
    money = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: data?.currency || 'INR',
      maximumFractionDigits: 2,
    });
  const max = Math.max(
    1,
    ...(data?.trend || []).flatMap((row) => [row.views, row.clicks, row.adds]),
  );
  function apply(event) {
    event.preventDefault();
    setFilters({ ...draft, page: 1, pageSize: filters.pageSize });
  }
  return (
    <div className={styles.workspace}>
      <section className={styles.scope}>
        <header>
          <p className="eyebrow">Collection performance</p>
          <h2>From collection discovery to purchase</h2>
          <p>
            Dedicated collection pages and linked homepage hero, banner and
            shelf placements. Optional customer consent is required; this is not
            a count of all visitors.
          </p>
        </header>
        <div className={styles.storeTools}>
          <label className="form-field">
            <span>{_uiText("Store")}</span>
            <select
              aria-label="Analytics store"
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                setFilters((value) => ({ ...value, page: 1 }));
              }}
            >
              <option value="" disabled>
                Select store
              </option>
              {storeId && !stores.some((item) => item.id === storeId) && (
                <option value={storeId}>Selected store</option>
              )}
              {stores.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </option>
              ))}
            </select>
          </label>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setStoreQuery(storeSearch);
            }}
          >
            <label className="form-field">
              <span>Find store</span>
              <input
                type="search"
                maxLength={120}
                value={storeSearch}
                onChange={(event) => setStoreSearch(event.target.value)}
              />
            </label>
            <button className="button button-secondary">Find</button>
          </form>
        </div>
        {more && <p>Showing 50 stores. Refine the search for more.</p>}
        {storeError && (
          <p role="alert" className="form-error">
            {storeError}
          </p>
        )}
        <form className={styles.filters} onSubmit={apply}>
          <label className="form-field">
            <span>From (IST)</span>
            <input
              type="date"
              required
              value={draft.fromDate}
              max={draft.toDate}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  fromDate: event.target.value,
                }))
              }
            />
          </label>
          <label className="form-field">
            <span>To (IST)</span>
            <input
              type="date"
              required
              value={draft.toDate}
              min={draft.fromDate}
              onChange={(event) =>
                setDraft((value) => ({ ...value, toDate: event.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>Placement</span>
            <select
              aria-label="Placement type"
              value={draft.kind}
              onChange={(event) =>
                setDraft((value) => ({ ...value, kind: event.target.value }))
              }
            >
              {Object.entries(kinds).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Collection or campaign</span>
            <input
              type="search"
              maxLength={120}
              value={draft.search}
              onChange={(event) =>
                setDraft((value) => ({ ...value, search: event.target.value }))
              }
            />
          </label>
          <button
            className="button button-secondary"
            disabled={loading || !storeId}
          >
            {_uiText("Apply filters")} </button>
          <button
            type="button"
            className="button button-secondary"
            disabled={loading}
            onClick={() => setAttempt((value) => value + 1)}
          >
            {_uiText("Refresh")} </button>
        </form>
        <small>
          Maximum 92 calendar days. Views, opens and product clicks are
          deduplicated per consenting browser/source/product in 30-minute
          windows, not unique people.
        </small>
      </section>
      {error && (
        <div role="alert" className="inline-state inline-state-error">
          {error}
        </div>
      )}
      {loading && (
        <div
          className={styles.skeleton}
          role="status"
          aria-label="Loading collection analytics"
        >
          <span />
          <span />
          <span />
        </div>
      )}
      {!loading && data && (
        <>
          <section
            className={styles.metrics}
            aria-label="Collection analytics summary"
          >
            {[
              ['Views', data.summary.views],
              ['Product clicks', data.summary.clicks],
              ['Bag additions', data.summary.adds],
              ['Attributed orders', data.summary.orders],
              ['Paid item value', money.format(data.summary.paidValue)],
              ['Test orders', data.summary.testOrders],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  {typeof value === 'number'
                    ? value.toLocaleString('en-IN')
                    : value}
                </strong>
              </div>
            ))}
          </section>
          <details className={styles.policy}>
            <summary>How these numbers are calculated</summary>
            <p>
              A successful bag addition keeps its last eligible product click in
              the same consenting browser flow. That click must still be within
              24 hours when the order is placed; later browsing alone does not
              overwrite an existing bag line’s credit. Collection-page product
              clicks can inherit the last valid campaign open for that
              collection within 30 minutes. Each order line is credited once;
              one order may involve multiple placements. The summary counts
              distinct non-test orders, so row order counts may not add up to
              it.
            </p>
            <p>
              Paid item value is the tax-inclusive order-line amount after
              discounts, excluding delivery. Only COD orders marked Paid are
              counted currently; cancelled orders, test payments and any order
              with a recorded refund are excluded. It is not a cash or
              settlement reconciliation report. Figures can change when
              order/payment/refund status changes.
            </p>
            <p>
              Dates use event time for views/clicks/additions and order
              placement time for orders/value, in IST. This is not a cohort
              conversion rate. No historical activity is backfilled;
              non-consenting customers and unlinked catalog/search campaigns are
              not tracked.
            </p>
          </details>
          <section className={styles.chart}>
            <h3>Daily activity</h3>
            <p>Views / product clicks / bag additions · India Standard Time</p>
            {data.trend.length ? (
              <div
                className={styles.bars}
                role="img"
                aria-label="Daily consenting-browser collection activity. Exact figures appear in the accessible data table below."
              >
                {data.trend.map((row) => (
                  <div key={row.day}>
                    <div>
                      {[
                        ['views', 'Views'],
                        ['clicks', 'Clicks'],
                        ['adds', 'Bag additions'],
                      ].map(([key, label]) => (
                        <i
                          key={key}
                          data-series={key}
                          style={{
                            height: `${Math.max(row[key] ? 2 : 0, (row[key] / max) * 100)}%`,
                          }}
                          title={`${row.day}: ${label} ${row[key]}`}
                        />
                      ))}
                    </div>
                    <small>{row.day.slice(5)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p>No activity recorded in this period.</p>
            )}
            <details>
              <summary>Daily figures</summary>
              <div className="table-wrap">
                <table className="tenant-table">
                  <thead>
                    <tr>
                      <th>Date (IST)</th>
                      <th>Views</th>
                      <th>Product clicks</th>
                      <th>Bag additions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trend.map((row) => (
                      <tr key={row.day}>
                        <td>{row.day}</td>
                        <td>{row.views}</td>
                        <td>{row.clicks}</td>
                        <td>{row.adds}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
          <section className={styles.records}>
            <header>
              <h3>Collection and placement results</h3>
              <span>{data.total} matching placements</span>
            </header>
            <ListingExcelExport
              data={data}
              title="collection performance"
              columns={exportColumns}
            />
            {data.items.length ? (
              <div className="table-wrap">
                <table className="tenant-table">
                  <thead>
                    <tr>
                      <th>Collection / placement</th>
                      <th>Views</th>
                      <th>Opens</th>
                      <th>Product clicks</th>
                      <th>Bag adds</th>
                      <th>{_uiText("Orders")}</th>
                      <th>Test orders</th>
                      <th>Paid item value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.collectionTitle}</strong>
                          <small>
                            {kinds[row.kind]} · {row.sourceLabel}
                          </small>
                        </td>
                        <td>{row.views}</td>
                        <td>{row.opens}</td>
                        <td>{row.clicks}</td>
                        <td>{row.adds}</td>
                        <td>{row.orders}</td>
                        <td>{row.testOrders}</td>
                        <td>{money.format(row.paidValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-workspace">
                <h3>No consenting activity yet</h3>
                <p>
                  Publish a collection and link it from the homepage. Customers
                  can opt in through Optional store analytics in the storefront
                  footer. Activity starts from that point; no history is
                  invented.
                </p>
              </div>
            )}
            <TablePagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              pageSizeOptions={[10, 20, 50]}
              itemLabel="collection placements"
              onPageChange={(page) =>
                setFilters((value) => ({ ...value, page }))
              }
              onPageSizeChange={(pageSize) =>
                setFilters((value) => ({ ...value, pageSize, page: 1 }))
              }
            />
          </section>
        </>
      )}
      {!storeId && !storeError && (
        <p>Select a store to view collection performance.</p>
      )}
    </div>
  );
}
