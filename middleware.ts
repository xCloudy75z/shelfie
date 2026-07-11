import { NextResponse, type NextRequest } from "next/server";
// IMPORTANT: import ONLY the Edge-safe session module here. Middleware runs on
// the Edge runtime, which has no `node:crypto`; importing `lib/auth.ts` would
// pull scrypt into the Edge bundle and break the build.
import { readSession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const authed = await readSession(req.cookies.get("shelfie_session")?.value);
  const isLock = req.nextUrl.pathname.startsWith("/lock");

  if (!authed && !isLock) {
    return NextResponse.redirect(new URL("/lock", req.url));
  }
  if (authed && isLock) {
    return NextResponse.redirect(new URL("/log", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon|manifest|.*\\.).*)"],
};
