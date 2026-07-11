import Link from "next/link";
import "./how-to.css";

const webSteps = [
  ["01", "Import repository", "Paste a public GitHub URL. Locksmith reads dependency files and computes the dependency state."],
  ["02", "Review agent evidence", "Six specialists inspect the diff. Skeptic challenges findings before Judge resolves the verdict."],
  ["03", "Apply decision", "Allow, review, or block this exact state. If blocked, pin the last approved version."],
] as const;

const terminalSteps = [
  ["01", "Request an install", "$ locksmith npm install <package>", "Locksmith resolves a candidate lockfile with scripts disabled, before the real project changes."],
  ["02", "Read the decision", "Allow / Review / Block", "Six Qwen agents inspect the candidate state; Review and Block stop npm."],
  ["03", "Install the approved state", "npm ci from reviewed lockfile", "Allow installs only the reviewed lockfile and saves the HTML report under .locksmith/reports."],
] as const;

export default function HowToPage() {
  return <main className="how-page">
    <section className="how-hero wrap">
      <p className="eyebrow">How to use Locksmith</p>
      <h1>Two surfaces.<br />One decision.</h1>
      <p>Use the web UI for repository analysis. Use the terminal to gate an npm install. Both use the same dependency evidence and six-agent review engine.</p>
    </section>
    <section className="how-grid wrap">
      <article>
        <div className="surface-head"><span className="eyebrow">Web UI</span><code>github.com/owner/repo</code></div>
        <h2>Shared review.</h2>
        <ol>{webSteps.map(([n,title,body]) => <li key={n}><span>{n}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
        <Link className="button" href="/review">Start web review <span aria-hidden="true">→</span></Link>
      </article>
      <article>
        <div className="surface-head"><span className="eyebrow">Terminal</span><code>locksmith npm install</code></div>
        <h2>Guarded install.</h2>
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
