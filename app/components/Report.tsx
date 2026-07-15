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
export type Finding = { role:string; summary:string; evidence:string[]; verdict:Verdict; confidence:number; packageName?:string };
export type RoleStatus = "queued"|"running"|"done"|"failed";
export type SuspiciousLine = { filePath:string; startLine:number; endLine?:number; severity:"low"|"medium"|"high"|"critical"; sourceAgent:string; reviewedBy?:string; reason:string; rule?:string };
export type PackageFile = { path:string; reason:string; content:string; contentTruncated?:boolean; displayedBytes?:number; originalBytes?:number };
export type PackageEvidence = { name:string; version:string; packageManager?:"npm"|"pypi"; dependencyType:string; scanStatus?:"new"|"reused"|"changed"|"unscanned"; previousReviewId?:string; evidenceId?:string; evidenceSource?:"global-cache"|"workspace-cache"|"fresh-scan"|"none"; artifactKey?:string; fileCount:number; files:string[]; inspectedFiles:PackageFile[]; suspiciousLines?:SuspiciousLine[]; status:Verdict; reason:string; evidence?:string[]; retention?:string };
export type ReviewResult = { reviewId:string; dependencyStateId:string; source:string; files:string[]; packages:PackageEvidence[]; packageCount:number; inspectedPackageCount:number; packageSummary:string; findings:Finding[]; verdict:Verdict; remediation:string; mode:string; model:string; branch?:string; createdAt?:string; packageManager?:string };
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

const packageAgents = ["Manifest", "Static", "Behavior", "Skeptic"];

export default function Report({ result, job }:{ result:ReviewResult; job?:ReportJob }) {
  const [selectedPackageKey, setSelectedPackageKey] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [query, setQuery] = useState("");
  const findings = job?.findings || result.findings || [];
  const packages = result.packages || job?.packages || [];
  const completed = new Set(job?.completedRoles || findings.map(finding => finding.role));
  const selectedPackage = packages.find(pkg => keyFor(pkg) === selectedPackageKey) || packages[0];
  const selectedFile = selectedPackage?.inspectedFiles.find(file => file.path === selectedFilePath);
  const visiblePackages = packages.filter(pkg => keyFor(pkg).toLowerCase().includes(query.toLowerCase()));
  const packageFindings = selectedPackage ? packageAgents.map(role => findings.find(item => item.role === role && findingMatchesPackage(item, selectedPackage))).filter(Boolean) as Finding[] : [];
  const baseline = findings.find(item => item.role === "Baseline");
  const judge = findings.find(item => item.role === "Judge");
  const counts = {
    attention: packages.filter(pkg => pkg.status !== "Allow").length,
    added: packages.filter(pkg => pkg.scanStatus === "new").length,
    updated: packages.filter(pkg => pkg.scanStatus === "changed").length,
    approved: packages.filter(pkg => pkg.status === "Allow").length,
    review: packages.filter(pkg => pkg.status === "Review").length,
    block: packages.filter(pkg => pkg.status === "Block").length,
  };

  useEffect(() => {
    if (!packages.length) return;
    if (!selectedPackage || !packages.some(pkg => keyFor(pkg) === selectedPackageKey)) setSelectedPackageKey(keyFor(packages[0]));
  }, [packages, selectedPackage, selectedPackageKey]);

  useEffect(() => {
    if (!selectedPackage) return;
    const suspiciousFile = selectedPackage.suspiciousLines?.[0]?.filePath;
    const fallback = suspiciousFile || selectedPackage.inspectedFiles[0]?.path || "";
    if (!selectedFilePath || !selectedPackage.inspectedFiles.some(file => file.path === selectedFilePath)) setSelectedFilePath(fallback);
  }, [selectedPackage, selectedFile, selectedFilePath]);

  return <section className="review-shell" aria-live="polite">
    <header className="report-header">
      <h1><Link className="report-back" href="/history" aria-label="Back to history" title="Back to history">←</Link><span className="report-title">Report</span></h1>
      <div className="report-meta-table">
        <Meta label="Repository" value={shortSource(result.source)} />
        <Meta label="Branch" value={result.branch || "main"} />
        <Meta label="Dependency State ID" value={result.dependencyStateId} />
        <Meta label="Review ID" value={result.reviewId} />
        <Meta label="Package Manager" value={result.packageManager || packages[0]?.packageManager || "npm"} />
        <Meta label="Files Used" value={result.files.join(", ") || "unknown"} wide />
        <Meta label="Reviewed At" value={formatDate(result.createdAt)} />
      </div>
    </header>

    <section className="workspace-trust" aria-label="Workspace decision">
      <div className="workspace-trust-heading">
        <span className="workspace-kicker">YOUR WORKSPACE</span>
        <h2>No decision yet</h2>
        <p>Global evidence informs this review. Your team still decides whether this exact dependency state is trusted.</p>
      </div>
      <dl className="workspace-trust-facts">
        <div><dt>State</dt><dd>{result.dependencyStateId}</dd></div>
        <div><dt>Policy</dt><dd>Strict</dd></div>
        <div><dt>Validity</dt><dd>Not approved</dd></div>
        <div><dt>Next step</dt><dd>Human review required</dd></div>
      </dl>
    </section>

    <section className="repo-agents">
      <RepoAgent role="Baseline" finding={baseline} state={roleState("Baseline", job, completed, baseline)} result={result} counts={counts} />
      <RepoAgent role="Judge" finding={judge} state={roleState("Judge", job, completed, judge)} result={result} />
    </section>

    <section className="report-workbench">
      <aside className="package-list" id="packages" aria-label="Packages">
        <div className="package-list-head"><h2>Packages <span>({result.packageCount || packages.length})</span></h2><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search packages" aria-label="Search packages" /></div>
        <div className="package-filters">
          <Badge label="Needs attention" count={counts.attention} tone="review" />
          <Badge label="Added" count={counts.added} tone="block" />
          <Badge label="Updated" count={counts.updated} tone="review" />
          <Badge label="Global Allow" count={counts.approved} tone="allow" />
          <Badge label="Review Required" count={counts.review} tone="review" />
          <Badge label="Block" count={counts.block} tone="block" />
        </div>
        {visiblePackages.map(pkg => {
          const active = keyFor(pkg) === keyFor(selectedPackage);
          const suspicious = pkg.suspiciousLines?.length || 0;
          return <button className={`package-row status-${pkg.status.toLowerCase()} ${active ? "selected" : ""}`} aria-pressed={active} key={keyFor(pkg)} onClick={() => { setSelectedPackageKey(keyFor(pkg)); setSelectedFilePath(pkg.suspiciousLines?.[0]?.filePath || pkg.inspectedFiles[0]?.path || ""); }}>
            <b>{pkg.scanStatus === "unscanned" ? "Skipped" : uiVerdict(pkg.status)}</b>
            <span><strong>{pkg.name}</strong><code>{versionText(pkg)}</code></span>
            <small>{pkg.status === "Allow" ? "Global analysis: no blocking signal · summary only" : pkg.reason}</small>
            <em>{suspicious ? `${suspicious} findings` : "0 findings"}</em>
          </button>;
        })}
        <footer className="package-pager"><span>Showing 1-{visiblePackages.length} of {result.packageCount || packages.length} packages</span></footer>
      </aside>

      <section className="package-inspection" aria-label="Package inspection">
        {selectedPackage ? <>
          <header>
            <div><h2><RegistryLogo packageManager={registryFor(selectedPackage, result)} />{selectedPackage.name}@{selectedPackage.version}</h2><p><strong>Reason</strong><br />{selectedPackage.reason}</p></div>
            <span className={`verdict-pill verdict-${selectedPackage.status.toLowerCase()}`}>{uiVerdict(selectedPackage.status)}</span>
          </header>
          <GlobalAnalysis pkg={selectedPackage} />
          {selectedPackage.status === "Allow" ? <div className="safe-summary">{selectedPackage.fileCount} files checked · 0 suspicious · summary only. Greenlit file contents are not retained in saved history.</div> : <FileEvidence pkg={selectedPackage} selectedFile={selectedFile} setSelectedFilePath={setSelectedFilePath} />}
        </> : <p>No packages found.</p>}
      </section>

      <aside className="agent-panel" id="package-agents" aria-label="Package agent findings">
        <h2>Agent Findings <span>(for {selectedPackage?.name || "package"})</span></h2>
        {packageAgents.map(role => {
          const finding = packageFindings.find(item => item.role === role);
          const state = roleState(role, job, completed, finding);
          return <AgentFinding role={role} finding={finding} state={state} pkg={selectedPackage} key={role} />;
        })}
        {selectedPackage ? <div className={`package-verdict status-${selectedPackage.status.toLowerCase()}`}><strong>Package Verdict<br /><span>{uiVerdict(selectedPackage.status)}</span></strong><p>{selectedPackage.status === "Block" ? "Critical concerns remain. Risk: High." : selectedPackage.reason}</p></div> : null}
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

function Meta({ label, value, wide }:{ label:string; value:string; wide?:boolean }) {
  return <div className={wide ? "meta-item wide" : "meta-item"}><span>{label}</span><strong>{value}</strong></div>;
}

function registryFor(pkg:PackageEvidence, result:ReviewResult): "npm" | "pypi" {
  const packageManager = `${pkg.packageManager || ""} ${result.packageManager || ""}`.toLowerCase();
  return packageManager.includes("pypi") || packageManager.includes("python") ? "pypi" : "npm";
}

function RegistryLogo({ packageManager }:{ packageManager:"npm" | "pypi" }) {
  return <img className="registry-logo" src={`/assets/${packageManager}-logo.png`} alt={`${packageManager === "pypi" ? "PyPI" : "npm"} package`} />;
}

function Badge({ label, count, tone }:{ label:string; count:number; tone:"allow"|"review"|"block" }) {
  return <span className={`filter-badge tone-${tone}`}>{label}<b>{count}</b></span>;
}

function RepoAgent({ role, finding, state, result, counts }:{ role:"Baseline"|"Judge"; finding?:Finding; state:RoleStatus; result:ReviewResult; counts?:Record<string,number> }) {
  const isJudge = role === "Judge";
  return <article className={`repo-agent agent-${state} ${isJudge ? "judge-card" : ""}`}>
    <header><div><span>{isJudge ? "⚖" : "▱"}</span><strong>{role} Agent</strong><p>{isJudge ? "Evaluated all package findings and agent analyses for this repository." : "Analyzed dependency changes in this commit."}</p></div><b className={isJudge ? `verdict-pill verdict-${result.verdict.toLowerCase()}` : ""}>{isJudge ? uiVerdict(result.verdict) : statusText(state)}</b></header>
    {isJudge ? <><div className="judge-grid"><div><span>Result</span><strong className={`verdict-${result.verdict.toLowerCase()}`}>{uiVerdict(result.verdict)}</strong></div><div><span>Reasoning</span><p>{finding?.summary || result.packageSummary}</p></div><div><span>Remediation</span><p>{result.remediation}</p></div></div><a href="#package-agents">View full rationale ›</a></>
      : <><div className="baseline-grid"><Metric label="Changed Files" value={result.files.length} note={result.files.join(", ")} /><Metric label="Added" value={counts?.added || 0} note="new packages" /><Metric label="Updated" value={counts?.updated || 0} note="changed versions" /><Metric label="Reused" value={counts?.approved || 0} note="summary only" /></div><a href="#packages">View baseline details ›</a></>}
  </article>;
}

function Metric({ label, value, note }:{ label:string; value:number; note:string }) {
  return <div><span>{label}</span><strong>{value}</strong><p>{note}</p></div>;
}

function GlobalAnalysis({ pkg }:{ pkg:PackageEvidence }) {
  const suspiciousUrl = pkg.suspiciousLines?.find(line => /url|fetch|http|network/i.test(`${line.rule} ${line.reason}`));
  return <section className="global-analysis">
    <h3>Global Analysis <span>(retrieved from public/package sources)</span></h3>
    <div>
      <Fact title="Registry" body={`${pkg.packageManager || "npm"} package`} foot={pkg.evidenceId || pkg.artifactKey || "fresh evidence"} />
      <Fact title="Lifecycle Script" body={pkg.suspiciousLines?.some(line => /install|postinstall/i.test(line.filePath)) ? "postinstall" : "not detected"} foot={pkg.scanStatus ? label(pkg.scanStatus) : "scanned"} />
      <Fact title="Suspicious Signal" body={suspiciousUrl?.rule || pkg.reason} foot={suspiciousUrl ? "High risk evidence" : "No critical public signal"} />
      <Fact title="Public Evidence" body={`${pkg.suspiciousLines?.length || 0} suspicious ranges`} foot={pkg.retention || (pkg.status === "Allow" ? "summary-only" : "redacted-line-window")} />
    </div>
  </section>;
}

function Fact({ title, body, foot }:{ title:string; body:string; foot:string }) {
  return <article><strong>{title}</strong><p>{body}</p><span>{foot}</span></article>;
}

function FileEvidence({ pkg, selectedFile, setSelectedFilePath }:{ pkg:PackageEvidence; selectedFile?:PackageFile; setSelectedFilePath:(path:string)=>void }) {
  const suspiciousPaths = new Set(pkg.suspiciousLines?.map(line => line.filePath) || []);
  const ordered = [...pkg.files].sort((a,b) => Number(suspiciousPaths.has(b)) - Number(suspiciousPaths.has(a)));
  return <div className="file-layout">
    <nav className="file-list" aria-label="Package files">
      <h3>Package Files</h3>
      {ordered.map(path => {
        const inspected = pkg.inspectedFiles.some(file => file.path === path);
        const count = pkg.suspiciousLines?.filter(line => line.filePath === path).length || 0;
        return <button className={`${path === selectedFile?.path ? "selected" : ""} ${count ? "file-suspicious" : ""}`} key={path} onClick={() => setSelectedFilePath(path)} disabled={!inspected}>
          <span>{path.replace(/^package\//, "")}</span><em>{count ? "Suspicious" : inspected ? "Safe" : "Code unavailable"}</em>
        </button>;
      })}
      <span className="show-files">Showing inspected files ({pkg.inspectedFiles.length} of {pkg.fileCount})</span>
    </nav>
    <CodeViewer file={selectedFile} findings={pkg.suspiciousLines || []} />
  </div>;
}

function AgentFinding({ role, finding, state, pkg }:{ role:string; finding?:Finding; state:RoleStatus; pkg?:PackageEvidence }) {
  const keyEvidence = finding?.evidence?.[0] || pkg?.suspiciousLines?.find(line => line.sourceAgent === role)?.filePath || "Waiting for evidence";
  const safeFallback = !finding && pkg?.status === "Allow" && state === "done";
  return <article className={`agent-finding agent-${state}`}>
    <header><strong>{role} Agent</strong><b className={finding || safeFallback ? `verdict-pill verdict-${(finding?.verdict || "Allow").toLowerCase()}` : ""}>{finding ? uiVerdict(finding.verdict) : safeFallback ? "Approved" : statusText(state)}</b></header>
    <p>{finding?.summary || (safeFallback ? "No package-specific concern in global analysis; workspace approval is still pending." : state === "running" ? "Running package review..." : state === "failed" ? "Agent failed" : "Queued")}</p>
    <dl><div><dt>Evidence</dt><dd>{finding?.evidence?.length || 0}</dd></div><div><dt>Key Evidence</dt><dd>{safeFallback ? "summary-only" : keyEvidence}</dd></div></dl>
  </article>;
}

function findingMatchesPackage(finding:Finding, pkg:PackageEvidence) {
  if (finding.packageName) return finding.packageName === pkg.name || finding.packageName === keyFor(pkg);
  const haystack = `${finding.summary} ${finding.evidence.join(" ")}`.toLowerCase();
  return haystack.includes(pkg.name.toLowerCase()) || (pkg.suspiciousLines || []).some(line => finding.evidence.some(item => item.includes(line.filePath)));
}

function roleState(role:string, job:ReportJob|undefined, completed:Set<string>, finding?:Finding): RoleStatus {
  return job?.roleStatus?.[role] || (finding ? "done" : job?.currentRoles?.includes(role) || job?.currentRole === role ? "running" : completed.has(role) ? "done" : "queued");
}

function uiVerdict(verdict:Verdict) {
  return verdict === "Allow" ? "Approved" : verdict === "Review" ? "Review Required" : "Block";
}

function statusText(state:RoleStatus) {
  return state === "done" ? "Completed" : state;
}

function shortSource(source:string) {
  return source.replace(/^https:\/\/github.com\//, "").replace(/^fixture:\/\//, "");
}

function formatDate(value?:string) {
  return value ? new Date(value).toLocaleString(undefined, { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" }) : "Live review";
}

function versionText(pkg:PackageEvidence) {
  return pkg.scanStatus === "changed" && !pkg.version.includes("→") ? `→ ${pkg.version}` : pkg.version;
}

function CodeViewer({ file, findings }:{ file?:PackageFile; findings:SuspiciousLine[] }) {
  if (!file) return <div className="code-empty">Select an inspected file.</div>;
  const byLine = new Map<number,SuspiciousLine[]>();
  const findingIndex = new Map<SuspiciousLine,number>();
  const fileFindings = findings.filter(item => item.filePath === file.path);
  fileFindings.forEach((finding, index) => findingIndex.set(finding, index + 1));
  for (const finding of findings.filter(item => item.filePath === file.path)) {
    for (let line = finding.startLine; line <= (finding.endLine || finding.startLine); line++) byLine.set(line, [...(byLine.get(line) || []), finding]);
  }
  const rows = file.content.split(/\r?\n/).map((raw, index) => {
    const match = raw.match(/^(\s*)(\d+):\s?(.*)$/);
    return { displayLine: index + 1, sourceLine: match ? Number(match[2]) : index + 1, text: match ? `${match[1]}${match[3]}` : raw };
  });
  return <div className="code-pane">
    <div className="code-meta"><strong>{file.path.replace(/^package\//, "")}</strong>{fileFindings.length ? <em>View suspicious code</em> : null}<button type="button">Raw</button>{file.contentTruncated ? <span>Truncated evidence</span> : <span>{file.reason}</span>}</div>
    <pre>{rows.map(row => {
      const hits = byLine.get(row.sourceLine) || [];
      return <code className={hits.length ? "code-line suspicious" : "code-line"} key={`${row.sourceLine}:${row.displayLine}`}>
        <span className="code-hit">{hits.map(hit => <b key={`${hit.startLine}:${hit.rule}`}>{findingIndex.get(hit)}</b>)}</span>
        <span className="code-number">{row.sourceLine}</span>
        <mark title={hits.map(hit => hit.reason).join(" ")}>{row.text || " "}</mark>
      </code>;
    })}</pre>
    {fileFindings.length ? <ul className="line-reasons">{fileFindings.map((item, index) => <li key={`${item.filePath}:${item.startLine}:${item.rule}`}><b>{index + 1}</b> <span>{item.startLine}{item.endLine ? `-${item.endLine}` : ""}</span> {item.reason}</li>)}</ul> : null}
  </div>;
}
