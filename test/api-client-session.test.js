import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardOverviewRequest, setApiAccessToken, setApiSessionHandlers
} from "../src/lib/api-client.js";

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("concurrent expired requests share one refresh and retry with the renewed token", async (context) => {
  const originalFetch = globalThis.fetch;
  let refreshCalls = 0;
  let refreshedSession = null;
  const requests = [];

  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), authorization: options.headers?.authorization });
    if (String(url).endsWith("/api/admin/v1/auth/refresh")) {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return jsonResponse(200, { data: { accessToken: "renewed-token", user: { id: "user-1" } } });
    }
    if (options.headers?.authorization === "Bearer renewed-token") {
      return jsonResponse(200, { data: { ready: true } });
    }
    return jsonResponse(401, { error: { code: "AUTHENTICATION_REQUIRED", message: "Expired" } });
  };

  setApiAccessToken("expired-token");
  const removeHandlers = setApiSessionHandlers({ onRefresh: (data) => { refreshedSession = data; } });
  context.after(() => {
    globalThis.fetch = originalFetch;
    setApiAccessToken(null);
    removeHandlers();
  });

  const results = await Promise.all([
    dashboardOverviewRequest("expired-token", "tenant-1"),
    dashboardOverviewRequest("expired-token", "tenant-1")
  ]);

  assert.deepEqual(results, [{ ready: true }, { ready: true }]);
  assert.equal(refreshCalls, 1);
  assert.equal(refreshedSession.accessToken, "renewed-token");
  assert.equal(requests.filter((entry) => entry.authorization === "Bearer renewed-token").length, 2);
});
