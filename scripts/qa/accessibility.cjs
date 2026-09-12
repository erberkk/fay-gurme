const { chromium, launchOptions } = require('./browser.cjs');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch(launchOptions);
  const report = [];
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 375, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
    await page.addScriptTag({ path: 'source/axe.min.js' });
    for (const state of ['page', 'product', 'categories']) {
      if (state === 'product') {
        await page.locator('.featured-card [data-product]').first().click();
      }
      if (state === 'categories') {
        await page.keyboard.press('Escape');
        if (viewport.width === 1440) await page.setViewportSize({ width: 768, height: 1000 });
        await page.locator('.mobile-nav-toggle').click();
      }
      const results = await page.evaluate(async () => {
        const r = await axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        });
        return {
          violations: r.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })),
          })),
          passes: r.passes.length,
        };
      });
      report.push({ width: viewport.width, state, ...results });
    }
    await page.close();
  }
  await fs.writeFile('source/accessibility-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
