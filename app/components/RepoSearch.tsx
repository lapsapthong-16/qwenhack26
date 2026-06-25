"use client";

import { useEffect, useState, type FormEvent } from "react";

type RepoInspection = { repoUrl:string; defaultBranch:string; branches:string[]; dependencyFiles:string[] };
type ReviewResult = { verdict:"Allow"|"Review"|"Block"; dependencyStateId:string };

type Props = {
  id: string;
  initialRepo?: string;
  variant: "review"|"landing";
  onScan?: (input:{ repo:string; branch:string }) => Promise<void>;
};

export default function RepoSearch({ id, initialRepo = "", variant, onScan }: Props) {
  const [repo, setRepo] = useState(initialRepo);
  const [branch, setBranch] = useState("");
  const [inspection, setInspection] = useState<RepoInspection|null>(null);
  const [result, setResult] = useState<ReviewResult|null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const prefix = variant === "landing" ? "hero" : "review";
  const formClass = variant === "landing" ? "hero-command" : "review-import";

  useEffect(() => {
    setRepo(initialRepo);
    setInspection(null);
  }, [initialRepo]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setResult(null); setBusy(true);
    try {
      if (!inspection || inspection.repoUrl !== repo) {
        setStatus("Searching GitHub repository...");
        const response = await fetch("/api/repo", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({repo}) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Repository lookup failed");
        if (!data.dependencyFiles?.length) throw new Error("Public repository found, but no supported dependency files were detected.");
        setStatus("Repository found. Choose branch, then scan.");
        setInspection(data); setBranch(data.defaultBranch); return;
      }
      setStatus("Scanning dependency state...");
      if (onScan) return await onScan({ repo, branch });
      window.location.href = `/review?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`;
    } catch (cause) {
      setStatus("");
      setError(cause instanceof Error ? cause.message : "Repository lookup failed");
    } finally {
      setBusy(false);
    }
  }

  const buttonText = variant === "landing"
    ? busy ? (inspection ? "Scanning" : "Searching") : inspection ? "Scan" : "›"
    : busy ? (inspection ? "Scanning..." : "Searching...") : inspection ? "Scan branch" : "Search repo";

  return <>
    <form onSubmit={submit} className={formClass}>
      <span aria-hidden="true">&gt;_</span>
      <label className="sr-only" htmlFor={id}>GitHub repository</label>
      <input id={id} value={repo} onChange={(event)=>{setRepo(event.target.value); setInspection(null); setStatus("");}} type="url" placeholder="https://github.com/owner/repo" required />
      <button className={variant === "landing" && buttonText !== "›" ? "button-text" : ""} aria-label="Scan repository" type="submit" disabled={busy}>{buttonText}</button>
    </form>

    {inspection ? <div className={`${prefix}-repo-inspection repo-inspection`}>
      <div className="repo-files"><b>Dependency files</b><span>{inspection.dependencyFiles.map(file => <code key={file}>{file}</code>)}</span></div>
      <div className="repo-branch">
        <label htmlFor={`${id}-branch`}>Branch</label>
        <select id={`${id}-branch`} value={branch} onChange={(event)=>setBranch(event.target.value)}>
          {inspection.branches.map(name => <option value={name} key={name}>{name}</option>)}
        </select>
      </div>
    </div> : null}

    {status ? <p className={`${prefix}-repo-status`} aria-live="polite">{status}</p> : null}
    {result ? <p className={`${prefix}-repo-result`}><b>{result.verdict}</b> <code>{result.dependencyStateId}</code></p> : null}
    {error ? <p className={`${prefix}-repo-error`} role="alert">{error}</p> : null}
  </>;
}
