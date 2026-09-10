"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  KOKORO_LANGUAGE_GROUPS,
  KOKORO_VOICES,
  KOKORO_VOICE_IDS,
} from "@/providers/voice/kokoro";
import type { AppConfig } from "@/server/app-config";
import { useSetDefaults } from "@/hooks/voice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function normalizeSelection(
  configured: string[] | undefined,
): Set<string> {
  // Missing / empty config = all voices selected (default).
  if (!configured || configured.length === 0) {
    return new Set(KOKORO_VOICE_IDS);
  }
  const known = new Set(KOKORO_VOICE_IDS);
  const next = new Set(configured.filter((id) => known.has(id)));
  return next.size > 0 ? next : new Set(KOKORO_VOICE_IDS);
}

export function KokoroVoicesCard({ config }: { config: AppConfig }) {
  // A changed server selection starts a new draft without effect-driven updates.
  return <KokoroVoicesForm key={JSON.stringify(config.kokoroVisibleVoiceIds ?? [])} config={config} />;
}

function KokoroVoicesForm({ config }: { config: AppConfig }) {
  const save = useSetDefaults();
  const [selected, setSelected] = React.useState(() =>
    normalizeSelection(config.kokoroVisibleVoiceIds),
  );

  const allSelected = selected.size === KOKORO_VOICE_IDS.length;
  const dirty =
    JSON.stringify([...selected].sort()) !==
    JSON.stringify([...normalizeSelection(config.kokoroVisibleVoiceIds)].sort());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLanguage(language: string, voiceIds: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = voiceIds.every((id) => next.has(id));
      for (const id of voiceIds) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function persist(ids: string[] | null) {
    try {
      await save.mutateAsync({ kokoroVisibleVoiceIds: ids });
      toast.success(
        ids === null || ids.length === KOKORO_VOICE_IDS.length
          ? "Showing all Kokoro voices"
          : `Showing ${ids.length} of ${KOKORO_VOICE_IDS.length} Kokoro voices`,
      );
    } catch (e) {
      toast.error("Could not save voice list", {
        description: (e as Error).message,
      });
    }
  }

  function onSave() {
    if (selected.size === 0 || selected.size === KOKORO_VOICE_IDS.length) {
      void persist(null);
      return;
    }
    void persist([...selected]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kokoro voices</CardTitle>
        <CardDescription>
          Choose which of the 54 Kokoro 82M voices appear in video and podcast
          pickers. Defaults to all. Uncheck languages or individual voices to
          shorten the list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelected(new Set(KOKORO_VOICE_IDS))}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
          <span className="text-xs text-muted-foreground">
            {selected.size} / {KOKORO_VOICE_IDS.length} selected
            {allSelected ? " (all)" : ""}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() =>
                setSelected(normalizeSelection(config.kokoroVisibleVoiceIds))
              }
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={onSave}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {KOKORO_LANGUAGE_GROUPS.map((group) => {
            const voices = KOKORO_VOICES.filter((v) => v.language === group.id);
            const ids = voices.map((v) => v.id);
            const onCount = ids.filter((id) => selected.has(id)).length;
            const allOn = onCount === ids.length;
            return (
              <div key={group.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLanguage(group.id, ids)}
                    className="text-left text-sm font-medium hover:underline"
                  >
                    {group.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {onCount}/{ids.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLanguage(group.id, ids)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {allOn ? "Deselect language" : "Select language"}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {voices.map((v) => {
                    const checked = selected.has(v.id);
                    return (
                      <label
                        key={v.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          checked
                            ? "bg-secondary/60"
                            : "hover:bg-muted/60 text-muted-foreground",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 accent-foreground"
                          checked={checked}
                          onChange={() => toggle(v.id)}
                        />
                        <span className="min-w-0 truncate">{v.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
