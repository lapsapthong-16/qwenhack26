import type { Metadata } from "next";
import Link from "next/link";
import "./terminal.css";

export const metadata: Metadata = {
  title: "Terminal CLI — Locksmith",
  description: "Guarded npm installation through Locksmith's local CLI.",
};

const agents = [
  ["01", "BASELINE", "1 package changed: colors 2.0.0 → 3.0.0"],
  ["02", "MANIFEST", "New postinstall script found in colors@3.0.0"],
  ["03", "STATIC", "Reads process.env and opens an outbound connection"],
  ["04", "BEHAVIOR", "Inferred POST during install from retrieved package files"],
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
            Locksmith resolves a candidate lockfile, reviews it, and only installs the
            exact approved state. A blocked package never reaches the real install.
          </p>
          <span className="demo-label">Local demo, not published on npm</span>
        </div>
      </section>

      <section className="terminal-stage wrap" aria-label="Locksmith terminal preview">
        <div className="terminal-window">
          <div className="terminal-bar">
            <div className="window-controls" aria-hidden="true"><i /><i /><i /></div>
            <span>acme/storefront — zsh — 118×34</span>
            <span className="terminal-secure">GUARDED INSTALL</span>
          </div>

          <div className="terminal-screen">
            <p className="command"><span>~/storefront</span> <b>$</b> locksmith npm install colors@3.0.0</p>
            <p className="command muted-command"><span>locksmith</span> <b>$</b> resolving candidate lockfile with scripts disabled</p>
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
            <li><span>01</span><p><strong>Guarded command</strong><code>locksmith npm install</code> resolves a candidate lockfile before it changes your project.</p></li>
            <li><span>02</span><p><strong>Decision gate</strong>Allow installs the reviewed lockfile; Review and Block stop npm before package scripts run.</p></li>
            <li><span>03</span><p><strong>Same review engine</strong>Six agents inspect, challenge, and resolve the dependency state. Fresh decisions save a standalone HTML report.</p></li>
          </ol>
          <Link className="button secondary" href="/review">Open web review <span aria-hidden="true">→</span></Link>
          <p className="prototype-note">This page is a static explanation. The MVP supports ordinary single-package npm projects with package-lock v2 or v3.</p>
        </aside>
      </section>
    </main>
  );
}
