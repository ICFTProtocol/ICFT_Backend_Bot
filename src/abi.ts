import { parseAbi, parseAbiItem } from "viem";

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)"
]);

export const accessControlAbi = parseAbi([
  "function hasRole(bytes32 role, address account) view returns (bool)"
]);

export const liquidationEngineAbi = parseAbi([
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function previewLiquidation(address user, address collateralAsset) view returns (bool isLiquidatable, address collateralAsset, uint256 debtUsd, uint256 requiredIcft, uint256 collateralToSeizeAmount, uint256 collateralValueSeizedUsd, uint256 resultingLtvBps)",
  "function executeLiquidation(address user, address collateralAsset, uint256 maxIcftToRepay, address collateralBeneficiary) returns (uint256 repaidIcft, uint256 repaidUsd, uint256 seizedCollateralAmount)"
]);

export const lendingPoolAbi = parseAbi([
  "function LIQUIDATION_BOT_ROLE() view returns (bytes32)"
]);

export const borrowerEvents = [
  parseAbiItem("event DepositCollateral(address indexed user, address indexed asset, uint256 amount, uint256 totalCollateral)"),
  parseAbiItem("event WithdrawCollateral(address indexed user, address indexed asset, uint256 amount, uint256 remainingCollateral)"),
  parseAbiItem("event Borrow(address indexed user, uint256 amountICFT, uint256 addedDebtUSD, uint256 totalDebtUSD)"),
  parseAbiItem("event Repay(address indexed user, uint256 amountICFT, uint256 repaidDebtUSD, uint256 remainingDebtUSD)")
] as const;
