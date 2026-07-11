import { randomUUID } from "node:crypto";
import { reviewDependencies, ROLES, type Finding, type ReviewInput, type ReviewResult, type Role } from "./locksmith.ts";
import type { PackageEvidence } from "./npmPackages.ts";
import { saveReview } from "./reviewHistory.ts";

export type ReviewJob = {
  reviewId: string;
  status: "queued" | "retrieving-packages" | "running" | "complete" | "failed";
  input: ReviewInput;
  currentRole?: Role;
  currentRoles: Role[];
  completedRoles: Role[];
  roleStatus: Record<Role, "queued" | "running" | "done" | "failed">;
  roleErrors?: Partial<Record<Role, string>>;
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

function publicResult(result: ReviewResult): ReviewResult {
  return { ...result, packages: result.packages };
}

export function startReview(input: ReviewInput) {
  if (!process.env.QWEN_API_KEY) throw new Error("QWEN_API_KEY is required for real agent analysis");

  const reviewId = `rev_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const now = new Date().toISOString();
  const roleStatus = Object.fromEntries(ROLES.map(role => [role, "queued"])) as ReviewJob["roleStatus"];
  const job: ReviewJob = { reviewId, status: "queued", input, currentRoles: [], completedRoles: [], roleStatus, packages: [], findings: [], createdAt: now, updatedAt: now };
  jobs.set(reviewId, job);

  void (async () => {
    try {
      job.status = "retrieving-packages";
      touch(job);
      const result = await reviewDependencies(input, {
        onPackages(packages) {
          job.packages = packages;
          touch(job);
        },
        onRoleStart(role) {
          job.status = "running";
          job.currentRole = role;
          job.currentRoles = Array.from(new Set([...job.currentRoles, role]));
          job.roleStatus[role] = "running";
          touch(job);
        },
        onRoleError(role, error) {
          job.currentRoles = job.currentRoles.filter(item => item !== role);
          job.roleStatus[role] = "failed";
          job.roleErrors = { ...job.roleErrors, [role]: error };
          touch(job);
        },
        onFinding(finding) {
          job.findings = [...job.findings, finding];
          job.completedRoles = ROLES.filter(role => job.findings.some(item => item.role === role));
          job.currentRoles = job.currentRoles.filter(role => role !== finding.role);
          job.roleStatus[finding.role] = job.roleStatus[finding.role] === "failed" ? "failed" : "done";
          touch(job);
        },
      });
      const savedResult = { ...result, reviewId, createdAt: job.createdAt };
      job.result = publicResult(savedResult);
      job.packages = result.packages;
      job.status = "complete";
      job.currentRole = undefined;
      job.currentRoles = [];
      touch(job);
      void saveReview(savedResult).catch(error => {
        // A completed analysis remains useful in the web UI even if local history is unavailable.
        console.error("Locksmith could not persist review history:", error);
      });
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Review failed";
      job.currentRole = undefined;
      job.currentRoles = [];
      touch(job);
    }
  })();

  return { reviewId };
}

export function getReviewJob(reviewId: string) {
  return jobs.get(reviewId);
}
