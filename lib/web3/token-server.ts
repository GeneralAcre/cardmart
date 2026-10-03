import "server-only";
// Real SPL Token digital twin: a decimals-0 mint with a fixed supply of 1,
// minted and (later) moved entirely by the platform's escrow authority — see
// contracts/escrow/README.md's key model and lib/web3/authority-server.ts.
//
// No custom Anchor program here (unlike lib/web3/escrow-program.ts's real
// SOL escrow) — @solana-program/token's stock instructions are enough, and
// avoiding a new program means no new devnet deploy is needed. The one real
// design problem — the platform needs to move a token out of the seller's
// own wallet at settlement time, when the seller isn't present to sign —
// is solved with SPL's own delegation instructions (ApproveChecked/Revoke,
// built client-side in lib/web3/token-program.ts) instead of a bespoke vault:
// the seller delegates the escrow authority as an approved spender over
// their token when they list, and the authority spends that approval at
// settlement, exactly mirroring how it already signs escrow release/refund.
import { address, createNoopSigner, type Instruction } from "@solana/kit";
import { generateKeyPair } from "@solana/keys";
import { getAddressFromPublicKey } from "@solana/addresses";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getMintSize,
  getInitializeMint2Instruction,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getMintToInstruction,
  getTransferCheckedInstruction,
} from "@solana-program/token";

import { getEscrowAuthorityAddress, rpc, signAndSend } from "@/lib/web3/authority-server";
import { getCreateNftMetadataInstructions, nftMetadataUri } from "@/lib/web3/token-metadata";

const DECIMALS = 0;
const SUPPLY = BigInt(1);

/**
 * Mints a brand-new 1-of-1 digital twin token directly into `ownerAddress`'s
 * associated token account, as a Metaplex NFT named `name` (see
 * lib/web3/token-metadata.ts) so wallets show the card. Entirely
 * authority-signed — the owner (seller) doesn't need to be present or sign
 * anything at mint time. The master edition takes over the mint authority in
 * the same transaction, so the supply of 1 is fixed forever.
 */
export async function mintDigitalTwinToken(opts: {
  ownerAddress: string;
  name: string;
}): Promise<{ mintAddress: string; txSignature: string }> {
  const authorityAddress = await getEscrowAuthorityAddress();
  if (!authorityAddress) throw new Error("Escrow authority is not configured.");
  const authority = address(authorityAddress);
  const owner = address(opts.ownerAddress);

  const mintKeyPair = await generateKeyPair();
  const mintAddress = await getAddressFromPublicKey(mintKeyPair.publicKey);
  const mint = address(mintAddress);

  const [ownerAta] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });

  const space = BigInt(getMintSize());
  const lamports = await rpc.getMinimumBalanceForRentExemption(space).send();

  const instructions: Instruction[] = [
    getCreateAccountInstruction({
      payer: createNoopSigner(authority),
      newAccount: createNoopSigner(mint),
      lamports,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMint2Instruction({
      mint,
      decimals: DECIMALS,
      mintAuthority: authority,
      // Metaplex requires one to create a master edition, which then takes it
      // over along with the mint authority; nothing ever freezes a twin.
      freezeAuthority: authority,
    }),
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: createNoopSigner(authority),
      owner,
      mint,
    }),
    getMintToInstruction({
      mint,
      token: ownerAta,
      mintAuthority: createNoopSigner(authority),
      amount: SUPPLY,
    }),
    ...(await getCreateNftMetadataInstructions({
      mint,
      authority,
      name: opts.name,
      uri: nftMetadataUri(mintAddress),
    })),
  ];

  const txSignature = await signAndSend(instructions, authorityAddress, [mintKeyPair]);
  return { mintAddress, txSignature };
}

/**
 * Moves the 1-of-1 token from `fromAddress`'s token account to
 * `toAddress`'s (created idempotently in the same transaction, so the buyer
 * never has to do anything to receive it). Only valid while the platform
 * still holds a live delegate approval over the seller's token account —
 * callers are responsible for checking `Asset.transferApproved` first.
 */
export async function transferDigitalTwinToken(opts: {
  mintAddress: string;
  fromAddress: string;
  toAddress: string;
}): Promise<string> {
  const authorityAddress = await getEscrowAuthorityAddress();
  if (!authorityAddress) throw new Error("Escrow authority is not configured.");
  const authority = address(authorityAddress);
  const mint = address(opts.mintAddress);
  const from = address(opts.fromAddress);
  const to = address(opts.toAddress);

  const [fromAta] = await findAssociatedTokenPda({ owner: from, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const [toAta] = await findAssociatedTokenPda({ owner: to, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });

  const instructions: Instruction[] = [
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: createNoopSigner(authority),
      owner: to,
      mint,
    }),
    getTransferCheckedInstruction({
      source: fromAta,
      mint,
      destination: toAta,
      authority: createNoopSigner(authority),
      amount: SUPPLY,
      decimals: DECIMALS,
    }),
  ];

  return signAndSend(instructions, authorityAddress);
}

/**
 * Whether the platform can move this twin out of `ownerAddress`'s wallet: the
 * owner holds it and has approved the escrow authority as delegate for it
 * (the seller's listing approval). Read from the chain, so a client can't
 * just claim it. Returns null when the RPC can't answer.
 */
export async function isTransferDelegated(opts: { mintAddress: string; ownerAddress: string }): Promise<boolean | null> {
  const authority = await getEscrowAuthorityAddress();
  if (!authority) return false;
  try {
    const { value } = await rpc
      .getTokenAccountsByOwner(
        address(opts.ownerAddress),
        { mint: address(opts.mintAddress) },
        { encoding: "jsonParsed", commitment: "confirmed" },
      )
      .send();
    return value.some((account) => {
      const info = (account.account.data as { parsed?: { info?: TokenAccountInfo } }).parsed?.info;
      return (
        info?.tokenAmount?.amount === SUPPLY.toString() &&
        // A twin held in the platform's own wallet (custody, e.g. the demo
        // sellers' cards) needs no delegation: the authority signs as owner.
        (opts.ownerAddress === authority ||
          (info.delegate === authority && BigInt(info.delegatedAmount?.amount ?? "0") >= SUPPLY))
      );
    });
  } catch {
    return null;
  }
}

type TokenAccountInfo = {
  tokenAmount?: { amount?: string };
  delegate?: string;
  delegatedAmount?: { amount?: string };
};

/**
 * Whether `ownerAddress` currently holds this 1-of-1 digital twin on-chain.
 * Redeem uses it to tell apart "the owner must sign a real burn" (the token
 * is in their wallet) from legacy assets whose earlier transfer was only
 * simulated, so the real token never reached this owner and there is
 * nothing in their wallet to burn. Returns null when the RPC can't answer.
 */
export async function isDigitalTwinHeldBy(opts: { mintAddress: string; ownerAddress: string }): Promise<boolean | null> {
  try {
    const { value } = await rpc
      .getTokenAccountsByOwner(address(opts.ownerAddress), { mint: address(opts.mintAddress) }, { encoding: "jsonParsed" })
      .send();
    return value.some((account) => {
      const data = account.account.data as { parsed?: { info?: { tokenAmount?: { amount?: string } } } };
      return data.parsed?.info?.tokenAmount?.amount === SUPPLY.toString();
    });
  } catch {
    return null;
  }
}
