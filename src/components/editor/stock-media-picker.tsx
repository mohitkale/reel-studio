"use client";

import * as React from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  useClearSceneStockMedia,
  useSceneStockMediaSelection,
  useSearchStockMedia,
  useSelectSceneStockMedia,
} from "@/hooks/stock-media";
import { useStockMediaProviders } from "@/hooks/stock-media";
import type { SceneBackground } from "@/lib/dto";
import { ORIENTATION_LABELS, type Orientation } from "@/lib/orientation";
import type {
  StockMediaCandidate,
  StockMediaKind,
  StockMediaSearchRequest,
} from "@/providers/stock/schemas";

export function firstSupportedKind(
  current: StockMediaKind,
  supported: StockMediaKind[],
): StockMediaKind {
  return supported.includes(current) ? current : (supported[0] ?? "image");
}

export function StockMediaPicker({
  scriptId,
  sceneId,
  orientation,
  imageEffect,
  onApplied,
}: {
  scriptId: string;
  sceneId: string;
  orientation: Orientation;
  imageEffect: NonNullable<SceneBackground["effect"]>;
  onApplied: (background: SceneBackground | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [providerId, setProviderId] = React.useState("unsplash");
  const [kind, setKind] = React.useState<StockMediaKind>("image");
  const [searchOrientation, setSearchOrientation] =
    React.useState<Orientation>(orientation);
  const [searchRequest, setSearchRequest] =
    React.useState<StockMediaSearchRequest | null>(null);
  const providersQuery = useStockMediaProviders();
  const selectionQuery = useSceneStockMediaSelection(sceneId);
  const search = useSearchStockMedia();
  const select = useSelectSceneStockMedia(scriptId, sceneId);
  const clear = useClearSceneStockMedia(scriptId, sceneId);
  const providers = providersQuery.data ?? [];
  const effectiveProviderId = providers.some(
    (item) => item.id === providerId && item.health.status === "ready",
  )
    ? providerId
    : (providers.find((item) => item.health.status === "ready")?.id ??
      providers[0]?.id ??
      providerId);
  const provider = providers.find((item) => item.id === effectiveProviderId);

  function changeProvider(nextId: string) {
    setProviderId(nextId);
    const next = providers.find((item) => item.id === nextId);
    if (next) setKind(firstSupportedKind(kind, next.capabilities.kinds));
    search.reset();
    setSearchRequest(null);
  }

  async function runSearch() {
    if (!query.trim() || !provider || provider.health.status !== "ready")
      return;
    const request = {
      query: query.trim(),
      kind,
      orientation: searchOrientation,
      perPage: Math.min(20, provider.capabilities.maxPageSize),
    } satisfies StockMediaSearchRequest;
    setSearchRequest(request);
    await search
      .mutateAsync({ providerId: effectiveProviderId, request })
      .catch(() => undefined);
  }

  async function choose(candidate: StockMediaCandidate) {
    if (!searchRequest) return;
    try {
      const result = await select.mutateAsync({
        providerId: effectiveProviderId,
        providerAssetId: candidate.providerAssetId,
        search: searchRequest,
        imageEffect,
      });
      onApplied(result.scene.background ?? null);
      if (result.usageWarning) {
        toast.warning(
          `Selected, but usage reporting failed: ${result.usageWarning}`,
        );
      } else {
        toast.success("Stock media applied");
      }
      setOpen(false);
    } catch {
      // The mutation error is rendered in the dialog.
    }
  }

  async function clearSelection() {
    try {
      await clear.mutateAsync();
      onApplied(null);
      toast.success("Stock background cleared");
    } catch {
      // The mutation error is rendered below.
    }
  }

  const selected = selectionQuery.data?.snapshot.providerSnapshot;
  const actionError = search.error ?? select.error ?? clear.error;

  return (
    <div className="bg-background/60 grid gap-2 rounded-md border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs">
          {selected ? (
            <>
              <div className="truncate font-medium">
                {selected.attribution.text}
              </div>
              <a
                href={selected.sourcePageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground inline-flex items-center gap-1 hover:underline"
              >
                {selected.providerId} source <ExternalLink className="size-3" />
              </a>
            </>
          ) : (
            <span className="text-muted-foreground">No stock selection</span>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {selected ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={clear.isPending}
              onClick={clearSelection}
            >
              No stock
            </Button>
          ) : null}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Search className="size-3.5" />
                {selected ? "Replace stock" : "Search stock"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Stock media</DialogTitle>
                <DialogDescription>
                  Search configured providers and select an image or video for
                  this scene.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_9rem_10rem_auto] lg:items-end">
                <div className="grid gap-1.5">
                  <Label htmlFor="stock-query">Search</Label>
                  <Input
                    id="stock-query"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void runSearch();
                    }}
                    placeholder="Ocean, city, workspace…"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="stock-provider">Provider</Label>
                  <NativeSelect
                    id="stock-provider"
                    value={effectiveProviderId}
                    onChange={(event) => changeProvider(event.target.value)}
                  >
                    {providers.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={item.health.status !== "ready"}
                      >
                        {item.label} · {item.health.status}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="stock-kind">Type</Label>
                  <NativeSelect
                    id="stock-kind"
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value as StockMediaKind);
                      search.reset();
                    }}
                  >
                    <option
                      disabled={!provider?.capabilities.kinds.includes("image")}
                      value="image"
                    >
                      Image
                    </option>
                    <option
                      disabled={!provider?.capabilities.kinds.includes("video")}
                      value="video"
                    >
                      Video
                    </option>
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="stock-orientation">Orientation</Label>
                  <NativeSelect
                    id="stock-orientation"
                    value={searchOrientation}
                    onChange={(event) => {
                      setSearchOrientation(event.target.value as Orientation);
                      search.reset();
                    }}
                  >
                    {(Object.keys(ORIENTATION_LABELS) as Orientation[]).map(
                      (value) => (
                        <option key={value} value={value}>
                          {ORIENTATION_LABELS[value]}
                        </option>
                      ),
                    )}
                  </NativeSelect>
                </div>
                <Button
                  disabled={
                    search.isPending ||
                    !query.trim() ||
                    provider?.health.status !== "ready"
                  }
                  onClick={() => void runSearch()}
                >
                  {search.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Search
                </Button>
              </div>

              {providersQuery.isPending ? (
                <p className="text-muted-foreground text-sm">
                  Loading providers…
                </p>
              ) : provider?.health.message ? (
                <p className="text-muted-foreground text-sm">
                  {provider.health.message}
                </p>
              ) : null}

              {actionError ? (
                <p role="alert" className="text-destructive text-sm">
                  {actionError.message}
                </p>
              ) : null}

              {search.data && search.data.items.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No results found.
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {search.data?.items.map((candidate) => (
                  <article
                    key={`${candidate.providerId}:${candidate.providerAssetId}`}
                    className="overflow-hidden rounded-lg border"
                  >
                    {candidate.kind === "video" ? (
                      <video
                        className="aspect-video w-full bg-black object-cover"
                        src={candidate.renderRenditions[0]?.url}
                        poster={candidate.previewUrl}
                        muted
                        controls
                        preload="metadata"
                      />
                    ) : (
                      // Provider previews are remote by contract and cannot use Next image optimization.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="aspect-video w-full object-cover"
                        src={candidate.previewUrl}
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <div className="grid gap-2 p-3">
                      <div className="text-xs">
                        <p className="line-clamp-2 font-medium">
                          {candidate.attribution.text}
                        </p>
                        <a
                          href={candidate.sourcePageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground inline-flex items-center gap-1 hover:underline"
                        >
                          View source <ExternalLink className="size-3" />
                        </a>
                      </div>
                      <Button
                        size="sm"
                        disabled={select.isPending}
                        onClick={() => void choose(candidate)}
                      >
                        {select.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : null}
                        Select {candidate.kind}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {clear.error ? (
        <p className="text-destructive text-xs">{clear.error.message}</p>
      ) : null}
    </div>
  );
}
