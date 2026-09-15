import { z } from "zod";

export const MEDIA_PREFERENCES = ["auto", "image", "video", "none"] as const;
export const mediaPreferenceSchema = z.enum(MEDIA_PREFERENCES);
export type MediaPreference = z.infer<typeof mediaPreferenceSchema>;

export const MEDIA_PREFERENCE_LABELS: Record<MediaPreference, string> = {
  auto: "Auto",
  image: "Image",
  video: "Video",
  none: "None",
};
