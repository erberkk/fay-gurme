const { chromium, launchOptions } = require('./browser.cjs');
(async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const videos = [];
  page.on('response', r => {
    if (/\.mp4|\.m3u8/.test(r.url())) videos.push({ url: r.url(), status: r.status() });
  });
  await page.goto('https://faygurme.goatmenu.net/menu', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'source/original-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'source/original-mobile.png' });
  console.log(
    JSON.stringify({
      videos,
      videoState: await page
        .locator('#landingVideo')
        .evaluate(v => ({ src: v.currentSrc, readyState: v.readyState, error: v.error?.message })),
    })
  );
  await browser.close();
})();
