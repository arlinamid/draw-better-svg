// Page builder shared by preview_html.mjs (static file) and review_server.mjs
// (interactive review with the agent). No dependencies besides the bundled checks.
//
// review page: a stage with a construction reveal and — when the SVG or the
//   motion CSS animates — a motion timeline; the review tools (comments, markup,
//   Send/Approve, timestamps on animated frames); target sizes on transparent,
//   light, and dark backgrounds; structural, geometry, contrast, and motion checks.
// motion page: only the animation, with QA hooks for capture_frames.mjs:
//   ?t=<ms> pauses every animation there, ?static=1 finishes them, ?bare=1 shows
//   the SVG without the motion CSS, window.__dbsReady marks a settled frame.
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { contrastReport } from './contrast.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = dirname(HERE);
const REVIEW_UI = readFileSync(join(HERE, 'review-ui.js'), 'utf8');
export const BACKGROUNDS = { light: '#f8f5ee', dark: '#17242b' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Inline copies must not smuggle script: drop scripts, handlers, prolog, doctype.
export const inlineSvg = (source) => source
  .replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\s on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '');
export const viewBoxOf = (source) => (source.match(/viewBox\s*=\s*["']([^"']+)["']/) || [])[1]?.trim().split(/[\s,]+/).map(Number);
// A literal "</style>" or "</script>" inside embedded text would end the element early.
const safeCss = (css) => css.replace(/<\/style/gi, '<\\/style');
const safeJs = (js) => js.replace(/<\/script/gi, '<\\/script');

/** Motion CSS mistakes that fail silently. Returns { animated, warnings }. */
export function motionLint(source, motionCss) {
  const allCss = motionCss + [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const animated = /@keyframes|animation\s*:|<animate|<set\b/i.test(allCss + source);
  const warnings = [];
  for (const m of allCss.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) {
    if (/animation-timing-function\s*:\s*var\(/.test(m[2])) {
      warnings.push(`@keyframes ${m[1]}: animation-timing-function uses var(); Chromium drops it and runs that segment linearly. Write the cubic-bezier() literally.`);
    }
  }
  if (animated && !/prefers-reduced-motion/.test(allCss)) {
    warnings.push('No prefers-reduced-motion rule: the delivered CSS must show the final static state under reduced motion; capture_frames.mjs checks this.');
  }
  if (animated && /animation\s*:[^;]*\binfinite\b/.test(allCss) && !/animation-play-state|iteration-count\s*:\s*\d/.test(allCss)) {
    warnings.push('An infinite loop has no stop: decay attention-grabbing loops after a few cycles unless something is actually loading.');
  }
  return { animated, warnings };
}

function runAudit(script, input) {
  for (const py of ['python3', 'python']) {
    const r = spawnSync(py, [join(SCRIPTS, script), input, '--json'], { encoding: 'utf8' });
    if (r.error || r.status === null) continue;
    try { return JSON.parse(r.stdout); } catch { return null; }
  }
  return null;
}

// ------------------------------------------------------------------ motion page

const MOTION_RUNTIME = `
(() => {
  const params = new URLSearchParams(location.search);
  const svg = document.querySelector('#stage svg');
  const anims = () => document.getAnimations();
  const smil = svg && typeof svg.pauseAnimations === 'function' && svg.querySelector('animate,animateTransform,animateMotion,set');
  const end = () => Math.max(0, ...anims().map((a) => {
    const t = a.effect?.getComputedTiming?.();
    return t && Number.isFinite(t.endTime) ? t.endTime : 0;
  }));
  window.__dbsDuration = end();
  function seek(ms) {
    for (const a of anims()) { a.pause(); a.currentTime = ms; }
    if (smil) { svg.pauseAnimations(); svg.setCurrentTime(ms / 1000); }
  }
  function finalState() {
    for (const a of anims()) {
      const t = a.effect?.getComputedTiming?.();
      if (t && Number.isFinite(t.endTime)) a.finish(); else { a.pause(); a.currentTime = 0; }
    }
    if (smil) { svg.pauseAnimations(); svg.setCurrentTime(window.__dbsDuration / 1000 || 0); }
  }
  function ready() { requestAnimationFrame(() => requestAnimationFrame(() => { window.__dbsReady = true; })); }
  const t = params.get('t');
  if (params.has('bare')) {
    document.getElementById('motion-css')?.remove();
    for (const a of anims()) a.cancel();
    if (smil) { svg.pauseAnimations(); svg.setCurrentTime(0); }
    ready();
  } else if (params.has('static')) { finalState(); ready(); }
  else if (t !== null) { seek(Number(t)); ready(); }
  else ready();
  const $ = (id) => document.getElementById(id);
  if (!$('replay')) return;
  // Finished animations without forwards fill leave getAnimations(), so restart
  // by re-inserting every stylesheet that declares keyframes.
  $('replay').onclick = () => {
    const sheets = [...document.querySelectorAll('style')].filter((s) => /@keyframes|animation/.test(s.textContent));
    const texts = sheets.map((s) => s.textContent);
    sheets.forEach((s) => { s.textContent = ''; });
    void document.body.offsetWidth;
    sheets.forEach((s, i) => { s.textContent = texts[i]; });
    for (const a of anims()) a.playbackRate = Number($('speed').value);
    if (smil) { svg.setCurrentTime(0); svg.unpauseAnimations(); }
  };
  $('speed').oninput = () => { for (const a of anims()) a.playbackRate = Number($('speed').value); $('speedv').textContent = $('speed').value + '×'; };
  $('slow').onclick = () => { $('speed').value = $('speed').value === '0.25' ? '1' : '0.25'; $('speed').oninput(); };
  $('final').onclick = finalState;
})();`;

export function motionPage({ source, motionCss = '', title = 'SVG' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — motion</title>
<style>
:root{color-scheme:light dark;--bg:#f8f5ee;--fg:#1f2a30;--line:#d9d3c7}
@media (prefers-color-scheme:dark){:root{--bg:#17242b;--fg:#e8e4dc;--line:#33454f}}
html,body{margin:0;background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif}
#stage{display:grid;place-items:center;padding:24px}
#stage svg{width:min(85vw,560px);height:auto;max-height:70vh}
.bar{display:flex;gap:12px;align-items:center;justify-content:center;padding:0 16px 16px;flex-wrap:wrap}
button{font:inherit;padding:6px 12px;border:1px solid var(--line);background:transparent;color:inherit;border-radius:6px;cursor:pointer}
</style>
<style id="motion-css">${safeCss(motionCss)}</style></head><body>
<div id="stage">${inlineSvg(source)}</div>
<div class="bar"><button id="replay">Replay</button><button id="slow">Slow motion</button>
<label>Speed <input id="speed" type="range" min="0.1" max="2" step="0.05" value="1"> <span id="speedv">1×</span></label>
<button id="final">Final frame</button></div>
<script>${safeJs(MOTION_RUNTIME)}</script></body></html>`;
}

// ------------------------------------------------------------------ review stage runtime

// Drives the stage in two modes. "reveal" replays construction with the Web
// Animations API (strokes draw, then fills appear). "motion" enables the motion
// CSS and puts every CSS animation and SMIL clock on one controllable timeline.
// window.__dbsStage exposes { mode, time(), seek(ms), setMode(m) } to the review UI.
const STAGE_RUNTIME = `
(() => {
  const host = document.getElementById('dbs-stage');
  const svg = host.querySelector('svg');
  if (!svg) return;
  const $ = (id) => document.getElementById(id);
  const motionCss = $('motion-css');
  const smil = typeof svg.pauseAnimations === 'function' && svg.querySelector('animate,animateTransform,animateMotion,set');
  const animatedStage = !!(smil || (motionCss && motionCss.textContent.trim()) || document.querySelector('svg style')?.textContent.includes('@keyframes'));
  let mode = 'reveal';

  // ---- reveal
  const skip = 'defs,clipPath,mask,pattern,symbol,marker,linearGradient,radialGradient,filter,[data-dbs-ui]';
  const els = [...svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text,use,image')].filter((el) => !el.closest(skip));
  const vb = svg.viewBox.baseVal;
  const hair = Math.max(0.5, Math.hypot(vb.width || 300, vb.height || 150) / 320);
  let ranims = [], ghosts = [], rtotal = 0;
  function rbuild() {
    rcancel();
    const speed = Number($('rspeed').value);
    let t = 0;
    const fills = [];
    for (const el of els) {
      const cs = getComputedStyle(el);
      const canDraw = typeof el.getTotalLength === 'function' && el.tagName !== 'text' && el.tagName !== 'use';
      const len = canDraw ? el.getTotalLength() : 0;
      const stroke = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 && Number(cs.strokeOpacity) > 0;
      const fill = cs.fill !== 'none' && Number(cs.fillOpacity) > 0;
      const dur = Math.min(900, Math.max(160, len * 2.2));
      const draw = (node) => ranims.push(node.animate([{ strokeDasharray: len + ' ' + len, strokeDashoffset: len }, { strokeDasharray: len + ' ' + len, strokeDashoffset: 0 }],
        { duration: dur, delay: t, fill: 'both', easing: 'cubic-bezier(0.4,0,0.2,1)' }));
      if (canDraw && len > 0 && stroke) {
        draw(el);
        if (fill) fills.push([el, 'fillOpacity', cs.fillOpacity]);
        t += dur * 0.55;
      } else if (canDraw && len > 0 && fill) {
        const g = el.cloneNode(false);
        for (const a of ['id', 'class', 'filter', 'mask']) g.removeAttribute(a);
        Object.assign(g.style, { fill: 'none', stroke: /^rgb|^#/.test(cs.fill) ? cs.fill : '#555', strokeWidth: hair * 1.6, strokeOpacity: 0.85, opacity: 1 });
        g.setAttribute('aria-hidden', 'true');
        el.after(g); ghosts.push(g);
        draw(g);
        fills.push([el, 'opacity', cs.opacity, g]);
        t += dur * 0.55;
      } else {
        fills.push([el, 'opacity', cs.opacity]);
      }
    }
    t += 200;
    fills.forEach(([el, prop, to, ghost], i) => {
      const delay = t + i * 70;
      ranims.push(el.animate([{ [prop]: 0 }, { [prop]: to }], { duration: 420, delay, fill: 'both', easing: 'ease-out' }));
      if (ghost) ranims.push(ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: delay + 200, fill: 'both' }));
    });
    rtotal = Math.max(t + fills.length * 70 + 700, 400);
    for (const a of ranims) a.playbackRate = speed;
  }
  function rcancel() { for (const a of ranims) a.cancel(); for (const g of ghosts) g.remove(); ranims = []; ghosts = []; }
  function rtick() {
    if (!ranims.length) return;
    $('rscrub').value = Math.min(1, Math.max(...ranims.map((x) => x.currentTime ?? 0)) / rtotal);
    if (ranims.some((x) => x.playState === 'running')) requestAnimationFrame(rtick);
  }
  const rplay = () => { rbuild(); for (const a of ranims) a.play(); rtick(); };
  const rfinish = () => { rcancel(); $('rscrub').value = 1; };
  $('rplay').onclick = rplay;
  $('rfinal').onclick = rfinish;
  $('rspeed').oninput = (e) => { $('rspeedv').textContent = e.target.value + '×'; for (const a of ranims) a.playbackRate = Number(e.target.value); };
  $('rscrub').oninput = () => { if (!ranims.length) rbuild(); for (const a of ranims) { a.pause(); a.currentTime = Number($('rscrub').value) * rtotal; } };

  // ---- motion
  let manims = [], mdur = 0;
  function mstart() {
    if (motionCss) { motionCss.media = 'not all'; void document.body.offsetWidth; motionCss.media = 'all'; }
    // Also restart keyframes declared inside the SVG itself.
    for (const s of svg.querySelectorAll('style')) { const t = s.textContent; s.textContent = ''; void svg.getBBox(); s.textContent = t; }
    manims = document.getAnimations().filter((a) => !ranims.includes(a));
    mdur = Math.max(0, ...manims.map((a) => {
      const t = a.effect?.getComputedTiming?.();
      if (!t) return 0;
      return Number.isFinite(t.endTime) ? t.endTime : (t.delay || 0) + (t.duration || 0);
    }));
    if (smil) { svg.setCurrentTime(0); svg.unpauseAnimations(); mdur = Math.max(mdur, 2000); }
    $('mscrub').max = String(Math.max(1, Math.round(mdur)));
    for (const a of manims) a.playbackRate = Number($('mspeed').value);
    $('mplay').textContent = 'Pause';
    mtick();
  }
  function mtime() {
    // Parts end at different times; the longest one carries the timeline.
    if (manims.length) return Math.round(Math.max(...manims.map((a) => a.currentTime ?? 0)));
    return smil ? Math.round(svg.getCurrentTime() * 1000) : 0;
  }
  function mseek(ms) {
    for (const a of manims) { a.pause(); a.currentTime = ms; }
    if (smil) { svg.pauseAnimations(); svg.setCurrentTime(ms / 1000); }
    $('mplay').textContent = 'Play';
    mshow();
  }
  function mshow() { const t = mtime(); $('mscrub').value = String(Math.min(t, mdur)); $('mtime').textContent = t + ' ms'; host.dispatchEvent(new CustomEvent('dbs-time', { detail: t })); }
  function mtick() { mshow(); if (manims.some((a) => a.playState === 'running') || (smil && !svg.animationsPaused())) requestAnimationFrame(mtick); else $('mplay').textContent = 'Play'; }
  $('mplay').onclick = () => {
    const running = manims.some((a) => a.playState === 'running') || (smil && !svg.animationsPaused());
    if (running) { for (const a of manims) a.pause(); if (smil) svg.pauseAnimations(); $('mplay').textContent = 'Play'; mshow(); return; }
    const t = mtime();
    if (!manims.length || t >= mdur - 1) { mstart(); return; }
    for (const a of manims) a.play(); if (smil) svg.unpauseAnimations();
    $('mplay').textContent = 'Pause'; mtick();
  };
  $('mreplay').onclick = mstart;
  $('mscrub').oninput = () => mseek(Number($('mscrub').value));
  $('mspeed').oninput = (e) => { $('mspeedv').textContent = e.target.value + '×'; for (const a of manims) a.playbackRate = Number(e.target.value); };
  for (const [key, delta] of [['mback', -40], ['mfwd', 40]]) $(key).onclick = () => mseek(Math.max(0, Math.min(mdur, mtime() + delta)));

  // ---- switching
  function setMode(m) {
    if (m === 'motion' && !animatedStage) return;
    mode = m;
    for (const b of document.querySelectorAll('[data-stage-mode]')) b.setAttribute('aria-pressed', String(b.dataset.stageMode === m));
    $('reveal-bar').hidden = m !== 'reveal';
    $('motion-bar').hidden = m !== 'motion';
    if (m === 'reveal') {
      for (const a of manims) a.cancel(); manims = [];
      if (motionCss) motionCss.media = 'not all';
      if (smil) { svg.pauseAnimations(); svg.setCurrentTime(0); }
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) rplay(); else rfinish();
    } else {
      rfinish();
      mstart();
    }
    host.dispatchEvent(new CustomEvent('dbs-mode', { detail: m }));
  }
  for (const b of document.querySelectorAll('[data-stage-mode]')) b.onclick = () => setMode(b.dataset.stageMode);
  window.__dbsStage = {
    get mode() { return mode; },
    animated: animatedStage,
    time: () => (mode === 'motion' ? mtime() : null),
    seek: (ms) => { if (mode !== 'motion') setMode('motion'); mseek(ms); },
    setMode,
    finish: () => { if (mode === 'reveal') rfinish(); },
  };
  setMode(animatedStage ? 'motion' : 'reveal');
})();`;

// ------------------------------------------------------------------ review page

/**
 * Build the review page. `review` = { endpoint, token, events, round, file } when a
 * review server is attached; otherwise Send falls back to download + clipboard.
 */
export function reviewPage({ source, input, motionCss = '', sizes: sizesArg, title, review = null }) {
  const vb = viewBoxOf(source);
  const vbW = vb?.[2] || 300, vbH = vb?.[3] || 150;
  const sizes = sizesArg ?? (vbW <= 64 ? [16, 24, 32, 48, 96] : [160, 320, 640]);
  if (sizes.some((n) => !Number.isInteger(n) || n < 8 || n > 2048)) throw new Error('sizes must be integers between 8 and 2048');
  const name = title ?? basename(input);
  const { animated, warnings: lint } = motionLint(source, motionCss);
  const structural = runAudit('audit_svg.py', input)?.[0] ?? null;
  const geometric = runAudit('path_audit.py', input);
  const contrast = contrastReport(source, BACKGROUNDS, { viewBox: vb });

  const dataUri = `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`;
  const rows = [['transparent', 'checker'], ['light', BACKGROUNDS.light], ['dark', BACKGROUNDS.dark]];
  const badge = (row) => {
    const n = contrast.findings[row]?.length ?? 0;
    return n ? `<div class="badge" title="See Checks → Contrast">${n} low-contrast paint${n > 1 ? 's' : ''}</div>` : '';
  };
  const sizesGrid = rows.map(([row, bg]) => `<div class="bgrow"><div class="bgname">${row}${badge(row)}</div><div class="cells">${sizes.map((s) =>
    `<figure><div class="cell ${bg === 'checker' ? 'checker' : ''}" style="${bg === 'checker' ? '' : `background:${bg}`}"><img src="${dataUri}" style="color-scheme:${row === 'dark' ? 'dark' : 'light'}" width="${s}" height="${Math.round((s * vbH) / vbW)}" alt=""></div><figcaption>${s}px</figcaption></figure>`).join('')}</div></div>`).join('');

  const list = (items) => (items?.length ? `<ul class="warn">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">None.</p>');
  const checks = `
<h3>Structure <small>audit_svg.py</small></h3>${structural ? list([...structural.errors.map((e) => 'Error: ' + e), ...structural.warnings]) : '<p class="muted">Not run (Python unavailable).</p>'}
<h3>Geometry <small>path_audit.py</small></h3>${geometric ? list([...geometric.errors.map((e) => 'Error: ' + e), ...geometric.warnings]) : '<p class="muted">Not run (Python unavailable).</p>'}
<h3>Contrast <small>${contrast.ownBackground ? `against the artwork's own background ${contrast.ownBackground}` : `on the light ${BACKGROUNDS.light} and dark ${BACKGROUNDS.dark} previews`}</small></h3>
${list(Object.entries(contrast.findings).flatMap(([bg, items]) => items.map((f) => `${bg}: ${f.element} ${f.paint} ${f.color} is ${f.ratio}:1 (needs ${f.minimum}:1)`)))}
${contrast.unchecked.length ? `<p class="muted">Not resolved: ${esc(contrast.unchecked.join(', '))} (complex CSS selectors, gradients, currentColor).</p>` : ''}
${Object.values(contrast.findings).some((x) => x.length) && !contrast.ownBackground ? '<p class="muted">A transparent logo needs every paint to work on each background it will sit on; otherwise deliver a variant per background (for example logo-on-dark.svg) or theme it with currentColor where it is inlined.</p>' : ''}
${animated ? `<h3>Motion lint</h3>${list(lint)}` : ''}`;

  const reviewCfg = { ...(review ?? {}), file: review?.file ?? basename(input) };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} — review</title>
<style>
:root{color-scheme:light dark;--bg:#fbfaf7;--fg:#1f2a30;--muted:#5d6a70;--line:#e2ddd3;--card:#ffffff;--warn:#9a4a00}
@media (prefers-color-scheme:dark){:root{--bg:#12191d;--fg:#e8e4dc;--muted:#9aa7ad;--line:#2b3940;--card:#18232a;--warn:#f0b36a}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 12px}h3{font-size:14px;margin:18px 0 6px}small{color:var(--muted);font-weight:400}
.meta,.muted{color:var(--muted)}ul.warn{margin:0;padding-left:18px;color:var(--warn)}
.badge{margin-top:4px;font-size:12px;color:var(--warn);line-height:1.3}
.bgrow{display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:start;margin-bottom:12px}.bgname{color:var(--muted);padding-top:8px}
.cells{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}figure{margin:0;text-align:center}figcaption{font-size:12px;color:var(--muted)}
.cell{padding:10px;border:1px solid var(--line);border-radius:8px;display:grid;place-items:center;max-width:100%;overflow:hidden}.cell img{max-width:100%;height:auto;display:block}
.checker{background:conic-gradient(#ddd 25%,#fff 0 50%,#ddd 0 75%,#fff 0) 0 0/16px 16px}
.stagehead{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:32px 0 12px}.stagehead h2{margin:0}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}.seg button{border:0;border-radius:0}
.seg button[aria-pressed=true]{background:var(--fg);color:var(--card)}
#dbs-stage{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:24px;display:grid;place-items:center}
#dbs-stage svg{width:min(100%,640px);height:auto;max-height:60vh}
[hidden]{display:none!important}
.bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}.bar input[type=range]{flex:1;min-width:140px}
.bar output{font-variant-numeric:tabular-nums;min-width:64px;text-align:right}
button{font:inherit;padding:6px 12px;border:1px solid var(--line);background:var(--card);color:inherit;border-radius:6px;cursor:pointer}
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #7c3aed;outline-offset:2px}
</style>
<style id="motion-css" media="not all">${safeCss(motionCss)}</style>
</head><body><main>
<h1>${esc(name)}</h1>
<div class="meta">${esc(basename(input))} · viewBox ${vb ? vb.join(' ') : 'missing'} · ${Buffer.byteLength(source).toLocaleString('en')} bytes · built ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC${review?.round ? ` · review round ${review.round}` : ''}</div>
<div class="stagehead"><h2>Review</h2>${animated ? '<div class="seg" role="group" aria-label="Stage"><button type="button" data-stage-mode="motion">Motion</button><button type="button" data-stage-mode="reveal">Construction</button></div>' : ''}</div>
<div id="dbs-stage">${inlineSvg(source)}</div>
<div class="bar" id="reveal-bar"><button type="button" id="rplay">Play</button><button type="button" id="rfinal">Final</button><input id="rscrub" type="range" min="0" max="1" step="0.001" value="0" aria-label="Construction progress">
<label>Speed <input id="rspeed" type="range" min="0.25" max="3" step="0.25" value="1"> <span id="rspeedv">1×</span></label></div>
<div class="bar" id="motion-bar" hidden><button type="button" id="mplay">Play</button><button type="button" id="mreplay">Replay</button><button type="button" id="mback" aria-label="Back 40 ms">−40</button><button type="button" id="mfwd" aria-label="Forward 40 ms">+40</button>
<input id="mscrub" type="range" min="0" max="1" step="1" value="0" aria-label="Animation time"><output id="mtime">0 ms</output>
<label>Speed <input id="mspeed" type="range" min="0.1" max="2" step="0.05" value="1"> <span id="mspeedv">1×</span></label></div>
<section><h2>Target sizes</h2>${sizesGrid}</section>
<section><h2>Checks</h2>${checks}</section>
</main>
<script>window.__dbsReview = ${safeJs(JSON.stringify(reviewCfg))};</script>
<script>${safeJs(STAGE_RUNTIME)}</script>
<script>${safeJs(REVIEW_UI)}</script></body></html>`;

  const summary = {
    sizes, animated,
    structural: structural && { errors: structural.errors.length, warnings: structural.warnings.length },
    geometry: geometric && { errors: geometric.errors.length, warnings: geometric.warnings.length },
    contrast: Object.fromEntries(Object.entries(contrast.findings).map(([k, v]) => [k, v.length])),
    motionWarnings: lint,
  };
  return { html, summary };
}
