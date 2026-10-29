// Captures stories at 390 x 844 into docs/evidence/<task-id>/.
// Usage: node scripts/screenshot-stories.mjs T03 ui-button--all-states product-icon--all-icons
// Requires Storybook running on http://localhost:6006 (pnpm storybook).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const [taskId, ...ids] = process.argv.slice(2);
if (!taskId || ids.length === 0) {
  console.error('Usage: node scripts/screenshot-stories.mjs <task-id> <story-id>...');
  process.exit(1);
}

const outDir = fileURLToPath(new URL(`../../../docs/evidence/${taskId}/`, import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const id of ids) {
  await page.goto(`http://localhost:6006/iframe.html?id=${id}&viewMode=story`);
  await page.waitForSelector('#storybook-root > *');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${outDir}${id}.png`, fullPage: true });
  console.log('saved', `${id}.png`);
}
await browser.close();
