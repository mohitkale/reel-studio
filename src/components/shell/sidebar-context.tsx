"use client";

import * as React from "react";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

/**
 * Holds the desktop sidebar collapsed/expanded state. Lives at the layout root
 * so it survives client-side navigation. In-memory (resets on hard reload),
 * which keeps it SSR-safe with no hydration mismatch. Defaults to collapsed so
 * editing surfaces get the full width; the topbar toggle expands it.
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(true);
  const toggle = React.useCallback(() => setCollapsed((c) => !c), []);
  const value = React.useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}
