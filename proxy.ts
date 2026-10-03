import { NextResponse, type NextRequest } from "next/server";

// Viewable without signing in — legal pages and the marketing landing page
// must stay readable by anyone, signed in or not. There's no separate
// /login route anymore: "/" IS the sign-in surface (it embeds the real
// Privy login button directly), so anyone without a session gets sent
// there instead of to a dedicated login page.
// "/wallet-check" is a TEMPORARY wallet diagnostic page — remove with it.
const PUBLIC_PATHS = ["/", "/terms", "/privacy", "/staff-login", "/wallet-check"];

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

  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  if (!hasSession && !isPublicPath) {
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
