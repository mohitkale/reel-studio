"use client";

import * as React from "react";
import { Library, Upload, Trash2, Copy, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { useAssets, useUploadAsset, useDeleteAsset } from "@/hooks/assets";
import type { AssetDTO } from "@/lib/dto";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.svg,.json";

function LottiePreview({ url }: { url: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let anim: any = null;

    (async () => {
      try {
        const [json, lottie] = await Promise.all([
          fetch(url).then((r) => r.json()),
          import("lottie-web").then((m) => m.default),
        ]);
        if (destroyed || !containerRef.current) return;
        anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: json,
        });
      } catch {
        // leave container empty on failure
      }
    })();

    return () => {
      destroyed = true;
      anim?.destroy();
    };
  }, [url]);

  return <div ref={containerRef} className="h-full w-full" aria-hidden="true" />;
}

function AssetCard({ asset, onDelete }: { asset: AssetDTO; onDelete: () => void }) {
  function copyUrl() {
    navigator.clipboard.writeText(window.location.origin + asset.url).then(() =>
      toast.success("URL copied"),
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
        {asset.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.name ?? "Asset"}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <LottiePreview url={asset.url} />
        )}
        <div className="absolute inset-0 flex items-end justify-end gap-1 bg-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="icon" variant="outline" className="size-7" onClick={copyUrl} aria-label="Copy URL">
            <Copy className="size-3.5" />
          </Button>
          <Button size="icon" variant="destructive" className="size-7" onClick={onDelete} aria-label="Delete asset">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-xs font-medium">{asset.name ?? "Untitled"}</p>
        <Badge variant="secondary" className="mt-0.5 text-[10px]">
          {asset.type}
        </Badge>
      </div>
    </div>
  );
}

type Filter = "all" | "image" | "lottie";

export default function AssetsPage() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [isDragging, setIsDragging] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<AssetDTO | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: assets = [], isLoading } = useAssets(filter === "all" ? undefined : filter);
  const upload = useUploadAsset();
  const deleteAsset = useDeleteAsset();

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);
      try {
        await upload.mutateAsync(formData);
        toast.success(`${file.name} uploaded`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }

  const uploadButton = (
    <>
      <Button
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={upload.isPending}
      >
        <Upload className="size-3.5" />
        Upload
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={onFileInputChange}
      />
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Upload images and Lottie JSON for use in scenes. Copy a URL to paste into a scene's visual field."
        actions={uploadButton}
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="lottie">Lottie</TabsTrigger>
        </TabsList>
      </Tabs>

      <div
        className="min-h-48 rounded-xl"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{ outline: isDragging ? "2px dashed hsl(var(--accent))" : undefined }}
      >
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-xl" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No assets yet"
            description="Upload images or Lottie JSON files. Drag and drop anywhere on this page, or click Upload above."
            action={
              <Button onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
                <Upload className="size-3.5" />
                Upload your first asset
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={() => setDeleteTarget(asset)}
              />
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <div className="text-center">
                <ImageIcon className="mx-auto mb-1 size-6" />
                <span className="text-xs">Upload more</span>
              </div>
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete asset?"
        description={`"${deleteTarget?.name ?? "This asset"}" will be permanently removed.`}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteAsset.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
            onError: () => toast.error("Failed to delete asset"),
          });
        }}
        isPending={deleteAsset.isPending}
      />
    </div>
  );
}
