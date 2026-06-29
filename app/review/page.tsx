"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import RepoSearch from "../components/RepoSearch";
import "./review.css";

const agents = [
  { n: "1", icon: "▱", name: "Baseline" },
  { n: "2", icon: "□", name: "Manifest" },
  { n: "3", icon: "</>", name: "Static" },
  { n: "4", icon: "△", name: "Behavior" },
  { n: "5", icon: "?", name: "Skeptic" },
  { n: "6", icon: "⚖", name: "Judge" },
] as const;

type Verdict = "Allow" | "Review" | "Block";
type Finding = { role:string; summary:string; evidence:string[]; verdict:Verdict; confidence:number };
type PackageEvidence = { name:string; version:string; dependencyType:"dependencies"; fileCount:number; files:string[]; inspectedFiles:{path:string;reason:string;content:string}[]; status:Verdict; reason:string; evidence?:string[] };
type ReviewResult = { reviewId:string; dependencyStateId:string; source:string; files:string[]; packages:PackageEvidence[]; packageCount:number; inspectedPackageCount:number; packageSummary:string; findings:Finding[]; verdict:Verdict; remediation:string; mode:string; model:string };
type ReviewJob = {
  reviewId:string;
  status:"queued"|"retrieving-packages"|"running"|"complete"|"failed";
  currentRole?:string;
  completedRoles:string[];
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
  const verdict = result?.verdict || "Review";
  const completed = new Set(job?.completedRoles || findings.map(finding => finding.role));

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
        <h2>Retrieved npm packages</h2>
        <div className="package-grid">{packages.length ? packages.map(pkg => <PackageCard pkg={pkg} key={`${pkg.name}@${pkg.version}`} />) : <p>Fetching package tarballs...</p>}</div>
      </section> : null}
      <ol>{agents.map(agent => {
        const finding = findings.find(item => item.role === agent.name);
        const status = finding ? "done" : job?.currentRole === agent.name ? "active" : "waiting";
        return <li className={status} key={agent.name}>
          <span>{agent.n}</span><b>{agent.name}</b>
          <p>{finding?.summary || (status === "active" ? `Running ${agent.name.toLowerCase()} analysis...` : "Waiting for prior evidence")}</p>
          <em>{finding ? finding.verdict : status === "active" ? "Inspecting" : "Queued"}</em>
        </li>;
      })}</ol>
    </section> : null}

    {phase === "report" && result ? <section className="review-workspace" aria-live="polite">
      <div className="review-record">
        <header className="record-title"><h1>Dependency review</h1><span><i /> {result.files.join(" · ")}</span></header>

        <section className="dependency-diff" aria-labelledby="diff-title">
          <h2 id="diff-title">Retrieved dependency files</h2>
          <div className="diff-head"><b>File</b><b>Source</b><span /><b>State</b><b>Mode</b><b>Policy</b></div>
          {result.files.map(file => <div className="diff-data" key={file}><code>{file}</code><code>{result.source}</code><span>→</span><code>{result.dependencyStateId}</code><code>{result.mode}</code><code>strict</code></div>)}
        </section>

        <section className="package-panel" aria-labelledby="packages-title">
          <h2 id="packages-title">Reviewed npm packages</h2>
          <p className="package-summary">{result.packageSummary}</p>
          <div className="package-grid">{packages.map(pkg => <PackageCard pkg={pkg} key={`${pkg.name}@${pkg.version}`} />)}</div>
        </section>

        <section className="discussion" aria-labelledby="discussion-title">
          <h2 id="discussion-title">Agent discussion</h2>
          <div className="discussion-head"><span>#</span><b>Role</b><b>Claim</b><b>Evidence</b></div>
          <ol>{agents.map((agent,index) => {
            const finding = findings.find(item => item.role === agent.name);
            if (!finding) return null;
            const evidence = Array.isArray(finding.evidence) ? finding.evidence.join(" · ") : finding.evidence;
            return <li className={`discussion-row row-${index+1}`} id={`agent-${index+1}`} key={agent.name}>
              <span>{index+1}</span><i aria-hidden="true">{agent.icon}</i><strong>{finding.role}</strong><p>{finding.summary}</p><a href={`#agent-${index+1}`} title={`${finding.verdict} · ${Math.round(finding.confidence * 100)}% confidence`}>{evidence || "No evidence supplied"}</a>
            </li>;
          })}</ol>
        </section>
      </div>

      <aside className="decision-panel">
        <div className={`block-word verdict-${verdict.toLowerCase()}`}>{verdict.toUpperCase()}</div>
        <dl>
          <div><dt>Analysis</dt><dd>Qwen live</dd></div>
          <div><dt>Model</dt><dd>{result.model}</dd></div>
          <div><dt>History</dt><dd>Local-only</dd></div>
          <div><dt>State ID</dt><dd><code>{result.dependencyStateId}</code></dd></div>
        </dl>
        <div className="remediation"><span>Remediation</span><p>{result.remediation}</p></div>
        <Link href="/history">View history</Link>
      </aside>
    </section> : null}
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
