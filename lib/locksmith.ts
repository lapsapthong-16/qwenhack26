import { createHash } from "node:crypto";
import { applyPackageFindings, collectNpmPackageEvidence, type PackageEvidence, type PackageFinding } from "./npmPackages";

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

export type ReviewInput = { repoUrl?: string; branch?: string; files?: Record<string, string>; policy?: string };
export type RepoInspection = { repoUrl: string; defaultBranch: string; branches: string[]; dependencyFiles: string[] };
export type ReviewResult = {
  reviewId?: string;
  createdAt?: string;
  dependencyStateId: string;
  source: string;
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
};
export type ReviewHooks = {
  onPackages?: (packages: PackageEvidence[]) => void;
  onRoleStart?: (role: Role) => void;
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
  if (input.files && Object.keys(input.files).length) return { source: "submitted-files", files: input.files };
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

export function dependencyStateId(source: string, files: Record<string, string>) {
  const hash = createHash("sha256");
  hash.update(source);
  for (const name of Object.keys(files).sort()) hash.update(`\n${name}\0${files[name]}`);
  return `state_${hash.digest("hex").slice(0, 24)}`;
}

export const AGENT_PROMPTS: Record<Role, string> = {
  Baseline: "You are Locksmith's Baseline Agent. Analyze retrieved dependency files, package-lock exact versions, and package inspection coverage. If no previousReview is supplied, say there is no prior approved baseline available. Identify package manager, direct production dependencies, inspected package count, and packages that could not be inspected. Do not inspect source behavior or make final policy.",
  Manifest: "You are Locksmith's Manifest Agent. Review each retrieved package package.json plus repo manifests: lifecycle scripts, bin/main/module/exports, dependency counts, and package purpose mismatch. Do not claim publisher, release timing, vulnerabilities, or baseline approval unless supplied. Do not decide final policy.",
  Static: "You are Locksmith's Static Agent. Inspect retrieved package file text for suspicious static patterns such as lifecycle scripts, eval/dynamic Function text, env/secret/home-directory access text, file reads/writes, outbound URL strings, child_process, shell execution, and persistence indicators. Cite package name and file path. Do not issue the final verdict.",
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
    return [{ name: pkg.name, version: pkg.version, verdict: pkg.verdict as Verdict, reason: pkg.reason.slice(0, 600), evidence: Array.isArray(pkg.evidence) ? pkg.evidence.filter(x => typeof x === "string").slice(0, 6) as string[] : [] }];
  }) : undefined;
  return { role, verdict: v.verdict as Verdict, summary: v.summary.slice(0, 1000), evidence: v.evidence.filter(x => typeof x === "string").slice(0, 8) as string[], confidence: Math.max(0, Math.min(1, typeof v.confidence === "number" ? v.confidence : 0.5)), packages };
}

async function infer(role: Role, files: Record<string, string>, packages: PackageEvidence[], previous: Finding[], policy: string, stateId: string): Promise<Finding> {
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
      { role: "system", content: `${AGENT_PROMPTS[role]} Return only JSON: {\"verdict\":\"Allow|Review|Block\",\"summary\":\"...\",\"evidence\":[\"...\"],\"confidence\":0.0,\"packages\":[{\"name\":\"...\",\"version\":\"...\",\"verdict\":\"Allow|Review|Block\",\"reason\":\"...\",\"evidence\":[\"package/file.js: snippet\"]}]}. Never invent evidence. Cite package name and file path for package claims. Never claim a previous baseline, approval, vulnerability, publish date, or sandbox observation unless it appears in the supplied JSON.` },
      { role: "user", content: JSON.stringify({ policy, dependencyStateId: stateId, previousReview: null, retrievedFileNames: Object.keys(dependencyFiles).sort(), repoDependencyFiles: dependencyFiles, packages: packageEvidence, previousFindings: previous }) },
    ] }),
  });
  if (!response.ok) throw new Error(`Qwen ${role} request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Qwen ${role} returned no content`);
  try { return validFinding(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")), role); }
  catch (error) { if (error instanceof SyntaxError) throw new Error(`Qwen ${role} returned malformed JSON`); throw error; }
}

export async function reviewDependencies(input: ReviewInput, hooks: ReviewHooks = {}): Promise<ReviewResult> {
  const evidence = await gatherEvidence(input);
  const policy = input.policy || "strict";
  const stateId = dependencyStateId(evidence.source, evidence.files);
  let packages = await collectNpmPackageEvidence(evidence.files, hooks.onPackages);
  const findings: Finding[] = [];
  for (const role of ROLES) {
    hooks.onRoleStart?.(role);
    const finding = await infer(role, evidence.files, packages, findings, policy, stateId);
    findings.push(finding);
    hooks.onFinding?.(finding);
  }
  const judge = findings.at(-1)!;
  packages = applyPackageFindings(packages, judge.packages);
  const packageCount = packages.length;
  const inspectedPackageCount = packages.filter(pkg => pkg.inspectedFiles.length).length;
  const packageSummary = packageCount
    ? `${packageCount} production npm packages reviewed: ${packages.filter(pkg => pkg.status === "Allow").length} allow, ${packages.filter(pkg => pkg.status === "Review").length} review, ${packages.filter(pkg => pkg.status === "Block").length} block.`
    : "No production npm dependencies found in package.json.";
  return {
    dependencyStateId: stateId,
    source: evidence.source,
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
    verdict: judge.verdict,
    remediation: judge.summary,
  };
}
