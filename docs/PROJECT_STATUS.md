# CardMart — Project Status Report

**As of:** 25 September 2026 · **Live site:** https://cardmarts.vercel.app · **Repo:** `GeneralAcre/cardmart` (formerly `id-thesis`)

CardMart is a "phygital" marketplace for certified trading cards (PSA / BGS / CGC slabs and raw cards). Every physical card gets a digital twin, a real one-of-one token on Solana devnet. Buyer payments are held in a real on-chain escrow until our warehouse team inspects the physical card and confirms it matches its certificate.

This report covers everything built so far (49 commits, 2 Sep → 25 Sep 2026), what is real and what is simulated, and what is left to do.

---

## 1. Summary

| Area | Status |
|---|---|
| Sign-in (Privy: email + Google) | ✅ Working on the live site |
| Listing a card (Instant Verify with live camera + PSA lookup) | ✅ Done |
| Marketplace (browse, search, filters, trending, price direction) | ✅ Done |
| Buying with escrow (ship or keep in vault) | ✅ Done, real on-chain escrow on devnet |
| Auctions (scheduled, anti-sniping, claim win) | ✅ Done |
| Offers (make / accept / reject / withdraw / complete) | ✅ Done |
| Portfolio (holdings, value chart, SOL wallet, offers, watchlist) | ✅ Done |
| Seller stores, ratings and reviews | ✅ Done |
| Buyer ↔ seller messaging | ✅ Done (polling, not realtime) |
| Notifications (in-app) | ✅ Done |
| Back office (warehouse inspection, vault, grading queue, sellers, alerts) | ✅ Done |
| Digital twin SPL token + on-chain ownership transfer | ✅ Done (devnet) |
| Market price references (PSA, TCG API, eBay) | ✅ Done; some need API keys |
| Landing page EN/TH | ✅ Done (landing page only) |
| Full-Service grading for sellers | ⚠️ Backend and admin queue exist, but sellers can no longer start one |
| Automated tests | ❌ None |
| Production readiness (mainnet, real payments, audit) | ❌ Out of scope for the thesis; see §6 |

---

## 2. Tech stack

- **Frontend / server:** Next.js 16 (App Router, Server Actions), React, TypeScript, Tailwind CSS v4, shadcn/Radix UI, Recharts, Framer Motion, sonner toasts
- **Database:** Postgres (Neon via Vercel) with Prisma 7 (`@prisma/adapter-pg`), 24 migrations, applied automatically on every deploy
- **Auth and wallets:** Privy (`@privy-io/react-auth` 3.42, `@privy-io/server-auth`), with an automatic Solana embedded wallet for every user
- **Blockchain:** Solana **devnet** via `@solana/kit`; our own Anchor/Rust escrow program; SPL tokens for digital twins
- **File storage:** Vercel Blob (verification photos)
- **Hosting:** Vercel (auto-deploys on push to `main`)
- **External data:** PSA Public API, TCG API (tcgapi.dev), eBay Browse API

---

## 3. Features completed

### 3.1 Sign-in and onboarding
- **Privy sign-in**, which replaced the original Auth.js/Google setup and the mock wallet. Email and Google are enabled and working on the live site.
- **Automatic Solana wallet:** every user without a wallet gets a Privy embedded Solana wallet at sign-in.
- **Public landing page at `/`** (hero, features, how it works, EN/TH language switcher). There is no separate `/login` page; the landing page is the only sign-in entry point.
- **Onboarding** (`/onboarding`) collects display name, username, shipping address and phone. The shipping details are needed for every physical shipment. Users can edit them later from Portfolio.
- **Route protection:** `proxy.ts` sends signed-out visitors to `/`. `lib/session.ts` re-checks the session on the server, and sends users with an unfinished profile to `/onboarding`.
- **Login fixes shipped 25 Sep:**
  - Fixed a redirect loop that happened when the browser's Privy session was still valid but the server's cookie had expired.
  - The landing page now only enters the app when the user actually clicks **Login**; it never navigates on its own.
  - Removed the arrow from the Login button.
  - Found and fixed the Privy config problems behind the `invalid_origin` / disabled-method errors: allowed origins, and Google enabled.
- **Demo mode:** if the Privy keys are missing, the app runs as a seeded demo user (`@you`), so it still works without any setup.

### 3.2 Listing a card: Instant Verify (`/listing`)
- A step-by-step flow for **graded slabs** (PSA / BGS / CGC) and **raw / ungraded** cards.
- **Live camera verification:** a guided checklist of views taken with the device camera, with a countdown and auto-advance.
  - Slabs: front, back, label, etc.
  - Raw cards: front, back, corners, surface.
  - Photos upload straight to Vercel Blob.
- **Live PSA lookup:** typing a PSA cert number pulls the real card details (subject, year, brand, card #, grade, population) and pre-fills the form without overwriting anything the seller already typed.
  - A cert that is definitely invalid blocks the listing.
  - If PSA is unreachable, the seller can continue.
- **BGS Black Label** support: a checkbox that only appears at BGS grade 10, shown everywhere the grade is displayed.
- **Real digital twin mint:** creates a real SPL token (0 decimals, supply 1, mint authority revoked), then the seller signs a delegate approval so the platform can transfer it at sale time. If the chain isn't configured, it falls back to a simulated mint.
- **Real on-chain record:** listing, repricing and relisting sign a real Solana devnet Memo transaction from the seller's wallet.
- **Fees:** flat 50 THB listing fee (Self-Mint); flat 150 THB seller shipping cost when an item ships.

### 3.3 Marketplace (`/marketplace`)
- Grid of items that are for sale and have a price. Items mid-sale are hidden rather than shown as unbuyable.
- **Search** by item name, serial, and seller/owner name or handle.
- **Filters:** category, grading company, grade, Black Label, price range, vaulted status.
  - Desktop: sticky filter sidebar.
  - Mobile: filters open in a bottom sheet.
  - A results count and a "Clear filters" action are shown.
- **Trending strip:** the biggest price gains this week, calculated from real price history. It only counts items with real activity in the last 7 days.
- **Price direction:** each card shows whether the price went up (green) or down (red) since its last change.
- Cards show the first real verification photo, a "N views" badge, and a grade/company badge.

### 3.4 Item page (`/item/[id]`)
- **Photo gallery:** the digital twin artwork plus every real verification photo, selectable and zoomable.
- **Certificate block:** grade, cert number, Black Label, mint address and owner.
- **Buy panel:** buy at the asking price with escrow, choosing **ship to me** or **keep in vault**.
- **Make an offer**, and a banner telling the buyer to complete checkout once their offer is accepted.
- **Watch** button (watchlist).
- **Message seller** button.
- **Seller card:** avatar, name, star rating, and a link to the seller's store.
- **Verification and price data:**
  - PSA cert and population data
  - TCG API reference price (raw card, Pokémon/TCG only)
  - eBay asking-price median/low/high (grade-aware), plus a direct link to eBay's sold listings
- **Price history chart** (24h / 7d / 30d) built from real price snapshots. No made-up trend lines.
- **Provenance timeline:** every event in the item's life (minted, listed, escrow locked, inspected, shipped, transferred, etc.). Events that really happened on-chain link to Solana Explorer.
- **Similar listings** and a **same-card price comparison**.
- **Owner-only controls:** list for sale, start an auction.
- **Leave a review** appears only after a completed purchase (escrow released), one review per purchase.

### 3.5 Buying and escrow
- **Real on-chain escrow program** (`contracts/escrow`, Anchor/Rust, deployed to devnet, program ID `FQwLbEBxKw5srEobsCw37c1B7QNkNaRACN5VBvUwWEuC`).
  - Instructions: `initialize_config`, `lock_payment`, `release_to_seller`, `refund_to_buyer`.
  - The buyer's payment is locked in a separate PDA for each trade.
  - The upgrade authority and escrow authority are separate keys, and neither is in the repo.
- **Flow:**
  1. The buyer signs `lock_payment` from their wallet.
  2. The seller ships the card to our warehouse.
  3. The warehouse inspects it.
  4. The escrow authority either releases the payment to the seller and transfers the SPL token to the buyer, or refunds the buyer.
- **Vaulted items** transfer ownership instantly (the card is already in our vault).
- **Safety rule:** if a trade really holds on-chain funds and the release or refund call fails, the action stops with an error. The database is never marked "complete" while the funds are still locked on-chain.
- Prices are in THB and converted to SOL at a **fixed demo rate of 5,000 THB/SOL**.

### 3.6 Auctions (`/auctions`, `/auctions/[id]`)
- The owner starts an auction: start price ≥ 100 THB, 1–14 days, and it can be **scheduled up to 30 days ahead**.
- Minimum bid increment is 50 THB.
- **Anti-sniping:** a bid in the last 5 minutes extends the auction by 5 minutes.
- Live countdown and bid history.
- Outbid, auction-starting (sent to watchers) and auction-won notifications.
- A seller can cancel only while there are **no bids**.
- **Settlement:**
  - An expired auction with no bids closes itself automatically the next time anyone views it.
  - The winner **claims** the item by signing the same escrow payment as a normal purchase.

### 3.7 Offers
- A buyer offers a price (≥ 100 THB, optional message) on a fixed-price listing. One pending offer per buyer per item.
- The seller accepts or rejects it from Portfolio (Offers panel); the buyer can withdraw it.
- Once an offer is accepted, the buyer completes checkout at the offered price with the same escrow flow.
- Notifications are sent for received, accepted and rejected offers.

### 3.8 Portfolio (`/portfolio`)
- **Profile header:** avatar, name, handle, real devnet SOL balance, and a **total portfolio value chart** built from real price snapshots.
- **Wallet:**
  - **Deposit:** copy your address, or request a real devnet faucet airdrop.
  - **Withdraw:** a real SOL transfer signed by the Privy wallet, with a MAX button.
- **My items:**
  - "In my hands" vs "In the vault".
  - Reprice, delist or relist items.
  - Redeem a vaulted item (have it shipped to you).
  - Start an auction.
- **Offers panel** (received and sent), **watchlist** tab, edit profile, edit shipping info.

### 3.9 Seller stores, ratings, reviews (`/store/[id]`)
- Seller identity, wallet address with a copy button, aggregate star rating.
- Tabs: current listings, **sold history** (from completed escrows), and reviews (buyer name, stars, comment, item bought).
- Ratings come only from real completed purchases.

### 3.10 Messaging (`/messages`, `/messages/[id]`)
- Direct buyer ↔ seller conversations, started from "Message seller" on item and store pages.
- Inbox, thread view, and an unread badge in the header. Opening a thread marks it read.
- New messages appear by **polling** (the page refreshes while the tab is visible). It is not realtime.

### 3.11 Notifications
- An in-app notification bell for users and a separate staff alert feed for admins.
- Types: item sold, item purchased, inspection passed, grading complete, price drop on a watched item, outbid, auction starting, auction won, auction ended, offer received / accepted / rejected.
- Staff alerts: new submission, duplicate cert attempt (fraud flag).
- In-app only; no email or push notifications.

### 3.12 Back office (`/admin/warehouse`, staff only)
- **Inbound queue:** compare what the seller declared with the official certificate data (serial, company, grade).
  - Actions: approve and ship to buyer, approve into the vault, or reject and refund.
  - Bulk approve/reject. Bulk approve still re-checks each item and skips any that don't match.
  - The buyer's shipping address is shown inline.
- **Grading submissions queue:** mark at grading company (single or bulk), complete grading (mints the asset, Black Label supported), reject.
- **Vault inventory:** a physical shelf/location field for each vaulted item.
- **Alerts:** the staff notification feed.
- **Seller management:** listing, sale and rating counts for each seller, plus a reversible **account suspension**. Suspended users can't list, buy, bid or make offers.
- **Recently resolved:** a history of decisions.
- Every admin page and every admin Server Action is checked with `requireAdmin()`.

### 3.13 Supporting pieces
- **QA verify API** (`POST /api/verify`): read-only endpoint for a separate internal QA tool.
  - It checks a serial against PSA's live database and our own records.
  - Protected by a shared key (`QA_VERIFY_API_KEY`).
- **Listings read API** (`/api/listings`) used by the marketplace, and a **Blob upload API** (`/api/blob/upload`).
- **Footer contact form** (saved to the database), **Terms** and **Privacy** pages.
- **Mobile:** bottom tab navigation, responsive header and wallet, tabs without visible scrollbars.
- **Brand:** renamed Provenance → Proof → **CardMart**. Black/white theme with brand green `#aacc00` (success/price up) and red `#bf0603` (destructive/price down).
- **Performance:** database indexes on the hottest marketplace queries; the Privy profile is fetched only on first sign-up rather than on every page load; images served through `next/image`.
- **Demo data:**
  - `prisma/seed.ts`: 4 demo sellers and 9 items. It wipes the app tables.
  - `scripts/seed-trending-demo.ts`: adds price history so Trending has content. It never deletes anything.

---

## 4. What's real vs simulated

The app falls back to a simulated version whenever the real service isn't configured, so a demo never breaks.

| Feature | Real when… | Otherwise |
|---|---|---|
| Sign-in | Both Privy keys are set | Everyone acts as the demo user `@you` |
| Escrow payment | `NEXT_PUBLIC_ESCROW_PROGRAM_ID` and `ESCROW_AUTHORITY_SECRET_KEY` are set and both users have wallets | Database-only escrow with a simulated signature |
| Digital twin token and transfer | Escrow authority is configured and the item has a mint address and transfer approval | Simulated transfer |
| On-chain memos (list/reprice/relist/grading) | The user has a real wallet | Simulated signature; the timeline doesn't link to Explorer |
| PSA verification | `PSA_API_TOKEN` is set | Seller's declared data is trusted |
| TCG reference price | `TCG_API_KEY` is set | Not shown |
| eBay reference price | `EBAY_APP_ID` + `EBAY_CERT_ID` are set | Only the eBay sold-listings link is shown |

**Always simulated / demo only:**
- The THB↔SOL rate is fixed.
- Everything runs on Solana **devnet** with test SOL.
- There is no real payment gateway.
- Shipping is tracked by status only; there is no courier integration.

---

## 5. What's left to do

### 5.1 Config / accounts (no code needed; can be done now)
1. **Privy dashboard, login methods:**
   - The login popup shows **Twitter, Discord and Wallet**, but these are **disabled** in Privy. Solana wallet login is also off; only Ethereum is enabled.
   - Either enable them (User management → Authentication), or we remove them from `components/providers/privy-provider.tsx` so users don't see buttons that fail.
2. **Privy production upgrade:** the Privy app is still in *development mode*, using Privy's shared Google credentials.
   - Before real users sign in: create our own Google OAuth client (redirect URI `https://auth.privy.io/api/v1/oauth/callback`).
   - Then click *Upgrade to production*.
   - Also consider turning on **HttpOnly cookies** (currently off).
3. **Vercel environment variables:**
   - `DATABASE_URL`, `NEON_AUTH…_URL` and `POSTGRES_URL_NO_SSL` show **"Needs Attention"**. Check what the badge says; most likely they should be marked Sensitive and the Neon password rotated.
   - Confirm every optional key is set on Vercel: `ESCROW_*`, `PSA_API_TOKEN`, `TCG_API_KEY`, `EBAY_APP_ID`/`EBAY_CERT_ID`, `QA_VERIFY_API_KEY`, `BLOB_READ_WRITE_TOKEN`. **eBay keys are not in the local `.env` either**, so eBay pricing is currently off.
4. **Admin accounts:** only the seeded demo user is an admin. To give a real teammate staff access, set `isAdmin = true` on their `User` row in the database. There is no UI for this.
5. **GitHub:** the repo was renamed to `GeneralAcre/cardmart`. Update local remotes with `git remote set-url origin https://github.com/GeneralAcre/cardmart.git`.

### 5.2 Product gaps (code)
1. **Full-Service grading has no way in.**
   - The seller form was removed when the verify flow moved to `/listing`. The server action (`submitForGrading`, 1,500 THB package: 300 shipping + 1,000 grading + 200 minting) and the admin grading queue still exist, but nothing calls the action.
   - Decide: restore the seller option, or remove the backend and admin tab.
2. **Unclaimed auction wins never close.** If the winning bidder never claims, the auction stays "ended but unsettled" and the item is stuck.
   - Needs a claim deadline, then either an offer to the second-highest bidder or a return to the seller.
   - Bids are also not backed by locked funds until the claim.
3. **Unfinished work on the main developer's machine (not committed):**
   - A new `components/marketplace/price-compare-table.tsx` that isn't used by any page yet.
   - A restyled "Back to Marketplace" button on the item page.
4. **No admin view for contact-form messages.** They are saved to the `ContactMessage` table, but staff can only read them in the database.
5. **Messaging is polling-based.** Realtime (websocket / Pusher / Supabase Realtime) would be an upgrade.
6. **Notifications are in-app only.** No email or push notifications yet.
7. **Thai translation covers the landing page only.** The rest of the app is English.
8. **README is out of date.** It still describes Auth.js, Google OAuth env vars and a `/login` page. It should be rewritten for Privy, escrow and the current page list; this report can be the basis.

### 5.3 Quality
1. **No automated tests.** Priorities:
   - The escrow / ownership-transfer Server Actions
   - Auction bidding and anti-sniping
   - Offer state transitions
   - Anchor program tests for `lock_payment` / `release_to_seller` / `refund_to_buyer`
2. **No CI** beyond Vercel's build. Add lint + typecheck + tests on pull requests.
3. **Bid race condition:** two simultaneous top bids aren't guarded by a database lock. This is acceptable at demo scale but should be noted in the thesis.

---

## 6. Known limitations (for the thesis write-up)
- **Devnet only:** everything runs on Solana devnet with test SOL, using a fixed 5,000 THB/SOL rate. Mainnet would need a real price oracle or payment gateway.
- **Escrow program not audited.** A single platform-held escrow authority key releases and refunds trades, so this is custodial trust in the platform.
- **Market price references are approximate:**
  - PSA's API has **no pricing endpoint**.
  - TCG API prices raw cards only.
  - eBay's self-serve API returns **asking** prices, not sold prices. Sold-price data needs eBay's restricted Marketplace Insights API.
  - Our own price history is real, but only covers price changes made on CardMart.
- **Physical side is status-only:** warehouse inspection, vault storage and shipping are manual processes recorded in the app, with no courier or tracking integration.
- **Categories:** the platform was scoped down to TCG. The Amulet category was removed; sports cards and comics exist in the data model.

---

## 7. How to run locally
```bash
npm install
# copy .env.example to .env and fill in DATABASE_URL, DIRECT_URL, Privy keys, BLOB_READ_WRITE_TOKEN (others optional)
npx prisma migrate dev
npx prisma db seed            # demo sellers and items (wipes app tables)
npx tsx scripts/seed-trending-demo.ts   # optional: populate Trending
npm run dev                   # http://localhost:3000
```
Deploying: push to `main`. Vercel runs `prisma generate && prisma migrate deploy && next build`.

---

## 8. Timeline

| Date | Milestone |
|---|---|
| 2 Sep | Initial marketplace (Phase 1), SQLite → Postgres for Vercel |
| 3 Sep | Separate marketplace page, raw/ungraded cards |
| 15 Sep | Privy auth + real wallets, real PSA verification, TCG-only scope, Blob photo storage |
| 16–17 Sep | Devnet SOL balance, deposit/withdraw, public landing page, mobile nav, TCG API price, seller stores |
| 18 Sep | Real verification photos, ratings and reviews, on-chain memo mint, price-history and portfolio-value charts |
| 19 Sep | Reprice/delist, watchlist, on-chain escrow program, shipping info in onboarding, UX pass |
| 21 Sep | Back office (notifications, vault locations, seller management, bulk actions), eBay pricing, QA API, DB indexes, Trending |
| 22 Sep | Real SPL digital-twin tokens, EN/TH landing, BGS Black Label, auctions and offers |
| 23 Sep | Scheduled auctions, landing refinements |
| 25 Sep | Rebrand to CardMart, messaging, brand green/red, price direction on cards, login fixes |
