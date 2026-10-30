// Captures routes of the running dev server into docs/evidence/<task-id>/.
// Usage: node scripts/screenshot-routes.mjs T08
// Requires `pnpm dev` on http://localhost:5173. The `?session=` parameter works in dev only.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const [taskId] = process.argv.slice(2);
if (!taskId) {
  console.error('Usage: node scripts/screenshot-routes.mjs <task-id>');
  process.exit(1);
}
const outDir = fileURLToPath(new URL(`../../../docs/evidence/${taskId}/`, import.meta.url));
mkdirSync(outDir, { recursive: true });

const shots = [
  { name: 'home-signed-in-390x844', path: '/', session: 'signed-in', size: [390, 844] },
  { name: 'my-qr-signed-in-390x844', path: '/my-qr', session: 'signed-in', size: [390, 844] },
  { name: 'welcome-signed-out-390x844', path: '/', session: 'signed-out', size: [390, 844] },
  { name: 'sign-up-needs-name-390x844', path: '/', session: 'needs-name', size: [390, 844] },
  { name: 'home-signed-in-360x640', path: '/', session: 'signed-in', size: [360, 640] },
  { name: 'home-signed-in-desktop-1280x800', path: '/', session: 'signed-in', size: [1280, 800] },
];

const browser = await chromium.launch();
for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.size[0], height: shot.size[1] } });
  await page.goto(`http://localhost:5173${shot.path}?session=${shot.session}`);
  await page.waitForSelector('[data-screen]');
  await page.evaluate(() => document.fonts.ready);
  const scrollsSideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  await page.screenshot({ path: `${outDir}${shot.name}.png` });
  console.log(
    shot.name,
    'url:',
    new URL(page.url()).pathname,
    'horizontal scroll:',
    scrollsSideways,
  );
  await page.close();
}
await browser.close();
