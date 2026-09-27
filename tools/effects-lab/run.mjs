#!/usr/bin/env node
// Effects lab: render every recipe in Chromium, librsvg (sharp), and resvg,
// then measure (1) whether the effect is visible against its baseline and
// (2) how far the three renderers disagree. Writes PNGs, results.json, a
// contact sheet (index.html), and per-section overview PNGs to review/effects-lab/.
//
//   npm ci --prefix plugins/draw-better-svg/skills/draw-better-svg/scripts
//   npm install --prefix tools/effects-lab
//   node tools/effects-lab/run.mjs [--only id,id]
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import recipes from './recipes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SCRIPTS = join(ROOT, 'plugins', 'draw-better-svg', 'skills', 'draw-better-svg', 'scripts');
const req = createRequire(join(SCRIPTS, 'package.json'));
const sharp = req('sharp');
const { chromium } = req('playwright-core');
const { Resvg } = createRequire(join(HERE, 'package.json'))('@resvg/resvg-js');
const { launchBrowser } = await import(pathToFileURL(join(SCRIPTS, 'lib', 'browser.mjs')));

const OUT = join(ROOT, 'review', 'effects-lab');
const SCALE = 2;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const list = recipes.filter((r) => !only || only.includes(r.id));

const size = (svg) => {
  const m = svg.match(/<svg[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"/);
  return { w: Number(m[1]), h: Number(m[2]) };
};

async function renderChromium(page, file, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(pathToFileURL(file).href);
  return page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
}
const renderLibrsvg = (svg) => sharp(Buffer.from(svg), { density: 72 * SCALE }).flatten({ background: '#ffffff' }).png().toBuffer();
function renderResvg(svg, w) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: w * SCALE }, background: '#ffffff', font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } });
  return r.render().asPng();
}

async function raw(png, w, h) {
  const { data } = await sharp(png).flatten({ background: '#ffffff' }).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}
// Mean absolute channel difference (0-255) and share of pixels whose largest
// channel difference exceeds 24 — a visible change, not antialiasing noise.
async function compare(a, b, w, h) {
  const [x, y] = await Promise.all([raw(a, w, h), raw(b, w, h)]);
  let sum = 0, changed = 0;
  const heat = Buffer.alloc(w * h);
  for (let i = 0, p = 0; i < x.length; i += 3, p++) {
    const d = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2]));
    sum += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]);
    if (d > 24) changed++;
    heat[p] = Math.min(255, d * 4);
  }
  const heatPng = await sharp(heat, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  return { mean: +(sum / x.length).toFixed(2), changedPct: +((100 * changed) / (w * h)).toFixed(2), heatPng };
}

function audit(file) {
  const py = spawnSync('python3', ['--version']).status === 0 ? 'python3' : 'python';
  const r = spawnSync(py, [join(SCRIPTS, 'audit_svg.py'), file, '--json'], { encoding: 'utf8' });
  try {
    const [rep] = JSON.parse(r.stdout);
    return { errors: rep.errors, warnings: rep.warnings.length };
  } catch {
    return { errors: [`audit failed: ${r.stderr}`], warnings: 0 };
  }
}

await mkdir(OUT, { recursive: true });
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ deviceScaleFactor: SCALE });
const results = [];

for (const r of list) {
  const dir = join(OUT, r.id);
  await mkdir(dir, { recursive: true });
  const { w, h } = size(r.test);
  const W2 = w * SCALE, H2 = h * SCALE;
  const files = { test: join(dir, 'test.svg'), baseline: join(dir, 'baseline.svg') };
  await writeFile(files.test, r.test);
  await writeFile(files.baseline, r.baseline);

  const out = { id: r.id, section: r.section, title: r.title, source: r.source, claim: r.claim, bytesAdded: Buffer.byteLength(r.test) - Buffer.byteLength(r.baseline), renders: {}, errors: {} };
  const png = {};
  for (const [name, fn] of [
    ['chromium', async (kind) => renderChromium(page, files[kind], w, h)],
    ['librsvg', async (kind) => renderLibrsvg(r[kind])],
    ['resvg', async (kind) => renderResvg(r[kind], w)],
  ]) {
    try {
      const t0 = performance.now();
      png[name] = await fn('test');
      out.renders[name] = { ms: Math.round(performance.now() - t0) };
      png[`${name}-baseline`] = await fn('baseline');
      await writeFile(join(dir, `${name}.png`), png[name]);
      await writeFile(join(dir, `${name}-baseline.png`), png[`${name}-baseline`]);
    } catch (e) {
      out.errors[name] = e.message.split('\n')[0];
    }
  }
  for (const name of ['chromium', 'librsvg', 'resvg']) {
    if (!png[name]) continue;
    const eff = await compare(png[name], png[`${name}-baseline`], W2, H2);
    out.renders[name].effect = { mean: eff.mean, changedPct: eff.changedPct };
    if (name !== 'chromium' && png.chromium) {
      const par = await compare(png[name], png.chromium, W2, H2);
      out.renders[name].vsChromium = { mean: par.mean, changedPct: par.changedPct };
      await writeFile(join(dir, `${name}-vs-chromium.png`), par.heatPng);
    }
  }
  out.audit = audit(files.test);
  results.push(out);
  const c = out.renders;
  console.log(`${r.id.padEnd(32)} effect chromium ${c.chromium?.effect?.changedPct ?? '-'}%  librsvg≠chromium ${c.librsvg?.vsChromium?.changedPct ?? '-'}%  resvg≠chromium ${c.resvg?.vsChromium?.changedPct ?? '-'}%  audit errors ${out.audit.errors.length}`);
}
await browser.close();
await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 2));

// ------------------------------------------------------------ overview sheets

const label = (text, width, height = 28, size = 15) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/>` +
  `<text x="6" y="${height - 9}" font-family="Arial" font-size="${size}" fill="#111">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

const CELL = 300;
const cols = ['chromium-baseline', 'chromium', 'librsvg', 'resvg'];
for (const section of [...new Set(results.map((r) => r.section))]) {
  const rows = results.filter((r) => r.section === section);
  const rowH = 28 + 230;
  const composites = [];
  for (const [i, r] of rows.entries()) {
    const top = i * rowH;
    composites.push({ input: label(`${r.id} — ${r.title}`, CELL * cols.length, 28, 16), top, left: 0 });
    for (const [j, col] of cols.entries()) {
      const file = join(OUT, r.id, `${col}.png`);
      try {
        const img = await sharp(file).resize(CELL - 8, 200, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
        composites.push({ input: img, top: top + 28, left: j * CELL + 4 });
      } catch { /* renderer failed; leave the cell empty */ }
      composites.push({ input: label(col, CELL, 26, 13), top: top + 28 + 202, left: j * CELL });
    }
  }
  const name = section.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await sharp({ create: { width: CELL * cols.length, height: rows.length * rowH, channels: 3, background: '#ffffff' } })
    .composite(composites).png().toFile(join(OUT, `sheet-${name}.png`));
}

// ------------------------------------------------------------ contact sheet

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmt = (v) => (v === undefined ? '–' : `${v}%`);
const html = `<!doctype html><meta charset="utf-8"><title>Effects lab</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;color:#1f2a30}table{border-collapse:collapse}td,th{border-top:1px solid #ddd;padding:6px;vertical-align:top;text-align:left}img{width:220px;background:#fff;border:1px solid #eee}.n{font-variant-numeric:tabular-nums;white-space:nowrap}</style>
<h1>Effects lab</h1><p>Effect = pixels visibly changed against the baseline. Parity = pixels where the renderer differs visibly from Chromium.</p>
<table><tr><th>Recipe</th><th>Chromium</th><th>librsvg</th><th>resvg</th><th>Numbers</th></tr>
${results.map((r) => `<tr><td><b>${esc(r.id)}</b><br>${esc(r.title)}<br><small>${esc(r.source)}${r.claim ? `<br>Claim: ${esc(r.claim)}` : ''}</small></td>
${['chromium', 'librsvg', 'resvg'].map((n) => `<td>${r.errors[n] ? esc(r.errors[n]) : `<img src="${r.id}/${n}.png" loading="lazy">`}</td>`).join('')}
<td class="n">effect: ${fmt(r.renders.chromium?.effect?.changedPct)} / ${fmt(r.renders.librsvg?.effect?.changedPct)} / ${fmt(r.renders.resvg?.effect?.changedPct)}<br>
librsvg≠chromium: ${fmt(r.renders.librsvg?.vsChromium?.changedPct)}<br>resvg≠chromium: ${fmt(r.renders.resvg?.vsChromium?.changedPct)}<br>
+${r.bytesAdded} bytes<br>audit errors: ${r.audit.errors.length} ${esc(r.audit.errors.join('; '))}</td></tr>`).join('\n')}
</table>`;
await writeFile(join(OUT, 'index.html'), html);
console.log(`\n${results.length} recipes → ${OUT}`);
