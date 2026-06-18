"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import "./review.css";

const agents = [
  { n: "01", name: "Baseline", state: "Complete", tone: "neutral", title: "One direct update, four transitive changes", body: "postcss moved from 8.4.31 to 8.4.32. The approved state contains 142 packages; this state contains 146.", evidence: "package-lock.json · lines 2,146–2,181" },
  { n: "02", name: "Manifest", state: "Flagged", tone: "danger", title: "New lifecycle script does not match package purpose", body: "The patch release adds a postinstall command. A CSS transformer does not need install-time shell access.", evidence: "package/package.json · scripts.postinstall" },
  { n: "03", name: "Static", state: "Flagged", tone: "danger", title: "Encoded command reads environment secrets", body: "The install file decodes a payload, reads process.env, and sends a request to an unlisted host.", evidence: "package/install.js · lines 4–19" },
  { n: "04", name: "Behavior", state: "Observed", tone: "danger", title: "Sandbox captured outbound traffic", body: "Install attempted POST /collect to 185.244.25.91 with CI and npm token fields in the body.", evidence: "Sandbox trace · run sbx_31a7" },
  { n: "05", name: "Skeptic", state: "Resolved", tone: "warning", title: "Could this be legitimate telemetry?", body: "Telemetry could explain a network call, but not an undocumented IP endpoint, encoded payload, or token collection. Challenge rejected.", evidence: "Manifest claim ↔ behavior trace" },
  { n: "06", name: "Judge", state: "Block", tone: "danger", title: "Evidence meets strict-policy block threshold", body: "Static intent and observed behavior agree. Do not merge this dependency state. Pin the last approved version.", evidence: "Policy strict · 3 independent signals" },
];

export default function ReviewPage() {
  const [reviewed, setReviewed] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [activeAgent, setActiveAgent] = useState(-1);
  const [repo, setRepo] = useState("https://github.com/acme/storefront");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const repoName = repo.split("/").filter(Boolean).at(-1) || "storefront";

  useEffect(() => {
    const imported = new URLSearchParams(window.location.search).get("repo");
    if (imported?.startsWith("https://github.com/")) setRepo(imported);
  }, []);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (timer.current) clearInterval(timer.current);
    setReviewed(false);
    setAuditing(true);
    setActiveAgent(0);
    requestAnimationFrame(() => document.querySelector("#audit-process")?.scrollIntoView({ behavior: "smooth" }));
    let step = 0;
    timer.current = setInterval(() => {
      step += 1;
      if (step < agents.length) return setActiveAgent(step);
      if (timer.current) clearInterval(timer.current);
      setAuditing(false);
      setReviewed(true);
      requestAnimationFrame(() => document.querySelector("#report")?.scrollIntoView({ behavior: "smooth" }));
    }, 720);
  }

  return <main className="review-page">
    <section className="review-intro wrap">
      <div>
        <p className="eyebrow">Workspace review / New state</p>
        <h1>Put the change<br />on trial.</h1>
      </div>
      <p className="intro-copy">Import a public repository. Locksmith reads its dependency files, compares the last approved state, and asks six specialists for one decision.</p>
    </section>

    <section className="import-panel wrap card" aria-labelledby="import-title">
      <div className="import-index mono">01 / IMPORT</div>
      <form onSubmit={submit}>
        <label id="import-title" htmlFor="repo">Public GitHub repository</label>
        <div className="repo-input">
          <span aria-hidden="true">github.com/</span>
          <input id="repo" value={repo.replace("https://github.com/", "")} onChange={(event) => setRepo(`https://github.com/${event.target.value}`)} required aria-describedby="repo-note" />
          <button className="button" type="submit">Review repository <span aria-hidden="true">→</span></button>
        </div>
        <p id="repo-note">Demo uses a prepared repository state. No GitHub account required.</p>
      </form>
      <dl className="import-meta">
        <div><dt>Policy</dt><dd>Strict</dd></div>
        <div><dt>Branch</dt><dd className="mono">feature/postcss</dd></div>
        <div><dt>Baseline</dt><dd>Last approved state</dd></div>
      </dl>
    </section>

    {auditing ? <section id="audit-process" className="audit-process wrap" aria-live="polite" aria-label="Dependency audit in progress">
      <header className="process-head">
        <div><p className="eyebrow">Live audit / Prepared demo</p><h2>Building the case.</h2></div>
        <div className="process-count mono">{String(Math.min(activeAgent + 1, 6)).padStart(2, "0")} / 06</div>
      </header>
      <div className="process-repo"><span className="process-pulse" aria-hidden="true" /><span>Reviewing</span><strong>{repo}</strong></div>
      <ol className="process-list">
        {agents.map((agent, index) => {
          const state = index < activeAgent ? "done" : index === activeAgent ? "running" : "waiting";
          return <li className={`process-step ${state}`} key={agent.name}>
            <span className="mono">{agent.n}</span><strong>{agent.name} Agent</strong>
            <p>{state === "done" ? agent.title : state === "running" ? agent.body : "Waiting for prior evidence"}</p>
            <span className="process-status mono">{state === "done" ? "Complete" : state === "running" ? "Inspecting" : "Queued"}</span>
          </li>;
        })}
      </ol>
      <p className="process-note">Demo timing is hardcoded. Findings below represent prepared audit evidence.</p>
    </section> : null}

    {reviewed ? <section id="report" className="report wrap" aria-live="polite">
      <header className="report-head">
        <div>
          <p className="eyebrow">Review rev_8F21 / Complete</p>
          <h2>{repoName} <span>/</span> feature/postcss</h2>
        </div>
        <span className="tag red">Block</span>
      </header>

      <dl className="state-strip">
        <div><dt>Commit</dt><dd>8fa21c9</dd></div>
        <div><dt>Dependency state</dt><dd>state_61e9…4c12</dd></div>
        <div><dt>Lockfile SHA-256</dt><dd>94d2…e80a</dd></div>
        <div><dt>Package manager</dt><dd>npm</dd></div>
      </dl>

      <div className="trust-grid">
        <article className="trust-card">
          <p className="eyebrow">Global analysis</p>
          <div className="trust-title"><strong>Risk evidence found</strong><span className="tag red">Revoked</span></div>
          <p>Public evidence for postcss@8.4.32 now includes a matching malicious release report.</p>
          <small>Reusable evidence · updated 4 minutes ago</small>
        </article>
        <article className="trust-card workspace">
          <p className="eyebrow">Your workspace</p>
          <div className="trust-title"><strong>Approval required</strong><span className="tag yellow">No decision</span></div>
          <p>This exact state has not been approved by Acme. The previous state remains valid.</p>
          <small>Private decision · strict policy</small>
        </article>
      </div>

      <div className="section-heading">
        <div><p className="eyebrow">02 / Dependency change</p><h2>What changed</h2></div>
        <p>1 direct update · 4 transitive additions · 145 unchanged</p>
      </div>
      <div className="diff-table" role="table" aria-label="Dependency changes">
        <div className="diff-row diff-label" role="row"><span>Package</span><span>Approved</span><span>Proposed</span><span>Risk</span></div>
        <div className="diff-row" role="row"><strong>postcss</strong><code>8.4.31</code><code>8.4.32</code><span className="tag red">Critical</span></div>
        <div className="diff-row" role="row"><span>collector-utils</span><span>—</span><code>1.0.1</code><span className="tag red">Critical</span></div>
        <div className="diff-row" role="row"><span>picocolors</span><code>1.0.0</code><code>1.0.1</code><span className="tag green">Clear</span></div>
      </div>

      <div className="section-heading agents-heading">
        <div><p className="eyebrow">03 / Agent society</p><h2>Six views. One verdict.</h2></div>
        <p>Each specialist owns a narrow question. The Judge sees claims, challenges, and evidence—not a synthetic chat.</p>
      </div>
      <ol className="agent-list">
        {agents.map((agent) => <li className={`agent agent-${agent.tone}`} key={agent.name}>
          <div className="agent-number mono">{agent.n}</div>
          <div className="agent-name"><strong>{agent.name}</strong><span>{agent.state}</span></div>
          <div className="agent-finding"><h3>{agent.title}</h3><p>{agent.body}</p></div>
          <div className="agent-evidence"><span>Evidence</span><code>{agent.evidence}</code></div>
        </li>)}
      </ol>

      <section className="verdict" aria-labelledby="verdict-title">
        <div className="verdict-mark" aria-hidden="true">×</div>
        <div>
          <p className="eyebrow">Final verdict / 96% confidence</p>
          <h2 id="verdict-title">Block this state.</h2>
          <p>Do not merge or install <code>postcss@8.4.32</code>. Restore the last workspace-approved dependency state while evidence is investigated.</p>
          <div className="verdict-actions"><button className="button" type="button">Pin postcss@8.4.31</button><button className="button secondary" type="button">Copy review link</button></div>
        </div>
        <dl><div><dt>Policy</dt><dd>Strict</dd></div><div><dt>Resolution</dt><dd>Static + sandbox agree</dd></div><div><dt>Approved fallback</dt><dd>state_B17C…901E</dd></div></dl>
      </section>

      <section className="history" aria-labelledby="history-title">
        <p className="eyebrow">Review history</p>
        <h2 id="history-title">A decision trail, not a forever score.</h2>
        <div className="history-row"><time>Today, 14:32</time><strong>Blocked</strong><span>rev_8F21 · postcss 8.4.32</span></div>
        <div className="history-row"><time>12 Jun, 09:14</time><strong>Approved</strong><span>rev_71BA · baseline created by Maya C.</span></div>
      </section>
    </section> : null}
  </main>;
}
