"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import styles from "./commerce-background.module.css";

/** Decorative, twenty-second example workflow; never represents live orders. */
export function CommerceBackground({ paused = false }) {
  const id = useId().replaceAll(":", "");
  const [hidden, setHidden] = useState(false);
  const [staticView, setStaticView] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = navigator.connection;
    const visibility = () => setHidden(document.hidden);
    const preferences = () => setStaticView(preference.matches || Boolean(connection?.saveData));
    visibility(); preferences();
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", preferences);
    connection?.addEventListener?.("change", preferences);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", preferences);
      connection?.removeEventListener?.("change", preferences);
    };
  }, []);
  return <div className={styles.backdrop} aria-hidden="true" data-paused={paused || hidden || staticView || undefined} data-static={staticView || undefined}>
    <div className={styles.floor} />
    <div className={styles.view}>
      <div className={styles.world}>
        <div className={styles.camera}>
          <svg className={styles.routeMap} viewBox="0 0 1200 800" fill="none">
            <defs><linearGradient id={`${id}-route`}><stop stopColor="var(--icon-teal)" /><stop offset=".5" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--icon-warm)" /></linearGradient></defs>
            <path className={styles.routeBase} d="M258 626H345Q370 626 394 609L416 594H744L790 578H1125" />
            <path className={styles.routeFlow} d="M258 626H345Q370 626 394 609L416 594H744L790 578H1125" stroke={`url(#${id}-route)`} pathLength="100" />

          </svg>

          <div className={styles.warehouse}>
            <Image src="/images/commerce/warehouse-realistic-v1.webp" alt="" width={960} height={960} unoptimized draggable={false} />
          </div>

          <div className={styles.order}>
            <svg viewBox="0 0 210 280" fill="none">
              <defs><linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffffff" /><stop offset="1" stopColor="#dedfd9" /></linearGradient></defs>
              <path d="M12 8H171L198 36V257L183 269L168 257L153 269L138 257L123 269L108 257L93 269L78 257L63 269L48 257L33 269L12 257Z" fill={`url(#${id}-paper)`} stroke="#b9c0b9" />
              <path d="M171 8V36H198" fill="#c5d3c9" />
              <rect x="30" y="31" width="28" height="30" rx="5" fill="#277259" />
              <path d="M36 42H52V54H36ZM40 42V38H48V42" stroke="#e4f4e9" strokeWidth="1.5" />
              <path d="M73 38H153M73 51H128M30 84H175" stroke="#9daaa0" strokeWidth="3" />
              {[108,130,152].map(y => <g key={y}><path d={`M30 ${y}H120M147 ${y}H175`} stroke="#7f9184" strokeWidth="4" /></g>)}
              <path d="M30 178H175" stroke="#a4b0a6" />
              {Array.from({ length: 24 },(_, index) => <rect key={index} x={31 + index * 5.8} y={200} width={index % 3 === 0 ? 3 : 1.5} height={index % 4 === 0 ? 29 : 25} fill="#48564d" />)}
            </svg>
          </div>

          <div className={styles.parcel}>
            <div className={styles.contactShadow} />
            <div className={styles.parcelBody}>
              <Image src="/images/commerce/parcel-realistic-v1.webp" alt="" width={960} height={960} unoptimized draggable={false} className={styles.parcelImage} />
              <span className={styles.scan}><i /></span>
            </div>
          </div>

          <svg className={styles.conveyor} viewBox="0 0 560 96" fill="none">
            <path d="M18 20H540L520 75H0Z" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
            <path d="M22 13H546M0 82H520" stroke="currentColor" strokeWidth="3" />
            {Array.from({ length: 17 },(_,index) => <path key={index} d={`M${32 + index * 30} 25L${17 + index * 30} 68`} stroke="currentColor" strokeWidth="2" />)}
            <path d="M52 82V96M466 82V96" stroke="currentColor" strokeWidth="5" />
          </svg>

          <svg className={styles.loadingBridge} viewBox="0 0 100 24" fill="none">
            <path d="M0 22H16L82 8H100M0 18H16L82 4H100" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 22V24M82 8V24" stroke="currentColor" strokeWidth="2" />
          </svg>

          <div className={styles.truck}>
            <Image src="/images/commerce/delivery-truck-realistic-v1.webp" alt="" width={960} height={640} unoptimized draggable={false} />
          </div>

          <div className={styles.delivered}>
            <svg viewBox="0 0 170 200" fill="none">
              <path d="M16 74L83 18L150 74V183H16Z" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
              <path d="M6 77L83 12L160 77M69 117H106V183M35 95H55V116H35Z" stroke="currentColor" strokeWidth="2" />
              <path d="M112 146L140 131L166 146V178L138 194L112 178Z" fill="var(--icon-warm-soft)" stroke="currentColor" strokeWidth="2" />
              <path d="M112 146L138 162L166 146M138 162V194" stroke="currentColor" />
              <path d="M53 52L71 70L105 34" stroke="var(--positive)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className={styles.labels}>
            <span className={styles.labelOrder}>01 / Order received</span>
            <span className={styles.labelPacking}>02 / Pick &amp; pack</span>
            <span className={styles.labelDispatch}>03 / Out for delivery</span>
            <span className={styles.labelDelivered}>04 / Delivered</span>
          </div>
        </div>
      </div>
    </div>
  </div>;
}
