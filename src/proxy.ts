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

// The proxy buffers each request body (10 MB by default) so it can be read twice,
// which would cut a large recording upload short. That route is left out; its
// handler checks the host itself and reads the body with a hard size limit.
export const config = { matcher: ["/((?!api/recordings$).*)"] };
