# ICFT Keeper Deployment

The keeper is a continuously running Ethereum Sepolia worker. Do not deploy it to Vercel: Vercel is appropriate for the frontend, not a permanent polling process.

## Home Server

A home server is suitable for the current dry-run Sepolia worker. It needs outbound HTTPS access to the configured RPC only; it does not expose an HTTP API, so no public port, domain, firewall rule, or frontend callback URL is required.

Keep `EXECUTION_ENABLED=false`. Start one process with a persistent `STATE_FILE`, and use a service manager such as systemd, launchd, or Docker restart policies to restart it after a reboot.

## Safe Demo Topology

- **Frontend:** Vercel, public testnet site.
- **Keeper:** one private background worker on Render, Railway, Fly.io, or a team-managed VPS.
- **Mode:** `EXECUTION_ENABLED=false`.
- **State:** a single persistent volume mounted at the configured `STATE_FILE` path, or an accepted reindex on each restart for the demo.

Render background workers are designed for continuously running processes; see the official [Background Worker documentation](https://render.com/docs/background-workers).

## Docker Deployment

Build locally:

```bash
docker build -t icft-keeper .
docker run --rm --env-file .env -v "$(pwd)/data:/app/data" icft-keeper
```

Do not use a real `.env` in a public image, Dockerfile, Git commit, or frontend deployment.

## Hosted Worker Settings

For a Render/Railway/VPS worker, configure:

| Setting | Value |
| --- | --- |
| Runtime | Docker or Node.js 20+ |
| Build command, without Docker | `npm ci && npm run build` |
| Start command, without Docker | `npm start` |
| Service type | Background worker, not web service |
| Instances | Exactly one for the JSON-state demo mode |

Copy the non-secret settings from `.env.example`, then set `EXECUTION_ENABLED=false`. Do not configure `OPERATOR_PRIVATE_KEY` for the public demo worker.

## Preflight

```bash
npm ci
npm run build
npm run check
```

Expected dry-run output confirms configuration validity without a private key. Once deployed, inspect logs for successful event indexing and any `dry-run liquidation opportunity` records.

## Execution Is Explicitly Out of Scope

Do not set `EXECUTION_ENABLED=true` until a separate security review confirms the operator wallet, roles, ICFT funding, allowance, collateral beneficiary, profitability checks, and collateral-settlement process. This version does not sell seized collateral or replenish ICFT automatically.
