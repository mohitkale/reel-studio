"use client";

import * as React from "react";

import { useHotkey } from "@/hooks/use-hotkeys";
import { ShortcutsDialog } from "@/components/ui/shortcuts-dialog";

export function GlobalHotkeys() {
  const [open, setOpen] = React.useState(false);
  useHotkey("?", () => setOpen((v) => !v));
  return <ShortcutsDialog open={open} onOpenChange={setOpen} />;
}
