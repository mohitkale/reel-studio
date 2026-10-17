import { NextResponse } from "next/server";
import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { archiveFactoryProfile } from "@/library/factory-service";
export const runtime = "nodejs";
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "studio:write");
    const { id } = await params;
    await archiveFactoryProfile(id);
    return NextResponse.json({ archived: true });
  } catch (error) {
    return errorResponse(error);
  }
}
