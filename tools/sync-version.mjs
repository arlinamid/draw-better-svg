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
if (!text.includes(`## [${version}]`)) {
  writeFileSync(log, text.replace(/^## \[Unreleased\][ \t]*$/m, `## [Unreleased]\n\n## [${version}] - ${today}`));
}

console.log(`synced ${version}`);
