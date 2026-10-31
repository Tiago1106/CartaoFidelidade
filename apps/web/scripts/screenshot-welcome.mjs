// Captures the welcome screens into docs/evidence/T09/ and prints key measures.
// Requires `pnpm dev` on http://localhost:5173.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const outDir = fileURLToPath(new URL('../../../docs/evidence/T09/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const [width, height] of [
  [390, 844],
  [360, 640],
]) {
  for (const step of [1, 2, 3]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`http://localhost:5173/welcome?step=${step}&session=signed-out`);
    await page.waitForSelector('[data-screen="welcome"]');
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const box = (el) => {
        const r = el?.getBoundingClientRect();
        return r
          ? `${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10} @ ${Math.round(r.left)},${Math.round(r.top)}`
          : null;
      };
      const root = document.querySelector('[data-screen="welcome"]');
      const art = root.querySelector('[data-slide]');
      const sheet = [...root.children].at(-1);
      const h1 = root.querySelector('h1');
      const p = root.querySelector('p');
      const skip = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Pular');
      const cta = [...root.querySelectorAll('button')].at(-1);
      return {
        art: box(art),
        sheet: box(sheet),
        sheetRadius: getComputedStyle(sheet).borderTopLeftRadius,
        sheetPad: getComputedStyle(sheet).padding,
        h1: `${getComputedStyle(h1).fontSize}/${getComputedStyle(h1).lineHeight} ${getComputedStyle(h1).fontWeight} ${getComputedStyle(h1).letterSpacing}`,
        p: `${getComputedStyle(p).fontSize}/${getComputedStyle(p).lineHeight} ${getComputedStyle(p).color}`,
        gaps: (() => {
          const t = p.getBoundingClientRect(),
            d = root.querySelector('[role=img]').getBoundingClientRect(),
            b = cta.getBoundingClientRect(),
            sh = sheet.getBoundingClientRect();
          return {
            top: Math.round(t.top - sh.top),
            textToDots: Math.round(d.top - t.bottom),
            dotsToButton: Math.round(b.top - d.bottom),
            bottom: Math.round(sh.bottom - b.bottom),
          };
        })(),
        skip: box(skip),
        cta: box(cta),
        rootBg: getComputedStyle(root).backgroundColor,
        hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        vScroll: root.scrollHeight > root.clientHeight,
      };
    });
    console.log(`${width}x${height} step ${step}`, JSON.stringify(m));
    await page.screenshot({ path: `${outDir}welcome-step${step}-${width}x${height}.png` });
    await page.close();
  }
}
await browser.close();
