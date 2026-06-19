import Link from "next/link";
import "./how-to.css";

const webSteps = [
  ["01", "Import repository", "Paste a public GitHub URL. Locksmith reads dependency files and computes the dependency state."],
  ["02", "Review agent evidence", "Six specialists inspect the diff. Skeptic challenges findings before Judge resolves the verdict."],
  ["03", "Apply decision", "Allow, review, or block this exact state. If blocked, pin the last approved version."],
] as const;

const terminalSteps = [
  ["01", "Scan current project", "$ locksmith scan .", "Run inside the repository before installing or merging."],
  ["02", "Review one lockfile", "$ locksmith review package-lock.json", "Target npm or Python dependency files directly."],
  ["03", "Read trust status", "$ locksmith status", "Compare global evidence with your workspace decision."],
] as const;

export default function HowToPage() {
  return <main className="how-page">
    <section className="how-hero wrap">
      <p className="eyebrow">How to use Locksmith</p>
      <h1>Two surfaces.<br />One decision.</h1>
      <p>Use web UI for shared review. Use terminal before install or merge. Both resolve same dependency state.</p>
    </section>
    <section className="how-grid wrap">
      <article>
        <div className="surface-head"><span className="eyebrow">Web UI</span><code>github.com/owner/repo</code></div>
        <h2>Shared review.</h2>
        <ol>{webSteps.map(([n,title,body]) => <li key={n}><span>{n}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
        <Link className="button" href="/review">Start web review <span aria-hidden="true">→</span></Link>
      </article>
      <article>
        <div className="surface-head"><span className="eyebrow">Terminal</span><code>locksmith scan .</code></div>
        <h2>Pre-install check.</h2>
        <ol>{terminalSteps.map(([n,title,command,body]) => <li key={n}><span>{n}</span><div><h3>{title}</h3><code className="step-command">{command}</code><p>{body}</p></div></li>)}</ol>
        <Link className="button secondary" href="/terminal">See terminal demo <span aria-hidden="true">→</span></Link>
      </article>
    </section>
    <section className="state-explainer wrap" id="trust-model">
      <p className="eyebrow">Shared trust model</p><h2>Same repo + commit + lockfile = same dependency state.</h2>
      <div><span>Global evidence</span><span aria-hidden="true">→</span><span>Workspace decision</span><span aria-hidden="true">→</span><span>Install or merge</span></div>
    </section>
  </main>;
}
