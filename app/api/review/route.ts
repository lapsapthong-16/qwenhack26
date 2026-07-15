import { NextResponse } from "next/server";
import type { ReviewInput } from "../../../lib/locksmith";
import { startReview } from "../../../lib/reviewJobs";
import { requireWorkspaceActor } from "../../../lib/workspaceDecisions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as ReviewInput & { repo?: string };
    if (!body || typeof body !== "object") throw new Error("Expected a JSON object");
    const input = { ...body, repoUrl: body.repoUrl || body.repo };
    const workspaceHeader = request.headers.get("x-locksmith-workspace");
    const actorHeader = request.headers.get("x-locksmith-actor");
    if (workspaceHeader || actorHeader) {
      const identity = requireWorkspaceActor(request.headers);
      input.workspaceId = identity.workspaceId;
      input.source = input.repoUrl;
    }
    return NextResponse.json(startReview(input));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review failed" }, { status: 400 });
  }
}
