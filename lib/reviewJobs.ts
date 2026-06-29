import { randomUUID } from "node:crypto";
import { reviewDependencies, ROLES, type Finding, type ReviewInput, type ReviewResult, type Role } from "./locksmith";
import type { PackageEvidence } from "./npmPackages";
import { saveReview } from "./reviewHistory";

export type ReviewJob = {
  reviewId: string;
  status: "queued" | "retrieving-packages" | "running" | "complete" | "failed";
  input: ReviewInput;
  currentRole?: Role;
  completedRoles: Role[];
  packages: PackageEvidence[];
  findings: Finding[];
  result?: ReviewResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const globalJobs = globalThis as typeof globalThis & { __locksmithReviewJobs?: Map<string, ReviewJob> };
const jobs = globalJobs.__locksmithReviewJobs ??= new Map<string, ReviewJob>();

function touch(job: ReviewJob) {
  job.updatedAt = new Date().toISOString();
}

function publicPackages(packages: PackageEvidence[]) {
  return packages.map(pkg => ({ ...pkg, inspectedFiles: pkg.inspectedFiles.map(file => ({ ...file, content: "" })) }));
}

function publicResult(result: ReviewResult): ReviewResult {
  return { ...result, packages: publicPackages(result.packages) };
}

export function startReview(input: ReviewInput) {
  if (!process.env.QWEN_API_KEY) throw new Error("QWEN_API_KEY is required for real agent analysis");

  const reviewId = `rev_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const now = new Date().toISOString();
  const job: ReviewJob = { reviewId, status: "queued", input, completedRoles: [], packages: [], findings: [], createdAt: now, updatedAt: now };
  jobs.set(reviewId, job);

  void (async () => {
    try {
      job.status = "retrieving-packages";
      touch(job);
      const result = await reviewDependencies(input, {
        onPackages(packages) {
          job.packages = publicPackages(packages);
          touch(job);
        },
        onRoleStart(role) {
          job.status = "running";
          job.currentRole = role;
          touch(job);
        },
        onFinding(finding) {
          job.findings = [...job.findings, finding];
          job.completedRoles = ROLES.filter(role => job.findings.some(item => item.role === role));
          touch(job);
        },
      });
      const savedResult = { ...result, reviewId, createdAt: job.createdAt };
      job.result = publicResult(savedResult);
      job.packages = publicPackages(result.packages);
      job.status = "complete";
      job.currentRole = undefined;
      touch(job);
      await saveReview(savedResult);
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
