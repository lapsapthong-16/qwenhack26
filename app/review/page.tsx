"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./review.css";

const agents = [
  { n:"1", icon:"▱", name:"Baseline", claim:"Locked baseline is postcss 8.4.31 with no known critical vulnerabilities.", evidence:"evidence://baseline.json#L12–L18" },
  { n:"2", icon:"□", name:"Manifest", claim:"package.json updates postcss from 8.4.31 to 8.4.32 and adds a lifecycle script.", evidence:"evidence://manifest.json#L7–L12" },
  { n:"3", icon:"</>", name:"Static", claim:"The new install script reads process.env and prepares an outbound request.", evidence:"evidence://static.md#L45–L67" },
  { n:"4", icon:"△", name:"Behavior", claim:"Sandbox observed an outbound POST to an undeclared host during postinstall.", evidence:"evidence://behavior.json#L22–L91" },
  { n:"5", icon:"?", name:"Skeptic", claim:"Could this be legitimate telemetry? The package documents no network feature.", evidence:"evidence://skeptic.md#L10–L38" },
  { n:"6", icon:"⚖", name:"Judge", claim:"Behavior evidence confirms the static finding. Strict policy requires a block.", evidence:"evidence://verdict.json#L1–L24" },
] as const;

export default function ReviewPage() {
  const [repo, setRepo] = useState("https://github.com/northstar/storefront");
  const [phase, setPhase] = useState<"input"|"audit"|"report">("input");
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>|null>(null);
  const parts = repo.replace("https://github.com/","").split("/");

  useEffect(() => {
    const imported = new URLSearchParams(window.location.search).get("repo");
    if (imported?.startsWith("https://github.com/")) setRepo(imported);
  }, []);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function submit(event:FormEvent) {
    event.preventDefault();
    if (timer.current) clearInterval(timer.current);
    setPhase("audit"); setActive(0);
    let step = 0;
    timer.current = setInterval(() => {
      step += 1;
      if (step < agents.length) return setActive(step);
      if (timer.current) clearInterval(timer.current);
      setPhase("report");
    }, 520);
  }

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
      <form onSubmit={submit} className="review-import">
        <span aria-hidden="true">&gt;_</span>
        <label className="sr-only" htmlFor="review-repo">GitHub repository</label>
        <input id="review-repo" value={repo} onChange={(event)=>setRepo(event.target.value)} type="url" required />
        <button type="submit">Scan repository</button>
      </form>
      <small>Prepared public-repository demo · strict policy · no sign-in required</small>
    </section> : null}

    {phase === "audit" ? <section className="audit-screen" aria-live="polite">
      <div className="audit-head"><div><p className="eyebrow">Live dependency review</p><h1>Building the case.</h1></div><strong>{String(active+1).padStart(2,"0")} / 06</strong></div>
      <div className="audit-repo"><i /> Reviewing <code>{repo}</code></div>
      <ol>{agents.map((agent,index)=><li className={index<active?"done":index===active?"active":"waiting"} key={agent.name}><span>{agent.n}</span><b>{agent.name}</b><p>{index<=active?agent.claim:"Waiting for prior evidence"}</p><em>{index<active?"Complete":index===active?"Inspecting":"Queued"}</em></li>)}</ol>
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
          <ol>{agents.map((agent)=><li className={`discussion-row row-${agent.n}`} key={agent.name}>
            <span>{agent.n}</span><i aria-hidden="true">{agent.icon}</i><strong>{agent.name}</strong><p>{agent.claim}</p><a href={`#agent-${agent.n}`}>{agent.evidence}</a>
          </li>)}</ol>
        </section>
      </div>

      <aside className="decision-panel">
        <div className="block-word">BLOCK</div>
        <dl>
          <div><dt>Global analysis</dt><dd>Confirmed risk</dd></div>
          <div><dt>Your workspace</dt><dd>Approval required</dd></div>
          <div><dt>Policy</dt><dd>Strict</dd></div>
          <div><dt>State ID</dt><dd><code>st_01HJZ7Q4Y5B8X2M9K3T6F1D2</code></dd></div>
        </dl>
        <div className="remediation"><span>Remediation</span><p>Pin postcss 8.4.31</p></div>
        <button type="button">Apply safe version</button>
        <a href="#evidence">Open evidence bundle</a>
      </aside>
    </section> : null}
  </main>;
}
