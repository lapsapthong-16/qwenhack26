import type { Metadata } from "next";
import Link from "next/link";
import "./terminal.css";

export const metadata: Metadata = {
  title: "Terminal CLI — Locksmith",
  description: "Current local demo CLI flow and future install wrapper direction for Locksmith.",
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
            Today the CLI runs as a local demo with Node. The intended product flow
            is a real locksmith binary that wraps installs before they touch a lockfile.
          </p>
          <span className="demo-label">Local demo, not published on npm</span>
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
            <p className="command"><span>~/locksmith</span> <b>$</b> node bin/locksmith.mjs scan ../storefront</p>
            <p className="command muted-command"><span>future</span> <b>$</b> locksmith npm install colors@3.0.0</p>
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
            <li><span>01</span><p><strong>Current command</strong>Runs a local scan through <code>node bin/locksmith.mjs scan .</code>.</p></li>
            <li><span>02</span><p><strong>Future wrapper</strong><code>locksmith npm install</code> and <code>locksmith pip install</code> are planned, not shipped.</p></li>
            <li><span>03</span><p><strong>Same review engine</strong>Six agents inspect, challenge, and resolve the dependency state.</p></li>
          </ol>
          <Link className="button secondary" href="/review">Open web review <span aria-hidden="true">→</span></Link>
          <p className="prototype-note">This page is a static explanation. Use the local Node command in a real terminal.</p>
        </aside>
      </section>
    </main>
  );
}
