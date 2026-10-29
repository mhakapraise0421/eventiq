"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export type DismissReason = "outside" | "escape" | "route";

interface DismissableOptions {
  open: boolean;
  onClose: (reason: DismissReason) => void;
  /** Wrapper that contains the trigger and the panel. Presses inside it stay open. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Extra element treated as part of the trigger when it sits outside the container. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Called after Escape dismisses, so the caller can return focus to its trigger. */
  restoreFocus?: () => void;
  /** Close when the Next.js route changes. Defaults to true. */
  closeOnRouteChange?: boolean;
}

/**
 * Shared dismissal behavior for menus, dropdowns and floating panels.
 * Handles outside pointer presses, Escape and client-side navigation, and
 * removes every listener when the panel closes or the component unmounts.
 */
export function useDismissable({
  open,
  onClose,
  containerRef,
  triggerRef,
  restoreFocus,
  closeOnRouteChange = true,
}: DismissableOptions) {
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  const onCloseRef = useRef(onClose);
  const restoreRef = useRef(restoreFocus);
  onCloseRef.current = onClose;
  restoreRef.current = restoreFocus;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onCloseRef.current("outside");
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, containerRef, triggerRef]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onCloseRef.current("escape");
      restoreRef.current?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    if (closeOnRouteChange && open) onCloseRef.current("route");
  }, [pathname, open, closeOnRouteChange]);
}
