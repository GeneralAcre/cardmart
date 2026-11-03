# CardMart: Thesis Progress by Week

CardMart is a marketplace for certified trading cards (Pokémon and One Piece; PSA, BGS and CGC slabs and ungraded cards). Every physical card gets a digital twin on Solana, and the buyer's payment waits in an on-chain escrow until the card is checked.

This log lists what was built for each thesis session, taken from the project's commit history (226 commits, 2 September to 3 November 2026). Each session covers the work done since the session before it, including that day. The two group thesis sessions are covered in more detail.

**Live site:** https://cardmarts.vercel.app

---

## At a glance

| Date | Session | Main result |
|---|---|---|
| 5 Aug | Thesis Idea | The idea: a trusted marketplace for graded cards, with a digital twin for every physical card |
| 12 Aug to 26 Aug | Thesis Checks #1 to #3 | Research and planning (no code in the repository yet) |
| 2 Sep | Thesis Check #4 | First working version: listing, marketplace, item page, portfolio, warehouse check |
| **9 Sep** | **Group Thesis #1** | **Database online for deployment, own marketplace page, ungraded cards, landing page** |
| 16 Sep | Thesis Check #5 | Real sign-in and wallets (Privy), PSA certificate check, real SOL balance |
| 23 Sep | Thesis Check #6 | On-chain listing, escrow program, digital twin tokens, back office, auctions, Thai language |
| 30 Sep | Thesis Check #7 | Rebrand to CardMart, messaging, KYC, leaderboard, price comparison, AI buying agent |
| **7 Oct** | **Group Thesis #2** | **Every card a real NFT, buyer protection fee, safer escrow, wallet login, agent as a chat, new landing page** |
| 14 Oct | Thesis Check #8 | eBay market prices, FAQ, compare by picture, item page tabs |
| 21 Oct | Thesis Check #9 | Card indexes, profit and loss, light mode, rarity, guest browsing, security fixes, design system |
| 28 Oct | Thesis Check #10 | Auctions grid, Rewards (XP), currency switch, new logo, set releases, two-pane messages |
| After 28 Oct | Since the last check | Profile cover and bio, badges, Just sold ticker, own sign-in window, market banner, page tours |

---

## 5 August: Thesis Idea

The project started from one problem: buying expensive graded cards online is risky. Buyers can't be sure the card is real, matches its certificate, or will arrive at all. The idea was a "phygital" marketplace where:

- every physical card has a one-of-one digital twin token that records its history
- the buyer's money is held in escrow until the card is inspected
- prices are compared with real market data, so buyers know whether a price is fair

## 12 August to 26 August: Thesis Checks #1 to #3

These weeks went on research and planning: the target users (collectors, sellers), the trust problems in today's card trading, the choice of Solana for the digital twin and escrow, and the first design of the app's screens and data. No code was committed to the repository during these weeks.

## 2 September: Thesis Check #4

**First working version (Phase 1)**, built on Next.js with a database of users, cards and trades:

- Listing a card, with a verification page
- A browse page and an item detail page
- A portfolio page for the cards you own
- A first warehouse page for staff to inspect incoming cards
- Moved the database from SQLite to Postgres so the app could be deployed

---

## 9 September: Group Thesis #1

**Where the project stood:** a working prototype that could be deployed, with the basic buy-and-sell flow in place. Sign-in and the wallet were still placeholders.

**Work this week:**

- **Marketplace on its own page:** browsing moved off the home page to a dedicated marketplace, with a new neutral cream and black colour palette.
- **Ungraded cards:** the listing flow ("Self-Mint") was extended beyond graded slabs to raw, ungraded cards, verified by camera photos alone.
- **Landing page:** a hero section for the home page.
- **Interface fixes** across the existing pages.

**What came next:** real sign-in, real wallets and real certificate checks in place of the mock versions.

---

## 16 September: Thesis Check #5

- **Real sign-in with Privy** (email and Google) replaced the mock login, and every user automatically gets a Solana wallet.
- **PSA certificate check:** a seller's certificate number is checked against PSA.
- **Simpler onboarding:** just a name and a username.
- **Real SOL balance** from the Solana devnet shown on the portfolio.
- Fixes for the Vercel build, the wallet address display and the camera capture.

## 23 September: Thesis Check #6

The busiest stretch of the build: the on-chain parts became real.

- **Real PSA data** (card details and population) fills in the listing form and the item page.
- **Public landing page** for signed-out visitors; mobile bottom navigation.
- **SOL deposit and withdraw**, plus portfolio value and price history charts.
- **Seller store pages, ratings and reviews.**
- **Listing is an on-chain transaction**, and the **digital twin is a real SPL token**.
- **Our own escrow program** on Solana devnet (written in Anchor/Rust): the buyer's payment is locked until the card is checked.
- **Watchlist**, reprice and delist.
- **Back office for staff:** notifications, vault locations, seller management, bulk actions.
- **Market price feeds** (TCG API, eBay) and **BGS Black Label** grading.
- **First version of auctions.**
- **English and Thai** on the landing page.

## 30 September: Thesis Check #7

- **Rebrand to CardMart**, with brand green and red for price moves.
- **Buyer and seller messaging.**
- **Price comparison** across CardMart, eBay, TCGplayer and others, plus price insights and rankings.
- **Identity verification (KYC)** with a live ID photo and a selfie, reviewed by staff.
- **Card alerts** ("notify me when listed"), card-for-card **swaps**, and **redeem** (the token is burned when the physical card is taken out).
- **Leaderboard** of top traders, a **market heatmap** and a **set release calendar**.
- **Scope set to Pokémon and One Piece**, with official card images.
- **The whole app in Thai.**
- Staff tools moved to a **separate back office** on its own domain.
- **Sellers must ship sold cards** by a deadline, or the buyer is refunded automatically.
- **AI buying agent:** it shops for a card within the user's limits, from its own wallet.
- Selling moved inside the Marketplace ("Sell a card").
- A project status report was written for the team.

---

## 7 October: Group Thesis #2

**Where the project stood:** a full marketplace (listing, buying with escrow, auctions, offers, messaging, KYC, leaderboard, AI agent) running on Solana devnet, in English and Thai.

**Work this week (1 to 7 October):** making the blockchain side trustworthy from end to end.

- **Every listed card is a real NFT.** Digital twins are minted as Metaplex NFTs, so they show up in a wallet, and the NFT actually moves to the buyer when the card sells.
- **Safer escrow:**
  - Every sale, bid and trade is recorded only after its escrow lock is confirmed on-chain.
  - A card can be sold only once its NFT can really move.
  - Rejected payments are refunded.
  - Auctions settle with the winning bid's lock and move the NFT to the winner.
- **3% buyer protection fee**, paid on-chain together with the escrow lock.
- **Solana wallet login** (such as Phantom), alongside email and Google; payments come from the wallet the user signed in with.
- **Checking listings:** mislabelled and fake listings are stopped earlier, and prices are compared against the exact card and card number.
- **Buying agent:**
  - It became a chat that only uses CardMart's own data.
  - It has a task fee, offers, and reports on what it did.
- **Messages** can carry photos, shared cards and offers.
- **Community menu** (Leaderboard and News), and a card language filter on the market.
- **Escrow transparency:** a security contact is built into the program, with instructions to verify the deployed version.
- **New landing page** with a moving wall of cards and a "what we do" section.
- An end-to-end devnet purchase test, an MIT license, and a rewritten README.

**What came next:** real market prices for every card, and tools that help traders judge value.

---

## 14 October: Thesis Check #8

- **Market price from eBay** for every card: a price box, daily price history, and matching of Japanese and promo cards.
- **Landing page:** "What's your card really worth?", a feature showcase and a closing call to action. A preview image appears when the link is shared.
- **FAQ page.**
- **Bid steps** for auctions (set by the seller), and the auction list.
- **Item page tabs**; **compare cards by picture**, also from the market grid.
- A shorter header: the wallet and the language switch moved into the profile menu.

## 21 October: Thesis Check #9

- **Card indexes:** a CardMart index plus Pokémon and One Piece indexes that follow the top 50 cards by value, each with its own page (ranked cards, movers, statistics).
- **Portfolio profit and loss**, sales history, and donut charts by game and grade.
- **Trader tools on card pages** and a backend for the leaderboard.
- **Light mode** and shareable sale receipts.
- **Card rarity** (SAR, AR, SR, UR, SEC, RR, R, U/C) shown everywhere.
- **Guests can browse the marketplace** without signing in.
- **Settings page**, **profile photo upload**, and a podium for the leaderboard.
- **Security fixes:**
  - Upgraded Next.js.
  - Escrow locks can't be reused.
  - The connection to Solana now checks the user's session.
  - Photo links must come from our own storage.
  - Safer API key checks and validation of listing input.
- **Design system pass:** shared tags, colours that meet the AA contrast standard, matching listing and portfolio cards, and one breadcrumb style.

## 28 October: Thesis Check #10

- **Auctions grid** with search, sort and filters.
- **Rewards page:** XP levels and tasks earned from real activity, and a Top Tier Seller badge.
- A **100-card catalogue demo import**; a paged market grid that loads faster.
- **Set filter** with type-to-search.
- **Display currency switch:** THB, USD or SOL.
- **Warehouse slab photos**, plus certificate links for BGS and CGC.
- **Card page:** a clearer price and Buy now area; the ship-or-vault choice moved into the Confirm Purchase dialog, which also shows the wallet balance.
- **New CardMart wordmark logo.**
- **New set releases** as a grid of tiles with a countdown, grouped by month.
- **Messages as two panes** on desktop.

---

## Since the last check (29 October to 3 November)

- **Profiles:** a cover photo (a CardMart cover by default), a bio and a bigger picture. Users can build more than one "My Index".
- **Badges:** 18 badges earned from real activity, an Achievements button, and the user's level shown next to their name.
- **Rewards page redesigned:** a level medal, a level road, and tasks shown as cards with Go buttons.
- **Just sold ticker:** the latest real sales, each compared with the market price.
- **Our own sign-in window** (email code, Google and Solana wallets) instead of Privy's.
- **Market banner carousel:** search first, then news (set drops, #1 in each index, new listings, a live auction).
- **Page tours:**
  - The first time someone opens a main page, a guided tour explains it.
  - For key features (selling, indexes, auctions, profile photo, banner and bio), signed-in users have to try the feature to go on. They can skip only when they can't, such as having no card to auction.
  - Each tour gives XP on the Rewards page.

---

## Technology

| Part | What we use |
|---|---|
| App | Next.js 16, React, TypeScript, Tailwind CSS |
| Database | Postgres (Neon) with Prisma |
| Sign-in and wallets | Privy (email, Google, Solana wallets) |
| Blockchain | Solana devnet: our own Anchor escrow program, Metaplex NFTs for digital twins |
| Market data | PSA, eBay, TCG API |
| AI buying agent | A language model through OpenRouter |
| Hosting | Vercel (deploys on every push) |
