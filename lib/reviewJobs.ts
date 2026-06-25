import { randomUUID } from "node:crypto";
import { reviewDependencies, ROLES, type Finding, type ReviewInput, type ReviewResult, type Role } from "./locksmith";
import { saveReview } from "./reviewHistory";

export type ReviewJob = {
  reviewId: string;
  status: "queued" | "running" | "complete" | "failed";
  input: ReviewInput;
  currentRole?: Role;
  completedRoles: Role[];
  findings: Finding[];
  result?: ReviewResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const jobs = new Map<string, ReviewJob>();

function touch(job: ReviewJob) {
  job.updatedAt = new Date().toISOString();
}

export function startReview(input: ReviewInput) {
  if (!process.env.QWEN_API_KEY) throw new Error("QWEN_API_KEY is required for real agent analysis");

  const reviewId = `rev_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const now = new Date().toISOString();
  const job: ReviewJob = { reviewId, status: "queued", input, completedRoles: [], findings: [], createdAt: now, updatedAt: now };
  jobs.set(reviewId, job);

  void (async () => {
    try {
      job.status = "running";
      touch(job);
      const result = await reviewDependencies(input, {
        onRoleStart(role) {
          job.currentRole = role;
          touch(job);
        },
        onFinding(finding) {
          job.findings = [...job.findings, finding];
          job.completedRoles = ROLES.filter(role => job.findings.some(item => item.role === role));
          touch(job);
        },
      });
      job.result = { ...result, reviewId, createdAt: job.createdAt };
      job.status = "complete";
      job.currentRole = undefined;
      touch(job);
      await saveReview(job.result);
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Review failed";
      job.currentRole = undefined;
      touch(job);
    }
  })();

  return { reviewId };
}

export function getReviewJob(reviewId: string) {
  return jobs.get(reviewId);
}
