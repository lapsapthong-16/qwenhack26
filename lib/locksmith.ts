import { createHash } from "node:crypto";
import { applyPackageFindings, collectNpmPackageEvidence, type PackageEvidence, type PackageFinding } from "./npmPackages.ts";
import { readPackageEvidence, savePackageEvidence } from "./packageEvidence.ts";
import { collectPythonPackageEvidence } from "./pythonPackages.ts";
import { readHistory } from "./reviewHistory.ts";
import { canonicalRepoIdentity, lockfileHash, policyHash, dependencyDiff } from "./workspaceDecisions.ts";

export const ROLES = ["Baseline", "Manifest", "Static", "Behavior", "Skeptic", "Judge"] as const;
export type Role = (typeof ROLES)[number];
export type Verdict = "Allow" | "Review" | "Block";

export type Finding = {
  role: Role;
  verdict: Verdict;
  summary: string;
  evidence: string[];
  confidence: number;
  packages?: PackageFinding[];
};

export type ReviewInput = {
  repoUrl?: string;
  branch?: string;
  files?: Record<string, string>;
  policy?: string;
  source?: string;
  projectIdentity?: string;
  storageRoot?: string;
  requireFullNpmCoverage?: boolean;
  workspaceId?: string;
  commitSha?: string;
  packageManager?: string;
};
export type RepoInspection = { repoUrl: string; defaultBranch: string; branches: string[]; dependencyFiles: string[] };
export type ReviewResult = {
  reviewId?: string;
  createdAt?: string;
  dependencyStateId: string;
  source: string;
  projectIdentity?: string;
  repoUrl?: string;
  branch?: string;
  policy: string;
  mode: "qwen";
  model: string;
  files: string[];
  packages: PackageEvidence[];
  packageCount: number;
  inspectedPackageCount: number;
  packageSummary: string;
  findings: Finding[];
  verdict: Verdict;
  remediation: string;
  baselineReviewId?: string;
  baselineDependencyStateId?: string;
  dependencyDiff?: ReturnType<typeof npmDependencyDiff>;
  reuseReason?: "exact-team-approval" | "exact-local-approval" | "none";
  lockfileHash?: string;
};
export type ReviewHooks = {
  onPackages?: (packages: PackageEvidence[]) => void;
  onRoleStart?: (role: Role) => void;
  onRoleError?: (role: Role, error: string) => void;
  onFinding?: (finding: Finding) => void;
};

export const DEPENDENCY_FILES = ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "requirements.txt", "pyproject.toml"] as const;

function githubCoordinates(url: string) {
  const match = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#]+?)(?:\.git)?(?:[\/#].*)?$/.exec(url);
  return match ? { owner: match[1], repo: match[2] } : null;
}

async function githubJson<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "locksmith-demo" },
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) throw new Error("Repository is private, missing, or not accessible without GitHub auth");
  if (!response.ok) throw new Error(`GitHub lookup failed (${response.status})`);
  return await response.json() as T;
}

export async function inspectGitHubRepo(repoUrl: string): Promise<RepoInspection> {
  const coordinates = githubCoordinates(repoUrl);
  if (!coordinates) throw new Error("Enter a GitHub repository URL like https://github.com/owner/repo");
  const repo = await githubJson<{ default_branch: string; private: boolean }>(`/repos/${coordinates.owner}/${coordinates.repo}`);
  if (repo.private) throw new Error("This repository is private. Locksmith cannot access it without GitHub auth.");
  const branches = await githubJson<{ name: string }[]>(`/repos/${coordinates.owner}/${coordinates.repo}/branches?per_page=20`);
  const tree = await githubJson<{ tree?: { path: string; type: string }[] }>(`/repos/${coordinates.owner}/${coordinates.repo}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`);
  const names = new Set(tree.tree?.filter(item => item.type === "blob").map(item => item.path));
  const dependencyFiles = DEPENDENCY_FILES.filter(name => names.has(name));
  return { repoUrl, defaultBranch: repo.default_branch, branches: Array.from(new Set([repo.default_branch, ...branches.map(branch => branch.name)])), dependencyFiles };
}

export async function gatherEvidence(input: ReviewInput) {
  if (input.files && Object.keys(input.files).length) return { source: input.source || "submitted-files", files: input.files };
  if (!input.repoUrl) throw new Error("Repository URL or dependency files are required");
  const coordinates = githubCoordinates(input.repoUrl);
  if (!coordinates) throw new Error("repoUrl must be a public GitHub repository URL");
  const wanted = DEPENDENCY_FILES;
  const files: Record<string, string> = {};
  await Promise.all(wanted.map(async name => {
    const branch = encodeURIComponent(input.branch || "HEAD");
    const url = `https://raw.githubusercontent.com/${coordinates.owner}/${coordinates.repo}/${branch}/${name}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (response.ok) files[name] = (await response.text()).slice(0, name.endsWith("lock.json") ? 5_000_000 : 100_000);
  }));
  if (!Object.keys(files).length) throw new Error("No supported dependency files found in the public repository");
  return { source: `${input.repoUrl}#${input.branch || "HEAD"}`, files };
}

export function dependencyStateId(sourceOrFiles: string | Record<string, string>, maybeFiles?: Record<string, string>) {
  const files = typeof sourceOrFiles === "string" ? maybeFiles : sourceOrFiles;
  if (!files) throw new Error("Dependency files are required to compute a dependency state ID");
  const hash = createHash("sha256");
  for (const name of Object.keys(files).sort()) hash.update(`\n${name}\0${files[name]}`);
  return `state_${hash.digest("hex").slice(0, 24)}`;
}

export function dependencyStateIdentity(input: { files: Record<string, string>; repoIdentity?: string; commitSha?: string; packageManager?: string }) {
  const hash = createHash("sha256");
  hash.update(`repo:${canonicalRepoIdentity(input.repoIdentity || "local:.\n")}`);
  hash.update(`\ncommit:${input.commitSha || ""}\nmanager:${input.packageManager || (input.files["package-lock.json"] ? "npm" : "unknown")}`);
  for (const name of Object.keys(input.files).sort()) hash.update(`\n${name}\0${input.files[name]}`);
  return `state_${hash.digest("hex").slice(0, 24)}`;
}

export function npmDependencyDiff(previousFiles: Record<string, string> = {}, currentFiles: Record<string, string> = {}) {
  const read = (files: Record<string, string>) => {
    try { const lock = JSON.parse(files["package-lock.json"] || "{}"); return Object.fromEntries(Object.entries(lock.packages || {}).filter(([key]) => key).map(([key, value]) => [key.replace(/^node_modules\//, ""), String((value as { version?: string }).version || "unknown")])); }
    catch { return {}; }
  };
  return dependencyDiff(read(previousFiles), read(currentFiles));
}

export const AGENT_PROMPTS: Record<Role, string> = {
  Baseline: "You are Locksmith's Baseline Agent. Analyze retrieved dependency files, package-lock exact versions, pinned Python requirements, and package inspection coverage. If no previousReview is supplied, say there is no prior approved baseline available. Identify package manager, direct production dependencies, inspected package count, and packages that could not be inspected. Do not inspect source behavior or make final policy.",
  Manifest: "You are Locksmith's Manifest Agent. Review each retrieved npm package.json, PyPI metadata/build files, and repo manifests: lifecycle scripts, build/install hooks, bin/main/module/exports, dependency counts, and package purpose mismatch. Do not claim publisher, release timing, vulnerabilities, or baseline approval unless supplied. Do not decide final policy.",
  Static: "You are Locksmith's Static Agent. Inspect retrieved package file text for suspicious static patterns such as lifecycle scripts, eval/dynamic Function text, env/secret/home-directory access text, file reads/writes, outbound URL strings, child_process/subprocess, shell execution, and persistence indicators. Cite package name and file path. Do not issue the final verdict.",
  Behavior: "You are Locksmith's Behavior Agent. Infer likely install/runtime behavior only from retrieved package files and dependency files. Clearly label every behavior claim as inferred, not sandbox-observed. Focus on lifecycle execution, spawned processes, network calls, filesystem access outside expected paths, credential discovery, persistence, and unexpected side effects. Do not decide policy.",
  Skeptic: "You are Locksmith's Skeptic Agent. Challenge Baseline, Manifest, Static, and Behavior claims as possible false positives. Reject any claim that is not supported by retrieved files or prior findings. Ask whether behavior is normal for this package type, whether evidence is direct or inferred, whether repo context changes severity, and whether the claim is strong enough for Allow, Review, or Block. Do not find new risks or make the final verdict.",
  Judge: "You are Locksmith's Judge Agent. Resolve the five prior agents into package verdicts and one repo-specific decision: Allow, Review, or Block. Block credential theft, install-time execution abuse, hidden network exfiltration, destructive file access, obfuscation paired with sensitive access, or risky changes replacing an approved state. Review incomplete but suspicious evidence. Allow only low-risk explained behavior. Suggest the smallest remediation.",
};

function validFinding(value: unknown, role: Role): Finding {
  if (!value || typeof value !== "object") throw new Error(`${role} returned invalid JSON`);
  const v = value as Record<string, unknown>;
  if (!(["Allow", "Review", "Block"] as unknown[]).includes(v.verdict) || typeof v.summary !== "string" || !Array.isArray(v.evidence)) throw new Error(`${role} returned an invalid finding`);
  const packages = Array.isArray(v.packages) ? v.packages.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const pkg = item as Record<string, unknown>;
    if (typeof pkg.name !== "string" || typeof pkg.version !== "string" || !(["Allow", "Review", "Block"] as unknown[]).includes(pkg.verdict) || typeof pkg.reason !== "string") return [];
    return [{
      name: pkg.name,
      version: pkg.version,
      verdict: pkg.verdict as Verdict,
      reason: pkg.reason.slice(0, 600),
      evidence: Array.isArray(pkg.evidence) ? pkg.evidence.filter(x => typeof x === "string").slice(0, 6) as string[] : [],
      suspiciousLines: Array.isArray(pkg.suspiciousLines) ? pkg.suspiciousLines as PackageFinding["suspiciousLines"] : undefined,
    }];
  }) : undefined;
  return { role, verdict: v.verdict as Verdict, summary: v.summary.slice(0, 1000), evidence: v.evidence.filter(x => typeof x === "string").slice(0, 8) as string[], confidence: Math.max(0, Math.min(1, typeof v.confidence === "number" ? v.confidence : 0.5)), packages };
}

async function infer(role: Role, files: Record<string, string>, packages: PackageEvidence[], previous: Finding[], policy: string, stateId: string, previousReview: unknown = null): Promise<Finding> {
  const key = process.env.QWEN_API_KEY;
  if (!key) throw new Error("QWEN_API_KEY is required for real agent analysis");
  const model = process.env.QWEN_MODEL;
  if (!model) throw new Error("QWEN_MODEL is required for real agent analysis");
  const baseUrl = (process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
  const dependencyFiles = Object.fromEntries(Object.entries(files).map(([name, content]) => [name, content.slice(0, name === "package-lock.json" ? 20_000 : 60_000)]));
  const packageEvidence = packages.map(pkg => ({ ...pkg, files: pkg.files.slice(0, 120), inspectedFiles: pkg.inspectedFiles.slice(0, 6).map(file => ({ ...file, content: file.content.slice(0, 4_000) })) }));
  const response = await fetch(baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ model, temperature: 0.1, response_format: { type: "json_object" }, messages: [
      { role: "system", content: `${AGENT_PROMPTS[role]} Keep summary under 160 characters and evidence bullets short. Return only JSON: {\"verdict\":\"Allow|Review|Block\",\"summary\":\"...\",\"evidence\":[\"...\"],\"confidence\":0.0,\"packages\":[{\"name\":\"...\",\"version\":\"...\",\"verdict\":\"Allow|Review|Block\",\"reason\":\"...\",\"evidence\":[\"package/file.js line 12\"],\"suspiciousLines\":[]}]}. Never invent evidence. Cite package name and file path for package claims. Never claim a previous baseline, approval, vulnerability, publish date, or sandbox observation unless it appears in the supplied JSON.` },
      { role: "user", content: JSON.stringify({ policy, dependencyStateId: stateId, previousReview, retrievedFileNames: Object.keys(dependencyFiles).sort(), repoDependencyFiles: dependencyFiles, packages: packageEvidence, previousFindings: previous }) },
    ] }),
  });
  if (!response.ok) throw new Error(`Qwen ${role} request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Qwen ${role} returned no content`);
  try { return validFinding(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")), role); }
  catch (error) { if (error instanceof SyntaxError) throw new Error(`Qwen ${role} returned malformed JSON`); throw error; }
}

function baselineFinding(packages: PackageEvidence[], previousReview: { reviewId?: string } | null): Finding {
  const counts = {
    reused: packages.filter(pkg => pkg.scanStatus === "reused").length,
    new: packages.filter(pkg => pkg.scanStatus === "new").length,
    changed: packages.filter(pkg => pkg.scanStatus === "changed").length,
    unscanned: packages.filter(pkg => pkg.scanStatus === "unscanned").length,
  };
  const evidence = packages.slice(0, 6).map(pkg => `${pkg.name}@${pkg.version}: ${pkg.scanStatus} / ${pkg.evidenceSource}`);
  return {
    role: "Baseline",
    verdict: counts.changed || counts.new || counts.unscanned || !previousReview ? "Review" : "Allow",
    summary: previousReview
      ? `${packages.length} packages: ${counts.reused} reused, ${counts.new} new, ${counts.changed} changed, ${counts.unscanned} unscanned.`
      : `No previous scan found. ${packages.length} packages need workspace review.`,
    evidence,
    confidence: 1,
  };
}

export function resolveFinalVerdict(judgeVerdict: Verdict, packages: PackageEvidence[], requiredFailure: boolean, requireFullNpmCoverage = false): Verdict {
  const incompleteNpmCoverage = requireFullNpmCoverage && packages.some(pkg => pkg.packageManager === "npm" && pkg.scanStatus === "unscanned");
  if ((requiredFailure || incompleteNpmCoverage) && judgeVerdict === "Allow") return packages.some(pkg => pkg.status === "Block") ? "Block" : "Review";
  return judgeVerdict;
}

export async function reviewDependencies(input: ReviewInput, hooks: ReviewHooks = {}): Promise<ReviewResult> {
  const evidence = await gatherEvidence(input);
  const policy = input.policy || "strict";
  const stateId = input.repoUrl || input.commitSha || input.projectIdentity
    ? dependencyStateIdentity({ files: evidence.files, repoIdentity: input.repoUrl || input.projectIdentity, commitSha: input.commitSha, packageManager: input.packageManager })
    : dependencyStateId(evidence.files);
  let packages: PackageEvidence[] = [];
  const storage = { rootDir: input.storageRoot };
  const [packageEvidence, history] = await Promise.all([readPackageEvidence(storage), readHistory(storage)]);
  const previousReview = history.reviews.filter(review => review.verdict === "Allow" && review.decisionKind !== "analysis" && (review.source === evidence.source || review.repoUrl === input.repoUrl)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || (b.reviewId || "").localeCompare(a.reviewId || ""))[0];
  const diff = npmDependencyDiff(previousReview?.files.reduce((all, name) => ({ ...all, [name]: "" }), {}), evidence.files);
  const previousReviewSummary = previousReview ? {
    reviewId: previousReview.reviewId,
    dependencyStateId: previousReview.dependencyStateId,
    verdict: previousReview.verdict,
    packages: previousReview.packages.map(pkg => ({ name: pkg.name, version: pkg.version, status: pkg.status, artifactKey: pkg.artifactKey })),
    dependencyDiff: diff,
  } : null;
  const collectionContext = { cached: packageEvidence.packages, previous: previousReview?.packages || [], requireFullCoverage: input.requireFullNpmCoverage };
  hooks.onRoleStart?.("Baseline");
  for (const collect of [collectNpmPackageEvidence, collectPythonPackageEvidence]) {
    const next = await collect(evidence.files, partial => hooks.onPackages?.([...packages, ...partial]), collectionContext);
    packages = [...packages, ...next];
    hooks.onPackages?.(packages);
  }
  await savePackageEvidence(packages, storage);
  const findings: Finding[] = [];
  const runRole = async (role: Role, prior = findings) => {
    hooks.onRoleStart?.(role);
    const finding = await infer(role, evidence.files, packages, prior, policy, stateId, previousReviewSummary);
    findings.push(finding);
    hooks.onFinding?.(finding);
    return finding;
  };
  const baseline = baselineFinding(packages, previousReviewSummary);
  findings.push(baseline);
  hooks.onFinding?.(baseline);
  const baselineOnly = [...findings];
  const parallel = await Promise.allSettled((["Manifest", "Static", "Behavior"] as Role[]).map(role => runRole(role, baselineOnly)));
  for (const [index, result] of parallel.entries()) {
    if (result.status === "fulfilled") continue;
    const role = (["Manifest", "Static", "Behavior"] as Role[])[index];
    const message = result.reason instanceof Error ? result.reason.message : `${role} failed`;
    hooks.onRoleError?.(role, message);
    findings.push({ role, verdict: "Review", summary: `${role} failed: ${message.slice(0, 120)}`, evidence: [message.slice(0, 180)], confidence: 0 });
  }
  await runRole("Skeptic");
  await runRole("Judge");
  const judge = findings.at(-1)!;
  packages = applyPackageFindings(packages, judge.packages);
  const requiredFailure = findings.some(finding => (["Manifest", "Static", "Behavior"] as Role[]).includes(finding.role) && finding.confidence === 0);
  const incompleteNpmCoverage = input.requireFullNpmCoverage && packages.some(pkg => pkg.packageManager === "npm" && pkg.scanStatus === "unscanned");
  const finalVerdict = resolveFinalVerdict(judge.verdict, packages, requiredFailure, input.requireFullNpmCoverage);
  const packageCount = packages.length;
  const inspectedPackageCount = packages.filter(pkg => pkg.inspectedFiles.length).length;
  const packageSummary = packageCount
    ? `${packageCount} production npm/PyPI packages reviewed: ${packages.filter(pkg => pkg.status === "Allow").length} allow, ${packages.filter(pkg => pkg.status === "Review").length} review, ${packages.filter(pkg => pkg.status === "Block").length} block.`
    : "No production npm or pinned PyPI dependencies found.";
  return {
    dependencyStateId: stateId,
    source: evidence.source,
    projectIdentity: input.projectIdentity,
    repoUrl: input.repoUrl,
    branch: input.branch,
    policy,
    mode: "qwen",
    model: process.env.QWEN_MODEL!,
    files: Object.keys(evidence.files).sort(),
    packages,
    packageCount,
    inspectedPackageCount,
    packageSummary,
    findings,
    verdict: finalVerdict,
    remediation: requiredFailure && judge.verdict === "Allow"
      ? "Review required because one or more required agents failed."
      : incompleteNpmCoverage && judge.verdict === "Allow"
        ? "Review required because one or more resolved npm artifacts could not be inspected."
        : judge.summary,
    baselineReviewId: previousReview?.reviewId,
    baselineDependencyStateId: previousReview?.dependencyStateId,
    dependencyDiff: diff,
    reuseReason: "none",
    lockfileHash: evidence.files["package-lock.json"] ? lockfileHash(evidence.files["package-lock.json"]) : undefined,
  };
}
