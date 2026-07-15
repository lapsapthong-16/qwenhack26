import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readRecord, writeRecord } from "./database.ts";

export type DecisionVerdict = "Allow" | "Review" | "Block";
export type DecisionValidity = "active" | "revoked" | "expired";
export type InstallationVerification = "not-applicable" | "pending" | "verified" | "failed";
export type WorkspaceDecision = {
  workspaceId: string; repoIdentity: string; branch?: string; policyName: string; policyHash: string;
  dependencyStateId: string; reviewId: string; verdict: DecisionVerdict; validity: DecisionValidity;
  installationVerification: InstallationVerification; approvedBy: string; approvedAt: string; recordedAt: string;
  verifiedAt?: string; expiresAt?: string; lockfileHash: string; commitSha?: string; auditReason?: string;
};

export type DecisionLookup = { workspaceId: string; repoIdentity: string; policyHash: string; dependencyStateId: string; lockfileHash: string };

export function requireWorkspaceActor(headers: Headers, env = process.env) {
  const workspaceId = headers.get("x-locksmith-workspace") || env.LOCKSMITH_WORKSPACE_ID;
  const actor = headers.get("x-locksmith-actor") || env.LOCKSMITH_ACTOR;
  if (!workspaceId || !actor) throw new Error("Authenticated workspace and actor are required for team decisions");
  return { workspaceId, actor };
}

export function canonicalRepoIdentity(value: string) {
  const raw = value.trim();
  if (!raw || raw.startsWith("local:")) return raw.startsWith("local:") ? raw : `local:${resolve(raw || ".")}`;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!url.hostname) throw new Error("missing host");
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
    if (!path || path.split("/").length < 2) throw new Error("missing repository path");
    return `${host}/${path}`;
  } catch { return `local:${resolve(raw)}`; }
}

export function policyHash(policy: string) { return `policy_${createHash("sha256").update(JSON.stringify({ version: 1, policy })).digest("hex").slice(0, 24)}`; }
export function lockfileHash(content: string) { return `sha256:${createHash("sha256").update(content).digest("hex")}`; }

function completeActiveAllow(decision: WorkspaceDecision, now = new Date()) {
  const dates = [decision.approvedAt, decision.recordedAt, decision.expiresAt].filter(Boolean).map(value => Date.parse(value!));
  return decision.verdict === "Allow" && decision.validity === "active" && Boolean(decision.workspaceId && decision.repoIdentity && decision.policyName && decision.policyHash && decision.reviewId && decision.approvedBy && decision.approvedAt && decision.recordedAt && decision.lockfileHash && decision.dependencyStateId) && dates.every(Number.isFinite) && (!decision.expiresAt || now.getTime() < Date.parse(decision.expiresAt));
}

export function findExactReusableApproval(decisions: WorkspaceDecision[], lookup: DecisionLookup, now = new Date()) {
  return decisions.find(item => completeActiveAllow(item, now) && item.workspaceId === lookup.workspaceId && item.repoIdentity === lookup.repoIdentity && item.policyHash === lookup.policyHash && item.dependencyStateId === lookup.dependencyStateId && item.lockfileHash === lookup.lockfileHash);
}

export function findLastApprovedBaseline(decisions: WorkspaceDecision[], lookup: Omit<DecisionLookup, "dependencyStateId" | "lockfileHash">, now = new Date()) {
  return decisions.filter(item => completeActiveAllow(item, now) && item.workspaceId === lookup.workspaceId && item.repoIdentity === lookup.repoIdentity && item.policyHash === lookup.policyHash).sort((a, b) => b.approvedAt.localeCompare(a.approvedAt) || b.reviewId.localeCompare(a.reviewId))[0];
}

export async function readTrustPointer(rootDir: string) {
  try { return JSON.parse(await readFile(join(resolve(rootDir), ".locksmith", "locksmith.json"), "utf8")) as Record<string, string>; }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined; throw error; }
}

export async function readWorkspaceDecisions(rootDir = process.cwd()): Promise<WorkspaceDecision[]> {
  if (rootDir === process.cwd() && process.env.DATABASE_URL) return readRecord("workspace-decisions", "global", []);
  try { return JSON.parse(await readFile(join(resolve(rootDir), ".locksmith", "workspace-decisions.json"), "utf8")) as WorkspaceDecision[]; }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return []; throw error; }
}

export async function writeWorkspaceDecisions(items: WorkspaceDecision[], rootDir = process.cwd()) {
  if (rootDir === process.cwd() && process.env.DATABASE_URL) { await writeRecord("workspace-decisions", "global", items); return; }
  const dir = join(resolve(rootDir), ".locksmith"); await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "workspace-decisions.json"), JSON.stringify(items, null, 2));
}

export async function writeTrustPointer(rootDir: string, decision: WorkspaceDecision) {
  if (decision.verdict !== "Allow" || decision.validity !== "active") throw new Error("Only active Allow decisions can create a trust pointer");
  const dir = join(resolve(rootDir), ".locksmith"); await mkdir(dir, { recursive: true });
  const pointer = { workspace: decision.workspaceId, reviewId: decision.reviewId, dependencyStateId: decision.dependencyStateId, approvedCommit: decision.commitSha, lockfileHash: decision.lockfileHash, policy: decision.policyName, verdict: "allow", approvedAt: decision.approvedAt };
  await writeFile(join(dir, "locksmith.json"), JSON.stringify(pointer, null, 2) + "\n", "utf8");
  return pointer;
}

export function validateTrustPointer(pointer: Record<string, string> | undefined, decision: WorkspaceDecision, candidate: Pick<DecisionLookup, "workspaceId" | "dependencyStateId" | "lockfileHash" | "policyHash"> & { reviewId: string; repoIdentity: string; commitSha?: string }) {
  if (!pointer) return false;
  return pointer.workspace === decision.workspaceId && pointer.reviewId === decision.reviewId && candidate.policyHash === decision.policyHash && pointer.dependencyStateId === candidate.dependencyStateId && pointer.dependencyStateId === decision.dependencyStateId && pointer.lockfileHash === candidate.lockfileHash && pointer.lockfileHash === decision.lockfileHash && pointer.policy === decision.policyName && (!candidate.commitSha || pointer.approvedCommit === candidate.commitSha) && candidate.repoIdentity === decision.repoIdentity;
}

export function dependencyDiff(previous: Record<string, string> = {}, current: Record<string, string> = {}) {
  const names = new Set([...Object.keys(previous), ...Object.keys(current)]);
  return [...names].sort().map(name => {
    const before = previous[name], after = current[name];
    return { name, before, after, change: !before ? "added" : !after ? "removed" : before === after ? "unchanged" : "updated" } as const;
  });
}
