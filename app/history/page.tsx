"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Report, { type Finding, type PackageEvidence, type ReviewResult } from "../components/Report";
import "../review/review.css";
import "./history.css";

type Review = ReviewResult & {
  reviewId:string;
  createdAt:string;
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
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "History failed"));
  }, []);

  if (selected) return <main className="history-page">
    <button className="history-back" type="button" onClick={() => setSelected(null)}>Back to history</button>
    <Report result={selected} job={{
      status: "complete",
      completedRoles: selected.findings.map((finding:Finding) => finding.role),
      roleStatus: Object.fromEntries(selected.findings.map((finding:Finding) => [finding.role, "done"])),
      findings: selected.findings,
      packages: selected.packages as PackageEvidence[],
      result: selected,
    }} />
  </main>;

  return <main className="history-page">
    <section className="history-layout history-list-only">
      <div className="history-list">
        <p className="eyebrow">Local-only history</p>
        <div className="history-head">
          <h1>Review ledger.</h1>
          <p>Completed scans saved by this demo app. These are local records, not workspace approvals.</p>
        </div>
        {error ? <div role="alert" className="history-state history-error"><b>History could not load.</b><p>{error}</p><Link className="button secondary" href="/review">Start a new review</Link></div> : null}
        {!error && !reviews.length ? <div className="history-state history-empty"><b>No completed reviews saved here yet.</b><p>Run a web review first. Approved or blocked results will appear here for this browser session.</p><Link className="button secondary" href="/review">Start first review</Link></div> : null}
        <ol>{reviews.map((review, index) => {
          const verdictClass = `verdict-${review.verdict.toLowerCase()}`;
          return <li key={review.reviewId}>
          <button type="button" onClick={() => setSelected(review)}>
            <span className="review-run">Run #{reviews.length - index}</span>
            <b className={verdictClass}>{review.verdict}</b>
            <span className="review-source">{review.source}</span>
            <code>{review.dependencyStateId}</code>
            <small>{review.packageSummary}</small>
            <time dateTime={review.createdAt}>{review.createdAt ? new Date(review.createdAt).toLocaleString() : "Saved review"}</time>
          </button>
        </li>;
        })}</ol>
      </div>
    </section>
  </main>;
}
