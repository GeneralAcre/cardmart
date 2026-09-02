import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login"];

// Google sign-in is wired up (see auth.ts, /login) but intentionally not
// enforced yet — no real AUTH_GOOGLE_ID/SECRET are configured, so clicking
// "Continue with Google" would just error. Once real credentials are added
// to .env, this flips on automatically with no other code changes needed.
const AUTH_ENFORCED = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const proxy = auth((req) => {
  if (!AUTH_ENFORCED) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  const session = req.auth;

  if (!session && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (session && isPublicPath) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (session && !session.user.profileComplete && pathname !== "/onboarding" && !isPublicPath) {
    return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
  }

  if (session && session.user.profileComplete && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
