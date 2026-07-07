# Alibaba Cloud Deployment Plan

## Goal

Deploy Locksmith's backend and web UI on Alibaba Cloud for the hackathon proof requirement in `SUBMISSION.md`.

The proof needs to show that the backend is running on Alibaba Cloud and that the project uses Qwen Cloud services/APIs.

## Recommended Deployment

Use **Alibaba Cloud ECS** for the MVP.

ECS is the smallest reliable deployment for the current codebase because Locksmith is a Next.js app with Node.js API routes, local `.locksmith/` review/cache files, and in-memory review jobs. Those assumptions fit a persistent VM without changing the app.

## Services Used

| Service | Purpose | Required |
| --- | --- | --- |
| Alibaba Cloud ECS | Runs the Next.js frontend and backend API routes | Yes |
| ECS Security Group | Opens public HTTP access to the app | Yes |
| Qwen Cloud / DashScope Model Studio | Runs the six Qwen review agents through the OpenAI-compatible API | Yes |
| Public IPv4 or EIP | Gives the deployed app a public URL/IP for judges | Yes |
| Alibaba Cloud DNS | Friendly domain name instead of raw IP | Optional |
| ACR | Container registry if we later deploy with Docker images | Optional |
| OSS or RDS | Durable review/evidence storage for production | Optional, not MVP |

## Why ECS Instead Of Vercel

Vercel would host the app, but it would not satisfy the proof that the backend is running on Alibaba Cloud.

With ECS, the public app runs directly on Alibaba Cloud. Judges can open the ECS public URL, and the proof recording can show the ECS instance, SSH terminal, app process, and Locksmith calling Qwen Cloud.

## Why ECS Instead Of Function Compute

Function Compute is better for pay-per-use workloads, but the current app assumes:

- Node.js server runtime
- in-memory review job state in `lib/reviewJobs.ts`
- local files under `.locksmith/` for review history and package evidence

Function Compute would need extra work to move state to OSS/RDS/Tair and make jobs durable. ECS avoids that for the hackathon MVP.

## Public Link

Yes. An ECS deployment can have a public link people can use.

The simplest form is:

```text
http://<ecs-public-ip>:3000
```

For a cleaner demo, use Nginx on the ECS instance so people can visit:

```text
http://<ecs-public-ip>
```

or attach a domain:

```text
https://locksmith.example.com
```

This means Vercel is not needed for the hackathon proof.

## Runtime Configuration

Set these environment variables on the ECS instance:

```bash
QWEN_API_KEY=your-qwen-cloud-key
QWEN_MODEL=qwen3.5-flash
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
NODE_ENV=production
PORT=3000
```

The Qwen API usage is implemented in `lib/locksmith.ts`. The public example config is in `.env.example`.

## ECS Configuration

Use a small pay-as-you-go instance for the proof.

Suggested MVP settings:

- Region: same or near the Qwen/DashScope endpoint region; Singapore/AP-Southeast is reasonable for `dashscope-intl.aliyuncs.com`.
- Image: Ubuntu LTS or Alibaba Cloud Linux.
- CPU/RAM: 2 vCPU / 2-4 GB RAM.
- Disk: 40 GB system disk is enough.
- Network: public IPv4 or EIP enabled.
- Security Group:
  - allow SSH `22` from your IP only
  - allow HTTP `80` from `0.0.0.0/0`
  - allow HTTPS `443` from `0.0.0.0/0` if using TLS
  - allow `3000` from `0.0.0.0/0` only if skipping Nginx

## Deployment Steps

SSH into the ECS instance:

```bash
ssh root@<ecs-public-ip>
```

Install Node.js 22, clone the repo, and run:

```bash
npm ci
npm run build
npm run start
```

For a persistent process, use `systemd` or `pm2`.

Minimal `systemd` shape:

```ini
[Unit]
Description=Locksmith Next.js app
After=network.target

[Service]
WorkingDirectory=/opt/locksmith
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=QWEN_MODEL=qwen3.5-flash
Environment=QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
EnvironmentFile=/opt/locksmith/.env
ExecStart=/usr/bin/npm run start
Restart=always

[Install]
WantedBy=multi-user.target
```

Keep `QWEN_API_KEY` in `/opt/locksmith/.env`, not in Git.

## Optional Nginx Proxy

Use Nginx if we want the app on port `80`:

```nginx
server {
  listen 80;
  server_name _;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Proof Recording Checklist

Record a short proof video separate from the product demo:

1. Show Alibaba Cloud ECS console with the running instance.
2. Show the instance public IP.
3. SSH into the instance.
4. Run `pwd`, `git remote -v`, and `npm run start` or `systemctl status locksmith`.
5. Open `http://<ecs-public-ip>` or `http://<ecs-public-ip>:3000`.
6. Start a Locksmith review from the web UI.
7. Show the review progressing through the six agents.
8. Show the code path that calls Qwen Cloud: `lib/locksmith.ts`.
9. Show `.env.example` with `QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`.

## Cost Notes

ECS is not purely usage-based. A pay-as-you-go ECS instance is charged while the server/resources are active, plus possible disk, public IP, and outbound traffic charges.

Qwen Cloud API usage is separate and is charged when reviews call the model.

For the hackathon, keep the ECS instance small, record proof, keep it live only as long as needed for judging, then stop or release unused resources.

## Future Production Upgrade

After the MVP proof, move local state out of the ECS filesystem:

- Store review history and evidence in Alibaba Cloud RDS or Table Store.
- Store package artifacts or larger evidence blobs in OSS.
- Use ACR + SAE or ACK if containerized deployment becomes useful.
- Add HTTPS with a real domain and certificate.
