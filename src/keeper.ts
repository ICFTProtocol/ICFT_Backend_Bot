import pino from "pino";
import { createPublicClient, createWalletClient, getAddress, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { accessControlAbi, borrowerEvents, erc20Abi, lendingPoolAbi, liquidationEngineAbi } from "./abi.js";
import { config } from "./config.js";
import { Store } from "./store.js";

const logger = pino({ name: "icft-keeper" });
const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) });

type Preview = readonly [boolean, Address, bigint, bigint, bigint, bigint, bigint];

export async function createKeeper() {
  const store = await Store.open(config.stateFile, config.startBlock);
  const account = config.operatorPrivateKey ? privateKeyToAccount(config.operatorPrivateKey) : undefined;
  const walletClient = account ? createWalletClient({ account, chain: sepolia, transport: http(config.rpcUrl) }) : undefined;

  if (config.executionEnabled) await assertExecutionPrerequisites(account!.address);

  async function isPoolPaused() {
    return publicClient.readContract({ address: config.lendingPool, abi: lendingPoolAbi, functionName: "paused" });
  }

  async function discoverBorrowers() {
    const latest = await publicClient.getBlockNumber();
    let from = store.nextBlock;
    if (from > latest) return;

    while (from <= latest) {
      const to = from + config.logBatchSize - 1n > latest ? latest : from + config.logBatchSize - 1n;
      const users: Address[] = [];
      for (const event of borrowerEvents) {
        const logs = await publicClient.getLogs({ address: config.lendingPool, event, fromBlock: from, toBlock: to });
        for (const log of logs) {
          const user = log.args.user;
          if (user) users.push(getAddress(user));
        }
      }
      store.addBorrowers(users);
      store.setNextBlock(to + 1n);
      await store.save();
      logger.info({ from: from.toString(), to: to.toString(), discovered: users.length, borrowers: store.borrowers.length }, "indexed borrower events");
      from = to + 1n;
    }
  }

  async function evaluateBorrowers() {
    for (const user of store.borrowers) {
      for (const asset of config.collateralAssets) {
        try {
          const preview = await publicClient.readContract({
            address: config.liquidationEngine,
            abi: liquidationEngineAbi,
            functionName: "previewLiquidation",
            args: [user, asset]
          }) as Preview;
          const [isLiquidatable, collateralAsset, , requiredIcft] = preview;
          if (!isLiquidatable || requiredIcft === 0n) continue;
          await handleCandidate(user, collateralAsset, requiredIcft);
        } catch (error) {
          logger.warn({ err: error, user, asset }, "could not evaluate liquidation preview");
        }
      }
    }
  }

  async function handleCandidate(user: Address, asset: Address, requiredIcft: bigint) {
    const maxRepay = requiredIcft > config.maxIcftPerLiquidation ? config.maxIcftPerLiquidation : requiredIcft;
    if (requiredIcft > config.maxIcftPerLiquidation) {
      store.addCandidate({ user, asset, requiredIcft: requiredIcft.toString(), observedAt: new Date().toISOString(), status: "failed", reason: "required ICFT exceeds configured per-liquidation cap" });
      await store.save();
      logger.warn({ user, asset, requiredIcft: requiredIcft.toString(), cap: config.maxIcftPerLiquidation.toString() }, "liquidation skipped by cap");
      return;
    }

    if (!config.executionEnabled) {
      store.addCandidate({ user, asset, requiredIcft: requiredIcft.toString(), observedAt: new Date().toISOString(), status: "dry-run" });
      await store.save();
      logger.warn({ user, asset, requiredIcft: requiredIcft.toString() }, "dry-run liquidation opportunity");
      return;
    }

    if (await isPoolPaused()) {
      logger.warn({ user, asset }, "liquidation execution skipped because LendingPool is paused");
      return;
    }

    // Re-simulate at the latest chain state immediately before broadcasting.
    const simulation = await publicClient.simulateContract({
      account: account!.address,
      address: config.liquidationEngine,
      abi: liquidationEngineAbi,
      functionName: "executeLiquidation",
      args: [user, asset, maxRepay, config.collateralBeneficiary!]
    });
    const hash = await walletClient!.writeContract(simulation.request);
    logger.info({ hash, user, asset, requiredIcft: requiredIcft.toString() }, "liquidation submitted");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Liquidation transaction reverted: ${hash}`);

    store.addCandidate({ user, asset, requiredIcft: requiredIcft.toString(), observedAt: new Date().toISOString(), status: "submitted", txHash: hash });
    await store.save();
    logger.info({ hash, block: receipt.blockNumber.toString() }, "liquidation confirmed");
  }

  return {
    async runOnce() {
      await discoverBorrowers();
      if (await isPoolPaused()) {
        logger.warn("LendingPool is paused; borrower indexing completed but liquidation evaluation is suspended");
        return;
      }
      await evaluateBorrowers();
    },
    intervalMs: config.pollIntervalMs
  };
}

export async function assertExecutionPrerequisites(operator: Address) {
  const [operatorRole, poolRole] = await Promise.all([
    publicClient.readContract({ address: config.liquidationEngine, abi: liquidationEngineAbi, functionName: "OPERATOR_ROLE" }),
    publicClient.readContract({ address: config.lendingPool, abi: lendingPoolAbi, functionName: "LIQUIDATION_BOT_ROLE" })
  ]);
  const [operatorAuthorized, engineAuthorized, icftBalance, allowance] = await Promise.all([
    publicClient.readContract({ address: config.liquidationEngine, abi: accessControlAbi, functionName: "hasRole", args: [operatorRole, operator] }),
    publicClient.readContract({ address: config.lendingPool, abi: accessControlAbi, functionName: "hasRole", args: [poolRole, config.liquidationEngine] }),
    publicClient.readContract({ address: config.icft, abi: erc20Abi, functionName: "balanceOf", args: [operator] }),
    publicClient.readContract({ address: config.icft, abi: erc20Abi, functionName: "allowance", args: [operator, config.liquidationEngine] })
  ]);
  if (!operatorAuthorized) throw new Error("Operator wallet is missing OPERATOR_ROLE on LiquidationEngine.");
  if (!engineAuthorized) throw new Error("LiquidationEngine is missing LIQUIDATION_BOT_ROLE on LendingPool.");
  if (icftBalance === 0n) throw new Error("Operator wallet has no ICFT to fund liquidations.");
  if (allowance === 0n) throw new Error("Operator wallet has not approved ICFT for LiquidationEngine.");
  logger.info({ operator, icftBalance: icftBalance.toString(), allowance: allowance.toString() }, "execution prerequisites verified");
}
