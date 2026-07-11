// PIN hashing with Node's scrypt. This module imports `node:crypto`, so it must
// ONLY be used from the Node runtime (Server Actions / route handlers) — never
// from `middleware.ts`, which runs on the Edge runtime where `node:crypto` is
// unavailable. Session signing/verifying lives in the Edge-safe `lib/session.ts`.
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(pin, salt, 64)) as Buffer;
  return { hash: buf.toString("hex"), salt };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const buf = (await scryptAsync(pin, salt, 64)) as Buffer;
  const known = Buffer.from(hash, "hex");
  return buf.length === known.length && timingSafeEqual(buf, known);
}
