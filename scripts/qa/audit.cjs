const { chromium, launchOptions } = require('./browser.cjs');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch(launchOptions);
  const report = { breakpoints: [], checks: [], errors: [], failedRequests: [] };
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('response', r => {
    if (r.status() >= 400) report.failedRequests.push({ url: r.url(), status: r.status() });
  });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.locator('.product-card').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 844 : 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `source/redesign-${width}.png`, fullPage: true });
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
      font: document.fonts.check('400 16px "Manrope"'),
    }));
    report.breakpoints.push(metrics);
    assert.ok(metrics.documentWidth <= width, `Overflow at ${width}`);
    assert.equal(metrics.brokenImages.length, 0);
  }
  report.checks.push('No page overflow or broken images at 375, 768, 1024 and 1440px');
  assert.equal(await page.locator('.product-card').count(), 7);
  assert.equal(await page.locator('#hero-video').evaluate(v => v.paused && !v.hasAttribute('src')), true);
  report.checks.push('Default category is complete; reduced motion does not load or autoplay video');
  await page.locator('#menu-search').fill('KUZU');
  const total = await page.locator('.product-card').count();
  assert.ok(total > 3);
  const data = JSON.parse(await fs.readFile('public/data/menu.json', 'utf8'));
  const normalized = v =>
    v
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i');
  const matches = data.products.filter(p =>
    normalized(
      `${p.name} ${p.description} ${data.categories.find(c => c.id === p.categoryId).name}`
    ).includes('kuzu')
  );
  assert.equal(total, Math.min(matches.length, 24));
  report.checks.push('Turkish search finds all matching names, descriptions and categories');
  await page.locator('#sort-select').selectOption('price-asc');
  const ids = await page.locator('.product-card').evaluateAll(cards => cards.map(c => c.dataset.id));
  const prices = ids.map(id => data.products.find(p => p.id === id).price);
  assert.deepEqual(
    prices,
    [...prices].sort((a, b) => a - b)
  );
  report.checks.push('Ascending price sort matches source prices');
  await page.locator('#menu-search').fill('zzzbulunamaz');
  assert.equal(await page.locator('.empty-state').count(), 1);
  await page.locator('[data-action=reset]').click();
  assert.equal(await page.locator('.product-card').count(), 24);
  await page.locator('[data-action=load-more]').click();
  assert.equal(await page.locator('.product-card').count(), 48);
  report.checks.push('Empty search recovery and pagination work');
  const card = page.locator('.product-card').first();
  const firstId = await card.getAttribute('data-id');
  await card.locator('[data-product]').first().click();
  await page.locator('#product-dialog').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('#detail-name').textContent(),
    data.products.find(p => p.id === firstId).name
  );
  await page.locator('#product-dialog [data-save]').click();
  assert.equal(await page.locator('#product-dialog [data-save]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  await page.locator('#product-dialog').waitFor({ state: 'hidden' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.saved-toggle').click();
  assert.equal(await page.locator('.product-card').count(), 1);
  assert.equal(await page.locator('.product-card').first().getAttribute('data-id'), firstId);
  report.checks.push('Product details, Escape closing and favorites persistence work');
  await page.goto(`http://localhost:4173/?urun=2600`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#product-dialog').isVisible(), true);
  await page.locator('.detail-category-video summary').click();
  await page.locator('.detail-category-video video').evaluate(
    v =>
      new Promise(resolve => {
        v.addEventListener('loadedmetadata', resolve, { once: true });
        v.load();
      })
  );
  assert.ok(await page.locator('.detail-category-video video').evaluate(v => v.duration > 0));
  await page.keyboard.press('Escape');
  report.checks.push('Direct product URLs and archived category video load');
  await page.setViewportSize({ width: 375, height: 844 });
  await page.locator('.mobile-nav-toggle').click();
  assert.equal(await page.locator('#categories-dialog').isVisible(), true);
  const categoryIds = await page
    .locator('#dialog-category-list [data-category]')
    .evaluateAll(els => els.map(e => e.dataset.category));
  assert.ok(data.categories.every(c => categoryIds.includes(c.id)));
  await page.locator('#dialog-category-list [data-category="336"]').click();
  await page.locator('#categories-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.product-card').count(), 11);
  await page.screenshot({ path: 'source/mobile-menu.png', fullPage: false });
  await page.locator('.product-card [data-product]').first().click();
  await page.screenshot({ path: 'source/mobile-detail.png', fullPage: false });
  report.checks.push('Mobile category drawer exposes all 23 categories and selects correct products');
  assert.equal(report.errors.length, 0);
  assert.equal(report.failedRequests.length, 0);
  await fs.writeFile('source/audit-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
