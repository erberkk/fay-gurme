const { chromium, launchOptions } = require('./browser.cjs');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach(i => (i.loading = 'eager'));
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
    await document.fonts.ready;
  });
  await page.screenshot({ path: 'source/desktop-preview.png' });
  await page.screenshot({ path: 'source/desktop-full.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'source/mobile-preview.png' });
  await page.screenshot({ path: 'source/mobile-full.png', fullPage: true });
  await page.locator('.mobile-dock a[href="#menu"]').click();
  await page.screenshot({ path: 'source/mobile-menu-preview.png' });
  console.log(
    JSON.stringify(
      await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        bodyHeight: document.body.getBoundingClientRect().height,
        footerBottom: document.querySelector('footer').getBoundingClientRect().bottom + scrollY,
        largeElements: [...document.querySelectorAll('body *')]
          .filter(
            e => e.getBoundingClientRect().bottom + scrollY > document.body.getBoundingClientRect().height + 2
          )
          .map(e => ({ tag: e.tagName, cls: e.className, rect: e.getBoundingClientRect().toJSON() }))
          .slice(0, 10),
      }))
    )
  );
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
