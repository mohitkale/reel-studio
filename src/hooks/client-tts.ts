"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/lib/api-client";
import type { VoiceTakeDTO } from "@/lib/dto";

export interface KokoroGenerateProgress {
  phase: "model" | "synth" | "upload";
  /** Model download fraction 0..1 (phase "model"). */
  modelProgress?: number;
  /** Current scene index / total (phase "synth"). */
  scene?: number;
  sceneCount?: number;
}

export interface KokoroGenerateVars {
  scenes: { id: string; text: string }[];
  voiceId: string;
  modelId?: string;
  label?: string;
}

/** Generate a take fully in the browser with Kokoro (in a worker), then upload it. */
export function useKokoroGenerate(scriptId: string) {
  const qc = useQueryClient();
  const [progress, setProgress] = React.useState<KokoroGenerateProgress | null>(
    null,
  );
  const abortRef = React.useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationFn: async (vars: KokoroGenerateVars): Promise<VoiceTakeDTO> => {
      const { generateScenesToBeats } = await import("@/lib/client-tts/kokoro");

      const controller = new AbortController();
      abortRef.current = controller;

      setProgress({ phase: "model" });
      const beats = await generateScenesToBeats(vars.scenes, {
        voice: vars.voiceId,
        signal: controller.signal,
        onModelProgress: (modelProgress) =>
          setProgress({ phase: "model", modelProgress }),
        onScene: (completed, total) =>
          setProgress({ phase: "synth", scene: completed + 1, sceneCount: total }),
      });

      setProgress({ phase: "upload" });
      const res = await apiPost<{ take: VoiceTakeDTO }>(
        `/api/scripts/${scriptId}/takes/upload`,
        {
          providerId: "kokoro",
          voiceId: vars.voiceId,
          modelId: vars.modelId,
          label: vars.label,
          beats,
        },
      );
      return res.take;
    },
    onSettled: () => {
      setProgress(null);
      abortRef.current = null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });

  const cancel = React.useCallback(() => abortRef.current?.abort(), []);

  // Free the in-worker model (~hundreds of MB) when the editor unmounts.
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
      import("@/lib/client-tts/kokoro").then((m) => m.terminateKokoro());
    };
  }, []);

  return { ...mutation, progress, cancel };
}

/** Web Speech preview: live browser voices + speak/stop (no take produced). */
export function useWebSpeechPreview() {
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    import("@/lib/client-tts/webspeech").then(
      async ({ isWebSpeechSupported, getWebSpeechVoices }) => {
        if (!active) return;
        setSupported(isWebSpeechSupported());
        setVoices(await getWebSpeechVoices());
      },
    );
    return () => {
      active = false;
      import("@/lib/client-tts/webspeech").then((m) => m.cancelSpeech());
    };
  }, []);

  const preview = React.useCallback((text: string, voiceURI?: string) => {
    import("@/lib/client-tts/webspeech").then((m) => m.speak(text, voiceURI));
  }, []);

  const stop = React.useCallback(() => {
    import("@/lib/client-tts/webspeech").then((m) => m.cancelSpeech());
  }, []);

  return { supported, voices, preview, stop };
}
