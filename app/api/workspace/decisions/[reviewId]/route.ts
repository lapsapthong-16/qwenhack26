import { NextResponse } from "next/server";
import { readWorkspaceDecisions, requireWorkspaceActor, writeWorkspaceDecisions, type WorkspaceDecision } from "../../../../../lib/workspaceDecisions";

export const runtime = "nodejs";
const readAll = () => readWorkspaceDecisions();
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
  all.push(next); await writeWorkspaceDecisions(all);
  return NextResponse.json(next, { status: 201 });
}
