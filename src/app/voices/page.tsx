"use client";

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
  const { data, isLoading } = useProviders();

  const providers = data?.providers ?? [];
  const defaultTab =
    providers.find((p) => p.configured)?.id ?? providers[0]?.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voices"
        description="Browse default and cloned voices for each provider, and preview them without spending credits."
      />

      {isLoading || !data ? (
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
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList>
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
