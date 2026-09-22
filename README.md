# ICFT Keeper Backend

Restricted liquidation keeper for the ICFT Ethereum Sepolia baseline.

> **Testnet only.** This process can submit liquidation transactions when explicitly enabled. Never use a deployer key, upgrade-admin key, mainnet wallet, or production funds.

## What it does

1. Indexes LendingPool borrower events from `START_BLOCK`.
2. Persists discovered borrowers and the last scanned block in a local JSON state file.
3. Queries `LiquidationEngine.previewLiquidation` for ETH, wBTC, and wstETH.
4. Records liquidation opportunities in dry-run mode by default.
5. When explicitly enabled, re-simulates `executeLiquidation`, broadcasts it, waits for its receipt, and records the hash.

The contracts calculate liquidation eligibility and size. The keeper only discovers opportunities and submits a permitted transaction.

## Quick start

```bash
cp .env.example .env
npm install
npm run check
npm run dev
```

`EXECUTION_ENABLED=false` is the safe default. The bot will index and report candidates but cannot sign or broadcast a transaction.

## Required roles and funds

Before enabling execution:

1. Grant `OPERATOR_ROLE` on `LiquidationEngine` to the dedicated operator wallet.
2. Grant `LIQUIDATION_BOT_ROLE` on `LendingPool` to the `LiquidationEngine` proxy.
3. Fund the operator with Sepolia ETH for gas and sufficient ICFT for liquidations.
4. From the operator wallet, approve ICFT for the `LiquidationEngine` proxy.
5. Set `COLLATERAL_BENEFICIARY` to the treasury or settlement wallet that should receive seized collateral.
6. Run `npm run check` and resolve every failure before allowing execution.

The keeper intentionally does **not** issue ICFT approvals automatically.

## Enabling execution

Only after the role and dry-run tests succeed, set all of these values:

```env
EXECUTION_ENABLED=true
ALLOW_LIVE_TESTNET_EXECUTION=true
OPERATOR_PRIVATE_KEY=0x...
COLLATERAL_BENEFICIARY=0x...
MAX_ICFT_PER_LIQUIDATION=1000
```

`ALLOW_LIVE_TESTNET_EXECUTION=true` is a second deliberate safety gate. The process is locked to chain ID `11155111` and rejects all other chains.

## Operational limits

- This is an MVP restricted operator model, not a permissionless mainnet liquidation network.
- Seized wBTC/wstETH is sent to `COLLATERAL_BENEFICIARY`; this service does not sell collateral through a DEX or replenish ICFT automatically.
- JSON state is appropriate for a single testnet process only. Replace it with Postgres/SQLite plus a job queue before any production operation.
- Run one active process per state file. Multiple instances need a shared lock and database.

## Files

| Path | Purpose |
| --- | --- |
| `src/config.ts` | Validated Sepolia-only environment configuration. |
| `src/abi.ts` | Minimal keeper ABI surface. |
| `src/store.ts` | Atomic JSON state for event cursor and candidates. |
| `src/keeper.ts` | Discovery, preview, simulation, and execution flow. |
| `src/doctor.ts` | Role, ICFT balance, and allowance checks. |
| `OPERATIONS.md` | Deployment and incident runbook. |

## Security rules

- Keep `OPERATOR_PRIVATE_KEY` in a secret manager, never Git or a frontend environment file.
- Use a dedicated minimally privileged operator wallet.
- Do not reuse `DEPLOYER_PRIVATE_KEY`, ProxyAdmin ownership, or governance keys.
- Monitor RPC failures, role changes, ICFT balance, allowance, failed simulations, and submitted transaction receipts.
