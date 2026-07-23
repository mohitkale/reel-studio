"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const AVATAR_COLORS = [
  "bg-teal-600 text-white",
  "bg-indigo-600 text-white",
  "bg-lime-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
  "bg-sky-600 text-white",
];

function avatarClass(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Compact ElevenLabs-style turn row: one line + ellipsis; click to edit. */
export function CompactTurnRow({
  index,
  characterName,
  characterKey,
  text,
  disabled,
  onSave,
  onDelete,
}: {
  index: number;
  characterName: string;
  characterKey: string;
  text: string;
  disabled?: boolean;
  onSave: (text: string) => void | Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(text);
  const [saving, setSaving] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [editing]);

  function startEdit() {
    if (disabled) return;
    setValue(text);
    setEditing(true);
  }

  async function commit() {
    const next = value.trim();
    if (!next) {
      setValue(text);
      setEditing(false);
      return;
    }
    if (next === text) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // Keep edit mode so the draft is not lost on failure.
    } finally {
      setSaving(false);
    }
  }

  const initial = (characterName.trim()[0] || "?").toUpperCase();

  if (editing) {
    return (
      <li className="min-w-0 rounded-lg border border-border bg-card p-2.5 shadow-sm">
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              avatarClass(characterKey),
            )}
            title={characterName}
          >
            {initial}
          </span>
          <span className="text-xs font-medium">{characterName}</span>
          <span className="text-[10px] text-muted-foreground">#{index + 1}</span>
          <div className="ml-auto flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || saving}
              onClick={() => {
                setValue(text);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled || saving || !value.trim()}
              onClick={() => void commit()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-sm leading-relaxed shadow-sm"
          value={value}
          disabled={disabled || saving}
          onChange={(e) => {
            setValue(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue(text);
              setEditing(false);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void commit();
          }}
        />
      </li>
    );
  }

  return (
    <li className="group flex min-w-0 items-stretch overflow-hidden rounded-md border border-border/70 bg-card/60 hover:border-border hover:bg-card">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex w-10 shrink-0 items-center justify-center"
            aria-label={`Speaker ${characterName}`}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                avatarClass(characterKey),
              )}
            >
              {initial}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-left font-normal">
          {characterName} · {characterKey}
        </TooltipContent>
      </Tooltip>
      <div className="w-px shrink-0 self-stretch bg-border" />
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="min-w-0 flex-1 overflow-hidden px-3 py-2 text-left text-sm leading-snug"
            onClick={startEdit}
            disabled={disabled}
          >
            <span className="block truncate whitespace-nowrap text-foreground">
              {text}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-lg whitespace-pre-wrap text-left font-normal leading-relaxed"
        >
          {text}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled}
            className="my-0.5 mr-0.5 size-8 shrink-0 bg-transparent text-muted-foreground hover:bg-transparent hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete turn"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Remove turn</TooltipContent>
      </Tooltip>
    </li>
  );
}
