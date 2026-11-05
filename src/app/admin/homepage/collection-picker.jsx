'use client';
import { useEffect, useState } from 'react';
import { storeCollectionsRequest } from '@/lib/api-client';
export function CollectionPicker({
  storeId,
  context,
  value,
  onChange,
  byHref = false,
}) {
  const [search, setSearch] = useState(''),
    [data, setData] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        storeCollectionsRequest(
          storeId,
          { search, page: 1, pageSize: 50 },
          { ...context, signal: controller.signal },
        )
          .then((result) => {
            if (!controller.signal.aborted) {
              setData(result);
              setError('');
            }
          })
          .catch((cause) => {
            if (!controller.signal.aborted) setError(cause.message);
          }),
      250,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [storeId, context.accessToken, context.tenantId, search]);
  const options = (data?.items || []).filter(
      (row) => row.visible && row.published,
    ),
    key = (row) => (byHref ? `/collections/${row.slug}` : row.id);
  return (
    <div>
      <label className="form-field">
        <span>Find reusable collection</span>
        <input
          type="search"
          value={search}
          maxLength={120}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>{byHref ? 'Collection destination' : 'Reusable collection'}</span>
        <select
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {byHref
              ? 'Custom destination'
              : 'Use this shelf’s own product selection'}
          </option>
          {value && !options.some((row) => key(row) === value) && (
            <option value={value}>
              Selected collection (reload or search to check availability)
            </option>
          )}
          {options.map((row) => (
            <option key={row.id} value={key(row)}>
              {row.published.title} · /collections/{row.slug}
            </option>
          ))}
        </select>
      </label>
      <small>
        Published collections from this store only. Search to refine the first
        50 results. Future schedules are allowed; live links stay hidden until
        the destination opens.
      </small>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
