"use client";

import * as React from "react";
import { AbsoluteFill } from "remotion";

import type { TemplateProps } from "@/compositions/types";
import { CinematicBrandScene } from "@/compositions/presets/cinematic-brand";
import { ProductLaunchScene } from "@/compositions/presets/product-launch";
import { resolveMotionDirection } from "@/production/motion";

/** Adapt two proven preset compositions to a versioned, image-backed decision. */
export function MediaMotionScene(props: TemplateProps) {
  const { scene } = props;
  const motion = resolveMotionDirection(
    scene.motion,
    scene.text,
    scene.chart,
    Boolean(scene.visual),
    scene.items,
    scene.background,
  );
  if (!motion) return null;
  const device = motion.recipeId === "media-device";
  const Component = device ? ProductLaunchScene : CinematicBrandScene;
  return (
    <AbsoluteFill
      data-motion-recipe={motion.recipeId}
      data-motion-version={motion.version}
    >
      <Component
        {...props}
        scene={{ ...scene, role: device ? "screenshot-demo" : "hero" }}
      />
    </AbsoluteFill>
  );
}
