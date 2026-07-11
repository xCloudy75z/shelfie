import { db } from "@/lib/db";
import PinPad from "./PinPad";

// Never prerender: this page reads Settings from the DB to decide first-run vs
// returning. `force-dynamic` keeps `next build` from trying to connect to a
// database at build time (there is no DB at build).
export const dynamic = "force-dynamic";

export default async function LockPage() {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const firstRun = !settings?.pinHash;
  return <PinPad firstRun={firstRun} />;
}
