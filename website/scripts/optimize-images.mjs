// Web-sized copies of the app's bundled images. The app ships full-size
// originals (e.g. a 1 MB PNG for a 24px tab icon) — fine inside an APK, slow
// over the network. The originals in ../assets stay the single source of
// truth; this writes resized WebP versions to src/assets/web/ (skipping any
// that are already newer than their source).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.resolve(WEB, "../assets");
const OUT = path.resolve(WEB, "src/assets/web");
const PUBLIC = path.resolve(WEB, "public");

// [source relative to ../assets, output file, max width, quality, output dir, custom pipeline?]
const SPORTS = ["badminton", "football", "outdoor-cricket", "box-cricket", "padel", "pickleball", "table-tennis", "tennis"];
const JOBS = [
  // Home promo slider (HomeScreen's four slides, in order).
  ["Slider-images/second_slider_image.png", "slide-venues.webp", 1600, 80, OUT],
  ["Slider-images/third_slider_image.png", "slide-squads.webp", 1600, 80, OUT],
  ["Slider-images/fourth_slider_image.png", "slide-fourth.webp", 1600, 80, OUT],
  ["Slider-images/fifth_slider_image.png", "slide-fifth.webp", 1600, 80, OUT],
  // Sport photos (transparent backgrounds, so they sit on either theme).
  ...SPORTS.map((f) => [`sport-icons/${f}-transparent.png`, `sport-${f}.webp`, 360, 82, OUT]),
  ["sport-icons/padel-card-transparent.png", "sport-padel-card.webp", 360, 82, OUT],
  // Large variants for full-width hero fallbacks (venue detail without photos).
  ...SPORTS.map((f) => [`sport-icons/${f}-transparent.png`, `sport-${f}-lg.webp`, 1400, 78, OUT]),
  // Community hub cards + banner.
  ["community-icons/community-chat.jpeg", "community-chat.webp", 640, 80, OUT],
  ["community-icons/Top-Players.jpeg", "community-top-players.webp", 640, 80, OUT],
  ["community-icons/explore-events.jpeg", "community-explore-events.webp", 640, 80, OUT],
  ["community-icons/Explore-TrainingCamps.jpeg", "community-training-camps.webp", 640, 80, OUT],
  ["community-icons/community-banner.png", "community-banner.webp", 1600, 80, OUT],
  ["splash-background.png", "splash-background.webp", 900, 82, PUBLIC],
  ["splash-background-dark.png", "splash-background-dark.webp", 900, 82, PUBLIC],
  // Default avatar for manually-added players (a 1.2 MB PNG in the app).
  ["avatar.png", "avatar.webp", 256, 80, OUT],
  // App icons: the Android adaptive foreground (already square, with the
  // safe-zone padding maskable icons need) on the app's dark splash colour.
  ["android-icon-foreground.png", "icon-192.png", 192, 90, PUBLIC, appIcon],
  ["android-icon-foreground.png", "icon-512.png", 512, 90, PUBLIC, appIcon],
  ["android-icon-foreground.png", "apple-touch-icon.png", 180, 90, PUBLIC, appIcon],
  // The bare logo (transparent, square): browser-tab favicon and in-page logo.
  ["icon.png", "favicon.png", 64, 90, PUBLIC, logoMark],
  ["icon.png", "logo.png", 192, 90, PUBLIC, logoMark],
  // Link-preview image (WhatsApp, Facebook, X…): 1200×630 JPEG, the most
  // widely supported share-card format, from the "Join a Sports Community" slide.
  ["Slider-images/third_slider_image.png", "og-image.jpg", 1200, 82, PUBLIC, (img, w, q) => img.resize(w, 630, { fit: "cover", position: "left" }).jpeg({ quality: q, mozjpeg: true })],
];

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
function logoMark(img, w) {
  return img.trim().resize(w, w, { fit: "contain", background: TRANSPARENT }).png({ compressionLevel: 9 });
}
function appIcon(img, w) {
  return img.resize(w, w).flatten({ background: "#050B12" }).png({ compressionLevel: 9 });
}

fs.mkdirSync(OUT, { recursive: true });
let written = 0;
for (const [src, out, width, quality, dir, custom] of JOBS) {
  const from = path.join(SRC, src);
  const to = path.join(dir, out);
  if (fs.existsSync(to) && fs.statSync(to).mtimeMs >= fs.statSync(from).mtimeMs) continue;
  if (custom) {
    await custom(sharp(from), width, quality).toFile(to);
  } else {
    const pipeline = sharp(from).resize({ width, withoutEnlargement: true });
    await (out.endsWith(".png") ? pipeline.png({ compressionLevel: 9 }) : pipeline.webp({ quality })).toFile(to);
  }
  written++;
}
console.log(`images: ${written} optimized, ${JOBS.length - written} up to date`);
