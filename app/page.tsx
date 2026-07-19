import Image from "next/image";
import Link from "next/link";
import ScrollReveal from "./components/ScrollReveal";
import "./landing.css";

const workflow = [
  ["/assets/03_workflow_import_repo.png", "Import repo"],
  ["/assets/04_workflow_detect_files.png", "Detect dependency files"],
  ["/assets/05_workflow_fetch_artifacts.png", "Fetch artifacts"],
  ["/assets/06_workflow_run_agents.png", "Run agents"],
  ["/assets/07_workflow_save_review.png", "Save review"],
] as const;

const TerminalIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 8 4 4-4 4" /><path d="M12 17h6" /></svg>
);

const GithubIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.7c-5.1 0-9.3 4.1-9.3 9.2 0 4.1 2.7 7.6 6.4 8.8.5.1.6-.2.6-.5v-1.8c-2.6.6-3.1-1.1-3.1-1.1-.4-1-.9-1.3-.9-1.3-.8-.5.1-.5.1-.5.9.1 1.4.9 1.4.9.8 1.4 2.1 1 2.6.8.1-.6.3-1 .6-1.2-2.1-.2-4.3-1-4.3-4.6 0-1 .4-1.8.9-2.5-.1-.2-.4-1.2.1-2.5 0 0 .8-.2 2.6 1 .8-.2 1.6-.3 2.4-.3s1.6.1 2.4.3c1.8-1.2 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.5.6.7.9 1.5.9 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.8v2.4c0 .3.2.6.6.5 3.7-1.2 6.4-4.7 6.4-8.8 0-5.1-4.2-9.2-9.3-9.2Z" /></svg>
);

const UsersIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16 19v-1.5c0-1.7-1.8-3-4-3s-4 1.3-4 3V19" /><circle cx="12" cy="8" r="3" /><path d="M4 18v-1c0-1.2 1.1-2.2 2.6-2.7" /><path d="M20 18v-1c0-1.2-1.1-2.2-2.6-2.7" /><path d="M7 7.5a2.2 2.2 0 0 0 0 4" /><path d="M17 7.5a2.2 2.2 0 0 1 0 4" /></svg>
);

const ShieldIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 5.5 5.4v5.2c0 4.1 2.6 7.8 6.5 9.4 3.9-1.6 6.5-5.3 6.5-9.4V5.4L12 3Z" /></svg>
);

export default function Home() {
  return (
    <main className="home-page">
      <ScrollReveal />
      <section className="home-hero" aria-labelledby="hero-title">
        <Image
          className="hero-art"
          src="/assets/09_home_hero_art.png"
          width={1657}
          height={633}
          priority
          alt="Dependency lockfile under review with package risk blocks under a magnifying glass"
        />
        <div className="hero-copy">
          <h1 id="hero-title">Put dependency changes on trial.</h1>
          <p>Six Qwen agents review every risky package state.</p>
          <div className="hero-actions" aria-label="Primary actions">
            <Link className="button hero-primary" href="/review">Review a repo</Link>
            <Link className="text-link" href="#panel">See the panel</Link>
          </div>
        </div>
      </section>

      <section className="state-section" aria-labelledby="state-title">
        <p className="section-kicker">Dependency state</p>
        <h2 id="state-title">Reviews attach<br />to exact states<span>.</span></h2>
        <Image
          className="state-row"
          src="/assets/08_dependency_state_row.png"
          width={1427}
          height={336}
          alt="Dependency files connected to a fingerprint dependency state identifier"
        />
      </section>

      <section className="panel-section" id="panel" aria-labelledby="panel-title">
        <div className="panel-copy">
          <p className="panel-count">3 of 8</p>
          <h2 id="panel-title">Six reviewers.<br />One verdict<span>.</span></h2>
        </div>
        <Image
          className="panel-art"
          src="/assets/01_agent_panel.png"
          width={3456}
          height={2550}
          alt="Six specialist review agents routing evidence into a final review verdict"
        />
      </section>

      <section className="artifact-section" aria-labelledby="artifact-title">
        <Image
          className="artifact-art"
          src="/assets/11_product_review_stack.png"
          width={3078}
          height={2595}
          alt="Locksmith review dashboard cards for dependency evidence and verdicts"
        />
        <div className="artifact-copy">
          <h2 id="artifact-title">Inspect real<br />package artifacts.</h2>
          <p>npm tarballs, PyPI wheels, manifests, entrypoints.</p>
          <Link className="outline-link" href="/review">Open a review</Link>
        </div>
      </section>

      <section className="workflow-section" aria-labelledby="workflow-title">
        <h2 id="workflow-title">From repo to verdict in one review<span>.</span></h2>
        <div className="workflow-line" aria-hidden="true" />
        <div className="workflow-cards">
          {workflow.map(([src, label], index) => (
            <article className={`workflow-card workflow-card-${index + 1}`} key={label}>
              <Image src={src} width={700} height={650} alt="" />
              <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{label}</h3>
              {index === 1 ? <div className="file-pills"><span>package.json</span><span>pnpm-lock.yaml</span><span>requirements.txt</span></div> : null}
              {index === 3 ? <ul><li>Baseline Agent</li><li>Manifest Agent</li><li>Static Agent</li><li>Behavior Agent</li><li>Skeptic Agent</li><li>Judge Agent</li></ul> : null}
            </article>
          ))}
        </div>
        <Link className="workflow-cta text-link red" href="/review">Start with a public GitHub repo <span aria-hidden="true">→</span></Link>
      </section>

      <section className="evidence-section" aria-labelledby="evidence-title">
        <Image
          className="evidence-bg"
          src="/assets/10_evidence_full_hero.png"
          width={1672}
          height={941}
          alt="Evidence table with dependency package records"
        />
        <div className="evidence-copy">
          <h2 id="evidence-title">The skeptic keeps<br />blocks honest.</h2>
          <p>Findings must survive challenge before Judge acts.</p>
          <Link className="text-link red" href="/history">Read a resolved verdict <span aria-hidden="true">→</span></Link>
        </div>
        <div className="quote-stack">
          <article className="quote-static"><span>⚐</span><q>Static flags env access.</q><b>STATIC</b></article>
          <article className="quote-skeptic"><span>⌕</span><q>Skeptic asks package context.</q><b>SKEPTIC</b></article>
          <article className="quote-judge"><span>⚖</span><q>Judge resolves Review.</q><b>JUDGE</b></article>
        </div>
      </section>

      <section className="plans-section" aria-labelledby="plans-title">
        <div className="plans-copy">
          <h2 id="plans-title">Start local.<br />Add team trust<br />later.</h2>
          <p>Guard an npm install today. Add workspace approvals when the review needs to be shared.</p>
          <div className="plans-actions">
            <Link className="button" href="/terminal"><TerminalIcon />Guard an install</Link>
            <Link className="outline-link" href="/review"><GithubIcon />Import GitHub</Link>
          </div>
        </div>
        <div className="use-card local">
          <div className="card-head"><span className="mini-icon"><TerminalIcon /></span><b>Local Demo</b><em>Included</em></div>
          <p>Review before npm writes a dependency.</p>
          <div className="terminal-box"><code>locksmith npm install colors@3.0.0</code><strong>Install blocked</strong><span>Review report saved</span></div>
        </div>
        <div className="use-card team">
          <div className="card-head"><span className="mini-icon"><UsersIcon /></span><b>Team Review</b><em>Team</em></div>
          <p>Share results with workspace approvals.</p>
          <div className="trust-box"><b>.locksmith/locksmith.json</b><code>{`{
  "state": "state_456",
  "verdict": "allow"
}`}</code><span>Approved by workspace</span></div>
        </div>
        <div className="use-card ci">
          <div className="card-head"><span className="mini-icon"><ShieldIcon /></span><b>CI Gate</b><em>Future</em></div>
          <p>Enforce trust in CI before merge.</p>
          <div className="pr-box"><b>Pull request #42 <span>Open</span></b><p>Locksmith scan</p><strong>Passed</strong><small>30s</small></div>
        </div>
      </section>

      <section className="final-section" aria-labelledby="final-title">
        <span className="center-rule" aria-hidden="true" />
        <div className="final-copy">
          <Image src="/assets/12_locksmith_logo.png" width={84} height={84} alt="" />
          <h2 id="final-title">Review the lockfile<br />before merge.</h2>
          <p>Import a public repo or guard your next npm install.</p>
          <div className="hero-actions">
            <Link className="button hero-primary" href="/review">Start a review</Link>
            <Link className="text-link" href="/terminal">Run the CLI</Link>
          </div>
        </div>
        <Image
          className="dossier-art"
          src="/assets/13_lockfile_evidence_dossier.png"
          width={1774}
          height={887}
          alt="Evidence dossier for a reviewed lockfile"
        />
      </section>
    </main>
  );
}
