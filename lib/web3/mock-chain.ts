// Phase 2 seam: every function here stands in for a Solana Anchor program
// call (mint, transfer, escrow account). Keeping the signatures narrow and
// synchronous-looking-but-async now means the real implementation can drop
// in behind the same call sites without touching business logic.

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randomBase58(length: number) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += BASE58_ALPHABET[Math.floor(Math.random() * BASE58_ALPHABET.length)];
  }
  return out;
}

/** Mocks a Solana transaction signature (88 base58 chars). */
export function mockTxSignature(): string {
  return randomBase58(88);
}

/** Mocks a Solana public key / mint address (44 base58 chars). */
export function mockPublicKey(): string {
  return randomBase58(44);
}

/** Phase 2: replaced by an Anchor `mint_digital_twin` instruction. */
export async function mockMintDigitalTwin(assetSerial: string) {
  await new Promise((r) => setTimeout(r, 150));
  return {
    mintAddress: mockPublicKey(),
    txSignature: mockTxSignature(),
    memo: `digital-twin:${assetSerial}`,
  };
}

/** Phase 2: replaced by an Anchor `transfer_ownership` instruction. */
export async function mockTransferOwnership(assetId: string, toUserId: string) {
  await new Promise((r) => setTimeout(r, 150));
  return {
    txSignature: mockTxSignature(),
    memo: `transfer:${assetId}:${toUserId}`,
  };
}

/** Phase 2: replaced by an Anchor escrow program (lock/release/refund). */
export async function mockEscrowInstruction(
  kind: "lock" | "release" | "refund",
  assetId: string,
) {
  await new Promise((r) => setTimeout(r, 150));
  return {
    txSignature: mockTxSignature(),
    memo: `escrow:${kind}:${assetId}`,
  };
}
