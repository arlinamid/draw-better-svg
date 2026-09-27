#!/usr/bin/env node
// Regenerate the review-page screenshots in docs/images/ by driving the real page
// with real mouse and keyboard input. Needs the skill's Node dependencies
// (npm ci --prefix plugins/draw-better-svg/skills/draw-better-svg/scripts) and
// an installed Chrome or Edge.
//
//   node tools/docs-screenshots.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'plugins', 'draw-better-svg', 'skills', 'draw-better-svg', 'scripts');
const req = createRequire(join(SCRIPTS, 'package.json'));
const sharp = req('sharp');
const { launchBrowser } = await import(pathToFileURL(join(SCRIPTS, 'lib', 'browser.mjs')));
const OUT = join(ROOT, 'docs', 'images');
const SVG = join(ROOT, 'examples', 'bicycle-boy', 'boy-bike.svg');
mkdirSync(OUT, { recursive: true });

const rounds = mkdtempSync(join(tmpdir(), 'dbs-docs-'));
const server = spawn(process.execPath, [join(SCRIPTS, 'review_server.mjs'), SVG, '--title', 'A boy riding his bicycle', '--out', rounds, '--port', '0', '--once'], { stdio: ['ignore', 'pipe', 'inherit'] });
const ready = await new Promise((res) => server.stdout.once('data', (d) => res(JSON.parse(String(d).split('\n')[0]))));

const browser = await launchBrowser();
const center = async (page, selector) => {
  const b = await page.locator(selector).first().boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};
const shot = async (page, file, clip) => {
  const png = await page.screenshot(clip ? { clip } : {});
  await sharp(png).png({ compressionLevel: 9, palette: false }).toFile(join(OUT, file));
  console.log(`wrote docs/images/${file}`);
};

try {
  // ---- desktop: comments, an arrow, timeline markers
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1.5, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(ready.url);
  await page.waitForFunction(() => window.__dbsStage && window.__dbsReviewUI);
  await page.evaluate(() => window.__dbsStage.seek(900));

  await page.keyboard.press('c');
  let [x, y] = await center(page, '#head');
  await page.mouse.click(x + 6, y + 4);
  await page.keyboard.type('Make the smile a little wider');
  await page.keyboard.press('Enter');

  await page.evaluate(() => window.__dbsStage.seek(5400));
  [x, y] = await center(page, '#near-foot');
  await page.mouse.click(x, y);
  await page.keyboard.type('Toes point down too much on this frame');
  await page.keyboard.press('Enter');

  await page.keyboard.press('a');
  [x, y] = await center(page, '#rear-wheel');
  await page.mouse.move(x - 150, y - 150);
  await page.mouse.down();
  await page.mouse.move(x - 40, y - 40, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.fill('#note', 'Otherwise it looks great: keep the colors.');
  await page.evaluate(() => window.__dbsStage.seek(5400));
  await page.mouse.move(5, 5);
  await shot(page, 'review-page.png');

  // ---- checks dialog
  await page.click('[data-dialog="checks-dlg"]');
  await page.waitForTimeout(200);
  await shot(page, 'review-checks.png');
  await page.keyboard.press('Escape');

  // ---- phone, dark theme (before Send: --once stops the server afterwards)
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const p2 = await phone.newPage();
  await p2.goto(ready.url);
  await p2.waitForFunction(() => window.__dbsStage && window.__dbsReviewUI);
  await p2.evaluate(() => window.__dbsStage.seek(2600));
  await shot(p2, 'review-phone.png');
  await phone.close();

  // ---- send, then keep the frame the agent receives
  await page.click('#send');
  await page.waitForFunction(() => /Sent/.test(document.getElementById('status').textContent), null, { timeout: 30000 });
  const round = readdirSync(rounds).find((d) => d.startsWith('round-'));
  const fb = JSON.parse(readFileSync(join(rounds, round, 'feedback.json'), 'utf8'));
  const frame = fb.files.frames.find((f) => f.t === 5400) ?? fb.files.frames[0];
  await sharp(frame.file).resize({ width: 720 }).png({ compressionLevel: 9 }).toFile(join(OUT, 'review-agent-frame.png'));
  console.log('wrote docs/images/review-agent-frame.png');
  console.log('\nsummary the agent received:\n' + fb.summary);
  await ctx.close();
} finally {
  await browser.close();
  server.kill();
  rmSync(rounds, { recursive: true, force: true });
}
