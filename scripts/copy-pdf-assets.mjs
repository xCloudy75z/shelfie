// Copies pdf.js runtime assets from node_modules/pdfjs-dist into public/pdfjs
// so the browser reader can decode Arabic/CID-keyed receipts.
//
// pdf.js needs three things served statically at run time:
//   - the worker script       -> public/pdfjs/pdf.worker.min.mjs
//   - the CMap tables          -> public/pdfjs/cmaps/          (CID font mapping)
//   - the standard font data   -> public/pdfjs/standard_fonts/ (embedded-font fallback)
// Without the CMaps, getTextContent() stalls forever on Arabic text.
//
// These assets are regenerated on every `npm install` (see package.json
// postinstall), so public/pdfjs is gitignored rather than committed.

import { cpSync, existsSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(projectRoot, "node_modules", "pdfjs-dist");

if (!existsSync(pkgDir)) {
  console.warn(
    "[copy-pdf-assets] pdfjs-dist not found in node_modules — skipping (this is fine during a partial install).",
  );
  process.exit(0);
}

const destDir = join(projectRoot, "public", "pdfjs");

const jobs = [
  {
    src: join(pkgDir, "build", "pdf.worker.min.mjs"),
    dest: join(destDir, "pdf.worker.min.mjs"),
    label: "worker",
  },
  {
    src: join(pkgDir, "cmaps"),
    dest: join(destDir, "cmaps"),
    label: "cmaps",
  },
  {
    src: join(pkgDir, "standard_fonts"),
    dest: join(destDir, "standard_fonts"),
    label: "standard_fonts",
  },
];

for (const { src, dest, label } of jobs) {
  if (!existsSync(src)) {
    console.warn(`[copy-pdf-assets] source missing, skipping ${label}: ${src}`);
    continue;
  }
  cpSync(src, dest, { recursive: true });

  const st = statSync(dest);
  if (st.isDirectory()) {
    const count = readdirSync(dest).length;
    console.log(`[copy-pdf-assets] copied ${label}/ (${count} entries) -> ${dest}`);
  } else {
    const kb = (st.size / 1024).toFixed(0);
    console.log(`[copy-pdf-assets] copied ${label} (${kb} KB) -> ${dest}`);
  }
}

console.log("[copy-pdf-assets] done.");
