// Reuse an installed Playwright. It is a verification tool, not an app dependency.
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
} catch {
  const cache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  const candidates = fs.existsSync(cache)
    ? fs
        .readdirSync(cache)
        .map(name => path.join(cache, name, 'node_modules', 'playwright'))
        .filter(candidate => fs.existsSync(path.join(candidate, 'package.json')))
    : [];
  if (!candidates.length)
    throw new Error(
      'Playwright is needed only for browser verification. Install it separately, or set PLAYWRIGHT_PATH to an existing installation.'
    );
  playwright = require(candidates.at(-1));
}
let executablePath = process.env.FAY_BROWSER_PATH || playwright.chromium.executablePath();
if (!fs.existsSync(executablePath)) {
  const cache = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const candidates = fs.existsSync(cache)
    ? fs
        .readdirSync(cache)
        .filter(name => /^chromium-\d+$/.test(name))
        .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]))
        .map(name => path.join(cache, name, 'chrome-win64', 'chrome.exe'))
        .filter(p => fs.existsSync(p))
    : [];
  if (candidates.length) executablePath = candidates.at(-1);
}
module.exports = { chromium: playwright.chromium, launchOptions: { headless: true, executablePath } };
