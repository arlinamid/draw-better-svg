# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **The review page is one screen, usage first.** The drawing fills a canvas with a background
  switch (light, dark, transparent); a floating toolbar keeps only Comment, Draw, Arrow, color,
  and Undo (keys C, D, A, Esc, Ctrl+Z; one tab stop with arrow-key navigation); one timeline plays
  the motion or the construction, with a marker for every timed note; the Notes panel holds the
  notes and Send/Approve. Checks and target sizes open in dialogs instead of filling the page.
  Built on `color-scheme`/`light-dark()`, the Popover API, and `<dialog closedby>` with fallbacks.
- **Character motion** in `motion.md`: the classic animation principles mapped to SVG
  techniques (IK at sampled poses, eased samples, follow-through, secondary action, arcs,
  appeal), and the rule that a CSS `transform` animation replaces the element's `transform`
  attribute. Found while animating a boy on a bicycle end to end with the skill.
- **`capture_frames.mjs` tolerates layer rasterization.** Transform-animated groups render softer
  and up to a pixel off in Chromium, which failed the pixel-exact final-frame check on correct
  animations. The pass now uses `visiblePixels` (0.75 CSS px blur, ±1 px, 24 levels); a 40 ms pose
  change still registers. The loop-seam guidance now names the least common multiple of periods
  and warns against positive delays.
- **The review stage clips the drawing at its viewBox.** It used `overflow: visible`, so a looping
  background's off-canvas tiles spilled over the Notes panel. `motion.md` adds the matching rule
  for the artwork: clip scrolling scenes to the viewBox so inline embeds stay inside their frame.
- **Every round carries the checks.** `feedback.json` has a `checks` field, re-run on the file when
  the round is saved, and the summary ends with the open findings; an offline file includes the
  checks the page showed.

## [1.1.0] - 2026-09-27

### Added

- **Logo and SVG motion** (`references/motion.md`): brief and personality presets, motion-ready
  structure, choreography, pattern library, and implementation rules measured in Chromium —
  literal keyframe easings, motion-only properties kept out of the rest state, a draw-on dash
  setup that leaves no ink at t = 0, reduced motion equal to the static logo.
- **Interactive review** (`review_server.mjs`): a local page (127.0.0.1, tokened URL) where
  the user pins comments, draws marks (pen, arrow, box, ellipse, text; undo/redo), writes a
  note, and presses Send or Approve. On an animated stage the page has a motion timeline and
  every comment and mark records its frame time. Each round lands in `round-NN/` with
  `feedback.json` (element label, selector, bbox, coordinates, times, summary), an annotated
  SVG and PNG, and the commented animation frames with their pins. `--wait` blocks until the
  next round, so any agent with a shell can loop; the open page reloads when the SVG changes.
- **`preview_html.mjs`**: a dependency-free, single-file preview to show the user before
  delivery — construction reveal (strokes, then fills), target sizes on transparent, light,
  and dark backgrounds, structural/geometry/contrast checks, and the motion stage. `--mode motion`
  builds a motion page with `?t=`, `?static=1`, and `?bare=1` QA hooks and lints the motion CSS.
- **`capture_frames.mjs`**: deterministic frames, a film strip, style probes, and pixel-exact
  final-frame and reduced-motion checks against the SVG without motion. Uses playwright-core with
  an installed Chrome or Edge.
- **`path_audit.py`**: contour audit for every path command — near-kinks, pixel staircases,
  faceted curves, tiny segments, long handles, malformed data — with a handle overlay SVG.
- **`compare_reference.mjs`**: raster reference overlay with IoU, centroid offset, and size ratio
  for traces and reconstructions; "Reference fits" in `review-and-repair.md` adds a complexity
  ladder and an iteration budget.
- **Contrast check** (`scripts/lib/contrast.mjs`): painted colors against light and dark
  backgrounds, honoring `prefers-color-scheme: dark` rules in the SVG; the preview shows the
  count beside each background row, and the dark row renders with `color-scheme: dark`.
- **`references/effects.md`**: shadows, bevel, textures, grading, materials, atmosphere, glass,
  portable gradients, a renderer portability table, and dark-background fixes.
- **Effects lab** (`tools/effects-lab/`) and `docs/effects-evaluation.md`: 60 recipes rendered in
  Chromium, librsvg, and resvg, plus 7 browser checks.
- Python and Node tests in `tools/tests/`, run by `npm run check`; a CI motion smoke test.
- `THIRD_PARTY_NOTICES.md` inside the skill.

### Changed

- The pressure-ink example and recipe draw quadratic curves through outline midpoints instead of
  straight segments, which the new path audit reported as faceted.
- `ecosystem.md` records what was adopted from svg-creator-skill, pixel2motion, and
  svg-hand-drawn-skill and what failed in testing.

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

[Unreleased]: https://github.com/arlinamid/draw-better-svg/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/arlinamid/draw-better-svg/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/arlinamid/draw-better-svg/releases/tag/v1.0.0
