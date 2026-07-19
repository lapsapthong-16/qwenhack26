# Locksmith

Locksmith is a Qwen-powered dependency safety reviewer for developers and small teams. It puts a repository dependency state through six specialist agents before a package change is trusted.

> Locksmith puts dependency changes on trial before they enter your lockfile.

Hackathon application track: **Track 3 — Agent Society**.

## 🧭 Story Scenario

A small team is preparing a release. A dependency update lands right before merge, and nobody wants to approve a lockfile by gut feel. Locksmith lets the team paste a public GitHub repo for analysis or run a guarded npm install locally. It retrieves dependency files, inspects real package artifacts, and asks six Qwen agents to decide whether the candidate state should be allowed, reviewed, or blocked.

## ⚠️ Problem Statement

Package managers make it easy to install code the team has not reviewed. A package update can add lifecycle scripts, build hooks, transitive dependencies, network behavior, local file access, or source patterns that are risky for one repo but normal in another.

Most scanners answer, "Is this package suspicious?" Locksmith is aimed at the more useful team question:

> Is this exact dependency state safe for this repo, under this review policy, with the evidence we retrieved?

## ✅ Solution

Locksmith retrieves dependency files, computes a deterministic dependency-file fingerprint, fetches real package code from npm and PyPI, and runs six role-specific Qwen agents. The point of the panel is reliability: claims must be grounded in retrieved evidence, weak findings are challenged, and the final Judge must resolve the disagreement before a decision is shown.

## 🔐 Reliability Against Hallucinated Findings

Locksmith does not treat an agent's confidence as proof. Each role receives the dependency files and package artifacts collected for the review, and findings are expected to cite concrete package names, files, scripts, or observed metadata.

The review is deliberately staged:

1. **Baseline Agent** establishes what changed and what evidence is available.
2. **Manifest, Static, and Behavior Agents** inspect different risk surfaces independently.
3. **Skeptic Agent** challenges unsupported claims, asks whether suspicious behavior is normal for the package type, and labels evidence as direct or inferred.
4. **Judge Agent** resolves the panel's findings under the repo context and policy, producing `Allow`, `Review`, or `Block` with a reason and remediation.

This is a reliability pattern, not a guarantee that six agents are automatically more accurate than one. The product makes uncertainty visible, limits unsupported claims, and creates an auditable path from evidence to decision. Behavior findings are explicitly marked as inferred until sandbox execution is implemented.

### ✨ Features

- **Repo review in seconds** — Paste a public GitHub repository and Locksmith finds the dependency files that matter.
- **Six-agent reliability panel** — Baseline, Manifest, Static, Behavior, Skeptic, and Judge agents divide the work, challenge weak evidence, and resolve a final verdict.
- **Real package evidence** — Inspect npm and PyPI metadata, tarballs, manifests, lifecycle hooks, entrypoints, and selected source files instead of relying on package reputation alone.
- **Evidence-gated decisions** — Every review ends with an actionable `Allow`, `Review`, or `Block` outcome plus cited evidence, uncertainty, and remediation.
- **Guarded npm installs** — Review a candidate lockfile before installation; suspicious or incomplete results stop the install before it changes the project.
- **Live review progress** — Watch package retrieval and each specialist agent move from queued to completed in the review workspace.
- **Local review history** — Reopen completed decisions and inspect the dependency state ID, findings, evidence, and generated HTML report.

### 🎯 Why It Matters

Locksmith is built for the moment before a dependency enters a project. It turns a risky package update from a rushed approval into a review that a developer can explain: what changed, what was actually inspected, which claims were challenged, and why the final decision was reached.

## 🏗️ System Architecture Flow

<img width="1834" height="1024" alt="arch-diagram" src="https://github.com/user-attachments/assets/0cc03e5a-f4ff-4621-bfda-4fb24854089f" />

## 🤖 Six-Agent Review Panel

| Agent | Implemented role |
| --- | --- |
| Baseline | Identifies package manager, direct dependencies, exact/pinned versions, package inspection coverage, and missing evidence. |
| Manifest | Reviews npm `package.json`, PyPI metadata/build files, repo manifests, lifecycle scripts, build hooks, entrypoints, and purpose mismatch. |
| Static | Reviews selected package files for risky patterns such as `eval`, dynamic `Function`, env access, file access, URLs, `child_process`, `subprocess`, shell execution, and persistence indicators. |
| Behavior | Infers install/runtime behavior from retrieved files and labels it as inferred, not sandbox-observed. |
| Skeptic | Challenges unsupported claims and filters false positives before final judgment. |
| Judge | Resolves the prior findings into `Allow`, `Review`, or `Block` with the smallest remediation. |

### What the panel is designed to prevent

- A generic risk label with no package or file evidence.
- A static signal being treated as malicious without package context.
- An inferred behavior claim being presented as a sandbox observation.
- A previous review being mistaken for approval of a changed dependency state.
- A confident final answer that hides disagreement or missing evidence.

## 🛠️ Tech Stack

- Node.js 20+
- Next.js 15
- React 19
- TypeScript
- Qwen through Alibaba Cloud Model Studio
- Alibaba Cloud ECS
- GitHub API and raw repository files
- npm Registry and package tarballs
- PyPI JSON API and package artifacts
- Local JSON storage for the current MVP; Alibaba Cloud RDS PostgreSQL is provisioned for the persistence migration
- Docker / standalone Next.js deployment

### ☁️ Alibaba Cloud Deployment

Locksmith is deployed as a single-node Next.js application on Alibaba Cloud ECS in Singapore. The following services are used or provisioned for the deployment:

See the complete deployment record in [`ALIBABA.md`](ALIBABA.md), and see the submitted screenshots and recording in [`proof-of-deployment/`](proof-of-deployment/).

| Service | Why we use it | Status in this repository |
|---|---|---|
| **ECS** | Hosts the Next.js web app, API routes, and review jobs | Active production runtime; configured by [`Dockerfile`](Dockerfile) and deployment details in [`ALIBABA.md`](ALIBABA.md) |
| **Alibaba Cloud Model Studio (Qwen)** | Runs the six specialist agents that inspect dependency risk and produce the final verdict | Active through [`lib/locksmith.ts`](lib/locksmith.ts), using the Alibaba-compatible endpoint and server-side Qwen credentials |
| **KMS 3.0 / Secrets Manager** | Stores the Qwen API credential in an encrypted, centrally rotatable secret | Provisioned as `locksmith/qwen-api-key`; the current app reads `QWEN_API_KEY` from ECS environment configuration in [`lib/locksmith.ts`](lib/locksmith.ts) |
| **ApsaraDB RDS PostgreSQL** | Provides durable shared storage for workspace approvals, review history, evidence, and audit events | Provisioned and wired behind `DATABASE_URL` in [`lib/database.ts`](lib/database.ts); persistence modules opt in through [`lib/reviewHistory.ts`](lib/reviewHistory.ts), [`lib/packageEvidence.ts`](lib/packageEvidence.ts), and [`lib/workspaceDecisions.ts`](lib/workspaceDecisions.ts) |

The current runtime still reads `QWEN_API_KEY` from server-only ECS environment
configuration and stores review state in persistent local `.locksmith/` JSON files.
RDS and KMS remain provisioned deployment infrastructure rather than fully managed
application integrations: KMS SDK/RAM-role secret fetching and the complete RDS
schema migration are still pending. The deployment evidence is collected in
[`proof-of-deployment/`](proof-of-deployment/), including the ECS, KMS, and RDS
screenshots plus the Alibaba Cloud deployment recording.

- **Demo:** [http://47.84.96.197](http://47.84.96.197)

The current hackathon deployment uses HTTP to keep the MVP inexpensive. A production deployment should add a domain, TLS, HTTPS, and a reverse proxy.

## 🚀 Getting Started

Locksmith supports two ways to test the application:

### Try the hosted EC2 demo

Open the deployed app at [http://47.84.96.197](http://47.84.96.197). No repository clone, local setup, or API key is required. The hosted instance uses server-side Qwen credentials configured on ECS, so testers can use this path to evaluate the product UI, repository review flow, agent progress, final verdict, and review history.

If the hosted review fails, the shared Qwen API key may have reached its usage or cost limit. In that case, run Locksmith locally with your own Qwen API key using the instructions below.

### Run Locksmith locally

Local development is also supported for technical testers who want to inspect or modify the implementation:

```bash
git clone <repository-url>
cd <repository-directory>
npm install
cp .env.example .env.local
# Add your own QWEN_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local reviews use the tester's own Alibaba Cloud Model Studio/Qwen credentials and store review state locally in `.locksmith/`. The API key is read server-side and must never be committed or shared. There is currently no mock mode, so `QWEN_API_KEY` and `QWEN_MODEL` must be configured for reviews to run.

Requirements:

- Node.js 20 or newer
- A Qwen API key from Alibaba Cloud Model Studio

## 🔧 Environment Variables

| Variable | Purpose |
| --- | --- |
| `QWEN_API_KEY` | Required. Alibaba Cloud Model Studio API key used for real agent analysis. |
| `QWEN_MODEL` | Required. Model name sent to the Qwen API. `.env.example` uses `qwen3.5-flash`. |
| `QWEN_BASE_URL` | Optional OpenAI-compatible endpoint. Defaults to `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`. |

There is no mock mode in the current app. Reviews fail fast when `QWEN_API_KEY` or `QWEN_MODEL` is missing. The deployed instance keeps these values server-side; do not commit them.

## 💻 Running Locally

Start the web app:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```


Run a guarded npm installation from a supported npm project:

```bash
node bin/locksmith.mjs npm install colors@3.0.0
```

CLI behavior:

- The CLI resolves a candidate lockfile with lifecycle scripts disabled, then reviews it before changing the real project.
- `Allow` installs the exact reviewed lockfile; `Review` and `Block` stop installation.
- Fresh decisions save sanitized JSON history and `.locksmith/reports/<reviewId>.html`.
- The guarded CLI reviews at most 50 resolved packages per project in the MVP to control API cost; larger lockfiles stop before installation rather than receiving partial coverage.
- The MVP supports ordinary single-package npm projects with package-lock v2/v3. Workspaces, local/Git dependencies, global/prefix installs, and resolution-bypassing flags are rejected.
- The CLI is local to this repository until it is published as an npm binary.

Inspect a public GitHub repo through the API:

```bash
curl -sS -X POST http://localhost:3000/api/repo \
  -H 'Content-Type: application/json' \
  -d '{"repo":"https://github.com/owner/repo"}'
```

Start a review:

```bash
curl -sS -X POST http://localhost:3000/api/review \
  -H 'Content-Type: application/json' \
  -d '{"repo":"https://github.com/owner/repo","branch":"main"}'
```

The review endpoint returns a `reviewId`. Poll `/api/review/{reviewId}` for package retrieval progress, agent progress, and final results.

## 📁 Project Structure

```text
.
├── app/
│   ├── api/
│   │   ├── history/          # Reads local review history
│   │   ├── repo/             # Public GitHub repo inspection
│   │   └── review/           # Starts and polls review jobs
│   ├── components/           # Shared header and repo search form
│   ├── history/              # Saved review UI
│   ├── review/               # Live review UI and final report
│   └── page.tsx              # Landing page
├── bin/locksmith.mjs         # Guarded npm install CLI
├── lib/
│   ├── locksmith.ts          # Core review engine and Qwen agent prompts
│   ├── npmPackages.ts        # npm registry/tarball package evidence
│   ├── pythonPackages.ts     # PyPI artifact package evidence
│   ├── reviewHistory.ts      # Local JSON history
│   ├── renderHtmlReport.ts   # Dependency-free CLI report renderer
│   └── reviewJobs.ts         # In-memory async review jobs
├── public/assets/            # Product and workflow illustrations
├── Dockerfile                # Standalone production image
└── README.md
```

## 🎬 Demo / Screenshots

The repository includes product and workflow assets under [`public/assets`](public/assets). The live demo is available at [http://47.84.96.197](http://47.84.96.197).

Recommended demo flow:

1. Open the landing page.
2. Paste a public GitHub repository into `/review`.
3. Show dependency file detection and branch selection.
4. Start the Qwen review.
5. Show real npm/PyPI package artifact retrieval.
6. Show the six-agent progress timeline.
7. Show the final verdict, evidence, remediation, model, and dependency state ID.
8. Open `/history` to show the saved local review.
9. Run `node bin/locksmith.mjs npm install <package>` from a supported local npm project to show the guarded install flow and HTML artifact.

## 🗺️ Future Roadmap

1. **Repo-aware dependency states** — fingerprint the canonical repository, commit SHA, package manager, dependency-file hashes, lockfile hashes, and policy version. Resolve the same state consistently from web, CLI, and CI.
2. **Workspace approval layer** — add authenticated workspaces with private `Allow` / `Review` / `Block` decisions, approver identity, expiry, explicit overrides, and an audit trail. A public scan must remain analysis only until that workspace approves it.
3. **Global evidence cache with decision boundaries** — store reusable package/artifact evidence centrally. When a package version already has valid evidence, reuse the evidence rather than re-fetching and re-inspecting it, while still having the Baseline and Judge agents evaluate the new repository context and workspace policy. Evidence reuse must never silently become cross-repo approval.
4. **Baseline-aware incremental reviews** — compare a candidate state to the last workspace-approved baseline, prioritize added/updated packages and risky transitive changes, and recommend pinning or rolling back to the prior approved version when appropriate.
5. **Repo trust pointer and CI** — write a small committed `.locksmith/locksmith.json` pointer after approval; add GitHub Actions/PR checks that verify the current state, approval validity, policy, and revocations before merge.
6. **Stronger behavioral evidence** — execute selected packages in an isolated monitored sandbox, clearly separating observed behavior from the current static/inferred findings.
7. **Broader developer workflows** — publish the CLI, add `locksmith scan .` and `locksmith review`, support pip/Poetry and more lockfile formats, then add private GitHub import through OAuth.

### ⚠️ Honest Limitations

- Review jobs are stored in memory, so polling fails after a server restart.
- Review history is local-only JSON, not a team backend.
- History stores non-allow package evidence only, so successful package evidence is not retained in full.
- npm requires `package-lock.json` for exact version inspection; without it, npm packages are marked `Review` as unresolved.
- PyPI support handles pinned/simple dependency strings, not full pip resolver behavior.
- Package/library coverage is intentionally limited in the MVP. Python reviews are capped at 20 packages per scan, while the guarded npm CLI is capped at 50 resolved packages. These limits keep the project budget-friendly and avoid exhausting the Alibaba Cloud Qwen inference voucher during development and judging. 🚦
- The current package limit is a cost and reliability trade-off, not a claim that larger repositories are fully covered. A production version would add batching, caching, prioritization, and configurable budgets.
- PyPI wheel parsing is minimal and artifact selection is not platform-aware.
- Behavior analysis is inferred from retrieved files; there is no sandbox execution yet.
- Large package evidence can make later Qwen roles slow or stall.
- The six agents currently use deliberately compact, role-focused prompts to control Qwen inference cost. Each agent's prompt could be improved with richer domain skills, structured references, package-type-specific guidance, and more examples of strong evidence. 🧠
- Better prompts would likely improve consistency and depth, but they would also increase token usage and voucher consumption. The next iteration should measure that quality/cost trade-off per agent before expanding every prompt. 💰
- The CLI is not published on npm yet; use the repository script or `npm link` during local development.
- Only guarded npm install is in scope. pip and raw scan commands are not MVP surfaces.
- The dependency state ID hashes dependency-file content only; it is not yet scoped by repository, commit, branch, package manager, or policy version.
- Package evidence is a per-storage-root local cache. It can avoid a repeat artifact retrieval, but it neither skips Qwen review nor provides a reusable approval for a different repository.
- There is no workspace approval layer, policy editor, repo trust file writer, CI integration, revocation feed, or shared evidence backend yet.
- There is no authentication, private GitHub import, or team account model.

## What Is Not Completed Yet

This section maps the remaining work to `SUBMISSION.md`.

| Submission item | Current status |
| --- | --- |
| Public code repository URL | Not finalized in this README. Add the final public GitHub URL before submission. |
| Open source license | Completed: `LICENSE` exists at the repository root. |
| Proof of Alibaba Cloud deployment | Completed for the current ECS deployment; see [`ALIBABA.md`](ALIBABA.md) for instance, endpoint, and verification notes. |
| Code file demonstrating Alibaba Cloud services/APIs | Completed through [`lib/locksmith.ts`](lib/locksmith.ts), which calls Qwen Model Studio's OpenAI-compatible API. |
| Architecture diagram | Completed for the current web app, review engine, external package registries, Qwen agents, and local persistent storage. |
| About 3-minute public demo video | Not completed. Needs a public YouTube, Vimeo, or Facebook Video link. |
| 
## Notes

- Public scans do not equal owner or team approval.
- Local history is useful for the demo, but it is not a team source of truth.
- The deployed ECS instance is a single-node MVP. Review jobs remain in process memory, while review history and package evidence use persistent local `.locksmith/` storage.
- See [`ALIBABA.md`](ALIBABA.md) for the current public deployment record. Deployment commands are documented in that file and the `Dockerfile`.
