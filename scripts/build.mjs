// Builds the static site into dist/.
// Every image and video referenced by the menu data is checked first, so a
// missing asset fails the build instead of shipping a broken card.
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const data = JSON.parse(await readFile(resolve(root, 'public/data/menu.json'), 'utf8'));
for (const item of [...data.products, ...data.categories]) {
  if (item.image) await stat(resolve(root, 'public', item.image.slice(1)));
}
const restorations = JSON.parse(await readFile(resolve(root, 'public/data/media-restorations.json'), 'utf8'));
for (const item of restorations.photos) await stat(resolve(root, 'public', item.restored.slice(1)));
let restoredProductCount = 0;
for (const product of data.products) {
  if (!product.image) continue;
  await stat(resolve(root, 'public/media', `enhanced-${product.id}.webp`));
  restoredProductCount++;
}
await stat(resolve(root, 'public', restorations.video.used.slice(1)));
await stat(resolve(root, 'public/media/venue-ai-1080-poster.webp'));
await stat(resolve(root, 'public/media/fay-gurme-square.png'));

// Copy the site. /menu serves the same page so QR codes can deep-link to the menu.
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'dist'), { recursive: true });
await cp(resolve(root, 'public'), resolve(root, 'dist'), { recursive: true });
await mkdir(resolve(root, 'dist/menu'), { recursive: true });
await cp(resolve(root, 'public/index.html'), resolve(root, 'dist/menu/index.html'));

// /paylasim and /kesfet are share URLs with their own canonical/og:url, so
// messaging apps fetch a fresh preview card instead of a cached one.
const indexHtml = await readFile(resolve(root, 'public/index.html'), 'utf8');
const shareHtml = indexHtml
  .replace(
    '<link rel="canonical" href="https://fay-gurme.vercel.app/">',
    '<link rel="canonical" href="https://fay-gurme.vercel.app/paylasim">'
  )
  .replace(
    '<meta property="og:url" content="https://fay-gurme.vercel.app/">',
    '<meta property="og:url" content="https://fay-gurme.vercel.app/paylasim">'
  );
await mkdir(resolve(root, 'dist/paylasim'), { recursive: true });
await writeFile(resolve(root, 'dist/paylasim/index.html'), shareHtml, 'utf8');
await mkdir(resolve(root, 'dist/kesfet'), { recursive: true });
await writeFile(
  resolve(root, 'dist/kesfet/index.html'),
  shareHtml.replaceAll('https://fay-gurme.vercel.app/paylasim', 'https://fay-gurme.vercel.app/kesfet'),
  'utf8'
);
console.log(
  `Built dist/: ${data.categories.length} categories, ${data.products.length} products, ${restoredProductCount} restored product photos. Includes local GSAP; no installation required.`
);
