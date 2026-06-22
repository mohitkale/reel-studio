"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { useMounted } from "@/hooks/use-mounted";
import { useProviders } from "@/hooks/voice";
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
    </div>
  );
}
