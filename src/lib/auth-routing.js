export function homeForUser(user) {
  const area = user?.defaultArea || user?.areas?.[0];
  if (area === "platform") {
    return "/platform";
  }
  if (area === "vendor") {
    return "/vendor";
  }
  return "/admin";
}

export function canAccessArea(user, area) {
  return Boolean(user?.areas?.includes(area));
}

export function assignmentsForArea(user, area) {
  const level = { platform: "PLATFORM", admin: "TENANT", vendor: "VENDOR" }[area];
  return (user?.assignments || []).filter((assignment) => assignment.roleLevel === level);
}

export function tenantIdForUser(user, area = "admin", preferredTenantId = null) {
  const assignments = assignmentsForArea(user, area);
  if (preferredTenantId && assignments.some((assignment) => assignment.tenantId === preferredTenantId)) {
    return preferredTenantId;
  }
  return assignments.find((assignment) => assignment.tenantId)?.tenantId || null;
}

export function merchantIdForUser(user, tenantId = null) {
  return assignmentsForArea(user, "vendor")
    .find((assignment) => assignment.scopeType === "MERCHANT"
      && (!tenantId || assignment.tenantId === tenantId))?.scopeId || null;
}

export function canUser(user, area, permission, tenantId = null) {
  if (!permission) return true;
  const configured = user?.ui?.capabilities?.[area];
  const capabilities = Array.isArray(configured)
    ? configured
    : tenantId ? configured?.[tenantId] : null;
  if (Array.isArray(capabilities)) {
    return capabilities.includes("*") || capabilities.includes(permission);
  }
  const assignments = assignmentsForArea(user, area)
    .filter((assignment) => !tenantId || assignment.tenantId === tenantId);
  if (area === "platform" && assignments.some((assignment) => assignment.roleKey === "platform_super_admin")) {
    return true;
  }
  return assignments.some((assignment) => assignment.permissions?.includes(permission));
}

export function navigationForUser(user, area, tenantId = null) {
  const configured = user?.ui?.navigation?.[area];
  if (Array.isArray(configured)) return configured;
  return tenantId && configured ? configured[tenantId] || [] : [];
}
