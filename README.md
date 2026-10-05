# CardMart

**A trading card marketplace where the payment and the card are both held until the card is proven real.**

Live on Solana devnet: **[cardmarts.vercel.app](https://cardmarts.vercel.app)** · [@cardmartapp](https://x.com/cardmartapp)

---

## The problem

Graded Pokémon and One Piece cards change hands for hundreds to hundreds of
thousands of baht, mostly through Facebook groups, LINE chats and bank
transfers. Buyers pay first and hope. Fake slabs, a real cert number reused
on a different card, and "sold, but never shipped" are everyday losses, and
there is no neutral place to hold the money or the card in between.

## What CardMart does

1. **The seller lists a card** with live camera photos of every required
   view. PSA cert numbers are checked against PSA's database: the grade,
   the card name and the card number all have to match the cert.
2. **The buyer pays into an on-chain escrow** (our own Anchor program). The
   seller can't touch the money yet.
3. **The card goes to our warehouse.** Staff inspect the slab against the
   cert and the listing photos.
4. **Pass:** escrow releases to the seller, and the card's on-chain token
   moves to the buyer. The card is shipped, or kept in the vault and
   resold later without moving it again.
   **Fail:** escrow refunds the buyer in full.

Every step is written to the item's provenance timeline with its transaction
signature, so anyone can audit a card's history.

## What makes it different

- **Escrow that waits for physical proof.** Payment is released by
  inspection, not by a promise to ship.
- **An AI buying agent with hard limits.** Tell it "one PSA 10 Umbreon VMAX
  alt art, up to 20,000 THB". It watches every new listing, checks it's the
  exact card (not a look-alike from another set) at a fair price, and buys
  from its own wallet, or sends the seller an offer. The AI only judges.
  Every price, budget and count limit is enforced in code, and the agent
  wallet's balance is the on-chain spending cap.
- **Prices compared against the exact card.** Each item page compares the
  listing with CardMart sales and eBay listings of the same card, set, card
  number, grader and grade, and shows a "price by grade" ladder (raw,
  PSA 9, PSA 10, and more).
- **Built for Thai collectors first:** prices in baht and a full Thai
  interface, with a local warehouse doing the inspections.

## Business model

- **Buyer protection, 3%** on every Buy Now, accepted offer and agent
  purchase. It pays for escrow and the physical inspection, is sent to the
  platform wallet in the same transaction as the escrow lock (verified
  on-chain by the server), and is refunded if the sale is cancelled.
- **Listing is free:** sellers pay nothing to list; the buyer fee covers
  the inspection that protects both sides.
- **Buying-agent tasks:** a flat 50 THB per task, paid from the agent
  wallet, which covers the AI cost of watching and judging listings.
- **Vault:** cards kept in the vault can be resold instantly, with no
  shipping, which keeps trading volume on CardMart.

## On-chain pieces

| Piece | What it does | Code |
|---|---|---|
| **Escrow program** (Anchor, Rust) | `lock_payment` holds the buyer's SOL in a per-trade PDA; `release_to_seller` / `refund_to_buyer` are signed only by the escrow authority after inspection. The seller is re-checked at release, so payout can't be redirected. Program `FQwLbEBxKw5srEobsCw37c1B7QNkNaRACN5VBvUwWEuC` on devnet. | [`contracts/escrow`](contracts/escrow) |
| **Digital twin NFT** | Each listed card is minted to the seller as a 1-of-1 Metaplex NFT (Token Metadata + master edition, supply fixed at 1). Its name, image, grade, cert, set and card number show in Phantom and other wallets, served from [`/api/nft/[mint]`](app/api/nft/[mint]/route.ts). The seller approves a one-time transfer delegate; the NFT moves to the buyer when escrow releases. | [`lib/web3/token-server.ts`](lib/web3/token-server.ts), [`lib/web3/token-metadata.ts`](lib/web3/token-metadata.ts) |
| **Agent wallets** | One keypair per user (AES-256-GCM encrypted at rest). The user funds it; it signs `lock_payment` on its own, so the agent can buy while the user is away. The platform pays all transaction fees. | [`lib/agent/wallet.ts`](lib/agent/wallet.ts) |
| **Embedded wallets** | Privy sign-in (Google, email, or an existing Phantom/Backpack wallet) creates a Solana wallet for new users, with no seed phrase to manage. | [`components/providers/privy-provider.tsx`](components/providers/privy-provider.tsx) |

## Features

- **Marketplace:** search by name, card number ("umbreon 215"), set, grader
  or grade; filters; fixed-price listings, offers, auctions and card-for-card
  trades.
- **Selling:** guided listing with a live-camera checklist, PSA auto-fill
  and card-number lookup.
- **Trust:** duplicate-cert blocking, PSA name/number matching, photo-reuse
  detection, staff alerts for unknown cards or far-below-market prices, ID
  verification, reviews, disputes.
- **Portfolio and vault:** cards in your hands vs. in our vault, relisting
  without reshipping, redemption, price history, card alerts.
- **Buying agent** (`/agent`): tasks, ask-first or auto-buy, offers, alerts →
  tasks, a 50 THB task fee paid from the agent wallet.
- **Back office** (`/admin`): warehouse inspection queue, grading, shipments,
  disputes, ID review, alerts, on its own domain.

## Try it

1. Open [cardmarts.vercel.app](https://cardmarts.vercel.app) and sign in.
2. Get devnet SOL from [faucet.solana.com](https://faucet.solana.com) (or
   the "Test SOL" button on the agent page).
3. Buy a card. Watch the `lock_payment` transaction on
   [Solana Explorer (devnet)](https://explorer.solana.com/?cluster=devnet),
   then follow it through inspection on the item page.
4. Open **Agent**, pick a card, set a max price, and start a task.

Everything runs on devnet. No real money moves.

## Tech stack

- **App:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS v4
- **Data:** Postgres (Neon) with Prisma 7, Vercel Blob for verification photos
- **Solana:** Anchor 1.1 program, `@solana/kit`, SPL Token, Metaplex Token Metadata, Memo program, Privy embedded wallets
- **AI:** OpenRouter (DeepSeek V4 Flash plans tasks, DeepSeek V4 Pro judges listings), structured JSON output validated with Zod
- **Data sources:** PSA Public API (certs, population), eBay Browse API (exact-match asking prices), TCG API (card catalogue, images, card numbers)

## Repository map

| Path | What's there |
|---|---|
| `app/(app)` | User pages: marketplace, item, listing, portfolio, auctions, agent, market, messages |
| `app/(backoffice)/admin` | Staff back office |
| `lib/actions.ts` | Server Actions: listing, buying, escrow, warehouse, offers, auctions, agent purchases |
| `lib/agent/` | Buying agent: AI chat/judging, matching engine, agent wallets |
| `lib/web3/` | Escrow instructions, token minting, server-side signing |
| `lib/ebay.ts`, `lib/psa.ts`, `lib/card-catalog.ts` | External data, with exact-card matching |
| `lib/listing-checks.ts` | Anti-fraud checks on new listings |
| `contracts/escrow` | The Anchor escrow program and its tests |
| `prisma/schema.prisma` | Data model |

## Running locally

```bash
npm install
cp .env.example .env      # fill in the values; each one is explained there
npx prisma migrate deploy
npx prisma db seed        # demo marketplace data
npm run dev
```

`.env.example` documents every variable: Postgres, Privy, Vercel Blob, the
escrow program and authority key, PSA, eBay, TCG API, OpenRouter and the
agent-wallet secret. Optional integrations switch off cleanly when their key
is missing. To deploy your own escrow program, follow
[`contracts/escrow/README.md`](contracts/escrow/README.md).

## Security notes

- No private keys are in this repository. The program's upgrade authority
  and the escrow authority are separate keys, and the escrow authority lives
  only in server environment variables.
- Staff pages and every staff Server Action check for an admin server-side
  (non-staff get a 404). Deployed builds refuse to run without sign-in
  configured.
- Agent wallet keys are encrypted with `AGENT_WALLET_SECRET` and only
  decrypted server-side to sign purchases within the task's limits.

## License

[MIT](LICENSE)
