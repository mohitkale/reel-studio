import { getVoiceJob, subscribeToVoiceJob, type VoiceJob } from "@/lib/voice-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE endpoint: streams voice-generation progress for one job until it
 * finishes (done/error) or the client disconnects. The final "done" message
 * carries the created take so the client never needs a second round-trip.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; jobId: string }> },
) {
  const { jobId } = await ctx.params;

  const existing = getVoiceJob(jobId);
  if (existing && (existing.status === "done" || existing.status === "error")) {
    return sseResponse(existing);
  }

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      function send(job: VoiceJob) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(toPayload(job))}\n\n`));
        if (job.status === "done" || job.status === "error") {
          try { controller.close(); } catch { /* already closed */ }
        }
      }

      const unsub = subscribeToVoiceJob(jobId, send);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 5000);

      req.signal?.addEventListener("abort", () => {
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

function toPayload(job: VoiceJob) {
  return {
    status: job.status,
    scene: job.scene,
    sceneCount: job.sceneCount,
    workingOn: job.workingOn ?? null,
    error: job.error ?? null,
    take: job.take ?? null,
  };
}

function sseResponse(job: VoiceJob) {
  return new Response(`data: ${JSON.stringify(toPayload(job))}\n\n`, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
