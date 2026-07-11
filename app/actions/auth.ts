"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPin, verifyPin } from "@/lib/auth";
import { makeSession } from "@/lib/session";

const COOKIE = "shelfie_session";
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: "/",
};

type ActionResult = { ok: true } | { ok: false; error: string };

/** First-run: hash and store the PIN, open a session, go to the app. */
export async function setPin(pin: string): Promise<ActionResult> {
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "PIN must be 4 digits" };
  const existing = await db.settings.findUnique({ where: { id: 1 } });
  if (existing?.pinHash) return { ok: false, error: "PIN already set" };

  const { hash, salt } = await hashPin(pin);
  await db.settings.upsert({
    where: { id: 1 },
    update: { pinHash: hash, pinSalt: salt, failedAttempts: 0, lockedUntil: null },
    create: { id: 1, pinHash: hash, pinSalt: salt },
  });

  const jar = await cookies();
  jar.set(COOKIE, await makeSession(), cookieOpts);
  redirect("/log");
}

/** Returning user: verify PIN with a lockout after repeated failures. */
export async function verifyPinAction(pin: string): Promise<ActionResult> {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  if (!s?.pinHash || !s.pinSalt) return { ok: false, error: "No PIN set" };

  if (s.lockedUntil && s.lockedUntil > new Date()) {
    return { ok: false, error: "Too many attempts. Try again shortly." };
  }

  const ok = await verifyPin(pin, s.pinHash, s.pinSalt);
  if (!ok) {
    const attempts = s.failedAttempts + 1;
    const locked = attempts >= MAX_FAILS;
    await db.settings.update({
      where: { id: 1 },
      data: {
        failedAttempts: locked ? 0 : attempts,
        lockedUntil: locked ? new Date(Date.now() + LOCK_MS) : null,
      },
    });
    return {
      ok: false,
      error: locked ? "Too many attempts. Try again shortly." : "Wrong PIN",
    };
  }

  await db.settings.update({
    where: { id: 1 },
    data: { failedAttempts: 0, lockedUntil: null },
  });
  const jar = await cookies();
  jar.set(COOKIE, await makeSession(), cookieOpts);
  return { ok: true };
}

/** Sign out: drop the session cookie and return to the lock screen. */
export async function lock() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/lock");
}
