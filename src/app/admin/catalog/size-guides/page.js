"use client";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Ruler, Eye } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CatalogTabs } from "@/components/catalog-tabs";
import { GlobalLoader } from "@/components/global-loader";
import { TablePagination } from "@/components/table-pagination";
import { Status } from "@/components/dashboard-primitives";
import { SizeGuideEditor } from "@/components/size-guide-editor";
import { useAuth } from "@/components/auth-provider";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { sizeGuidesRequest } from "@/lib/api-client";

export default function SizeGuidesPage() {
  const { user, accessToken, activeTenantId } = useAuth(),
    tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canRead = canUser(user, "admin", "catalog.product.read", tenantId),
    canCreate = canUser(user, "admin", "catalog.product.create", tenantId),
    canUpdate = canUser(user, "admin", "catalog.product.update", tenantId);
  const [filters, setFilters] = useState({
      search: "",
      status: "ALL",
      page: 1,
      pageSize: 10,
    }),
    [draft, setDraft] = useState(""),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [editor, setEditor] = useState(null),
    [notice, setNotice] = useState("");
  const load = useCallback(() => {
    if (!accessToken || !tenantId || !canRead) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    sizeGuidesRequest(`/size-guides?${new URLSearchParams(filters)}`, {
      accessToken,
      tenantId,
      signal: controller.signal,
    })
      .then((data) => setResult({ tenantId, data }))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, tenantId, canRead, filters]);
  useEffect(load, [load]);
  const data = result?.tenantId === tenantId ? result.data : null;
  async function edit(item) {
    setError("");
    try {
      const guide = await sizeGuidesRequest(`/size-guides/${item.id}`, {
        accessToken,
        tenantId,
      });
      setEditor({ tenantId, guide });
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <AppShell
      area="admin"
      currentPath="/admin/catalog/size-guides"
      eyebrow="Product confidence"
      title="Size guides"
      description="Reusable measurement charts for clothing products. No generic measurements are assumed."
      action={
        canCreate ? (
          <button
            className="button button-primary"
            type="button"
            onClick={() => setEditor({ tenantId, guide: null })}
          >
            <Plus aria-hidden="true" size={16} />
            New size guide
          </button>
        ) : null
      }
    >
      <CatalogTabs currentPath="/admin/catalog/size-guides" />
      {notice && (
        <p role="status" className="inline-state">
          {notice}
        </p>
      )}
      <section className="tenant-directory">
        <div className="section-heading tenant-directory-heading">
          <div>
            <p className="eyebrow">Fit library</p>
            <h2>Verified measurements, reusable charts</h2>
          </div>
          <form
            className="directory-filters"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters((current) => ({
                ...current,
                search: draft.trim(),
                page: 1,
              }));
            }}
          >
            <label className="sr-only" htmlFor="guide-search">
              Search size guides
            </label>
            <input
              id="guide-search"
              value={draft}
              maxLength={190}
              placeholder="Search size guides"
              onChange={(event) => setDraft(event.target.value)}
            />
            <select
              aria-label="Size guide status"
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
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <button className="button button-secondary" type="submit">
              Search
            </button>
          </form>
        </div>
        {!canRead ? (
          <p role="alert">You do not have permission to view size guides.</p>
        ) : error ? (
          <div className="inline-state inline-state-error" role="alert">
            {error}
            <button type="button" onClick={load}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <GlobalLoader inline label="Loading size guides" />
        ) : !data?.items.length ? (
          <div className="empty-workspace">
            <Ruler aria-hidden="true" size={28} />
            <h3>No size guides in this view</h3>
            <p>
              Create a chart with measurements verified for your products, then
              use a clothing product's Size guide action to assign it.
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="tenant-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Measurements</th>
                    <th>Assigned products</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Name">
                        <strong>{item.name}</strong>
                      </td>
                      <td data-label="Unit">
                        {item.unit === "CM" ? "Centimetres" : "Inches"}
                      </td>
                      <td data-label="Measurements">
                        {item.basis === "BODY" ? "Body" : "Garment"}
                      </td>
                      <td data-label="Assigned products">{item.usageCount}</td>
                      <td data-label="Status">
                        <Status
                          tone={
                            item.status === "ACTIVE" ? "positive" : "neutral"
                          }
                        >
                          {item.status === "ACTIVE" ? "Active" : "Inactive"}
                        </Status>
                      </td>
                      <td data-label="Actions">
                        <button
                          className="row-text-action"
                          type="button"
                          onClick={() => edit(item)}
                        >
                          {canUpdate ? (
                            <Pencil aria-hidden="true" size={14} />
                          ) : (
                            <Eye aria-hidden="true" size={14} />
                          )}{" "}
                          {canUpdate ? "Edit" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              itemLabel="size guides"
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={(page) =>
                setFilters((current) => ({ ...current, page }))
              }
              onPageSizeChange={(pageSize) =>
                setFilters((current) => ({ ...current, page: 1, pageSize }))
              }
            />
          </>
        )}
      </section>
      {editor?.tenantId === tenantId && (
        <SizeGuideEditor
          key={`${tenantId}:${editor.guide?.id || "new"}`}
          guide={editor.guide}
          canSave={editor.guide ? canUpdate : canCreate}
          context={{ accessToken, tenantId }}
          onClose={(saved) => {
            setEditor(null);
            if (saved) {
              setNotice(
                "Size guide saved. Active changes appear on assigned storefront products.",
              );
              load();
            }
          }}
        />
      )}
    </AppShell>
  );
}
