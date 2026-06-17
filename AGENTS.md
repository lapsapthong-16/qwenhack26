# Locksmith Project Context

## Working Instructions

- Follow `/Users/edw/.codex/RTK.md`: prefix shell commands with `rtk` where practical.
- This repository is for the Qwen Cloud Global AI Hackathon.
- Primary project direction: **Locksmith**.
- Treat previous ideas as reference material, not final product requirements.

## Hackathon Track

Primary track: **Track 3: Agent Society**.

Locksmith should prove that multiple specialist agents can review dependency risk better than one generic model. The core demo must show task division, disagreement, evidence gathering, and a final resolved verdict.

Secondary track fit: **Track 4: Autopilot Agent**, because Locksmith can automate install-time or PR-time dependency safety checks.

## Product Concept

**Locksmith** is a Qwen-powered dependency safety tool for developers and small teams. It reviews dependency changes before they enter a project, using a society of specialist security agents that inspect package metadata, dependency graphs, suspicious code, sandbox behavior, and team policy.

Simple pitch:

> Locksmith puts dependency changes on trial before they enter your lockfile.

Core user:

- JavaScript/Python developers
- small engineering teams
- open-source maintainers
- hackathon builders shipping projects with many dependencies

Core pain:

- Developers install or update npm/pip packages without knowing whether a new dependency, version, install script, or transitive package is suspicious.
- Existing scanners often give generic public package risk, but teams need repo-specific evidence and a merge/install decision.
- Teams need a shared approval state. A local-only review cache is not enough because multiple developers on the same repo should not each create isolated trust records for the same dependency state.

## Differentiation

Do not build "NPMGuard but Qwen." NPMGuard already covers AI package audits, sandboxing, exploit testing, CLI flow, and Web3/public audit records.

Locksmith should differ by being:

- Web2-first, not crypto/payment-first.
- Repo-specific, not only public package reputation.
- Decision-oriented: allow, review, block, rollback.
- Evidence-oriented: explain why the decision applies to this repo and dependency change.
- Private by default for team/project evidence.
- Public package lookup only as a secondary feature.

Key framing:

> Locksmith does not only ask "is this package bad?" It asks "is this dependency change safe for this repo, in this install/CI context, under this team policy?"

## Trust Model

Core concept:

> Reviews belong to dependency states. Approvals belong to workspaces/teams.

Locksmith should not claim that a package is "safe forever." It should claim:

> This exact dependency state was reviewed at this time, with this evidence, under this policy.

### Dependency State ID

Every scan should compute a stable dependency state fingerprint from:

- repo URL, when available
- commit SHA, when available
- package manager
- dependency file hashes
- relevant lockfile hashes

Example inputs:

- `github.com/acme/app`
- commit `abc123`
- `package-lock.json` hash `sha256:xyz`
- package manager `npm`

If the web app and terminal scan the same repo commit and lockfile, they should resolve to the same dependency state ID.

### Two-Layer Backend Model

Use two separate concepts:

1. **Global Evidence Cache**
   - Reusable package/repo evidence.
   - Public package facts, package metadata, suspicious behavior, release age, known bad versions.
   - Can be reused across users when evidence is public or non-sensitive.

2. **Workspace Trust Decisions**
   - Private approval/block/review status for a team or user workspace.
   - Includes policy, approver, overrides, repo, branch, commit, dependency state ID, and validity.
   - Another team may reuse public evidence but must make its own trust decision.

This distinction solves random public scans:

- A random user may scan a public repo and create public/informational evidence.
- That does not mean the repo owner or another company has approved that dependency state.
- UI must distinguish **Global Analysis** from **Your Workspace Approval**.

### Repo Trust File

For team projects, the repo should contain a small committed trust pointer, not the full evidence report.

Suggested file:

- `.locksmith/locksmith.json`

Suggested contents:

```json
{
  "workspace": "acme",
  "reviewId": "rev_123",
  "dependencyStateId": "state_456",
  "approvedCommit": "abc123",
  "lockfileHash": "sha256:xyz",
  "policy": "strict",
  "verdict": "allow",
  "approvedAt": "2026-06-17T10:00:00Z"
}
```

The full evidence report should live in the web app/backend evidence vault, not in Git.

### Local Cache

Local terminal cache is only for speed. It is not the team source of truth.

Local cache may store recently computed package metadata, prior scan artifacts, and downloaded package facts. Install/merge decisions should be based on:

- current dependency state ID
- repo trust file, when present
- workspace approval from backend, when connected
- policy
- global revocation/new threat intelligence

### Invalidation

An approved dependency state can become invalid if:

- dependency files or lockfile hash changes
- repo policy changes
- a previously approved package version becomes known malicious
- evidence is revoked or superseded
- approval expires, if a policy defines expiration

When invalidated, Locksmith should require re-review before allowing install/merge.

## Product Surfaces

Build two usage methods if scope allows:

1. **Web app**
   - User enters/imports a public GitHub repo URL.
   - App reads dependency files from the repo.
   - App reviews package files such as `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `requirements.txt`, `pyproject.toml`.
   - App computes dependency state ID from repo, branch, commit, and dependency file hashes.
   - App shows dependency graph, changed/high-risk packages, agent findings, global analysis, workspace approval status, and final verdict.
   - App should remember reviewed repo states by repo + branch + commit + lockfile hash + policy + review ID.

2. **Terminal CLI**
   - User runs a scan before or during dependency installation/update.
   - MVP commands can be simple:
     - `locksmith scan .`
     - `locksmith review package-lock.json`
   - Later commands may wrap installs:
     - `locksmith npm install`
     - `locksmith pip install -r requirements.txt`
   - CLI should pause or warn on suspicious new/updated packages and give clear recommendations.
   - CLI should compute the same dependency state ID as the web app where possible.
   - CLI should check the backend/workspace approval when connected, and fall back to repo trust file/local-only mode when offline.

### Terminal Decision Rules

For MVP:

1. First review for a repo creates a baseline only if there are no block findings or a human explicitly approves an override.
2. If dependency state matches an approved repo/workspace baseline, allow without full rescan.
3. If dependency files changed, review only new/updated packages and risky transitive changes first.
4. Critical findings should block install/merge unless user uses an explicit force/override flow.
5. Medium findings should require confirmation or human review.
6. If a new version is risky but a previous version is already approved, recommend staying on or pinning to the approved version.
7. Do not recommend unrelated replacement packages by default. If alternatives are shown, label them as candidates requiring their own review.
8. User overrides must be logged with reason, actor, time, and policy context.

### Web/CLI Consistency

Both clients should use the same backend concepts:

```text
CLI/Web App
   -> Dependency State ID
   -> Global Evidence Cache
   -> Workspace Approval Layer
   -> Repo Trust File / CI / Install Decision
```

Example web app labels:

- `Global Analysis`: public or reusable evidence for this state/package.
- `Your Workspace`: approved, blocked, review required, or no decision yet.

Example CLI labels:

- `Dependency state`: current state ID.
- `Global evidence`: reviewed/unseen/revoked.
- `Workspace status`: approved/blocked/review required/none.

## GitHub Import Notes

Public GitHub repos can be inspected without OAuth, subject to rate limits.

Useful approaches:

- GitHub REST contents API: `GET /repos/{owner}/{repo}/contents/{path}`
- Raw GitHub files: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
- Git Trees API for recursive file listing: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`

For hackathon MVP, public repo import is enough. Private repo support can be described as future/OAuth-enabled.

## Agent Society

Use concrete agent roles. Avoid vague "swarm AI" language.

Suggested agents:

- **Baseline Agent**: compares current dependency state against the last approved repo/workspace baseline.
- **Dependency Agent**: builds dependency graph and identifies new/changed packages.
- **Manifest Agent**: inspects package metadata, scripts, version age, maintainer/publisher signals.
- **Static Agent**: detects suspicious patterns such as obfuscation, `eval`, env access, file access, network calls, and child process use.
- **Behavior Agent**: runs or simulates sandbox checks for install/runtime behavior.
- **Skeptic Agent**: challenges false positives and asks whether behavior is normal for the package category.
- **Policy Agent**: applies project/team rules such as blocking new packages, recent versions, install scripts, or unknown maintainers.
- **Judge Agent**: resolves disagreements and emits final verdict: allow, review, block, rollback.

Track 3 demo should visibly show:

- each agent's finding
- disagreement or critique
- evidence used to resolve the disagreement
- final consensus verdict
- why this is better than a single-agent answer

## Demo Direction

Preferred demo:

1. User imports a GitHub repo or runs CLI on a local project.
2. Locksmith computes dependency state ID and checks whether this state has global evidence and workspace approval.
3. Locksmith detects a dependency update or risky package compared with the last approved baseline.
4. Agents inspect baseline diff, manifest, code, behavior, policy, and context.
5. Skeptic challenges whether the suspicious behavior is a false positive.
6. Evidence resolves the dispute.
7. Judge emits `Allow`, `Review`, or `Block`.
8. App/CLI suggests fix: pin previous approved version, rollback lockfile, remove package, or wait.
9. If approved, Locksmith creates or updates the workspace review and repo trust file pointer.

The demo should use realistic dependency files and at least one intentionally suspicious sample package/change.

## What To Avoid

- Do not lead with wallets, tokens, staking, slashing, Dash, DCAI, or on-chain reports.
- Do not make user-provided AI model endpoints the core feature. Use Qwen by default; optional custom model endpoint can be enterprise/future.
- Do not present Locksmith as a generic public npm scanner.
- Do not make local cache the source of truth for team safety decisions.
- Do not treat public scans of public repos as owner/team approval.
- Do not rely on a fake "agents talking" simulation. The agents must inspect real files and produce concrete evidence.
- Do not overbuild public package reputation before repo-specific review works.

## Backup Ideas

Keep these as lower-priority backups:

- Truman: narrow to supply-chain or churn early-warning decision replay if used.
- Open-source maintainer autopilot.
- Meeting-to-execution autopilot.
- Personal data deletion autopilot.
