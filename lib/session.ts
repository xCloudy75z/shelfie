// Edge-safe session helpers. Uses ONLY `jose` (Web Crypto under the hood), never
// `node:crypto`, so it can be imported from `middleware.ts` (Edge runtime) as
// well as from Server Actions (Node runtime). PIN hashing lives separately in
// `lib/auth.ts` because it needs `node:crypto` scrypt.
import { SignJWT, jwtVerify } from "jose";

// Resolved per-invocation (not at module top-level) so a build without the env
// var doesn't crash — only a real request in production throws. In production a
// missing SESSION_SECRET is fatal: we refuse to sign tokens with a public key.
function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is not set — refusing to run without a real session secret.",
      );
    }
    return new TextEncoder().encode("dev-only-secret-change-me"); // local dev only
  }
  return new TextEncoder().encode(s);
}

/** Sign a 7-day HS256 session token. */
export async function makeSession(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

/** Returns true if the token is a valid, unexpired session. */
export async function readSession(token?: string): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}
