"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film } from "lucide-react";

import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Fixed left navigation rail. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Film className="size-4.5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Reel Studio</span>
          <span className="text-[11px] text-muted-foreground">
            AI short-form video
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 text-[11px] text-muted-foreground">
        Local-first &middot; v0.1
      </div>
    </aside>
  );
}
