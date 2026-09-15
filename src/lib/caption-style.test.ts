import { describe, expect, it } from "vitest";

import {
  CAPTION_STYLE_PRESETS,
  captionStyleForProductionPreset,
  captionStyleSnapshotSchema,
  captionStyleWarnings,
  LEGACY_CAPTION_STYLE,
} from "./caption-style";

describe("caption style snapshots", () => {
  it("keeps the legacy appearance for pre-style caption tracks", () => {
    expect(captionStyleSnapshotSchema.parse(LEGACY_CAPTION_STYLE)).toEqual(
      LEGACY_CAPTION_STYLE,
    );
    expect(LEGACY_CAPTION_STYLE).toMatchInlineSnapshot(`
      {
        "activeWordColor": "#ff6b4a",
        "alignment": "center",
        "backgroundColor": "#080a10",
        "backgroundOpacity": 0.82,
        "fontFamily": "brand",
        "fontSize": 38,
        "fontWeight": 700,
        "highlightMode": "word",
        "letterSpacing": 0,
        "lineHeight": 1.18,
        "maxLines": 2,
        "maxWordsPerLine": 8,
        "outlineColor": "#000000",
        "outlineWidth": 0,
        "paddingX": 26,
        "paddingY": 16,
        "position": "bottom",
        "presetId": "legacy",
        "radius": 18,
        "safeAreaOffsets": {
          "landscape": {
            "bottom": 0,
            "left": 0,
            "right": 0,
            "top": 0,
          },
          "portrait": {
            "bottom": 0,
            "left": 0,
            "right": 0,
            "top": 0,
          },
          "square": {
            "bottom": 0,
            "left": 0,
            "right": 0,
            "top": 0,
          },
        },
        "shadowBlur": 40,
        "shadowColor": "#000000",
        "shadowOffsetX": 0,
        "shadowOffsetY": 10,
        "shadowOpacity": 0.28,
        "textColor": "#ffffff",
        "version": 1,
      }
    `);
  });

  it("resolves all six production preset defaults reproducibly", () => {
    expect(
      Object.fromEntries(
        [
          "product-launch",
          "editorial-explainer",
          "creator-punch",
          "data-story",
          "developer-demo",
          "cinematic-brand",
        ].map((id) => [
          id,
          captionStyleForProductionPreset(
            id as Parameters<typeof captionStyleForProductionPreset>[0],
          ).presetId,
        ]),
      ),
    ).toEqual({
      "product-launch": "minimal",
      "editorial-explainer": "editorial",
      "creator-punch": "karaoke",
      "data-story": "minimal",
      "developer-demo": "technical",
      "cinematic-brand": "cinematic",
    });
    expect(Object.keys(CAPTION_STYLE_PRESETS)).toHaveLength(6);
  });

  it("rejects invalid size and line limits and warns on poor contrast", () => {
    expect(() =>
      captionStyleSnapshotSchema.parse({
        ...LEGACY_CAPTION_STYLE,
        fontSize: 10,
        maxLines: 8,
      }),
    ).toThrow();
    expect(
      captionStyleWarnings({
        ...LEGACY_CAPTION_STYLE,
        textColor: "#777777",
        backgroundColor: "#888888",
      }),
    ).toEqual([expect.stringContaining("contrast")]);
  });
});
