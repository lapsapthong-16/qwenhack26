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
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const params = new URLSearchParams(window.location.search);
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
    return data;
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
      const initialJob = await loadJob(data.reviewId);
      // loadJob may have already completed the job and cleared the polling ref.
      // Only keep polling while the review is still active.
      if (initialJob.status !== "complete" && initialJob.status !== "failed") poll.current = setInterval(() => void loadJob(data.reviewId).catch(cause => {
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

function PackageCard({ pkg }:{ pkg:PackageEvidence }) {
  return <article className={`package-card status-${pkg.status.toLowerCase()}`}>
    <header><div><strong>{pkg.name}</strong><code>{pkg.version}</code></div><b>{pkg.status}</b></header>
    <p>{pkg.reason}</p>
    <dl><div><dt>Type</dt><dd>{pkg.dependencyType}</dd></div><div><dt>Files</dt><dd>{pkg.fileCount}</dd></div><div><dt>Inspected</dt><dd>{pkg.inspectedFiles.map(file => file.path).join(" · ") || "None"}</dd></div></dl>
    {pkg.evidence?.length ? <small>{pkg.evidence.join(" · ")}</small> : null}
    <details><summary>All internal files</summary><ol>{pkg.files.map(file => <li key={file}>{file}</li>)}</ol></details>
  </article>;
}
