// Edge-safe session helpers. Uses ONLY `jose` (Web Crypto under the hood), never
// `node:crypto`, so it can be imported from `middleware.ts` (Edge runtime) as
// well as from Server Actions (Node runtime). PIN hashing lives separately in
// `lib/auth.ts` because it needs `node:crypto` scrypt.
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-only-secret-change-me",
);

/** Sign a 7-day HS256 session token. */
export async function makeSession(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

/** Returns true if the token is a valid, unexpired session. */
export async function readSession(token?: string): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}
