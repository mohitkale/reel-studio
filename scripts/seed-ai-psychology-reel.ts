/**
 * Experimental 9:16 HyperFrames reel — human psychology before vs after AI.
 * Behavioral / decision-making framing only (not clinical or medical claims).
 *
 * Exercises: catalog diversity, Unsplash photo beds, count-up proof beats,
 * ambient GSAP, sparse SFX, af_heart @ 0.92.
 *
 * Usage: npx tsx scripts/seed-ai-psychology-reel.ts
 */

import { config as loadEnv } from "dotenv";
// Must run before any module that reads process.env at import time.
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const { createPrismaClient } = await import("../src/library/prisma-client");
  const { createProjectFromPlan } = await import(
    "../src/library/repositories/projects"
  );
  const { updateScript } = await import("../src/library/repositories/scripts");
  const { resolveSceneBackgrounds } = await import(
    "../src/library/stock-backgrounds"
  );
  const { autoAttachBundledMusic } = await import(
    "../src/library/soundtrack-service"
  );
  const { ensureSfxCues } = await import("../src/library/sfx-service");
  const { generateTake } = await import("../src/library/take-service");
  const { getStockProvider } = await import("../src/providers/stock/registry");
  type ScenePlan = import("../src/providers/ai/types").ScenePlan;

  const prisma = createPrismaClient();

  const TITLE = "Before AI vs After AI: your defaults changed";
  const SCRIPT = "Same brain. Different defaults.";
  const VOICE_ID = "af_heart";
  const VOICE_SPEED = 0.92;

  const plan: ScenePlan = {
    projectName: TITLE,
    scriptName: SCRIPT,
    styleId: "bold-hook",
    energy: "high",
    voiceStyle: undefined,
    scenes: [
      {
        text: "Your brain didn't change. Your defaults did.",
        spokenText:
          "Your brain didn't change overnight. What changed is the defaults around how you decide, remember, and trust.",
        templateId: "hf-kinetic-slam",
        emphasis: ["defaults"],
        mood: "energetic",
        musicMood: "cinematic tension",
        backgroundQuery: "neon city night abstract blur portrait",
        effect: "ken-burns",
      },
      {
        text: "Before AI: slow answers. High friction.",
        spokenText:
          "Before everyday AI tools, answers were slower and starting took effort. That friction shaped habits — for better and worse.",
        templateId: "hf-opener",
        emphasis: ["friction"],
        mood: "dramatic",
        musicMood: "cinematic tension",
        backgroundQuery: "empty desk notebook morning window light",
        effect: "ken-burns",
      },
      {
        text: "Uncertainty meant: sit with the question.",
        spokenText:
          "Uncertainty used to mean sitting with a question longer — sometimes that built judgment, sometimes it just stalled you.",
        templateId: "hf-quote",
        visual: "Before",
        emphasis: ["sit with the question"],
        mood: "calm",
        musicMood: "ambient glow",
        backgroundQuery: "person thinking alone soft light portrait",
        effect: "pan-up",
      },
      {
        text: "The old decision loop",
        spokenText:
          "The old loop looked like this: search, ask a person, try a draft, then decide. Slow — but the steps were yours.",
        templateId: "hf-list",
        visual: "→",
        emphasis: ["yours"],
        mood: "tech",
        musicMood: "tech minimal",
        items: [
          "Search or ask a person",
          "Draft it yourself",
          "Decide with incomplete info",
        ],
        backgroundQuery: "library bookshelves warm aisle",
        effect: "pan-right",
      },
      {
        text: "Now fluent answers arrive in seconds.",
        spokenText:
          "Now fluent answers can arrive in seconds. Speed helps — and it can also make a first draft feel more certain than it is.",
        templateId: "hf-money-count",
        visual: "10×",
        emphasis: ["seconds"],
        mood: "dramatic",
        musicMood: "cinematic tech",
        backgroundQuery: "laptop screen code glow dark room",
        effect: "ken-burns",
      },
      {
        text: "More drafts. Harder to notice what you skipped.",
        spokenText:
          "When drafting gets cheap, people often generate more options — and skip the uncomfortable check: what evidence would change my mind?",
        templateId: "hf-data-chart",
        visual: "Draft speed vs scrutiny",
        emphasis: ["skipped"],
        mood: "tech",
        musicMood: "tech minimal",
        items: ["12", "22", "38", "55", "72"],
        backgroundQuery: "abstract data visualization blue dark",
        effect: "ken-burns",
      },
      {
        text: "The skill that ages well: verifying what feels obvious.",
        spokenText:
          "One skill that ages well after AI: verifying what feels obvious — especially when the answer sounds confident.",
        templateId: "hf-stat",
        visual: "Verify",
        emphasis: ["verifying"],
        mood: "inspiring",
        musicMood: "tech minimal",
        backgroundQuery: "magnifying glass document research desk",
        effect: "ken-burns",
      },
      {
        text: "Use AI as a sparring partner. Not a substitute for judgment.",
        spokenText:
          "Treat AI like a sparring partner: pressure-test ideas, ask for counterarguments, then you still own the call.",
        templateId: "hf-app-showcase",
        visual: "Challenge me",
        emphasis: ["sparring partner"],
        mood: "tech",
        musicMood: "upbeat tech",
        backgroundQuery: "smartphone in hand city night bokeh",
        effect: "ken-burns",
      },
      {
        text: "Before vs after isn't smarter. It's different defaults.",
        spokenText:
          "Before versus after AI isn't a story about smarter humans. It's a story about different defaults — and which habits you protect.",
        templateId: "hf-yt-lower-third",
        visual: "Subscribe",
        emphasis: ["defaults"],
        mood: "inspiring",
        musicMood: "cinematic tension",
        backgroundQuery: "silhouette person looking at horizon dusk",
        effect: "pan-up",
      },
      {
        text: "Keep the human loop: doubt, check, decide.",
        spokenText:
          "Keep a human loop: doubt, check sources, decide. That's how you stay sharp when the tools get faster.",
        templateId: "hf-logo-outro",
        visual: "reel.studio",
        emphasis: ["doubt, check, decide"],
        mood: "inspiring",
        musicMood: "tech minimal",
      },
    ],
  };

  try {
    const existing = await prisma.project.findFirst({
      where: { name: TITLE },
    });
    if (existing) {
      await prisma.project.delete({ where: { id: existing.id } });
      console.log(`Removed previous project ${existing.id}`);
    }

    console.log(
      "Unsplash configured:",
      getStockProvider().isConfigured(),
      "key len",
      (process.env.UNSPLASH_ACCESS_KEY || "").trim().length,
    );
    console.log("Resolving Unsplash backgrounds…");
    const backgrounds = await resolveSceneBackgrounds(plan.scenes, "portrait");
    const withPhoto = backgrounds.filter(Boolean).length;
    console.log(`  ${withPhoto}/${plan.scenes.length} scenes got stock photos`);

    const created = await createProjectFromPlan(
      plan,
      "portrait",
      backgrounds,
      "hyperframes",
      { styleId: "bold-hook", energy: "high" },
    );

    await autoAttachBundledMusic(created.scriptId);
    await updateScript(created.scriptId, {
      musicUrl: "/music/cinematic-tension.wav",
      musicVolume: 14,
    });
    await ensureSfxCues(created.scriptId, { force: true });

    console.log("Project ready:");
    console.log(`  projectId=${created.projectId}`);
    console.log(`  scriptId=${created.scriptId}`);
    console.log(
      `Generating voiceover (kokoro-server / ${VOICE_ID} @ ${VOICE_SPEED}×)…`,
    );

    const take = await generateTake({
      scriptId: created.scriptId,
      providerId: "kokoro-server",
      voiceId: VOICE_ID,
      speed: VOICE_SPEED,
      label: `Heart ${VOICE_SPEED}× · AI psychology`,
      onProgress: (p) => {
        const working =
          p.phase === "synthesizing" && "workingOn" in p && p.workingOn
            ? ` (working #${p.workingOn})`
            : "";
        process.stdout.write(
          `\r  ${p.phase} ${p.scene}/${p.sceneCount}${working}   `,
        );
      },
    });

    console.log("\nTake ready:");
    console.log(`  takeId=${take.id}`);
    console.log(`  audioUrl=${take.audioUrl}`);
    console.log(
      `  ~${(take.totalFrames / take.fps).toFixed(1)}s · ${plan.scenes.length} scenes`,
    );
    console.log(`  open: http://localhost:3000/editor/${created.scriptId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
