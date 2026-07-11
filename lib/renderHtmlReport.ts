import type { Finding, ReviewResult } from "./locksmith.ts";

/**
 * Renders the already-sanitized review record saved by the CLI.  This module
 * deliberately has no React or browser dependency: the report must still be
 * readable after it leaves the Next.js application.
 */
export function renderHtmlReport(review: ReviewResult): string {
  const stored = review as ReviewResult & { projectIdentity?: string; decisionStatus?: string; reportPath?: string };
  const packages = review.packages || [];
  const counts = {
    allow: packages.filter(pkg => pkg.status === "Allow").length,
    review: packages.filter(pkg => pkg.status === "Review").length,
    block: packages.filter(pkg => pkg.status === "Block").length,
  };
  const title = `${verdictLabel(review.verdict)} — Locksmith report`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${STYLES}</style></head><body>
<main>
  <header class="masthead"><div><p class="eyebrow">LOCKSMITH / DEPENDENCY REVIEW</p><h1>${escapeHtml(verdictLabel(review.verdict))}</h1><p class="subtitle">Six-agent review for this exact dependency state.</p></div><span class="verdict ${className(review.verdict)}">${escapeHtml(verdictLabel(review.verdict))}</span></header>
  <section class="meta" aria-label="Review details">
    ${meta("Project", stored.projectIdentity || review.repoUrl || review.source)}
    ${meta("Dependency state", review.dependencyStateId)}
    ${meta("Policy", review.policy)}
    ${meta("Review ID", review.reviewId || "Not assigned")}
    ${meta("Created", formatDate(review.createdAt))}
    ${meta("Model", review.model)}
    ${meta("Files", review.files.join(", ") || "None")}
    ${stored.decisionStatus ? meta("Decision status", stored.decisionStatus) : ""}
  </section>
  <section class="judge"><div><p class="eyebrow">JUDGE VERDICT</p><h2>${escapeHtml(review.remediation || review.packageSummary)}</h2></div><div class="counts"><span><b>${counts.allow}</b> approved</span><span><b>${counts.review}</b> review</span><span><b>${counts.block}</b> blocked</span></div></section>
  <section><div class="section-heading"><p class="eyebrow">PACKAGE EVIDENCE</p><h2>Packages (${packages.length})</h2></div>
    <div class="packages">${packages.length ? packages.map(pkg => `<article class="package ${className(pkg.status)}"><div class="package-top"><h3>${escapeHtml(pkg.name)} <small>@${escapeHtml(pkg.version)}</small></h3><span class="status ${className(pkg.status)}">${escapeHtml(verdictLabel(pkg.status))}</span></div><p>${escapeHtml(pkg.reason || "No package summary retained.")}</p><dl><div><dt>Evidence status</dt><dd>${escapeHtml(scanStatusLabel(pkg.scanStatus))}</dd></div><div><dt>Source</dt><dd>${escapeHtml(pkg.evidenceSource || "retained review evidence")}</dd></div><div><dt>Signals</dt><dd>${pkg.suspiciousLines?.length || 0}</dd></div></dl>${evidenceList(pkg.evidence || [])}</article>`).join("") : "<p class=\"empty\">No production packages were found in the reviewed dependency files.</p>"}</div>
  </section>
  <section><div class="section-heading"><p class="eyebrow">SIX-AGENT PANEL</p><h2>Findings</h2></div><div class="findings">${review.findings.map(renderFinding).join("")}</div></section>
  <footer><span>Stored evidence is redacted and retained according to Locksmith policy.</span><span>${escapeHtml(review.dependencyStateId)}</span></footer>
</main></body></html>`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function renderFinding(finding: Finding): string {
  return `<article class="finding ${className(finding.verdict)}"><header><h3>${escapeHtml(finding.role)} Agent</h3><span class="status ${className(finding.verdict)}">${escapeHtml(verdictLabel(finding.verdict))}</span></header><p>${escapeHtml(finding.summary)}</p><p class="confidence">Evidence confidence: ${Math.round(finding.confidence * 100)}%</p>${evidenceList(finding.evidence)}</article>`;
}

function evidenceList(evidence: string[]) {
  return evidence.length ? `<ul>${evidence.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
}

function meta(label: string, value: unknown) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function verdictLabel(value: "Allow" | "Review" | "Block") {
  return value === "Allow" ? "Approved" : value === "Review" ? "Review Required" : "Block";
}

function scanStatusLabel(value: string | undefined) {
  return value === "new" ? "New evidence" : value === "changed" ? "Changed evidence" : value === "reused" ? "Reused evidence" : value === "unscanned" ? "Not fully inspected" : "Reviewed";
}

function className(value: string) { return value.toLowerCase().replace(/[^a-z0-9-]/g, "-"); }
function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

const STYLES = `
:root{color-scheme:light;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#17201e;background:#f4f1e9}*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:auto;padding:48px 28px}.masthead,.judge{display:flex;justify-content:space-between;gap:30px;border-bottom:2px solid #17201e;padding-bottom:28px}.eyebrow{letter-spacing:.13em;font-size:11px;font-weight:800;color:#5d6863;margin:0 0 10px}h1{font:800 clamp(42px,9vw,88px)/.9 Georgia,serif;margin:0;text-transform:uppercase}h2{font:700 28px/1.05 Georgia,serif;margin:0}.subtitle{color:#5d6863}.verdict,.status{align-self:flex-start;border:1px solid currentColor;padding:7px 10px;font-weight:800;font-size:12px;text-transform:uppercase}.allow{color:#19734d}.review{color:#9a6500}.block{color:#b53127}.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:1px;background:#d4d1c7;margin:26px 0}.meta div{background:#fbfaf5;padding:14px}.meta dt{font-size:10px;text-transform:uppercase;color:#5d6863;letter-spacing:.08em}.meta dd{margin:6px 0 0;word-break:break-word;font-size:13px}.judge{padding:24px 0;margin-bottom:42px;border-bottom:1px solid #c9c5bb}.judge h2{max-width:740px}.counts{display:flex;gap:18px;align-items:end;white-space:nowrap}.counts b{font-size:24px}.section-heading{margin:36px 0 15px}.packages,.findings{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}.package,.finding{border:1px solid #c9c5bb;background:#fbfaf5;padding:18px;border-left-width:5px}.package-top,.finding header{display:flex;justify-content:space-between;gap:12px}.package h3,.finding h3{margin:0;font-size:16px}.package small{font-weight:400;color:#5d6863}.package p,.finding p{font:14px/1.45 system-ui,sans-serif}.package dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-top:1px solid #dedbd3;padding-top:12px}.package dt,.confidence{font-size:11px;color:#5d6863}.package dd{margin:4px 0 0;font-size:12px}ul{padding-left:18px;margin:14px 0 0;font:12px/1.45 system-ui,sans-serif}li+li{margin-top:5px}.empty{color:#5d6863}footer{margin-top:48px;padding-top:15px;border-top:1px solid #c9c5bb;display:flex;justify-content:space-between;gap:16px;font-size:11px;color:#5d6863}@media(max-width:620px){main{padding:26px 18px}.masthead,.judge{display:block}.verdict{margin-top:18px}.counts{margin-top:20px}.package dl{grid-template-columns:1fr}.meta{grid-template-columns:1fr}footer{display:block}footer span+span{display:block;margin-top:8px}}
`;
