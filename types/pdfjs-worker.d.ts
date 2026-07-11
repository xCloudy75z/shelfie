// pdfjs-dist ships no type declarations for its worker entry point. We import it
// only to pre-register the worker on the main thread (see
// lib/receipt-extract-server.ts), so a minimal ambient declaration is enough.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
