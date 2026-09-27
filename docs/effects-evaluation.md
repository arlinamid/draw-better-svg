# Effects evaluation

Evaluated 27 September 2026 for draw-better-svg 1.1.0. Every filter, gradient,
template, and "power feature" recipe from
[upbrew-tech/svg-creator-skill](https://github.com/upbrew-tech/svg-creator-skill)
`references/advanced-techniques.md` (Apache-2.0) was rendered in a test scene,
plus repaired variants where the published version failed, plus browser checks
of motion claims from svg-creator and
[nolangz/pixel2motion](https://github.com/nolangz/pixel2motion) (MIT).

Reproduce:

```bash
npm ci --prefix plugins/draw-better-svg/skills/draw-better-svg/scripts
npm install --prefix tools/effects-lab
node tools/effects-lab/run.mjs          # 60 static recipes → review/effects-lab/
node tools/effects-lab/anim-checks.mjs  # 7 browser checks
```

## Method

- **Renderers:** Chromium 153 (Chrome, via playwright-core), librsvg (sharp 0.35.4),
  resvg (@resvg/resvg-js 2.6.2), all at 2× scale.
- **Effect:** share of pixels whose largest channel differs by more than 24 from the
  same scene without the effect. It shows whether the effect is visible, not whether
  it is good; subtle textures stay below the threshold by design.
- **Parity:** the same measure between librsvg or resvg and Chromium.
- **Audit:** `audit_svg.py` on each test file.
- **Visual review:** every row of the per-section overview sheets was inspected.

## Verdicts

✅ adopt · 🔧 adopt the repaired version · 🌐 browser-only, flag it · ❌ reject

### Works as published, same in all three renderers

| Recipe | Effect | Parity (librsvg / resvg) | Note |
| --- | --- | --- | --- |
| Drop, contact, cast shadow | 0.6–2 % | 0 / 0 % | ✅ |
| Soft glow | 5.2 % | 0 / 0 % | ✅ reads on dark backgrounds only |
| Inner shadow | 0.8 % | 0 / 0 % | ✅ |
| Vignette (`mix-blend-mode`) | 91 % | 0.3 / 0.3 % | ✅ strong at 0.45; start lower on light art |
| Contrast, warm, cool, gamma, duotone grading | 56–100 % | ≤ 0.3 % | ✅ |
| Posterize | 71 % | 1.4 % | ✅ intentionally bands gradients |
| Diffuse lighting | 21 % | 0.1 % | ✅ mostly darkens; tune per scene |
| Steel gradient | 20 % | 0 / 0 % | ✅ |
| Glass layers | 7 % | 0.4 % | ✅ |
| Light rays, fog mask, blurred clouds | 13–31 % | 0 % | ✅ |
| App icon with depth, logo with dimension | 14–55 % | ≤ 0.1 % | ✅ |
| Bar gradient + shadow | 20 % | 0 % | ✅ decoration must not change the value reading |
| Mesh-gradient workaround (radial blobs) | 70 % | 0 % | ✅ |
| Dot / diagonal / wave pattern tiles | 3.9 % | ≤ 0.01 % | ✅ |
| `paint-order="stroke fill"` halo | 1.3 % | 0.3 % | ✅ |
| `feTurbulence` frequency sweep | 57 % | 7.5 % | ✅ same character, different grain detail |
| Landscape template with defs completed | 100 % | 0 % | ✅ template only works once completed |

### Fails as published, works repaired

| Recipe | Published defect (seen in all renderers) | Repair (tested, parity ≤ 0.5 %) |
| --- | --- | --- |
| Salt & pepper grain on an element | Grey noise box fills the filter region around the shape | 🔧 blend, then `feComposite operator="in" in2="SourceAlpha"`; set strength with `feComponentTransfer` |
| Paper texture | Box around elements; on a canvas it darkens everything to ~50 % grey | 🔧 transfer intercept ≈ 0.9 and clip to `SourceAlpha` |
| Specular lighting | Washes the shape out to pale pink; the teal disc turns grey-white | 🔧 bevel: light a blurred alpha bump, clip, add with `arithmetic k2=1 k3≈0.55` |
| Emboss (`feConvolveMatrix`) | Invisible on flat vector fills (0.7 %) | 🔧 use the bevel instead |
| Glassmorphism | Blurs the panel itself; the stripes behind stay sharp. SVG filters cannot read the backdrop | 🔧 blur a clipped `<use>` copy of the backdrop under the panel |
| Wood grain | Replaces the board with a pale noise rectangle; rounded corners and color lost | 🔧 multiply grain into the fill and clip to `SourceAlpha` |
| Stone | Texture practically invisible (0.02 %) | 🔧 full-strength multiplied noise, clipped |
| Object-study template | References undefined `#bg-grad` and `#salt-pepper` (audit: 2 errors); once defined, the grain draws a light square around the sphere | 🔧 define both; texture the filled sphere with the clipped grain |
| Landscape template | Six undefined references (audit: 6 errors); sky, hills and trees disappear | ✅ once its defs are written |
| Donut with round caps | Round caps lengthen each segment by the stroke width: a 40 % segment covers ~46 % of the ring (two 15 px caps on a 503 px circumference) | 🔧 butt caps and `dasharray = value × 2πr` |

### Browser-only or renderer-dependent

| Feature | Chromium | librsvg | resvg | Guidance |
| --- | --- | --- | --- | --- |
| `color-interpolation="linearRGB"` on gradients | honored | ignored | ignored | 🌐 43 % of pixels differ. For portable files, bake linear-light interpolation into explicit stops (tested: identical in all three) |
| `vector-effect="non-scaling-stroke"` | correct | thinner than intended | ignored | 🌐 three different results |
| `var()` custom properties (attribute or style) | works | fallback value | **black fill** | 🌐 even a presentation-attribute fallback does not help resvg. For portable theming use `currentColor` + `color` (tested: identical in all three) |
| `pathLength` with dashes | works | ignored | ignored | 🌐 a `pathLength="100"` donut falls apart in static renderers; compute real dash lengths for static files. Draw-on animation with `pathLength="1"` is fine because it only runs in browsers |
| Turbulence + `feDisplacementMap` (water) | reference | 6 % off | 22 % off | 🌐 renderer-specific displacement; review in the target renderer |

### Rejected

| Recipe | Reason |
| --- | --- |
| Sharpen (`feConvolveMatrix`) | ❌ no visible effect on vector art (0.9 %); it is a raster operation |
| `color-interpolation-filters="linearRGB"` on every filter | ❌ redundant: linearRGB is already the default (0 % difference with and without it). Only `sRGB` changes the result |
| Thick round lines + joint circles for characters | ❌ for organic characters (produces the stick-figure anatomy our taxonomy lists as a failure); ✅ acceptable as a deliberate pictogram style |

## Motion claims (browser checks)

| Claim | Source | Result |
| --- | --- | --- |
| CSS animation inside an SVG does not run when the SVG is shown as `<img>` | svg-creator | **False in Chromium**: it runs. JavaScript does not. Test other engines before relying on either behavior |
| SMIL runs inside `<img>` | svg-creator | True in Chromium |
| `var()` as `animation-timing-function` inside `@keyframes` is silently dropped | pixel2motion | **True in Chromium**: at t = 500 ms the literal curve gives 24 px, the `var()` version 500 px, the same as linear |
| `pathLength="1"` normalizes draw-on dash animation | both | True in Chromium (offset 1 → 0.5 → 0) |
| The reduced-motion snippet lands on the final state | svg-creator | True in Chromium |
| `stroke-dasharray: 1 1` with butt caps and offset 1 shows no ink before a draw-on | pixel2motion | **Only on open paths.** A closed circle leaked 48 px (butt) and 851 px (round) at its seam. `1 2` with offset 1 was clean for butt and round caps, open and closed paths |
| An SVG can carry its own dark variant with `@media (prefers-color-scheme: dark)` | ours | True in Chromium for `<img>`, following the `<img>` element's used `color-scheme`; librsvg draws the light rules |

Also found while building the motion tooling: a wipe that ended on
`clip-path: inset(0 0 0 0)` with `animation-fill-mode: both` clipped glyph edges,
so the last frame differed from the static logo in 806 px. With the clip kept in
the keyframes and `fill-mode: backwards`, the last frame, the finished state, and
the reduced-motion view all matched the static SVG exactly (0 px).

## What the skill adopts

`references/effects.md` carries the ✅ and 🔧 recipes with the repairs above and the
🌐 portability table. The ❌ rows stay here as evidence, not in the skill.
