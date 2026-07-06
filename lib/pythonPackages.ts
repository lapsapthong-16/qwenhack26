import { gunzip, inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import type { PackageEvidence, PackageFile, PackageProgress } from "./npmPackages";

const unzip = promisify(gunzip);
const inflate = promisify(inflateRaw);
const MAX_PACKAGES = 20;
const MAX_SCAN_FILES = 60;
const MAX_READ_FILES = 12;
const MAX_FILE_BYTES = 20_000;

type Entry = { path: string; content: Buffer };
type Requirement = { name: string; version?: string };

function dependencyText(content = "") {
  return content.includes("\0") ? content.replaceAll("\0", "") : content;
}

function text(buffer: Buffer) {
  if (buffer.includes(0)) return "";
  return buffer.toString("utf8", 0, Math.min(buffer.length, MAX_FILE_BYTES));
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
  const add = (entry: Entry | undefined, reason: string) => { if (entry) selected.set(entry.path, reason); };
  add(entries.find(entry => /(^|\/)(PKG-INFO|METADATA)$/.test(entry.path)), "package metadata");
  add(entries.find(entry => /(^|\/)pyproject\.toml$/.test(entry.path)), "build manifest");
  add(entries.find(entry => /(^|\/)setup\.py$/.test(entry.path)), "setup script");
  add(entries.find(entry => /(^|\/)__init__\.py$/.test(entry.path)), "package entrypoint");

  const suspicious = /\beval\s*\(|\bexec\s*\(|subprocess|os\.environ|os\.system|socket\.|requests\.|urllib\.|httpx\.|pathlib\.Path\.home|\.ssh|\.pypirc|base64\.b64decode/;
  for (const entry of entries.slice(0, MAX_SCAN_FILES)) {
    const content = text(entry.content);
    if (content && suspicious.test(content)) selected.set(entry.path, "suspicious static pattern");
  }
  return [...selected.entries()].slice(0, MAX_READ_FILES).map(([path, reason]) => ({ path, reason, content: text(entries.find(entry => entry.path === path)!.content) }));
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
  const files = entries.map(entry => entry.path).sort();
  const inspectedFiles = selectFiles(entries);
  return {
    name,
    version,
    dependencyType: "pypi:requirements",
    tarballUrl: artifact.url,
    fileCount: files.length,
    files,
    inspectedFiles,
    status: "Allow",
    reason: inspectedFiles.length ? "PyPI artifact retrieved and selected files inspected." : "PyPI artifact retrieved, but no readable files were selected.",
  };
}

export async function collectPythonPackageEvidence(files: Record<string, string>, onProgress?: PackageProgress) {
  if (!files["requirements.txt"] && !files["pyproject.toml"]) return [];
  const deps = requirements(files);
  const packages: PackageEvidence[] = [];
  for (const dep of deps) {
    try {
      packages.push(dep.version
        ? await inspectPackage(dep.name, dep.version)
        : { name: dep.name, version: "unresolved", dependencyType: "pypi:requirements", fileCount: 0, files: [], inspectedFiles: [], status: "Review", reason: "No exact pinned Python dependency version found." });
    } catch (error) {
      packages.push({ name: dep.name, version: dep.version || "unresolved", dependencyType: "pypi:requirements", fileCount: 0, files: [], inspectedFiles: [], status: "Review", reason: error instanceof Error ? error.message : "Package retrieval failed." });
    }
    onProgress?.([...packages]);
  }
  if (packages.some(pkg => pkg.version !== "unresolved") && !packages.some(pkg => pkg.inspectedFiles.length)) {
    throw new Error("No PyPI packages could be inspected. Check PyPI access and pinned versions, then try again.");
  }
  return packages;
}
