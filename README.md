# Locksmith

Locksmith is a Qwen-powered dependency safety reviewer for developers and small teams. It puts a repository dependency state through six specialist agents before a package change is trusted.

> Locksmith puts dependency changes on trial before they enter your lockfile.

Primary hackathon track: **Track 3: Agent Society**

## Story Scenario

A small team is preparing a release. A dependency update lands right before merge, and nobody wants to approve a lockfile by gut feel. Locksmith lets the team paste a public GitHub repo for analysis or run a guarded npm install locally. It retrieves dependency files, inspects real package artifacts, and asks six Qwen agents to decide whether the candidate state should be allowed, reviewed, or blocked.

## Problem Statement

Package managers make it easy to install code the team has not reviewed. A package update can add lifecycle scripts, build hooks, transitive dependencies, network behavior, local file access, or source patterns that are risky for one repo but normal in another.

Most scanners answer, "Is this package suspicious?" Locksmith is aimed at the more useful team question:

> Is this exact dependency state safe for this repo, under this review policy, with the evidence we retrieved?

## Solution

Locksmith retrieves dependency files, computes a stable dependency state ID, fetches real package code from npm and PyPI, runs six role-specific Qwen agents, and saves completed reviews locally.

Implemented today:

- Public GitHub repo lookup and branch selection.
- Dependency file detection for `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `requirements.txt`, and `pyproject.toml`.
- npm direct dependency inspection from `package.json` plus exact versions from `package-lock.json`.
- PyPI dependency inspection from pinned `requirements.txt` and simple `pyproject.toml` dependency strings.
- npm tarball retrieval and selected internal file inspection.
- PyPI sdist/wheel artifact retrieval and selected internal file inspection.
- Static package evidence selection for metadata, manifests, entrypoints, lifecycle/build files, and suspicious source patterns.
- Six real Qwen agent calls with structured verdicts, evidence, confidence, and remediation.
- Review jobs with live package and agent progress.
- Local review history stored in `.locksmith/reviews.json`.
- Guarded npm install CLI using the same core engine, with a standalone HTML report for every fresh decision.

## Product Concept

Locksmith is a Web2-first supply-chain review tool. It is not a wallet, token, staking, or on-chain audit product.

Core surfaces:

| Surface | Current state |
| --- | --- |
| Landing page | Explains the six-agent dependency review flow and guarded installs. |
| `/review` page | Imports a public GitHub repo, chooses a branch, starts a Qwen review, shows package retrieval, agent progress, and final report. |
| `/history` page | Reads local saved reviews and shows prior non-allow findings. |
| CLI | `locksmith npm install ...` resolves and reviews a candidate lockfile before applying the exact approved state. Locksmith is not published on npm yet. |

The deployed demo runs on Alibaba Cloud ECS: [http://47.84.96.197](http://47.84.96.197).
## User Flow

```mermaid
flowchart TD
  A["Developer"] --> B{"Choose surface"}
  B --> C["Web: paste public GitHub repo"]
  B --> D["CLI: guarded npm install"]
  C --> E["Retrieve dependency files"]
  D --> E
  E --> F["Compute dependency state ID"]
  F --> G["Resolve direct npm and PyPI packages"]
  G --> H["Fetch package artifacts"]
  H --> I["Select internal files for evidence"]
  I --> J["Run six Qwen agents"]
  J --> K["Judge returns Allow / Review / Block"]
  K --> L["Save completed review locally"]
  L --> M["View review history"]
```

## System Architecture Flow

```mermaid
flowchart LR
  U[User] -->|provide repo| L[Locksmith]
  L -->|retrieve| G[GitHub]
  G -->|send files| E[Review Engine]
  E -->|fetch| N[npm]
  E -->|fetch| P[PyPI]
  E -->|review| Q[Qwen Agents]
  N -->|evidence| Q
  P -->|evidence| Q
  Q -->|store| S[Local JSON]
```

## Six-Agent Review Panel

| Agent | Implemented role |
| --- | --- |
| Baseline | Identifies package manager, direct dependencies, exact/pinned versions, package inspection coverage, and missing evidence. |
| Manifest | Reviews npm `package.json`, PyPI metadata/build files, repo manifests, lifecycle scripts, build hooks, entrypoints, and purpose mismatch. |
| Static | Reviews selected package files for risky patterns such as `eval`, dynamic `Function`, env access, file access, URLs, `child_process`, `subprocess`, shell execution, and persistence indicators. |
| Behavior | Infers install/runtime behavior from retrieved files and labels it as inferred, not sandbox-observed. |
| Skeptic | Challenges unsupported claims and filters false positives before final judgment. |
| Judge | Resolves the prior findings into `Allow`, `Review`, or `Block` with the smallest remediation. |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, CSS |
| Backend | Next.js API routes on Node.js runtime |
| AI | Qwen through Alibaba Cloud Model Studio's OpenAI-compatible API |
| External data | GitHub REST/raw files, npm registry, npm tarballs, PyPI JSON API, PyPI sdists/wheels |
| Storage | Local JSON file at `.locksmith/reviews.json` |
| CLI | Node.js executable script in `bin/locksmith.mjs` |
| Deployment | Alibaba Cloud ECS, Docker or standalone Next.js output |

## Smart Contracts

This project does not use smart contracts.

## Getting Started

Requirements:

- Node.js 20 or newer
- A Qwen API key from Alibaba Cloud Model Studio

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `QWEN_API_KEY` | Required. Alibaba Cloud Model Studio API key used for real agent analysis. |
| `QWEN_MODEL` | Required. Model name sent to the Qwen API. `.env.example` uses `qwen3.5-flash`. |
| `QWEN_BASE_URL` | Optional OpenAI-compatible endpoint. Defaults to `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`. |

There is no mock mode in the current app. Reviews fail fast when `QWEN_API_KEY` or `QWEN_MODEL` is missing. The deployed instance keeps these values server-side; do not commit them.

## Running Locally

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

## Project Structure

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
├── ALIBABA.md                # Current ECS deployment record and proof notes
├── CLOUD.md                  # ECS deployment runbook
├── SUBMISSION.md             # Hackathon submission requirements
└── README.md
```

## Demo / Screenshots

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

## Roadmap

### Implemented MVP

- Next.js web app.
- Public GitHub repository inspection.
- Branch selection.
- Dependency file detection.
- Dependency state hashing.
- npm direct dependency evidence from package tarballs.
- PyPI pinned dependency evidence from sdists/wheels.
- Six Qwen agent prompts and structured JSON findings.
- Live review job polling.
- Final verdict report.
- Local review history.
- Guarded local npm install command.
- Build and deployment smoke checks; automated test coverage is still to be expanded.

### Current Limitations

- Review jobs are stored in memory, so polling fails after a server restart.
- Review history is local-only JSON, not a team backend.
- History stores non-allow package evidence only, so successful package evidence is not retained in full.
- npm requires `package-lock.json` for exact version inspection; without it, npm packages are marked `Review` as unresolved.
- PyPI support handles pinned/simple dependency strings, not full pip resolver behavior.
- Python package review is capped at 20 packages per scan.
- PyPI wheel parsing is minimal and artifact selection is not platform-aware.
- Behavior analysis is inferred from retrieved files; there is no sandbox execution yet.
- Large package evidence can make later Qwen roles slow or stall.
- The CLI is not published on npm yet; use the repository script or `npm link` during local development.
- Only guarded npm install is in scope. pip and raw scan commands are not MVP surfaces.
- There is no workspace approval layer, policy editor, repo trust file writer, or CI integration yet.
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
| Text description of features/functionality | Completed in this README. |
| Track identification | Completed: Track 3 Agent Society. |
| Optional blog/social post | Not completed. |

## Notes

- Public scans do not equal owner or team approval.
- Local history is useful for the demo, but it is not a team source of truth.
- The deployed ECS instance is a single-node MVP. Review jobs remain in process memory, while review history and package evidence use persistent local `.locksmith/` storage.
- See [`ALIBABA.md`](ALIBABA.md) for the current public deployment record and [`CLOUD.md`](CLOUD.md) for the deployment runbook.
