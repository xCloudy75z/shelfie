/** @type {import('next').NextConfig} */
const nextConfig = {
  // Load pdf.js from node_modules inside the serverless function instead of
  // bundling it. Server-side receipt extraction (lib/receipt-extract-server.ts)
  // imports pdfjs-dist; bundling it into the function trips over its worker/asset
  // resolution, so we mark it external.
  serverExternalPackages: ["pdfjs-dist"],
  // Stamp each build so the running app can tell whether a newer deploy exists.
  // BUILD_ID is the short commit SHA on Vercel ("dev" locally); BUILT_AT is the
  // moment `next build` ran. Both are inlined into the client bundle.
  env: {
    NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7),
    NEXT_PUBLIC_BUILT_AT: new Date().toISOString(),
  },
};

export default nextConfig;
