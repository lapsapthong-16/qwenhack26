import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { dependencyStateId, reviewDependencies, type ReviewResult } from "./locksmith.ts";
import { renderHtmlReport } from "./renderHtmlReport.ts";
import { findExactDecision, findFinalizedInstallApproval, saveReview, withDecisionMetadata, type StoredReview } from "./reviewHistory.ts";
import { canonicalRepoIdentity, lockfileHash, policyHash, readTrustPointer, type WorkspaceDecision, validateTrustPointer } from "./workspaceDecisions.ts";

export type LocalReview = { result: StoredReview; reused: boolean; reportPath: string; workspaceDecision?: WorkspaceDecision };

export function projectIdentity(rootDir: string) {
  return `local:${resolve(rootDir)}`;
}

export async function readNpmFiles(rootDir: string) {
  const root = resolve(rootDir);
  const files: Record<string, string> = {};
  for (const name of ["package.json", "package-lock.json"]) {
    try { files[name] = await readFile(join(root, name), "utf8"); }
    catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  if (!files["package.json"] || !files["package-lock.json"]) throw new Error("package.json and package-lock.json are required for guarded npm install.");
  return files;
}

async function saveCliReport(review: StoredReview, rootDir: string) {
  const reportPath = join(resolve(rootDir), ".locksmith", "reports", `${review.reviewId}.html`);
  await mkdir(join(resolve(rootDir), ".locksmith", "reports"), { recursive: true });
  await writeFile(reportPath, renderHtmlReport(review), "utf8");
  return reportPath;
}

export async function reviewLocalNpmCandidate({ rootDir, files, policy = "strict" }:{ rootDir: string; files: Record<string, string>; policy?: string }): Promise<LocalReview> {
  const root = resolve(rootDir);
  const identity = projectIdentity(root);
  const state = dependencyStateId(files);
  const lookup = { projectIdentity: identity, dependencyStateId: state, policy, lockfileHash: lockfileHash(files["package-lock.json"]) };
  const decisionUrl = process.env.LOCKSMITH_DECISION_URL;
  const workspaceId = process.env.LOCKSMITH_WORKSPACE_ID;
  const connected = Boolean(decisionUrl || workspaceId);
  let sharedExact = false;
  let sharedDecision: WorkspaceDecision | undefined;
  if (connected) {
    if (!decisionUrl || !workspaceId) throw new Error("Connected Locksmith mode requires LOCKSMITH_DECISION_URL and LOCKSMITH_WORKSPACE_ID");
    const url = new URL(decisionUrl); url.searchParams.set("workspaceId", workspaceId); url.searchParams.set("repoIdentity", canonicalRepoIdentity(process.env.LOCKSMITH_REPO_URL || identity)); url.searchParams.set("policyHash", policyHash(policy)); url.searchParams.set("dependencyStateId", state); url.searchParams.set("lockfileHash", lookup.lockfileHash);
    let response: Response;
    try { response = await fetch(url, { headers: { "x-locksmith-workspace": workspaceId, "x-locksmith-actor": process.env.LOCKSMITH_ACTOR || "" }, signal: AbortSignal.timeout(5_000) }); }
    catch (error) { throw new Error(`Connected workspace decision service unavailable: ${error instanceof Error ? error.message : "request failed"}`); }
    if (!response.ok) throw new Error(`Connected workspace decision service rejected lookup (${response.status})`);
    const payload = await response.json() as { exact?: WorkspaceDecision };
    sharedDecision = payload.exact;
    sharedExact = Boolean(sharedDecision?.reviewId);
  }
  const finalized = await findFinalizedInstallApproval(lookup, { rootDir: root });
  if (finalized && (!connected || sharedExact)) {
    if (connected) {
      const pointer = await readTrustPointer(root);
      if (!validateTrustPointer(pointer, sharedDecision!, { workspaceId: workspaceId!, repoIdentity: canonicalRepoIdentity(process.env.LOCKSMITH_REPO_URL || identity), policyHash: policyHash(policy), reviewId: finalized.reviewId!, dependencyStateId: state, lockfileHash: lookup.lockfileHash })) throw new Error("Connected install requires a matching Locksmith trust pointer");
    }
    return { result: finalized, reused: true, workspaceDecision: sharedDecision, reportPath: finalized.reportPath || join(root, ".locksmith", "reports", `${finalized.reviewId}.html`) };
  }
  const existing = await findExactDecision(lookup, { rootDir: root });
  if (existing && (existing.verdict === "Review" || existing.verdict === "Block")) return { result: existing, reused: true, reportPath: existing.reportPath || join(root, ".locksmith", "reports", `${existing.reviewId}.html`) };

  const analysis: ReviewResult = await reviewDependencies({
    files,
    source: `local:${identity}`,
    projectIdentity: identity,
    storageRoot: root,
    policy,
    requireFullNpmCoverage: true,
  });
  const reviewId = `rev_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const createdAt = new Date().toISOString();
  const reportPath = join(root, ".locksmith", "reports", `${reviewId}.html`);
  const stored = withDecisionMetadata({ ...analysis, reviewId, createdAt }, {
    projectIdentity: identity,
    reportPath,
    decisionKind: "install-approval",
    decisionStatus: analysis.verdict === "Allow" ? "pending-install" : "analysis",
  });
  stored.lockfileHash = lookup.lockfileHash;
  stored.validity = "active";
  stored.installationVerification = analysis.verdict === "Allow" ? "pending" : "not-applicable";
  const sanitized = await saveReview(stored, { rootDir: root });
  await saveCliReport(sanitized, root);
  return { result: sanitized, reused: false, reportPath };
}
