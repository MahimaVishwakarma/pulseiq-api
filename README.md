# ⚡ PulseIQ — API

AI-native email warmup & inbound lead intelligence platform. This is the **backend** (NestJS 10 + Prisma + PostgreSQL + Redis/BullMQ). The frontend lives in the **pulseiq** (web) repo.

![NestJS 10](https://img.shields.io/badge/NestJS-10-e0234e) ![Prisma 6](https://img.shields.io/badge/Prisma-6-2d3748) ![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-336791) ![License: MIT](https://img.shields.io/badge/License-MIT-green)

## Features

- **Warmup engine** — daily cron + BullMQ workers ramp up sending volume, log results, update inbox health scores
- **Campaign engine** — multi-step sequences (email/delay/condition/task) with personalization tokens
- **Lead intelligence** — intent scoring, signals, notes, deals, bulk import
- **AI module** — Claude-powered copilot with workspace context, email rewrite, A/B variants, spam scoring, insights
- **Domain verification** — live SPF/DKIM/DMARC/MX lookups via DNS
- **Auth** — Clerk token exchange → JWT; **demo mode** bypasses auth in dev so you can run without any Clerk keys
- **Billing** — Stripe subscriptions with webhook-driven plan tiers
- Swagger docs at `/api/docs`

## Quickstart

Requirements: Node 20+, Docker Desktop.

```bash
npm install
cp .env.example .env          # defaults work for local dev; API keys optional
docker compose up -d          # PostgreSQL 16 + Redis 7
npx prisma migrate dev        # create schema
npx prisma db seed            # demo workspace, 8 inboxes, 8 leads, 4 campaigns
npm run start:dev             # http://localhost:4000
```

Then start the **pulseiq** web app — it points at `http://localhost:4000/api/v1` out of the box.

### Demo mode (no keys needed)

The seed creates a workspace with the fixed ID **`demo-workspace`** and user **`demo-user`**. In non-production, requests scoped to that workspace bypass JWT auth entirely, so the full app works with zero credentials.

### Optional API keys

| Key | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | AI Copilot, email rewrite, spam scoring, insights |
| `CLERK_SECRET_KEY` | Real authentication |
| `STRIPE_SECRET_KEY` | Billing & subscriptions |
| `AWS_*` / SMTP | Actually sending warmup email |

Everything else (dashboard, inboxes, leads, campaigns, domains, analytics) runs on seeded data with no keys.

## API shape

All routes are under `/api/v1` and workspace-scoped:

```
GET  /workspaces/:wsId/inboxes            POST /workspaces/:wsId/inboxes/:id/pause
GET  /workspaces/:wsId/leads              POST /workspaces/:wsId/leads/:id/notes
GET  /workspaces/:wsId/campaigns          POST /workspaces/:wsId/campaigns/:id/launch
GET  /workspaces/:wsId/domains            POST /workspaces/:wsId/domains/:id/verify
GET  /workspaces/:wsId/analytics/dashboard
POST /workspaces/:wsId/ai/copilot
```

Responses are wrapped as `{ "success": true, "data": ..., "timestamp": ... }`. Full docs: `http://localhost:4000/api/docs`.

## Project structure

```
prisma/           # schema + seed (demo workspace)
src/
  common/         # guards (JWT, workspace), interceptors, filters, utils
  modules/        # auth, workspaces, inboxes, warmup, campaigns, leads,
                  # ai, billing, domains, analytics, prisma
```

## Contributing

Issues and PRs welcome. Run `npx tsc --noEmit` before submitting.

## License

MIT — see [LICENSE](LICENSE).
