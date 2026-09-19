#!/usr/bin/env node
// One-time setup for the escrow program in contracts/escrow: creates the
// program's singleton Config account and records which pubkey is allowed to
// release/refund trades from then on (the "escrow authority" — see
// contracts/escrow/README.md for why that's a different key from the
// program's upgrade authority).
//
// Run once per deployment, from the app repo root (so it can resolve
// @solana/kit etc. from node_modules here):
//
//   PAYER_KEYPAIR_PATH=~/.config/solana/deployer.json \
//   ESCROW_AUTHORITY_SECRET_KEY_PATH=~/.config/solana/escrow-authority.json \
//   node scripts/init-escrow-config.mjs
//
// PAYER_KEYPAIR_PATH just funds the one-time account-creation rent and can
// be any funded devnet wallet (the deployer wallet is a reasonable choice).
// ESCROW_AUTHORITY_SECRET_KEY_PATH is the keypair whose PUBLIC key becomes
// the on-chain authority — its secret half is what you later paste into the
// app's ESCROW_AUTHORITY_SECRET_KEY env var for lib/web3/escrow-server.ts.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
  AccountRole,
} from "@solana/kit";
import { createKeyPairFromBytes } from "@solana/keys";
import { getAddressFromPublicKey } from "@solana/addresses";

function expandHome(p) {
  return p.startsWith("~") ? p.replace("~", homedir()) : p;
}

function loadKeypairBytes(path) {
  return Uint8Array.from(JSON.parse(readFileSync(expandHome(path), "utf8")));
}

const PROGRAM_ID = address(
  process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID ??
    (() => {
      throw new Error("Set NEXT_PUBLIC_ESCROW_PROGRAM_ID first (see contracts/escrow README).");
    })(),
);
const SYSTEM_PROGRAM_ID = address("11111111111111111111111111111111");
const rpc = createSolanaRpc("https://api.devnet.solana.com");

const payerPath = process.env.PAYER_KEYPAIR_PATH ?? "~/.config/solana/deployer.json";
const authorityPath = process.env.ESCROW_AUTHORITY_SECRET_KEY_PATH;
if (!authorityPath) {
  throw new Error("Set ESCROW_AUTHORITY_SECRET_KEY_PATH to the keypair file whose pubkey should be the escrow authority.");
}

const payerKeyPair = await createKeyPairFromBytes(loadKeypairBytes(payerPath));
const payerAddress = await getAddressFromPublicKey(payerKeyPair.publicKey);

const authorityBytes = loadKeypairBytes(authorityPath);
const authorityKeyPairForPubkey = await createKeyPairFromBytes(authorityBytes, true);
const authorityAddress = await getAddressFromPublicKey(authorityKeyPairForPubkey.publicKey);

const [config] = await getProgramDerivedAddress({ programAddress: PROGRAM_ID, seeds: ["config"] });

// Borsh args for initialize_config(authority: Pubkey): just the 32 raw bytes.
const discriminator = Uint8Array.of(208, 127, 21, 1, 194, 190, 196, 70);
const addressEncoder = getAddressEncoder();
const data = new Uint8Array(8 + 32);
data.set(discriminator, 0);
data.set(addressEncoder.encode(authorityAddress), 8);

const instruction = {
  programAddress: PROGRAM_ID,
  accounts: [
    { address: payerAddress, role: AccountRole.WRITABLE_SIGNER },
    { address: config, role: AccountRole.WRITABLE },
    { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
  ],
  data,
};

const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
const message = pipe(
  createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayer(payerAddress, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  (m) => appendTransactionMessageInstruction(instruction, m),
);
const compiled = compileTransaction(message);
const signed = await signTransaction([payerKeyPair], compiled);
const wireTransaction = getBase64EncodedWireTransaction(signed);

await rpc.sendTransaction(wireTransaction, { encoding: "base64", preflightCommitment: "confirmed" }).send();

console.log("Config PDA:", config);
console.log("Escrow authority:", authorityAddress);
console.log("Signature:", getSignatureFromTransaction(signed));
console.log(
  "\nNext: paste the contents of",
  authorityPath,
  "into this app's ESCROW_AUTHORITY_SECRET_KEY env var.",
);
