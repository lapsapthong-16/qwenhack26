import { gunzip, inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import type { PackageCollectionContext, PackageEvidence, PackageFile, PackageProgress } from "./npmPackages.ts";

const unzip = promisify(gunzip);
const inflate = promisify(inflateRaw);
const MAX_PACKAGES = 20;
const MAX_SCAN_FILES = 60;
const MAX_READ_FILES = 12;
const MAX_FILE_BYTES = 20_000;

type Entry = { path: string; content: Buffer };
type Requirement = { name: string; version?: string };

function isMarkdown(path: string) {
  return /\.(md|mdx|markdown)$/i.test(path);
}

function displayedPath(path: string) {
  return isMarkdown(path) ? `${path} (omitted)` : path;
}

function dependencyText(content = "") {
  return content.includes("\0") ? content.replaceAll("\0", "") : content;
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
  };
}

function octal(buffer: Buffer, start: number, length: number) {
  const raw = buffer.subarray(start, start + length).toString("utf8").replace(/\0.*$/, "").trim();
  return raw ? Number.parseInt(raw, 8) : 0;
}

function parseTar(buffer: Buffer): Entry[] {
  const entries: Entry[] = [];
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const size = octal(header, 124, 12);
    const type = header.subarray(156, 157).toString("utf8");
    const path = [prefix, name].filter(Boolean).join("/");
    if (path && (type === "0" || type === "")) entries.push({ path, content: buffer.subarray(offset + 512, offset + 512 + size) });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

async function parseZip(buffer: Buffer): Promise<Entry[]> {
  const entries: Entry[] = [];
  for (let offset = 0; offset + 30 <= buffer.length;) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const path = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    const body = buffer.subarray(start, start + compressedSize);
    if (path && !path.endsWith("/")) {
      if (method === 0) entries.push({ path, content: body });
      if (method === 8) entries.push({ path, content: await inflate(body) });
    }
    offset = start + compressedSize;
  }
  return entries;
}

function requirements(files: Record<string, string>) {
  const raw = [
    ...(dependencyText(files["requirements.txt"]).split(/\r?\n/) || []),
    ...[...dependencyText(files["pyproject.toml"]).matchAll(/["']([A-Za-z0-9_.-]+(?:\[[^\]]+\])?\s*(?:[<>=!~]=?.*)?)["']/g)].map(match => match[1]),
  ];
  const seen = new Map<string, Requirement>();
  for (const line of raw) {
    const clean = line.replace(/#.*/, "").trim().replace(/^[^\w.-]+/, "");
    const match = /^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*(?:(={2,3})\s*([A-Za-z0-9_.!+-]+)|[<>=!~].*)?$/.exec(clean);
    if (match) seen.set(match[1].toLowerCase().replaceAll("_", "-"), { name: match[1], version: match[2] ? match[3] : undefined });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_PACKAGES);
}

function selectFiles(entries: Entry[]): PackageFile[] {
  const selected = new Map<string, string>();
  const add = (entry: Entry | undefined, reason: string) => { if (entry && !isMarkdown(entry.path)) selected.set(entry.path, reason); };
  add(entries.find(entry => /(^|\/)(PKG-INFO|METADATA)$/.test(entry.path)), "package metadata");
  add(entries.find(entry => /(^|\/)pyproject\.toml$/.test(entry.path)), "build manifest");
  add(entries.find(entry => /(^|\/)setup\.py$/.test(entry.path)), "setup script");
  add(entries.find(entry => /(^|\/)__init__\.py$/.test(entry.path)), "package entrypoint");

  const suspicious = /\beval\s*\(|\bexec\s*\(|subprocess|os\.environ|os\.system|socket\.|requests\.|urllib\.|httpx\.|pathlib\.Path\.home|\.ssh|\.pypirc|base64\.b64decode/;
  for (const entry of entries.filter(entry => !isMarkdown(entry.path)).slice(0, MAX_SCAN_FILES)) {
    const content = text(entry.content);
    if (content && suspicious.test(content)) selected.set(entry.path, "suspicious static pattern");
  }
  return [...selected.entries()].slice(0, MAX_READ_FILES).map(([path, reason]) => file(entries.find(entry => entry.path === path)!.content, path, reason));
}

const suspiciousRules = [
  ["eval", /\beval\s*\(/, "uses eval-style dynamic code execution", "high"],
  ["exec", /\bexec\s*\(/, "executes dynamic Python code", "high"],
  ["subprocess", /subprocess/, "can spawn subprocesses", "high"],
  ["os.environ", /os\.environ/, "reads environment variables", "medium"],
  ["os.system", /os\.system/, "runs shell commands", "high"],
  ["socket", /socket\./, "opens raw network sockets", "medium"],
  ["requests", /requests\./, "can make outbound HTTP requests", "medium"],
  ["urllib", /urllib\./, "can make outbound HTTP requests", "medium"],
  ["httpx", /httpx\./, "can make outbound HTTP requests", "medium"],
  ["Path.home", /(?:pathlib\.)?Path\.home/, "accesses the user home directory", "high"],
  [".ssh", /\.ssh/, "references SSH credentials", "critical"],
  [".pypirc", /\.pypirc/, "references PyPI credentials", "critical"],
  ["base64.b64decode", /base64\.b64decode/, "decodes base64 payloads", "medium"],
] as const;

export function findPythonSuspiciousLines(files: PackageFile[]) {
  return files.filter(item => !isMarkdown(item.path)).flatMap(item => item.content.split(/\r?\n/).flatMap((line, index) => {
    return suspiciousRules
      .filter(([, pattern]) => pattern.test(line))
      .map(rule => ({ filePath: item.path, startLine: index + 1, severity: rule[3], sourceAgent: "Static" as const, reason: `Static Agent: ${rule[2]}.`, rule: rule[0] }));
  }));
}

function reusePackage(pkg: PackageEvidence, scanStatus: PackageEvidence["scanStatus"], previousReviewId?: string): PackageEvidence {
  return { ...pkg, scanStatus, evidenceSource: "global-cache", previousReviewId };
}

async function inspectPackage(name: string, version: string): Promise<PackageEvidence> {
  const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`PyPI metadata failed (${response.status})`);
  const metadata = await response.json() as { urls?: { url: string; packagetype?: string }[] };
  const artifact = metadata.urls?.find(item => item.packagetype === "sdist") || metadata.urls?.find(item => item.url.endsWith(".whl"));
  if (!artifact) throw new Error(`PyPI artifact not found for ${version}`);
  const artifactResponse = await fetch(artifact.url, { signal: AbortSignal.timeout(15_000) });
  if (!artifactResponse.ok) throw new Error(`PyPI artifact failed (${artifactResponse.status})`);
  const body = Buffer.from(await artifactResponse.arrayBuffer());
  const entries = artifact.url.endsWith(".whl") ? await parseZip(body) : parseTar(await unzip(body));
  const files = entries.map(entry => displayedPath(entry.path)).sort();
  const inspectedFiles = selectFiles(entries);
  const lines = findPythonSuspiciousLines(inspectedFiles);
  return {
    name,
    version,
    packageManager: "pypi",
    dependencyType: "pypi:requirements",
    scanStatus: "new",
    evidenceSource: "fresh-scan",
    artifactKey: `pypi:${name}@${version}`,
    tarballUrl: artifact.url,
    fileCount: files.length,
    files,
    inspectedFiles,
    suspiciousLines: lines,
    status: lines.some(line => line.severity === "critical" || line.severity === "high") ? "Review" : "Allow",
    reason: lines.length ? `${lines.length} suspicious static line${lines.length === 1 ? "" : "s"} found.` : inspectedFiles.length ? "PyPI artifact retrieved and selected files inspected." : "PyPI artifact retrieved, but no readable files were selected.",
  };
}

export async function collectPythonPackageEvidence(files: Record<string, string>, onProgress?: PackageProgress, context: PackageCollectionContext = {}) {
  if (!files["requirements.txt"] && !files["pyproject.toml"]) return [];
  const deps = requirements(files);
  const packages: PackageEvidence[] = [];
  const cached = new Map((context.cached || []).map(pkg => [pkg.artifactKey || `${pkg.packageManager}:${pkg.name}@${pkg.version}`, pkg]));
  const previous = new Map((context.previous || []).map(pkg => [pkg.name.toLowerCase(), pkg]));
  for (const dep of deps) {
    const prior = previous.get(dep.name.toLowerCase());
    try {
      packages.push(dep.version
        ? cached.get(`pypi:${dep.name}@${dep.version}`)
          ? reusePackage(cached.get(`pypi:${dep.name}@${dep.version}`)!, prior && prior.version !== dep.version ? "changed" : "reused", prior?.evidenceId || prior?.previousReviewId)
          : { ...await inspectPackage(dep.name, dep.version), scanStatus: prior && prior.version !== dep.version ? "changed" : "new" }
        : { name: dep.name, version: "unresolved", packageManager: "pypi", dependencyType: "pypi:requirements", scanStatus: "unscanned", evidenceSource: "none", fileCount: 0, files: [], inspectedFiles: [], suspiciousLines: [], status: "Review", reason: "No exact pinned Python dependency version found." });
    } catch (error) {
      packages.push({ name: dep.name, version: dep.version || "unresolved", packageManager: "pypi", dependencyType: "pypi:requirements", scanStatus: "unscanned", evidenceSource: "none", artifactKey: `pypi:${dep.name}@${dep.version || "unresolved"}`, fileCount: 0, files: [], inspectedFiles: [], suspiciousLines: [], status: "Review", reason: error instanceof Error ? error.message : "Package retrieval failed." });
    }
    onProgress?.([...packages]);
  }
  if (packages.some(pkg => pkg.version !== "unresolved") && !packages.some(pkg => pkg.inspectedFiles.length)) {
    throw new Error("No PyPI packages could be inspected. Check PyPI access and pinned versions, then try again.");
  }
  return packages;
}
