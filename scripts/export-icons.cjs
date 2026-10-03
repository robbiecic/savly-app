// Mechanical size/layer exports from approved imagegen masters; no artwork regeneration.
const Jimp = require('jimp-compact');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = name => path.join(root, name);
async function main() {
  const master = await Jimp.read(out('assets/branding/icon-master.png'));
  const icon = new Jimp(1024, 1024, '#FFFFFF').composite(master.clone().resize(1024, 1024), 0, 0);
  // Explicitly remove alpha for iOS/store artwork.
  icon.scan(0, 0, 1024, 1024, function(x, y, i) { this.bitmap.data[i + 3] = 255; });
  await icon.writeAsync(out('assets/icon.png'));
  await fs.mkdir(out('assets/thumbnails'), { recursive: true });
  for (const size of [32, 64, 128, 256, 512, 1024]) {
    await icon.clone().resize(size, size).writeAsync(out('assets/thumbnails/savly-' + size + '.png'));
  }
  await icon.clone().resize(48, 48).writeAsync(out('assets/favicon.png'));
  await icon.clone().resize(512, 512).writeAsync(out('assets/google-play-icon.png'));
  await icon.clone().resize(180, 180).writeAsync(out('public/apple-touch-icon.png'));
  await icon.clone().resize(192, 192).writeAsync(out('public/icon-192.png'));
  await icon.clone().resize(512, 512).writeAsync(out('public/icon-512.png'));

  const source = await Jimp.read(out('assets/branding/foreground-master.png'));
  let left = source.bitmap.width, top = source.bitmap.height, right = 0, bottom = 0;
  source.scan(0, 0, source.bitmap.width, source.bitmap.height, function(x, y, i) {
    if (this.bitmap.data[i + 3] > 8) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  });
  if (left >= right || top >= bottom) throw new Error('Foreground has no visible artwork');
  const artwork = source.clone().crop(left, top, right - left + 1, bottom - top + 1);
  // Fit even the bounding-box corners within a 58%-diameter circle, inside Android's 66/108 safe zone.
  const scale = 1024 * 0.58 / Math.hypot(artwork.bitmap.width, artwork.bitmap.height);
  artwork.resize(Math.floor(artwork.bitmap.width * scale), Math.floor(artwork.bitmap.height * scale));
  const foreground = new Jimp(1024, 1024, 0x00000000).composite(artwork,
    Math.floor((1024 - artwork.bitmap.width) / 2), Math.floor((1024 - artwork.bitmap.height) / 2));
  await foreground.writeAsync(out('assets/android-icon-foreground.png'));
  // Android's themed icon consumes only alpha: use the identical approved foreground mask.
  const mono = foreground.clone();
  mono.scan(0, 0, 1024, 1024, function(x, y, i) {
    this.bitmap.data[i] = 255; this.bitmap.data[i + 1] = 255; this.bitmap.data[i + 2] = 255;
  });
  await mono.writeAsync(out('assets/android-icon-monochrome.png'));
  await new Jimp(1024, 1024, '#EDF7FF').writeAsync(out('assets/android-icon-background.png'));
  await foreground.clone().resize(512, 512).writeAsync(out('assets/splash-icon.png'));

  const preview = new Jimp(800, 420, '#E9EDF5');
  preview.composite(icon.clone().resize(256, 256), 20, 20);
  const android = new Jimp(1024, 1024, '#EDF7FF').composite(foreground, 0, 0);
  preview.composite(android.clone().resize(256, 256).circle(), 292, 20);
  const themed = new Jimp(1024, 1024, '#081126').composite(mono, 0, 0);
  preview.composite(themed.resize(220, 220).circle(), 564, 38);
  let x = 20;
  for (const size of [128, 64, 32]) {
    preview.composite(icon.clone().resize(size, size), x, 282); x += size + 24;
  }
  await preview.writeAsync(out('assets/branding/preview.png'));
  console.log('Exported iOS/Expo icon, Android layers, web icons, splash asset, and six thumbnails.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
