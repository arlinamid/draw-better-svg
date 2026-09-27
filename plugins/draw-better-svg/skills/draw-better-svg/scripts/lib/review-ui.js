// Interactive review layer for the preview page (browser script, no dependencies).
// Inlined by preview-page.mjs. Adds comment pins, markup tools, and Send/Approve.
//
// Transport: when window.__dbsReview.endpoint is set (review_server.mjs), Send
// POSTs the feedback there and the agent's `--wait` returns it. Opened from
// file:// without a server, Send downloads the feedback JSON and copies it to
// the clipboard so the user can hand it to the agent.
//
// Every coordinate is in the SVG's root user space (viewBox units). A comment
// names the element under the click with the same label path_audit.py uses.
// On an animated stage every comment and mark also records the time `t` (ms) of
// the frame it was made on; making one pauses the animation on that frame.
(() => {
  const cfg = window.__dbsReview || {};
  const stage = document.getElementById('dbs-stage');
  const svg = stage && stage.querySelector('svg');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = ['#e5484d', '#f59e0b', '#16a34a', '#2563eb', '#111827'];

  const css = document.createElement('style');
  css.textContent = `
  #dbs-stage{position:relative}
  #dbs-stage.dbs-annotating svg{cursor:crosshair;touch-action:none}
  #dbs-stage.dbs-erasing svg{cursor:not-allowed}
  .dbs-comments .time{font-variant-numeric:tabular-nums}
  .dbs-comments li.dbs-seek{cursor:pointer}
  .dbs-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
  .dbs-tools button{padding:5px 10px}
  .dbs-tools button[aria-pressed=true]{background:var(--fg);color:var(--card);border-color:var(--fg)}
  .dbs-sep{width:1px;align-self:stretch;background:var(--line);margin:0 4px}
  .dbs-swatch{width:22px;height:22px;padding:0;border-radius:50%;border:2px solid var(--card);outline:1px solid var(--line)}
  .dbs-swatch[aria-pressed=true]{outline:2px solid var(--fg)}
  .dbs-send{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:start;margin-top:10px}
  .dbs-send textarea{font:inherit;min-height:40px;resize:vertical;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:inherit}
  .dbs-primary{background:var(--fg)!important;color:var(--card)!important;border-color:var(--fg)!important}
  .dbs-status{grid-column:1/-1;color:var(--muted);font-size:13px;min-height:1.2em}
  .dbs-comments{margin:10px 0 0;padding-left:0;list-style:none;display:grid;gap:6px}
  .dbs-comments li{display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:start;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--card)}
  .dbs-comments .n{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#7c3aed;color:#fff;font-size:12px;font-weight:700}
  .dbs-comments small{display:block;color:var(--muted);word-break:break-all}
  .dbs-pop{position:absolute;z-index:5;display:flex;gap:6px;padding:6px;border-radius:10px;background:#1f2937;box-shadow:0 6px 24px rgba(0,0,0,.25)}
  .dbs-pop input{font:inherit;width:min(260px,60vw);padding:6px 8px;border:0;border-radius:6px;background:#374151;color:#f9fafb}
  .dbs-pop button{background:#4b5563;color:#fff;border:0}
  .dbs-banner{margin-top:10px;padding:8px 10px;border-radius:8px;background:#fef3c7;color:#78350f}
  @media (prefers-color-scheme:dark){.dbs-banner{background:#422006;color:#fde68a}}`;
  document.head.append(css);

  // ---------------------------------------------------------------- layers
  const layer = document.createElementNS(NS, 'g');
  layer.setAttribute('id', 'dbs-review-layer');
  layer.setAttribute('data-dbs-ui', '');
  const marks = document.createElementNS(NS, 'g');
  marks.setAttribute('id', 'dbs-markup');
  const pins = document.createElementNS(NS, 'g');
  pins.setAttribute('id', 'dbs-pins');
  layer.append(marks, pins);
  svg.append(layer);

  const toUser = (x, y) => {
    const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
  };
  const unit = () => 1 / Math.abs(svg.getScreenCTM().a || 1); // user units per screen pixel
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.append(n);
    return n;
  };

  // ---------------------------------------------------------------- time
  const clock = () => window.__dbsStage?.time?.() ?? null; // null: static stage or construction view
  function freeze() {
    const t = clock();
    if (t !== null) window.__dbsStage.seek(t); // pause on the annotated frame
    return t;
  }
  const near = (t, now) => t === null || t === undefined || now === null || Math.abs(t - now) <= 60;
  let now = clock();
  stage.addEventListener('dbs-time', (e) => { now = e.detail; fadePins(); });
  stage.addEventListener('dbs-mode', () => { now = clock(); fadePins(); });

  // ---------------------------------------------------------------- state
  let mode = 'view';
  let color = COLORS[0];
  let comments = [];
  let nextN = 1;
  const past = [];
  let future = [];
  let dirty = false;
  const snapshot = () => JSON.stringify({ m: marks.innerHTML, c: comments, n: nextN });
  function save() { past.push(snapshot()); future = []; }
  function restore(s) {
    const o = JSON.parse(s);
    marks.innerHTML = o.m; comments = o.c; nextN = o.n;
    changed();
  }
  function changed() {
    dirty = comments.length > 0 || marks.childElementCount > 0 || note.value.trim() !== '';
    renderPins();
    renderList();
  }

  // ---------------------------------------------------------------- element under a point
  const drawables = () => [...svg.querySelectorAll('path,polyline,polygon')].filter((n) => !n.closest('[data-dbs-ui]'));
  function label(n) {
    const tag = n.tagName.toLowerCase();
    if (n.id) return `${tag}#${n.id}`;
    if (['path', 'polyline', 'polygon'].includes(tag)) return `${tag}[${drawables().indexOf(n)}]`;
    const same = [...svg.querySelectorAll(tag)].filter((x) => !x.closest('[data-dbs-ui]'));
    return `${tag}[${same.indexOf(n)}]`;
  }
  function selector(n) {
    const parts = [];
    for (let cur = n; cur && cur !== svg; cur = cur.parentElement) {
      if (cur.id) { parts.unshift(`#${CSS.escape(cur.id)}`); break; }
      const tag = cur.tagName.toLowerCase();
      const i = [...cur.parentElement.children].filter((x) => x.tagName === cur.tagName).indexOf(cur) + 1;
      parts.unshift(`${tag}:nth-of-type(${i})`);
    }
    return parts.join(' > ');
  }
  function bbox(n) {
    try {
      const b = n.getBBox();
      const m = svg.getScreenCTM().inverse().multiply(n.getScreenCTM());
      const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
        .map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const r = (v) => Math.round(v * 100) / 100;
      return [r(Math.min(...xs)), r(Math.min(...ys)), r(Math.max(...xs) - Math.min(...xs)), r(Math.max(...ys) - Math.min(...ys))];
    } catch { return null; }
  }
  function pick(cx, cy) {
    layer.style.pointerEvents = 'none';
    const stack = document.elementsFromPoint(cx, cy).filter((n) => n !== svg && svg.contains(n) && !n.closest('[data-dbs-ui]'));
    layer.style.pointerEvents = '';
    const top = stack[0];
    if (!top) return { label: 'background', below: [] };
    const cs = getComputedStyle(top);
    return {
      label: label(top), tag: top.tagName.toLowerCase(), id: top.id || null, selector: selector(top),
      ancestors: (() => { const a = []; for (let c = top.parentElement; c && c !== svg; c = c.parentElement) if (c.id) a.push(c.id); return a; })(),
      fill: cs.fill, stroke: cs.stroke, bbox: bbox(top),
      below: stack.slice(1, 4).map(label),
    };
  }

  // ---------------------------------------------------------------- pins and list
  function renderPins() {
    pins.innerHTML = '';
    const u = unit();
    for (const c of comments) {
      const g = el('g', { 'data-comment': c.n, 'data-t': c.t ?? '' }, pins);
      el('circle', { cx: c.x, cy: c.y, r: 11 * u, fill: '#7c3aed', stroke: '#ffffff', 'stroke-width': 2 * u }, g);
      const t = el('text', { x: c.x, y: c.y + 4 * u, 'text-anchor': 'middle', 'font-size': 12 * u, 'font-weight': 700, 'font-family': 'system-ui,sans-serif', fill: '#ffffff' }, g);
      t.textContent = c.n;
    }
    fadePins();
  }
  // Pins and marks made on another frame fade while the timeline is elsewhere.
  function fadePins() {
    for (const n of [...pins.children, ...marks.children]) {
      const raw = n.getAttribute('data-t');
      const t = raw === '' || raw === null ? null : Number(raw);
      n.style.opacity = near(t, now) ? '' : '0.28';
    }
  }
  const list = document.createElement('ol');
  list.className = 'dbs-comments';
  function renderList() {
    list.innerHTML = '';
    for (const c of comments) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="n"></span><div><div class="t"></div><small></small></div><button type="button">Delete</button>';
      li.querySelector('.n').textContent = c.n;
      li.querySelector('.t').textContent = c.text;
      li.querySelector('small').textContent = `${c.t !== null && c.t !== undefined ? `${c.t} ms · ` : ''}${c.target.label} at ${c.x}, ${c.y}`;
      if (c.t !== null && c.t !== undefined) {
        li.classList.add('dbs-seek');
        li.title = `Show the frame at ${c.t} ms`;
        li.onclick = (e) => { if (!e.target.closest('button')) window.__dbsStage.seek(c.t); };
      }
      li.querySelector('.t').ondblclick = () => editComment(c);
      li.querySelector('button').onclick = () => { save(); comments = comments.filter((x) => x !== c); changed(); };
      list.append(li);
    }
  }

  // ---------------------------------------------------------------- popover input
  let pop = null;
  function ask(cx, cy, initial, done) {
    closePop();
    const r = stage.getBoundingClientRect();
    pop = document.createElement('div');
    pop.className = 'dbs-pop';
    pop.innerHTML = '<input type="text" placeholder="Add a comment…"><button type="button">Save</button>';
    pop.style.left = `${Math.min(cx - r.left + 14, r.width - 330)}px`;
    pop.style.top = `${cy - r.top - 18}px`;
    stage.append(pop);
    const input = pop.querySelector('input');
    input.value = initial || '';
    input.focus();
    const finish = (ok) => { const v = input.value.trim(); closePop(); done(ok ? v : null); };
    input.onkeydown = (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); };
    pop.querySelector('button').onclick = () => finish(true);
  }
  function closePop() { pop?.remove(); pop = null; }
  function editComment(c) {
    const b = pins.querySelector(`[data-comment="${c.n}"]`)?.getBoundingClientRect();
    ask(b ? b.right : 0, b ? b.top + 10 : 0, c.text, (v) => {
      if (v === null) return;
      save();
      if (v) c.text = v; else comments = comments.filter((x) => x !== c);
      changed();
    });
  }

  // ---------------------------------------------------------------- drawing
  let drawing = null;
  const strokeAttrs = () => ({ fill: 'none', stroke: color, 'stroke-width': 3 * unit(), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  function smoothPath(pts) {
    if (pts.length < 3) return `M${pts.map((p) => `${p.x} ${p.y}`).join(' L')}`;
    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q${pts[i].x} ${pts[i].y} ${Math.round(mx * 100) / 100} ${Math.round(my * 100) / 100}`;
    }
    const last = pts.at(-1);
    return `${d} L${last.x} ${last.y}`;
  }
  function arrowPath(a, b) {
    const u = unit(), len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, h = 14 * u, w = 7 * u;
    const l = { x: b.x - ux * h - uy * w, y: b.y - uy * h + ux * w }, r = { x: b.x - ux * h + uy * w, y: b.y - uy * h - ux * w };
    const f = (p) => `${Math.round(p.x * 100) / 100} ${Math.round(p.y * 100) / 100}`;
    return `M${f(a)} L${f(b)} M${f(l)} L${f(b)} L${f(r)}`;
  }
  svg.addEventListener('pointerdown', (e) => {
    if (mode === 'view' || e.button !== 0) return;
    e.preventDefault();
    const p = toUser(e.clientX, e.clientY);
    if (mode === 'erase') {
      const hit = e.target.closest('#dbs-markup > *, #dbs-pins > g');
      if (!hit) return;
      save();
      if (hit.dataset.comment) comments = comments.filter((c) => String(c.n) !== hit.dataset.comment);
      else hit.remove();
      changed();
      return;
    }
    const t = freeze();
    if (mode === 'comment') {
      const target = pick(e.clientX, e.clientY);
      ask(e.clientX, e.clientY, '', (v) => {
        if (!v) return;
        save();
        comments.push({ n: nextN++, x: p.x, y: p.y, t, text: v, target });
        changed();
      });
      return;
    }
    if (mode === 'text') {
      ask(e.clientX, e.clientY, '', (v) => {
        if (!v) return;
        save();
        const label = el('text', { x: p.x, y: p.y, fill: color, 'font-size': 16 * unit(), 'font-family': 'system-ui,sans-serif', 'font-weight': 600, 'data-kind': 'text', 'data-t': t ?? '' }, marks);
        label.textContent = v;
        changed();
      });
      return;
    }
    svg.setPointerCapture(e.pointerId);
    const kind = mode;
    const snap = snapshot(); // undo target: the state before this mark
    const node = kind === 'rect' ? el('rect', { ...strokeAttrs(), x: p.x, y: p.y, width: 0, height: 0 }, marks)
      : kind === 'ellipse' ? el('ellipse', { ...strokeAttrs(), cx: p.x, cy: p.y, rx: 0, ry: 0 }, marks)
        : el('path', { ...strokeAttrs(), d: `M${p.x} ${p.y}` }, marks);
    node.setAttribute('data-kind', kind);
    node.setAttribute('data-t', t ?? '');
    drawing = { kind, node, start: p, pts: [p], snap };
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = toUser(e.clientX, e.clientY);
    const { kind, node, start, pts } = drawing;
    if (kind === 'pen') {
      const last = pts.at(-1);
      if (Math.hypot(p.x - last.x, p.y - last.y) < 2 * unit()) return;
      pts.push(p);
      node.setAttribute('d', smoothPath(pts));
    } else if (kind === 'arrow') {
      node.setAttribute('d', arrowPath(start, p));
    } else if (kind === 'rect') {
      node.setAttribute('x', Math.min(start.x, p.x)); node.setAttribute('y', Math.min(start.y, p.y));
      node.setAttribute('width', Math.abs(p.x - start.x)); node.setAttribute('height', Math.abs(p.y - start.y));
    } else if (kind === 'ellipse') {
      node.setAttribute('cx', (start.x + p.x) / 2); node.setAttribute('cy', (start.y + p.y) / 2);
      node.setAttribute('rx', Math.abs(p.x - start.x) / 2); node.setAttribute('ry', Math.abs(p.y - start.y) / 2);
    }
    drawing.end = p;
  });
  const endDraw = () => {
    if (!drawing) return;
    const { node, start, end, kind, pts, snap } = drawing;
    drawing = null;
    const size = end ? Math.hypot(end.x - start.x, end.y - start.y) : 0;
    if ((kind === 'pen' && pts.length < 2) || (kind !== 'pen' && size < 4 * unit())) { node.remove(); return; }
    past.push(snap); future = [];
    changed();
  };
  svg.addEventListener('pointerup', endDraw);
  svg.addEventListener('pointercancel', endDraw);

  // ---------------------------------------------------------------- toolbar
  const tools = document.createElement('div');
  tools.className = 'dbs-tools';
  tools.setAttribute('role', 'toolbar');
  tools.setAttribute('aria-label', 'Review tools');
  const MODES = [['view', 'View'], ['comment', 'Comment'], ['pen', 'Pen'], ['arrow', 'Arrow'], ['rect', 'Box'], ['ellipse', 'Ellipse'], ['text', 'Text'], ['erase', 'Erase']];
  tools.innerHTML = MODES.map(([m, t]) => `<button type="button" data-mode="${m}" aria-pressed="${m === mode}">${t}</button>`).join('') +
    '<span class="dbs-sep"></span>' +
    COLORS.map((c, i) => `<button type="button" class="dbs-swatch" data-color="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${i === 0}"></button>`).join('') +
    '<span class="dbs-sep"></span><button type="button" data-act="undo">Undo</button><button type="button" data-act="redo">Redo</button><button type="button" data-act="clear">Clear</button>';
  const send = document.createElement('div');
  send.className = 'dbs-send';
  send.innerHTML = '<textarea aria-label="Overall note" placeholder="Overall note for the agent (optional)"></textarea>' +
    '<button type="button" class="dbs-primary" data-send="changes">Send changes</button><button type="button" data-send="approved">Approve</button><div class="dbs-status" role="status"></div>';
  const note = send.querySelector('textarea');
  const status = send.querySelector('.dbs-status');
  const anchor = document.getElementById('motion-bar') || stage;
  anchor.after(tools, send, list);
  status.textContent = cfg.endpoint
    ? `Connected to the agent${cfg.round ? ` · round ${cfg.round}` : ''}. Choose Comment, then click the drawing to pin a note${window.__dbsStage?.animated ? '; on the motion timeline it records the frame time' : ''}.`
    : 'Offline preview: Send saves a feedback file and copies it to the clipboard.';

  function setMode(m) {
    mode = m;
    closePop();
    if (m !== 'view') window.__dbsStage?.finish();
    stage.classList.toggle('dbs-annotating', m !== 'view' && m !== 'erase');
    stage.classList.toggle('dbs-erasing', m === 'erase');
    for (const b of tools.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  }
  tools.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) setMode(b.dataset.mode);
    if (b.dataset.color) {
      color = b.dataset.color;
      for (const s of tools.querySelectorAll('[data-color]')) s.setAttribute('aria-pressed', String(s === b));
    }
    if (b.dataset.act === 'undo' && past.length) { future.push(snapshot()); restore(past.pop()); }
    if (b.dataset.act === 'redo' && future.length) { past.push(snapshot()); restore(future.pop()); }
    if (b.dataset.act === 'clear' && (comments.length || marks.childElementCount)) { save(); marks.innerHTML = ''; comments = []; changed(); }
  });
  note.addEventListener('input', changed);
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea')) return;
    if (e.key === 'Escape') setMode('view');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      tools.querySelector(`[data-act="${e.shiftKey ? 'redo' : 'undo'}"]`).click();
    }
  });
  addEventListener('resize', renderPins);
  addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });

  // ---------------------------------------------------------------- send
  function payload(kind) {
    const items = [...marks.children].map((n) => ({
      kind: n.dataset.kind, color: n.getAttribute('stroke') !== 'none' && n.getAttribute('stroke') ? n.getAttribute('stroke') : n.getAttribute('fill'),
      bbox: bbox(n), text: n.dataset.kind === 'text' ? n.textContent : undefined,
      t: n.dataset.t === '' || n.dataset.t === undefined ? null : Number(n.dataset.t),
    }));
    const vb = svg.viewBox.baseVal;
    const at = (t) => (t === null || t === undefined ? '' : ` at ${t} ms`);
    const lines = comments.map((c) => `${c.n}.${at(c.t)} (${c.x}, ${c.y}) on ${c.target.label}: ${c.text}`);
    items.forEach((it, i) => lines.push(`markup ${i + 1}${at(it.t)}: ${it.kind}${it.text ? ` "${it.text}"` : ''} around ${it.bbox?.join(', ')}`));
    if (note.value.trim()) lines.unshift(`Note: ${note.value.trim()}`);
    return {
      schema: 'draw-better-svg/review@1',
      status: kind,
      file: cfg.file || document.querySelector('.meta')?.textContent.split(' · ')[0] || null,
      round: cfg.round || null,
      sentAt: new Date().toISOString(),
      viewBox: vb && vb.width ? [vb.x, vb.y, vb.width, vb.height] : null,
      animated: !!window.__dbsStage?.animated,
      times: [...new Set([...comments.map((c) => c.t), ...items.map((it) => it.t)].filter((t) => t !== null && t !== undefined))].sort((a, b) => a - b),
      note: note.value.trim(),
      comments,
      markup: { items, svg: marks.innerHTML },
      pins: pins.innerHTML,
      summary: lines.join('\n') || (kind === 'approved' ? 'Approved without changes.' : 'No comments.'),
    };
  }
  async function submit(kind) {
    const body = payload(kind);
    if (kind === 'changes' && !body.comments.length && !body.markup.items.length && !body.note) {
      status.textContent = 'Nothing to send yet: add a comment, a mark, or a note — or press Approve.';
      return;
    }
    for (const b of send.querySelectorAll('button')) b.disabled = true;
    try {
      if (cfg.endpoint) {
        const r = await fetch(cfg.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dbs-token': cfg.token }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
        const res = await r.json();
        status.textContent = kind === 'approved' ? `Approved (round ${res.round}). The agent has been notified.` : `Sent round ${res.round} to the agent. This page reloads when the SVG changes.`;
      } else {
        const text = JSON.stringify(body, null, 2);
        const name = `${(body.file || 'svg').replace(/\.svg$/i, '')}.review.json`;
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
        a.click();
        let copied = false;
        try { await navigator.clipboard.writeText(text); copied = true; } catch { /* clipboard may be blocked on file:// */ }
        status.textContent = `Saved ${name} to your downloads${copied ? ' and copied it to the clipboard' : ''}. Give it to the agent.`;
      }
      dirty = false;
    } catch (err) {
      status.textContent = `Could not send: ${err.message}`;
    } finally {
      for (const b of send.querySelectorAll('button')) b.disabled = false;
    }
  }
  for (const b of send.querySelectorAll('[data-send]')) b.onclick = () => submit(b.dataset.send);

  // ---------------------------------------------------------------- live reload
  if (cfg.events) {
    const es = new EventSource(cfg.events);
    es.addEventListener('changed', () => {
      if (!dirty) { location.reload(); return; }
      if (document.querySelector('.dbs-banner')) return;
      const b = document.createElement('div');
      b.className = 'dbs-banner';
      b.innerHTML = 'The SVG was updated. Send your notes first, or <button type="button">reload now</button> (unsent notes are lost).';
      b.querySelector('button').onclick = () => { dirty = false; location.reload(); };
      tools.before(b);
    });
  }
  window.__dbsReviewUI = { payload, setMode };
})();
