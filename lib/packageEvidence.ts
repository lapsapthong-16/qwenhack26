import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sanitizePackagesForStorage } from "./evidenceRetention";
import type { PackageEvidence } from "./npmPackages";

const evidencePath = join(process.cwd(), ".locksmith", "package-evidence.json");

type EvidenceFile = { packages: PackageEvidence[] };

export async function readPackageEvidence(): Promise<EvidenceFile> {
  try {
    return JSON.parse(await readFile(evidencePath, "utf8")) as EvidenceFile;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { packages: [] };
    throw error;
  }
}

export async function savePackageEvidence(packages: PackageEvidence[]) {
  const current = await readPackageEvidence();
  const byKey = new Map(sanitizePackagesForStorage(current.packages).map(pkg => [pkg.artifactKey || `${pkg.packageManager}:${pkg.name}@${pkg.version}`, pkg]));
  for (const pkg of sanitizePackagesForStorage(packages)) {
    if (pkg.scanStatus === "unscanned") continue;
    byKey.set(pkg.artifactKey || `${pkg.packageManager}:${pkg.name}@${pkg.version}`, pkg);
  }
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify({ packages: [...byKey.values()].slice(-500) }, null, 2));
}
