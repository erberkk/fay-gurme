const { chromium, launchOptions } = require('./browser.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'source/v2-opening.png' });
  const checks = [];
  assert.equal(await page.locator('.reservation-link').getAttribute('href'), 'https://wa.me/905342608522');
  assert.equal(
    await page.locator('.mobile-dock a').last().getAttribute('href'),
    'https://wa.me/905342608522'
  );
  assert.equal(await page.locator('#hero-video').getAttribute('src'), '/media/venue-ai-1080.mp4');
  checks.push('Locally restored 1080p film and verified WhatsApp reservation links');
  const startBg = await page.locator('.scene-sticky').evaluate(e => getComputedStyle(e).backgroundColor);
  await page.evaluate(() => window.scrollTo({ top: 850, behavior: 'instant' }));
  await page.waitForTimeout(1000);
  const endBg = await page.locator('.scene-sticky').evaluate(e => getComputedStyle(e).backgroundColor);
  assert.notEqual(startBg, endBg);
  await page.screenshot({ path: 'source/v2-opening-scroll.png' });
  checks.push('Scroll changes the opening scene, photography and background');
  const story = await page
    .locator('.tasting-section')
    .evaluate(e => ({ top: e.offsetTop, height: e.offsetHeight }));
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), story.top - 80 + 100);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'source/v2-story-01.png' });
  await page.locator('[data-taste="1"]').click();
  await page.waitForTimeout(950);
  assert.equal(await page.locator('[data-taste-copy="1"]').isVisible(), true);
  assert.equal(await page.locator('[data-taste-copy="0"]').isVisible(), false);
  await page.screenshot({ path: 'source/v2-story-02.png' });
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), story.top + story.height - 1100);
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('[data-taste="2"]').getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: 'source/v2-story-03.png' });
  await page.locator('[data-taste-copy="2"] [data-product]').click();
  await page.locator('#product-dialog').waitFor({ state: 'visible' });
  assert.ok((await page.locator('.detail-photo img').getAttribute('src')).includes('enhanced-2625'));
  await page.keyboard.press('Escape');
  await page.locator('#product-dialog').waitFor({ state: 'hidden' });
  checks.push('Three story chapters respond to buttons and scrolling; dish opens correct restored photo');
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(1000);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Horizontal overflow at ${width}`
    );
    if ([320, 390, 768, 1024].includes(width))
      await page.screenshot({ path: `source/v2-${width}-opening.png` });
  }
  checks.push('No horizontal overflow at 320, 375, 390, 768, 1024 and 1440 pixels');
  const touchPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  touchPage.on('pageerror', e => errors.push(e.message));
  await touchPage.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await touchPage.locator('.tasting-section').scrollIntoViewIfNeeded();
  await touchPage.waitForTimeout(800);
  await touchPage.locator('[data-taste="0"]').click();
  await touchPage.locator('.taste-gallery').evaluate(element => {
    const rect = element.getBoundingClientRect(),
      y = rect.top + rect.height / 2,
      startX = rect.left + rect.width * 0.82,
      endX = rect.left + rect.width * 0.18;
    element.setPointerCapture = () => {};
    const emit = (type, x) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 7,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
        })
      );
    emit('pointerdown', startX);
    emit('pointermove', (startX + endX) / 2);
    emit('pointermove', endX);
    emit('pointerup', endX);
  });
  await touchPage.waitForFunction(
    () => document.querySelector('[data-taste="1"]').getAttribute('aria-pressed') === 'true'
  );
  assert.equal(await touchPage.locator('.taste-swipe-hint').isVisible(), true);
  assert.equal(await touchPage.locator('.editorial-ribbon i').count(), 0);
  assert.equal(await touchPage.locator('.editorial-ribbon .ribbon-star').count(), 5);
  checks.push('Mobile swipe advances the story and ribbon marks are font-independent SVGs');
  await touchPage.locator('.tasting-heading').scrollIntoViewIfNeeded();
  await touchPage.screenshot({ path: 'source/v2-mobile-story.png' });
  await touchPage.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.tasting-section').scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-taste="2"]').click();
  assert.equal(await page.locator('[data-taste-copy="2"]').isVisible(), true);
  assert.equal(await page.locator('#hero-video').evaluate(v => v.paused), true);
  checks.push('Mobile manual chapters and reduced-motion fallback stay functional');
  assert.deepEqual(errors, []);
  await fs.writeFile('source/experience-results.json', JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
