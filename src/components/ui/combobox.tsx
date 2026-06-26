"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

export interface ComboboxOption {
  value: string;
  label: string;
  group?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled,
  className,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [pos, setPos] = React.useState<{
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  }>({ left: 0, width: 0, maxHeight: 300 });
  const mounted = useMounted();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function openPanel() {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const GAP = 4;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    // Open upward when there isn't enough room below and there's more room above,
    // so the list never spills off the bottom of the screen.
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      140,
      Math.min(300, openUp ? spaceAbove : spaceBelow),
    );
    setPos({
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    });
    setOpen(true);
    setSearch("");
  }

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Focus search input after open
  React.useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 16);
      return () => clearTimeout(id);
    }
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const filtered = search.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()),
      )
    : options;

  // Build grouped list preserving insertion order
  type Group = { name: string | null; opts: ComboboxOption[] };
  const groups: Group[] = [];
  const groupIndex = new Map<string, Group>();
  for (const o of filtered) {
    const key = o.group ?? "";
    if (!groupIndex.has(key)) {
      const g: Group = { name: o.group ?? null, opts: [] };
      groupIndex.set(key, g);
      groups.push(g);
    }
    groupIndex.get(key)!.opts.push(o);
  }

  const panel = open && mounted
    ? createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            ...(pos.top !== undefined ? { top: pos.top } : {}),
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
            left: pos.left,
            width: Math.max(pos.width, 200),
            maxHeight: pos.maxHeight,
            zIndex: 9999,
          }}
          className="flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="flex shrink-0 items-center border-b px-3">
            <Search className="mr-2 size-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              className="flex h-9 w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {groups.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No results.
              </p>
            )}
            {groups.map(({ name, opts }) => (
              <div key={name ?? "__root__"}>
                {name ? (
                  <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {name}
                  </p>
                ) : null}
                {opts.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                      value === o.value && "bg-accent",
                    )}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        value === o.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{o.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={openPanel}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-sm ring-offset-background transition-colors",
          "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selectedLabel && "text-muted-foreground",
          className,
        )}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        <ChevronDown
          className={cn(
            "ml-2 size-4 shrink-0 opacity-50 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {panel}
    </>
  );
}
