import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { sanitizePackagesForStorage } from "./evidenceRetention.ts";
import type { PackageEvidence } from "./npmPackages.ts";

export type PackageEvidenceStorageOptions = { rootDir?: string };
export type EvidenceFile = { packages: PackageEvidence[] };

function evidencePathFor(options: PackageEvidenceStorageOptions = {}) {
  return join(resolve(options.rootDir || process.cwd()), ".locksmith", "package-evidence.json");
}

export async function readPackageEvidence(options: PackageEvidenceStorageOptions = {}): Promise<EvidenceFile> {
  try {
    const parsed = JSON.parse(await readFile(evidencePathFor(options), "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as EvidenceFile).packages)) {
      throw new Error("Locksmith package evidence is malformed");
    }
    return parsed as EvidenceFile;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { packages: [] };
    throw error;
  }
}

export async function savePackageEvidence(packages: PackageEvidence[], options: PackageEvidenceStorageOptions = {}) {
  const current = await readPackageEvidence(options);
  const byKey = new Map(sanitizePackagesForStorage(current.packages).map(pkg => [pkg.artifactKey || `${pkg.packageManager}:${pkg.name}@${pkg.version}`, pkg]));
  for (const pkg of sanitizePackagesForStorage(packages)) {
    if (pkg.scanStatus === "unscanned") continue;
    byKey.set(pkg.artifactKey || `${pkg.packageManager}:${pkg.name}@${pkg.version}`, pkg);
  }
  const evidencePath = evidencePathFor(options);
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify({ packages: [...byKey.values()].slice(-500) }, null, 2));
}
