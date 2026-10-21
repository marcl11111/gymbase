import { chromium } from 'playwright';
const OUT = new URL('./screenshots', import.meta.url).pathname; await import('node:fs').then(fs=>fs.mkdirSync(OUT,{recursive:true}));
const base = 'http://localhost:4173/';
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); } };

await page.goto(base);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/01-splash.png` });
await step('Intro überspringen', async () => { await page.getByText('Intro überspringen').click(); await page.waitForTimeout(800); });
await page.screenshot({ path: `${OUT}/02-dashboard.png` });
await page.mouse.wheel(0, 600); await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/03-dashboard-scroll.png` });

await step('Übungen öffnen & Anzahl', async () => {
  await page.getByRole('link', { name: 'Übungen' }).first().click();
  await page.waitForSelector('article');
  const t = await page.getByText(/^\d+ Übungen$/).first().textContent();
  console.log('     Ergebnis:', t);
});
await step('Suche "rudern"', async () => {
  await page.locator('#f-search').fill('rudern');
  await page.waitForTimeout(600);
  console.log('     Treffer:', await page.locator('article').count());
});
await step('Filter Brust + Maschine kombiniert', async () => {
  await page.locator('#f-search').fill('');
  await page.getByRole('button', { name: 'Brust', exact: true }).first().click();
  await page.getByRole('button', { name: 'Maschine', exact: true }).first().click();
  await page.waitForTimeout(600);
  console.log('     Treffer:', await page.locator('article').count());
});
await step('Fotoanleitung auf Karte öffnen/schließen', async () => {
  const btn = page.locator('article').first().getByRole('button', { name: 'Fotoanleitung anzeigen' });
  await btn.click(); await page.waitForTimeout(700);
  const imgs = await page.locator('article').first().locator('ol img').count();
  console.log('     Bilder nach Öffnen:', imgs);
  await page.screenshot({ path: `${OUT}/04-photoguide-card.png` });
  await page.locator('article').first().getByRole('button', { name: 'Fotoanleitung ausblenden' }).click(); await page.waitForTimeout(600);
  console.log('     Bilder nach Schließen:', await page.locator('article').first().locator('ol img').count());
});
await step('Filter zurücksetzen', async () => { await page.getByRole('button', { name: 'Alle Filter zurücksetzen' }).click(); await page.waitForTimeout(400); console.log('     Karten:', await page.locator('article').count()); });
await step('Favorit setzen', async () => { await page.locator('article').first().getByRole('button', { name: /zu Favoriten hinzufügen/ }).click(); });
await step('Detailseite', async () => {
  await page.locator('article').first().getByRole('link', { name: 'Details', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/05-detail.png` });
  await page.getByRole('button', { name: 'Fotoanleitung anzeigen' }).click(); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/06-detail-guide.png`, fullPage: false });
  await page.locator('button[aria-label^="Bild vergrößern"]').first().click(); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/07-lightbox.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
});

// Generator
await step('Generator durchlaufen (4 Tage)', async () => {
  await page.goto(base + '#/plaene/generator'); await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Muskelaufbau/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: /^Fortgeschritten/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: '4 Tage' }).click();
  const weiterDisabled = await page.getByRole('button', { name: 'Weiter' }).isDisabled();
  console.log('     Weiter gesperrt bei Mismatch:', weiterDisabled);
  await page.getByRole('button', { name: 'Dienstag' }).click();
  await page.screenshot({ path: `${OUT}/08-gen-days.png` });
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click(); // muskeln
  await page.screenshot({ path: `${OUT}/09-gen-split.png` });
  await page.getByRole('button', { name: 'Weiter' }).click(); // split
  await page.getByRole('button', { name: /60 Minuten/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Plan generieren' }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/10-gen-result.png` });
  const firstDayBefore = await page.locator('[role=tabpanel], section[aria-label="Aktueller Trainingstag"] ul li').allTextContents();
  await page.getByRole('tab').nth(1).click();
  await page.getByRole('button', { name: /Tag neu generieren/ }).click(); await page.waitForTimeout(400);
  await page.getByRole('tab').nth(0).click();
  const firstDayAfter = await page.locator('section[aria-label="Aktueller Trainingstag"] ul li').allTextContents();
  console.log('     Tag 1 unverändert nach Neugenerierung Tag 2:', JSON.stringify(firstDayBefore) === JSON.stringify(firstDayAfter));
  await page.getByRole('button', { name: 'Plan übernehmen' }).click(); await page.waitForTimeout(800);
  console.log('     Pläne:', await page.locator('article').count());
});

await step('Plan bleibt nach Reload', async () => { await page.reload(); await page.waitForTimeout(800); console.log('     Pläne nach Reload:', await page.locator('article').count()); });

await step('Editor: Übung hinzufügen + speichern', async () => {
  await page.getByRole('link', { name: 'Bearbeiten' }).first().click(); await page.waitForTimeout(700);
  const before = await page.locator('section[aria-label="Aktueller Trainingstag"] > ul > li, section[aria-label="Aktueller Trainingstag"] ul.space-y-2 > li').count();
  await page.locator('#pick-search').fill('face pulls');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Face Pulls zu/ }).click(); await page.waitForTimeout(500);
  const after = await page.locator('section[aria-label="Aktueller Trainingstag"] ul.space-y-2 > li').count();
  console.log('     Übungen vorher/nachher:', before, after);
  await page.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/11-editor.png` });
});

await step('Training starten, Sätze, Reload, Beenden', async () => {
  await page.goto(base + '#/training'); await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Starten' }).first().click(); await page.waitForTimeout(700);
  await page.getByLabel(/Satz 1 Gewicht/).fill('60');
  await page.getByLabel(/Satz 1 Wiederholungen/).fill('10');
  await page.getByRole('button', { name: 'Satz 1 abhaken' }).click(); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/12-training.png` });
  await page.reload(); await page.waitForTimeout(900);
  const val = await page.getByLabel(/Satz 1 Gewicht/).inputValue();
  console.log('     Gewicht nach Reload:', val, '| Satz 1 erledigt:', await page.getByRole('button', { name: 'Satz 1 als offen markieren' }).count());
  await page.getByLabel(/Satz 2 Gewicht/).fill('65');
  await page.getByLabel(/Satz 2 Wiederholungen/).fill('8');
  await page.getByRole('button', { name: 'Satz 2 abhaken' }).click();
  await page.getByRole('button', { name: 'Beenden' }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Beenden und speichern' }).click(); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/13-summary.png` });
});

await step('Fortschritt', async () => {
  await page.goto(base + '#/fortschritt'); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/14-progress.png`, fullPage: true });
  console.log('     Historie-Einträge:', await page.locator('#hist-h + ul > li').count());
});

await step('Einstellungen: Light + Pfund', async () => {
  await page.goto(base + '#/einstellungen'); await page.waitForTimeout(600);
  await page.getByRole('radio', { name: /Hell/ }).click();
  await page.getByRole('radio', { name: /Pfund/ }).click();
  await page.goto(base + '#/'); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/15-light-dashboard.png` });
  await page.goto(base + '#/einstellungen'); await page.waitForTimeout(400);
  await page.getByRole('radio', { name: /Dunkel/ }).click();
  await page.getByRole('radio', { name: /Kilogramm/ }).click();
});

await step('Export', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Daten exportieren/ }).click()]);
  await dl.saveAs(`${OUT}/export.json`);
});

await step('Dashboard nach Training', async () => {
  await page.goto(base + '#/'); await page.waitForTimeout(1200);
  await page.mouse.wheel(0, 1400); await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/16-dashboard-data.png` });
});

// Mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage();
mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
await mp.goto(base); await mp.waitForTimeout(600);
await mp.getByText('Intro überspringen').click().catch(() => {}); await mp.waitForTimeout(800);
await mp.screenshot({ path: `${OUT}/20-m-dashboard.png` });
await mp.goto(base + '#/uebungen'); await mp.waitForTimeout(900);
await mp.screenshot({ path: `${OUT}/21-m-exercises.png` });
const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
console.log('Mobile scrollWidth (soll 390):', sw);
await mp.goto(base + '#/plaene/generator'); await mp.waitForTimeout(700);
await mp.screenshot({ path: `${OUT}/22-m-generator.png` });

// Reduced motion
const rm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const rp = await rm.newPage();
rp.on('pageerror', (e) => errors.push('rm pageerror: ' + e.message));
await rp.goto(base); await rp.waitForTimeout(500);
console.log('Splash bei reduced motion sichtbar:', await rp.locator('#splash').count());
await rp.goto(base + '#/uebungen'); await rp.waitForTimeout(500);
const op = await rp.locator('article').first().evaluate((el) => getComputedStyle(el).opacity);
console.log('Karte opacity bei reduced motion:', op);

console.log('\nKonsolenfehler/Warnungen:', errors.length ? errors.join('\n') : 'keine');
await browser.close();
