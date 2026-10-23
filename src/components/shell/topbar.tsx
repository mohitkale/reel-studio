"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Film, Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebar } from "@/components/shell/sidebar-context";
import { HintTooltip } from "@/components/ui/hint-tooltip";

function currentTitle(pathname: string) {
  const match = navItems.find((item) =>
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  return match?.title ?? "Reel Studio";
}

/** Sticky top bar: mobile menu trigger, current section title, and global actions. */
export function Topbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { collapsed, toggle } = useSidebar();

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      {/* Desktop: collapse/expand the sidebar to reclaim screen width. */}
      <HintTooltip
        label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        side="bottom"
      >
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={toggle}
        >
          <Menu />
        </Button>
      </HintTooltip>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
          >
            <Menu />
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-40 bg-black/50 md:hidden" />
          <Dialog.Content className="bg-sidebar data-[state=open]:animate-in data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex w-64 max-w-[90vw] flex-col overflow-y-auto border-r p-3 shadow-xl md:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <div className="mb-2 flex items-center gap-2 px-2 py-2">
              <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
                <Film className="size-4.5" />
              </div>
              <span className="text-sm font-semibold">Reel Studio</span>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <h1 className="text-sm font-semibold">{currentTitle(pathname)}</h1>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
