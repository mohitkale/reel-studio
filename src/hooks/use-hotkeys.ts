"use client";

import * as React from "react";

function isInputActive(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

interface HotkeyOptions {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Fire even when a text input has focus. Default false. */
  allowInInput?: boolean;
  /** Disable this hook entirely. Default false. */
  enabled?: boolean;
}

/**
 * Attach a document-level keydown listener for a single key combination.
 * By default the handler is skipped when a text input or textarea has focus.
 */
export function useHotkey(
  key: string,
  handler: () => void,
  opts?: HotkeyOptions,
) {
  const handlerRef = React.useRef(handler);
  // Sync the callback ref after render so the effect sees the latest handler
  // without re-registering the listener on every render.
  React.useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  const ctrl = opts?.ctrl;
  const meta = opts?.meta;
  const shift = opts?.shift;
  const alt = opts?.alt;
  const allowInInput = opts?.allowInInput ?? false;
  const enabled = opts?.enabled ?? true;

  React.useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (!allowInInput && isInputActive()) return;
      if (e.key !== key) return;
      if (ctrl !== undefined && e.ctrlKey !== ctrl) return;
      if (meta !== undefined && e.metaKey !== meta) return;
      if (shift !== undefined && e.shiftKey !== shift) return;
      if (alt !== undefined && e.altKey !== alt) return;
      e.preventDefault();
      handlerRef.current();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [key, ctrl, meta, shift, alt, allowInInput, enabled]);
}
