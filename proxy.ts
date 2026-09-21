import { NextResponse, type NextRequest } from "next/server";

// Viewable without signing in — legal pages and the marketing landing page
// must stay readable by anyone, signed in or not. There's no separate
// /login route anymore: "/" IS the sign-in surface (it embeds the real
// Privy login button directly), so anyone without a session gets sent
// there instead of to a dedicated login page.
const PUBLIC_PATHS = ["/", "/terms", "/privacy"];

// Privy sign-in is wired up (see lib/session.ts, app/page.tsx) but
// intentionally not enforced until both NEXT_PUBLIC_PRIVY_APP_ID and
// PRIVY_APP_SECRET are configured — until then every page acts as the
// seeded "you" demo user, so this flips on automatically the moment both
// are added to .env.
const PRIVY_ENFORCED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);

// This only checks whether Privy's session cookie is PRESENT — it can't
// verify the token or look up profileComplete without a database call
// (Prisma's pg driver adapter isn't Edge-compatible), so it only handles
// the "not signed in at all" case. getCurrentUser() in lib/session.ts does
// the real, authoritative check (including the profileComplete ->
// /onboarding redirect) at the data layer, as defense in depth — per
// Privy's own guidance not to rely on middleware alone.
export function proxy(req: NextRequest) {
  if (!PRIVY_ENFORCED) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  // "privy-token", not "privy-id-token" — see lib/privy-server.ts for why.
  const hasSession = Boolean(req.cookies.get("privy-token")?.value);

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
