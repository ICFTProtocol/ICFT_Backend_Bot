import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getAddress, isAddress, type Address } from "viem";

type Candidate = { user: Address; asset: Address; requiredIcft: string; observedAt: string; status: "dry-run" | "submitted" | "failed"; txHash?: string; reason?: string };
type KeeperState = { lastScannedBlock: string; borrowers: Address[]; candidates: Candidate[] };

const initial = (block: bigint): KeeperState => ({ lastScannedBlock: block.toString(), borrowers: [], candidates: [] });
const normalizeAddress = (value: string): Address => getAddress(value.toLowerCase() as Address);

export class Store {
  private state: KeeperState;
  private constructor(private readonly file: string, state: KeeperState) { this.state = state; }

  static async open(file: string, startBlock: bigint) {
    try {
      const parsed = JSON.parse(await readFile(file, "utf8")) as KeeperState;
      const borrowers = [...new Set((parsed.borrowers ?? [])
        .filter((borrower): borrower is Address => isAddress(borrower))
        .map((borrower) => normalizeAddress(borrower)))];

      const store = new Store(file, {
        lastScannedBlock: parsed.lastScannedBlock,
        borrowers,
        candidates: parsed.candidates ?? []
      });
      // Persist canonical casing so the same wallet never becomes multiple candidates.
      await store.save();
      return store;
    } catch {
      return new Store(file, initial(startBlock));
    }
  }

  get nextBlock() { return BigInt(this.state.lastScannedBlock); }
  get borrowers() { return this.state.borrowers; }

  addBorrowers(users: Address[]) {
    this.state.borrowers = [...new Set([...this.state.borrowers, ...users].map(normalizeAddress))];
  }

  setNextBlock(block: bigint) { this.state.lastScannedBlock = block.toString(); }

  addCandidate(candidate: Candidate) {
    this.state.candidates = [candidate, ...this.state.candidates].slice(0, 200);
  }

  async save() {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify(this.state, null, 2));
    await rename(temporary, this.file);
  }
}
