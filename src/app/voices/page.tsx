"use client";
import * as React from "react";
import { QueryError } from "@/components/ui/query-error";
import { NativeSelect } from "@/components/ui/native-select";

import Link from "next/link";
import { AudioLines } from "lucide-react";

import { useProviders } from "@/hooks/voice";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { VoiceBrowser } from "@/components/voice/voice-browser";
import { VoiceClonePanel } from "@/components/voice/voice-clone-panel";

export default function VoicesPage() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useProviders();
  const [selected, setSelected] = React.useState<string>();

  const providers = data?.providers ?? [];
  const defaultTab =
    providers.find((p) => p.configured)?.id ?? providers[0]?.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voices"
        description="Browse default and cloned voices for each provider, and preview them without spending credits."
      />

      {isError && (
        <QueryError
          title="Could not load voice providers"
          error={error}
          retry={refetch}
          pending={isFetching}
        />
      )}
      {isError && !data ? null : isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : providers.every((p) => !p.configured) ? (
        <EmptyState
          icon={AudioLines}
          title="No providers configured"
          description="Add a provider API key or set VOICEFORGE_SERVICE_URL to browse and preview voices."
          action={
            <Button asChild>
              <Link href="/settings">Open settings</Link>
            </Button>
          }
        />
      ) : (
        <Tabs
          value={selected ?? defaultTab}
          onValueChange={setSelected}
          className="min-w-0 space-y-4"
        >
          <label className="grid gap-2 text-sm md:hidden">
            Voice provider
            <NativeSelect
              value={selected ?? defaultTab}
              onChange={(event) => setSelected(event.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.configured ? "" : " — setup needed"}
                </option>
              ))}
            </NativeSelect>
          </label>
          <TabsList className="hidden md:inline-flex">
            {providers.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.label}
                {!p.configured ? (
                  <Badge variant="secondary" className="ml-1">
                    No key
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {providers.map((p) => (
            <TabsContent key={p.id} value={p.id} className="space-y-6">
              {p.id === "voiceforge" ? (
                <VoiceClonePanel configured={p.configured} />
              ) : null}
              <VoiceBrowser providerId={p.id} configured={p.configured} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
