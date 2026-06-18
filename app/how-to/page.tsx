import Link from "next/link";
import "./how-to.css";
import "./terminal-guide.css";

const webSteps = [
  ["01", "Paste a public repository", "Use a GitHub URL. This prototype loads prepared dependency evidence."],
  ["02", "Watch six agents review", "Baseline, Manifest, Static, Behavior, Skeptic, and Judge inspect the change in order."],
  ["03", "Act on the verdict", "Allow, review, or block the exact dependency state under workspace policy."],
] as const;

export default function HowToPage() {
  return <main className="how-page">
    <section className="how-hero wrap">
      <p className="eyebrow">How to use Locksmith</p>
      <h1>Two surfaces.<br />One decision.</h1>
      <p>Start in the browser for a shared review, or scan locally before an install. Both resolve dependency trust by repo state—not package reputation alone.</p>
    </section>
    <section className="how-grid wrap">
      <article>
        <div className="surface-head"><span className="eyebrow">Web version</span><code>github.com/owner/repo</code></div>
        <h2>Review with context.</h2>
        <ol>{webSteps.map(([n,title,body]) => <li key={n}><span>{n}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
        <Link className="button" href="/review">Start web review <span aria-hidden="true">→</span></Link>
      </article>
      <article>
        <div className="surface-head"><span className="eyebrow">Terminal version</span><code>locksmith scan .</code></div>
        <h2>Check before install.</h2>
        <p className="prototype-warning"><strong>Prototype syntax.</strong> The CLI is a hardcoded demo and is not packaged for installation yet.</p>
        <div className="command-guide">
          <section><span>01 / Scan project</span><p>Run from the folder containing your dependency files.</p><pre><code><b>$</b> locksmith scan .</code></pre></section>
          <section><span>02 / Review one file</span><p>Target an npm lockfile or Python requirements file.</p><pre><code><b>$</b> locksmith review package-lock.json{"\n"}<b>$</b> locksmith review requirements.txt</code></pre></section>
          <section><span>03 / Check trust state</span><p>See global evidence and your workspace decision.</p><pre><code><b>$</b> locksmith status</code></pre></section>
          <section><span>04 / Read the result</span><pre className="sample-output"><code>Dependency state  state_74fd9e2c{"\n"}Global evidence  reviewed{"\n"}Workspace status review required{"\n"}Verdict          BLOCK{"\n"}Action           pin colors@2.0.0</code></pre></section>
        </div>
        <Link className="button secondary" href="/terminal">See terminal demo <span aria-hidden="true">→</span></Link>
      </article>
    </section>
    <section className="state-explainer wrap">
      <p className="eyebrow">Shared trust model</p><h2>Same repo + commit + lockfile = same dependency state.</h2>
      <div><span>Global evidence</span><span aria-hidden="true">→</span><span>Workspace decision</span><span aria-hidden="true">→</span><span>Install or merge</span></div>
    </section>
  </main>;
}
