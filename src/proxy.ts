import { NextResponse, type NextRequest } from "next/server";

import { assertAllowedHost } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

// Defense in depth against DNS rebinding. Each API/media handler still checks
// authorization independently; Proxy is not the authorization boundary.
export function proxy(request: NextRequest) {
  try {
    assertAllowedHost(request);
    return NextResponse.next();
  } catch (error) {
    return errorResponse(error);
  }
}
