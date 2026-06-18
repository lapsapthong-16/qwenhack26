import Link from "next/link";
import "./landing.css";

const agents = [
  ["01", "Baseline", "Finds exactly what changed since the last approved dependency state."],
  ["02", "Manifest", "Checks lifecycle scripts, release timing, and publisher signals."],
  ["03", "Static", "Traces obfuscation, environment access, network calls, and child processes."],
  ["04", "Behavior", "Observes what the package actually does in a controlled install."],
  ["05", "Skeptic", "Challenges weak evidence and plausible false positives."],
  ["06", "Judge", "Resolves the record under policy: allow, review, or block."],
] as const;

export default function Home() {
  return (
    <main>
      <section className="landing-hero wrap" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Dependency review / before install</p>
          <h1 id="hero-title">Put every dependency change on trial.</h1>
          <p className="hero-summary">
            Six specialist agents examine what changed, test the evidence, and issue a repo-specific verdict before a package enters your lockfile.
          </p>
        </div>

        <form className="repo-import card" action="/review" method="get">
          <div className="import-heading">
            <span className="eyebrow">Start a public review</span>
            <span className="import-status"><i aria-hidden="true" /> No sign-in required</span>
          </div>
          <label htmlFor="repo">GitHub repository</label>
          <div className="import-row">
            <input
              id="repo"
              name="repo"
              type="url"
              inputMode="url"
              placeholder="https://github.com/owner/repository"
              defaultValue="https://github.com/acme/storefront"
              required
              pattern="https://github\.com/.+/.+"
              aria-describedby="repo-note"
            />
            <button className="button" type="submit">Review state <span aria-hidden="true">↗</span></button>
          </div>
          <p id="repo-note">Locksmith reads public dependency files only. Results are informational until your workspace approves them.</p>
        </form>

        <div className="hero-footnote mono" aria-label="Supported dependency formats">
          <span>npm / pip</span>
          <span>package-lock.json / requirements.txt</span>
          <span>State-aware, not reputation-only</span>
        </div>
      </section>

      <section className="trial-section" id="agents" aria-labelledby="agents-title">
        <div className="wrap">
          <div className="section-intro">
            <div>
              <p className="eyebrow">The review panel</p>
              <h2 id="agents-title">One record.<br />Six points of view.</h2>
            </div>
            <p>
              This is not six models repeating the same scan. Each agent owns a distinct question; the Skeptic disputes the case before the Judge can rule.
            </p>
          </div>

          <ol className="agent-list">
            {agents.map(([number, name, description]) => (
              <li key={name}>
                <span className="agent-number mono">{number}</span>
                <h3>{name} Agent</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="continuity wrap" aria-labelledby="continuity-title">
        <div className="continuity-copy">
          <p className="eyebrow">One dependency state</p>
          <h2 id="continuity-title">The same decision, wherever you work.</h2>
          <p>Web and terminal resolve the same commit and lockfile to the same state ID. Public evidence can travel; workspace approval cannot.</p>
          <div className="continuity-actions">
            <Link className="button" href="/review">Open web review</Link>
            <Link className="button secondary" href="/terminal">See terminal flow</Link>
          </div>
        </div>

        <div className="state-ledger" aria-label="Dependency state decision flow">
          <div className="ledger-row"><span>01 / INPUT</span><strong>repo + commit + lockfile</strong></div>
          <div className="ledger-row"><span>02 / STATE</span><strong>state_7F2A91</strong></div>
          <div className="ledger-row"><span>03 / EVIDENCE</span><strong>6-agent review</strong></div>
          <div className="ledger-row verdict"><span>04 / DECISION</span><strong>REVIEW REQUIRED</strong></div>
        </div>
      </section>
    </main>
  );
}
