#!/usr/bin/env node
// Copy package.json's version into every manifest that carries one.
// Runs from `npm version <patch|minor|major|x.y.z>` through the "version" script,
// so the bump, the synced manifests, and the git tag land in one commit.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const PLUGIN = join(ROOT, 'plugins', 'draw-better-svg');

for (const dir of ['.claude-plugin', '.cursor-plugin', '.codex-plugin']) {
  const file = join(PLUGIN, dir, 'plugin.json');
  const text = readFileSync(file, 'utf8');
  // Replace in place to keep the file's formatting and key order.
  writeFileSync(file, text.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`));
}

const skill = join(PLUGIN, 'skills', 'draw-better-svg', 'SKILL.md');
writeFileSync(skill, readFileSync(skill, 'utf8').replace(/^(\s+version:\s*)"?[^"\r\n]*"?/m, `$1"${version}"`));

// Promote the "Unreleased" changelog section to this version.
const log = join(ROOT, 'CHANGELOG.md');
const today = new Date().toISOString().slice(0, 10);
const text = readFileSync(log, 'utf8');
let next = text;
if (!next.includes(`## [${version}]`)) {
  next = next.replace(/^## \[Unreleased\][ \t]*$/m, `## [Unreleased]\n\n## [${version}] - ${today}`);
}
// Keep the compare links at the bottom pointing at the newest tag.
const repo = 'https://github.com/arlinamid/draw-better-svg';
next = next.replace(/^\[Unreleased\]: .*$/m, `[Unreleased]: ${repo}/compare/v${version}...HEAD`);
if (!new RegExp(`^\\[${version.replace(/\./g, '\\.')}\\]: `, 'm').test(next)) {
  const prev = [...next.matchAll(/^## \[(\d+\.\d+\.\d+[^\]]*)\]/gm)].map((m) => m[1]).find((v) => v !== version);
  const link = prev ? `${repo}/compare/v${prev}...v${version}` : `${repo}/releases/tag/v${version}`;
  next = next.replace(/^(\[Unreleased\]: .*)$/m, `$1\n[${version}]: ${link}`);
}
writeFileSync(log, next);

// README version badge.
const readme = join(ROOT, 'README.md');
writeFileSync(readme, readFileSync(readme, 'utf8').replace(/badge\/version-[^-]+-blue/, `badge/version-${version}-blue`));

console.log(`synced ${version}`);
