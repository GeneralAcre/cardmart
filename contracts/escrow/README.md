# Proof escrow program

A real Solana program (Anchor/Rust) that holds a buyer's payment in a
per-trade PDA and releases or refunds it on the platform's say-so. This
replaces the simulated, DB-only escrow the rest of the repo used to rely on
for payment custody — see `lib/web3/escrow-program.ts` (client-side
instruction building) and `lib/web3/escrow-server.ts` (server-side
release/refund signing) in the app for how it's wired in.

This directory is a separate Anchor workspace on purpose — it has its own
`Cargo.toml`/`Anchor.toml`, builds independently of the Next.js app, and (see
below) never contains a private key. That separation is what makes it safe
for someone to clone this whole repo: cloning the code gives you the
program's *source*, never control over the *deployed instance* or its funds.

## Security model — two keys, two different powers

| Key | Controls | Where it lives |
|---|---|---|
| **Upgrade authority** | Can redeploy/replace this program's compiled code | Whoever ran `anchor deploy` — a local Solana CLI keypair, never in git |
| **Escrow authority** | Can call `release_to_seller` / `refund_to_buyer` on an existing deployment | A separate keypair, its secret only in the app's `ESCROW_AUTHORITY_SECRET_KEY` env var (Vercel/local `.env`), never in git |

These are deliberately different keys. The escrow authority is used
routinely (every warehouse approval/rejection signs with it, server-side),
so it's the one an attacker would most plausibly target — keeping it
separate means even a fully compromised escrow authority key can only
release/refund *existing* trades, never rewrite the program itself. The
upgrade authority is used once (at deploy time) and then ideally moved to
cold storage or a multisig for a real deployment.

**Neither key is ever committed.** `.gitignore` in this folder blocks
`target/` (where the program's own deploy keypair lands), any
`*-keypair.json`, `id.json`, `deployer.json`, and `.env*`. If you fork this
repo, you inherit the *program source* — you do not inherit any ability to
touch the live devnet program this thesis actually deployed. To stand up
your own instance you deploy your own copy with your own keys, exactly as
described below.

## What it does

- `initialize_config(authority)` — one-time setup. Creates a singleton
  `Config` account recording which pubkey is allowed to release/refund
  trades. Can only succeed once per deployment (`init` constraint).
- `lock_payment(trade_id, amount)` — buyer-signed. Transfers `amount`
  lamports from the buyer into a new PDA (`Trade`, seeded by
  `["trade", buyer, trade_id]`), recording buyer/seller/amount.
- `release_to_seller(trade_id)` — escrow-authority-signed. Pays the trade's
  locked lamports to the seller and closes the account (any leftover rent
  goes back to the buyer).
- `refund_to_buyer(trade_id)` — escrow-authority-signed. Returns the full
  locked balance to the buyer and closes the account.

`seller` isn't part of the PDA seeds, so `release_to_seller` re-validates it
against the value recorded at lock time (`address = trade.seller`) — a
caller can't redirect payout to some other account just by passing a
different `seller` at release time.

## Building and testing

Tests run against [LiteSVM](https://github.com/LiteSVM/litesvm) (an in-process
SVM), not a local validator — fast, and doesn't need `solana-test-validator`
running:

```sh
anchor build   # also produces target/deploy/escrow.so, which the tests load
cargo test
```

`programs/escrow/tests/escrow.rs` covers: lock → release, lock → refund, a
non-authority signer being rejected on release, and a swapped `seller`
account being rejected on release.

## Deploying your own instance

1. **Generate two keypairs** (these stay local, never committed):
   ```sh
   solana-keygen new -o ~/.config/solana/deployer.json       # upgrade authority
   solana-keygen new -o ~/.config/solana/escrow-authority.json # escrow authority
   solana airdrop 2 ~/.config/solana/deployer.json --url devnet
   solana airdrop 1 ~/.config/solana/escrow-authority.json --url devnet
   ```
2. **Deploy the program**, funded/authorized by the deployer keypair:
   ```sh
   anchor build
   solana program deploy target/deploy/escrow.so \
     --program-id target/deploy/escrow-keypair.json \
     --keypair ~/.config/solana/deployer.json \
     --url devnet
   ```
   Note the printed Program Id. Put it in the app's `.env` as
   `NEXT_PUBLIC_ESCROW_PROGRAM_ID` (this is a public address, safe to
   expose to the client — it's what identifies *which* program to talk to,
   not a credential).
3. **Initialize the config** (one time), from the app repo root so it can
   resolve `@solana/kit` from `node_modules`:
   ```sh
   PAYER_KEYPAIR_PATH=~/.config/solana/deployer.json \
   ESCROW_AUTHORITY_SECRET_KEY_PATH=~/.config/solana/escrow-authority.json \
   node scripts/init-escrow-config.mjs
   ```
4. **Copy the escrow authority's secret key** into the app's env as
   `ESCROW_AUTHORITY_SECRET_KEY` — paste the raw contents of
   `escrow-authority.json` (a 64-number JSON array) verbatim. That's the
   only place this secret needs to exist outside the keypair file itself.

If you skip step 3/4, the app's real-escrow code paths simply aren't
configured and every buy/release/refund silently falls back to the old
DB-only simulated flow (see `resolveTxSignature` / `onChain` flags in
`lib/actions.ts`) — nothing breaks, you just don't get real fund custody
until you finish setup.
