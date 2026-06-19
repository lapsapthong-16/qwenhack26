import { NextResponse } from "next/server";
import { reviewDependencies, type ReviewInput } from "../../../lib/locksmith";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as ReviewInput & { repo?: string };
    if (!body || typeof body !== "object") throw new Error("Expected a JSON object");
    const input = { ...body, repoUrl: body.repoUrl || body.repo };
    return NextResponse.json(await reviewDependencies(input));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review failed" }, { status: 400 });
  }
}
