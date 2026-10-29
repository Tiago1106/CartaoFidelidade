// Captures the Tokens story at 390 x 844 into docs/evidence/T02/.
// Requires Storybook running on http://localhost:6006 (pnpm storybook).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../../../docs/evidence/T02/', import.meta.url));
const url = 'http://localhost:6006/iframe.html?id=foundations-tokens--default&viewMode=story';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url);
await page.getByRole('heading', { name: 'Tokens', level: 1 }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${outDir}tokens-390x844-full.png`, fullPage: true });
await page.screenshot({ path: `${outDir}tokens-390x844-top.png` });
const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
const loaded = await page.evaluate(() => document.fonts.check('16px "Manrope Variable"'));
console.log({ family, manropeLoaded: loaded });
await browser.close();
