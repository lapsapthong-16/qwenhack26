import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { dependencyStateId, resolveFinalVerdict } from "../lib/locksmith.ts";
import { guardedNpmInstall, validateNpmInstallArgs } from "../lib/npmInstall.ts";
import { finalizeInstallApproval, findFinalizedInstallApproval, saveReview, withDecisionMetadata } from "../lib/reviewHistory.ts";

const packageJson = JSON.stringify({ name: "fixture-app", version: "1.0.0", dependencies: {} });
const lockfile = JSON.stringify({ name: "fixture-app", lockfileVersion: 3, packages: { "": { name: "fixture-app", version: "1.0.0" } } });

test("dependency state IDs are deterministic and order-independent", () => {
  const first = dependencyStateId({ "package.json": packageJson, "package-lock.json": lockfile });
  assert.equal(first, dependencyStateId({ "package-lock.json": lockfile, "package.json": packageJson }));
  assert.match(first, /^state_[a-f0-9]{24}$/);
  assert.notEqual(first, dependencyStateId({ "package.json": packageJson, "package-lock.json": `${lockfile} ` }));
});

test("final verdict stays blocked for critical package evidence", () => {
  assert.equal(resolveFinalVerdict("Allow", [{ status: "Block" } as never], true), "Block");
  assert.equal(resolveFinalVerdict("Allow", [{ status: "Review" } as never], true), "Review");
  assert.equal(resolveFinalVerdict("Allow", [{ status: "Allow" } as never], false), "Allow");
  assert.equal(resolveFinalVerdict("Allow", [], true), "Review");
});

test("guarded install rejects unsafe npm flags before execution", () => {
  assert.throws(() => validateNpmInstallArgs(["--ignore-scripts"]), /not supported/);
  assert.throws(() => validateNpmInstallArgs(["--registry=https:\/\/evil.example"]), /Registry/);
  assert.doesNotThrow(() => validateNpmInstallArgs(["--save-dev", "--save-exact"]));
});

test("guarded install does not start installation when review blocks", async () => {
  const root = await mkdtemp(join(tmpdir(), "locksmith-test-"));
  await writeFile(join(root, "package.json"), packageJson);
  await writeFile(join(root, "package-lock.json"), lockfile);
  const calls: string[][] = [];
  const outcome = await guardedNpmInstall({
    rootDir: root,
    npm: async (_command, args) => { calls.push(args); return 0; },
    reviewCandidate: async () => ({ reused: false, reportPath: join(root, "report.html"), result: {
      dependencyStateId: dependencyStateId({ "package.json": packageJson, "package-lock.json": lockfile }), source: "test", policy: "strict", mode: "qwen", model: "test", files: [], packages: [], packageCount: 0, inspectedPackageCount: 0, packageSummary: "blocked", findings: [], verdict: "Block", remediation: "remove package",
    }}),
  });
  assert.equal(outcome.code, 3);
  assert.deepEqual(calls, [["install", "--package-lock-only", "--ignore-scripts"]]);
  assert.equal(await readFile(join(root, "package.json"), "utf8"), packageJson);
});

test("workspace approvals are reusable only after install finalization", async () => {
  const root = await mkdtemp(join(tmpdir(), "locksmith-history-"));
  const review = withDecisionMetadata({
    reviewId: "rev-test",
    dependencyStateId: "state-test",
    source: "test",
    policy: "strict",
    mode: "qwen",
    model: "test",
    files: [],
    packages: [],
    packageCount: 0,
    inspectedPackageCount: 0,
    packageSummary: "allow",
    findings: [],
    verdict: "Allow",
    remediation: "none",
  }, { projectIdentity: "repo:test", decisionKind: "install-approval", decisionStatus: "pending-install" });
  await saveReview(review, { rootDir: root });
  const lookup = { projectIdentity: "repo:test", dependencyStateId: "state-test", policy: "strict" };
  assert.equal(await findFinalizedInstallApproval(lookup, { rootDir: root }), undefined);
  await finalizeInstallApproval("rev-test", { rootDir: root }, "2026-07-15T00:00:00.000Z");
  const finalized = await findFinalizedInstallApproval(lookup, { rootDir: root });
  assert.equal(finalized?.decisionStatus, "install-finalized");
});
