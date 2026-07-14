import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import type { Verdict } from "./locksmith.ts";

const unzip = promisify(gunzip);
const MAX_WEB_PACKAGES = 20;
// ponytail: keep the MVP's guarded CLI API spend bounded per project; batch scanning is deferred.
const MAX_GUARDED_PACKAGES = 50;
const MAX_SCAN_FILES = 40;
const MAX_READ_FILES = 12;
const MAX_FILE_BYTES = 20_000;

export type PackageFile = { path: string; reason: string; content: string; contentTruncated?: boolean; displayedBytes?: number; originalBytes?: number };
export type SuspiciousLine = {
  filePath: string;
  startLine: number;
  endLine?: number;
  severity: "low" | "medium" | "high" | "critical";
  sourceAgent: "Manifest" | "Static" | "Behavior";
  reviewedBy?: "Skeptic" | "Judge";
  reason: string;
  rule?: string;
};
export type PackageFinding = { name: string; version: string; verdict: Verdict; reason: string; evidence: string[]; suspiciousLines?: SuspiciousLine[] };
export type PackageEvidence = {
  name: string;
  version: string;
  packageManager: "npm" | "pypi";
  dependencyType: string;
  scanStatus: "new" | "reused" | "changed" | "unscanned";
  previousReviewId?: string;
  evidenceId?: string;
  evidenceSource: "global-cache" | "workspace-cache" | "fresh-scan" | "none";
  artifactKey?: string;
  verifiedIntegrity?: string;
  tarballUrl?: string;
  fileCount: number;
  files: string[];
  inspectedFiles: PackageFile[];
  suspiciousLines: SuspiciousLine[];
  status: Verdict;
  reason: string;
  evidence?: string[];
};

type TarEntry = { path: string; content: Buffer };

export type PackageProgress = (packages: PackageEvidence[]) => void;
export type PackageCollectionContext = { cached?: PackageEvidence[]; previous?: PackageEvidence[]; requireFullCoverage?: boolean };

function isMarkdown(path: string) {
  return /\.(md|mdx|markdown)$/i.test(path);
}

function displayedPath(path: string) {
  return isMarkdown(path) ? `${path} (omitted)` : path;
}

function parseJson<T>(name: string, content?: string): T {
  if (!content) throw new Error(`${name} is required`);
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}

function lockArtifactKey(name: string, version: string, entry: Record<string, any> = {}) {
  return `npm:${name}@${version}:${entry.integrity || entry.resolved || "registry"}`;
}

type LockedPackage = { name: string; version: string; entry: Record<string, any>; dependencyType: string };

function packageNameFromLockPath(path: string) {
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  return index < 0 ? "" : path.slice(index + marker.length);
}

function lockedPackages(lock: Record<string, any>): LockedPackage[] {
  return Object.entries(lock.packages || {})
    .filter(([path, entry]) => path !== "" && entry && typeof entry === "object")
    .map(([path, raw]) => {
      const entry = raw as Record<string, any>;
      const name = typeof entry.name === "string" ? entry.name : packageNameFromLockPath(path);
      const version = typeof entry.version === "string" ? entry.version : "";
      return { name, version, entry, dependencyType: entry.dev ? "npm:dev/transitive" : "npm:production/transitive" };
    })
    .filter(item => item.name && item.version)
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

function registryUrl(name: string) {
  if (!name.startsWith("@")) return `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const [scope, pkg] = name.split("/");
  return `https://registry.npmjs.org/${scope}%2F${pkg}`;
}

function octal(buffer: Buffer, start: number, length: number) {
  const raw = buffer.subarray(start, start + length).toString("utf8").replace(/\0.*$/, "").trim();
  return raw ? Number.parseInt(raw, 8) : 0;
}

function parseTar(buffer: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const size = octal(header, 124, 12);
    const type = header.subarray(156, 157).toString("utf8");
    const path = [prefix, name].filter(Boolean).join("/");
    const body = buffer.subarray(offset + 512, offset + 512 + size);
    if (path && (type === "0" || type === "")) entries.push({ path, content: body });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function text(buffer: Buffer) {
  if (buffer.includes(0)) return "";
  return buffer.toString("utf8", 0, Math.min(buffer.length, MAX_FILE_BYTES));
}

function file(content: Buffer, path: string, reason: string): PackageFile {
  const body = text(content);
  return {
    path,
    reason,
    content: body,
    contentTruncated: content.length > MAX_FILE_BYTES || undefined,
    displayedBytes: body.length,
    originalBytes: content.length,
  } as PackageFile;
}

function maybeText(buffer?: Buffer) {
  return buffer ? text(buffer) : undefined;
}

function pickScriptFiles(scripts: Record<string, string> | undefined) {
  const wanted = ["preinstall", "install", "postinstall", "prepare"];
  return wanted.flatMap(key => {
    const script = scripts?.[key];
    return typeof script === "string" ? [...script.matchAll(/(?:node|sh)\s+([^\s;&|]+)/g)].map(match => match[1]) : [];
  });
}

function selectFiles(entries: TarEntry[]) {
  const byPath = new Map(entries.map(entry => [entry.path, entry]));
  const manifestPath = byPath.has("package/package.json")
    ? "package/package.json"
    : byPath.has("package.json")
      ? "package.json"
      : entries.find(entry => entry.path.endsWith("/package.json"))?.path;
  const root = manifestPath?.replace(/package\.json$/, "") || "";
  const pkg = parseJson<Record<string, any>>("package.json", maybeText(manifestPath ? byPath.get(manifestPath)?.content : undefined));
  const selected = new Map<string, string>();
  const add = (path: string | undefined, reason: string) => {
    if (!path || typeof path !== "string") return;
    const clean = path.replace(/^\.\//, "");
    const full = byPath.has(clean) ? clean : `${root}${clean}`;
    if (byPath.has(full) && !isMarkdown(full)) selected.set(full, reason);
  };
  add("package.json", "package manifest");
  add(pkg.main, "main entrypoint");
  add(pkg.module, "module entrypoint");
  for (const value of Object.values(pkg.bin || {})) add(value as string, "bin entrypoint");
  for (const script of pickScriptFiles(pkg.scripts)) add(script, "lifecycle script target");
  const exports = typeof pkg.exports === "string" ? [pkg.exports] : Object.values(pkg.exports || {}).flatMap(value => typeof value === "string" ? [value] : Object.values(value as Record<string, string> || {}));
  for (const value of exports) add(value as string, "export entrypoint");

  const suspicious = /\beval\b|Function\s*\(|child_process|process\.env|\.npmrc|\bcurl\b|\bwget\b|https?:\/\/|fs\.readFile|fs\.writeFile|os\.homedir/;
  for (const entry of entries.filter(entry => !isMarkdown(entry.path)).slice(0, MAX_SCAN_FILES)) {
    const content = text(entry.content);
    if (content && suspicious.test(content)) selected.set(entry.path, "suspicious static pattern");
  }
  return [...selected.entries()].slice(0, MAX_READ_FILES).map(([path, reason]) => file(byPath.get(path)!.content, path, reason));
}

const suspiciousRules = [
  ["eval", /\beval\b/, "uses eval-style dynamic code execution", "high"],
  ["Function", /Function\s*\(/, "creates code dynamically with Function", "high"],
  ["child_process", /child_process/, "can spawn child processes", "high"],
  ["process.env", /process\.env/, "reads environment variables", "medium"],
  [".npmrc", /\.npmrc/, "references npm credentials", "critical"],
  ["curl", /\bcurl\b/, "runs curl from package code", "high"],
  ["wget", /\bwget\b/, "runs wget from package code", "high"],
  ["url", /https?:\/\//, "contains outbound URL", "medium"],
  ["fs.readFile", /fs\.readFile/, "reads local files", "medium"],
  ["fs.writeFile", /fs\.writeFile/, "writes local files", "medium"],
  ["os.homedir", /os\.homedir/, "accesses the user home directory", "high"],
] as const;

export function findNpmSuspiciousLines(files: PackageFile[]): SuspiciousLine[] {
  return files.filter(item => !isMarkdown(item.path)).flatMap(item => item.content.split(/\r?\n/).flatMap((line, index) => {
    return suspiciousRules
      .filter(([, pattern]) => pattern.test(line))
      .map(rule => ({ filePath: item.path, startLine: index + 1, severity: rule[3], sourceAgent: "Static" as const, reason: `Static Agent: ${rule[2]}.`, rule: rule[0] }));
  }));
}

function reusePackage(pkg: PackageEvidence, scanStatus: PackageEvidence["scanStatus"], previousReviewId?: string): PackageEvidence {
  return { ...pkg, scanStatus, evidenceSource: "global-cache", previousReviewId };
}

export function verifyNpmIntegrity(bytes: Buffer, integrity: string) {
  const token = integrity.split(/\s+/).find(item => /^sha(?:256|384|512)-/i.test(item));
  if (!token) throw new Error("npm lockfile integrity is missing a supported SHA digest");
  const [algorithm, expected] = token.split("-", 2);
  const actual = createHash(algorithm).update(bytes).digest("base64");
  if (actual !== expected) throw new Error("npm tarball integrity does not match package-lock.json");
}

function allowedResolvedTarball(resolved: string) {
  const url = new URL(resolved);
  if (url.protocol !== "https:" || url.hostname !== "registry.npmjs.org") throw new Error("Guarded npm install only supports HTTPS tarballs resolved by registry.npmjs.org.");
  return url.toString();
}

async function inspectPackage(name: string, version: string, artifactKey?: string, dependencyType = "npm:production/transitive", resolved?: string, integrity?: string): Promise<PackageEvidence> {
  let tarballUrl = resolved ? allowedResolvedTarball(resolved) : undefined;
  if (!tarballUrl) {
    const metadataResponse = await fetch(registryUrl(name), { signal: AbortSignal.timeout(10_000) });
    if (!metadataResponse.ok) throw new Error(`npm metadata failed (${metadataResponse.status})`);
    const metadata = await metadataResponse.json() as any;
    tarballUrl = metadata.versions?.[version]?.dist?.tarball;
  }
  if (!tarballUrl) throw new Error(`npm tarball not found for ${version}`);
  const tarballResponse = await fetch(tarballUrl, { signal: AbortSignal.timeout(15_000) });
  if (!tarballResponse.ok) throw new Error(`npm tarball failed (${tarballResponse.status})`);
  const compressed = Buffer.from(await tarballResponse.arrayBuffer());
  if (integrity) verifyNpmIntegrity(compressed, integrity);
  const entries = parseTar(await unzip(compressed));
  const files = entries.map(entry => displayedPath(entry.path)).sort();
  const inspectedFiles = selectFiles(entries);
  const lines = findNpmSuspiciousLines(inspectedFiles);
  return {
    name,
    version,
    packageManager: "npm",
    dependencyType,
    scanStatus: "new",
    evidenceSource: "fresh-scan",
    artifactKey: artifactKey || `npm:${name}@${version}:${tarballUrl}`,
    verifiedIntegrity: integrity,
    tarballUrl,
    fileCount: files.length,
    files,
    inspectedFiles,
    suspiciousLines: lines,
    status: lines.some(line => line.severity === "critical" || line.severity === "high") ? "Review" : "Allow",
    reason: lines.length ? `${lines.length} suspicious static line${lines.length === 1 ? "" : "s"} found.` : inspectedFiles.length ? "Package tarball retrieved and selected files inspected." : "Package tarball retrieved, but no readable files were selected.",
  };
}

export async function collectNpmPackageEvidence(files: Record<string, string>, onProgress?: PackageProgress, context: PackageCollectionContext = {}) {
  if (!files["package.json"]) return [];
  const manifest = parseJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>("package.json", files["package.json"]);
  if (!files["package-lock.json"]) {
    if (context.requireFullCoverage) throw new Error("package-lock.json is required for complete npm install coverage.");
    return Object.keys(manifest.dependencies || {}).sort().slice(0, MAX_WEB_PACKAGES).map(name => ({
      name, version: "unresolved", packageManager: "npm" as const, dependencyType: "npm:dependencies",
      scanStatus: "unscanned" as const, evidenceSource: "none" as const, fileCount: 0, files: [], inspectedFiles: [], suspiciousLines: [], status: "Review" as Verdict,
      reason: "package-lock.json is required to resolve and inspect the exact npm package version.",
    }));
  }
  const lock = parseJson<Record<string, any>>("package-lock.json", files["package-lock.json"]);
  const fromLock = lockedPackages(lock);
  if (context.requireFullCoverage && !fromLock.length) throw new Error("npm lockfile v2 or v3 with a packages map is required for complete install coverage.");
  if (context.requireFullCoverage && fromLock.length > MAX_GUARDED_PACKAGES) throw new Error(`Resolved npm package count (${fromLock.length}) exceeds the guarded CLI MVP limit of ${MAX_GUARDED_PACKAGES} packages per project (set to control API cost).`);
  const fallback = Object.keys(manifest.dependencies || {}).sort().map(name => {
    const entry = lock.packages?.[`node_modules/${name}`] || lock.dependencies?.[name] || {};
    return { name, version: typeof entry.version === "string" ? entry.version : "", entry, dependencyType: "npm:dependencies" };
  });
  const targets = (context.requireFullCoverage ? fromLock : fallback).slice(0, context.requireFullCoverage ? MAX_GUARDED_PACKAGES : MAX_WEB_PACKAGES);
  const packages: PackageEvidence[] = [];
  const cached = new Map((context.cached || []).map(pkg => [pkg.artifactKey || `${pkg.packageManager}:${pkg.name}@${pkg.version}`, pkg]));
  const previous = new Map((context.previous || []).map(pkg => [pkg.name, pkg]));
  for (const target of targets) {
    const { name, version, entry, dependencyType } = target;
    const prior = previous.get(name);
    if (!version) {
      packages.push({ name, version: "unresolved", packageManager: "npm", dependencyType, scanStatus: "unscanned", evidenceSource: "none", fileCount: 0, files: [], inspectedFiles: [], suspiciousLines: [], status: "Review", reason: "No exact package version found in package-lock.json." });
    } else {
      const artifactKey = lockArtifactKey(name, version, entry);
      const cachedPackage = cached.get(artifactKey) || cached.get(`npm:${name}@${version}:registry`);
      try {
        if (context.requireFullCoverage && (typeof entry.resolved !== "string" || typeof entry.integrity !== "string")) throw new Error("Exact resolved tarball URL and integrity are required for guarded npm install.");
        if (context.requireFullCoverage) allowedResolvedTarball(entry.resolved);
        const reusableCache = cachedPackage && (!context.requireFullCoverage || cachedPackage.verifiedIntegrity === entry.integrity);
        packages.push(reusableCache
          ? { ...reusePackage(cachedPackage, prior && prior.version !== version ? "changed" : "reused", prior?.evidenceId || prior?.previousReviewId), dependencyType }
          : { ...await inspectPackage(name, version, artifactKey, dependencyType, entry.resolved, entry.integrity), scanStatus: prior && prior.version !== version ? "changed" : "new" });
      } catch (error) {
        packages.push({ name, version, packageManager: "npm", dependencyType, scanStatus: "unscanned", evidenceSource: "none", artifactKey: `npm:${name}@${version}`, fileCount: 0, files: [], inspectedFiles: [], suspiciousLines: [], status: "Review", reason: error instanceof Error ? error.message : "Package retrieval failed." });
      }
    }
    onProgress?.([...packages]);
  }
  if (targets.length && !packages.some(pkg => pkg.inspectedFiles.length || pkg.evidenceSource === "global-cache")) throw new Error("No npm packages could be inspected. Check npm registry access and try again.");
  return packages;
}

export function applyPackageFindings(packages: PackageEvidence[], findings?: PackageFinding[]) {
  if (!findings?.length) return packages;
  const byName = new Map(findings.map(finding => [`${finding.name}@${finding.version}`, finding]));
  return packages.map(pkg => {
    const finding = byName.get(`${pkg.name}@${pkg.version}`) || findings.find(item => item.name === pkg.name);
    return finding ? { ...pkg, status: finding.verdict, reason: finding.reason, evidence: finding.evidence.slice(0, 6), suspiciousLines: finding.suspiciousLines?.length ? finding.suspiciousLines : pkg.suspiciousLines } : pkg;
  });
}
