# Proof — Collectibles Marketplace & Digital Twin Vault

Phase 1 (Web2) implementation of a phygital TCG marketplace: a physical
escrow + digital twin vault for certified trading cards (PSA / BGS / CGC).
Ownership is reconciled by a warehouse team that inspects the physical
item's serial number and slab authenticity against the grading company's
official database.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Prisma 7 + Postgres (`@prisma/adapter-pg` driver adapter) — works with Neon, Vercel Postgres, Supabase, or any hosted/local Postgres
- **Auth.js v5** with the Google provider and database-backed sessions (`@auth/prisma-adapter`) — real sign-in, not mocked
- Server Actions for mutations, Route Handlers for the marketplace read API
- shadcn-style UI primitives (Radix UI + `class-variance-authority`), Framer Motion, sonner toasts, Zustand
- Mock Web3 wallet + mock Solana transaction signatures (`lib/web3/`) — Phase 2 swaps these for real Anchor program calls behind the same interfaces

## Getting started

Get a Postgres database — the easiest path is Vercel's dashboard:
**Storage tab → Create Database → Postgres (Neon)**, then copy both
connection strings it gives you (or `vercel env pull .env` if the project is
already linked): the pooled one → `DATABASE_URL`, the direct/unpooled one →
`DIRECT_URL` (see `.env.example`). Any other Postgres works too — for a
single local instance, both vars can just point to the same URL.

```bash
npm install
# put DATABASE_URL and DIRECT_URL in .env (see .env.example)
npx prisma migrate dev   # applies the schema
npx prisma db seed       # seeds 4 demo marketplace participants and 9 assets
```

### Set up Vercel Blob (required — stores verification photo files)

Verification photos (live-camera captures from the Self-Mint flow) upload
directly from the browser to Vercel Blob storage; Postgres only stores the
resulting URL. From the Vercel dashboard: **Storage tab → Create Database →
Blob**, then copy the token it gives you into `.env` (or
`vercel env pull .env` if the project is already linked):

```
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

### Set up the PSA Public API (optional — enables real cert verification)

PSA listings can be checked against PSA's actual Cert Verification database
instead of trusting the seller's self-declared data — both when a PSA item
is listed (`/verify`) and when the warehouse inspects an inbound package
(`/admin/warehouse`). Register at
[psacard.com/publicapi](https://www.psacard.com/publicapi), agree to the API
End User Agreement, and generate a bearer token, then add it to `.env`:

```
PSA_API_TOKEN="..."
```

Without this token, PSA verification is skipped entirely and the app falls
back to mirroring the seller's declared data (the original Phase 1
behavior) — nothing breaks either way.

PSA's public API has no pricing/price-guide endpoint at all (confirmed
against their live API spec), so it can never show a market value — see the
next section for where that comes from instead.

### Set up TCG API (optional — reference market price for trading cards)

Item pages for TRADING_CARD listings show a reference market price sourced
from [tcgapi.dev](https://tcgapi.dev) (TCGPlayer data via their free tier).
Register with an email + password, verify the email, then create an API key
and add it to `.env`:

```
TCG_API_KEY="tcg_live_..."
```

Two things worth knowing: it's Pokemon/TCG-specific (no sports cards or
comics), and it prices the **raw/ungraded** card — there's no PSA/BGS
grade-tier pricing in the data, so a graded slab is typically worth more
than the number shown. The item page labels it as a reference price for
exactly this reason. Free tier is 100 requests/day; lookups are cached for
6 hours per query to stay well under that. Without this key, no reference
price is shown — nothing else is affected.

### Set up eBay's Browse API (optional — live market reference, every category)

Every item page also shows an "eBay Market Reference" card, sourced from
[eBay's Buy Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html).
Unlike TCG API above, this covers sports cards and comics too, not just
Pokemon, and the search query is grade-aware (e.g. searches "Charizard VMAX
PSA 10", not just "Charizard VMAX"). Register a free **Production** keyset at
[developer.ebay.com/my/keys](https://developer.ebay.com/my/keys) — this is
self-serve, no approval wait like PSA — and add the App ID / Cert ID to `.env`:

```
EBAY_APP_ID="..."
EBAY_CERT_ID="..."
```

One thing worth knowing: eBay's self-serve Browse API only returns **active
listings**, not sold prices — real sold-comp data lives behind eBay's
Marketplace Insights API, which is limited-release and needs a separate
approval from eBay. So the median/low/high shown here are honestly labeled
as current asking prices, not sold prices. The item page also always links
straight to eBay's own sold/completed-listings search (`LH_Sold=1`) for a
real, verifiable sold-price reference — that link needs no API key at all,
so it shows up even without these two variables set.

### Set up Google sign-in (required — the whole site is gated behind it)

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID (application type **Web application**).
2. Add an authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (add your production URL's equivalent later).
3. Copy the Client ID and Client Secret into `.env`:
   ```
   AUTH_GOOGLE_ID="your-client-id"
   AUTH_GOOGLE_SECRET="your-client-secret"
   ```
   `AUTH_SECRET` is already generated for local dev in `.env` — replace it for production (`openssl rand -base64 32`).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to
`/login`. Sign in with Google, then `/onboarding` collects your display name,
username, shipping address, and phone (needed for physical fulfillment)
before you can use the site. The 4 seeded personas (Nattapong, Araya, Chalit,
and "Kade Anuwat") are separate marketplace participants populating listings
and history — your real Google account starts with an empty Portfolio, like
any new user.

Re-run `npx prisma db seed` at any time to reset the demo marketplace data
(it does **not** touch your own account/session — only the app-domain
tables get wiped and recreated).

## Pages

- `/login`, `/onboarding` — Google sign-in and first-time profile setup (gated by `proxy.ts` for every other route)
- `/` — marketplace grid with live search/filtering (grading company, grade, price range, vaulted status)
- `/verify` — get an item onto the platform: **Self-Mint** (you hold the slab; verify it yourself with a live camera capture checklist) or **Full-Service Grading** (ship a raw item out to be graded, platform covers shipping + grading fee + minting)
- `/item/[id]` — product detail, live verification photo gallery, provenance timeline, buy-with-escrow flow (ship vs. keep-in-vault)
- `/portfolio` — owned digital twins, split by "physical in my hands" vs. "physical in warehouse vault", plus Full-Service grading submission tracking, with relist/redeem actions
- `/admin/warehouse` — inbound inspection queue comparing seller-declared vs. official certificate data, plus the Full-Service grading queue, with approve-ship / approve-vault / reject / complete-grading actions

## Deploying to Vercel

1. Import the repo in Vercel, then add a Postgres database from the
   **Storage** tab and connect it to the project — this injects `DATABASE_URL`
   and its unpooled counterpart into the project's environment automatically.
   Make sure that unpooled one is also set as `DIRECT_URL` (Vercel's Neon
   integration may name it `DATABASE_URL_UNPOOLED` — add a second env var
   `DIRECT_URL` pointing at the same value).
2. Add a Blob store from the **Storage** tab too and connect it to the
   project — this injects `BLOB_READ_WRITE_TOKEN` automatically.
3. Add `AUTH_SECRET` in the project's Environment Variables (generate one
   with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
   Add `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` too once you have them (see
   above) — until then Google sign-in stays a visible-but-inert button.
4. Deploy. `npm run build` runs `prisma generate && prisma migrate deploy`
   before `next build`, so pending migrations apply automatically on every
   deploy. Seeding is **not** part of the build (it wipes app-domain tables)
   — run `npx prisma db seed` once by hand against the production
   `DATABASE_URL` after the first successful deploy.

## Auth model

`auth.ts` configures Auth.js (Google provider, Prisma adapter, database
sessions). `proxy.ts` (Next.js 16's renamed `middleware.ts`) redirects
unauthenticated requests to `/login` and profile-incomplete sessions to
`/onboarding` for every route except those two. `lib/session.ts`'s
`getCurrentUser()` re-checks the same conditions at the data-fetching layer
as defense in depth, per Auth.js's own guidance not to rely on the proxy
alone.

## Data model

See `prisma/schema.prisma`. `lib/queries.ts` holds read queries, `lib/actions.ts`
holds the escrow/warehouse/vault Server Action mutations, `lib/profile-actions.ts`
holds onboarding, and every asset mutation logs a `ProvenanceEvent` with a
mock transaction signature so the full history is auditable from the item
detail page.
