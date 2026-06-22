import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ProviderError } from "@/providers/voice/types";
import { AIError } from "@/providers/ai/types";

/** Map thrown errors to JSON responses with sensible status codes and messages. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ProviderError || e instanceof AIError) {
    const status = e.status >= 400 && e.status < 600 ? e.status : 502;
    return NextResponse.json(
      { error: e.message, providerId: e.providerId },
      { status },
    );
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Unexpected response shape from provider", issues: e.issues },
      { status: 502 },
    );
  }
  if (e instanceof Error) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Unknown error" }, { status: 500 });
}
