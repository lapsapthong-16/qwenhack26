import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { dependencyStateId } from "./locksmith.ts";
import { finalizeInstallApproval } from "./reviewHistory.ts";
import { readNpmFiles, reviewLocalNpmCandidate, type LocalReview } from "./localReview.ts";
import { writeTrustPointer } from "./workspaceDecisions.ts";

type NpmRun = (command: string, args: string[], cwd: string) => Promise<number>;
export type InstallOutcome = { code: 0 | 1 | 2 | 3; review?: LocalReview; message: string };

const forbiddenFlags = new Set(["--global", "-g", "--prefix", "--package-lock=false", "--no-package-lock", "--workspace", "-w", "--workspaces", "--include-workspace-root", "--userconfig", "--globalconfig", "--location", "--ignore-scripts", "--package-lock-only"]);
const allowedInstallFlags = new Set(["--save-dev", "-D", "--save-exact", "-E", "--save-optional", "-O"]);

function parsedManifest(content: string) {
  try { return JSON.parse(content) as Record<string, unknown>; }
  catch { throw new Error("package.json is not valid JSON"); }
}

function unsupportedManifest(manifest: Record<string, unknown>) {
  if (manifest.workspaces) return "npm workspaces are not supported by guarded install yet.";
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
    const values = manifest[section];
    if (!values || typeof values !== "object") continue;
    for (const spec of Object.values(values as Record<string, unknown>)) {
      if (typeof spec === "string" && (/^(file:|link:|git\+|github:|git@|https?:\/\/.*\.git(?:#|$))/i.test(spec) || spec.startsWith("../") || spec.startsWith("./"))) return "Local-path and Git dependencies are not supported by guarded install yet.";
    }
  }
}

export function validateNpmInstallArgs(args: string[]) {
  for (const arg of args) {
    const key = arg.split("=", 1)[0];
    if (forbiddenFlags.has(key)) throw new Error(`${key} is not supported by guarded npm install.`);
    if (key.startsWith("--registry") || key.startsWith("--config")) throw new Error("Registry and npm config overrides are not supported by guarded npm install.");
    if (key.startsWith("-") && !allowedInstallFlags.has(key)) throw new Error(`${key} is not supported by guarded npm install yet.`);
  }
}

function runNpm(command: string, args: string[], cwd: string) {
  return new Promise<number>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", code => resolvePromise(code ?? 1));
  });
}

async function writeAtomic(path: string, content: string) {
  const temp = `${path}.locksmith-tmp`;
  await writeFile(temp, content, "utf8");
  await rename(temp, path);
}

async function validateCandidate(files: Record<string, string>) {
  const manifest = parsedManifest(files["package.json"] || "");
  const unsupported = unsupportedManifest(manifest);
  if (unsupported) throw new Error(unsupported);
  const lock = JSON.parse(files["package-lock.json"] || "{}") as { lockfileVersion?: number; packages?: unknown };
  if (!([2, 3].includes(lock.lockfileVersion || 0)) || !lock.packages || typeof lock.packages !== "object") throw new Error("Guarded npm install requires package-lock version 2 or 3.");
}

async function resolveCandidate(root: string, installArgs: string[], npm: NpmRun) {
  const current = await readNpmFiles(root);
  const currentUnsupported = unsupportedManifest(parsedManifest(current["package.json"]));
  if (currentUnsupported) throw new Error(currentUnsupported);
  const temp = await mkdtemp(join(tmpdir(), "locksmith-npm-"));
  try {
    await writeFile(join(temp, "package.json"), current["package.json"], "utf8");
    await writeFile(join(temp, "package-lock.json"), current["package-lock.json"], "utf8");
    const code = await npm("npm", ["install", ...installArgs, "--package-lock-only", "--ignore-scripts"], temp);
    if (code !== 0) throw new Error(`npm could not resolve the requested dependency state (exit ${code}).`);
    const candidate = await readNpmFiles(temp);
    await validateCandidate(candidate);
    return candidate;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function guardedNpmInstall({ rootDir = process.cwd(), args = [], policy = "strict", npm = runNpm, reviewCandidate = reviewLocalNpmCandidate }:{ rootDir?: string; args?: string[]; policy?: string; npm?: NpmRun; reviewCandidate?: typeof reviewLocalNpmCandidate }): Promise<InstallOutcome> {
  const root = resolve(rootDir);
  try {
    validateNpmInstallArgs(args);
    const candidate = await resolveCandidate(root, args, npm);
    const review = await reviewCandidate({ rootDir: root, files: candidate, policy });
    if (review.result.verdict === "Block") return { code: 3, review, message: "Blocked: Locksmith found a dependency safety concern." };
    if (review.result.verdict === "Review") return { code: 2, review, message: "Review required: installation was not started." };
    const original = await readNpmFiles(root);
    try {
      await writeAtomic(join(root, "package.json"), candidate["package.json"]);
      await writeAtomic(join(root, "package-lock.json"), candidate["package-lock.json"]);
    } catch (error) {
      await Promise.allSettled([
        writeAtomic(join(root, "package.json"), original["package.json"]),
        writeAtomic(join(root, "package-lock.json"), original["package-lock.json"]),
      ]);
      throw error;
    }
    const code = await npm("npm", ["ci"], root);
    if (code !== 0) return { code: 1, review, message: `npm ci failed (exit ${code}); pending approval was not finalized.` };
    const actual = await readNpmFiles(root);
    if (dependencyStateId(actual) !== review.result.dependencyStateId) return { code: 1, review, message: "Installed dependency state did not match the reviewed candidate." };
    if (!review.reused) await finalizeInstallApproval(review.result.reviewId!, { rootDir: root });
    if (review.workspaceDecision && process.env.LOCKSMITH_WORKSPACE_ID) {
      await writeTrustPointer(root, { ...review.workspaceDecision, installationVerification: "verified", verifiedAt: new Date().toISOString() });
    }
    return { code: 0, review, message: review.reused ? "Approved dependency state reused and installed from the frozen lockfile." : "Approved dependency state installed and finalized." };
  } catch (error) {
    return { code: 1, message: error instanceof Error ? error.message : "Guarded npm install failed." };
  }
}
