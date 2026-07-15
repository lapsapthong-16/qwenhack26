import Link from "next/link";
import "./docs.css";

const groups = [
  ["GET STARTED", [["introduction", "What is Locksmith?"], ["quickstart", "Quickstart"]]],
  ["USE LOCKSMITH", [["web-review", "Review a repository"], ["cli", "Use the CLI"], ["how-it-works", "How it works"]]],
  ["REFERENCE", [["dependency-states", "Dependency states"], ["agent-panel", "Agent panel"], ["verdicts", "Verdicts and policy"], ["workspace-trust", "Workspace trust"]]],
] as const;

function Code({ children }: { children: string }) {
  return (
    <pre className="docs-code"><code>{children}</code><button type="button" aria-label="Copy code">Copy</button></pre>
  );
}

export default function DocsPage() {
  return <main className="docs-page">
    <aside className="docs-sidebar" aria-label="Documentation navigation">
      <div className="docs-sidebar-title"><span className="docs-dot" />Locksmith docs</div>
      <p className="docs-version">DOCUMENTATION · V0.1</p>
      <nav>{groups.map(([group, items]) => <div className="docs-nav-group" key={group}><p>{group}</p>{items.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</div>)}</nav>
      <Link className="docs-sidebar-cta" href="/review">Open a review <span>↗</span></Link>
    </aside>
    <article className="docs-content">
      <div className="docs-breadcrumb"><Link href="/">Locksmith</Link><span>/</span><b>Docs</b></div>
      <header className="docs-intro" id="introduction"><p className="eyebrow">Get started</p><h1>Locksmith documentation</h1><p className="docs-lede">Review dependency changes before they enter your repository. These docs cover the web app, CLI, agent review, and workspace decisions.</p><div className="docs-meta"><span><i className="status-dot" />HACKATHON PREVIEW</span><span>Last updated Jul 15, 2026</span></div></header>

      <aside className="in-article"><strong>In this article</strong><a href="#introduction">What is Locksmith?</a><a href="#quickstart">Quickstart</a><a href="#web-review">Review a repository</a><a href="#how-it-works">How it works</a></aside>

      <section className="docs-section" id="introduction"><div><h2>What is Locksmith?</h2><p>Locksmith puts a dependency change on trial. It fingerprints the exact state entering your repo, asks six specialist agents to inspect it, and returns an actionable verdict: Allow, Review, or Block.</p><p>Reviews apply to a dependency state, not to a package forever. Your workspace approval is separate from reusable global package evidence.</p></div></section>
      <section className="docs-section" id="quickstart"><div><h2>Quickstart</h2><p>Use the web app for your first review. You only need a public GitHub repository with a supported dependency file.</p><ol className="steps"><li><b>Open Review</b><span>Go to <Link href="/review">Open a review</Link>.</span></li><li><b>Enter a repository</b><span>Paste a public GitHub URL and select the branch to inspect.</span></li><li><b>Start the review</b><span>Locksmith detects manifests and lockfiles, then starts the six-agent panel.</span></li><li><b>Read the verdict</b><span>Open each finding to see its evidence, disagreement, and recommended action.</span></li></ol></div></section>
      <section className="docs-section" id="web-review"><div><h2>Review a repository</h2><p>The repository review shows the dependency files Locksmith found, the state fingerprint, agent findings, and workspace status.</p><h3>Before you begin</h3><ul className="plain-list"><li>The repository must be publicly accessible on GitHub.</li><li>Supported inputs include <code>package.json</code>, <code>package-lock.json</code>, <code>pnpm-lock.yaml</code>, <code>yarn.lock</code>, <code>requirements.txt</code>, and <code>pyproject.toml</code>.</li><li>Private repository import and OAuth are planned for a later release.</li></ul></div></section>
      <section className="docs-section" id="cli"><div><h2>Use the CLI</h2><p>Guard a package install from your project directory:</p><Code>{"node bin/locksmith.mjs npm install colors@3.0.0"}</Code><p>Local history is explicitly local-only. A last team-reviewed baseline is comparison context; it never authorizes a changed dependency state.</p></div></section>
      <section className="docs-section" id="how-it-works"><div><h2>How it works</h2><ol className="steps process"><li><b>Fingerprint the state</b><span>Repo URL, commit, package manager, dependency files, and lockfile hashes become one stable state ID.</span></li><li><b>Gather evidence</b><span>Locksmith inspects metadata, source patterns, install behavior, and the dependency diff.</span></li><li><b>Challenge the findings</b><span>The Skeptic agent tests whether suspicious behavior could be legitimate for this package.</span></li><li><b>Resolve the decision</b><span>The Judge applies workspace policy and issues the final verdict with remediation.</span></li></ol></div></section>
      <section className="docs-section" id="dependency-states"><div><h2>Dependency states</h2><p>A state changes when the repo commit, package manager, dependency file, or lockfile hash changes. An approval for an older state does not automatically approve a new one.</p><div className="docs-callout"><strong>state_7f3a…</strong><span>repo + commit + package manager + file hashes</span><b>→</b><em>reviewed evidence</em></div></div></section>
      <section className="docs-section" id="agent-panel"><div><h2>The agent panel</h2><p>Six agents have distinct responsibilities. Findings stay visible so teams can see the evidence and disagreement behind the final result.</p><div className="agent-grid">{["Baseline · What changed?", "Manifest · Does it fit?", "Static · What can it do?", "Behavior · What does it do?", "Skeptic · Is this fair?", "Judge · What should we do?"].map((agent, i) => <div key={agent}><span>0{i + 1}</span><b>{agent.split(" · ")[0]}</b><small>{agent.split(" · ")[1]}</small></div>)}</div></div></section>
      <section className="docs-section" id="verdicts"><div><h2>Verdicts and policy</h2><p>The Judge combines evidence with your workspace policy.</p><div className="verdict-row"><span className="allow">ALLOW <small>clean or approved</small></span><span className="review">REVIEW <small>human confirmation</small></span><span className="block">BLOCK <small>critical evidence</small></span></div></div></section>
      <section className="docs-section docs-last" id="workspace-trust"><div><h2>Workspace decisions</h2><p>Global evidence is not team approval. An exact active workspace Allow may be reused only when repo, policy, dependency state, and lockfile hash match. A changed state shows the last team-reviewed baseline for comparison and requires a new review.</p><Code>{".locksmith/locksmith.json\n\n{\n  \"workspace\": \"acme\",\n  \"reviewId\": \"rev_123\",\n  \"dependencyStateId\": \"state_7f3a…\",\n  \"lockfileHash\": \"sha256:…\",\n  \"policy\": \"strict\",\n  \"verdict\": \"allow\"\n}"}</Code></div></section>
      <footer className="docs-footer"><span>LOCKSMITH / DOCS</span><Link href="/review">Start a review →</Link></footer>
    </article>
  </main>;
}
