import {
  readBoundedBody,
  RequestBodyError,
  DEFAULT_JSON_BYTES,
} from "@/server/request-body";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

import { MusicProviderError } from "@/providers/music/types";
import { ProviderError } from "@/providers/voice/types";
import { AIError } from "@/providers/ai/types";
import { StockError } from "@/providers/stock/types";

export class ClientInputError extends Error {
  constructor(readonly issues?: ZodError["issues"]) {
    super("Invalid request input");
  }
}

/** Mark validation at the request boundary, never at provider response parsing. */
export function parseClientInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ClientInputError(parsed.error.issues);
  return parsed.data;
}

export async function readRequestJson(
  req: Request,
  { allowEmpty = false, maxBytes = DEFAULT_JSON_BYTES } = {},
): Promise<unknown> {
  try {
    const raw = new TextDecoder().decode(await readBoundedBody(req, maxBytes));
    if (allowEmpty && raw.length === 0) return {};
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) throw new ClientInputError();
    throw error;
  }
}

/** Map thrown errors to JSON responses with sensible status codes and messages. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof RequestBodyError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ClientInputError) {
    return NextResponse.json(
      { error: e.message, issues: e.issues },
      { status: 400 },
    );
  }
  if (
    e instanceof ProviderError ||
    e instanceof MusicProviderError ||
    e instanceof AIError ||
    e instanceof StockError
  ) {
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
