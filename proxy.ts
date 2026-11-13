import { NextResponse, type NextRequest } from "next/server";

import { REF_COOKIE, REF_COOKIE_MAX_AGE, REF_HANDLE } from "@/lib/referral";

// Viewable without signing in. The whole marketplace is browsable by anyone
// — a visitor (or a tester trying the product) can read through every card
// page, seller store, auction, market index, the leaderboard and the news
// before they ever create an account. There's no separate /login route: "/"
// IS the sign-in surface (it embeds the real Privy login button directly), so
// the pages that DO need an account send a signed-out visitor there.
//
// Only the pages that act *as* you stay private: your portfolio, settings,
// messages, rewards, the AI agent, onboarding, and the sell/listing flow —
// i.e. signing in is required just to sell or manage your own account, not to
// look around. Each of those also re-checks at the data layer
// (getCurrentUser in lib/session.ts), which is the authoritative gate; this
// edge list is defense in depth, per Privy's own guidance.
const PUBLIC_PATHS = ["/", "/marketplace", "/terms", "/privacy", "/staff-login"];
// Open to guests by prefix (exact match OR a "/child" under it). "/marketplace"
// is matched exactly above on purpose, so its "/marketplace/sell" child stays
// private. "/share/..." receipts stay open to anyone with the link.
const PUBLIC_PREFIXES = [
  "/item",
  "/store",
  "/auctions",
  "/market",
  "/leaderboard",
  "/news",
  "/guide",
  "/faq",
  "/share",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Privy sign-in is wired up (see lib/session.ts, app/page.tsx) but
// intentionally not enforced until both NEXT_PUBLIC_PRIVY_APP_ID and
// PRIVY_APP_SECRET are configured — until then every page acts as the
// seeded "you" demo user, so this flips on automatically the moment both
// are added to .env.
const PRIVY_ENFORCED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);

// The staff back office gets its own domain when ADMIN_HOST is set (e.g.
// "cardmarts-admin.vercel.app", added to the same Vercel project). Same app
// and database, but the two hosts are kept apart:
//   - on ADMIN_HOST, only the back office is served; "/" is the staff
//     sign-in page and any marketplace path is sent back to the main site.
//   - on every other host, /admin and /staff-login answer 404, so the back
//     office isn't reachable (or visible) from the marketplace domain at all.
// Unset (local dev), /admin just works on the one host as before.
const ADMIN_HOST = process.env.ADMIN_HOST?.toLowerCase();
// Where marketplace links clicked inside the back office should go.
const MAIN_HOST = process.env.MAIN_HOST ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;

function isBackofficePath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/staff-login";
}

// Rewriting to a path no route matches renders the app's normal 404 page
// with a real 404 status.
function notFound(req: NextRequest) {
  return NextResponse.rewrite(new URL("/__not-found", req.nextUrl.origin));
}

// This only checks whether Privy's session cookie is PRESENT — it can't
// verify the token or look up profileComplete without a database call
// (Prisma's pg driver adapter isn't Edge-compatible), so it only handles
// the "not signed in at all" case. getCurrentUser() in lib/session.ts does
// the real, authoritative check (including the profileComplete ->
// /onboarding redirect) at the data layer, as defense in depth — per
// Privy's own guidance not to rely on middleware alone.
export function proxy(req: NextRequest) {
  const res = route(req) ?? NextResponse.next();
  // An invite link (/?ref=<handle>): remember who sent it until the visitor
  // first signs in, when lib/session.ts saves it. The first link opened wins,
  // and people already signed in are past being referred.
  const ref = req.nextUrl.searchParams.get("ref")?.toLowerCase();
  if (ref && REF_HANDLE.test(ref) && !req.cookies.has("privy-token") && !req.cookies.has(REF_COOKIE)) {
    res.cookies.set(REF_COOKIE, ref, { maxAge: REF_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax", path: "/" });
  }
  return res;
}

function route(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // "privy-token", not "privy-id-token" — see lib/privy-server.ts for why.
  const hasSession = Boolean(req.cookies.get("privy-token")?.value);

  if (ADMIN_HOST) {
    const host = req.headers.get("host")?.toLowerCase();
    if (host === ADMIN_HOST) {
      if (pathname === "/") return NextResponse.rewrite(new URL("/staff-login", req.nextUrl.origin));
      if (!isBackofficePath(pathname)) {
        return MAIN_HOST ? NextResponse.redirect(`https://${MAIN_HOST}${pathname}${req.nextUrl.search}`) : notFound(req);
      }
      if (PRIVY_ENFORCED && !hasSession && pathname !== "/staff-login") {
        // Built from the Host header, not nextUrl.origin, so it always stays on the admin domain.
        return NextResponse.redirect(new URL("/", `${req.nextUrl.protocol}//${host}`));
      }
      return NextResponse.next();
    }
    if (isBackofficePath(pathname)) return notFound(req);
  }

  if (!PRIVY_ENFORCED) return NextResponse.next();

  if (!hasSession && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
}

export const config = {
  // Excludes Next.js internals, any actual static file (extension in the
  // last path segment), AND everything under /api — without the
  // file-extension exclusion, requests for public/ assets like
  // /X-logo.png were being caught by this same middleware and redirected
  // to "/" when signed out, breaking images sitewide. The /api exclusion
  // matters just as much: an API route should never get silently rewritten
  // into an HTML redirect for a caller that was never going to have a
  // Privy browser cookie in the first place (e.g. app/api/verify's
  // separate API-key auth for an external QA tool) — each API route
  // authenticates itself and returns a proper JSON error instead.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.[\\w]+$).*)"],
};
