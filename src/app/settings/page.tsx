"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { useMounted } from "@/hooks/use-mounted";
import { useProviders } from "@/hooks/voice";
import { useAIProviders } from "@/hooks/ai";
import { useStockProviders } from "@/hooks/stock";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { ProviderKeyCard } from "@/components/voice/provider-key-card";
import { AIProviderCard } from "@/components/ai/ai-provider-card";
import { StockProviderCard } from "@/components/stock/stock-provider-card";
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
  const { data: stockProviders, isLoading: stockLoading } = useStockProviders();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage voice providers, API keys and appearance."
      />

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
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
            git-ignored .env.local and never leave your machine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading || !data ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            data.providers.map((status) => (
              <ProviderKeyCard
                key={status.id}
                status={status}
                config={data.config}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI director (optional)</CardTitle>
          <CardDescription>
            Add a Gemini or OpenAI key to generate a full scene plan from a one
            line idea or a pasted story. The manual editor always works without
            this.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {aiLoading || !aiProviders ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            aiProviders.map((status) => (
              <AIProviderCard key={status.id} status={status} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock images (optional)</CardTitle>
          <CardDescription>
            Add a free Unsplash Access Key so the AI director can place relevant
            stock photo backgrounds on scenes. Generation works without it; those
            scenes simply keep the clean branded look.
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
    </div>
  );
}
