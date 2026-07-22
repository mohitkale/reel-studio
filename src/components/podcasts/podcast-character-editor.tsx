"use client";

import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";

import type { PodcastCharacterDTO, PodcastGenderDTO } from "@/lib/dto";
import type { VoiceSummary } from "@/providers/voice/types";
import { useProviders } from "@/hooks/voice";
import { apiGet, apiPost } from "@/lib/api-client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HintTooltip } from "@/components/ui/hint-tooltip";

const GENDER_OPTIONS: { value: PodcastGenderDTO; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "neutral", label: "Neutral" },
];

const PREVIEW_LINE = "Hi, how are you doing today?";

/** Encodes provider + voice (+ optional model) into one combobox value. */
export function encodeVoiceValue(
  providerId: string,
  voiceId: string,
  modelId?: string | null,
): string {
  if (!providerId || !voiceId) return "";
  return modelId
    ? `${providerId}::${voiceId}::${modelId}`
    : `${providerId}::${voiceId}`;
}

export function decodeVoiceValue(raw: string): {
  providerId: string;
  voiceId: string;
  modelId: string | null;
} {
  const [providerId = "", voiceId = "", modelId = ""] = raw.split("::");
  return {
    providerId,
    voiceId,
    modelId: modelId || null,
  };
}

export type CharacterDraft = {
  localId: string;
  id?: string;
  key: string;
  name: string;
  gender: PodcastGenderDTO;
  definition: string;
  providerId: string;
  voiceId: string;
  modelId: string | null;
};

export function charactersToDrafts(
  characters: PodcastCharacterDTO[],
): CharacterDraft[] {
  return characters.map((c) => ({
    localId: c.id,
    id: c.id,
    key: c.key,
    name: c.name,
    gender: c.gender,
    definition: c.definition ?? "",
    providerId: c.providerId,
    voiceId: c.voiceId,
    modelId: c.modelId,
  }));
}

function slugKey(name: string, fallback: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return base || fallback;
}

const CLIENT_ONLY = new Set(["webspeech", "kokoro"]);

function useGroupedVoiceOptions(gender: PodcastGenderDTO): {
  options: ComboboxOption[];
  loading: boolean;
} {
  const { data: providersRes, isLoading: providersLoading } = useProviders();
  const providers = (providersRes?.providers ?? []).filter(
    (p) => p.configured && !CLIENT_ONLY.has(p.id),
  );

  const voiceQueries = useQueries({
    queries: providers.map((p) => ({
      queryKey: ["voices", p.id, ""],
      queryFn: () =>
        apiGet<{ voices: VoiceSummary[] }>(
          `/api/providers/${p.id}/voices`,
        ).then((r) => r.voices),
      staleTime: 60_000,
    })),
  });

  const options = React.useMemo(() => {
    const opts: ComboboxOption[] = [];
    providers.forEach((p, i) => {
      const voices = voiceQueries[i]?.data ?? [];
      const filtered =
        gender === "neutral"
          ? voices
          : (() => {
              const tagged = voices.filter((v) =>
                v.tags?.some((t) => t.toLowerCase() === gender),
              );
              return tagged.length ? tagged : voices;
            })();
      for (const v of filtered) {
        const engine =
          p.id === "voiceforge" && v.tags?.[0] ? ` · ${v.tags[0]}` : "";
        opts.push({
          value: encodeVoiceValue(p.id, v.id),
          label: `${v.name}${engine}`,
          group: p.label,
        });
      }
    });
    return opts;
  }, [providers, voiceQueries, gender]);

  const loading =
    providersLoading || voiceQueries.some((q) => q.isLoading || q.isFetching);

  return { options, loading };
}

function CharacterRow({
  draft,
  onChange,
  onRemove,
  canRemove,
}: {
  draft: CharacterDraft;
  onChange: (next: CharacterDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { options, loading } = useGroupedVoiceOptions(draft.gender);
  const voiceValue = encodeVoiceValue(
    draft.providerId,
    draft.voiceId,
    draft.modelId,
  );
  const [previewing, setPreviewing] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const optionsWithSelected = React.useMemo(() => {
    if (!voiceValue || options.some((o) => o.value === voiceValue)) {
      return options;
    }
    return [
      {
        value: voiceValue,
        label: draft.voiceId || "Selected voice",
        group: draft.providerId || "Selected",
      },
      ...options,
    ];
  }, [options, voiceValue, draft.voiceId, draft.providerId]);

  async function previewVoice() {
    if (!draft.providerId || !draft.voiceId) {
      toast.error("Pick a voice first");
      return;
    }
    setPreviewing(true);
    try {
      const { audioUrl } = await apiPost<{ audioUrl: string }>(
        "/api/voice-preview",
        {
          providerId: draft.providerId,
          voiceId: draft.voiceId,
          modelId: draft.modelId || undefined,
          text: PREVIEW_LINE,
        },
      );
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      await audio.play();
    } catch (e) {
      toast.error("Preview failed", {
        description: (e as Error).message,
      });
    } finally {
      setPreviewing(false);
    }
  }

  React.useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{draft.key || "—"}</Badge>
          <span className="text-xs text-muted-foreground">
            JSON id · use this name in dialogue
          </span>
        </div>
        {canRemove ? (
          <HintTooltip label="Remove character">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label={`Remove ${draft.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </HintTooltip>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Display name</Label>
          <Input
            value={draft.name}
            placeholder="e.g. Maya"
            onChange={(e) => {
              const name = e.target.value;
              onChange({
                ...draft,
                name,
                key: draft.id
                  ? draft.key
                  : slugKey(name, draft.key || "speaker"),
              });
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Gender</Label>
          <Combobox
            value={draft.gender}
            onChange={(gender) =>
              onChange({ ...draft, gender: gender as PodcastGenderDTO })
            }
            options={GENDER_OPTIONS.map((g) => ({
              value: g.value,
              label: g.label,
            }))}
            placeholder="Gender"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Character definition</Label>
        <textarea
          className="min-h-[64px] rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Personality, role, tone — used when AI writes their lines"
          value={draft.definition}
          onChange={(e) => onChange({ ...draft, definition: e.target.value })}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Voice</Label>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Combobox
              value={voiceValue}
              onChange={(raw) => {
                const decoded = decodeVoiceValue(raw);
                onChange({
                  ...draft,
                  providerId: decoded.providerId,
                  voiceId: decoded.voiceId,
                  modelId: decoded.modelId,
                });
              }}
              options={optionsWithSelected}
              placeholder={
                loading ? "Loading voices…" : "Search provider voices…"
              }
              searchPlaceholder="Search by voice or provider…"
              disabled={loading && options.length === 0}
            />
          </div>
          <HintTooltip label={`Preview: “${PREVIEW_LINE}”`}>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={!draft.providerId || !draft.voiceId || previewing}
              onClick={() => void previewVoice()}
              aria-label="Preview voice"
            >
              {previewing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </Button>
          </HintTooltip>
        </div>
        <p className="text-[11px] text-muted-foreground">
          One searchable list, grouped by provider. Preview caches a short
          sample for reuse.
        </p>
      </div>
    </div>
  );
}

export function PodcastCharacterEditor({
  drafts,
  onChange,
}: {
  drafts: CharacterDraft[];
  onChange: (next: CharacterDraft[]) => void;
}) {
  function add() {
    if (drafts.length >= 4) return;
    const n = drafts.length + 1;
    const names = ["Alex", "Sam", "Riley", "Jordan"];
    onChange([
      ...drafts,
      {
        localId: `new-${n}-${Date.now()}`,
        key: slugKey(names[n - 1] ?? `speaker-${n}`, `speaker-${n}`),
        name: names[n - 1] ?? `Speaker ${n}`,
        gender: n % 2 === 0 ? "female" : "male",
        definition: "",
        providerId: drafts[0]?.providerId ?? "",
        voiceId: "",
        modelId: null,
      },
    ]);
  }

  return (
    <div className="grid gap-3">
      {drafts.map((d, i) => (
        <CharacterRow
          key={d.localId}
          draft={d}
          canRemove={drafts.length > 2}
          onRemove={() => onChange(drafts.filter((_, j) => j !== i))}
          onChange={(next) =>
            onChange(drafts.map((row, j) => (j === i ? next : row)))
          }
        />
      ))}
      {drafts.length < 4 ? (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" />
          Add character
        </Button>
      ) : null}
    </div>
  );
}
