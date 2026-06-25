"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./history.css";

type Finding = { role:string; summary:string; evidence:string[]; verdict:string; confidence:number };
type Review = {
  reviewId:string;
  createdAt:string;
  source:string;
  dependencyStateId:string;
  verdict:string;
  remediation:string;
  model:string;
  files:string[];
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
    <header className="history-header">
      <Link className="app-brand" href="/"><span className="app-mark" aria-hidden="true" />Locksmith</Link>
      <Link className="history-back" href="/review">New review</Link>
    </header>

    <section className="history-layout">
      <div className="history-list">
        <p className="eyebrow">Local-only history</p>
        <h1>Saved reviews.</h1>
        {error ? <p role="alert" className="history-error">{error}</p> : null}
        {!error && !reviews.length ? <p className="history-empty">No completed reviews saved on this machine yet.</p> : null}
        <ol>{reviews.map(review => <li key={review.reviewId}>
          <button className={selected?.reviewId === review.reviewId ? "selected" : ""} type="button" onClick={() => setSelected(review)}>
            <b>{review.verdict}</b>
            <span>{review.source}</span>
            <code>{review.dependencyStateId}</code>
            <small>{review.createdAt ? new Date(review.createdAt).toLocaleString() : "Saved review"}</small>
          </button>
        </li>)}</ol>
      </div>

      <article className="history-detail">
        {selected ? <>
          <div className={`history-verdict verdict-${selected.verdict.toLowerCase()}`}>{selected.verdict}</div>
          <dl>
            <div><dt>Source</dt><dd>{selected.source}</dd></div>
            <div><dt>Files</dt><dd>{selected.files.join(" · ")}</dd></div>
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
            <h2>Verdict</h2>
            <p>{selected.remediation}</p>
          </section>
        </> : <p className="history-empty">Select a review.</p>}
      </article>
    </section>
  </main>;
}
