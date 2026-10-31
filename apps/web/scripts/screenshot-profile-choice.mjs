// Captures the profile choice screen into docs/evidence/T10/ and prints key measures.
// Requires `pnpm dev` on http://localhost:5173.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const outDir = fileURLToPath(new URL('../../../docs/evidence/T10/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const [width, height] of [
  [390, 844],
  [360, 640],
  [1280, 800],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto('http://localhost:5173/profile-choice?session=signed-out');
  await page.waitForSelector('[role="dialog"]');
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return `${Math.round(b.width * 10) / 10}x${Math.round(b.height * 10) / 10} @ ${Math.round(b.left)},${Math.round(b.top)}`;
    };
    const dlg = document.querySelector('[role="dialog"]');
    const cs = getComputedStyle(dlg);
    const overlay = document.querySelector('[data-slot="sheet-overlay"]');
    const h1 = dlg.querySelector('h1');
    const buttons = [...dlg.querySelectorAll('button')];
    const close = buttons.find((b) => b.getAttribute('aria-label') === 'Fechar');
    const frame = document.querySelector('[data-screen]').parentElement;
    const hint = dlg.querySelector('p:last-of-type');
    return {
      frame: r(frame),
      sheet: r(dlg),
      radius: cs.borderTopLeftRadius,
      pad: cs.padding,
      bg: cs.backgroundColor,
      gap: cs.rowGap,
      overlay: `${r(overlay)} ${getComputedStyle(overlay).backgroundColor}`,
      h1: `${getComputedStyle(h1).fontSize}/${getComputedStyle(h1).lineHeight} ${getComputedStyle(h1).fontWeight}`,
      buttons: buttons.filter((b) => b !== close).map((b) => `${b.textContent} ${r(b)}`),
      close: r(close),
      hint: `${getComputedStyle(hint).fontSize}/${getComputedStyle(hint).lineHeight}`,
      insideFrame: frame.contains(dlg),
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  console.log(`${width}x${height}`, JSON.stringify(m));
  await page.screenshot({ path: `${outDir}profile-choice-${width}x${height}.png` });
  await page.close();
}
await browser.close();
