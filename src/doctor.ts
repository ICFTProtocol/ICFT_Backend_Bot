import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";
import { assertExecutionPrerequisites } from "./keeper.js";

if (!config.operatorPrivateKey) {
  console.log("Dry-run configuration is valid. Add OPERATOR_PRIVATE_KEY only when preparing execution checks.");
  process.exit(0);
}

const account = privateKeyToAccount(config.operatorPrivateKey);
await assertExecutionPrerequisites(account.address);
console.log(`Keeper execution prerequisites passed for ${account.address}.`);
