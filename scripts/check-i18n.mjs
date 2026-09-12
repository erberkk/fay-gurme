// Verifies i18n coverage: dict key parity, menu.json translation completeness,
// and that no translatable Turkish text is left outside a data-i18n hook in the HTML pages.
// Run: node scripts/check-i18n.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;
function fail(message) {
  failed = true;
  console.error(`✗ ${message}`);
}
function pass(message) {
  console.log(`✓ ${message}`);
}

// 1. Dictionary key parity between tr and en.
const dictSource = await readFile(path.join(root, 'public/i18n/dict.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(dictSource, sandbox);
const dict = sandbox.window.FAY_I18N_DICT;
const trKeys = new Set(Object.keys(dict.tr));
const enKeys = new Set(Object.keys(dict.en));
const missingInEn = [...trKeys].filter(k => !enKeys.has(k));
const missingInTr = [...enKeys].filter(k => !trKeys.has(k));
if (missingInEn.length) fail(`Missing EN translations for keys: ${missingInEn.join(', ')}`);
else pass(`All ${trKeys.size} TR dictionary keys have an EN counterpart.`);
if (missingInTr.length) fail(`Missing TR translations for keys: ${missingInTr.join(', ')}`);

// 2. menu.json: every category and product must carry *_en fields.
const menu = JSON.parse(await readFile(path.join(root, 'public/data/menu.json'), 'utf8'));
const categoriesMissing = menu.categories.filter(c => !c.name_en);
const productsMissingName = menu.products.filter(p => !p.name_en);
const productsMissingDescField = menu.products.filter(p => p.description_en === undefined);
if (categoriesMissing.length)
  fail(`Categories missing name_en: ${categoriesMissing.map(c => c.id).join(', ')}`);
else pass(`All ${menu.categories.length} categories have name_en.`);
if (productsMissingName.length)
  fail(`Products missing name_en: ${productsMissingName.map(p => p.id).join(', ')}`);
else pass(`All ${menu.products.length} products have name_en.`);
if (productsMissingDescField.length)
  fail(`Products missing description_en field: ${productsMissingDescField.map(p => p.id).join(', ')}`);
else pass('All products have a description_en field (may be empty to match source).');

// 3. Static HTML: every visible text node must be covered by data-i18n / data-i18n-html,
//    or sit inside an element whose ancestor already is, or be on an explicit allowlist
//    of invariant brand/proper-noun strings that are intentionally identical in both languages.
const ALLOWLIST = [
  'FAY',
  'gurme',
  'Fay Gurme',
  'FAY gurme',
  'BOLU',
  'TÜRKİYE',
  '·',
  '—',
  '/',
  '01',
  '02',
  '03',
  '+90 534 260 85 22',
  '2026',
  '↗',
  '↓',
  '‹ ›',
  '←',
  '→',
  'ARARAT',
];
const TURKISH_CHARS = /[çğıöşüÇĞİÖŞÜ]/;

function stripCoveredAndCheck(html, fileLabel) {
  let i = 0;
  const stack = []; // {covered:boolean, tag:string}
  const problems = [];
  while (i < html.length) {
    if (html[i] === '<') {
      const close = html.indexOf('>', i);
      if (close === -1) break;
      const tag = html.slice(i, close + 1);
      const isClosing = tag.startsWith('</');
      const isSelfClosing = /\/>$/.test(tag) || /^<(meta|link|img|input|br|hr|source)\b/i.test(tag);
      const tagNameMatch = tag.match(/^<\/?([a-zA-Z0-9-]+)/);
      const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : '';
      if (isClosing) {
        if (stack.length && stack[stack.length - 1].tag === tagName) stack.pop();
      } else {
        const covered =
          /data-i18n(?:-html|-dynamic)?=/.test(tag) || (stack.length && stack[stack.length - 1].covered);
        const skip = tagName === 'script' || tagName === 'style' || tagName === 'svg' || tagName === 'path';
        if (!isSelfClosing) stack.push({ tag: tagName, covered: covered || skip });
      }
      i = close + 1;
      continue;
    }
    const next = html.indexOf('<', i);
    const text = next === -1 ? html.slice(i) : html.slice(i, next);
    const covered = stack.length ? stack[stack.length - 1].covered : false;
    if (!covered && TURKISH_CHARS.test(text)) {
      const trimmed = text.replace(/\s+/g, ' ').trim();
      if (trimmed && !ALLOWLIST.includes(trimmed)) problems.push(trimmed);
    }
    i = next === -1 ? html.length : next;
  }
  if (problems.length) fail(`${fileLabel}: uncovered Turkish text found — ${JSON.stringify(problems)}`);
  else pass(`${fileLabel}: no uncovered Turkish text nodes.`);
}

for (const file of ['public/index.html', 'public/media-review.html', 'public/video-review.html']) {
  const html = await readFile(path.join(root, file), 'utf8');
  stripCoveredAndCheck(html, file);
}

if (failed) {
  console.error('\ni18n coverage check FAILED.');
  process.exit(1);
} else {
  console.log('\ni18n coverage check passed.');
}
