"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, LockKeyhole, Plus, Save, Shield, Trash2, UsersRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { GlobalLoader } from "@/components/global-loader";
import { tenantIdForUser } from "@/lib/auth-routing";
import {
  createTenantRoleRequest,
  deleteTenantRoleRequest,
  listPermissionsRequest,
  listTenantRolesRequest,
  updateTenantRoleRequest
} from "@/lib/api-client";

function groupPermissions(permissions) {
  return permissions.reduce((groups, permission) => {
    const group = groups[permission.module] || [];
    group.push(permission);
    groups[permission.module] = group;
    return groups;
  }, {});
}

export default function RolesPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);

  const load = useCallback(async (preferredId) => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError("");
    try {
      const [roleData, permissionData] = await Promise.all([
        listTenantRolesRequest(accessToken, tenantId),
        listPermissionsRequest(accessToken, tenantId)
      ]);
      const nextRoles = roleData.items || [];
      setRoles(nextRoles);
      setPermissions(permissionData.items || []);
      const nextId = preferredId || selectedId || nextRoles[0]?.id || "";
      const selected = nextRoles.find((role) => role.id === nextId) || nextRoles[0];
      if (selected) {
        setSelectedId(selected.id);
        setEditor({ name: selected.name, level: selected.level, permissionKeys: selected.permissions, isNew: false });
      }
    } catch (requestError) {
      setError(requestError.message || "Roles and permissions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, selectedId]);

  useEffect(() => { load(); }, [accessToken, tenantId]);

  const grouped = useMemo(() => groupPermissions(permissions), [permissions]);
  const selectedRole = roles.find((role) => role.id === selectedId);

  function selectRole(role) {
    setSelectedId(role.id);
    setEditor({ name: role.name, level: role.level, permissionKeys: [...role.permissions], isNew: false });
    setDeleteArmed(false);
    setError("");
  }

  function createDraft() {
    setSelectedId("");
    setDeleteArmed(false);
    setEditor({ name: "", level: "TENANT", permissionKeys: ["dashboard.read"], isNew: true });
  }

  function togglePermission(key) {
    setEditor((current) => ({
      ...current,
      permissionKeys: current.permissionKeys.includes(key)
        ? current.permissionKeys.filter((permission) => permission !== key)
        : [...current.permissionKeys, key]
    }));
  }

  async function save(event) {
    event.preventDefault();
    if (!editor.permissionKeys.length) {
      setError("Select at least one permission for this role.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = editor.isNew
        ? await createTenantRoleRequest({ name: editor.name, level: editor.level, permissionKeys: editor.permissionKeys }, accessToken, tenantId)
        : await updateTenantRoleRequest(selectedId, { name: editor.name, permissionKeys: editor.permissionKeys }, accessToken, tenantId);
      await load(data.role.id);
    } catch (requestError) {
      setError(requestError.message || "The role could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRole() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await deleteTenantRoleRequest(selectedId, accessToken, tenantId);
      setSelectedId("");
      setEditor(null);
      setDeleteArmed(false);
      await load();
    } catch (requestError) {
      setError(requestError.message || "The role could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      action={<button className="button button-primary" onClick={createDraft} type="button"><Plus size={16} aria-hidden="true" />New custom role</button>}
      area="admin" currentPath="/admin/settings/roles" eyebrow="Access control" title="Roles & permissions"
      description="Build least-privilege access profiles for tenant and marketplace teams."
    >
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={() => setError("")} type="button">Dismiss</button></div> : null}
      {loading ? <GlobalLoader inline label="Loading access policies" /> : (
        <div className="roles-workspace">
          <aside className="role-list" aria-label="Tenant roles">
            <div className="role-list-head"><div><p className="eyebrow">Role library</p><h2>{roles.length} access profiles</h2></div><Shield size={20} aria-hidden="true" /></div>
            <div className="role-list-items">
              {roles.map((role) => (
                <button aria-pressed={role.id === selectedId} className="role-list-item" data-selected={role.id === selectedId || undefined} key={role.id} onClick={() => selectRole(role)} type="button">
                  <span className="role-list-icon" data-system={role.isSystem || undefined}>{role.isSystem ? <LockKeyhole size={16} aria-hidden="true" /> : <Shield size={16} aria-hidden="true" />}</span>
                  <span><strong>{role.name}</strong><small>{role.permissions.length} permissions · {role.assignedUsers} members</small></span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          </aside>

          {editor ? (
            <form className="role-editor-panel" onSubmit={save}>
              <header className="role-editor-head">
                <div><p className="eyebrow">{editor.isNew ? "New access profile" : selectedRole?.isSystem ? "System role" : "Custom role"}</p><h2>{editor.isNew ? "Create a focused role" : selectedRole?.name}</h2><p>Permissions are enforced by the API and reflected in application navigation.</p></div>
                {editor.isNew ? <button aria-label="Cancel new role" className="icon-button" onClick={() => roles[0] && selectRole(roles[0])} type="button"><X size={18} /></button> : null}
              </header>

              <div className="role-identity-grid">
                <label className="form-field"><span>Role name <em>*</em></span><input required value={editor.name} onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))} /></label>
                <label className="form-field"><span>Role level</span><select disabled={!editor.isNew} value={editor.level} onChange={(event) => setEditor((current) => ({ ...current, level: event.target.value }))}><option value="TENANT">Tenant staff</option><option value="VENDOR">Vendor staff</option></select></label>
              </div>

              <div className="permission-heading"><div><p className="eyebrow">Capability matrix</p><h3>Permissions</h3></div><span>{editor.permissionKeys.length} selected</span></div>
              <div className="permission-groups">
                {Object.entries(grouped).map(([module, items]) => (
                  <fieldset className="permission-group" key={module}>
                    <legend>{module}</legend>
                    {items.map((permission) => {
                      const checked = editor.permissionKeys.includes(permission.key);
                      return <label className="permission-option" data-checked={checked || undefined} key={permission.key}><input checked={checked} onChange={() => togglePermission(permission.key)} type="checkbox" /><span className="permission-check">{checked ? <Check size={13} aria-hidden="true" /> : null}</span><span><strong>{permission.key.split(".").at(-1).replaceAll("-", " ")}</strong><small>{permission.description}</small></span></label>;
                    })}
                  </fieldset>
                ))}
              </div>

              <footer className="role-editor-footer">
                <span className="role-impact"><UsersRound size={16} aria-hidden="true" />{selectedRole ? `${selectedRole.assignedUsers} members currently use this role` : "No members assigned yet"}</span>
                <div>
                  {selectedRole && !selectedRole.isSystem ? <button className={deleteArmed ? "button button-danger" : "button button-secondary"} disabled={saving} onClick={removeRole} type="button"><Trash2 size={15} aria-hidden="true" />{deleteArmed ? "Confirm delete" : "Delete role"}</button> : null}
                  <button className="button button-primary" disabled={saving} type="submit"><Save size={15} aria-hidden="true" />{saving ? "Saving…" : editor.isNew ? "Create role" : "Save changes"}</button>
                </div>
              </footer>
            </form>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
