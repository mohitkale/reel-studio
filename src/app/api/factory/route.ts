import { NextResponse } from "next/server";
import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { prisma } from "@/library/db";
import {
  listFactoryProfiles,
  listFactoryRuns,
} from "@/library/factory-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    authorizeRequest(req, "studio:read");
    const [profiles, runs, packs, revisions] = await Promise.all([
      listFactoryProfiles(),
      listFactoryRuns(),
      prisma.factoryPack.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
      prisma.productionRevision.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          scriptId: true,
          revisionHash: true,
          source: true,
          createdAt: true,
          script: { select: { name: true } },
        },
      }),
    ]);
    return NextResponse.json({
      profiles,
      runs,
      packs: packs.map(({ manifestJson, ...pack }) => ({
        ...pack,
        manifest: JSON.parse(manifestJson) as unknown,
      })),
      revisions,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
