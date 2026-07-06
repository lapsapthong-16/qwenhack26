"use client";

import { useEffect, useState } from "react";
import "./history.css";

type Finding = { role:string; summary:string; evidence:string[]; verdict:string; confidence:number };
type PackageEvidence = { name:string; version:string; dependencyType:string; fileCount:number; files:string[]; inspectedFiles:{path:string;reason:string;content:string}[]; status:string; reason:string; evidence?:string[] };
type Review = {
  reviewId:string;
  createdAt:string;
  source:string;
  dependencyStateId:string;
  verdict:string;
  remediation:string;
  model:string;
  files:string[];
  packages:PackageEvidence[];
  packageCount:number;
  inspectedPackageCount:number;
  packageSummary:string;
  findings:Finding[];
};

export default function HistoryPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<Review|null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/history", { cache:"no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "History failed");
        setReviews(data.reviews || []);
        setSelected(data.reviews?.[0] || null);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "History failed"));
  }, []);

  return <main className="history-page">
    <section className="history-layout">
      <div className="history-list">
        <p className="eyebrow">Local-only history</p>
        <h1>Saved reviews.</h1>
        {error ? <p role="alert" className="history-error">{error}</p> : null}
        {!error && !reviews.length ? <p className="history-empty">No completed reviews saved on this machine yet.</p> : null}
        <ol>{reviews.map((review, index) => <li key={review.reviewId}>
          <button className={selected?.reviewId === review.reviewId ? "selected" : ""} type="button" onClick={() => setSelected(review)}>
            <b>{review.verdict}</b>
            <em>Run #{reviews.length - index}</em>
            <span>{review.source}</span>
            <code>{review.dependencyStateId}</code>
            <small>{review.packageSummary}</small>
            <time dateTime={review.createdAt}>{review.createdAt ? new Date(review.createdAt).toLocaleString() : "Saved review"}</time>
          </button>
        </li>)}</ol>
      </div>

      <article className="history-detail">
        {selected ? <>
          <div className={`history-verdict verdict-${selected.verdict.toLowerCase()}`}>{selected.verdict}</div>
          <dl>
            <div><dt>Run time</dt><dd><time dateTime={selected.createdAt}>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "Saved review"}</time></dd></div>
            <div><dt>Source</dt><dd>{selected.source}</dd></div>
            <div><dt>Files</dt><dd>{selected.files.join(" · ")}</dd></div>
            <div><dt>Packages</dt><dd>{selected.packageSummary || `${selected.packageCount || 0} packages reviewed`}</dd></div>
            <div><dt>Model</dt><dd>{selected.model}</dd></div>
            <div><dt>State</dt><dd><code>{selected.dependencyStateId}</code></dd></div>
          </dl>
          <section>
            <h2>Agent findings</h2>
            <ol>{selected.findings.map(finding => <li key={finding.role}>
              <strong>{finding.role}</strong><b>{finding.verdict}</b>
              <p>{finding.summary}</p>
              <small>{finding.evidence.join(" · ")}</small>
            </li>)}</ol>
          </section>
          <section>
            <h2>Package evidence</h2>
            {selected.packages?.length ? <ol>{selected.packages.map(pkg => <li className={`history-package status-${pkg.status.toLowerCase()}`} key={`${pkg.name}@${pkg.version}`}>
              <strong>{pkg.name}</strong><b>{pkg.status}</b>
              <p>{pkg.reason}</p>
              <small>{pkg.inspectedFiles.map(file => `${file.path}: ${file.content || file.reason}`).join(" · ") || pkg.evidence?.join(" · ")}</small>
            </li>)}</ol> : <p className="safe-summary">{selected.packageSummary || "All reviewed packages were allowed. No flagged package evidence was saved locally."}</p>}
          </section>
          <section>
            <h2>Verdict</h2>
            <p>{selected.remediation}</p>
          </section>
        </> : <p className="history-empty">Select a review.</p>}
      </article>
    </section>
  </main>;
}
