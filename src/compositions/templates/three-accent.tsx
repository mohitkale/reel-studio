"use client";

import * as React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import type {} from "@react-three/fiber";

import type { TemplateProps } from "../types";
import type { BrandTokens } from "../tokens";
import { Stage, useStageOptions } from "../components/stage";
import { AnimatedText } from "../components/animated-text";

// Deterministic floating-particle positions (golden-angle spiral).
const PARTICLE_COUNT = 20;
const PARTICLES: [number, number, number][] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = i * 2.399963;
  const radius = 2.8 + (i % 4) * 0.45;
  const y = (i / PARTICLE_COUNT - 0.5) * 4.4;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
});
// Draft preview: render a fraction of the particles to cut WebGL draw calls.
const DRAFT_PARTICLES = PARTICLES.filter((_, i) => i % 2 === 0);

function Scene3D({ tokens, particles }: { tokens: BrandTokens; particles: typeof PARTICLES }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const intro = spring({ frame, fps, config: { damping: 200, stiffness: 80, mass: 1.1 } });
  const scale = interpolate(intro, [0, 1], [0.2, 1]);
  const bob = Math.sin(frame / 45) * 0.18;
  const orbit = frame / 30;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 8, 6]} intensity={1.8} />
      <pointLight
        position={[Math.cos(orbit) * 6, 3, Math.sin(orbit) * 6]}
        intensity={2.4}
        color={tokens.accent}
      />
      <pointLight
        position={[Math.cos(orbit + Math.PI) * 6, -2, Math.sin(orbit + Math.PI) * 6]}
        intensity={2}
        color={tokens.accentSecondary}
      />

      <group position={[0, bob, 0]} rotation={[Math.sin(frame / 70) * 0.2, frame * 0.012, 0]} scale={scale}>
        <mesh>
          <icosahedronGeometry args={[1.5, 1]} />
          <meshPhysicalMaterial
            color={tokens.accent}
            roughness={0.18}
            metalness={0.7}
            clearcoat={1}
            clearcoatRoughness={0.2}
            emissive={tokens.accent}
            emissiveIntensity={0.12}
            flatShading
          />
        </mesh>
        <mesh scale={1.06}>
          <icosahedronGeometry args={[1.5, 1]} />
          <meshBasicMaterial
            color={tokens.accentSecondary}
            wireframe
            transparent
            opacity={0.22}
          />
        </mesh>
      </group>

      <group rotation={[0, frame * 0.005, 0]}>
        {particles.map((pos, i) => (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial
              color={i % 2 ? tokens.accentSecondary : tokens.accent}
              emissive={i % 2 ? tokens.accentSecondary : tokens.accent}
              emissiveIntensity={2}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** 3D accent: a lit, rotating icosahedron with wireframe overlay and floating particles, plus a lower-third caption. */
export const ThreeAccent = React.memo(function ThreeAccent({
  scene,
  tokens,
  durationInFrames,
}: TemplateProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { quality } = useStageOptions();
  const isDraft = quality === "draft";

  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <Stage
      tokens={tokens}
      background={scene.background}
      mood={scene.mood}
      treatmentSeed={scene.order}
      durationInFrames={durationInFrames}
      contentStyle={{ alignItems: "center", justifyContent: "flex-end" }}
      backdrop={
        <ThreeCanvas
          width={width}
          height={height}
          // Cap device pixel ratio during draft preview — WebGL rasterization
          // cost scales with the square of pixel ratio, so this is the single
          // biggest lever for smoother scrubbing on the 3D template.
          dpr={isDraft ? 1 : [1, 2]}
          style={{ position: "absolute", inset: 0 }}
          camera={{ position: [0, 0, 6], fov: 45 }}
        >
          <Scene3D tokens={tokens} particles={isDraft ? DRAFT_PARTICLES : PARTICLES} />
        </ThreeCanvas>
      }
    >
      <div style={{ opacity: exit, width: "100%", display: "flex", justifyContent: "center" }}>
        <AnimatedText
          text={scene.text}
          emphasis={scene.emphasis}
          tokens={tokens}
          fontSize={68}
          fontWeight={800}
          startDelay={8}
          maxWidth={880}
        />
      </div>
    </Stage>
  );
});
