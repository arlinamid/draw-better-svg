---
name: draw-better-svg
description: >-
  Plan, create, inspect, and repair well-drawn editable SVG graphics with
  type-specific geometry, library selection, and rendered visual review.
  Use for SVG illustrations, icons, logos, organic line art, diagrams, charts,
  patterns, maps, vector assets, SVG quality problems, and SVG prompting or
  scripting guidance. Distinguish real vectors from raster images in SVG
  wrappers and static assets from interactive web SVG.
license: MIT
metadata:
  version: "1.0.0"
  repository: https://github.com/arlinamid/draw-better-svg
---

# Draw Better SVG

Improve the drawing before compressing the markup. Treat valid XML, geometric
correctness, and visual quality as separate requirements.

## Route the task

1. Read [taxonomy.md](references/taxonomy.md) to classify the subject, construction,
   and delivery context. SVG is one format; the categories are practical workflows.
2. For an existing file, run `python3 scripts/audit_svg.py INPUT.svg --json` from
   this skill directory, then render it. Report structural facts separately from
   visual judgments. Do not infer the subject from element counts alone.
3. Read [scripting-guide.md](references/scripting-guide.md) for implementation,
   [prompting-guide.md](references/prompting-guide.md) for briefs and revision prompts,
   and [review-and-repair.md](references/review-and-repair.md) for acceptance checks.
4. Read [ecosystem.md](references/ecosystem.md) only when choosing a library,
   comparing existing skills, or checking primary sources.

## Establish a brief

Extract the subject, intended audience, target sizes, background, visual style,
exact text/data, required editability, and output environment. Use
`assets/brief-template.json` as a planning example, not a fixed design prescription.
State useful assumptions and proceed; ask only when the answer changes the
meaning, required geometry, or delivery format.

Choose a target-size family, not just a large viewBox. A 24 px icon and a 960 px
illustration need different detail budgets. Keep source data separate from
coordinates. Preserve the user's references and existing artwork constraints.

## Draw in passes

1. **Composition:** allocate bounds, negative space, dominant silhouette, and
   layer order. For figures, place gesture and anatomical landmarks first. For
   diagrams, measure text and calculate node layout before routing connectors.
2. **Structure:** draw the major masses in flat tones. Use local coordinates and
   named groups. Render this pass when structure or subject recognition is uncertain.
3. **Geometry:** refine a small set of purposeful Bézier segments, joins, cutouts,
   overlaps, and perspective. Prefer computed geometry to guessed path strings.
4. **Style:** apply a limited palette, consistent line hierarchy, and a defined
   light direction. Add texture only when it serves the requested style.
5. **Review:** render at the intended display sizes; inspect the image. Fix the
   highest-impact visible defect in geometry or composition before adding detail.
6. **Delivery:** keep an editable source, generate an optimized copy only when
   useful, and rerender the copy. Report what was actually checked.

Keep visual changes local during repair. Translate criticism into a visible
defect, its cause, and a concrete edit. Do not claim that a file is visually
verified merely because XML parsing or an automated check passed.

## Choose the smallest useful toolkit

| Need | Default |
| --- | --- |
| Small icon or simple symbol | Native SVG primitives and short paths |
| Repeated objects, structured illustration | SVG.js; add svgdom for headless Node |
| Boolean shapes, curve editing | Paper.js geometry; serialize pathData in headless Node |
| Sketch surface | Rough.js with a fixed seed |
| Pressure ink | Perfect Freehand with explicit pressure points |
| Quantitative chart | D3 scales/shapes or an established chart tool |
| Branching diagram | ELK layout, then SVG rendering |
| Preview | sharp/librsvg or resvg; use a browser for browser-specific behavior |
| Delivery optimization | SVGO after visual approval |

Do not install the whole toolkit for one small icon. The bundled example suite
uses all dependencies to demonstrate them; ordinary tasks should select a subset.
Respect host instructions for image tools. A raster reference or traced bitmap
does not establish that the final result is clean, editable vector artwork.

## Apply precise SVG rules

- Set the standalone SVG namespace and a finite positive `viewBox`. Preserve
  aspect ratio unless intentional stretching is part of the brief.
- Reserve room for strokes, markers, and filters; geometry bounds alone are not
  always painted bounds. Use SVG paint order deliberately.
- Name groups by objects; prefix definition IDs. Repeated inline instances need
  instance-unique IDs as well as file prefixes.
- Use `fill="none"` for open line work. Define clipping/masking coordinate
  systems deliberately; choose alpha versus luminance mask semantics explicitly.
- Choose `currentColor` for themeable inline assets; external SVG images do not
  inherit their host page's CSS color. Test the actual embedding mode.
- Keep text live when editing or selection matters; outline a delivery copy only
  when needed and when the font license permits. Keep accessible naming and the
  original text. Verify Hungarian accents when present: á é í ó ö ő ú ü ű.
- Keep animation and interaction as an explicit delivery profile. Provide a
  meaningful static state and reduced-motion behavior; test them in a browser.
- Keep vector deliverables free of raster placeholders unless hybrid output is
  requested. Do not substitute a background-colored shape for a transparent hole.

## Use the bundled scripts

Run from this skill directory, or use its absolute path. Install optional Node
dependencies with `npm ci --prefix scripts` only when using the example/render
tools. The Python audit has no third-party dependencies; where `python3` is
missing (common on Windows), run the same commands with `python`.

```bash
python3 scripts/audit_svg.py drawing.svg --json
node scripts/generate_examples.mjs ./review/examples
node scripts/render_review.mjs drawing.svg ./review/drawing 24,48,256
node scripts/optimize_svg.mjs drawing.svg drawing.min.svg
```

Select meaningful raster widths for the artwork. `render_review.mjs` creates
transparent, light, and dark static previews. Fixed backgrounds inside the SVG
remain fixed. Neither it nor the audit verifies animation, full SVG conformance,
text collisions, appearance, accessibility behavior, or safety of untrusted files.
Use the web audit profile only for intentional web/hybrid features; review its
warnings. Treat optimization as optional and preserve the editable master.

## Finish

Deliver the requested SVG and, where useful, its generator and a preview. State
the target sizes and renderer actually inspected; distinguish unresolved browser,
font, or motion checks. Use the host's persistent file-saving workflow. Do not
promise recognition, aesthetic quality, or cross-renderer fidelity without evidence.
