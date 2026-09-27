#!/usr/bin/env node
// Browser-only claims that a static renderer cannot test. Each check prints
// PASS/FAIL with the measured values and writes review/effects-lab/anim-checks.json.
//
//   node tools/effects-lab/anim-checks.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SCRIPTS = join(ROOT, 'plugins', 'draw-better-svg', 'skills', 'draw-better-svg', 'scripts');
const req = createRequire(join(SCRIPTS, 'package.json'));
const sharp = req('sharp');
const { launchBrowser } = await import(pathToFileURL(join(SCRIPTS, 'lib', 'browser.mjs')));
const OUT = join(ROOT, 'review', 'effects-lab', 'anim');
await mkdir(OUT, { recursive: true });

const browser = await launchBrowser();
const results = [];
const record = (id, claim, pass, detail) => {
  results.push({ id, claim, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}: ${detail}`);
};

async function pixelDelta(a, b) {
  const [x, y] = await Promise.all([a, b].map((p) => sharp(p).removeAlpha().raw().toBuffer()));
  let n = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 24) n++;
  return n;
}

// 1-2. Does animation inside an SVG run when the SVG is shown through <img>?
const cssSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><style>@keyframes m{from{transform:translateX(0)}to{transform:translateX(140px)}} .b{animation:m 1s linear infinite alternate}</style><rect class="b" x="10" y="30" width="40" height="40" fill="#e8743b"/></svg>';
const smilSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect x="10" y="30" width="40" height="40" fill="#2f6f73"><animate attributeName="x" values="10;150;10" dur="1s" repeatCount="indefinite"/></rect></svg>';
for (const [id, markup, claim] of [
  ['img-css-animation', cssSvg, 'CSS animations inside an SVG do NOT run when the SVG is used as <img> (svg-creator).'],
  ['img-smil-animation', smilSvg, 'SMIL runs when the SVG is used as <img> (svg-creator).'],
]) {
  const file = join(OUT, `${id}.svg`);
  await writeFile(file, markup);
  const page = await browser.newPage({ viewport: { width: 220, height: 120 } });
  const host = join(OUT, `${id}.html`);
  await writeFile(host, `<body style="margin:0"><img src="${id}.svg" width="200" height="100"></body>`);
  await page.goto(pathToFileURL(host).href);
  const loaded = await page.evaluate(() => document.images[0].complete && document.images[0].naturalWidth > 0);
  if (!loaded) throw new Error(`${id}: the <img> did not load`);
  await page.waitForTimeout(150);
  const a = await page.screenshot();
  await page.waitForTimeout(400);
  const b = await page.screenshot();
  const moved = await pixelDelta(a, b);
  const runs = moved > 200;
  record(id, claim, id === 'img-smil-animation' ? runs : !runs, `animation ${runs ? 'runs' : 'does not run'} in <img> (${moved} changed channel samples)`);
  await page.close();
}

// 3. Custom property as a keyframe's animation-timing-function.
{
  const page = await browser.newPage();
  await page.setContent(`<style>
    :root { --ease: cubic-bezier(0.9, 0, 1, 0.1); }
    .box { width: 10px; height: 10px; position: absolute; }
    #lit { animation: slide 1000ms linear both paused; }
    #tok { animation: slide2 1000ms linear both paused; }
    #lin { animation: slide3 1000ms linear both paused; }
    @keyframes slide { from { left: 0; animation-timing-function: cubic-bezier(0.9, 0, 1, 0.1); } to { left: 1000px; } }
    @keyframes slide2 { from { left: 0; animation-timing-function: var(--ease); } to { left: 1000px; } }
    @keyframes slide3 { from { left: 0; } to { left: 1000px; } }
  </style><div class="box" id="lit"></div><div class="box" id="tok"></div><div class="box" id="lin"></div>`);
  const at = await page.evaluate(() => {
    for (const a of document.getAnimations()) a.currentTime = 500;
    return ['lit', 'tok', 'lin'].map((id) => parseFloat(getComputedStyle(document.getElementById(id)).left));
  });
  const [lit, tok, lin] = at;
  const dropped = Math.abs(tok - lin) < 1 && Math.abs(lit - lin) > 50;
  record('keyframe-easing-var', 'var() as animation-timing-function inside @keyframes is silently dropped in Chromium (pixel2motion).',
    dropped, `at t=500ms: literal ${lit.toFixed(1)}px, var() ${tok.toFixed(1)}px, linear ${lin.toFixed(1)}px → var() ${dropped ? 'falls back to linear' : 'is applied'}`);
  await page.close();
}

// 4. pathLength="1" draw-on in the browser; 5. prefers-reduced-motion override.
{
  const page = await browser.newPage();
  await page.setContent(`<svg width="300" height="120" viewBox="0 0 300 120"><style>
    .d { stroke-dasharray: 1 1; stroke-dashoffset: 1; animation: draw 1000ms linear both paused; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
  </style><path class="d" pathLength="1" d="M20 60 H280" stroke="#1f2a30" stroke-width="12" fill="none"/></svg>`);
  const offsets = await page.evaluate(() => [0, 500, 1000].map((t) => {
    for (const a of document.getAnimations()) a.currentTime = t;
    return getComputedStyle(document.querySelector('.d')).strokeDashoffset;
  }));
  record('pathlength-draw-on', 'pathLength="1" normalizes dash animation in the browser.', offsets.join() === '1px,0.5px,0px' || offsets.join() === '1,0.5,0',
    `stroke-dashoffset at 0/500/1000 ms: ${offsets.join(', ')}`);
  await page.close();
}
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.setContent(`<style>
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }
    #b { position: absolute; left: 0; animation: go 2000ms ease both; } @keyframes go { to { left: 400px; } }
  </style><div id="b">x</div>`);
  await page.waitForTimeout(100);
  const left = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('b')).left));
  record('reduced-motion-snippet', 'The reduced-motion snippet lands animations on their final state immediately.', Math.abs(left - 400) < 1, `left after 100 ms with reduce: ${left}px`);
  await ctx.close();
}

// 6. Draw-on start state: which dash setups leave ink on screen at t = 0?
// Measured on a closed circle (start = end) and an open curve, butt and round caps.
{
  const page = await browser.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 2 });
  const variants = [
    ['dasharray 1 1, offset 1', 'stroke-dasharray:1 1;stroke-dashoffset:1'],
    ['dasharray 1 2, offset 1', 'stroke-dasharray:1 2;stroke-dashoffset:1'],
    ['dasharray 0 1 (grows to 1 0)', 'stroke-dasharray:0 1;stroke-dashoffset:0'],
    ['dasharray 1 1.2, offset 1.1', 'stroke-dasharray:1 1.2;stroke-dashoffset:1.1'],
  ];
  const shapes = [
    ['closed circle', '<circle cx="100" cy="100" r="60" pathLength="1" fill="none" stroke="#000" stroke-width="16" style="STYLE"/>'],
    ['open curve', '<path d="M30 150 C60 20 140 20 170 150" pathLength="1" fill="none" stroke="#000" stroke-width="16" style="STYLE"/>'],
  ];
  const rows = [];
  for (const cap of ['butt', 'round']) {
    for (const [shape, markup] of shapes) {
      for (const [name, style] of variants) {
        await page.setContent(`<body style="margin:0;background:#fff"><svg width="200" height="200" viewBox="0 0 200 200">${markup.replace('STYLE', `${style};stroke-linecap:${cap}`)}</svg></body>`);
        const png = await page.screenshot();
        const { data } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
        let ink = 0;
        for (const v of data) if (v < 200) ink++;
        rows.push({ cap, shape, variant: name, inkPixels: ink });
      }
    }
  }
  const clean = variants.map(([name]) => name).filter((name) => rows.filter((r) => r.variant === name).every((r) => r.inkPixels === 0));
  record('draw-on-start-artifact', 'Which dash setups show no ink before the draw starts (pixel2motion artifact table).',
    clean.length > 0, `clean in every case: ${clean.join('; ') || 'none'} — ${rows.filter((r) => r.inkPixels).map((r) => `${r.variant}/${r.cap}/${r.shape}: ${r.inkPixels}px`).join(', ')}`);
  results.at(-1).rows = rows;
  await page.close();
}

// 7. Dark-mode variant inside the SVG: does @media (prefers-color-scheme: dark)
// apply when the SVG is an <img>, and what do static renderers do with it?
{
  const themed = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><style>#t{fill:#1f2a30}@media (prefers-color-scheme: dark){#t{fill:#f4f1ea}}</style><rect id="t" x="10" y="10" width="80" height="80"/></svg>';
  const file = join(OUT, 'themed.svg');
  await writeFile(file, themed);
  await writeFile(join(OUT, 'themed.html'), '<body style="margin:0"><img src="themed.svg" width="100" height="100"></body>');
  const centre = async (png) => {
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const i = ((info.height >> 1) * info.width + (info.width >> 1)) * 3;
    return (data[i] + data[i + 1] + data[i + 2]) / 3 > 128 ? 'light fill' : 'dark fill';
  };
  const seen = {};
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 100, height: 100 } });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(join(OUT, 'themed.html')).href);
    await page.waitForFunction(() => document.images[0].complete);
    seen[`img, ${scheme} scheme`] = await centre(await page.screenshot());
    await ctx.close();
  }
  seen['librsvg (sharp)'] = await centre(await sharp(Buffer.from(themed)).png().toBuffer());
  record('svg-prefers-color-scheme', 'An SVG can carry its own dark variant with @media (prefers-color-scheme: dark).',
    seen['img, light scheme'] === 'dark fill' && seen['img, dark scheme'] === 'light fill',
    Object.entries(seen).map(([k, v]) => `${k}: ${v}`).join('; '));
}

await browser.close();
await writeFile(join(OUT, '..', 'anim-checks.json'), JSON.stringify(results, null, 2));
