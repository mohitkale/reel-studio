"use client";

import * as React from "react";
import { ListVideo, Download, AlertCircle, CheckCircle2, Loader2, Clock, RefreshCcw, Maximize2, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

import { useRenders, useRenderProgress, useCreateRender, useRenameRender, useDeleteRender } from "@/hooks/renders";
import type { RenderDTO } from "@/lib/dto";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  queued: Clock,
  bundling: Loader2,
  rendering: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  bundling: "Bundling...",
  rendering: "Rendering...",
  done: "Done",
  error: "Failed",
};

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
const STATUS_COLOR: Record<string, BadgeVariant> = {
  queued: "secondary",
  bundling: "secondary",
  rendering: "secondary",
  done: "default",
  error: "destructive",
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function RenderCard({ render: initial }: { render: RenderDTO }) {
  const [render, setRender] = React.useState(initial);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [nameInput, setNameInput] = React.useState(render.name ?? "");
  const [duration, setDuration] = React.useState<number | null>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const createRender = useCreateRender();
  const renameRender = useRenameRender();
  const deleteRender = useDeleteRender();
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const handleUpdate = React.useCallback(
    (data: { progress: number; status: string; error: string | null; outputUrl: string | null }) => {
      setRender((prev) => ({
        ...prev,
        progress: data.progress,
        status: data.status as RenderDTO["status"],
        error: data.error,
        outputUrl: data.outputUrl,
      }));
    },
    [],
  );

  const isActive = render.status === "queued" || render.status === "bundling" || render.status === "rendering";
  useRenderProgress(isActive ? render.id : null, handleUpdate);

  const Icon = STATUS_ICONS[render.status] ?? Clock;
  const isSpinner = render.status === "bundling" || render.status === "rendering";
  const displayName = render.name ?? `Render ${render.id.slice(-8)}`;

  function startRename() {
    setNameInput(render.name ?? "");
    setRenaming(true);
    setTimeout(() => nameRef.current?.select(), 30);
  }

  function commitRename() {
    const trimmed = nameInput.trim();
    renameRender.mutate(
      { id: render.id, name: trimmed },
      {
        onSuccess: (updated) => {
          setRender((prev) => ({ ...prev, name: updated.name }));
          setRenaming(false);
        },
        onError: () => toast.error("Failed to rename"),
      },
    );
  }

  function cancelRename() {
    setRenaming(false);
    setNameInput(render.name ?? "");
  }

  function requestFullscreen() {
    if (videoRef.current) {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              {renaming ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={nameRef}
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") cancelRename();
                    }}
                    onBlur={commitRename}
                    className="flex-1 truncate rounded border border-border bg-background px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={`Render ${render.id.slice(-8)}`}
                    maxLength={120}
                  />
                  <button onMouseDown={(e) => e.preventDefault()} onClick={commitRename} className="rounded p-0.5 hover:bg-accent" aria-label="Save name"><Check className="size-3.5 text-primary" /></button>
                  <button onClick={cancelRename} className="rounded p-0.5 hover:bg-accent" aria-label="Cancel rename"><X className="size-3.5 text-muted-foreground" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <button
                    onClick={startRename}
                    className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                    aria-label="Rename render"
                  >
                    <Pencil className="size-3 text-muted-foreground" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(render.createdAt).toLocaleString()}
              </p>
            </div>
            {!renaming && (
              <div className="flex items-center gap-1">
                <Badge variant={STATUS_COLOR[render.status] ?? "secondary"} className="shrink-0 gap-1.5">
                  <Icon className={`size-3 ${isSpinner ? "animate-spin" : ""}`} />
                  {STATUS_LABEL[render.status] ?? render.status}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label="Delete render"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          {isActive && (
            <div className="space-y-1">
              <ProgressBar value={render.progress} />
              {render.status === "bundling" && (
                <p className="text-xs text-muted-foreground">
                  Compiling the video composition (first render only -- downloads Chromium if needed).
                </p>
              )}
              {render.status === "rendering" && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(render.progress * 100)}% rendered
                </p>
              )}
            </div>
          )}

          {render.status === "done" && render.outputUrl && (
            <div className="space-y-1.5">
              <div
                className="group relative w-full overflow-hidden rounded-xl border bg-black"
                style={{ aspectRatio: "9/16" }}
              >
                <video
                  ref={videoRef}
                  src={render.outputUrl}
                  controls
                  className="h-full w-full"
                  onLoadedMetadata={(e) =>
                    setDuration((e.target as HTMLVideoElement).duration)
                  }
                />
                {/* Overlay: fullscreen + download (visible on hover) */}
                <div className="pointer-events-none absolute right-0 top-0 flex items-center gap-1 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="pointer-events-auto rounded-md bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                    onClick={requestFullscreen}
                    aria-label="Fullscreen"
                  >
                    <Maximize2 className="size-3.5" />
                  </button>
                  <a
                    href={render.outputUrl}
                    download
                    className="pointer-events-auto rounded-md bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                    aria-label="Download MP4"
                  >
                    <Download className="size-3.5" />
                  </a>
                </div>
              </div>
              {duration !== null && (
                <p className="text-center text-xs text-muted-foreground">
                  {formatDuration(duration)}
                </p>
              )}
            </div>
          )}

          {render.status === "error" && (
            <div className="space-y-2">
              {render.error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {render.error}
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={createRender.isPending}
                onClick={() =>
                  createRender.mutate({
                    scriptId: render.scriptId,
                    voiceTakeId: render.voiceTakeId ?? undefined,
                  })
                }
              >
                {createRender.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="size-3.5" />
                )}
                Retry render
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete render?"
        description={
          <p>
            The MP4 file will be permanently deleted. Your project, scenes, and voice takes are not
            affected — renders are standalone exports. To remove project content, open the project.
          </p>
        }
        confirmLabel="Delete render"
        onConfirm={() => {
          deleteRender.mutate(render.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              toast.success("Render deleted");
            },
            onError: () => toast.error("Failed to delete render"),
          });
        }}
        isPending={deleteRender.isPending}
      />
    </>
  );
}

export default function RendersPage() {
  const { data: renders, isLoading } = useRenders();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Renders"
        description="Track render jobs and download finished MP4 videos."
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : !renders?.length ? (
        <EmptyState
          icon={ListVideo}
          title="No renders yet"
          description='Open a project in the editor and click "Render" to start a render job. The first render downloads a headless Chromium build (~170 MB).'
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {renders.map((r) => (
            <RenderCard key={r.id} render={r} />
          ))}
        </div>
      )}
    </div>
  );
}
