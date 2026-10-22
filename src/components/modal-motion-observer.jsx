"use client";

import { useEffect } from "react";

const MODAL_BACKDROP_SELECTOR = '[class*="dialog-backdrop"]';
const EXIT_FALLBACK_MS = 220;

function collectRemovedModals(node) {
  if (!(node instanceof Element)) return [];

  const modals = [];
  if (node.matches(MODAL_BACKDROP_SELECTOR)) modals.push(node);
  modals.push(...node.querySelectorAll(MODAL_BACKDROP_SELECTOR));
  return modals;
}

/**
 * Keeps a detached modal in a non-interactive presentation layer just long
 * enough to finish its exit animation. This provides consistent close motion
 * without coupling every feature dialog to a separate animation state.
 */
export function ModalMotionObserver() {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const exitTimers = new Set();

    const observer = new MutationObserver((records) => {
      if (reducedMotion.matches) return;

      records.forEach((record) => {
        record.removedNodes.forEach((node) => {
          collectRemovedModals(node).forEach((modal) => {
            if (modal.dataset.modalExiting !== undefined || modal.isConnected) return;

            modal.dataset.modalExiting = "";
            modal.setAttribute("aria-hidden", "true");
            modal.inert = true;
            document.body.appendChild(modal);

            let timer;
            const removeModal = () => {
              if (!modal.isConnected) return;
              modal.remove();
              if (timer) {
                window.clearTimeout(timer);
                exitTimers.delete(timer);
              }
            };
            const finishOnBackdrop = (event) => {
              if (event.target === modal && event.animationName === "commerce-modal-scrim-out") {
                modal.removeEventListener("animationend", finishOnBackdrop);
                removeModal();
              }
            };

            modal.addEventListener("animationend", finishOnBackdrop);
            timer = window.setTimeout(removeModal, EXIT_FALLBACK_MS);
            exitTimers.add(timer);
          });
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      exitTimers.forEach((timer) => window.clearTimeout(timer));
      document.querySelectorAll(`${MODAL_BACKDROP_SELECTOR}[data-modal-exiting]`).forEach((modal) => modal.remove());
    };
  }, []);

  return null;
}
