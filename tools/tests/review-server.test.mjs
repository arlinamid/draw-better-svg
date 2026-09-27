// End-to-end test of scripts/review_server.mjs without a browser: token gate,
// page, one Send, the round on disk, --wait returning it, and --once exiting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../plugins/draw-better-svg/skills/draw-better-svg/scripts/review_server.mjs', import.meta.url));
const SVG = fileURLToPath(new URL('./fixtures/logo.svg', import.meta.url));

function firstLine(child) {
  return new Promise((resolve, reject) => {
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      const nl = buf.indexOf('\n');
      if (nl !== -1) resolve(JSON.parse(buf.slice(0, nl)));
    });
    child.once('exit', (code) => reject(new Error(`exited early with ${code}`)));
  });
}
const exited = (child) => new Promise((resolve) => child.on('exit', (code) => resolve(code)));
function collect(child) { let s = ''; child.stdout.on('data', (d) => { s += d; }); return () => s; }

test('serve, send one round, wait returns it, --once exits', { timeout: 60000 }, async () => {
  const out = mkdtempSync(join(tmpdir(), 'dbs-review-'));
  try {
    const server = spawn(process.execPath, [SCRIPT, SVG, '--out', out, '--port', '0', '--once'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const serverExit = exited(server); // listen before the process can exit
    const ready = await firstLine(server);
    assert.equal(ready.event, 'ready');
    const url = new URL(ready.url);
    const token = url.searchParams.get('k');

    assert.equal((await fetch(new URL('/', url.origin))).status, 403);
    const page = await (await fetch(ready.url)).text();
    for (const part of ['id="dbs-stage"', 'window.__dbsReview', '"endpoint":"/feedback?k=']) assert.ok(page.includes(part), part);

    const waiter = spawn(process.execPath, [SCRIPT, '--wait', out, '--timeout', '30'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const waited = collect(waiter);
    const waiterExit = exited(waiter);
    await new Promise((r) => setTimeout(r, 700));

    const body = {
      schema: 'draw-better-svg/review@1', status: 'changes', note: 'Make the dot smaller',
      comments: [{ n: 1, x: 87, y: 33, t: null, text: 'Too big', target: { label: 'circle#dot' } }],
      markup: { items: [], svg: '<path data-kind="pen" data-t="" d="M1 1 L10 10" stroke="red"/>' },
      pins: '<g data-comment="1" data-t=""><circle cx="87" cy="33" r="5"/></g>',
      times: [], summary: '1. (87, 33) on circle#dot: Too big',
    };
    const bad = await fetch(new URL('/feedback', url.origin), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(bad.status, 403);
    const res = await fetch(new URL('/feedback', url.origin), { method: 'POST', headers: { 'content-type': 'application/json', 'x-dbs-token': token }, body: JSON.stringify(body) });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { round: 1 });

    assert.equal(await waiterExit, 0);
    const fb = JSON.parse(waited());
    assert.equal(fb.round, 1);
    assert.equal(fb.comments[0].target.label, 'circle#dot');
    assert.match(fb.sha256, /^[0-9a-f]{64}$/);
    // The agent also gets the checks the user saw, re-run on the current file.
    const contrast = fb.checks.groups.find((g) => g.name === 'Contrast');
    assert.ok(contrast.items.some((x) => x.includes('text#wordmark')));
    assert.match(fb.summary, /Open checks \(\d+\):[\s\S]*Contrast: dark: text#wordmark/);
    assert.ok(existsSync(join(out, 'round-01', 'feedback.json')));
    assert.ok(readFileSync(join(out, 'round-01', 'annotated.svg'), 'utf8').includes('id="dbs-review"'));
    assert.equal(await serverExit, 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
