import type { ReviewResult } from "./locksmith.ts";
import type { PackageEvidence } from "./npmPackages.ts";

type AnyPackage = ReviewResult["packages"][number] | PackageEvidence;

export function sanitizeReviewForStorage<T extends ReviewResult>(review:T): T {
  return {
    ...review,
    findings: review.findings.map(finding => ({
      ...finding,
      summary: redact(finding.summary),
      evidence: finding.evidence.map(redact),
    })),
    packages: review.packages.map(sanitizePackageForStorage),
  };
}

export function sanitizePackagesForStorage<T extends AnyPackage>(packages:T[]): T[] {
  return packages.map(sanitizePackageForStorage);
}

export function sanitizePackageForStorage<T extends AnyPackage>(pkg:T): T {
  const suspicious = (pkg.suspiciousLines || []).length > 0 || pkg.status !== "Allow";
  if (!suspicious) return { ...pkg, inspectedFiles: [], retention: "summary-only" } as T;

  const suspiciousPaths = new Set((pkg.suspiciousLines || []).map(line => line.filePath));
  return {
    ...pkg,
    reason: redact(pkg.reason),
    evidence: pkg.evidence?.map(redact),
    inspectedFiles: pkg.inspectedFiles
      .filter(file => suspiciousPaths.has(file.path))
      .map(file => ({ ...file, content: redactedWindows(file.content, pkg.suspiciousLines?.filter(line => line.filePath === file.path) || []), reason: redact(file.reason), contentTruncated: true })),
    suspiciousLines: pkg.suspiciousLines?.map(line => ({ ...line, reason: redact(line.reason) })),
    retention: "redacted-line-window",
  } as T;
}

export function redact(value:string) {
  return value
    .replace(/npm_[A-Za-z0-9_=-]{20,}/g, "[REDACTED_NPM_TOKEN]")
    .replace(/Bearer\s+[A-Za-z0-9._=-]{20,}/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/[A-Za-z0-9_./-]*(?:token|secret|api[_-]?key|password)\s*[:=]\s*["']?[^"'\s]+/gi, "[REDACTED_SECRET]")
    .replace(/\/Users\/[^/\s'"]+/g, "/Users/[REDACTED]");
}

function redactedWindows(content:string, lines:{ startLine:number; endLine?:number }[]) {
  const source = content.split(/\r?\n/);
  const keep = new Set<number>();
  for (const line of lines) {
    for (let n = Math.max(1, line.startLine - 2); n <= Math.min(source.length, (line.endLine || line.startLine) + 2); n++) keep.add(n);
  }
  return [...keep].sort((a,b) => a - b).map(n => `${n}: ${redact(source[n - 1] || "")}`).join("\n");
}
