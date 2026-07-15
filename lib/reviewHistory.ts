import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { sanitizeReviewForStorage } from "./evidenceRetention.ts";
import type { ReviewResult, Verdict } from "./locksmith.ts";
import { findLastApprovedBaseline as selectBaseline, findExactReusableApproval as selectExact, type WorkspaceDecision } from "./workspaceDecisions.ts";

/** The web app intentionally uses its own working directory; callers such as the
 * CLI pass `rootDir` so a decision always stays with the inspected project. */
export type ReviewStorageOptions = { rootDir?: string };
export type DecisionKind = "analysis" | "install-approval";
export type DecisionStatus = "analysis" | "pending-install" | "install-finalized";

export type StoredReview = ReviewResult & {
  decisionKind?: DecisionKind;
  decisionStatus?: DecisionStatus;
  projectIdentity?: string;
  reportPath?: string;
  finalizedAt?: string;
  installError?: string;
  workspaceId?: string;
  repoIdentity?: string;
  policyHash?: string;
  lockfileHash?: string;
  validity?: "active" | "revoked" | "expired";
  installationVerification?: "not-applicable" | "pending" | "verified" | "failed";
  approvedBy?: string;
  approvedAt?: string;
  verifiedAt?: string;
  recordedAt?: string;
  expiresAt?: string;
};

export type HistoryFile = { reviews: StoredReview[] };
export type DecisionLookup = {
  projectIdentity: string;
  dependencyStateId: string;
  policy: string;
  lockfileHash?: string;
};

function rootFor(options: ReviewStorageOptions = {}) {
  return resolve(options.rootDir || process.cwd());
}

function historyPathFor(options: ReviewStorageOptions = {}) {
  return join(rootFor(options), ".locksmith", "reviews.json");
}

function isNotFound(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

/** Reads retained reviews. Malformed history is deliberately not treated as empty:
 * callers which guard installation must fail closed instead of losing decisions. */
export async function readHistory(options: ReviewStorageOptions = {}): Promise<HistoryFile> {
  try {
    const parsed = JSON.parse(await readFile(historyPathFor(options), "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as HistoryFile).reviews)) {
      throw new Error("Locksmith review history is malformed");
    }
    return parsed as HistoryFile;
  } catch (error) {
    if (isNotFound(error)) return { reviews: [] };
    throw error;
  }
}

export async function saveReview(review: StoredReview, options: ReviewStorageOptions = {}) {
  const stored = sanitizeReviewForStorage(review);
  const history = await readHistory(options);
  const reviews = [stored, ...history.reviews.filter(item => item.reviewId !== review.reviewId)].slice(0, 100);
  const historyPath = historyPathFor(options);
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify({ reviews }, null, 2));
  return stored;
}

/** Any prior terminal result for this exact project/state/policy. A caller may use
 * Review/Block to avoid repeating a known decision, but only `isReusableDecision`
 * permits package installation. */
export async function findExactDecision(lookup: DecisionLookup, options: ReviewStorageOptions = {}) {
  const history = await readHistory(options);
  return history.reviews.find(review =>
    review.projectIdentity === lookup.projectIdentity &&
    review.dependencyStateId === lookup.dependencyStateId &&
    review.policy === lookup.policy &&
    (!lookup.lockfileHash || review.lockfileHash === lookup.lockfileHash) &&
    review.decisionKind === "install-approval"
  );
}

/** Returns only approvals which completed a verified real installation. */
export async function findFinalizedInstallApproval(lookup: DecisionLookup, options: ReviewStorageOptions = {}) {
  const review = await findExactDecision(lookup, options);
  return review && isReusableDecision(review) ? review : undefined;
}

/** Single future extension point for expiry, revocation, and remote policy checks. */
export function isReusableDecision(review: StoredReview, now = new Date()) {
  const expired = review.expiresAt ? now.getTime() >= new Date(review.expiresAt).getTime() : false;
  return review.verdict === "Allow" &&
    review.decisionKind === "install-approval" &&
    review.decisionStatus === "install-finalized" &&
    Boolean(review.projectIdentity) &&
    Boolean(review.dependencyStateId) &&
    Boolean(review.policy) && !expired && review.validity !== "revoked" && review.validity !== "expired" && review.installationVerification !== "failed";
}

/** Exact workspace reuse for web/PR review. CLI callers must additionally require verified installation. */
export async function findExactReusableApproval(lookup: DecisionLookup & { workspaceId: string; repoIdentity: string; policyHash: string }, options: ReviewStorageOptions = {}) {
  const history = await readHistory(options);
  const decisions = history.reviews as Array<StoredReview & Partial<WorkspaceDecision>>;
  return selectExact(decisions as WorkspaceDecision[], { ...lookup, lockfileHash: lookup.lockfileHash || "" });
}

/** Only the newest compatible active Allow is a comparison baseline; it never authorizes the candidate. */
export async function findLastApprovedBaseline(lookup: { workspaceId: string; repoIdentity: string; policyHash: string }, options: ReviewStorageOptions = {}) {
  const history = await readHistory(options);
  return selectBaseline(history.reviews as Array<StoredReview & Partial<WorkspaceDecision>> as WorkspaceDecision[], lookup);
}

/** Promote only the same stored pending Allow after npm has succeeded and the
 * caller has independently verified the final dependency state. */
export async function finalizeInstallApproval(
  reviewId: string,
  options: ReviewStorageOptions = {},
  finalizedAt = new Date().toISOString(),
) {
  const history = await readHistory(options);
  const review = history.reviews.find(item => item.reviewId === reviewId);
  if (!review) throw new Error(`Locksmith review ${reviewId} was not found`);
  if (review.verdict !== "Allow" || review.decisionKind !== "install-approval" || review.decisionStatus !== "pending-install") {
    throw new Error(`Locksmith review ${reviewId} is not a pending install approval`);
  }
  const finalized: StoredReview = { ...review, decisionStatus: "install-finalized", finalizedAt, installationVerification: "verified", verifiedAt: finalizedAt };
  await saveReview(finalized, options);
  return finalized;
}

/** Convenience for local orchestration: it makes the intended lifecycle explicit
 * without changing existing web callers, which continue to save analysis records. */
export function withDecisionMetadata(
  review: ReviewResult,
  metadata: { projectIdentity?: string; reportPath?: string; decisionKind?: DecisionKind; decisionStatus?: DecisionStatus },
): StoredReview {
  const decisionKind = metadata.decisionKind || "analysis";
  const decisionStatus = metadata.decisionStatus || "analysis";
  if (decisionKind === "install-approval" && !metadata.projectIdentity) throw new Error("Install approvals require a project identity");
  if (decisionKind === "install-approval" && review.verdict === "Allow" && !["pending-install", "install-finalized"].includes(decisionStatus)) {
    throw new Error("Install Allow decisions must be pending or finalized");
  }
  return { ...review, ...metadata, decisionKind, decisionStatus };
}

export function isTerminalVerdict(review: StoredReview, verdict: Verdict) {
  return review.verdict === verdict && review.decisionKind === "install-approval";
}
