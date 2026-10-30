"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { notificationTarget } from "@/lib/inbox-navigation";

function Target({ tenantId, merchantId, onOpen }) {
  const params = useSearchParams();
  const openRef = useRef(onOpen);
  const seen = useRef(null);
  useEffect(() => { openRef.current = onOpen; }, [onOpen]);
  useEffect(() => {
    const id = notificationTarget(params, tenantId, merchantId);
    if (!id) { seen.current = null; return; }
    if (seen.current === `${tenantId}:${merchantId}:${id}`) return;
    seen.current = `${tenantId}:${merchantId}:${id}`;
    openRef.current(id);
    // Consume the link so refresh/back does not reopen a dismissed dialog.
    const url = new URL(window.location.href);
    for (const key of ["notificationTarget", "notificationTenant", "notificationMerchant"]) url.searchParams.delete(key);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [params, tenantId, merchantId]);
  return null;
}

export function NotificationTarget(props) {
  return <Suspense fallback={null}><Target {...props} /></Suspense>;
}
