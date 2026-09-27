# Draw Better SVG

[![Version](https://img.shields.io/badge/version-1.2.0-blue?style=flat-square)](CHANGELOG.md)
[![Install](https://img.shields.io/badge/npx-skills%20add-black?style=flat-square)](https://github.com/vercel-labs/skills)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](LICENSE)

> An agent skill for planning, drawing, render-checking, animating, and repairing editable SVG
> graphics: icons, logos, illustrations, diagrams, charts, patterns, maps, and logo motion.

```bash
npx skills add arlinamid/draw-better-svg
```

<p align="center"><img src="examples/bicycle-boy/boy-bike.svg" width="480" alt="An animated SVG made with the skill: a boy riding a bicycle"></p>

The skill treats valid XML, correct geometry, and visual quality as three separate
requirements. It classifies the task, draws in passes (composition → structure →
geometry → style), renders the result at the sizes it will be shown at, and fixes
the most visible defect before adding detail. Before delivery it builds a
review page for the user: a construction reveal, the motion timeline, the artwork
at its target sizes on transparent, light, and dark backgrounds, and the structural,
geometry, and contrast checks. The user pins comments and draws on it, and Send
hands the round to the agent through a small local server — element names,
coordinates, animation frame times, and annotated images included.

---

## Examples

| | |
| --- | --- |
| **[A boy riding his bicycle](examples/bicycle-boy/)** | Animated character: IK limbs, one 16 s clock, character-motion principles, and four review rounds with the user shown next to their fixes |
| **[Orbit](examples/orbit-logo/)** | Logo reveal: artifact-free draw-on, overshoot, wipe, a pixel-exact end state, and a dark-background fix |
| **[Gallery](examples/#gallery)** | Icon, boolean mark, illustration, sketch, chart, diagram, pressure ink, and pattern from the built-in study set |

Every example passes both audits; `npm run check` re-audits them.

---

## Install

The skill is one folder with a `SKILL.md`, so any agent that reads skills can use it.
The repository is also a plugin marketplace for Claude Code, Codex, and Cursor.

### Any agent: `npx skills` (recommended)

```bash
npx skills add arlinamid/draw-better-svg
npx skills add arlinamid/draw-better-svg --agent claude-code codex cursor
npx skills add arlinamid/draw-better-svg -g        # user-level instead of project-level
npx skills update draw-better-svg
npx skills remove draw-better-svg
```

The [skills CLI](https://github.com/vercel-labs/skills) detects the agents on the
machine and links the skill into each one's skill folder (Claude Code, Codex,
Cursor, Gemini CLI, GitHub Copilot, Windsurf, Cline, OpenCode, and others).

### Claude Code

```bash
claude plugin marketplace add arlinamid/draw-better-svg
claude plugin install draw-better-svg@draw-better-svg
```

Inside a session: `/plugin marketplace add arlinamid/draw-better-svg`, then
`/plugin install draw-better-svg@draw-better-svg`. The skill runs as
`/draw-better-svg:draw-better-svg`, or on its own when a task matches.

### Claude Desktop (Chat, Cowork, Code tab)

**Directory → Plugins → Personal → Add marketplace**, enter
`arlinamid/draw-better-svg`, then install **draw-better-svg**.

### OpenAI Codex

```bash
codex plugin marketplace add arlinamid/draw-better-svg
codex plugin add draw-better-svg@draw-better-svg
```

Codex reads the marketplace from `.agents/plugins/marketplace.json`. Invoke the
skill with `$draw-better-svg`.

### Cursor

- **Teams and Enterprise:** Dashboard → Plugins & MCPs → Team Marketplaces →
  Add Marketplace → Import from Repo → `https://github.com/arlinamid/draw-better-svg`.
- **Individual:** copy `plugins/draw-better-svg` to `~/.cursor/plugins/local/draw-better-svg`
  and reload the window, or use `npx skills add … --agent cursor`.

### Manually

```bash
git clone https://github.com/arlinamid/draw-better-svg.git
cp -r draw-better-svg/plugins/draw-better-svg/skills/draw-better-svg ~/.claude/skills/
```

Use `~/.codex/skills/`, `~/.cursor/skills/`, or your agent's skill folder instead as needed.

---

## What is inside

```
plugins/draw-better-svg/skills/draw-better-svg/
├── SKILL.md                    workflow: route, brief, draw in passes, review, preview, deliver
├── THIRD_PARTY_NOTICES.md      licenses of adapted reference material
├── agents/openai.yaml          Codex / ChatGPT skill metadata
├── assets/
│   ├── brief-template.json     a worked planning brief
│   └── icon.svg
├── references/
│   ├── taxonomy.md             subject × construction × delivery classification
│   ├── scripting-guide.md      library recipes (SVG.js, Paper.js, Rough.js, D3, ELK …)
│   ├── prompting-guide.md      briefs and revision prompts
│   ├── review-and-repair.md    acceptance checks, reference fits, preview before delivery
│   ├── effects.md              tested filters, textures, grading, glass, theming, contrast
│   ├── motion.md               logo animation: brief, patterns, measured rules, QA
│   └── ecosystem.md            related skills, libraries, primary sources
└── scripts/
    ├── audit_svg.py            structure audit, standard library only
    ├── path_audit.py           contour audit: kinks, staircases, facets, tiny segments
    ├── review_server.mjs       interactive review loop: page, Send/Approve, --wait for the agent
    ├── preview_html.mjs        the same review page as a static file / motion page
    ├── render_review.mjs       PNG previews on transparent, light and dark backgrounds
    ├── compare_reference.mjs   raster reference overlay with IoU
    ├── capture_frames.mjs      deterministic motion frames and final-frame checks
    ├── optimize_svg.mjs        conservative SVGO delivery copy
    ├── generate_examples.mjs   example suite that uses every bundled library
    └── lib/                    page builder, review UI, browser launcher, contrast check
```

The Python audits and the preview page need no packages. The other Node tools
are optional; install their dependencies only when you use them. Motion capture
drives an installed Chrome or Edge through playwright-core (or `CHROME_BIN`).

```bash
npm ci --prefix scripts          # from the skill directory
python scripts/audit_svg.py drawing.svg --json
python scripts/path_audit.py drawing.svg --svg-out ./review/handles.svg
node scripts/preview_html.mjs drawing.svg ./review/preview.html
node scripts/render_review.mjs drawing.svg ./review/drawing 24,48,256
```

---

## Repository layout

| Path | For |
| --- | --- |
| `plugins/draw-better-svg/skills/draw-better-svg/` | the skill, the only copy |
| `.claude-plugin/marketplace.json` | Claude Code / Claude Desktop marketplace; also read by `npx skills` |
| `plugins/draw-better-svg/.claude-plugin/plugin.json` | Claude plugin manifest |
| `.agents/plugins/marketplace.json` | Codex marketplace |
| `plugins/draw-better-svg/.codex-plugin/plugin.json` | Codex plugin manifest |
| `.cursor-plugin/marketplace.json` | Cursor marketplace |
| `plugins/draw-better-svg/.cursor-plugin/plugin.json` | Cursor plugin manifest |
| `tools/` | validation, version sync, tests, effects lab |
| `docs/effects-evaluation.md` | how every adopted or rejected effect was tested |
| `examples/` | finished work with evidence; not installed with the skill |

## Development

```bash
npm run validate      # manifests, versions, SKILL.md frontmatter, links — no dependencies
npm run check         # + script syntax, audit smoke test, Python and Node tests,
                      #   claude plugin validate --strict, npx skills --list
```

The effects lab renders every effect recipe in Chromium, librsvg, and resvg and
compares them; its findings are in [docs/effects-evaluation.md](docs/effects-evaluation.md):

```bash
npm ci --prefix plugins/draw-better-svg/skills/draw-better-svg/scripts
npm install --prefix tools/effects-lab
node tools/effects-lab/run.mjs && node tools/effects-lab/anim-checks.mjs
```

`package.json` holds the version. Release with `npm version patch|minor|major`:
the `version` script copies the number into all three `plugin.json` files and
`SKILL.md`, turns the `[Unreleased]` changelog section into the new version, and
npm commits and tags `vX.Y.Z`. Clients update when the `plugin.json` version changes.

## License

[MIT](LICENSE). `effects.md` and `motion.md` adapt material from
[svg-creator-skill](https://github.com/upbrew-tech/svg-creator-skill) (Apache-2.0) and
[pixel2motion](https://github.com/nolangz/pixel2motion) (MIT); see
[THIRD_PARTY_NOTICES.md](plugins/draw-better-svg/skills/draw-better-svg/THIRD_PARTY_NOTICES.md).
Libraries referenced by the scripts keep their own licenses; see
[ecosystem.md](plugins/draw-better-svg/skills/draw-better-svg/references/ecosystem.md).
