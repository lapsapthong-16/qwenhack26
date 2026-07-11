import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { dependencyStateId, reviewDependencies, type ReviewResult } from "./locksmith.ts";
import { renderHtmlReport } from "./renderHtmlReport.ts";
import { findExactDecision, findFinalizedInstallApproval, saveReview, withDecisionMetadata, type StoredReview } from "./reviewHistory.ts";

export type LocalReview = { result: StoredReview; reused: boolean; reportPath: string };

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
  const lookup = { projectIdentity: identity, dependencyStateId: state, policy };
  const finalized = await findFinalizedInstallApproval(lookup, { rootDir: root });
  if (finalized) return { result: finalized, reused: true, reportPath: finalized.reportPath || join(root, ".locksmith", "reports", `${finalized.reviewId}.html`) };
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
  const sanitized = await saveReview(stored, { rootDir: root });
  await saveCliReport(sanitized, root);
  return { result: sanitized, reused: false, reportPath };
}
