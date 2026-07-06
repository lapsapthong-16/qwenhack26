import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import type { Verdict } from "./locksmith";

const unzip = promisify(gunzip);
const MAX_PACKAGES = 20;
const MAX_SCAN_FILES = 40;
const MAX_READ_FILES = 12;
const MAX_FILE_BYTES = 20_000;

export type PackageFile = { path: string; reason: string; content: string };
export type PackageFinding = { name: string; version: string; verdict: Verdict; reason: string; evidence: string[] };
export type PackageEvidence = {
  name: string;
  version: string;
  dependencyType: "dependencies";
  tarballUrl?: string;
  fileCount: number;
  files: string[];
  inspectedFiles: PackageFile[];
  status: Verdict;
  reason: string;
  evidence?: string[];
};

type TarEntry = { path: string; content: Buffer };

export type PackageProgress = (packages: PackageEvidence[]) => void;

function parseJson<T>(name: string, content?: string): T {
  if (!content) throw new Error(`${name} is required`);
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}

function lockVersion(lock: Record<string, any>, name: string) {
  return lock.packages?.[`node_modules/${name}`]?.version || lock.dependencies?.[name]?.version;
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
    if (byPath.has(full)) selected.set(full, reason);
  };
  add("package.json", "package manifest");
  add(pkg.main, "main entrypoint");
  add(pkg.module, "module entrypoint");
  for (const value of Object.values(pkg.bin || {})) add(value as string, "bin entrypoint");
  for (const script of pickScriptFiles(pkg.scripts)) add(script, "lifecycle script target");
  const exports = typeof pkg.exports === "string" ? [pkg.exports] : Object.values(pkg.exports || {}).flatMap(value => typeof value === "string" ? [value] : Object.values(value as Record<string, string> || {}));
  for (const value of exports) add(value as string, "export entrypoint");

  const suspicious = /\beval\b|Function\s*\(|child_process|process\.env|\.npmrc|\bcurl\b|\bwget\b|https?:\/\/|fs\.readFile|fs\.writeFile|os\.homedir/;
  for (const entry of entries.slice(0, MAX_SCAN_FILES)) {
    const content = text(entry.content);
    if (content && suspicious.test(content)) selected.set(entry.path, "suspicious static pattern");
  }
  return [...selected.entries()].slice(0, MAX_READ_FILES).map(([path, reason]) => ({ path, reason, content: text(byPath.get(path)!.content) }));
}

async function inspectPackage(name: string, version: string): Promise<PackageEvidence> {
  const metadataResponse = await fetch(registryUrl(name), { signal: AbortSignal.timeout(10_000) });
  if (!metadataResponse.ok) throw new Error(`npm metadata failed (${metadataResponse.status})`);
  const metadata = await metadataResponse.json() as any;
  const tarballUrl = metadata.versions?.[version]?.dist?.tarball;
  if (!tarballUrl) throw new Error(`npm tarball not found for ${version}`);
  const tarballResponse = await fetch(tarballUrl, { signal: AbortSignal.timeout(15_000) });
  if (!tarballResponse.ok) throw new Error(`npm tarball failed (${tarballResponse.status})`);
  const entries = parseTar(await unzip(Buffer.from(await tarballResponse.arrayBuffer())));
  const files = entries.map(entry => entry.path).sort();
  const inspectedFiles = selectFiles(entries);
  return {
    name,
    version,
    dependencyType: "dependencies",
    tarballUrl,
    fileCount: files.length,
    files,
    inspectedFiles,
    status: "Allow",
    reason: inspectedFiles.length ? "Package tarball retrieved and selected files inspected." : "Package tarball retrieved, but no readable files were selected.",
  };
}

export async function collectNpmPackageEvidence(files: Record<string, string>, onProgress?: PackageProgress) {
  if (!files["package-lock.json"]) throw new Error("package-lock.json is required for npm package review. Commit a lockfile and scan again.");
  const manifest = parseJson<{ dependencies?: Record<string, string> }>("package.json", files["package.json"]);
  const lock = parseJson<Record<string, any>>("package-lock.json", files["package-lock.json"]);
  const deps = Object.keys(manifest.dependencies || {}).sort().slice(0, MAX_PACKAGES);
  const packages: PackageEvidence[] = [];
  for (const name of deps) {
    const version = lockVersion(lock, name);
    if (!version) {
      packages.push({ name, version: "unresolved", dependencyType: "dependencies", fileCount: 0, files: [], inspectedFiles: [], status: "Review", reason: "No exact production dependency version found in package-lock.json." });
    } else {
      try {
        packages.push(await inspectPackage(name, version));
      } catch (error) {
        packages.push({ name, version, dependencyType: "dependencies", fileCount: 0, files: [], inspectedFiles: [], status: "Review", reason: error instanceof Error ? error.message : "Package retrieval failed." });
      }
    }
    onProgress?.([...packages]);
  }
  if (deps.length && !packages.some(pkg => pkg.inspectedFiles.length)) throw new Error("No npm packages could be inspected. Check npm registry access and try again.");
  return packages;
}

export function applyPackageFindings(packages: PackageEvidence[], findings?: PackageFinding[]) {
  if (!findings?.length) return packages;
  const byName = new Map(findings.map(finding => [`${finding.name}@${finding.version}`, finding]));
  return packages.map(pkg => {
    const finding = byName.get(`${pkg.name}@${pkg.version}`) || findings.find(item => item.name === pkg.name);
    return finding ? { ...pkg, status: finding.verdict, reason: finding.reason, evidence: finding.evidence.slice(0, 6) } : pkg;
  });
}
