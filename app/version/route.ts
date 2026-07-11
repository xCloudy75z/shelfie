// Reports the DEPLOYED build's stamp so a running client can compare it against
// its own inlined NEXT_PUBLIC_BUILD_ID and know if an update is available.
// force-dynamic + no-store guarantees the answer is never a stale cache hit.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      buildId: process.env.NEXT_PUBLIC_BUILD_ID,
      builtAt: process.env.NEXT_PUBLIC_BUILT_AT,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
