import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../../../docs/evidence/T02/', import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:4173/');
await page.getByRole('heading', { name: 'Freguês' }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${outDir}home-390x844.png` });
await browser.close();
