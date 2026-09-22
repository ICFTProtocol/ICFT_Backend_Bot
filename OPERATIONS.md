# Keeper Operations Runbook

## First dry run

1. Set `EXECUTION_ENABLED=false`.
2. Configure deployed Sepolia addresses and `START_BLOCK`.
3. Run `npm run check`; without an operator key it validates dry-run configuration only.
4. Run `npm run dev` and inspect `data/keeper-state.json` plus logs.
5. Create a deliberately unhealthy **test-only** position and confirm a `dry-run liquidation opportunity` is logged.

## Execution rehearsal

1. Use a new operator wallet, not a deployer or admin wallet.
2. Grant required roles and fund the operator with test ICFT and Sepolia ETH.
3. Set an explicit collateral beneficiary controlled by the test operations team.
4. Run `npm run check`; verify role, balance, and allowance values.
5. Set both execution gates to `true` only for the rehearsal.
6. Confirm the submitted hash on Sepolia Etherscan and reconcile received collateral at the beneficiary.
7. Return both execution flags to `false` after the rehearsal.

## Incident response

- **Unexpected candidate:** keep execution disabled, inspect oracle prices and call `previewLiquidation` manually.
- **Simulation failure:** do not retry blindly; record the revert and re-check role, allowance, pause state, and current preview.
- **RPC outage:** keep execution disabled until the provider is healthy and indexed cursor catches up.
- **Operator key concern:** stop the process, revoke `OPERATOR_ROLE`, replace the wallet, and update the secret manager.
- **Wrong beneficiary:** stop execution immediately; do not attempt ad hoc recovery without a reviewed operational plan.

## Production prerequisites not implemented here

- Database-backed leases and high-availability workers.
- DEX settlement, slippage limits, and inventory replenishment.
- Profitability and gas strategy.
- Alerts, metrics, audit logs, and dashboards.
- Multisig or MPC operational policy, key rotation, and incident authority.
