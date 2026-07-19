# Alibaba Cloud Deployment Record

Last updated: 2026-07-15 (Asia/Kuala_Lumpur)

## Current state

Locksmith is live on Alibaba Cloud ECS in Singapore. Node.js, npm, and Git were
installed through ECS Workbench. The public repository was cloned to
`/opt/locksmith`, dependencies were installed, the production build passed, and
Qwen configuration was written to the server-only `/opt/locksmith/.env` file.
The production server runs on public TCP port 80 under the persistent
`locksmith.service` systemd unit. It passed local and external checks after
startup and remained reachable after a delay. Alibaba Cloud KMS/Secrets Manager
and ApsaraDB RDS PostgreSQL have also been provisioned in Singapore, but the
current application build still uses server-side environment configuration and
local `.locksmith/` JSON storage until those integrations are added to the code.

| Item | Value |
|---|---|
| Service | Alibaba Cloud Elastic Compute Service (ECS) |
| Region | Singapore (`ap-southeast-1`) |
| Instance ID | `i-t4nbosihq8dpwlne6q1u` |
| Instance name | `launch-advisor-20260713` |
| Instance type | `ecs.t6-c1m1.large` |
| Compute | 2 vCPU, 2 GiB RAM |
| Operating system | Ubuntu 24.04 64-bit, security hardened image |
| System disk | 40 GiB ESSD, PL0 |
| Public IP | `47.84.96.197` |
| Public app URL | `http://47.84.96.197` |
| Health URL | `http://47.84.96.197/api/health` |
| Private IP | `172.30.53.172` |
| Network | Default VPC and default vSwitch |
| Maximum bandwidth | 5 Mbps, pay-by-traffic |
| Billing | Pay-as-you-go |
| Automatic renewal | Disabled |
| Automatic release | Disabled |
| Instance status | Running |
| Application status | Live on port 80 via systemd |

## Alibaba Cloud services and implementation status

| Service | Status | Why Locksmith uses it | Current application usage |
|---|---|---|---|
| ECS | Active | Runs the Next.js web app, API routes, review jobs, and CLI-supporting runtime | Production runtime |
| Alibaba Cloud Model Studio (Qwen) | Active | Provides the six specialist-agent model inference used by reviews | Called by `lib/locksmith.ts` through the OpenAI-compatible API |
| KMS 3.0 / Secrets Manager | Provisioned | Centralizes encrypted credentials and supports controlled rotation | Secret `locksmith/qwen-api-key` exists; the app still reads `QWEN_API_KEY` from ECS environment configuration pending SDK and RAM-role wiring |
| ApsaraDB RDS PostgreSQL | Provisioned and running | Provides durable shared persistence for workspace decisions, review history, evidence, and audit records | One Singapore instance is running; repository code still uses local JSON pending the database adapter and schema migration |

### KMS configuration

- Region: Singapore (`ap-southeast-1`)
- KMS instance: `kst-sgp6a5773a1zzizyv5t9l`
- CMK alias: `alias/locksmith`
- CMK key ID: `key-sgp6a5776b4llphsqh9d6`
- Secret name: `locksmith/qwen-api-key`

The secret value is intentionally not recorded in Git or this document.

### RDS configuration

- Engine: PostgreSQL 18.0, Basic Edition
- Storage: Premium ESSD, 10 GB
- Region and zone: Singapore, single-zone deployment
- Network: VPC `vpc-t4nqlkrjz2gtg3q3adfg9`, vSwitch `vsw-t4n8wz4drfiexxkkscee9`
- Port: 5432, restricted to the VPC whitelist
- Service-linked role: `AliyunServiceRoleForRdsPgsqlOnEcs`

The instance endpoint and database credentials are not yet recorded because
the application has not been migrated to RDS.

## Application deployment plan

The repository contains the deployment artifacts:

- `Dockerfile` — standalone Next.js production image.
- `.dockerignore` — excludes secrets, dependencies, and local state.
- `next.config.mjs` — enables Next.js standalone output.
- `/api/health` — lightweight deployment health endpoint.
- `Dockerfile` — container build and startup configuration; ECS runtime notes are in this document.

The intended runtime configuration is:

```text
NODE_ENV=production
PORT=80
QWEN_MODEL=qwen3.5-flash
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_API_KEY=<stored only on ECS; never commit>
DATABASE_URL=<RDS PostgreSQL connection string; stored only on ECS>
DATABASE_SSL=true
```

The web app and CLI share the same review engine. The web app will run on ECS;
the CLI remains a local/project command that can use the same Qwen backend when
configured for it.
