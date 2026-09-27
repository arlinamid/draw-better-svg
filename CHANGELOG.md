# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-09-27

First packaged release.

### Added

- Installable with `npx skills add arlinamid/draw-better-svg` for every agent the skills CLI supports.
- Plugin marketplaces for Claude Code and Claude Desktop (`.claude-plugin/`), OpenAI Codex
  (`.agents/plugins/`, `.codex-plugin/`), and Cursor (`.cursor-plugin/`), all pointing at the
  same single copy of the skill in `plugins/draw-better-svg/skills/draw-better-svg/`.
- `SKILL.md` frontmatter carries `license` and `metadata.version`.
- `tools/validate.mjs`: release gate for manifests, versions, frontmatter, links, and tracked
  files; `--deep` adds script syntax checks, an audit smoke test, `claude plugin validate --strict`,
  and `npx skills add . --list`.
- `tools/sync-version.mjs`, run by `npm version`, keeps every manifest on the package version.
- CI workflow running the validation on Linux and Windows.
- `ecosystem.md` lists three more related projects: svg-creator-skill, pixel2motion, and
  svg-hand-drawn-skill.

### Changed

- The skill moved from the repository root into the plugin layout; its content is unchanged
  apart from a note to run the audit with `python` where `python3` is missing.

[Unreleased]: https://github.com/arlinamid/draw-better-svg/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/arlinamid/draw-better-svg/releases/tag/v1.0.0
