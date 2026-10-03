// End-to-end devnet check of a demo-card purchase, using the same escrow and
// NFT code the site runs (lib/web3/*), with a throwaway buyer wallet instead
// of a Privy one:
//
//   1. buyer signs lock_payment (price → escrow PDA) + the 3% fee, one tx
//   2. the server-side checks the site runs: lock and fee verified on-chain,
//      platform approved to move the NFT
//   3. platform moves the NFT to the buyer and releases escrow to the seller
//   4. confirms on-chain: buyer holds the NFT, escrow account closed
//   5. buyer sends the NFT back to platform custody, so the demo card stays
//      buyable on the site (the database is never touched)
//
// The buyer key is a throwaway devnet key in a local file (first arg); fund
// its address with ~1 devnet SOL first. Defaults to the cheapest demo card.
//
//   npx tsx scripts/e2e-devnet-purchase.ts <buyer-key-file> [mintAddress]
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const explorer = (kind: "tx" | "address", id: string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;

async function main() {
  const [keyFile, mintArg] = process.argv.slice(2);
  if (!keyFile) throw new Error("Usage: npx tsx scripts/e2e-devnet-purchase.ts <buyer-key-file> [mintAddress]");

  const kit = await import("@solana/kit");
  const { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS } =
    await import("@solana-program/token");
  const { getEscrowAuthorityAddress, rpc } = await import("../lib/web3/authority-server");
  const { buildLockPaymentInstruction, buildServiceFeeInstruction, randomTradeId } = await import("../lib/web3/escrow-program");
  const { verifyEscrowLock, verifyServiceFee } = await import("../lib/web3/escrow-verify");
  const { releaseTradeToSeller } = await import("../lib/web3/escrow-server");
  const { isDigitalTwinHeldBy, isTransferDelegated, transferDigitalTwinToken } = await import("../lib/web3/token-server");
  const { buyerFeeThb, thbToLamports } = await import("../lib/pricing");

  const buyer = await kit.createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(Buffer.from(readFileSync(keyFile, "utf8").trim(), "hex")));
  const platform = (await getEscrowAuthorityAddress())!;

  const asset = await prisma.asset.findFirstOrThrow({
    where: mintArg
      ? { mintAddress: mintArg }
      : { mintAddress: { not: null }, forSale: true, vaulted: true, redeemedAt: null, priceThb: { not: null } },
    orderBy: { priceThb: "asc" },
    include: { owner: { select: { handle: true, walletAddress: true } } },
  });
  const mint = asset.mintAddress!;
  const seller = asset.owner.walletAddress!;
  const price = thbToLamports(asset.priceThb!);
  const fee = thbToLamports(buyerFeeThb(asset.priceThb!));
  const sol = (l: bigint) => (Number(l) / 1e9).toFixed(4);
  const balance = async (a: string) => (await rpc.getBalance(kit.address(a)).send()).value;

  console.log(`Card: ${asset.name} — ${asset.priceThb} THB = ${sol(price)} SOL + ${sol(fee)} SOL fee`);
  console.log(`NFT:  ${explorer("address", mint)}`);
  const buyerStart = await balance(buyer.address);
  console.log(`Buyer ${buyer.address} has ${sol(buyerStart)} SOL`);
  if (buyerStart < price + fee + BigInt(10_000_000)) throw new Error("Fund the buyer with ~1 devnet SOL first.");

  // Before: the platform holds the NFT and counts as approved to move it.
  console.log(`Seller holds NFT: ${await isDigitalTwinHeldBy({ mintAddress: mint, ownerAddress: seller })}, can move: ${await isTransferDelegated({ mintAddress: mint, ownerAddress: seller })}`);

  // 1. Buyer pays: fee + lock_payment in one transaction (what buy-panel signs).
  const tradeId = randomTradeId();
  const { instruction: lockIx, tradeAccount } = await buildLockPaymentInstruction({ buyer: buyer.address, seller, tradeId, lamports: price });
  const feeIx = buildServiceFeeInstruction({ buyer: buyer.address, platform, lamports: fee });
  const sendAsBuyer = async (instructions: Parameters<typeof kit.appendTransactionMessageInstructions>[0]) => {
    const { value: bh } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    const message = kit.pipe(
      kit.createTransactionMessage({ version: 0 }),
      (m) => kit.setTransactionMessageFeePayerSigner(buyer, m),
      (m) => kit.setTransactionMessageLifetimeUsingBlockhash(bh, m),
      (m) => kit.appendTransactionMessageInstructions(instructions, m),
    );
    const signed = await kit.signTransactionMessageWithSigners(message);
    await rpc.sendTransaction(kit.getBase64EncodedWireTransaction(signed), { encoding: "base64", preflightCommitment: "confirmed" }).send();
    const signature = kit.getSignatureFromTransaction(signed);
    for (let i = 0; i < 60; i++) {
      const status = (await rpc.getSignatureStatuses([signature]).send()).value[0];
      if (status?.err) throw new Error(`${signature} failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
      await new Promise((r) => setTimeout(r, 700));
    }
    throw new Error(`${signature} did not confirm`);
  };
  const lockSig = await sendAsBuyer([feeIx, lockIx]);
  console.log(`1. Paid into escrow: ${explorer("tx", lockSig)}`);

  // 2. The server's checks (same functions completePurchase calls).
  const lock = { tradeId: tradeId.toString(), txSignature: lockSig, lamports: price.toString(), tradeAccount };
  await verifyEscrowLock(lock, { buyer: buyer.address, seller, minLamports: price });
  await verifyServiceFee(lock, { buyer: buyer.address, platform, minLamports: fee });
  console.log("2. Server verified the escrow lock and the fee on-chain");

  // 3. Instant vault settlement: NFT to buyer, escrow to seller.
  const transferSig = await transferDigitalTwinToken({ mintAddress: mint, fromAddress: seller, toAddress: buyer.address });
  console.log(`3a. NFT sent to buyer: ${explorer("tx", transferSig)}`);
  const releaseSig = await releaseTradeToSeller({ buyer: buyer.address, seller, tradeId });
  console.log(`3b. Escrow released to seller: ${explorer("tx", releaseSig)}`);

  // 4. Check the result on-chain.
  const buyerHolds = await isDigitalTwinHeldBy({ mintAddress: mint, ownerAddress: buyer.address });
  const tradeClosed = !(await rpc.getAccountInfo(kit.address(tradeAccount)).send()).value;
  console.log(`4. Buyer holds NFT: ${buyerHolds}; escrow account closed: ${tradeClosed}; buyer spent ${sol(buyerStart - (await balance(buyer.address)))} SOL`);
  if (!buyerHolds || !tradeClosed) throw new Error("Purchase did not settle correctly.");

  // 5. Put the card back in custody so it stays buyable on the site.
  const nftMint = kit.address(mint);
  const [fromAta] = await findAssociatedTokenPda({ owner: buyer.address, mint: nftMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const [toAta] = await findAssociatedTokenPda({ owner: kit.address(seller), mint: nftMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const backSig = await sendAsBuyer([
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: buyer, owner: kit.address(seller), mint: nftMint }),
    getTransferCheckedInstruction({ source: fromAta, mint: nftMint, destination: toAta, authority: buyer, amount: BigInt(1), decimals: 0 }),
  ]);
  console.log(`5. NFT returned to custody: ${explorer("tx", backSig)} (held by seller again: ${await isDigitalTwinHeldBy({ mintAddress: mint, ownerAddress: seller })})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
