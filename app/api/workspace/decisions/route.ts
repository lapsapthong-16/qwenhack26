import { NextResponse } from "next/server";
import { findExactReusableApproval, findLastApprovedBaseline, readWorkspaceDecisions, requireWorkspaceActor, writeWorkspaceDecisions, type WorkspaceDecision } from "../../../../lib/workspaceDecisions";

export const runtime = "nodejs";
const readAll = () => readWorkspaceDecisions();
const save = (items: WorkspaceDecision[]) => writeWorkspaceDecisions(items);

export async function GET(request: Request) {
  let actor: { workspaceId: string; actor: string };
  try { actor = requireWorkspaceActor(request.headers); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication required" }, { status: 401 }); }
  const q = new URL(request.url).searchParams; const all = await readAll();
  const workspaceId = actor.workspaceId; const repoIdentity = q.get("repoIdentity") || ""; const policyHash = q.get("policyHash") || "";
  if (!workspaceId || !repoIdentity || !policyHash) return NextResponse.json({ error: "workspaceId, repoIdentity, and policyHash are required" }, { status: 400 });
  const exact = q.get("dependencyStateId") && q.get("lockfileHash") ? findExactReusableApproval(all, { workspaceId, repoIdentity, policyHash, dependencyStateId: q.get("dependencyStateId")!, lockfileHash: q.get("lockfileHash")! }) : undefined;
  const baseline = findLastApprovedBaseline(all, { workspaceId, repoIdentity, policyHash });
  return NextResponse.json({ exact, baseline });
}

export async function POST(request: Request) {
  let actor: { workspaceId: string; actor: string };
  try { actor = requireWorkspaceActor(request.headers); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication required" }, { status: 401 }); }
  const decision = await request.json() as WorkspaceDecision;
  if (decision.workspaceId !== actor.workspaceId || decision.approvedBy !== actor.actor) return NextResponse.json({ error: "Decision actor does not match authenticated workspace" }, { status: 403 });
  if (!decision.workspaceId || !decision.repoIdentity || !decision.policyName || !decision.policyHash || !decision.dependencyStateId || !decision.reviewId || !decision.approvedBy || !decision.approvedAt || !decision.recordedAt || !decision.lockfileHash || !decision.installationVerification) return NextResponse.json({ error: "Incomplete workspace decision" }, { status: 400 });
  if (decision.verdict === "Allow" && decision.validity !== "active") return NextResponse.json({ error: "Allow decisions must be active when recorded" }, { status: 400 });
  const all = await readAll(); if (all.some(item => item.reviewId === decision.reviewId)) return NextResponse.json({ error: "Recorded decisions are immutable; create a superseding review" }, { status: 409 });
  all.push(decision); await save(all); return NextResponse.json(decision, { status: 201 });
}
