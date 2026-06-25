import { NextResponse } from "next/server";
import type { ReviewInput } from "../../../lib/locksmith";
import { startReview } from "../../../lib/reviewJobs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as ReviewInput & { repo?: string };
    if (!body || typeof body !== "object") throw new Error("Expected a JSON object");
    const input = { ...body, repoUrl: body.repoUrl || body.repo };
    return NextResponse.json(startReview(input));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review failed" }, { status: 400 });
  }
}
