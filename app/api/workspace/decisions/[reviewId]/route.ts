import { NextResponse } from "next/server";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireWorkspaceActor, type WorkspaceDecision } from "../../../../../lib/workspaceDecisions";

export const runtime = "nodejs";
const path = join(process.cwd(), ".locksmith", "workspace-decisions.json");
async function readAll(): Promise<WorkspaceDecision[]> { try { return JSON.parse(await readFile(path, "utf8")) as WorkspaceDecision[]; } catch (e) { if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") return []; throw e; } }
export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  let actor: { workspaceId: string; actor: string };
  try { actor = requireWorkspaceActor(request.headers); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication required" }, { status: 401 }); }
  const { reviewId } = await params; const body = await request.json().catch(() => ({})) as { action?: string };
  const all = await readAll(); const current = all.find(item => item.reviewId === reviewId && item.workspaceId === actor.workspaceId);
  if (!current) return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  if (body.action !== "revoke" && body.action !== "verify") return NextResponse.json({ error: "action must be revoke or verify" }, { status: 400 });
  const next: WorkspaceDecision = body.action === "revoke"
    ? { ...current, reviewId: `${current.reviewId}-revoked-${Date.now()}`, validity: "revoked", approvedBy: actor.actor, recordedAt: new Date().toISOString(), auditReason: "Revoked by workspace actor" }
    : { ...current, reviewId: `${current.reviewId}-verified-${Date.now()}`, installationVerification: "verified", verifiedAt: new Date().toISOString(), approvedBy: actor.actor, recordedAt: new Date().toISOString(), auditReason: "Installation verified by workspace actor" };
  all.push(next); await mkdir(join(process.cwd(), ".locksmith"), { recursive: true }); await writeFile(path, JSON.stringify(all, null, 2));
  return NextResponse.json(next, { status: 201 });
}
