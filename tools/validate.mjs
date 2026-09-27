#!/usr/bin/env node
// Release gate for the draw-better-svg repository.
//
//   node tools/validate.mjs          manifests, versions, SKILL.md, links (no dependencies)
//   node tools/validate.mjs --deep   also script syntax, the audit on a sample SVG, the
//                                    Python and Node test suites in tools/tests,
//                                    `claude plugin validate --strict` and `npx skills --list`
//                                    when those commands are available
//
// Exit 0 when every check passes, 1 otherwise.
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'draw-better-svg';
const PLUGIN = join(ROOT, 'plugins', NAME);
const SKILL = join(PLUGIN, 'skills', NAME);
const DEEP = process.argv.includes('--deep');

const failures = [];
const notes = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);
const rel = (p) => relative(ROOT, p).split(sep).join('/');

function readJson(path) {
  if (!existsSync(path)) { fail(rel(path), 'missing'); return null; }
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { fail(rel(path), `invalid JSON: ${e.message}`); return null; }
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

// A relative manifest path must stay inside its base directory and exist.
function checkPath(where, base, value, { dotSlash = true } = {}) {
  if (typeof value !== 'string' || !value) return fail(where, 'path is empty');
  if (dotSlash && !value.startsWith('./')) fail(where, `path must start with "./": ${value}`);
  if (value.split(/[\\/]/).includes('..')) return fail(where, `path must not contain "..": ${value}`);
  if (value.includes('\\')) fail(where, `use forward slashes: ${value}`);
  if (!existsSync(join(base, value))) fail(where, `path does not exist: ${value}`);
}

// ------------------------------------------------------------ version source

const pkg = readJson(join(ROOT, 'package.json'));
const VERSION = pkg?.version;
if (!SEMVER.test(VERSION ?? '')) fail('package.json', `version is not semver: ${VERSION}`);

function checkPluginManifest(file, extra) {
  const m = readJson(file);
  if (!m) return null;
  const where = rel(file);
  if (m.name !== NAME) fail(where, `name must be "${NAME}", found "${m.name}"`);
  if (m.version !== VERSION) fail(where, `version ${m.version} differs from package.json ${VERSION}`);
  if (!m.description) fail(where, 'description is missing');
  if (m.license && m.license !== pkg?.license) fail(where, `license ${m.license} differs from package.json ${pkg?.license}`);
  extra?.(m, where);
  return m;
}

function checkMarketplaceEntry(where, entries, sourceOf) {
  if (!Array.isArray(entries) || entries.length === 0) return fail(where, 'plugins must be a non-empty array');
  const entry = entries.find((p) => p.name === NAME);
  if (!entry) return fail(where, `no plugin entry named "${NAME}"`);
  const src = sourceOf(entry);
  checkPath(`${where} → ${NAME}.source`, ROOT, src);
  if (typeof src === 'string' && resolve(ROOT, src) !== PLUGIN) fail(where, `source ${src} does not point to plugins/${NAME}`);
  if (entry.version !== undefined) fail(where, 'keep version in plugin.json only; the entry must not set it');
  return entry;
}

// ------------------------------------------------------------ Claude Code

{
  const file = join(ROOT, '.claude-plugin', 'marketplace.json');
  const m = readJson(file);
  if (m) {
    const where = rel(file);
    if (!KEBAB.test(m.name ?? '')) fail(where, `marketplace name must be kebab-case ASCII: ${m.name}`);
    if (!m.owner?.name) fail(where, 'owner.name is required');
    if (!m.description) fail(where, 'description is missing');
    checkMarketplaceEntry(where, m.plugins, (e) => e.source);
  }
  checkPluginManifest(join(PLUGIN, '.claude-plugin', 'plugin.json'));
}

// ------------------------------------------------------------ Cursor

{
  const file = join(ROOT, '.cursor-plugin', 'marketplace.json');
  const m = readJson(file);
  if (m) {
    const where = rel(file);
    if (!KEBAB.test(m.name ?? '')) fail(where, `marketplace name must be kebab-case: ${m.name}`);
    if (!m.owner?.name) fail(where, 'owner.name is required');
    checkMarketplaceEntry(where, m.plugins, (e) => (typeof e.source === 'string' ? e.source : e.source?.path));
  }
  checkPluginManifest(join(PLUGIN, '.cursor-plugin', 'plugin.json'), (p, where) => {
    if (p.logo) checkPath(`${where} → logo`, PLUGIN, p.logo, { dotSlash: false });
    if (p.skills) checkPath(`${where} → skills`, PLUGIN, p.skills);
  });
}

// ------------------------------------------------------------ Codex

{
  const file = join(ROOT, '.agents', 'plugins', 'marketplace.json');
  const m = readJson(file);
  if (m) {
    const where = rel(file);
    if (!m.name) fail(where, 'name is required');
    if (!m.interface?.displayName) fail(where, 'interface.displayName is required');
    const entry = checkMarketplaceEntry(where, m.plugins, (e) => e.source?.path);
    if (entry) {
      if (entry.source?.source !== 'local') fail(where, 'source.source must be "local" for a plugin in this repository');
      if (!['NOT_AVAILABLE', 'AVAILABLE', 'INSTALLED_BY_DEFAULT'].includes(entry.policy?.installation)) fail(where, 'policy.installation is missing or invalid');
      if (!['ON_INSTALL', 'ON_USE'].includes(entry.policy?.authentication)) fail(where, 'policy.authentication is missing or invalid');
      if (!entry.category) fail(where, 'category is required');
    }
  }
  checkPluginManifest(join(PLUGIN, '.codex-plugin', 'plugin.json'), (p, where) => {
    checkPath(`${where} → skills`, PLUGIN, p.skills);
    const ui = p.interface ?? {};
    for (const k of ['displayName', 'shortDescription', 'developerName', 'category']) {
      if (!ui[k]) fail(where, `interface.${k} is required`);
    }
    const prompts = ui.defaultPrompt ?? [];
    if (prompts.length > 3) fail(where, 'interface.defaultPrompt: Codex shows at most 3 prompts');
    prompts.forEach((s, i) => s.length > 128 && fail(where, `interface.defaultPrompt[${i}] exceeds 128 characters`));
    for (const k of ['composerIcon', 'logo']) if (ui[k]) checkPath(`${where} → interface.${k}`, PLUGIN, ui[k]);
    for (const s of ui.screenshots ?? []) {
      checkPath(`${where} → interface.screenshots`, PLUGIN, s);
      if (!/^\.\/assets\/.+\.png$/.test(s)) fail(where, `screenshots must be PNG files under ./assets/: ${s}`);
    }
    if (ui.brandColor && !/^#[0-9A-Fa-f]{6}$/.test(ui.brandColor)) fail(where, `brandColor must be #RRGGBB: ${ui.brandColor}`);
  });
}

// ------------------------------------------------------------ the skill

// Frontmatter subset used here: scalars, `>-`/`|` blocks, and one nested map level.
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const data = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const top = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!top) continue;
    const [, key, rest] = top;
    const body = [];
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) body.push(lines[++i]);
    if (/^[>|]-?$/.test(rest)) {
      data[key] = body.map((l) => l.trim()).join(rest.startsWith('>') ? ' ' : '\n');
    } else if (rest === '' && body.length) {
      data[key] = Object.fromEntries(
        body.map((l) => l.trim().match(/^([A-Za-z0-9_-]+):\s*(.*)$/)).filter(Boolean)
          .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]),
      );
    } else {
      data[key] = rest.replace(/^["']|["']$/g, '');
    }
  }
  return data;
}

const skillFile = join(SKILL, 'SKILL.md');
if (!existsSync(skillFile)) {
  fail(rel(skillFile), 'missing');
} else {
  const text = readFileSync(skillFile, 'utf8');
  const fm = parseFrontmatter(text);
  const where = rel(skillFile);
  if (!fm) {
    fail(where, 'YAML frontmatter is missing');
  } else {
    if (fm.name !== NAME) fail(where, `name must equal its directory "${NAME}", found "${fm.name}"`);
    if (!KEBAB.test(fm.name ?? '') || fm.name.length > 64) fail(where, 'name must be kebab-case, at most 64 characters');
    if (!fm.description) fail(where, 'description is required');
    else {
      if (fm.description.length > 1024) fail(where, `description is ${fm.description.length} characters; the limit is 1024`);
      if (/[<>]/.test(fm.description)) fail(where, 'description must not contain angle brackets');
    }
    if (fm.metadata?.version !== VERSION) fail(where, `metadata.version ${fm.metadata?.version} differs from package.json ${VERSION}`);
    if (fm.license !== pkg?.license) fail(where, `license ${fm.license} differs from package.json ${pkg?.license}`);
  }
  const lines = text.split(/\r?\n/).length;
  if (lines > 500) fail(where, `SKILL.md has ${lines} lines; keep it under 500 and move detail to references/`);
}

// Codex skill metadata: icons must exist and the default prompt must name the skill.
{
  const file = join(SKILL, 'agents', 'openai.yaml');
  if (existsSync(file)) {
    const y = readFileSync(file, 'utf8');
    for (const [, key, p] of y.matchAll(/^\s*(icon_small|icon_large):\s*(\S+)/gm)) {
      if (!existsSync(join(SKILL, p))) fail(rel(file), `${key} does not exist: ${p}`);
    }
    if (!y.includes(`$${NAME}`)) fail(rel(file), `default_prompt should mention $${NAME}`);
  }
}

// The plugin-level icon is a copy of the skill icon; keep them identical.
{
  const a = join(PLUGIN, 'assets', 'icon.svg');
  const b = join(SKILL, 'assets', 'icon.svg');
  if (existsSync(a) && existsSync(b) && readFileSync(a, 'utf8') !== readFileSync(b, 'utf8')) {
    fail(rel(a), `differs from ${rel(b)}`);
  }
}

// Every relative Markdown link in the skill and the repository docs must resolve.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'review') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const markdown = [...walk(SKILL), join(ROOT, 'README.md'), join(ROOT, 'CHANGELOG.md'), ...walk(join(ROOT, 'docs')), ...walk(join(ROOT, 'examples'))]
  .filter((p) => p.endsWith('.md') && existsSync(p));
for (const file of markdown) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURIComponent(target.split('#')[0]);
    if (path && !existsSync(join(dirname(file), path))) fail(rel(file), `broken link: ${target}`);
  }
}

// ------------------------------------------------------------ repository files

for (const f of ['README.md', 'LICENSE', 'CHANGELOG.md']) {
  if (!existsSync(join(ROOT, f))) fail(f, 'missing');
}
// The skill travels alone through `npx skills`, so its notices must live inside it.
if (!existsSync(join(SKILL, 'THIRD_PARTY_NOTICES.md'))) fail(rel(SKILL), 'THIRD_PARTY_NOTICES.md is missing');
if (existsSync(join(ROOT, 'CHANGELOG.md'))) {
  const log = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  if (!new RegExp(`^## \\[${VERSION.replace(/\./g, '\\.')}\\]`, 'm').test(log)) {
    fail('CHANGELOG.md', `no "## [${VERSION}]" section for the current version`);
  }
}

// Generated or local files must never be committed into the installable plugin.
{
  const r = spawnSync('git', ['ls-files', 'plugins'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0) {
    const bad = r.stdout.split('\n').filter((f) => /(^|\/)(node_modules|__pycache__|review)\/|\.pyc$/.test(f));
    if (bad.length) fail('git', `generated files are tracked: ${bad.slice(0, 5).join(', ')}`);
  } else {
    notes.push('not a git checkout: skipped the tracked-files check');
  }
}

// ------------------------------------------------------------ --deep

// On Windows, claude and npx are .cmd shims that only start through a shell; the
// arguments here are fixed strings, so they are joined rather than escaped.
function run(label, cmd, args, opts = {}) {
  const viaShell = process.platform === 'win32' && opts.shell !== false;
  const r = viaShell
    ? spawnSync([cmd, ...args].join(' '), { cwd: ROOT, encoding: 'utf8', shell: true, ...opts })
    : spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });
  if (r.error?.code === 'ENOENT' || (r.status !== 0 && /not (found|recognized)/i.test(r.stderr ?? ''))) {
    notes.push(`${label}: ${cmd} is not available, skipped`);
    return null;
  }
  if (r.status !== 0) fail(label, (r.stderr || r.stdout || `exit ${r.status}`).trim().split('\n').slice(-5).join(' | '));
  return r;
}

if (DEEP) {
  const scripts = join(SKILL, 'scripts');
  const modules = [
    ...readdirSync(scripts).filter((f) => f.endsWith('.mjs')).map((f) => join(scripts, f)),
    ...readdirSync(join(scripts, 'lib')).filter((f) => /\.m?js$/.test(f)).map((f) => join(scripts, 'lib', f)),
  ];
  for (const f of modules) {
    run(`node --check ${rel(f)}`, process.execPath, ['--check', f], { shell: false });
  }
  const py = spawnSync('python3', ['--version']).status === 0 ? 'python3' : 'python';
  const audit = join(scripts, 'audit_svg.py');
  const tmp = mkdtempSync(join(tmpdir(), 'dbs-validate-'));
  try {
    const good = join(tmp, 'good.svg');
    const bad = join(tmp, 'bad.svg');
    writeFileSync(good, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>Dot</title><circle cx="12" cy="12" r="8"/></svg>');
    writeFileSync(bad, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 24"><circle r="4"/></svg>');
    const ok = run('audit_svg.py on a valid SVG', py, [audit, good, '--json'], { shell: false });
    if (ok) {
      try { JSON.parse(ok.stdout); } catch { fail('audit_svg.py', '--json output is not JSON'); }
    }
    const r = spawnSync(py, [audit, bad, '--json'], { encoding: 'utf8' });
    if (r.status !== 1) fail('audit_svg.py on an invalid viewBox', `expected exit 1, got ${r.status}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  run('python unit tests', py, ['-m', 'unittest', 'discover', '-s', join(ROOT, 'tools', 'tests')], { shell: false });
  run('node tests', process.execPath, ['--test', 'tools/tests/*.test.mjs'], { shell: false });

  // Examples are showcases: both audits must stay clean.
  for (const svg of walk(join(ROOT, 'examples')).filter((f) => f.endsWith('.svg'))) {
    run(`audit_svg.py ${rel(svg)}`, py, [audit, svg], { shell: false });
    run(`path_audit.py ${rel(svg)}`, py, [join(scripts, 'path_audit.py'), svg, '--strict'], { shell: false });
  }

  run('claude plugin validate (marketplace)', 'claude', ['plugin', 'validate', '.', '--strict']);
  run('claude plugin validate (plugin)', 'claude', ['plugin', 'validate', `plugins/${NAME}`, '--strict']);

  const list = run('npx skills add --list', 'npx', ['-y', 'skills', 'add', '.', '--list'], { timeout: 180000 });
  if (list && !list.stdout.includes(NAME)) fail('npx skills add --list', `"${NAME}" was not discovered`);
}

// ------------------------------------------------------------ report

for (const n of notes) console.log(`note: ${n}`);
if (failures.length) {
  console.error(`\n✖ ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✔ draw-better-svg ${VERSION}: all ${DEEP ? 'deep ' : ''}checks passed`);
