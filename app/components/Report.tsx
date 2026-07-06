"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const agents = [
  { icon: "[B]", name: "Baseline", title: "Compares current dependencies with prior scans and lists which packages need fresh inspection." },
  { icon: "[M]", name: "Manifest", title: "Checks package metadata, scripts, entrypoints, dependency jumps, and purpose mismatch." },
  { icon: "[S]", name: "Static", title: "Scans source files for suspicious code patterns and exact file lines." },
  { icon: "[H]", name: "Behavior", title: "Explains likely install/runtime behavior from retrieved files." },
  { icon: "[?]", name: "Skeptic", title: "Challenges weak evidence and false positives before a block decision." },
  { icon: "[J]", name: "Judge", title: "Combines all evidence into Allow, Review, or Block with the smallest fix." },
] as const;

export type Verdict = "Allow" | "Review" | "Block";
export type Finding = { role:string; summary:string; evidence:string[]; verdict:Verdict; confidence:number };
export type RoleStatus = "queued"|"running"|"done"|"failed";
export type SuspiciousLine = { filePath:string; startLine:number; endLine?:number; severity:"low"|"medium"|"high"|"critical"; sourceAgent:string; reviewedBy?:string; reason:string; rule?:string };
export type PackageFile = { path:string; reason:string; content:string; contentTruncated?:boolean; displayedBytes?:number; originalBytes?:number };
export type PackageEvidence = { name:string; version:string; packageManager?:"npm"|"pypi"; dependencyType:string; scanStatus?:"new"|"reused"|"changed"|"unscanned"; previousReviewId?:string; evidenceId?:string; evidenceSource?:"global-cache"|"workspace-cache"|"fresh-scan"|"none"; artifactKey?:string; fileCount:number; files:string[]; inspectedFiles:PackageFile[]; suspiciousLines?:SuspiciousLine[]; status:Verdict; reason:string; evidence?:string[] };
export type ReviewResult = { reviewId:string; dependencyStateId:string; source:string; files:string[]; packages:PackageEvidence[]; packageCount:number; inspectedPackageCount:number; packageSummary:string; findings:Finding[]; verdict:Verdict; remediation:string; mode:string; model:string };
export type ReportJob = {
  status:"queued"|"retrieving-packages"|"running"|"complete"|"failed";
  currentRole?:string;
  currentRoles?:string[];
  completedRoles:string[];
  roleStatus?:Record<string,RoleStatus>;
  roleErrors?:Record<string,string>;
  findings:Finding[];
  packages:PackageEvidence[];
  result?:ReviewResult;
};

export default function Report({ result, job }:{ result:ReviewResult; job?:ReportJob }) {
  const [selectedPackageKey, setSelectedPackageKey] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const findings = job?.findings || result.findings || [];
  const packages = result.packages || job?.packages || [];
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

  return <section className="review-shell" aria-live="polite">
    <header className="review-topbar">
      <div><p className="eyebrow">Dependency state <code>{result.dependencyStateId}</code></p><h1 className={`verdict-${result.verdict.toLowerCase()}`}>{result.verdict}</h1></div>
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
            <small>{label(pkg.packageManager || pkg.dependencyType)} · {label(pkg.scanStatus || "new")} · {label(pkg.evidenceSource || "fresh-scan")}</small>
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
            <span>{agent.icon}</span><div><strong>{agent.name}</strong><p>{job?.roleErrors?.[agent.name] || finding?.summary || (state === "running" ? "Running..." : "Queued")}</p>{finding?.evidence?.length ? <small>{finding.evidence.slice(0, 2).join(" · ")}</small> : null}</div><b>{finding?.verdict || state}</b>
          </article>;
        })}
        <div className="remediation"><span>Remediation</span><p>{result.remediation}</p></div>
        <Link href="/history">View history</Link>
      </aside>
    </section>
  </section>;
}

export function keyFor(pkg?:PackageEvidence) {
  return pkg ? `${pkg.name}@${pkg.version}` : "";
}

export function label(value:string) {
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
