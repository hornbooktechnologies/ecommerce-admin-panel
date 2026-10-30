"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";
import styles from "./unsaved-changes.module.css";

function LeaveConfirmation({ title, description, discardLabel, onKeep, onDiscard }) {
  const id = useId(), dialogRef = useRef(null), keepRef = useRef(null);
  const timer = useRef(null), leaving = useRef(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current, previous = document.activeElement;
    dialog.showModal(); keepRef.current?.focus();
    return () => {
      clearTimeout(timer.current); dialog.close();
      if (previous?.isConnected && !previous.closest?.("[inert]")) previous.focus?.();
    };
  }, []);
  function finish(action) {
    if (leaving.current) return;
    leaving.current = true; setClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 150;
    timer.current = window.setTimeout(action, delay);
  }
  return createPortal(<dialog ref={dialogRef} className={styles.dialog} data-closing={closing || undefined}
    role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); finish(onKeep); }}
    onKeyDown={event => {
      // Do not let the parent product form's React focus trap handle this portal.
      event.stopPropagation();
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled)")];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className={styles.body}><span className={styles.icon}><TriangleAlert size={23} aria-hidden="true" /></span>
      <h2 id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{description}</p></div>
    <footer className={styles.actions}>
      <button ref={keepRef} type="button" className="button button-primary" aria-disabled={closing || undefined} onClick={() => finish(onKeep)}>Keep editing</button>
      <button type="button" className="button button-danger" aria-disabled={closing || undefined} onClick={() => finish(onDiscard)}>{discardLabel}</button>
    </footer>
  </dialog>, document.body);
}

// Guards explicit form dismissal and browser unload, not arbitrary app navigation.
export function useUnsavedChanges({ dirty, busy, onLeave,
  title = "Discard unsaved changes?",
  description = "Your unsaved changes and selected files will be lost. Anything already saved will remain unchanged.",
  discardLabel = "Discard changes" }) {
  const [confirming, setConfirming] = useState(false);
  const requestClose = useCallback(() => {
    if (busy || confirming) return;
    if (dirty) setConfirming(true);
    else onLeave();
  }, [busy, confirming, dirty, onLeave]);

  useEffect(() => {
    function escape(event) {
      if (event.key !== "Escape" || confirming) return;
      event.preventDefault(); event.stopImmediatePropagation(); requestClose();
    }
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [confirming, requestClose]);
  useEffect(() => {
    if (!dirty && !busy) return;
    function beforeUnload(event) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, busy]);

  return { requestClose, confirmation: confirming ? <LeaveConfirmation title={title} description={description}
    discardLabel={discardLabel} onKeep={() => setConfirming(false)} onDiscard={() => {
      if (busy) return;
      setConfirming(false); onLeave();
    }} /> : null };
}
