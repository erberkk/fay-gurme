// Merges English translations into public/data/menu.json and verifies 100% coverage.
// Run: node scripts/data/apply-menu-translations.mjs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryTranslations, productTranslations } from './menu-translations.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const menuPath = path.join(root, '..', '..', 'public', 'data', 'menu.json');

const menu = JSON.parse(await readFile(menuPath, 'utf8'));

const missingCategories = menu.categories.filter(c => !categoryTranslations[c.id]);
if (missingCategories.length) {
  throw new Error(
    `Missing category translations for: ${missingCategories.map(c => `${c.id} (${c.name})`).join(', ')}`
  );
}
const missingProducts = menu.products.filter(p => !productTranslations[p.id]);
if (missingProducts.length) {
  throw new Error(
    `Missing product translations for: ${missingProducts.map(p => `${p.id} (${p.name})`).join(', ')}`
  );
}

menu.categories = menu.categories.map(c => ({ ...c, name_en: categoryTranslations[c.id] }));
menu.products = menu.products.map(p => {
  const [name_en, description_en] = productTranslations[p.id];
  return { ...p, name_en, description_en };
});

await writeFile(menuPath, JSON.stringify(menu, null, 2) + '\n', 'utf8');
console.log(`Applied translations: ${menu.categories.length} categories, ${menu.products.length} products.`);
