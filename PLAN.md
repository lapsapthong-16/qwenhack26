# Locksmith Build Plan

## 1. Product Summary

**Locksmith** is a Qwen-powered dependency safety tool for developers and small teams. It reviews dependency changes before they enter a project, using six specialist agents that inspect dependency state, package metadata, source patterns, runtime behavior, false-positive risk, and final policy verdict.

Short pitch:

> Locksmith puts dependency changes on trial before they enter your lockfile.

Primary hackathon track:

- **Track 3: Agent Society**

Secondary fit:

- **Track 4: Autopilot Agent**, because Locksmith can automate PR-time and install-time safety decisions.

Core distinction from NPMGuard:

- NPMGuard-style tools answer: **"Is this package suspicious?"**
- Locksmith answers: **"Is this dependency state safe for this repo/workspace under this policy?"**

## 2. Core Requirements

- Build a **Next.js + React** application.
- Keep frontend organized by components, feature modules, and shared UI primitives.
- Backend must be deployable on **Alibaba Cloud** for hackathon proof.
- AI reasoning must use **Qwen models** through Qwen Cloud.
- Support two product flows:
  - **Web app GitHub repo import**
  - **Terminal CLI dependency review**
- Track dependency review consistency across web and terminal using the same state model.
- Avoid Web3-first UX: no wallet, token payment, staking, or on-chain slashing in the main story.

## 3. User-Facing Product Surfaces

### 3.1 Web App Flow

Use case:

> A developer pastes a public GitHub repo URL, Locksmith reads dependency files, computes the dependency state, runs the six-agent review, and shows whether the repo's dependency state is safe, needs review, or should be blocked.

MVP inputs:

- Public GitHub repo URL
- Optional branch name
- Optional workspace name

Files to detect:

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `requirements.txt`
- `pyproject.toml`

MVP package ecosystems:

- **npm**: review `package.json` plus `package-lock.json` when present. Install/update story maps to `npm install`.
- **Python/pip**: review `requirements.txt`. Install/update story maps to `pip install -r requirements.txt`.

For the first build, `pyproject.toml`, `pnpm-lock.yaml`, and `yarn.lock` can be detected and displayed, but deep review should prioritize npm + `requirements.txt`.

GitHub import options:

- GitHub REST contents API: `GET /repos/{owner}/{repo}/contents/{path}`
- Git Trees API: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
- Raw files: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`

MVP can support public GitHub repos without OAuth. Private repo support can be future/OAuth-enabled.

### 3.2 Terminal CLI Flow

Use case:

> A developer runs Locksmith before installing/updating dependencies. Locksmith compares the current dependency files against the last approved state and blocks, warns, or allows the install.

MVP commands:

```bash
locksmith scan .
locksmith review package-lock.json
locksmith review requirements.txt
locksmith status
```

Future commands:

```bash
locksmith npm install
locksmith pip install -r requirements.txt
locksmith approve
locksmith explain
```

CLI behavior:

- Compute the same dependency state ID as the web app when possible.
- Check workspace approval from backend when authenticated/connected.
- Fall back to repo trust file/local-only informational mode when offline.
- Never treat local cache as team source of truth.

## 4. State And Trust Model

This section resolves the web/terminal consistency issue.

Core rule:

> Reviews belong to dependency states. Approvals belong to workspaces/teams.

Locksmith must not say a package is "safe forever." It should say:

> This exact dependency state was reviewed at this time, with this evidence, under this policy.

### 4.1 Dependency State ID

Every scan computes a stable fingerprint from:

- repo URL, if available
- branch, if available
- commit SHA, if available
- package manager
- dependency file hashes
- lockfile hashes

Example:

```json
{
  "repoUrl": "https://github.com/acme/app",
  "branch": "main",
  "commitSha": "abc123",
  "packageManager": "npm",
  "lockfileHash": "sha256:xyz"
}
```

If web app and CLI scan the same repo commit and dependency files, they must resolve to the same dependency state ID.

### 4.2 Global Evidence Cache

Reusable evidence that can be shared across scans:

- package metadata
- version age
- lifecycle scripts
- known bad package/version indicators
- suspicious pattern findings
- public package-level facts

This cache helps avoid repeated expensive work, but it is not team approval.

### 4.3 Workspace Trust Decisions

Workspace-specific approval records:

- workspace ID/name
- repo URL
- branch
- commit SHA
- dependency state ID
- policy used
- verdict: `allow`, `review`, `block`
- approver/override actor
- timestamp
- linked evidence report ID

Another workspace may reuse public evidence but must make its own approval decision.

### 4.4 Repo Trust File

For team repos, commit a small trust pointer:

```text
.locksmith/locksmith.json
```

Example:

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

Full evidence stays in the backend evidence vault, not in Git.

### 4.5 Invalidation Rules

An approved state becomes invalid if:

- dependency files change
- lockfile hash changes
- workspace policy changes
- a package version later becomes known malicious
- evidence is revoked/superseded
- approval expires under policy

When invalidated, Locksmith should require re-review.

## 5. Six-Agent Society

Use exactly six MVP agents. Do not add more for the first build.

### 5.1 Baseline Agent

Job:

- Compare current dependency state against last approved baseline.
- Identify added, updated, removed, and transitive dependency changes.
- Own dependency graph impact for MVP.

Tools/skills:

- lockfile parser
- dependency diff
- repo trust file reader

### 5.2 Manifest Agent

Job:

- Inspect package metadata, lifecycle scripts, release timing, maintainer/publisher signals, dependency count jumps, and package purpose mismatch.

Tools/skills:

- npm registry API
- PyPI API / package metadata lookup
- package metadata parser

### 5.3 Static Agent

Job:

- Detect suspicious code patterns before execution.

Patterns:

- obfuscation
- base64 blobs
- `eval`
- dynamic `Function`
- `process.env`
- file system access
- network calls
- `child_process`
- lifecycle script payloads

Tools/skills:

- deterministic rules first
- AST or text scanner
- optional Semgrep-like rules
- Qwen explanation of severity

### 5.4 Behavior Agent

Job:

- Test or simulate install/runtime behavior in isolation.

MVP acceptable approaches:

- controlled sample package with monitored install script
- sandboxed subprocess
- Docker sandbox if feasible
- logged file/network/env access simulation

The evidence must be concrete enough for the demo.

### 5.5 Skeptic Agent

Job:

- Challenge false positives.
- Ask whether the behavior may be normal for the package category.
- Force stronger evidence before `block`.

This agent must be visible in the demo because Track 3 asks for disagreement/conflict resolution.

### 5.6 Judge Agent

Job:

- Resolve disagreement into final verdict.
- Apply policy for MVP.
- Output:
  - `Allow`
  - `Review`
  - `Block`
  - confidence
  - evidence summary
  - suggested next action

Suggested actions:

- stay on previous approved version
- pin previous version
- rollback lockfile
- remove package
- wait for package age/cooldown
- manual review required

Do not create separate Policy, Dependency Graph, or Remediation agents for MVP.

## 6. Demo Screens

The demo needs to show both product flows and the Track 3 agent collaboration clearly.

### 6.1 Screen: Landing / Repo Import

Must show:

- product name: Locksmith
- GitHub repo URL input
- branch selector or default branch indicator
- CTA: `Review Dependencies`

Avoid a marketing-only landing page. The first screen should be usable.

### 6.2 Screen: Dependency State Overview

Must show:

- repo name
- branch
- commit SHA
- dependency state ID
- lockfile hash
- package manager detected
- last workspace approval status
- global evidence status

Important labels:

- `Global Analysis`
- `Your Workspace`

### 6.3 Screen: Dependency Diff

Must show:

- added packages
- updated packages
- removed packages
- risky transitive changes
- previous approved version, when available

Example:

```text
colors 2.0.0 -> 3.0.0
Status: review required
Previous approved: 2.0.0
```

### 6.4 Screen: Agent Review Timeline

Must show all six agents with their outputs:

1. Baseline Agent
2. Manifest Agent
3. Static Agent
4. Behavior Agent
5. Skeptic Agent
6. Judge Agent

Each agent card should include:

- status: pending/running/done
- finding summary
- evidence count
- severity

The Skeptic Agent should visibly challenge at least one finding.

### 6.5 Screen: Verdict

Must show:

- final verdict: `Allow`, `Review`, or `Block`
- confidence
- top evidence
- policy explanation
- recommended next action
- button to approve/reject/mark reviewed

For the demo, show a `Block` case.

### 6.6 Screen: Evidence Vault / Review History

Must show:

- previous reviews for this repo/workspace
- dependency state IDs
- commit SHAs
- verdicts
- timestamps
- who approved/overrode

This screen proves the version-control safety model.

### 6.7 Screen: CLI Companion

Web app can include a CLI command preview:

```bash
locksmith scan .
```

And a sample output panel:

```text
Dependency state: state_456
Global evidence: reviewed
Workspace status: review required
Verdict: BLOCK
Reason: package update added postinstall + env access + outbound request
Recommendation: pin colors@2.0.0
```

## 7. Demo Flow 1: Web App GitHub Import

Goal:

> Show that Locksmith can review a public GitHub repo and create workspace-specific dependency safety evidence.

Steps:

1. Paste public GitHub repo URL.
2. App fetches repo tree and dependency files.
3. App computes dependency state ID.
4. App checks global evidence cache.
5. App checks workspace approval status.
6. App runs six-agent review on changed/risky packages.
7. App shows disagreement:
   - Static Agent flags `process.env`.
   - Skeptic Agent argues env access can be normal.
   - Behavior Agent confirms outbound request during install.
8. Judge Agent returns `Block`.
9. App recommends pinning previous approved version.
10. User saves review; workspace trust decision is recorded.

What the judge should understand:

- This is not a generic public scan.
- The verdict is tied to repo, branch, commit, lockfile hash, and policy.
- Public evidence and workspace approval are separate.

## 8. Demo Flow 2: Terminal CLI Review

Goal:

> Show install-time protection and consistency with web app state.

Steps:

1. In a local project, run:

```bash
locksmith scan .
```

2. CLI computes dependency state ID.
3. CLI checks backend for global evidence and workspace trust decision.
4. If same state was approved in web app, CLI prints:

```text
Workspace status: approved
Install allowed
```

5. Change/update one dependency.
6. Run:

```bash
locksmith scan .
```

7. CLI detects lockfile hash changed.
8. CLI runs review for changed dependency.
9. CLI blocks risky update:

```text
Verdict: BLOCK
Recommendation: pin previous approved version
```

What the judge should understand:

- Web app and CLI share the same dependency state model.
- Team approval is not local-only.
- Local cache is only for speed.
- Re-review only happens when dependency state changes or evidence is invalidated.

## 9. Suggested Technical Architecture

### 9.1 Monorepo Structure

Recommended structure:

```text
.
├── apps/
│   ├── web/              # Next.js app
│   └── cli/              # Node CLI package
├── packages/
│   ├── agents/           # six-agent orchestration
│   ├── core/             # dependency state, policy, verdict types
│   ├── github/           # GitHub import client
│   ├── scanners/         # lockfile/parser/static/manifest tools
│   └── ui/               # shared React UI components
├── docs/
│   └── demo-script.md
├── AGENTS.md
└── PLAN.md
```

If time is short, start with one Next.js app and keep CLI as a package or script:

```text
.
├── app/
├── components/
├── features/
│   ├── repo-import/
│   ├── dependency-review/
│   ├── agent-timeline/
│   ├── evidence-vault/
│   └── cli-preview/
├── lib/
│   ├── agents/
│   ├── github/
│   ├── qwen/
│   ├── state/
│   └── scanners/
└── cli/
```

### 9.2 Frontend Component Structure

Suggested components:

- `RepoImportForm`
- `DependencyStateCard`
- `GlobalAnalysisCard`
- `WorkspaceApprovalCard`
- `DependencyDiffTable`
- `AgentTimeline`
- `AgentFindingCard`
- `VerdictPanel`
- `EvidenceVaultTable`
- `CliOutputPreview`
- `PolicyBadge`

Pages/routes:

- `/`
  - repo import + recent reviews
- `/review/[reviewId]`
  - dependency state, agent timeline, verdict
- `/repo/[owner]/[repo]`
  - repo history and workspace approvals
- `/settings`
  - workspace/policy/model settings, optional later

### 9.3 Backend/API Routes

Next.js API route candidates:

- `POST /api/github/import`
  - fetch repo tree and dependency files
- `POST /api/dependency-state`
  - compute dependency state ID
- `POST /api/reviews/run`
  - run six-agent review
- `GET /api/reviews/:id`
  - fetch review report
- `GET /api/workspaces/:id/approvals`
  - list workspace decisions
- `POST /api/workspaces/:id/approve`
  - approve or override review
- `POST /api/cli/resolve-state`
  - CLI checks global evidence + workspace approval

### 9.4 Data Store

Use a simple database for MVP:

- SQLite/Postgres locally
- Alibaba Cloud-hosted database or managed service for deployment proof

Tables/entities:

- `DependencyState`
- `Review`
- `AgentFinding`
- `GlobalEvidence`
- `Workspace`
- `WorkspaceTrustDecision`
- `PackageFact`
- `Policy`

### 9.5 Qwen Integration

Use Qwen models for:

- agent reasoning
- finding explanation
- skepticism/critique
- final verdict synthesis

Keep deterministic scanners/tool outputs separate from model reasoning:

```text
scanner/tool result -> evidence JSON -> Qwen agent reasoning -> structured finding
```

This makes the project more credible and easier to debug.

### 9.6 Alibaba Cloud Deployment

Hackathon requirements include proof that backend is running on Alibaba Cloud.

Plan:

- Deploy Next.js app/backend to Alibaba Cloud ECS, Function Compute, or Container Service.
- Store env vars for Qwen Cloud API and database connection.
- Include code path or config showing Alibaba Cloud service usage.
- Record short deployment proof video showing backend running on Alibaba Cloud.

Suggested environment variables:

```text
QWEN_API_KEY=
QWEN_MODEL=
DATABASE_URL=
GITHUB_TOKEN=
LOCKSMITH_WORKSPACE_ID=
```

## 10. MVP Scope

Build:

- Next.js web app
- public GitHub repo import
- dependency file detection
- npm `package.json` / `package-lock.json` review
- Python `requirements.txt` review
- dependency state ID
- review history model
- six-agent timeline
- Qwen-backed agent reasoning
- mock or real package scanner evidence
- CLI MVP command: `locksmith scan .`
- web/CLI shared state lookup
- final verdict panel
- Alibaba Cloud deploy path

Cut for MVP:

- private GitHub OAuth
- billing/payment
- custom user-provided AI model endpoints
- full package replacement recommendation
- Web3/on-chain reporting
- full Docker-grade sandbox if too slow
- deeper package manager support beyond npm and `requirements.txt` first

## 11. Decision Rules

For terminal and web:

1. First review creates a baseline only if no `Block` finding exists or a human explicitly overrides.
2. Matching approved dependency state can be allowed without full re-review.
3. Changed dependency state requires review.
4. Critical risk blocks install/merge by default.
5. Medium risk requires human review.
6. If update is risky and previous version was approved, recommend staying on/pinning previous approved version.
7. Do not recommend unrelated alternative packages by default.
8. Overrides must be logged.
9. Public scans do not equal workspace approval.
10. Local cache does not equal team source of truth.

## 12. Open Questions

These can be decided before implementation:

1. Should the CLI be built as a real installable package immediately, or as a local script for the hackathon demo first?
2. Should the first suspicious package be a controlled local fixture, a real historical malicious package, or a synthetic package created for the demo?
3. Which Alibaba Cloud service should be used for deployment proof: ECS, Function Compute, or Container Service?
