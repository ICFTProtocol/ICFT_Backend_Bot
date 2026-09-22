import { createKeeper } from "./keeper.js";

const keeper = await createKeeper();

async function tick() {
  try {
    await keeper.runOnce();
  } catch (error) {
    console.error("keeper cycle failed", error);
  }
}

await tick();
setInterval(() => void tick(), keeper.intervalMs);
