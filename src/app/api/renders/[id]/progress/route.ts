import { getRender } from "@/library/repositories/renders";
import { subscribeToJob } from "@/lib/render-queue";
import type { RenderDTO } from "@/lib/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE endpoint: streams render progress events until the job finishes or the
 * client disconnects. Falls back to a single DB read for already-done jobs.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // If the job is already done/errored in the DB, return it immediately.
  const existing = await getRender(id);
  if (existing && (existing.status === "done" || existing.status === "error")) {
    return sseResponse(existing);
  }

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      function send(job: { id: string; progress: number; status: string; error?: string; outputUrl?: string }) {
        const data = JSON.stringify({
          id: job.id,
          progress: job.progress,
          status: job.status,
          error: job.error ?? null,
          outputUrl: job.outputUrl ?? null,
        });
        controller.enqueue(enc.encode(`data: ${data}\n\n`));
        if (job.status === "done" || job.status === "error") {
          try { controller.close(); } catch { /* already closed */ }
        }
      }

      const unsub = subscribeToJob(id, send);

      // Heartbeat every 5s to keep the connection alive through proxies.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 5000);

      // Cleanup when client disconnects.
      _req.signal?.addEventListener("abort", () => {
        unsub();
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* ok */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function sseResponse(render: RenderDTO) {
  const data = JSON.stringify({
    id: render.id,
    progress: render.progress,
    status: render.status,
    error: render.error,
    outputUrl: render.outputUrl,
  });
  return new Response(`data: ${data}\n\n`, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
