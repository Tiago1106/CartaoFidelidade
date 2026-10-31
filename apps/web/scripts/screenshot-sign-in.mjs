// Captures the sign-in screens into docs/evidence/T11/ and prints key measures.
// Requires `pnpm dev` on http://localhost:5173. The code to type is 123456 (simulated).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const outDir = fileURLToPath(new URL('../../../docs/evidence/T11/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const measures = (page) =>
  page.evaluate(() => {
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return `${Math.round(b.width * 10) / 10}x${Math.round(b.height * 10) / 10} @ ${Math.round(b.left)},${Math.round(b.top)}`;
    };
    const form = document.querySelector('[data-screen]');
    const h1 = form.querySelector('h1');
    const back = form.querySelector('button[aria-label="Voltar"]');
    const buttons = [...form.querySelectorAll('button')].filter((b) => b !== back);
    const main = buttons.at(-1);
    return {
      back: r(back),
      h1: `${getComputedStyle(h1).fontSize}/${getComputedStyle(h1).lineHeight} ${getComputedStyle(h1).fontWeight} ${getComputedStyle(h1).letterSpacing} @ y=${Math.round(h1.getBoundingClientRect().top)}`,
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
  await page.goto('http://localhost:5173/sign-in?session=signed-out');
  await page.waitForSelector('[data-screen="sign-in"]');
  await page.evaluate(() => document.fonts.ready);
  console.log(`${width}x${height} phone empty`, JSON.stringify(await measures(page)));
  await page.screenshot({ path: `${outDir}sign-in-phone-empty-${width}x${height}.png` });

  await page.getByLabel('Celular').fill('11900000000');
  await page.screenshot({ path: `${outDir}sign-in-phone-filled-${width}x${height}.png` });

  await page.getByLabel('Celular').fill('1190');
  await page.getByLabel('Celular').blur();
  await page.screenshot({ path: `${outDir}sign-in-phone-error-${width}x${height}.png` });

  await page.getByLabel('Celular').fill('11900000000');
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await page.waitForSelector('[data-screen="sign-in-code"]');
  await page.evaluate(() => document.fonts.ready);
  await page.getByLabel('Código de verificação de 6 dígitos').fill('482');
  console.log(`${width}x${height} code`, JSON.stringify(await measures(page)));
  await page.screenshot({ path: `${outDir}sign-in-code-partial-${width}x${height}.png` });

  await page.getByLabel('Código de verificação de 6 dígitos').fill('000000');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.waitForSelector('[role="alert"]');
  await page.screenshot({ path: `${outDir}sign-in-code-error-${width}x${height}.png` });
  await page.close();
}
await browser.close();
