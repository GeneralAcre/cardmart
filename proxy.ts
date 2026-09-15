import { NextResponse, type NextRequest } from "next/server";

// Viewable without signing in — legal pages must stay readable by anyone,
// signed in or not, so they're distinct from GUEST_ONLY_PATHS below.
const PUBLIC_PATHS = ["/login", "/terms", "/privacy"];
// Redirect away from these if already signed in (they're for signed-out visitors only).
const GUEST_ONLY_PATHS = ["/login"];

// Privy sign-in is wired up (see lib/session.ts, /login) but intentionally
// not enforced until both NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are
// configured — until then every page acts as the seeded "you" demo user, so
// this flips on automatically the moment both are added to .env.
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
  const isGuestOnlyPath = GUEST_ONLY_PATHS.includes(pathname);
  const hasSession = Boolean(req.cookies.get("privy-id-token")?.value);

  if (!hasSession && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (hasSession && isGuestOnlyPath) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
