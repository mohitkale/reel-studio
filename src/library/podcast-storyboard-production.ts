import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createAsset } from "@/library/repositories/assets";
import {
  createPodcast,
  getPodcast,
  replaceCharacters,
  replaceTurnsFromPlan,
  updatePodcastMeta,
} from "@/library/repositories/podcasts";
import {
  podcastVoiceSignature,
  submitEditorVoice,
} from "@/library/editor-jobs";
import { getAssetStore } from "@/library/storage";
import type { PodcastPresetId } from "@/library/podcast-presets";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import type { PodcastStoryboard } from "@/storyboard";

/** The loudness podcast apps expect for speech. */
export const EPISODE_LUFS = -16;

const DEFAULT_VOICES = ["af_heart", "am_michael", "bf_emma"] as const;

/** Kokoro names carry the speaker's gender in the second letter: af_, am_, bf_, bm_. */
export function genderForVoice(
  voiceId: string,
  fallbackIndex: number,
): "female" | "male" {
  if (/^[a-z]f_/.test(voiceId)) return "female";
  if (/^[a-z]m_/.test(voiceId)) return "male";
  return fallbackIndex % 2 === 0 ? "female" : "male";
}

export function presetForSpeakers(count: number): PodcastPresetId {
  return count <= 1 ? "solo-narration" : "two-host-discussion";
}

/** The bundled track for the intro and outro, or null for none. */
export function podcastMusicTrack(music: string | undefined) {
  if (music === "none") return null;
  const named = MUSIC_LIBRARY.find((track) => track.id === music);
  return (
    named ?? MUSIC_LIBRARY.find((track) => track.id === "corporate-steady")!
  );
}

async function registerBundledTrack(trackId: string) {
  const track = MUSIC_LIBRARY.find((candidate) => candidate.id === trackId)!;
  const bytes = await fs.readFile(
    path.join(process.cwd(), "public", track.url.replace(/^\//, "")),
  );
  const key = `podcast-music/${randomUUID()}.wav`;
  await getAssetStore().put(key, bytes);
  return createAsset("audio", key, track.name, { bundled: track.id });
}

export interface ProducedPodcast {
  podcastId: string;
  jobId: string;
  title: string;
  speakers: number;
  turns: number;
}

/**
 * Make a podcast episode from a podcast storyboard (roadmap A1): create the
 * podcast with its cast and voices, load the script, set intro and outro music,
 * and queue the episode job. The episode is mastered to -16 LUFS; the take
 * carries the transcript, chapters and show notes that the episode package holds.
 */
export async function producePodcastFromStoryboard(
  storyboard: PodcastStoryboard,
): Promise<ProducedPodcast> {
  const podcast = await createPodcast({
    title: storyboard.title,
    description: storyboard.publish?.description ?? "",
    length: storyboard.turns.length > 28 ? "long" : "short",
    presetId: presetForSpeakers(storyboard.speakers.length),
  });
  await replaceCharacters(
    podcast.id,
    storyboard.speakers.map((speaker, index) => {
      const voiceId =
        speaker.voiceId ?? DEFAULT_VOICES[index % DEFAULT_VOICES.length]!;
      return {
        key: speaker.id,
        name: speaker.name,
        gender: genderForVoice(voiceId, index),
        providerId: "kokoro-server",
        voiceId,
      };
    }),
  );
  await replaceTurnsFromPlan(
    podcast.id,
    {
      title: storyboard.title,
      description: storyboard.publish?.description,
      characters: storyboard.speakers.map((speaker, index) => ({
        id: speaker.id,
        name: speaker.name,
        gender: genderForVoice(
          speaker.voiceId ?? DEFAULT_VOICES[index % DEFAULT_VOICES.length]!,
          index,
        ),
      })),
      turns: storyboard.turns.map((turn) => ({
        characterId: turn.speaker,
        text: turn.text,
      })),
    },
    { updateMeta: true },
  );

  const music = podcastMusicTrack(storyboard.music);
  if (music) {
    const asset = await registerBundledTrack(music.id);
    await updatePodcastMeta(podcast.id, {
      introMusicAssetId: asset.id,
      outroMusicAssetId: asset.id,
    });
  }

  const ready = await getPodcast(podcast.id);
  if (!ready) throw new Error("The podcast was not created");
  const jobId = await submitEditorVoice({
    operation: "podcast",
    resourceId: podcast.id,
    podcastVoiceSignature: podcastVoiceSignature(ready),
    masterLufs: EPISODE_LUFS,
  });
  return {
    podcastId: podcast.id,
    jobId,
    title: storyboard.title,
    speakers: storyboard.speakers.length,
    turns: storyboard.turns.length,
  };
}
