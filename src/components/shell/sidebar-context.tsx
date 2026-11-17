"use client";

import * as React from "react";

import { useUiMode } from "@/hooks/ui-mode";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

/**
 * Holds the desktop sidebar collapsed/expanded state. Lives at the layout root
 * so it survives client-side navigation. In-memory (resets on hard reload),
 * which keeps it SSR-safe with no hydration mismatch. Simple mode defaults to
 * expanded so every destination shows its label (roadmap U5); Pro keeps the icon
 * rail so editing surfaces get the full width. The topbar toggle overrides both.
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const { mode, ready } = useUiMode();
  const [chosen, setChosen] = React.useState<boolean | null>(null);
  const collapsed = chosen ?? !(ready && mode === "simple");
  const toggle = React.useCallback(() => setChosen(!collapsed), [collapsed]);
  const value = React.useMemo(
    () => ({ collapsed, toggle }),
    [collapsed, toggle],
  );
  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}
