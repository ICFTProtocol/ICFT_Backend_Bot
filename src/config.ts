import "dotenv/config";
import { getAddress, isAddress, type Address, type Hex } from "viem";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const address = (name: string): Address => {
  const value = required(name);
  if (!isAddress(value)) throw new Error(`${name} must be a valid EVM address.`);
  return getAddress(value);
};

const number = (name: string, fallback: number) => {
  const value = process.env[name];
  const parsed = value ? Number(value) : fallback;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer.`);
  return parsed;
};

export const config = {
  rpcUrl: required("RPC_URL"),
  chainId: number("CHAIN_ID", 11155111),
  icft: address("ICFT_ADDRESS"),
  lendingPool: address("LENDING_POOL_ADDRESS"),
  liquidationEngine: address("LIQUIDATION_ENGINE_ADDRESS"),
  collateralAssets: ["0x0000000000000000000000000000000000000000", address("WBTC_ADDRESS"), address("WSTETH_ADDRESS")] as Address[],
  startBlock: BigInt(number("START_BLOCK", 0)),
  logBatchSize: BigInt(number("LOG_BATCH_SIZE", 2_000)),
  pollIntervalMs: number("POLL_INTERVAL_MS", 15_000),
  stateFile: process.env.STATE_FILE ?? "./data/keeper-state.json",
  executionEnabled: process.env.EXECUTION_ENABLED === "true",
  liveExecutionAcknowledged: process.env.ALLOW_LIVE_TESTNET_EXECUTION === "true",
  operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY as Hex | undefined,
  collateralBeneficiary: process.env.COLLATERAL_BENEFICIARY ? address("COLLATERAL_BENEFICIARY") : undefined,
  maxIcftPerLiquidation: BigInt(process.env.MAX_ICFT_PER_LIQUIDATION ?? "1000") * 10n ** 18n
} as const;

if (config.chainId !== 11155111) throw new Error("This keeper is intentionally locked to Ethereum Sepolia (11155111).");
if (config.executionEnabled && !config.liveExecutionAcknowledged) throw new Error("Set ALLOW_LIVE_TESTNET_EXECUTION=true to enable transaction broadcasting.");
if (config.executionEnabled && (!config.operatorPrivateKey || !config.collateralBeneficiary)) throw new Error("Execution requires OPERATOR_PRIVATE_KEY and COLLATERAL_BENEFICIARY.");
