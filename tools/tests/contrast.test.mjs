// node --test tools/tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contrastReport, ratio, parseColor } from '../../plugins/draw-better-svg/skills/draw-better-svg/scripts/lib/contrast.mjs';

const BG = { light: '#f8f5ee', dark: '#17242b' };
const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const wrap = (body, vb = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;

test('WCAG ratio and color parsing', () => {
  assert.equal(Math.round(ratio('#000000', '#ffffff') * 10) / 10, 21);
  assert.equal(parseColor('#abc'), '#aabbcc');
  assert.equal(parseColor('rgb(255, 0, 0)'), '#ff0000');
  assert.equal(parseColor('none'), null);
  assert.equal(parseColor('url(#g)'), 'unresolved');
});

test('dark wordmark on a transparent logo is flagged on dark only', async () => {
  const r = contrastReport(await fixture('logo.svg'), BG);
  assert.ok(r.findings.dark.some((f) => f.element.startsWith('text#wordmark') && f.ratio < 1.2));
  assert.ok(!r.findings.light.some((f) => f.element.startsWith('text#wordmark')));
});

test('a prefers-color-scheme: dark override clears the dark finding', async () => {
  const r = contrastReport(await fixture('logo-themed.svg'), BG);
  assert.deepEqual(r.findings.dark, []);
});

test('artwork with its own background: only text is judged, against that background', () => {
  const svg = wrap('<rect width="100" height="100" fill="#ffffff"/><circle cx="50" cy="50" r="20" fill="#f4f4f4"/><text x="5" y="90" fill="#eeeeee">Hi</text>');
  const r = contrastReport(svg, BG, { viewBox: [0, 0, 100, 100] });
  assert.equal(r.ownBackground, '#ffffff');
  assert.deepEqual(r.findings['own background'].map((f) => f.element), ['text "Hi"']);
});

test('a shape passes through its better paint; straight path fills are ignored', () => {
  const svg = wrap('<g fill="#17242b"><circle cx="50" cy="50" r="10" fill="#ffffff" stroke="#1f2a30"/><path d="M0 10 H100" stroke="#ffffff"/></g>');
  assert.deepEqual(contrastReport(svg, { dark: BG.dark }).findings.dark, []);
  assert.equal(contrastReport(svg, { light: BG.light }).findings.light.length, 1); // the white line on light
});

test('inheritance from groups and inline style', () => {
  const svg = wrap('<g fill="#18383c"><text x="1" y="10">0</text><text x="1" y="20" style="fill:#ffffff">1</text></g>');
  const r = contrastReport(svg, { dark: BG.dark });
  assert.deepEqual(r.findings.dark.map((f) => f.element), ['text "0"']);
});
