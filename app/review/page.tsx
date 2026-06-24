"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import RepoSearch from "../components/RepoSearch";
import "./review.css";

const demoAgents = [
  { n:"1", icon:"▱", name:"Baseline", claim:"Locked baseline is postcss 8.4.31 with no known critical vulnerabilities.", evidence:"evidence://baseline.json#L12–L18" },
  { n:"2", icon:"□", name:"Manifest", claim:"package.json updates postcss from 8.4.31 to 8.4.32 and adds a lifecycle script.", evidence:"evidence://manifest.json#L7–L12" },
  { n:"3", icon:"</>", name:"Static", claim:"The new install script reads process.env and prepares an outbound request.", evidence:"evidence://static.md#L45–L67" },
  { n:"4", icon:"△", name:"Behavior", claim:"Sandbox observed an outbound POST to an undeclared host during postinstall.", evidence:"evidence://behavior.json#L22–L91" },
  { n:"5", icon:"?", name:"Skeptic", claim:"Could this be legitimate telemetry? The package documents no network feature.", evidence:"evidence://skeptic.md#L10–L38" },
  { n:"6", icon:"⚖", name:"Judge", claim:"Behavior evidence confirms the static finding. Strict policy requires a block.", evidence:"evidence://verdict.json#L1–L24" },
] as const;

type Finding = { role:string; summary:string; evidence:string[]; verdict:"Allow"|"Review"|"Block"; confidence:number };
type ReviewResult = { dependencyStateId:string; findings:Finding[]; verdict:"Allow"|"Review"|"Block"; remediation?:string|string[]; mode?:string; model?:string };

export default function ReviewPage() {
  const [repo, setRepo] = useState("https://github.com/northstar/storefront");
  const [phase, setPhase] = useState<"input"|"audit"|"report">("input");
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<ReviewResult|null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval>|null>(null);
  const parts = repo.replace("https://github.com/","").split("/");

  useEffect(() => {
    const imported = new URLSearchParams(window.location.search).get("repo");
    if (imported?.startsWith("https://github.com/")) setRepo(imported);
  }, []);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function runReview(payload:{ repo?:string; branch?:string } = {}) {
    if (timer.current) clearInterval(timer.current);
    if (payload.repo) setRepo(payload.repo);
    setError(""); setResult(null); setPhase("audit"); setActive(0);
    timer.current = setInterval(() => setActive((step) => Math.min(step + 1, demoAgents.length - 1)), 900);
    try {
      const response = await fetch("/api/review", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Review failed");
      setResult(data); setActive(5); setPhase("report");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review failed"); setPhase("input");
    } finally { if (timer.current) clearInterval(timer.current); }
  }

  const findings = result?.findings || [];
  const verdict = result?.verdict || "Review";
  const remediation = Array.isArray(result?.remediation) ? result.remediation.join(" · ") : result?.remediation || "Inspect the evidence before approving.";

  return <main className="review-page">
    <header className="app-header">
      <Link className="app-brand" href="/"><span className="app-mark" aria-hidden="true" />Locksmith</Link>
      <span className="app-divider" />
      <span className="repo-crumb">▣&nbsp; {parts[0] || "northstar"} <b>/</b> {parts[1] || "storefront"}</span>
      <span className="app-divider" />
      <span className="repo-meta">⑂&nbsp; main&nbsp;⌄</span>
      <span className="app-divider" />
      <span className="repo-meta">◇&nbsp; 8f31c2a&nbsp; ▣</span>
      <button className="command-search" type="button">&gt;_&nbsp; Search or run command… <kbd>⌘K</kbd></button>
      <span className="avatar">JW<i /></span>
    </header>

    {phase === "input" ? <section className="review-start">
      <p className="eyebrow">Workspace review / new state</p>
      <h1>Review a dependency state.</h1>
      <p>Compare the lockfile, collect six specialist findings, and decide what enters your workspace.</p>
      <RepoSearch id="review-repo" initialRepo={repo} variant="review" onScan={runReview} />
      {error ? <p role="alert" style={{color:"var(--red)",fontFamily:"var(--mono)",fontSize:14}}>{error}</p> : null}
      <small>Prepared public-repository demo · strict policy · no sign-in required</small>
    </section> : null}

    {phase === "audit" ? <section className="audit-screen" aria-live="polite">
      <div className="audit-head"><div><p className="eyebrow">Live dependency review</p><h1>Building the case.</h1></div><strong>{String(active+1).padStart(2,"0")} / 06</strong></div>
      <div className="audit-repo"><i /> Reviewing <code>{repo}</code></div>
      <ol>{demoAgents.map((agent,index)=><li className={index<active?"done":index===active?"active":"waiting"} key={agent.name}><span>{agent.n}</span><b>{agent.name}</b><p>{index<=active?`Running ${agent.name.toLowerCase()} analysis…`:"Waiting for prior evidence"}</p><em>{index<active?"Complete":index===active?"Inspecting":"Queued"}</em></li>)}</ol>
    </section> : null}

    {phase === "report" ? <section className="review-workspace" aria-live="polite">
      <div className="review-record">
        <header className="record-title"><h1>Dependency review</h1><span><i /> State changed</span></header>
        <section className="dependency-diff" aria-labelledby="diff-title">
          <h2 id="diff-title">Dependency diff</h2>
          <div className="diff-head"><b>Package</b><b>Baseline</b><span /><b>Proposed</b><b>Change</b><b>Type</b></div>
          <div className="diff-data"><code>postcss</code><code>8.4.31</code><span>→</span><code>8.4.32</code><code>+0.0.1</code><code>patch</code></div>
        </section>

        <section className="discussion" aria-labelledby="discussion-title">
          <h2 id="discussion-title">Agent discussion</h2>
          <div className="discussion-head"><span>#</span><b>Role</b><b>Claim</b><b>Evidence</b></div>
          <ol>{findings.map((finding,index)=>{const evidence=Array.isArray(finding.evidence)?finding.evidence.join(" · "):finding.evidence; return <li className={`discussion-row row-${index+1}`} id={`agent-${index+1}`} key={`${finding.role}-${index}`}>
            <span>{index+1}</span><i aria-hidden="true">{demoAgents[index]?.icon || "·"}</i><strong>{finding.role}</strong><p>{finding.summary}</p><a href={`#agent-${index+1}`} title={`${finding.verdict} · ${Math.round(finding.confidence * 100)}% confidence`}>{evidence || "No evidence supplied"}</a>
          </li>})}</ol>
        </section>
      </div>

      <aside className="decision-panel">
        <div className={`block-word verdict-${verdict.toLowerCase()}`}>{verdict.toUpperCase()}</div>
        <dl>
          <div><dt>Global analysis</dt><dd>{result?.mode || "Local review"}</dd></div>
          <div><dt>Model</dt><dd>{result?.model || "Qwen"}</dd></div>
          <div><dt>Policy</dt><dd>Strict</dd></div>
          <div><dt>State ID</dt><dd><code>{result?.dependencyStateId}</code></dd></div>
        </dl>
        <div className="remediation"><span>Remediation</span><p>{remediation}</p></div>
        <a href="#evidence">Open evidence bundle</a>
      </aside>
    </section> : null}
  </main>;
}
