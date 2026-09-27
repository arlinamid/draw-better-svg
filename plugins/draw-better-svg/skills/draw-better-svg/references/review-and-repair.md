# Review and repair

## Contents

- Gates and evidence
- Visual rubric
- Common defects
- Meaningful automated checks
- Verification record

## Gates and evidence

Use a structural gate, a visual gate, and a delivery gate. Passing one does not
imply passing the others.

| Gate | Evidence | Cannot prove |
| --- | --- | --- |
| Structural | XML parses; finite viewBox; unique IDs; references resolve | Good anatomy, layout, complete SVG conformance |
| Visual | Inspected raster at actual sizes and relevant backgrounds | Browser interaction, all fonts/renderers, data provenance |
| Delivery | Tested in the actual host/editor and requested states | Universal support in other contexts |

For a new small icon, one target-size sheet and a structural audit are usually
enough. For animation, verify relevant frames and reduced motion in a browser.
For a reference reconstruction, compare aligned crops and semantic landmarks.
For a chart, test source-value-to-mark mapping as well as the raster.

## Visual rubric

Use the following as a heuristic, not a validated aesthetic measurement.
Score each applicable dimension 0 (fails), 1 (weak), 2 (adequate), or 3 (strong),
and attach at least one concrete observation to every score below 2.

| Dimension | What to inspect |
| --- | --- |
| Recognition | Can the intended object/message be identified at target size? |
| Composition | Is there a clear hierarchy and useful negative space? |
| Geometry | Do contours, joins, proportions, and perspective fit the intent? |
| Separation | Are objects, limbs, arrow paths, and cutouts unambiguous? |
| Style | Are stroke weights, corners, palette, and lighting coherent? |
| Text/data | Are labels, glyphs, values, units, and relationships correct? |
| Portability | Does the artifact behave in its required delivery context? |
| Editability | Can named objects or parameters be changed without reconstructing the file? |

Do not average away a failed required dimension. A gorgeous chart with wrong data
or a logo with a closed counter fails its relevant requirements. Mark inapplicable
dimensions N/A instead of forcing them into a misleading total score.

## Common defects

| Symptom | Likely cause | Repair |
| --- | --- | --- |
| Organic art looks assembled from toys | Primitive masses never became purposeful contours | Refine silhouette and connections before texture |
| Kink at curve join | Misaligned handles | Align tangents; inspect curvature and handle lengths |
| Wobbly contour | Excess anchors or noisy trace | Simplify with a controlled tolerance and compare silhouette |
| Shapes almost touch | Accidental tangent | Add a deliberate gap or overlap |
| Fill appears under an open curve | Implicit closing fill | Set fill to none for line work |
| Tiny icon looks muddy | Insufficient negative space or too much detail | Enlarge gaps; create a simpler small variant |
| Shadow clipped | Filter region too small | Expand bounds and rerender |
| White patch on transparency | Background-colored fake cutout | Use proper boolean geometry, clip, or mask |
| Mask behaves backward | Alpha/luminance confusion | Declare mask semantics and inspect opaque/transparent areas |
| Diagram arrows cross labels | Geometry generated before text sizing | Measure nodes, relayout, reroute and inspect |
| Text differs across computers | Missing or substituted font | Bundle/outline if permitted, or design for a verified fallback |
| Colors change in a web page | CSS inheritance, collision, or currentColor assumptions | Inspect actual embedding; scope styling and IDs |
| Two inline SVG copies break | Duplicate definition IDs | Prefix every instance and update all references |
| Optimized art loses behavior | Removed IDs, groups, metadata, or selectors | Keep master; disable destructive transforms and retest |
| Chart trend looks wrong | Wrong domain/order or decorative interpolation | Recompute from source data using a faithful mapping |
| Empty animation preview | Hidden initial state or static renderer | Provide visible static state and browser-test motion |

## Meaningful automated checks

Use automated checks for concrete failure classes: invalid roots, broken
references, duplicate IDs, missing required labels, wrong edge counts, numeric
data mismatch, nonfinite values, and accidental raster dependencies.

The bundled audit implements only part of this list. In particular, it does not
parse path grammar, perform computed-style evaluation, validate all CSS/SMIL
references, calculate collisions, recognize objects, or certify sanitization.
It will miss valid XML containing malformed path syntax and visual defects.

Use a real XML parser rather than regex as the document parser. Small regex checks
are useful for particular attributes but not complete SVG correctness. Use
appropriate sanitization and isolation for untrusted active SVG in an application;
this authoring skill is not a replacement for that application boundary.

Compare optimized and original renders at matching sizes and backgrounds. Exact
pixel equality is useful for a conservative cleanup with the same renderer.
Across renderers, antialiasing and fonts can legitimately differ; inspect the
differences instead of using an unexplained universal pixel threshold.

For bounds, don't assume a local geometry rectangle covers the painted result:
strokes, joins, markers, filters, clipping, and transforms need context. A nonempty
alpha bounding box detects emptiness, not good composition. A high path count can
be justified. File size is a delivery constraint, not an aesthetic measure.

## Verification record

Use a short record with:

```text
Output: reading.svg
Type: flat illustration / native vectors / standalone static file
Structural check: implemented audit rules pass
Visual review: 180, 360, 720 px; light background; key contour crop
Renderer: sharp/librsvg, recorded versions
Fixed: page overlap, lamp alignment
Not checked: animation (not present); print-editor round-trip
Remaining issue: none affecting the requested static web use
```

Only record checks actually performed. Optional unperformed checks do not need
to become blocking gates when they are irrelevant to the request.
