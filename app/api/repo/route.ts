import { NextResponse } from "next/server";
import { inspectGitHubRepo } from "../../../lib/locksmith";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { repo?: string; repoUrl?: string };
    const repoUrl = body.repoUrl || body.repo;
    if (!repoUrl) throw new Error("Repository URL is required");
    return NextResponse.json(await inspectGitHubRepo(repoUrl));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Repository lookup failed" }, { status: 400 });
  }
}
