import type { Metadata } from "next";
import Link from "next/link";
import "./terminal.css";

export const metadata: Metadata = {
  title: "Terminal demo — Locksmith",
  description: "A hardcoded preview of Locksmith's dependency review CLI.",
};

const agents = [
  ["01", "BASELINE", "1 package changed: colors 2.0.0 → 3.0.0"],
  ["02", "MANIFEST", "New postinstall script found in colors@3.0.0"],
  ["03", "STATIC", "Reads process.env and opens an outbound connection"],
  ["04", "BEHAVIOR", "Observed POST during isolated install"],
  ["05", "SKEPTIC", "No documented network feature explains this behavior"],
  ["06", "JUDGE", "Evidence meets strict policy block threshold"],
] as const;

export default function TerminalPage() {
  return (
    <main className="terminal-page">
      <section className="terminal-intro wrap">
        <div>
          <p className="eyebrow">Surface 02 / Terminal</p>
          <h1>Review before<br />you install.</h1>
        </div>
        <div className="terminal-deck">
          <p>
            The same dependency state, evidence, and workspace policy—available where
            dependency changes actually happen.
          </p>
          <span className="demo-label">Hardcoded product preview</span>
        </div>
      </section>

      <section className="terminal-stage wrap" aria-label="Locksmith terminal preview">
        <div className="terminal-window">
          <div className="terminal-bar">
            <div className="window-controls" aria-hidden="true"><i /><i /><i /></div>
            <span>acme/storefront — zsh — 118×34</span>
            <span className="terminal-secure">LOCAL DEMO</span>
          </div>

          <div className="terminal-screen">
            <p className="command"><span>~/storefront</span> <b>$</b> locksmith scan .</p>
            <div className="scan-meta">
              <p><span>LOCKSMITH</span> dependency review / strict policy</p>
              <dl>
                <div><dt>Repository</dt><dd>github.com/acme/storefront</dd></div>
                <div><dt>Commit</dt><dd>9e43c7a</dd></div>
                <div><dt>State</dt><dd>state_74fd9e2c</dd></div>
                <div><dt>Baseline</dt><dd>state_12aa8b11 (approved)</dd></div>
              </dl>
            </div>

            <div className="agent-log" aria-label="Six agent audit results">
              {agents.map(([number, name, finding], index) => (
                <div className={`agent-line agent-${index + 1}`} key={name}>
                  <span className="agent-number">{number}</span>
                  <strong>{name}</strong>
                  <span className="agent-status">DONE</span>
                  <p>{finding}</p>
                </div>
              ))}
            </div>

            <div className="terminal-verdict">
              <div>
                <span className="verdict-mark">BLOCK</span>
                <p>colors@3.0.0 cannot enter this dependency state.</p>
              </div>
              <dl>
                <div><dt>Reason</dt><dd>Undocumented install-time env access + network request</dd></div>
                <div><dt>Action</dt><dd>Pin the last approved version: npm i colors@2.0.0</dd></div>
              </dl>
            </div>
            <p className="command final-command"><span>~/storefront</span> <b>$</b> <i aria-hidden="true" /></p>
          </div>
        </div>

        <aside className="terminal-notes">
          <p className="eyebrow">What the terminal proves</p>
          <ol>
            <li><span>01</span><p><strong>One state model</strong>Matches the review shown in the web app.</p></li>
            <li><span>02</span><p><strong>Visible collaboration</strong>Six specialists inspect, challenge, and resolve.</p></li>
            <li><span>03</span><p><strong>Decisive output</strong>Block the change and provide the smallest safe fix.</p></li>
          </ol>
          <Link className="button secondary" href="/review">Open web review <span aria-hidden="true">→</span></Link>
          <p className="prototype-note">Interface prototype only. No command is executed.</p>
        </aside>
      </section>
    </main>
  );
}
