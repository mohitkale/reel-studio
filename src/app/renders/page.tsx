"use client";

import * as React from "react";
import { ListVideo, Download, AlertCircle, CheckCircle2, Loader2, Clock, RefreshCcw, Maximize2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useRenders, useRenderProgress, useCreateRender, useDeleteRender } from "@/hooks/renders";
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

function RenderCard({ render: initial }: { render: RenderDTO }) {
  const [render, setRender] = React.useState(initial);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const createRender = useCreateRender();
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
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Render {render.id.slice(-8)}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(render.createdAt).toLocaleString()}
              </p>
            </div>
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
            <div className="flex flex-col gap-2">
              <video
                ref={videoRef}
                src={render.outputUrl}
                controls
                className="mx-auto w-full max-w-[180px] rounded-xl border"
                style={{ aspectRatio: "9/16" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={requestFullscreen}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  aria-label="Watch fullscreen"
                >
                  <Maximize2 className="size-3" />
                  Fullscreen
                </button>
                <a
                  href={render.outputUrl}
                  download
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  <Download className="size-3" />
                  Download MP4
                </a>
              </div>
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
