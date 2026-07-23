"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { PodcastCharacterDTO } from "@/lib/dto";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

/** Inline composer to append or insert a dialogue turn. */
export function AddDialogueComposer({
  characters,
  disabled,
  pending,
  afterTurnId,
  compact,
  onAdd,
}: {
  characters: PodcastCharacterDTO[];
  disabled?: boolean;
  pending?: boolean;
  /** When set, inserts after this turn; otherwise appends. */
  afterTurnId?: string | null;
  compact?: boolean;
  onAdd: (vars: {
    characterId: string;
    text: string;
    afterTurnId?: string | null;
  }) => void | Promise<void>;
}) {
  const [characterId, setCharacterId] = React.useState(
    () => characters[0]?.id ?? "",
  );
  const [text, setText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const selectedCharacterId = characters.some((c) => c.id === characterId)
    ? characterId
    : (characters[0]?.id ?? "");

  async function submit() {
    const next = text.trim();
    if (!next || !selectedCharacterId || disabled || pending || submitting)
      return;
    setSubmitting(true);
    try {
      await onAdd({
        characterId: selectedCharacterId,
        text: next,
        afterTurnId: afterTurnId ?? null,
      });
      setText("");
    } catch {
      // Keep the draft on failure.
    } finally {
      setSubmitting(false);
    }
  }

  if (characters.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-muted/20",
        compact ? "p-2" : "p-3",
      )}
    >
      {!compact ? (
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Add dialogue
          {afterTurnId ? " · inserts below this line" : " · appends at the end"}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {characters.map((c) => {
          const initial = (c.name.trim()[0] || "?").toUpperCase();
          const selected = c.id === selectedCharacterId;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled || pending || submitting}
              title={c.name}
              aria-label={`Speaker ${c.name}`}
              aria-pressed={selected}
              onClick={() => setCharacterId(c.id)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold ring-offset-background transition",
                avatarClass(c.key),
                selected
                  ? "ring-2 ring-foreground ring-offset-2"
                  : "opacity-55 hover:opacity-100",
              )}
            >
              {initial}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          placeholder={`New line for ${characters.find((c) => c.id === selectedCharacterId)?.name ?? "speaker"}…`}
          value={text}
          disabled={disabled || pending || submitting}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={
            disabled ||
            pending ||
            submitting ||
            !text.trim() ||
            !selectedCharacterId
          }
          onClick={() => void submit()}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  );
}
