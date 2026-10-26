"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Eye, EyeOff, KeyRound, LockKeyhole, Plus, Save, Search,
  Shield, ShieldCheck, Trash2, UserRoundCheck, UserRoundX, UsersRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { GlobalLoader } from "@/components/global-loader";
import { TablePagination } from "@/components/table-pagination";
import { canUser } from "@/lib/auth-routing";
import { changePlatformUserStatusRequest, createPlatformRoleRequest, deletePlatformRoleRequest,
  invitePlatformUserRequest, listPlatformPermissionsRequest, listPlatformRolesRequest,
  listPlatformUsersRequest, setPlatformUserRolesRequest, updatePlatformRoleRequest } from "@/lib/api-client";

const tones = { ACTIVE: "positive", INVITED: "warning", SUSPENDED: "danger" };
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const displayDate = (value) => value ? dateTime.format(new Date(value)) : "Never";

function InviteDialog({ roles, onClose, onCreated }) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "",
    temporaryPassword: "", roleId: roles[0]?.id || "" });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { const close = (event) => event.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose, saving]);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { await invitePlatformUserRequest({ firstName: form.firstName, lastName: form.lastName,
      email: form.email, temporaryPassword: form.temporaryPassword, roleIds: [form.roleId] }, accessToken); onCreated(); }
    catch (requestError) { setError(requestError.message || "The platform invitation could not be created."); }
    finally { setSaving(false); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <section aria-labelledby="platform-invite-title" aria-modal="true" className="access-dialog platform-access-dialog" role="dialog">
      <header className="access-dialog-head"><div className="dialog-icon" data-tone="positive"><UserRoundCheck size={19} /></div><div><p className="eyebrow">Platform access</p><h2 id="platform-invite-title">Invite a platform operator</h2></div><button aria-label="Close invite dialog" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={18} /></button></header>
      <p className="access-dialog-copy">Create a secure operator account and assign its initial least-privilege role. Access remains inactive until approved.</p>
      <form onSubmit={submit}><div className="form-grid">
        <label className="form-field"><span>First name <em>*</em></span><input autoComplete="given-name" autoFocus required value={form.firstName} onChange={(event) => set("firstName", event.target.value)} /></label>
        <label className="form-field"><span>Last name</span><input autoComplete="family-name" value={form.lastName} onChange={(event) => set("lastName", event.target.value)} /></label>
        <label className="form-field access-span-2"><span>Email address <em>*</em></span><input autoComplete="email" required type="email" value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
        <label className="form-field"><span>Temporary password <em>*</em></span><span className="form-password-control"><input autoComplete="new-password" minLength={12} required type={showPassword ? "text" : "password"} value={form.temporaryPassword} onChange={(event) => set("temporaryPassword", event.target.value)} /><button aria-label={showPassword ? "Hide temporary password" : "Show temporary password"} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><small className="field-help">At least 12 characters. Share it securely.</small></label>
        <label className="form-field"><span>Initial role <em>*</em></span><select required value={form.roleId} onChange={(event) => set("roleId", event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
      </div>{error ? <div className="form-error" role="alert">{error}</div> : null}<footer className="dialog-actions"><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving || !form.roleId} type="submit">{saving ? "Creating…" : "Create invitation"}</button></footer></form>
    </section></div>;
}

function TeamDirectory({ canAssign, canInvite, canManage, roles }) {
  const { accessToken, user } = useAuth();
  const [filters, setFilters] = useState({ search: "", status: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyUser, setBusyUser] = useState("");
  const [roleDrafts, setRoleDrafts] = useState({});
  const load = useCallback(async () => {
    if (!accessToken) return; setLoading(true); setError("");
    try { const data = await listPlatformUsersRequest(filters, accessToken); setResult(data);
      setRoleDrafts(Object.fromEntries(data.items.map((item) => [item.id, item.assignments[0]?.roleId || ""]))); }
    catch (requestError) { setError(requestError.message || "Platform team access could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters]);
  useEffect(() => { load(); }, [load]);
  async function statusAction(member, action) { setBusyUser(member.id); setError("");
    try { await changePlatformUserStatusRequest(member.id, action, accessToken); await load(); }
    catch (requestError) { setError(requestError.message || "Platform access could not be changed."); }
    finally { setBusyUser(""); } }
  async function saveRole(member) { const roleId = roleDrafts[member.id]; if (!roleId) return;
    setBusyUser(member.id); setError("");
    try { await setPlatformUserRolesRequest(member.id, [roleId], accessToken); await load(); }
    catch (requestError) { setError(requestError.message || "The role assignment could not be saved."); }
    finally { setBusyUser(""); } }
  const summary = result?.summary || { total: 0, active: 0, invited: 0, suspended: 0 };
  const members = result?.items || [];
  return <><div className="platform-team-toolbar"><section className="tenant-summary access-summary" aria-label="Platform team summary">
    {[["All operators", summary.total, "ALL"], ["Active", summary.active, "ACTIVE"], ["Invited", summary.invited, "INVITED"], ["Suspended", summary.suspended, "SUSPENDED"]].map(([label, value, status]) => <button aria-pressed={filters.status === status} className="tenant-summary-item" data-selected={filters.status === status || undefined} key={status} onClick={() => setFilters((current) => ({ ...current, status, page: 1 }))} type="button"><span>{label}</span><strong>{value}</strong></button>)}</section>
    {canInvite ? <button className="button button-primary" disabled={!roles.length} onClick={() => setDialogOpen(true)} type="button"><Plus size={16} />Invite operator</button> : null}</div>
    <section className="tenant-directory access-directory" aria-labelledby="platform-team-directory-title"><div className="section-heading tenant-directory-heading"><div><p className="eyebrow">Secure operator directory</p><h2 id="platform-team-directory-title">People with platform access</h2></div><form className="directory-filters" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 })); }} role="search"><label className="compact-search"><span className="sr-only">Search platform operators</span><Search size={16} /><input placeholder="Name or email" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><button className="button button-secondary" type="submit">Search</button></form></div>
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
      {loading ? <GlobalLoader inline label="Loading platform team" /> : !members.length ? <div className="empty-workspace"><UsersRound size={28} /><h3>No operators found</h3><p>Invite a platform operator or adjust the current filters.</p></div> : <div className="table-wrap"><table className="tenant-table access-table platform-team-table"><thead><tr><th>Operator</th><th>Access</th><th>Role</th><th>Last sign-in</th><th>Action</th></tr></thead><tbody>
        {members.map((member) => { const currentRole = member.assignments[0]; const isSelf = member.id === user.id; const changed = roleDrafts[member.id] && roleDrafts[member.id] !== currentRole?.roleId;
          return <tr key={member.id}><td><span className="member-cell"><span className="member-avatar">{member.firstName?.[0]}{member.lastName?.[0]}</span><span><strong>{member.displayName}</strong><small>{member.email}</small></span></span></td><td><Status tone={tones[member.status]}>{member.status.toLowerCase()}</Status>{isSelf ? <span className="owner-label"><KeyRound size={12} />You</span> : null}</td><td>{canAssign && !isSelf ? <span className="role-editor"><select aria-label={`Role for ${member.displayName}`} disabled={busyUser === member.id} value={roleDrafts[member.id] || ""} onChange={(event) => setRoleDrafts((current) => ({ ...current, [member.id]: event.target.value }))}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>{changed ? <button aria-label={`Save role for ${member.displayName}`} onClick={() => saveRole(member)} type="button"><Check size={15} /></button> : null}</span> : <span className="role-readonly"><ShieldCheck size={14} />{currentRole?.roleName || "No active role"}</span>}</td><td><span className="table-primary">{displayDate(member.lastLoginAt)}</span><small className="table-secondary">{member.lastLoginAt ? "Successful authentication" : "Invitation not used"}</small></td><td>{!canManage || isSelf ? <span className="protected-copy">Protected</span> : member.status === "ACTIVE" ? <button className="row-text-action danger-action" disabled={busyUser === member.id} onClick={() => statusAction(member, "suspend")} type="button"><UserRoundX size={15} />Suspend</button> : <button className="row-text-action" disabled={busyUser === member.id} onClick={() => statusAction(member, "activate")} type="button"><UserRoundCheck size={15} />Activate</button>}</td></tr>; })}
      </tbody></table></div>}
      {result && members.length ? <TablePagination itemLabel="platform operators" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /> : null}</section>
    {dialogOpen ? <InviteDialog roles={roles} onClose={() => setDialogOpen(false)} onCreated={() => { setDialogOpen(false); load(); }} /> : null}</>;
}

const groupPermissions = (permissions) => permissions.reduce((groups, permission) => ({ ...groups,
  [permission.module]: [...(groups[permission.module] || []), permission] }), {});

function RoleWorkspace({ canCreate, canDelete, canUpdate, permissions, roles, reload }) {
  const { accessToken } = useAuth();
  const [selectedId, setSelectedId] = useState(roles[0]?.id || "");
  const [editor, setEditor] = useState(roles[0] ? { name: roles[0].name, permissionKeys: [...roles[0].permissions], isNew: false } : null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [deleteArmed, setDeleteArmed] = useState(false);
  const grouped = useMemo(() => groupPermissions(permissions), [permissions]); const selected = roles.find((role) => role.id === selectedId);
  useEffect(() => { if (!roles.length) { setSelectedId(""); setEditor(null); return; } const role = roles.find((item) => item.id === selectedId) || roles[0]; setSelectedId(role.id); setEditor({ name: role.name, permissionKeys: [...role.permissions], isNew: false }); }, [roles]);
  function selectRole(role) { setSelectedId(role.id); setEditor({ name: role.name, permissionKeys: [...role.permissions], isNew: false }); setDeleteArmed(false); setError(""); }
  function togglePermission(key) { setEditor((current) => ({ ...current, permissionKeys: current.permissionKeys.includes(key) ? current.permissionKeys.filter((item) => item !== key) : [...current.permissionKeys, key] })); }
  async function save(event) { event.preventDefault(); if (!editor.permissionKeys.length) return setError("Select at least one permission."); setSaving(true); setError("");
    try { const data = editor.isNew ? await createPlatformRoleRequest({ name: editor.name, permissionKeys: editor.permissionKeys }, accessToken) : await updatePlatformRoleRequest(selectedId, { name: editor.name, permissionKeys: editor.permissionKeys }, accessToken); setSelectedId(data.role.id); await reload(); }
    catch (requestError) { setError(requestError.message || "The platform role could not be saved."); } finally { setSaving(false); } }
  async function remove() { if (!deleteArmed) return setDeleteArmed(true); setSaving(true); setError("");
    try { await deletePlatformRoleRequest(selectedId, accessToken); setSelectedId(""); await reload(); }
    catch (requestError) { setError(requestError.message || "The platform role could not be deleted."); } finally { setSaving(false); setDeleteArmed(false); } }
  return <div className="roles-workspace platform-roles-workspace"><aside className="role-list" aria-label="Platform roles"><div className="role-list-head"><div><p className="eyebrow">Role library</p><h2>{roles.length} platform profiles</h2></div><Shield size={20} /></div>{canCreate ? <button className="platform-new-role" onClick={() => { setSelectedId(""); setDeleteArmed(false); setEditor({ name: "", permissionKeys: ["platform.dashboard.read"], isNew: true }); }} type="button"><Plus size={15} />New custom role</button> : null}<div className="role-list-items">{roles.map((role) => <button aria-pressed={role.id === selectedId} className="role-list-item" data-selected={role.id === selectedId || undefined} key={role.id} onClick={() => selectRole(role)} type="button"><span className="role-list-icon" data-system={role.isSystem || undefined}>{role.isSystem ? <LockKeyhole size={16} /> : <Shield size={16} />}</span><span><strong>{role.name}</strong><small>{role.permissions.length} permissions · {role.assignedUsers} operators</small></span><ChevronRight size={16} /></button>)}</div></aside>
    {editor ? <form className="role-editor-panel" onSubmit={save}><header className="role-editor-head"><div><p className="eyebrow">{editor.isNew ? "New platform profile" : selected?.isSystem ? "Protected system role" : "Custom platform role"}</p><h2>{editor.isNew ? "Create a focused role" : selected?.name}</h2><p>API permissions and navigation are generated from this policy. System roles are read-only.</p></div>{editor.isNew ? <button aria-label="Cancel new role" className="icon-button" onClick={() => roles[0] && selectRole(roles[0])} type="button"><X size={18} /></button> : null}</header>{error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={() => setError("")} type="button">Dismiss</button></div> : null}<div className="role-identity-grid platform-role-identity"><label className="form-field"><span>Role name <em>*</em></span><input disabled={selected?.isSystem} required value={editor.name} onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))} /></label><div className="platform-role-level"><small>Access boundary</small><strong><ShieldCheck size={15} />Platform-wide</strong></div></div><div className="permission-heading"><div><p className="eyebrow">Capability matrix</p><h3>Platform permissions</h3></div><span>{editor.permissionKeys.length} selected</span></div><div className="permission-groups">{Object.entries(grouped).map(([module, items]) => <fieldset className="permission-group" disabled={selected?.isSystem} key={module}><legend>{module}</legend>{items.map((permission) => { const checked = editor.permissionKeys.includes(permission.key); return <label className="permission-option" data-checked={checked || undefined} key={permission.key}><input checked={checked} onChange={() => togglePermission(permission.key)} type="checkbox" /><span className="permission-check">{checked ? <Check size={13} /> : null}</span><span><strong>{permission.key.split(".").at(-1)}</strong><small>{permission.description}</small></span></label>; })}</fieldset>)}</div><footer className="role-editor-footer"><span className="role-impact"><UsersRound size={16} />{selected ? `${selected.assignedUsers} operators currently use this role` : "No operators assigned yet"}</span><div>{selected && !selected.isSystem && canDelete ? <button className={deleteArmed ? "button button-danger" : "button button-secondary"} disabled={saving} onClick={remove} type="button"><Trash2 size={15} />{deleteArmed ? "Confirm delete" : "Delete role"}</button> : null}{(editor.isNew ? canCreate : canUpdate && !selected?.isSystem) ? <button className="button button-primary" disabled={saving} type="submit"><Save size={15} />{saving ? "Saving…" : editor.isNew ? "Create role" : "Save changes"}</button> : null}</div></footer></form> : null}</div>;
}

export default function PlatformTeamPage() {
  const { accessToken, user } = useAuth(); const [tab, setTab] = useState("team"); const [roles, setRoles] = useState([]); const [permissions, setPermissions] = useState([]); const [policyLoading, setPolicyLoading] = useState(true); const [policyError, setPolicyError] = useState("");
  const canRoleRead = canUser(user, "platform", "platform.role.read"); const canAssign = canUser(user, "platform", "platform.role.assign"); const canInvite = canUser(user, "platform", "platform.user.invite"); const canManage = canUser(user, "platform", "platform.user.manage"); const canCreate = canUser(user, "platform", "platform.role.create"); const canUpdate = canUser(user, "platform", "platform.role.update"); const canDelete = canUser(user, "platform", "platform.role.delete");
  const loadPolicy = useCallback(async () => { if (!accessToken || (!canRoleRead && !canAssign && !canInvite)) { setPolicyLoading(false); return; } setPolicyLoading(true); setPolicyError("");
    try { const [roleData, permissionData] = await Promise.all([listPlatformRolesRequest(accessToken), canRoleRead ? listPlatformPermissionsRequest(accessToken) : Promise.resolve({ items: [] })]); setRoles(roleData.items || []); setPermissions(permissionData.items || []); }
    catch (requestError) { setPolicyError(requestError.message || "Platform access policies could not be loaded."); } finally { setPolicyLoading(false); } }, [accessToken, canAssign, canInvite, canRoleRead]);
  useEffect(() => { loadPolicy(); }, [loadPolicy]);
  return <AppShell area="platform" currentPath="/platform/team" eyebrow="Platform security" title="Platform team" description="Control privileged operator access with explicit roles, lifecycle approval, and audited changes."><nav aria-label="Platform access views" className="catalog-tabs platform-team-tabs"><button aria-current={tab === "team" ? "page" : undefined} className={tab === "team" ? "active" : ""} onClick={() => setTab("team")} type="button"><UsersRound size={15} />Operators</button>{canRoleRead ? <button aria-current={tab === "roles" ? "page" : undefined} className={tab === "roles" ? "active" : ""} onClick={() => setTab("roles")} type="button"><ShieldCheck size={15} />Roles & permissions</button> : null}</nav>{policyError ? <div className="inline-state inline-state-error" role="alert"><span>{policyError}</span><button onClick={loadPolicy} type="button">Try again</button></div> : null}{policyLoading ? <GlobalLoader inline label="Loading platform access policies" /> : tab === "team" ? <TeamDirectory canAssign={canAssign} canInvite={canInvite} canManage={canManage} roles={roles} /> : <RoleWorkspace canCreate={canCreate} canDelete={canDelete} canUpdate={canUpdate} permissions={permissions} reload={loadPolicy} roles={roles} />}</AppShell>;
}
