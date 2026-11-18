"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  formatDictionary,
  normalizeForSpeech,
  parseDictionary,
  type PronunciationRule,
} from "@/lib/speech-normalize";

interface Response {
  rules: PronunciationRule[];
  starter: PronunciationRule[];
}

/**
 * Your own respellings for the voice (roadmap A2): one "word = how it sounds"
 * per line. They apply to narration only; on-screen text is never changed.
 */
export function PronunciationCard() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["pronunciations"],
    queryFn: () => apiGet<Response>("/api/settings/pronunciations"),
  });
  const [text, setText] = React.useState<string>();
  const [sample, setSample] = React.useState(
    "Raised $2M on 2026-11-13, up 40%. Learn SQL at example.com",
  );
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string>();
  const shown = text ?? formatDictionary(query.data?.rules ?? []);
  const rules = parseDictionary(shown);

  async function save() {
    setSaving(true);
    setMessage(undefined);
    try {
      await apiPost("/api/settings/pronunciations", { rules });
      await client.invalidateQueries({ queryKey: ["pronunciations"] });
      setText(undefined);
      setMessage(
        `Saved ${rules.length} respelling${rules.length === 1 ? "" : "s"}`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">How the voice says things</CardTitle>
        <CardDescription>
          Numbers, money, dates, links and acronyms are already spoken in words,
          and a short list of tech and brand terms is built in. Add your own
          below, one per line, as <code>word = how it sounds</code>. This
          changes the narration only, never the text on screen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label htmlFor="pronunciation-dictionary" className="sr-only">
          Your pronunciations
        </label>
        <textarea
          id="pronunciation-dictionary"
          rows={5}
          value={shown}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Kokoro = koh-koh-roh\nHyperFrames = hyper frames"}
          className="bg-background w-full rounded-lg border p-2 font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={saving || text === undefined}
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save
          </Button>
          {message && (
            <span role="status" className="text-muted-foreground text-sm">
              {message}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="pronunciation-sample" className="text-sm font-medium">
            Try a line
          </label>
          <input
            id="pronunciation-sample"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            className="bg-background w-full rounded-lg border p-2 text-sm"
          />
          <p className="text-sm">
            <span className="text-muted-foreground">The voice is given: </span>
            {normalizeForSpeech(sample, { dictionary: rules })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
