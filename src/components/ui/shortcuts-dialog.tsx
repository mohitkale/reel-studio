"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  description: string;
}

const GLOBAL_SHORTCUTS: Shortcut[] = [
  { keys: ["?"], description: "Show keyboard shortcuts" },
];

const EDITOR_SHORTCUTS: Shortcut[] = [
  { keys: ["N"], description: "Add a new scene" },
  { keys: ["J"], description: "Select next scene" },
  { keys: ["K"], description: "Select previous scene" },
  { keys: ["Ctrl", "Shift", "R"], description: "Start render" },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-foreground">{shortcut.description}</span>
      <span className="flex shrink-0 items-center gap-1">
        {shortcut.keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
    </div>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Global
            </p>
            <div className="divide-y divide-border/50">
              {GLOBAL_SHORTCUTS.map((s) => (
                <ShortcutRow key={s.description} shortcut={s} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Editor
            </p>
            <div className="divide-y divide-border/50">
              {EDITOR_SHORTCUTS.map((s) => (
                <ShortcutRow key={s.description} shortcut={s} />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
