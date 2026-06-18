import Link from "next/link";
import "./landing.css";

const agents = [
  ["01", "Baseline", "Establish trust in the current state."],
  ["02", "Manifest", "Parse changes in declared dependencies."],
  ["03", "Static", "Analyze packages for known risks and metadata."],
  ["04", "Behavior", "Evaluate observed behavior and runtime signals."],
  ["05", "Skeptic", "Challenge assumptions. Probe for gaps and contradictions."],
  ["06", "Judge", "Synthesize findings and decide the verdict."],
] as const;

export default function Home() {
  return (
    <main className="home-page">
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Dependency review&nbsp; / &nbsp;six-agent consensus</p>
          <h1 id="hero-title">Know what changed.<br />Decide what ships.</h1>
          <p>Locksmith turns a lockfile diff into evidence your team can approve.</p>
        </div>

        <form className="hero-command" action="/review" method="get">
          <span aria-hidden="true">&gt;_</span>
          <label className="sr-only" htmlFor="repo">GitHub repository</label>
          <input id="repo" name="repo" type="url" defaultValue="https://github.com/northstar/storefront" required />
          <button aria-label="Scan repository" type="submit">›</button>
        </form>

        <div className="agent-flow" aria-label="Six agent review flow">
          {agents.map(([number, name, description], index) => (
            <article className={name === "Behavior" || name === "Skeptic" ? "disputed" : ""} key={name}>
              <span className="agent-index">{number}</span>
              <h2>{name}</h2>
              <p>{description}</p>
              {index < agents.length - 1 ? <span className={`flow-arrow ${name === "Behavior" ? "reverse" : ""}`} aria-hidden="true">→</span> : null}
            </article>
          ))}
          <aside className="hero-verdict" aria-label="Possible review verdict">
            <span>Review</span><strong>✓</strong><b>REVIEW</b><p>Approve or block.<br />Ship with confidence.</p>
          </aside>
        </div>
      </section>

      <section className="landing-detail" id="product">
        <div><p className="eyebrow">State-aware review</p><h2>Evidence for this repo.<br />Not a forever score.</h2></div>
        <p>Public package facts are reusable. Approval remains private to your workspace and expires when the lockfile, policy, or evidence changes.</p>
      </section>

      <section className="landing-cta">
        <h2>Review the next change.</h2>
        <Link className="button" href="/review">Scan repository <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
