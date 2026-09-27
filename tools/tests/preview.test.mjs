// Smoke test for scripts/preview_html.mjs (no dependencies): both modes build,
// the review page carries every section, and the checks reach the JSON summary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../plugins/draw-better-svg/skills/draw-better-svg/scripts/preview_html.mjs', import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

function build(...args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return { json: JSON.parse(r.stdout), stderr: r.stderr };
}

test('review page: reveal, motion, sizes, checks, contrast', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dbs-preview-'));
  try {
    const out = join(dir, 'p.html');
    const { json } = build(fixture('logo.svg'), out, '--css', fixture('motion.css'), '--sizes', '32,64');
    const html = readFileSync(out, 'utf8');
    for (const part of ['id="dbs-stage"', 'data-stage-mode="motion"', 'id="mscrub"', '<h2>Target sizes</h2>', '<h3>Contrast', 'low-contrast paint']) {
      assert.ok(html.includes(part), part);
    }
    assert.deepEqual(json.sizes, [32, 64]);
    assert.equal(json.contrast.dark, 2);
    assert.equal(json.animated, true);
    assert.deepEqual(json.motionWarnings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('motion page: QA hooks present and motion lint warns', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dbs-preview-'));
  try {
    const out = join(dir, 'm.html');
    const { json } = build(fixture('logo.svg'), out, '--mode', 'motion', '--css', fixture('motion-bad.css'));
    const html = readFileSync(out, 'utf8');
    for (const hook of ["params.has('bare')", "params.has('static')", '__dbsReady', '__dbsDuration']) assert.ok(html.includes(hook), hook);
    assert.ok(json.warnings.some((w) => w.includes('var()')));
    assert.ok(json.warnings.some((w) => w.includes('prefers-reduced-motion')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
