# Draw Better SVG

[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)](CHANGELOG.md)
[![Install](https://img.shields.io/badge/npx-skills%20add-black?style=flat-square)](https://github.com/vercel-labs/skills)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](LICENSE)

> An agent skill for planning, drawing, render-checking, and repairing editable SVG graphics:
> icons, logos, illustrations, diagrams, charts, patterns, and maps.

```bash
npx skills add arlinamid/draw-better-svg
```

The skill treats valid XML, correct geometry, and visual quality as three separate
requirements. It classifies the task, draws in passes (composition → structure →
geometry → style), renders the result at the sizes it will be shown at, and fixes
the most visible defect before adding detail.

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
├── SKILL.md                    workflow: route, brief, draw in passes, review, deliver
├── agents/openai.yaml          Codex / ChatGPT skill metadata
├── assets/
│   ├── brief-template.json     a worked planning brief
│   └── icon.svg
├── references/
│   ├── taxonomy.md             subject × construction × delivery classification
│   ├── scripting-guide.md      library recipes (SVG.js, Paper.js, Rough.js, D3, ELK …)
│   ├── prompting-guide.md      briefs and revision prompts
│   ├── review-and-repair.md    acceptance checks and repair loop
│   └── ecosystem.md            related skills, libraries, primary sources
└── scripts/
    ├── audit_svg.py            structural audit, standard library only
    ├── render_review.mjs       PNG previews on transparent, light and dark backgrounds
    ├── optimize_svg.mjs        conservative SVGO delivery copy
    └── generate_examples.mjs   example suite that uses every bundled library
```

The Python audit needs no packages. The Node tools are optional; install their
dependencies only when you use them:

```bash
npm ci --prefix scripts          # from the skill directory
python scripts/audit_svg.py drawing.svg --json
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
| `tools/` | validation and version sync |

## Development

```bash
npm run validate      # manifests, versions, SKILL.md frontmatter, links — no dependencies
npm run check         # + script syntax, audit smoke test, claude plugin validate --strict, npx skills --list
```

`package.json` holds the version. Release with `npm version patch|minor|major`:
the `version` script copies the number into all three `plugin.json` files and
`SKILL.md`, turns the `[Unreleased]` changelog section into the new version, and
npm commits and tags `vX.Y.Z`. Clients update when the `plugin.json` version changes.

## License

[MIT](LICENSE). Libraries referenced by the scripts keep their own licenses; see
[ecosystem.md](plugins/draw-better-svg/skills/draw-better-svg/references/ecosystem.md).
