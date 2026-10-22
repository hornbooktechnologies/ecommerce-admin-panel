"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Plus, Search, ShieldCheck, UserRoundCheck, UserRoundX, UsersRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { GlobalLoader } from "@/components/global-loader";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { tenantIdForUser } from "@/lib/auth-routing";
import {
  changeTenantUserStatusRequest,
  inviteTenantUserRequest,
  listTenantRolesRequest,
  listTenantUsersRequest,
  setTenantUserRolesRequest
} from "@/lib/api-client";

const tone = { ACTIVE: "positive", INVITED: "warning", SUSPENDED: "danger" };

function UserDialog({ roles, onClose, onCreated }) {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", temporaryPassword: "", roleId: roles[0]?.id || ""
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await inviteTenantUserRequest({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        temporaryPassword: form.temporaryPassword,
        assignments: [{ roleId: form.roleId, scopeType: "TENANT", scopeId: null }]
      }, accessToken, tenantId);
      onCreated();
    } catch (requestError) {
      setError(requestError.message || "The invitation could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="invite-user-title" aria-modal="true" className="access-dialog" role="dialog">
        <header className="access-dialog-head">
          <div className="dialog-icon" data-tone="positive"><UserRoundCheck size={19} aria-hidden="true" /></div>
          <div><p className="eyebrow">Tenant access</p><h2 id="invite-user-title">Invite a team member</h2></div>
          <button aria-label="Close invite dialog" className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <p className="access-dialog-copy">Create secure tenant access and assign the member's initial role. Access remains inactive until you approve it.</p>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="form-field"><span>First name <em>*</em></span><input autoComplete="given-name" autoFocus required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
            <label className="form-field"><span>Last name</span><input autoComplete="family-name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
            <label className="form-field access-span-2"><span>Email address <em>*</em></span><input autoComplete="email" required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label className="form-field"><span>Temporary password <em>*</em></span><span className="form-password-control"><input autoComplete="new-password" minLength={12} required type={showPassword ? "text" : "password"} value={form.temporaryPassword} onChange={(event) => update("temporaryPassword", event.target.value)} /><button aria-label={showPassword ? "Hide temporary password" : "Show temporary password"} onClick={() => setShowPassword((current) => !current)} type="button">{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></span><small className="field-help">At least 12 characters. Share it securely.</small></label>
            <label className="form-field"><span>Initial role <em>*</em></span><select required value={form.roleId} onChange={(event) => update("roleId", event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          </div>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <footer className="dialog-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving || !form.roleId} type="submit">{saving ? "Creating…" : "Create invitation"}</button></footer>
        </form>
      </section>
    </div>
  );
}

export default function TenantUsersPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [filters, setFilters] = useState({ search: "", status: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyUser, setBusyUser] = useState("");
  const [roleDrafts, setRoleDrafts] = useState({});

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError("");
    try {
      const [usersData, rolesData] = await Promise.all([
        listTenantUsersRequest(filters, accessToken, tenantId),
        listTenantRolesRequest(accessToken, tenantId)
      ]);
      setResult(usersData);
      setRoles(rolesData.items || []);
      setRoleDrafts(Object.fromEntries(usersData.items.map((item) => [item.id, item.assignments[0]?.roleId || ""])));
    } catch (requestError) {
      setError(requestError.message || "Team access could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters, tenantId]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    return result?.summary || { total: 0, active: 0, invited: 0, suspended: 0 };
  }, [result]);

  async function statusAction(member, action) {
    setBusyUser(member.id);
    setError("");
    try {
      await changeTenantUserStatusRequest(member.id, action, accessToken, tenantId);
      await load();
    } catch (requestError) {
      setError(requestError.message || "The member status could not be changed.");
    } finally {
      setBusyUser("");
    }
  }

  async function saveRole(member) {
    const roleId = roleDrafts[member.id];
    if (!roleId) return;
    setBusyUser(member.id);
    try {
      await setTenantUserRolesRequest(member.id, [{ roleId, scopeType: "TENANT", scopeId: null }], accessToken, tenantId);
      await load();
    } catch (requestError) {
      setError(requestError.message || "The role assignment could not be saved.");
    } finally {
      setBusyUser("");
    }
  }

  const members = result?.items || [];
  return (
    <AppShell
      action={<button className="button button-primary" onClick={() => setDialogOpen(true)} type="button"><Plus size={16} aria-hidden="true" />Invite member</button>}
      area="admin" currentPath="/admin/settings/users" eyebrow="Access control" title="Team access"
      description="Invite staff, control tenant access, and keep role assignments explicit."
    >
      <section className="tenant-summary access-summary" aria-label="Team access summary">
        {[["All members", summary.total, "ALL"], ["Active", summary.active, "ACTIVE"], ["Invited", summary.invited, "INVITED"], ["Suspended", summary.suspended, "SUSPENDED"]].map(([label, value, status]) => (
          <button aria-pressed={filters.status === status} className="tenant-summary-item" data-selected={filters.status === status || undefined} key={status} onClick={() => setFilters((current) => ({ ...current, status, page: 1 }))} type="button"><span>{label}</span><strong>{value}</strong></button>
        ))}
      </section>

      <section className="tenant-directory access-directory" aria-labelledby="team-directory-title">
        <div className="section-heading tenant-directory-heading">
          <div><p className="eyebrow">Members</p><h2 id="team-directory-title">People with tenant access</h2></div>
          <form className="directory-filters" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 })); }} role="search">
            <label className="compact-search"><span className="sr-only">Search team members</span><Search size={16} aria-hidden="true" /><input placeholder="Name or email" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label>
            <button className="button button-secondary" type="submit">Search</button>
          </form>
        </div>
        {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
        {loading ? <GlobalLoader inline label="Loading team access" /> : members.length === 0 ? (
          <div className="empty-workspace"><UsersRound size={28} aria-hidden="true" /><h3>No team members found</h3><p>Invite a member or adjust the current filters.</p></div>
        ) : (
          <div className="table-wrap"><table className="tenant-table access-table"><thead><tr><th>Member</th><th>Access</th><th>Role</th><th>Scope</th><th>Action</th></tr></thead><tbody>
            {members.map((member) => {
              const isOwner = member.membershipType === "OWNER";
              const currentRole = member.assignments[0];
              const changed = roleDrafts[member.id] && roleDrafts[member.id] !== currentRole?.roleId;
              return <tr key={member.id}>
                <td><span className="member-cell"><span className="member-avatar">{member.firstName?.[0]}{member.lastName?.[0]}</span><span><strong>{member.displayName}</strong><small>{member.email}</small></span></span></td>
                <td><Status tone={tone[member.status]}>{member.status.toLowerCase()}</Status>{isOwner ? <span className="owner-label"><KeyRound size={12} aria-hidden="true" />Owner</span> : null}</td>
                <td>{isOwner ? <span className="role-readonly"><ShieldCheck size={14} aria-hidden="true" />{currentRole?.roleName || "Tenant owner"}</span> : <span className="role-editor"><select aria-label={`Role for ${member.displayName}`} disabled={busyUser === member.id} value={roleDrafts[member.id] || ""} onChange={(event) => setRoleDrafts((current) => ({ ...current, [member.id]: event.target.value }))}>{roles.filter((role) => role.level === "TENANT").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>{changed ? <button aria-label={`Save role for ${member.displayName}`} onClick={() => saveRole(member)} type="button"><Check size={15} aria-hidden="true" /></button> : null}</span>}</td>
                <td><span className="scope-pill">Tenant-wide</span></td>
                <td>{isOwner ? <span className="protected-copy">Protected</span> : member.status === "ACTIVE" ? <button className="row-text-action danger-action" disabled={busyUser === member.id} onClick={() => statusAction(member, "suspend")} type="button"><UserRoundX size={15} aria-hidden="true" />Suspend</button> : <button className="row-text-action" disabled={busyUser === member.id} onClick={() => statusAction(member, "activate")} type="button"><UserRoundCheck size={15} aria-hidden="true" />Activate</button>}</td>
              </tr>;
            })}
          </tbody></table></div>
        )}
        {result && members.length ? <TablePagination
          itemLabel="team members"
          onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          totalPages={result.totalPages}
        /> : null}
      </section>
      {dialogOpen ? <UserDialog roles={roles.filter((role) => role.level === "TENANT")} onClose={() => setDialogOpen(false)} onCreated={() => { setDialogOpen(false); load(); }} /> : null}
    </AppShell>
  );
}
