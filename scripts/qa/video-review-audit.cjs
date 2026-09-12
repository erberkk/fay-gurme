const { chromium, launchOptions } = require('./browser.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4173/video-review.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('#video-play').disabled);
  const sizes = await page.evaluate(() =>
    ['#source-video', '#restored-video'].map(s => {
      const v = document.querySelector(s);
      return { width: v.videoWidth, height: v.videoHeight, duration: v.duration };
    })
  );
  assert.equal(sizes[0].width, 720);
  assert.equal(sizes[1].width, 1080);
  assert.equal(sizes[1].height, 1920);
  assert.ok(Math.abs(sizes[0].duration - sizes[1].duration) < 0.05);
  await page.locator('#comparison-range').fill('25');
  assert.equal(
    await page.locator('#comparison-frame').evaluate(e => e.style.getPropertyValue('--split')),
    '25%'
  );
  await page.locator('#video-zoom').click();
  assert.equal(await page.locator('#video-zoom').getAttribute('aria-pressed'), 'true');
  await page.locator('#video-play').click();
  await page.waitForTimeout(1200);
  assert.ok(await page.locator('#restored-video').evaluate(v => !v.paused && v.currentTime > 5.5));
  await page.locator('#video-play').click();
  assert.ok(await page.locator('#source-video').evaluate(v => v.paused));
  // The range steps by 0.033333 seconds; use a valid frame-aligned value.
  await page.locator('#video-seek').fill('11.99988');
  await page.waitForFunction(
    () =>
      !document.querySelector('#source-video').seeking && !document.querySelector('#restored-video').seeking
  );
  assert.ok(
    await page.evaluate(
      () =>
        Math.abs(
          document.querySelector('#source-video').currentTime -
            document.querySelector('#restored-video').currentTime
        ) < 0.05
    )
  );
  await page.locator('#video-sound').click();
  assert.ok(await page.locator('#restored-video').evaluate(v => !v.muted));
  await page.locator('#video-sound').click();
  await page.locator('#video-zoom').click();
  await page.locator('h1').click();
  await page.screenshot({ path: 'source/video-upscale/review-desktop.png' });
  await page.addScriptTag({ path: 'source/axe.min.js' });
  const checks = [];
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 844 : 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const rect = await page.locator('#comparison-frame').boundingBox();
    assert.ok(Math.abs(rect.width / rect.height - 9 / 16) < 0.01);
    const violations = await page.evaluate(async () => {
      const r = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      return r.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }));
    });
    assert.deepEqual(violations, []);
    checks.push({ width, overflow: false, violations });
  }
  await page.screenshot({ path: 'source/video-upscale/review-mobile.png', fullPage: true });
  const response = await page.request.get('http://localhost:4173/media/venue-ai-1080.mp4', {
    headers: { Range: 'bytes=0-99' },
  });
  assert.equal(response.status(), 206);
  assert.equal((await response.body()).length, 100);
  assert.deepEqual(errors, []);
  const report = {
    sizes,
    checks,
    errors,
    functions: [
      'split slider',
      'zoom',
      'play/pause both videos',
      'synchronized seek',
      'sound toggle',
      'byte range',
    ],
  };
  await fs.writeFile('source/video-upscale/browser-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
