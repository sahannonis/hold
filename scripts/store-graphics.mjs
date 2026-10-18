// Renders the Play Store graphics from the real game (dist/, with bundled fonts):
//   store/screenshot-1..5.png  1080x1920, captioned, 24-bit PNG (no alpha)
//   store/feature-graphic.png  1024x500, 24-bit PNG (no alpha)
//   store/icon-512.png         512x512, 32-bit PNG
// Run after scripts/build-web.mjs. Needs playwright + sharp.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'store');
mkdirSync(out, { recursive: true });
const INK = '#0e0b10';

const faces = readFileSync(join(dist, 'index.html'), 'utf8').match(/@font-face\{[^}]+\}/g).join('\n');
const flat = buf => sharp(buf).flatten({ background: INK }).removeAlpha().png().toBuffer();

const browser = await chromium.launch();

// ---------- game screens (360x640 css px at 3x = 1080x1920) ----------
async function game(seed) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.clock.install();
  if (seed) await page.addInitScript(s => { try { localStorage.setItem('hold.v1', s); } catch (e) {} }, JSON.stringify(seed));
  await page.goto('file://' + join(dist, 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(1200);
  return page;
}
// put the thumb down and follow the circle; random temptations switched off so each shot is staged
async function holdFor(page, seconds, onTick) {
  await page.mouse.move(180, 320); await page.mouse.down();
  await page.evaluate(() => { __hold.run.nextTempt = 1e9; });
  for (let i = 0; i < seconds * 10; i++) {
    await page.clock.runFor(100);
    const c = await page.evaluate(() => __hold.circle());
    if (!c) throw new Error('run ended early at ' + i / 10 + 's');
    await page.mouse.move(c.x, c.y);
    if (onTick) await onTick(i / 10);
  }
}
const shot = page => page.screenshot({ type: 'png' });

const seed = {
  best: 201.4, sound: true, buzz: true,
  runs: [201.4, 48.2, 12.9, 95.6, 33.1, 7.4].map((t, i) => ({ t, c: i === 3 ? 'out' : 'lift', at: Date.now() - i * 3.6e6 }))
};
const raw = [];

{ // 1. home
  const p = await game(seed); raw.push(await shot(p)); await p.context().close();
}
{ // 2. early hold with the whisper
  const p = await game(seed);
  await holdFor(p, 17);
  await p.evaluate(() => __hold.force('whisper')); await p.clock.runFor(700);
  raw.push(await shot(p)); await p.context().close();
}
{ // 3. drifting, hot colours
  const p = await game(seed);
  await holdFor(p, 66);
  raw.push(await shot(p)); await p.context().close();
}
{ // 4. the fake prize
  const p = await game(seed);
  await holdFor(p, 84);
  await p.evaluate(() => __hold.force('prize')); await p.clock.runFor(900);
  raw.push(await shot(p)); await p.context().close();
}
{ // 5. result: a long run, new best
  const p = await game(seed);
  await holdFor(p, 3);
  await p.evaluate(() => { __hold.run.el = 272.1; });
  await p.mouse.up(); await p.clock.runFor(900);
  raw.push(await shot(p)); await p.context().close();
}

// ---------- captioned screenshots ----------
const CAPTIONS = ['Put your thumb down.', 'Don’t let go.', 'The circle moves. Follow it.', 'Ignore the fake prizes.', 'How long can you last?'];
async function framePage(html, w, h, file) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const tmp = join(dist, '_frame.html');
  writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>${faces}\nhtml,body{margin:0;background:${INK}}</style>${html}`);
  await page.goto('file://' + tmp);
  await page.evaluate(() => document.fonts.ready);
  if (html.includes('dataset.ready')) await page.waitForFunction(() => document.body.dataset.ready === '1');
  const buf = await page.screenshot({ type: 'png' });
  writeFileSync(join(out, file), await flat(buf));
  await ctx.close();
}
for (let i = 0; i < raw.length; i++) {
  const img = 'data:image/png;base64,' + raw[i].toString('base64');
  // caption box is the same size on every screenshot, so the phone frame sits in the same place;
  // a caption that needs more than two lines is shrunk until it fits
  await framePage(`
    <div style="width:1080px;height:1920px;display:flex;flex-direction:column;align-items:center;gap:56px;padding-top:120px;box-sizing:border-box">
      <div id="cap" style="height:250px;width:960px;display:flex;align-items:center;justify-content:center">
        <h1 id="h" style="margin:0;text-align:center;color:#efe6dc;font:900 124px/0.92 'Big Shoulders Display',sans-serif;text-transform:uppercase;letter-spacing:.01em;text-wrap:balance">${CAPTIONS[i]}</h1>
      </div>
      <img src="${img}" style="width:778px;height:1384px;border-radius:48px;box-shadow:0 0 0 3px #2a2230,0 40px 140px rgba(255,90,60,.16)">
    </div>
    <script>
      const h = document.getElementById('h'); let s = 124;
      document.fonts.ready.then(() => { while (h.offsetHeight > 250 && s > 60) { s -= 4; h.style.fontSize = s + 'px'; } document.body.dataset.ready = 1; });
    </script>`, 1080, 1920, `screenshot-${i + 1}.png`);
}

// ---------- feature graphic ----------
await framePage(`
  <div style="width:1024px;height:500px;position:relative;overflow:hidden;background:${INK}">
    <svg width="1024" height="500" style="position:absolute;inset:0">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff5a3c" stop-opacity=".55"/><stop offset=".45" stop-color="#e0337a" stop-opacity=".2"/><stop offset="1" stop-color="#e0337a" stop-opacity="0"/></radialGradient>
        <linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a5cff"/><stop offset=".5" stop-color="#ff3d8b"/><stop offset="1" stop-color="#ff7a2b"/></linearGradient>
        <radialGradient id="t" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#ffd2b8" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a5c" stop-opacity=".18"/></radialGradient>
      </defs>
      <circle cx="770" cy="250" r="330" fill="url(#g)"/>
      <circle cx="770" cy="250" r="160" fill="none" stroke="url(#r)" stroke-width="20"/>
      <circle cx="770" cy="250" r="100" fill="none" stroke="#ff8a6a" stroke-opacity=".35" stroke-width="4"/>
      <ellipse cx="770" cy="250" rx="58" ry="70" fill="url(#t)"/>
    </svg>
    <div style="position:absolute;left:72px;top:96px;color:#efe6dc">
      <div style="font:900 236px/0.8 'Big Shoulders Display',sans-serif;letter-spacing:.02em">HOLD</div>
      <div style="margin-top:34px;font:500 26px/1 'DM Mono',monospace;letter-spacing:.28em;text-transform:uppercase;color:#b9adbc">Don't let go</div>
    </div>
  </div>`, 1024, 500, 'feature-graphic.png');

copyFileSync(join(root, 'assets', 'store-icon-512.png'), join(out, 'icon-512.png'));
await browser.close();

// ---------- check every file against Play's limits ----------
const want = { 'feature-graphic.png': [1024, 500], 'icon-512.png': [512, 512] };
for (let i = 1; i <= 5; i++) want[`screenshot-${i}.png`] = [1080, 1920];
for (const [f, [w, h]] of Object.entries(want)) {
  const m = await sharp(join(out, f)).metadata();
  const kb = Math.round(readFileSync(join(out, f)).length / 1024);
  const ok = m.width === w && m.height === h && (f === 'icon-512.png' ? kb <= 1024 : !m.hasAlpha);
  console.log(`${ok ? 'OK ' : 'BAD'} ${f} ${m.width}x${m.height} alpha=${m.hasAlpha} ${kb}KB`);
  if (!ok) process.exitCode = 1;
}
