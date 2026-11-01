// Captures the first-access screen (05) into docs/evidence/T12/ and prints key measures.
// Requires `pnpm dev` on http://localhost:5173.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const outDir = fileURLToPath(new URL('../../../docs/evidence/T12/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const measures = (page) =>
  page.evaluate(() => {
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return `${Math.round(b.width * 10) / 10}x${Math.round(b.height * 10) / 10} @ ${Math.round(b.left)},${Math.round(b.top)}`;
    };
    const form = document.querySelector('[data-screen="sign-up"]');
    const h1 = form.querySelector('h1');
    const back = form.querySelector('button[aria-label="Voltar"]');
    const buttons = [...form.querySelectorAll('button')].filter((b) => b !== back);
    const main = buttons.at(-1);
    return {
      back: r(back),
      h1: `${getComputedStyle(h1).fontSize}/${getComputedStyle(h1).lineHeight} ${getComputedStyle(h1).fontWeight} @ y=${Math.round(h1.getBoundingClientRect().top)}`,
      field: r(form.querySelector('input')?.parentElement),
      mainButton: `${main.textContent} ${r(main)}`,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

const browser = await chromium.launch();
for (const [width, height] of [
  [390, 844],
  [360, 640],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto('http://localhost:5173/sign-up?session=needs-name');
  await page.waitForSelector('[data-screen="sign-up"]');
  await page.evaluate(() => document.fonts.ready);
  console.log(`${width}x${height} empty`, JSON.stringify(await measures(page)));
  await page.screenshot({ path: `${outDir}sign-up-empty-${width}x${height}.png` });

  await page.getByLabel('Nome').fill('Maria');
  await page.screenshot({ path: `${outDir}sign-up-filled-${width}x${height}.png` });

  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForSelector('[data-screen="home"]');
  console.log(`${width}x${height} after Continue ->`, new URL(page.url()).pathname);
  await page.close();
}
await browser.close();
