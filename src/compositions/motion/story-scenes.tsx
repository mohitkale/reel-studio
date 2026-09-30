"use client";

import * as React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Stage } from "@/compositions/components/stage";
import type { TemplateProps } from "@/compositions/types";
import {
  isStoryMotionRecipe,
  resolveMotionDirection,
} from "@/production/motion";
import {
  storyBrandName,
  storyMotionGeometry,
  STORY_MOTION_TRACKS,
  type StoryMotionRecipeId,
  type StoryMotionTrack,
} from "@/production/story-motion";

export function StoryMotionScene({
  scene,
  tokens,
  durationInFrames,
}: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const motion = resolveMotionDirection(
    scene.motion,
    scene.text,
    scene.chart,
    Boolean(scene.visual),
    scene.items,
    scene.background,
  );
  if (!motion || !isStoryMotionRecipe(motion.recipeId)) return null;
  const id = motion.recipeId as StoryMotionRecipeId;
  const g = storyMotionGeometry(width, height, scene.text, scene.items);
  const quiet = id.startsWith("quiet-");
  const comparison = id.startsWith("comparison-");
  const center = id === "quiet-center" || id === "brand-lockup";
  const foreground = quiet ? "#241d19" : "#fffdf7";
  const brand = storyBrandName(tokens.handle);
  const animated = (part: string): React.CSSProperties => {
    const track: StoryMotionTrack | undefined = STORY_MOTION_TRACKS[id].find(
      (item) => item.part === part,
    );
    if (!track) return {};
    const linear = Math.max(
      0,
      Math.min(1, (frame - Math.round(track.at * 30)) / (track.duration * fps)),
    );
    const progress = 1 - (1 - linear) ** 3;
    return {
      opacity: progress,
      transform: `translate(${track.x * (1 - progress)}px, ${track.y * (1 - progress)}px) scale(${(track.scaleX ?? 1) + (1 - (track.scaleX ?? 1)) * progress}, ${(track.scaleY ?? 1) + (1 - (track.scaleY ?? 1)) * progress})`,
    };
  };
  return (
    <Stage
      tokens={{ ...tokens, foreground }}
      durationInFrames={durationInFrames}
      hideBrandBug
      backdrop={
        <AbsoluteFill style={{ background: quiet ? "#f2ece2" : "#101626" }} />
      }
      contentStyle={{
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        data-motion-recipe={id}
        data-motion-version={motion.version}
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: g.gap,
          color: foreground,
          alignItems: center ? "center" : "stretch",
          position: "relative",
        }}
      >
        {id === "quiet-center" && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              width: g.ring,
              height: g.ring,
              left: "50%",
              top: "50%",
              marginLeft: -g.ring / 2,
              marginTop: -g.ring / 2,
              borderRadius: "50%",
              border: "2px solid #c9bfb0",
              ...animated("ring"),
            }}
          />
        )}
        {id === "quiet-divider" && (
          <div
            style={{
              fontSize: g.marker,
              lineHeight: 1,
              fontWeight: 500,
              color: "#73685d",
              ...animated("marker"),
            }}
          >
            {String((scene.order ?? 0) + 1).padStart(2, "0")}
          </div>
        )}
        {id === "brand-lockup" && brand && (
          <div
            style={{
              fontSize: g.brand,
              fontWeight: 700,
              overflowWrap: "anywhere",
              textAlign: "center",
              maxWidth: "100%",
              ...animated("brand"),
            }}
          >
            {brand}
          </div>
        )}
        {(id === "quiet-divider" || id === "brand-frame") && (
          <div
            aria-hidden
            style={{
              width: id === "brand-frame" ? 7 : "36%",
              height: id === "brand-frame" ? g.marker * 0.6 : 2,
              background: tokens.accent,
              transformOrigin: "left top",
              ...animated("rule"),
            }}
          />
        )}
        <h2
          style={{
            margin: 0,
            position: "relative",
            fontSize: g.headline,
            fontWeight: quiet ? 500 : 850,
            lineHeight: 1.1,
            letterSpacing: "-.035em",
            overflowWrap: "anywhere",
            textAlign: center ? "center" : "left",
            maxWidth: "100%",
            ...animated("title"),
          }}
        >
          {scene.text}
        </h2>
        {comparison && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                id === "comparison-split"
                  ? "minmax(0,1fr) minmax(0,1fr)"
                  : "minmax(0,1fr)",
              gap: g.gap,
            }}
          >
            {scene.items?.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: id === "comparison-split" ? "column" : "row",
                  alignItems:
                    id === "comparison-split" ? "flex-start" : "center",
                  justifyContent:
                    id === "comparison-split" ? "space-between" : "flex-start",
                  gap: g.gap,
                  minWidth: 0,
                  minHeight:
                    id === "comparison-split" ? g.panelHeight : g.rowHeight,
                  padding: g.padding,
                  boxSizing: "border-box",
                  background: index ? "#27344a" : "#192337",
                  borderTop: `4px solid ${index ? tokens.accentSecondary : tokens.accent}`,
                  borderRadius: tokens.radius,
                  ...animated(`label-${index}`),
                }}
              >
                <span
                  style={{
                    fontSize: g.brand * 0.65,
                    flexShrink: 0,
                    fontWeight: 600,
                  }}
                >
                  0{index + 1}
                </span>
                <div
                  style={{
                    fontSize: g.label,
                    lineHeight: 1.16,
                    fontWeight: 650,
                    overflowWrap: "anywhere",
                    minWidth: 0,
                  }}
                >
                  {item}
                </div>
              </div>
            ))}
          </div>
        )}
        {id === "brand-lockup" && (
          <div
            aria-hidden
            style={{
              width: "28%",
              height: 7,
              background: tokens.accent,
              transformOrigin: "center",
              ...animated("rule"),
            }}
          />
        )}
        {id === "brand-frame" && brand && (
          <div
            style={{
              paddingTop: g.gap,
              borderTop: "1px solid #566176",
              fontSize: g.brand,
              fontWeight: 600,
              overflowWrap: "anywhere",
              ...animated("brand"),
            }}
          >
            {brand}
          </div>
        )}
      </div>
    </Stage>
  );
}
