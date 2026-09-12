const { chromium, launchOptions } = require('./browser.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const checks = [];
  await page.addInitScript(() => {
    window.fayMetrics = { shifts: 0, lcp: 0 };
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.fayMetrics.shifts += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => {
      window.fayMetrics.lcp = list.getEntries().at(-1).startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#hero-video').readyState >= 2);
  assert.equal(await page.locator('#hero-video').evaluate(v => v.paused), false);
  await page.locator('[data-action=toggle-hero]').click();
  assert.equal(await page.locator('#hero-video').evaluate(v => v.paused), true);
  await page.locator('[data-action=toggle-hero]').click();
  assert.equal(await page.locator('#hero-video').evaluate(v => v.paused), false);
  await page.locator('#menu').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#hero-video').paused);
  checks.push('Ambient video plays in view, can be paused, and pauses outside viewport');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => !document.querySelector('#hero-video').paused);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#hero-video').paused);
  checks.push('Changing reduced-motion preference immediately stops automatic playback');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.featured-card [data-product]').first().click();
  await page.locator('#product-dialog').waitFor({ state: 'visible' });
  await page.keyboard.press('Tab');
  assert.ok(
    await page.evaluate(() => document.querySelector('#product-dialog').contains(document.activeElement))
  );
  await page.keyboard.press('Escape');
  await page.locator('#product-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-product')), true);
  assert.equal(new URL(page.url()).searchParams.has('urun'), false);
  checks.push('Animated dialog closes cleanly and returns keyboard focus to its opener');
  const metrics = await page.evaluate(() => ({
    ...window.fayMetrics,
    requests: performance.getEntriesByType('resource').length,
    resources: performance
      .getEntriesByType('resource')
      .map(r => ({ name: new URL(r.name).pathname, bytes: r.transferSize })),
  }));
  const frameTiming = await page.evaluate(
    () =>
      new Promise(resolve => {
        const samples = [];
        let last = performance.now();
        function frame(now) {
          samples.push(now - last);
          last = now;
          if (samples.length < 90) requestAnimationFrame(frame);
          else
            resolve({ frames: samples.length, median: samples.sort((a, b) => a - b)[45], p95: samples[85] });
        }
        requestAnimationFrame(frame);
      })
  );
  const range = await page.request.get('http://localhost:4173/media/venue-ai-1080.mp4', {
    headers: { Range: 'bytes=100-199' },
  });
  assert.equal(range.status(), 206);
  assert.equal((await range.body()).length, 100);
  checks.push('Server handles byte-range video requests');
  await page.setViewportSize({ width: 320, height: 700 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  checks.push('No page overflow at 320px');
  await page.goto('http://localhost:4173/menu', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => scrollY > 500);
  checks.push('The /menu QR entry opens directly at the menu');
  await page.goto('http://localhost:4173/?urun=2628', { waitUntil: 'networkidle' });
  await page.locator('#product-dialog').waitFor({ state: 'visible' });
  const restoredProduct = await page.locator('#product-dialog .detail-photo img').evaluate(image => ({
    src: new URL(image.src).pathname,
    width: image.naturalWidth,
    height: image.naturalHeight,
    complete: image.complete,
  }));
  assert.deepEqual(restoredProduct, {
    src: '/media/enhanced-2628.webp',
    width: 1000,
    height: 1000,
    complete: true,
  });
  checks.push('A product outside the curated 12 uses its locally restored image');
  await page.goto('http://localhost:4173/?urun=2525', { waitUntil: 'networkidle' });
  await page.locator('#product-dialog').waitFor({ state: 'visible' });
  const menuLabels = await page.locator('.source-label').allTextContents();
  assert.deepEqual(menuLabels, ['Bitkisel', 'Sebzeli', 'Glutensiz']);
  assert.equal(await page.locator('.source-label svg').count(), 3);
  assert.equal(
    await page.locator('.source-labels').evaluate(element => /[🌿🥬🌾🥜🌶]/u.test(element.textContent)),
    false
  );
  assert.equal(await page.locator('#category-note a').count(), 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'source/modal-icons-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'source/modal-icons-mobile.png' });
  checks.push('Product labels use SVG icon chips and the category advice link is absent');
  const report = {
    checks,
    localDesktopMetrics: metrics,
    frameTiming,
    note: 'Local Chromium observations, not a lab mobile performance score or a real-device guarantee.',
  };
  await fs.writeFile('source/behavior-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks, lcpMs: metrics.lcp, cls: metrics.shifts, frameTiming }, null, 2));
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
