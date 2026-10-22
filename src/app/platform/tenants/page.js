"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Status } from "@/components/dashboard-primitives";
import { GlobalLoader } from "@/components/global-loader";
import { TablePagination } from "@/components/table-pagination";
import { useAuth } from "@/components/auth-provider";
import { listPlatformTenantsRequest } from "@/lib/api-client";

const statusTone = {
  ACTIVE: "positive",
  PENDING: "warning",
  SUSPENDED: "danger"
};

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export default function TenantDirectoryPage() {
  const { accessToken } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [filters, setFilters] = useState({ search: "", status: "ALL", page: 1, pageSize: 10 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTenants = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      setResult(await listPlatformTenantsRequest(filters, accessToken));
    } catch (requestError) {
      setError(requestError.message || "Tenant data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  function applyFilters(event) {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: search.trim(), status, page: 1 }));
  }

  const summary = result?.summary || { total: 0, active: 0, pending: 0, suspended: 0 };
  const items = result?.items || [];

  return (
    <AppShell
      action={<Link className="button button-primary" href="/platform/tenants/new"><Plus size={16} aria-hidden="true" />Create tenant</Link>}
      area="platform"
      currentPath="/platform/tenants"
      description="Create businesses, inspect their operating structure, and control access without deleting business data."
      eyebrow="Platform control"
      title="Tenants"
    >
      <section className="tenant-summary" aria-label="Tenant status summary">
        {[
          ["All tenants", summary.total, "total"],
          ["Active", summary.active, "active"],
          ["In setup", summary.pending, "pending"],
          ["Suspended", summary.suspended, "suspended"]
        ].map(([label, value, key]) => (
          <button
            aria-pressed={key === "total" ? status === "ALL" : status === key.toUpperCase()}
            className="tenant-summary-item"
            data-selected={(key === "total" ? status === "ALL" : status === key.toUpperCase()) || undefined}
            key={key}
            onClick={() => {
              const nextStatus = key === "total" ? "ALL" : key.toUpperCase();
              setStatus(nextStatus);
              setFilters((current) => ({ ...current, status: nextStatus, page: 1 }));
            }}
            type="button"
          >
            <span>{label}</span><strong>{value}</strong>
          </button>
        ))}
      </section>

      <section className="tenant-directory" aria-labelledby="tenant-directory-title">
        <div className="section-heading tenant-directory-heading">
          <div>
            <p className="eyebrow">Business directory</p>
            <h2 id="tenant-directory-title">All tenant accounts</h2>
          </div>
          <form className="directory-filters" onSubmit={applyFilters} role="search">
            <label className="compact-search">
              <span className="sr-only">Search tenants</span>
              <Search size={16} aria-hidden="true" />
              <input onChange={(event) => setSearch(event.target.value)} placeholder="Name or tenant code" value={search} />
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">In setup</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
            <button className="button button-secondary" type="submit">Apply</button>
          </form>
        </div>

        {error ? (
          <div className="inline-state inline-state-error" role="alert">
            <span>{error}</span>
            <button onClick={loadTenants} type="button">Try again</button>
          </div>
        ) : null}

        {loading ? (
          <GlobalLoader inline label="Loading tenant accounts" />
        ) : items.length === 0 ? (
          <div className="empty-workspace">
            <Building2 size={28} aria-hidden="true" />
            <h3>No tenants found</h3>
            <p>{filters.search || filters.status !== "ALL" ? "Adjust the search or status filter." : "Create the first business account to begin platform setup."}</p>
            {!filters.search && filters.status === "ALL" ? <Link className="button button-primary" href="/platform/tenants/new">Create tenant</Link> : null}
          </div>
        ) : (
          <div className="table-wrap tenant-table-wrap">
            <table className="tenant-table">
              <thead>
                <tr>
                  <th>Tenant</th><th>Owner</th><th>Stores</th><th>Users</th><th>Created</th><th>Status</th><th><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <Link className="tenant-name" href={`/platform/tenants/${tenant.id}`}>
                        <span>{tenant.displayName}</span><small>{tenant.code}</small>
                      </Link>
                    </td>
                    <td><span className="table-primary">{tenant.ownerName || "Not assigned"}</span><small className="table-secondary">{tenant.ownerEmail || "—"}</small></td>
                    <td>{tenant.storeCount}</td>
                    <td>{tenant.userCount}</td>
                    <td>{formatDate(tenant.createdAt)}</td>
                    <td><Status tone={statusTone[tenant.status]}>{tenant.status === "PENDING" ? "In setup" : tenant.status}</Status></td>
                    <td><Link aria-label={`Open ${tenant.displayName}`} className="row-action" href={`/platform/tenants/${tenant.id}`}><ArrowRight size={16} aria-hidden="true" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && items.length ? <TablePagination
          itemLabel="tenants"
          onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          totalPages={result.totalPages}
        /> : null}
      </section>
    </AppShell>
  );
}
