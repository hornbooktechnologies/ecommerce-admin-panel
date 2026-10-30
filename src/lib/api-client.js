const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const apiBase = apiOrigin.replace(/\/$/, "");
const authBase = "/api/admin/v1/auth";
const platformTenantBase = "/api/platform/v1/tenants";
const platformAccessBase = "/api/platform/v1/access";

export function homepageSectionsRequest(storeId, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/homepage-sections`, { accessToken, tenantId });
}
export function saveHomepageSectionsRequest(storeId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/homepage-sections`, { method: "PUT", body: input, accessToken, tenantId });
}
export function publishHomepageSectionsRequest(storeId, revision, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/homepage-sections/publish`, { method: "POST", body: { revision }, accessToken, tenantId });
}
export function previewHomepageSectionsRequest(storeId, document, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/homepage-sections/preview`, { method: "POST", body: document, accessToken, tenantId });
}

export function homepageHeroRequest(storeId, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/homepage-hero`, { accessToken, tenantId });
}
export function saveHomepageHeroRequest(storeId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/homepage-hero`, { method: "PUT", body: input, accessToken, tenantId });
}
export function publishHomepageHeroRequest(storeId, revision, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/homepage-hero/publish`, { method: "POST", body: { revision }, accessToken, tenantId });
}
export function homepageHeroProductsRequest(storeId, search, accessToken, tenantId, selectedSlug = "") {
  return request(`/api/admin/v1/stores/${storeId}/homepage-hero/products?${new URLSearchParams({ search, selectedSlug })}`, { accessToken, tenantId });
}
export function uploadHomepageHeroImageRequest(storeId, file, accessToken, tenantId) {
  return uploadFile(`/api/admin/v1/stores/${storeId}/homepage-hero/images?${new URLSearchParams({ fileName: file.name })}`, file, { accessToken, tenantId });
}

export class ApiError extends Error {
  constructor({ code, message, status, details = [] }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let managedAccessToken = null;
let refreshInFlight = null;
let sessionHandlers = { onRefresh: null, onExpired: null };

export function setApiAccessToken(accessToken) {
  managedAccessToken = accessToken || null;
}

export function setApiSessionHandlers({ onRefresh, onExpired } = {}) {
  const handlers = {
    onRefresh: typeof onRefresh === "function" ? onRefresh : null,
    onExpired: typeof onExpired === "function" ? onExpired : null
  };
  sessionHandlers = handlers;
  return () => {
    if (sessionHandlers === handlers) {
      sessionHandlers = { onRefresh: null, onExpired: null };
    }
  };
}

function responseError(payload, response, fallbackMessage) {
  return new ApiError({
    code: payload?.error?.code || "REQUEST_FAILED",
    message: payload?.error?.message || fallbackMessage,
    status: response.status,
    details: payload?.error?.details || []
  });
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${apiBase}${authBase}/refresh`, {
        method: "POST",
        credentials: "include"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw responseError(payload, response, "Your session could not be renewed.");
      }
      if (!payload?.data?.accessToken) {
        throw new ApiError({
          code: "INVALID_SESSION_RESPONSE",
          message: "Your session could not be renewed.",
          status: 500
        });
      }
      managedAccessToken = payload.data.accessToken;
      sessionHandlers.onRefresh?.(payload.data);
      return managedAccessToken;
    })()
      .catch((error) => {
        if (error?.status === 401) {
          managedAccessToken = null;
          sessionHandlers.onExpired?.();
        }
        throw error;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function mayRefresh(path, accessToken) {
  if (!accessToken) return false;
  return ![
    `${authBase}/login`, `${authBase}/refresh`, `${authBase}/logout`,
    `${authBase}/password/forgot`, `${authBase}/password/reset`
  ].includes(path);
}

async function fetchWithAuthentication(path, { method = "GET", headers = {}, body, accessToken, signal } = {}) {
  const send = (token) => fetch(`${apiBase}${path}`, {
    method,
    credentials: "include",
    signal,
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body
  });

  const sentToken = accessToken || null;
  let response = await send(sentToken);
  signal?.throwIfAborted();
  if (response.status !== 401 || !mayRefresh(path, sentToken)) return response;

  const retryToken = managedAccessToken && managedAccessToken !== sentToken
    ? managedAccessToken
    : await refreshAccessToken();
  signal?.throwIfAborted();
  response = await send(retryToken);
  signal?.throwIfAborted();
  if (response.status === 401) {
    managedAccessToken = null;
    sessionHandlers.onExpired?.();
  }
  return response;
}

async function request(path, { method = "GET", body, accessToken, tenantId, merchantId, signal } = {}) {
  const response = await fetchWithAuthentication(path, {
    method,
    accessToken,
    signal,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      ...(merchantId ? { "x-merchant-id": merchantId } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError({
      code: payload?.error?.code || "REQUEST_FAILED",
      message: payload?.error?.message || "The request could not be completed.",
      status: response.status,
      details: payload?.error?.details || []
    });
  }

  return payload?.data;
}

function inboxBase(area) {
  if (!["admin", "vendor", "platform"].includes(area)) throw new Error("Unsupported notification area");
  return `/api/${area}/v1/notifications`;
}

export function listInboxRequest(area, { filter = "ALL", page = 1, category = "ALL", search = "" } = {}, context) {
  const query = new URLSearchParams({ filter, page: String(page), pageSize: "10" });
  if (category !== "ALL") query.set("category", category);
  if (search) query.set("search", search);
  return request(`${inboxBase(area)}?${query}`, context);
}
export function inboxUnreadRequest(area, context) {
  return request(`${inboxBase(area)}/unread-count`, context);
}
export function markInboxRequest(area, notificationId, read, context) {
  return request(`${inboxBase(area)}/${encodeURIComponent(notificationId)}`, { ...context, method: "PATCH", body: { read } });
}
export function markAllInboxRequest(area, throughId, context) {
  return request(`${inboxBase(area)}/read-all`, { ...context, method: "POST", body: { throughId } });
}

async function requestFile(path, { accessToken, tenantId } = {}) {
  const response = await fetchWithAuthentication(path, { accessToken, headers: {
    ...(tenantId ? { "x-tenant-id": tenantId } : {})
  } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError({ code: payload?.error?.code || "REQUEST_FAILED",
      message: payload?.error?.message || "The file could not be downloaded.",
      status: response.status, details: payload?.error?.details || [] });
  }
  const disposition = response.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "download";
  return { blob: await response.blob(), filename };
}

async function uploadFile(path, file, { method = "POST", accessToken, tenantId } = {}) {
  const response = await fetchWithAuthentication(path, {
    method,
    accessToken,
    headers: {
      "content-type": file.type,
      ...(tenantId ? { "x-tenant-id": tenantId } : {})
    },
    body: file
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError({
      code: payload?.error?.code || "UPLOAD_FAILED",
      message: payload?.error?.message || "The image could not be uploaded.",
      status: response.status,
      details: payload?.error?.details || []
    });
  }
  return payload?.data;
}

function productMediaUploadQuery(file, input) {
  const query = new URLSearchParams({ fileName: file.name, altText: input.altText || "" });
  if (input.variantId) query.set("variantId", input.variantId);
  if (input.colorOptionId) query.set("colorOptionId", input.colorOptionId);
  return query;
}

export function listTenantUsersRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({
    search: filters.search || "", status: filters.status || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10)
  });
  return request(`/api/admin/v1/users?${query}`, { accessToken, tenantId });
}

export function dashboardOverviewRequest(accessToken, tenantId) {
  return request("/api/admin/v1/dashboard", { accessToken, tenantId });
}

export function listProductRatingsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    rating: String(filters.rating || 0), productId: filters.productId || "",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/ratings?${query}`, { accessToken, tenantId });
}

export function productRatingOptionsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/ratings/options", { accessToken, tenantId });
}

export function productRatingDetailsRequest(ratingId, accessToken, tenantId) {
  return request(`/api/admin/v1/ratings/${ratingId}`, { accessToken, tenantId });
}

export function moderateProductRatingRequest(ratingId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/ratings/${ratingId}/moderate`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

function reportQuery(filters) {
  const query = new URLSearchParams({ reportType: filters.reportType || "SALES",
    fromDate: filters.fromDate || "", toDate: filters.toDate || "",
    warehouseId: filters.warehouseId || "", merchantId: filters.merchantId || "" });
  if (filters.page) query.set("page", String(filters.page));
  if (filters.pageSize) query.set("pageSize", String(filters.pageSize));
  return query;
}

export function reportsWorkspaceRequest(filters, accessToken, tenantId) {
  return request(`/api/admin/v1/reports?${reportQuery(filters)}`, { accessToken, tenantId });
}

export function exportReportRequest(filters, accessToken, tenantId) {
  return requestFile(`/api/admin/v1/reports/export?${reportQuery(filters)}`, { accessToken, tenantId });
}

export function inviteTenantUserRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/users/invitations", { method: "POST", body: input, accessToken, tenantId });
}

export function changeTenantUserStatusRequest(userId, action, accessToken, tenantId) {
  return request(`/api/admin/v1/users/${userId}/${action}`, { method: "POST", accessToken, tenantId });
}

export function setTenantUserRolesRequest(userId, assignments, accessToken, tenantId) {
  return request(`/api/admin/v1/users/${userId}/role-assignments`, {
    method: "PUT", body: { assignments }, accessToken, tenantId
  });
}

export function listTenantRolesRequest(accessToken, tenantId) {
  return request("/api/admin/v1/roles", { accessToken, tenantId });
}

export function listPermissionsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/permissions", { accessToken, tenantId });
}

export function createTenantRoleRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/roles", { method: "POST", body: input, accessToken, tenantId });
}

export function updateTenantRoleRequest(roleId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/roles/${roleId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function deleteTenantRoleRequest(roleId, accessToken, tenantId) {
  return request(`/api/admin/v1/roles/${roleId}`, { method: "DELETE", accessToken, tenantId });
}

export function listCatalogProductsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({
    search: filters.search || "", status: filters.status || "ALL",
    vertical: filters.vertical || "ALL", page: String(filters.page || 1),
    pageSize: String(filters.pageSize || 10)
  });
  return request(`/api/admin/v1/catalog/products?${query}`, { accessToken, tenantId });
}

export function catalogLookupsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/catalog/lookups", { accessToken, tenantId });
}

export function createCatalogProductRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/catalog/products", { method: "POST", body: input, accessToken, tenantId });
}

export function getCatalogProductVariantsRequest(productId, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}/variants`, { accessToken, tenantId });
}

export function updateCatalogProductRequest(productId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function updateCatalogProductPricesRequest(productId, prices, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}/prices`, {
    method: "PUT", body: { prices }, accessToken, tenantId
  });
}

export function transitionCatalogProductRequest(productId, action, accessToken, tenantId, input) {
  return request(`/api/admin/v1/catalog/products/${productId}/${action}`, {
    method: "POST", ...(input ? { body: input } : {}), accessToken, tenantId
  });
}

export function deleteCatalogProductRequest(productId, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}`, {
    method: "DELETE", accessToken, tenantId
  });
}

export function catalogProductMediaRequest(productId, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}/media`, { accessToken, tenantId });
}

export function addCatalogProductMediaRequest(productId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}/media`, { method: "POST", body: input, accessToken, tenantId });
}

export function uploadCatalogProductMediaRequest(productId, file, input, accessToken, tenantId) {
  const query = productMediaUploadQuery(file, input);
  return uploadFile(`/api/admin/v1/catalog/products/${productId}/media/upload?${query}`, file,
    { accessToken, tenantId });
}

export function updateCatalogProductMediaRequest(productId, mediaId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}/media/${mediaId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function replaceCatalogProductMediaFileRequest(productId, mediaId, file, input, accessToken, tenantId) {
  const query = productMediaUploadQuery(file, input);
  return uploadFile(`/api/admin/v1/catalog/products/${productId}/media/${mediaId}/upload?${query}`, file,
    { method: "PUT", accessToken, tenantId });
}

export function setCatalogProductPrimaryMediaRequest(productId, mediaId, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}/media/${mediaId}/primary`, { method: "POST", accessToken, tenantId });
}

export function reorderCatalogProductMediaRequest(productId, mediaId, mediaIds, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}/media/${mediaId}/order`, {
    method: "PUT", body: { mediaIds }, accessToken, tenantId
  });
}

export function deleteCatalogProductMediaRequest(productId, mediaId, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/products/${productId}/media/${mediaId}`, { method: "DELETE", accessToken, tenantId });
}

export function listCatalogSubstitutionsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/catalog/substitutions?${query}`, { accessToken, tenantId });
}

export function listSubstitutionVariantsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", sourceOnly: String(Boolean(filters.sourceOnly)),
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 30) });
  return request(`/api/admin/v1/catalog/substitutions/variants?${query}`, { accessToken, tenantId });
}

export function createCatalogSubstitutionRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/catalog/substitutions", { method: "POST", body: input, accessToken, tenantId });
}

export function updateCatalogSubstitutionRequest(ruleId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/substitutions/${ruleId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function deleteCatalogSubstitutionRequest(ruleId, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/substitutions/${ruleId}`, { method: "DELETE", accessToken, tenantId });
}

export function listCatalogBundlesRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/catalog/bundles?${query}`, { accessToken, tenantId });
}

export function listBundleVariantsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", kind: filters.kind || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 30) });
  return request(`/api/admin/v1/catalog/bundles/variants?${query}`, { accessToken, tenantId });
}

export function createBundleComponentRequest(bundleVariantId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/bundles/${bundleVariantId}/components`, { method: "POST", body: input, accessToken, tenantId });
}

export function updateBundleComponentRequest(bundleVariantId, componentId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/bundles/${bundleVariantId}/components/${componentId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function deleteBundleComponentRequest(bundleVariantId, componentId, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/bundles/${bundleVariantId}/components/${componentId}`, { method: "DELETE", accessToken, tenantId });
}

export function listBulkImportJobsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/bulk/imports?${query}`, { accessToken, tenantId });
}

export function bulkImportJobRequest(jobId, accessToken, tenantId) {
  return request(`/api/admin/v1/bulk/imports/${jobId}`, { accessToken, tenantId });
}

export function validateBulkImportRequest(type, input, accessToken, tenantId) {
  const path = type === "PRODUCT" ? "products" : type.toLowerCase();
  return request(`/api/admin/v1/bulk/${path}/validate`, { method: "POST", body: input, accessToken, tenantId });
}

export function commitBulkImportRequest(type, jobId, accessToken, tenantId) {
  const path = type === "PRODUCT" ? "products" : type.toLowerCase();
  return request(`/api/admin/v1/bulk/${path}/imports/${jobId}/commit`, { method: "POST", accessToken, tenantId });
}

export function bulkTemplateRequest(type, accessToken, tenantId) {
  const path = type === "PRODUCT" ? "products" : type.toLowerCase();
  return requestFile(`/api/admin/v1/bulk/${path}/template`, { accessToken, tenantId });
}

export function bulkExportRequest(type, accessToken, tenantId) {
  const path = type === "PRODUCT" ? "products" : type.toLowerCase();
  return requestFile(`/api/admin/v1/bulk/${path}/export`, { accessToken, tenantId });
}

export function bulkErrorReportRequest(jobId, accessToken, tenantId) {
  return requestFile(`/api/admin/v1/bulk/imports/${jobId}/errors`, { accessToken, tenantId });
}

export function bulkProductStatusRequest(productIds, action, accessToken, tenantId) {
  return request("/api/admin/v1/bulk/products/status", { method: "POST", body: { productIds, action }, accessToken, tenantId });
}

export function bulkProductPublishRequest(productIds, accessToken, tenantId) {
  return request("/api/admin/v1/bulk/products/publish", { method: "POST", body: { productIds }, accessToken, tenantId });
}

export function listCatalogMastersRequest(masterType, filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL" });
  return request(`/api/admin/v1/catalog/masters/${masterType}?${query}`, { accessToken, tenantId });
}

export function createCatalogMasterRequest(masterType, input, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/masters/${masterType}`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function updateCatalogMasterRequest(masterType, itemId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/catalog/masters/${masterType}/${itemId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function listInventoryRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({
    search: filters.search || "", health: filters.health || "ALL",
    warehouseId: filters.warehouseId || "", page: String(filters.page || 1),
    pageSize: String(filters.pageSize || 10)
  });
  return request(`/api/admin/v1/inventory?${query}`, { accessToken, tenantId });
}

export function inventoryOptionsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/inventory/options", { accessToken, tenantId });
}

export function listInventoryLotsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({
    search: filters.search || "", health: filters.health || "ALL",
    warehouseId: filters.warehouseId || "", page: String(filters.page || 1),
    pageSize: String(filters.pageSize || 10)
  });
  return request(`/api/admin/v1/inventory/traceability/lots?${query}`, { accessToken, tenantId });
}

export function listInventorySerialsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({
    search: filters.search || "", status: filters.status || "ALL",
    warehouseId: filters.warehouseId || "", page: String(filters.page || 1),
    pageSize: String(filters.pageSize || 10)
  });
  return request(`/api/admin/v1/inventory/traceability/serials?${query}`, { accessToken, tenantId });
}

export function reconcileInventorySerialRequest(serialId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/inventory/traceability/serials/${serialId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function inventoryBalanceRequest(balanceId, accessToken, tenantId) {
  return request(`/api/admin/v1/inventory/${balanceId}`, { accessToken, tenantId });
}

export function createWarehouseRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/inventory/warehouses", {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function receiveInventoryRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/inventory/receipts", {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function adjustInventoryRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/inventory/adjustments", {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function updateInventoryPolicyRequest(balanceId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/inventory/${balanceId}/policy`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function transferInventoryRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/inventory/transfers", {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function procurementOptionsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/procurement/options", { accessToken, tenantId });
}

export function listSuppliersRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/suppliers?${query}`, { accessToken, tenantId });
}

export function createSupplierRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/suppliers", { method: "POST", body: input, accessToken, tenantId });
}

export function updateSupplierRequest(supplierId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/suppliers/${supplierId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function listPurchaseOrdersRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/purchase-orders?${query}`, { accessToken, tenantId });
}

export function purchaseOrderDetailsRequest(purchaseOrderId, accessToken, tenantId) {
  return request(`/api/admin/v1/purchase-orders/${purchaseOrderId}`, { accessToken, tenantId });
}

export function createPurchaseOrderRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/purchase-orders", { method: "POST", body: input, accessToken, tenantId });
}

export function transitionPurchaseOrderRequest(purchaseOrderId, action, accessToken, tenantId) {
  return request(`/api/admin/v1/purchase-orders/${purchaseOrderId}/${action}`,
    { method: "POST", accessToken, tenantId });
}

export function listStoresRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/stores?${query}`, { accessToken, tenantId });
}

export function storeDetailsRequest(storeId, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}`, { accessToken, tenantId });
}

export function paymentSettingsRequest(storeId, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/payments`, { accessToken, tenantId });
}
export function savePaymentSettingsRequest(storeId, body, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/payments`, { method: "PUT", body, accessToken, tenantId });
}

export function createStoreRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/stores", { method: "POST", body: input, accessToken, tenantId });
}

export function updateStoreRequest(storeId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function createStoreZoneRequest(storeId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/zones`, { method: "POST", body: input, accessToken, tenantId });
}

export function updateStoreZoneRequest(storeId, zoneId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/zones/${zoneId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function createStoreSlotRequest(storeId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/slots`, { method: "POST", body: input, accessToken, tenantId });
}

export function updateStoreSlotRequest(storeId, templateId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/slots/${templateId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function generateStoreSlotsRequest(storeId, days, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/slots/generate`, {
    method: "POST", body: { days }, accessToken, tenantId
  });
}

export function assignStoreWarehousesRequest(storeId, warehouseIds, accessToken, tenantId) {
  return request(`/api/admin/v1/stores/${storeId}/warehouses`, {
    method: "PUT", body: { warehouseIds }, accessToken, tenantId
  });
}

export function listOrdersRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({
    search: filters.search || "", status: filters.status || "ALL",
    paymentStatus: filters.paymentStatus || "ALL",
    fulfillmentStatus: filters.fulfillmentStatus || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10)
  });
  return request(`/api/admin/v1/orders?${query}`, { accessToken, tenantId });
}

export function listCustomersRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    type: filters.type || "ALL", page: String(filters.page || 1),
    pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/customers?${query}`, { accessToken, tenantId });
}

export function customerDetailsRequest(customerId, accessToken, tenantId) {
  return request(`/api/admin/v1/customers/${customerId}`, { accessToken, tenantId });
}

export function updateCustomerRequest(customerId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/customers/${customerId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function listPromotionsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    type: filters.type || "ALL", page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/promotions?${query}`, { accessToken, tenantId });
}

export function promotionOptionsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/promotions/options", { accessToken, tenantId });
}

export function promotionDetailsRequest(promotionId, accessToken, tenantId) {
  return request(`/api/admin/v1/promotions/${promotionId}`, { accessToken, tenantId });
}

export function createPromotionRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/promotions", { method: "POST", body: input, accessToken, tenantId });
}

export function updatePromotionRequest(promotionId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/promotions/${promotionId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function transitionPromotionRequest(promotionId, action, accessToken, tenantId) {
  return request(`/api/admin/v1/promotions/${promotionId}/${action}`, { method: "POST", accessToken, tenantId });
}

export function createCouponRequest(promotionId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/promotions/${promotionId}/coupons`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function updateCouponRequest(promotionId, couponId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/promotions/${promotionId}/coupons/${couponId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function previewPromotionRequest(promotionId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/promotions/${promotionId}/preview`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function orderCreationOptionsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/orders/options", { accessToken, tenantId });
}

export function createOrderRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/orders", {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function orderDetailsRequest(orderId, accessToken, tenantId) {
  return request(`/api/admin/v1/orders/${orderId}`, { accessToken, tenantId });
}

export function transitionOrderRequest(orderId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/orders/${orderId}/status`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function fulfillmentOptionsRequest(orderId, accessToken, tenantId) {
  return request(`/api/admin/v1/orders/${orderId}/fulfillment-options`, { accessToken, tenantId });
}

export function allocateFulfillmentRequest(orderId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/orders/${orderId}/fulfillments`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function transitionFulfillmentRequest(orderId, fulfillmentId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/orders/${orderId}/fulfillments/${fulfillmentId}/status`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function listReturnsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({
    search: filters.search || "", status: filters.status || "ALL", type: filters.type || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10)
  });
  return request(`/api/admin/v1/returns?${query}`, { accessToken, tenantId });
}

export function returnOptionsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/returns/options", { accessToken, tenantId });
}

export function createReturnRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/returns", { method: "POST", body: input, accessToken, tenantId });
}

export function returnDetailsRequest(returnId, accessToken, tenantId) {
  return request(`/api/admin/v1/returns/${returnId}`, { accessToken, tenantId });
}

export function transitionReturnRequest(returnId, action, input, accessToken, tenantId) {
  return request(`/api/admin/v1/returns/${returnId}/${action}`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function createExchangeRequest(returnId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/returns/${returnId}/exchanges`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function completeExchangeRequest(exchangeId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/exchanges/${exchangeId}/complete`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function listWarrantiesRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/warranties?${query}`, { accessToken, tenantId });
}

export function warrantyDetailsRequest(warrantyId, accessToken, tenantId) {
  return request(`/api/admin/v1/warranties/${warrantyId}`, { accessToken, tenantId });
}

export function warrantyOptionsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/warranties/options", { accessToken, tenantId });
}

export function listWarrantyClaimsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/warranty-claims?${query}`, { accessToken, tenantId });
}

export function warrantyClaimDetailsRequest(claimId, accessToken, tenantId) {
  return request(`/api/admin/v1/warranty-claims/${claimId}`, { accessToken, tenantId });
}

export function createWarrantyClaimRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/warranty-claims", { method: "POST", body: input, accessToken, tenantId });
}

export function transitionWarrantyClaimRequest(claimId, action, input, accessToken, tenantId) {
  return request(`/api/admin/v1/warranty-claims/${claimId}/${action}`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function listVendorsRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/vendors?${query}`, { accessToken, tenantId });
}

export function vendorOptionsRequest(variantSearch, accessToken, tenantId) {
  const query = new URLSearchParams({ variantSearch: variantSearch || "" });
  return request(`/api/admin/v1/vendors/options?${query}`, { accessToken, tenantId });
}

export function vendorDetailsRequest(vendorId, accessToken, tenantId) {
  return request(`/api/admin/v1/vendors/${vendorId}`, { accessToken, tenantId });
}

export function createVendorRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/vendors", { method: "POST", body: input, accessToken, tenantId });
}

export function updateVendorRequest(vendorId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/vendors/${vendorId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function uploadVendorLogoRequest(vendorId, file, accessToken, tenantId) {
  const query = new URLSearchParams({ fileName: file.name });
  return uploadFile(`/api/admin/v1/vendors/${vendorId}/logo?${query}`, file, {
    method: "PUT", accessToken, tenantId
  });
}

export function uploadVendorDocumentRequest(vendorId, input, file, accessToken, tenantId) {
  const query = new URLSearchParams({ fileName: file.name, documentType: input.documentType,
    documentNumber: input.documentNumber || "", expiresAt: input.expiresAt || "" });
  return uploadFile(`/api/admin/v1/vendors/${vendorId}/documents/upload?${query}`, file, {
    method: "POST", accessToken, tenantId
  });
}

export function downloadVendorDocumentRequest(vendorId, documentId, accessToken, tenantId) {
  return requestFile(`/api/admin/v1/vendors/${vendorId}/documents/${documentId}/file`, {
    accessToken, tenantId
  });
}

export function decideVendorDocumentRequest(vendorId, documentId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/vendors/${vendorId}/documents/${documentId}/decision`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function transitionVendorRequest(vendorId, action, notes, accessToken, tenantId) {
  return request(`/api/admin/v1/vendors/${vendorId}/${action}`, {
    method: "POST", body: { notes }, accessToken, tenantId
  });
}

export function createVendorOfferRequest(vendorId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/vendors/${vendorId}/offers`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function updateVendorOfferRequest(vendorId, offerId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/vendors/${vendorId}/offers/${offerId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function listSellerOffersRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    merchantType: filters.merchantType || "ALL", storeId: filters.storeId || "",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10) });
  return request(`/api/admin/v1/offers?${query}`, { accessToken, tenantId });
}

export function sellerOfferOptionsRequest(variantSearch, accessToken, tenantId) {
  const query = new URLSearchParams({ variantSearch: variantSearch || "" });
  return request(`/api/admin/v1/offers/options?${query}`, { accessToken, tenantId });
}

export function sellerOfferDetailsRequest(offerId, accessToken, tenantId) {
  return request(`/api/admin/v1/offers/${offerId}`, { accessToken, tenantId });
}

export function createSellerOfferRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/offers", { method: "POST", body: input, accessToken, tenantId });
}

export function updateSellerOfferRequest(offerId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/offers/${offerId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function listPriceListsRequest(accessToken, tenantId) {
  return request("/api/admin/v1/price-lists", { accessToken, tenantId });
}

export function createPriceListRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/price-lists", { method: "POST", body: input, accessToken, tenantId });
}

export function updatePriceListRequest(priceListId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/price-lists/${priceListId}`, { method: "PATCH", body: input, accessToken, tenantId });
}

export function taxWorkspaceRequest(accessToken, tenantId) {
  return request("/api/admin/v1/taxes", { accessToken, tenantId });
}

export function createGstRegistrationRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/taxes/registrations", {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function updateGstRegistrationRequest(registrationId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/taxes/registrations/${registrationId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function createTaxCategoryRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/taxes/categories", {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function updateTaxCategoryRequest(categoryId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/taxes/categories/${categoryId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function createTaxRateRequest(categoryId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/taxes/categories/${categoryId}/rates`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function updateTaxRateRequest(rateId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/taxes/rates/${rateId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function createInvoiceSeriesRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/taxes/invoice-series", {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function updateInvoiceSeriesRequest(seriesId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/taxes/invoice-series/${seriesId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function issueTaxInvoiceRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/taxes/documents", {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function getTaxDocumentRequest(documentId, accessToken, tenantId) {
  return request(`/api/admin/v1/taxes/documents/${documentId}`, { accessToken, tenantId });
}

export function getTaxDocumentPdfRequest(documentId, accessToken, tenantId, disposition = "attachment") {
  const query = new URLSearchParams({ disposition });
  return requestFile(`/api/admin/v1/taxes/documents/${documentId}/pdf?${query}`, { accessToken, tenantId });
}

export function inviteVendorUserRequest(vendorId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/vendors/${vendorId}/invitations`, {
    method: "POST", body: input, accessToken, tenantId
  });
}

export function vendorWorkspaceRequest(accessToken, tenantId, merchantId) {
  return request("/api/vendor/v1/workspace", { accessToken, tenantId, merchantId });
}

export function marketplaceFinanceRequest(filters, accessToken, tenantId) {
  const query = new URLSearchParams({
    search: filters.search || "", merchantId: filters.merchantId || "",
    entryType: filters.entryType || "ALL", settlementStatus: filters.settlementStatus || "ALL",
    page: String(filters.page || 1), pageSize: String(filters.pageSize || 10)
  });
  return request(`/api/admin/v1/finance?${query}`, { accessToken, tenantId });
}

export function createCommissionRuleRequest(input, accessToken, tenantId) {
  return request("/api/admin/v1/finance/commission-rules", { method: "POST", body: input, accessToken, tenantId });
}

export function updateCommissionRuleRequest(ruleId, input, accessToken, tenantId) {
  return request(`/api/admin/v1/finance/commission-rules/${ruleId}`, {
    method: "PATCH", body: input, accessToken, tenantId
  });
}

export function reconcileMarketplaceLedgerRequest(accessToken, tenantId) {
  return request("/api/admin/v1/finance/ledger/reconcile", { method: "POST", accessToken, tenantId });
}

export function updateOwnVendorProfileRequest(input, accessToken, tenantId, merchantId) {
  return request("/api/vendor/v1/profile", { method: "PATCH", body: input, accessToken, tenantId, merchantId });
}

export function updateOwnVendorOfferRequest(offerId, input, accessToken, tenantId, merchantId) {
  return request(`/api/vendor/v1/offers/${offerId}`, {
    method: "PATCH", body: input, accessToken, tenantId, merchantId
  });
}

export function listVendorOrdersRequest(filters, accessToken, tenantId, merchantId) {
  const query = new URLSearchParams({ search: filters.search || "", status: filters.status || "ALL",
    fulfillmentStatus: filters.fulfillmentStatus || "ALL", page: String(filters.page || 1),
    pageSize: String(filters.pageSize || 10) });
  return request(`/api/vendor/v1/orders?${query}`, { accessToken, tenantId, merchantId });
}

export function vendorOrderDetailsRequest(sellerOrderId, accessToken, tenantId, merchantId) {
  return request(`/api/vendor/v1/orders/${sellerOrderId}`, { accessToken, tenantId, merchantId });
}

export function decideVendorOrderRequest(sellerOrderId, input, accessToken, tenantId, merchantId) {
  return request(`/api/vendor/v1/orders/${sellerOrderId}/decision`, {
    method: "POST", body: input, accessToken, tenantId, merchantId
  });
}

export function vendorFulfillmentOptionsRequest(sellerOrderId, accessToken, tenantId, merchantId) {
  return request(`/api/vendor/v1/orders/${sellerOrderId}/fulfillment-options`, {
    accessToken, tenantId, merchantId
  });
}

export function allocateVendorFulfillmentRequest(sellerOrderId, input, accessToken, tenantId, merchantId) {
  return request(`/api/vendor/v1/orders/${sellerOrderId}/fulfillments`, {
    method: "POST", body: input, accessToken, tenantId, merchantId
  });
}

export function transitionVendorFulfillmentRequest(sellerOrderId, fulfillmentId,
  input, accessToken, tenantId, merchantId) {
  return request(`/api/vendor/v1/orders/${sellerOrderId}/fulfillments/${fulfillmentId}/status`, {
    method: "PATCH", body: input, accessToken, tenantId, merchantId
  });
}

export function loginRequest(input) {
  return request(`${authBase}/login`, { method: "POST", body: input });
}

export function forgotPasswordRequest(email) {
  return request(`${authBase}/password/forgot`, { method: "POST", body: { email } });
}

export function resetPasswordRequest(input) {
  return request(`${authBase}/password/reset`, { method: "POST", body: input });
}

export function changePasswordRequest(input, accessToken) {
  return request(`${authBase}/password`, { method: "PATCH", body: input, accessToken });
}

export function refreshRequest() {
  return request(`${authBase}/refresh`, { method: "POST" });
}

export function logoutRequest() {
  return request(`${authBase}/logout`, { method: "POST" });
}

export function currentUserRequest(accessToken) {
  return request(`${authBase}/me`, { accessToken });
}

export function listPlatformTenantsRequest({ search = "", status = "ALL", page = 1, pageSize = 10 }, accessToken) {
  const query = new URLSearchParams({ search, status, page: String(page), pageSize: String(pageSize) });
  return request(`${platformTenantBase}?${query}`, { accessToken });
}

export function createPlatformTenantRequest(input, accessToken) {
  return request(platformTenantBase, { method: "POST", body: input, accessToken });
}

export function getPlatformTenantRequest(tenantId, accessToken) {
  return request(`${platformTenantBase}/${tenantId}`, { accessToken });
}

export function updatePlatformTenantRequest(tenantId, input, accessToken) {
  return request(`${platformTenantBase}/${tenantId}`, { method: "PATCH", body: input, accessToken });
}

export function transitionPlatformTenantRequest(tenantId, action, reason, accessToken) {
  return request(`${platformTenantBase}/${tenantId}/${action}`, {
    method: "POST",
    body: { reason },
    accessToken
  });
}

export function listPlatformUsersRequest({ search = "", status = "ALL", page = 1, pageSize = 10 }, accessToken) {
  const query = new URLSearchParams({ search, status, page: String(page), pageSize: String(pageSize) });
  return request(`${platformAccessBase}/users?${query}`, { accessToken });
}

export function invitePlatformUserRequest(input, accessToken) {
  return request(`${platformAccessBase}/users/invitations`, { method: "POST", body: input, accessToken });
}

export function changePlatformUserStatusRequest(userId, action, accessToken) {
  return request(`${platformAccessBase}/users/${userId}/${action}`, { method: "POST", accessToken });
}

export function setPlatformUserRolesRequest(userId, roleIds, accessToken) {
  return request(`${platformAccessBase}/users/${userId}/role-assignments`, {
    method: "PUT", body: { roleIds }, accessToken
  });
}

export function listPlatformRolesRequest(accessToken) {
  return request(`${platformAccessBase}/roles`, { accessToken });
}

export function listPlatformPermissionsRequest(accessToken) {
  return request(`${platformAccessBase}/permissions`, { accessToken });
}

export function createPlatformRoleRequest(input, accessToken) {
  return request(`${platformAccessBase}/roles`, { method: "POST", body: input, accessToken });
}

export function updatePlatformRoleRequest(roleId, input, accessToken) {
  return request(`${platformAccessBase}/roles/${roleId}`, { method: "PATCH", body: input, accessToken });
}

export function deletePlatformRoleRequest(roleId, accessToken) {
  return request(`${platformAccessBase}/roles/${roleId}`, { method: "DELETE", accessToken });
}

export function listNotificationDeliveriesRequest(filters, context) {
  return request(`/api/platform/v1/notification-deliveries?${new URLSearchParams(filters)}`, context);
}

export function retryNotificationDeliveryRequest(eventId, input, context) {
  return request(`/api/platform/v1/notification-deliveries/${encodeURIComponent(eventId)}/retry`, {
    ...context, method: "POST", body: input
  });
}

export function notificationDeliveryHealthRequest(context) {
  return request("/api/platform/v1/notification-deliveries/health", context);
}

export function notificationDeliveryHistoryRequest(eventId, pagination, context) {
  return request(`/api/platform/v1/notification-deliveries/${encodeURIComponent(eventId)}/history?${new URLSearchParams(pagination)}`, context);
}
