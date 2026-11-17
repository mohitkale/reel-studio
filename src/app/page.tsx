"use client";

import Link from "next/link";

import { useUiMode } from "@/hooks/ui-mode";
import { CreationHub } from "@/components/studio/creation-hub";
import { OnePromptCreate } from "@/components/studio/one-prompt-create";
import { CreationReadiness } from "@/components/projects/creation-readiness";
import { ProjectsLibrary } from "@/components/projects/projects-library";
import { Onboarding } from "@/components/studio/onboarding";

export default function CreatePage() {
  const { mode, ready } = useUiMode();

  return (
    <div className="space-y-8">
      <Onboarding />
      <OnePromptCreate />
      <p className="text-muted-foreground text-sm">
        <Link href="/scenes" className="text-foreground underline">
          Browse scene types and looks
        </Link>{" "}
        to see what a video can contain.
      </p>
      {ready && mode === "simple" ? (
        <p className="text-muted-foreground text-sm">
          Your finished videos are in the{" "}
          <Link href="/library" className="text-foreground underline">
            Library
          </Link>
          . Want every manual control? Switch to Pro at the top.
        </p>
      ) : (
        <>
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              More ways to create: podcast, voiceover, repurpose, manual
              production
            </summary>
            <div className="mt-4">
              <CreationHub />
            </div>
          </details>
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Check creation readiness
            </summary>
            <div className="mt-3">
              <CreationReadiness />
            </div>
          </details>
          <ProjectsLibrary />
        </>
      )}
    </div>
  );
}
