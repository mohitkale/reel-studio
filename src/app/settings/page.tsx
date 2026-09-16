"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Activity, Monitor, Moon, Sun } from "lucide-react";

import { useMounted } from "@/hooks/use-mounted";
import { useProviders } from "@/hooks/voice";
import { useAIProviders, useLocalAIProviders } from "@/hooks/ai";
import { useStockProviders } from "@/hooks/stock";
import { useMusicProviders } from "@/hooks/music";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { ProviderKeyCard } from "@/components/voice/provider-key-card";
import { KokoroVoicesCard } from "@/components/voice/kokoro-voices-card";
import { AIProviderCard } from "@/components/ai/ai-provider-card";
import { LocalAIProviderCard } from "@/components/ai/local-ai-provider-card";
import { StockProviderCard } from "@/components/stock/stock-provider-card";
import { MusicProviderCard } from "@/components/music/music-provider-card";
import { McpTokenCard } from "@/components/mcp/mcp-token-card";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const { data, isLoading } = useProviders();
  const { data: aiProviders, isLoading: aiLoading } = useAIProviders();
  const { data: localAIProviders, isLoading: localAILoading } =
    useLocalAIProviders();
  const { data: stockProviders, isLoading: stockLoading } = useStockProviders();
  const { data: musicProviders, isLoading: musicLoading } = useMusicProviders();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage the local runtime, providers, API keys and appearance."
      />

      <Card>
        <CardHeader className="sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="text-primary size-4" />
              Production readiness
            </CardTitle>
            <CardDescription>
              Check Node, SQLite, FFmpeg, media storage, catalog assets, and
              optional local transcription.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/diagnostics">Run system check</Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Local AI director (optional)
          </CardTitle>
          <CardDescription>
            Connect Ollama or LM Studio on this computer. Local servers require
            no cloud key and can plan an enabled Quick Produce request. The
            deterministic Quick Produce planner needs no server. Private LAN
            servers require an explicit opt-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {localAILoading || !localAIProviders ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            localAIProviders.map((status) => (
              <LocalAIProviderCard key={status.id} status={status} />
            ))
          )}
          <p className="text-muted-foreground text-xs">
            In Docker, use <code>host.docker.internal</code> with LAN access
            enabled when the model server runs on the host. This setting applies
            only to local AI provider calls; public media URL protections remain
            unchanged.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose your theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="inline-flex rounded-lg border p-1">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const active = mounted && theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  aria-pressed={active}
                  className={cn(
                    "focus-visible:ring-ring inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voice providers</CardTitle>
          <CardDescription>
            Enter API keys to enable each provider. Keys are written to a
            git-ignored .env.local and never leave your machine. Quick Produce
            uses server-side Kokoro by default; its model weights are downloaded
            on first use when not already cached.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading || !data ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            data.providers
              .filter(
                (status) => status.runtime === "server" && !status.keyless,
              )
              .map((status) => (
                <ProviderKeyCard
                  key={status.id}
                  status={status}
                  config={data.config}
                />
              ))
          )}
        </CardContent>
      </Card>

      {data?.config ? <KokoroVoicesCard config={data.config} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cloud AI director (optional)
          </CardTitle>
          <CardDescription>
            Add a Gemini or OpenAI key to generate a full scene plan from a one
            line idea or a pasted story. Cloud credentials stay separate from
            local AI configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {aiLoading || !aiProviders ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            aiProviders
              .filter((status) => status.kind === "cloud")
              .map((status) => (
                <AIProviderCard key={status.id} status={status} />
              ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock media (optional)</CardTitle>
          <CardDescription>
            Add an Unsplash, Pexels, or Pixabay key. Stock providers remain
            optional, and generation works without them. Unsplash photos remain
            under the{" "}
            <a
              href="https://unsplash.com/license"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Unsplash License
            </a>
            ; Pexels and Pixabay media retain creator/source attribution and are
            stored locally only after selection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stockLoading || !stockProviders ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            stockProviders.map((status) => (
              <StockProviderCard key={status.id} status={status} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Music library (optional)</CardTitle>
          <CardDescription>
            Add a free Jamendo Client ID to search 600k+ Creative Commons tracks
            from the editor&apos;s Music control, on top of the bundled CC0
            starter pack. Each Jamendo track has its own CC license — check
            attribution before commercial use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {musicLoading || !musicProviders ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            musicProviders.map((status) => (
              <MusicProviderCard key={status.id} status={status} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI tools / MCP (optional)</CardTitle>
          <CardDescription>
            Generate a token so external AI agents can create and edit
            storyboards or request Quick Produce through the MCP server. Keep
            the legacy token for its established approval flow, or mint named
            production tokens with explicit provider, duration, batch and
            paid-usage limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <McpTokenCard />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Licensing</CardTitle>
          <CardDescription>
            Reel Studio&apos;s own code is MIT. Preview and MP4 export use{" "}
            <strong>Remotion</strong>, which is source-available under the
            Remotion License (not OSI open-source). Individuals and small teams
            are often covered by Remotion&apos;s Free License; larger for-profit
            organizations may need a paid Company License. Optional providers
            (Unsplash, Jamendo, cloud TTS/AI, VoiceForge) keep their own terms.
            Full details are in{" "}
            <code className="text-xs">docs/LICENSING.md</code> in the repo, and
            at{" "}
            <a
              href="https://www.remotion.dev/license"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              remotion.dev/license
            </a>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
