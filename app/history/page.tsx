"use client";

import { useEffect, useState } from "react";
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
        <h1>Saved reviews.</h1>
        {error ? <p role="alert" className="history-error">{error}</p> : null}
        {!error && !reviews.length ? <p className="history-empty">No completed reviews saved on this machine yet.</p> : null}
        <ol>{reviews.map((review, index) => <li key={review.reviewId}>
          <button type="button" onClick={() => setSelected(review)}>
            <b>{review.verdict}</b>
            <em>Run #{reviews.length - index}</em>
            <span>{review.source}</span>
            <code>{review.dependencyStateId}</code>
            <small>{review.packageSummary}</small>
            <time dateTime={review.createdAt}>{review.createdAt ? new Date(review.createdAt).toLocaleString() : "Saved review"}</time>
          </button>
        </li>)}</ol>
      </div>
    </section>
  </main>;
}
