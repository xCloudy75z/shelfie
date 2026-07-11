// Rasterizes public/icon.svg into the PNG sizes that phone home screens use.
// Run: node scripts/gen-icons.mjs  (or: npm run gen:icons)
//
// sharp is a devDependency used ONLY by this local build step. The committed
// PNGs are what ship — no app/runtime code imports sharp.
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const GREEN = "#1f9d57";

const svg = await readFile(join(pub, "icon.svg"));

// Full-bleed PNGs: render the whole SVG, flatten onto solid green so there is
// never any transparency (iOS home-screen icons must be opaque).
const fullBleed = [
  { file: "apple-touch-icon.png", size: 180 }, // iOS home screen
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
];

for (const { file, size } of fullBleed) {
  await sharp(svg)
    .resize(size, size)
    .flatten({ background: GREEN })
    .png()
    .toFile(join(pub, file));
}

// Maskable 512: Android masks the icon into a circle/squircle, so the cart must
// sit inside the ~80% safe zone. Render the cart at ~72% and centre it on a
// solid green 512 canvas.
const MASK = 512;
const inner = Math.round(MASK * 0.72); // 369px
const cart = await sharp(svg)
  .resize(inner, inner)
  .flatten({ background: GREEN })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: MASK,
    height: MASK,
    channels: 3,
    background: GREEN,
  },
})
  .composite([{ input: cart, gravity: "centre" }])
  .png()
  .toFile(join(pub, "icon-maskable-512.png"));

console.log("Wrote: apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png");
