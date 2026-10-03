"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film } from "lucide-react";

import { APP_VERSION } from "@/lib/app-version";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav";
import { useSidebar } from "@/components/shell/sidebar-context";
import { HintTooltip } from "@/components/ui/hint-tooltip";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Fixed left navigation rail. Collapses to an icon-only rail on desktop. */
export function Sidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "border-sidebar-border bg-sidebar hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center gap-2 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Film className="size-4.5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Reel Studio</span>
            <span className="text-muted-foreground text-[11px]">
              AI short-form video
            </span>
          </div>
        )}
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-1 p-3",
          collapsed && "items-center px-2",
        )}
      >
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                collapsed ? "size-10 justify-center" : "w-full px-3 py-2",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && item.title}
            </Link>
          );

          return collapsed ? (
            <HintTooltip key={item.href} label={item.title} side="right">
              {link}
            </HintTooltip>
          ) : (
            link
          );
        })}
      </nav>

      {!collapsed && (
        <div className="text-muted-foreground p-3 text-[11px]">
          Local-first &middot; v{APP_VERSION}
        </div>
      )}
    </aside>
  );
}
