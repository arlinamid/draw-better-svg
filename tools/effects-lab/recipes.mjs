// Effect recipes under test. Filter, gradient, and template snippets marked
// "svg-creator" are reproduced from upbrew-tech/svg-creator-skill,
// references/advanced-techniques.md (Apache-2.0, see THIRD_PARTY_NOTICES.md);
// the test scenes around them are ours.
//
// Each recipe renders `test`; `baseline` is the same scene without the effect,
// so the harness can measure whether the effect is visible at all.

export const W = 320;
export const H = 240;

export function svg(defs, body, { w = W, h = H, bg = '#f4f1ea', viewBox } = {}) {
  const vb = viewBox ?? `0 0 ${w} ${h}`;
  const [, , vw, vh] = vb.split(' ').map(Number);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    (bg ? `<rect width="${vw}" height="${vh}" fill="${bg}"/>` : '') +
    body + '</svg>';
}

// The common subject: a warm rounded block with a teal disc, plus a dark label.
const blob = (attrs = '') =>
  `<g ${attrs}><rect x="90" y="60" width="140" height="110" rx="22" fill="#e8743b"/>` +
  `<circle cx="215" cy="75" r="30" fill="#2f6f73"/></g>`;
const label = '<text x="160" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#1f2a30">Draw Better</text>';
const colorful = `<defs><linearGradient id="sky0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3a5f"/><stop offset="0.6" stop-color="#7fb3d5"/><stop offset="1" stop-color="#f6c28b"/></linearGradient></defs>` +
  `<rect width="320" height="240" fill="url(#sky0)"/>` + blob() + label;
const stripes = `<defs><pattern id="st" patternUnits="userSpaceOnUse" width="24" height="24"><rect width="12" height="24" fill="#2f6f73"/><rect x="12" width="12" height="24" fill="#f4f1ea"/></pattern></defs><rect width="320" height="240" fill="url(#st)"/>`;

const F = 'x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="linearRGB"';
const shadow = (id, std, dx, dy, op) =>
  `<filter id="${id}" ${F}><feGaussianBlur in="SourceAlpha" stdDeviation="${std}" result="blur"/>` +
  `<feOffset in="blur" dx="${dx}" dy="${dy}" result="offset"/><feFlood flood-color="#1e1b4b" flood-opacity="${op}" result="color"/>` +
  `<feComposite in="color" in2="offset" operator="in" result="shadow"/><feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
const grade = (id, funcs) => `<filter id="${id}" color-interpolation-filters="linearRGB"><feComponentTransfer>${funcs}</feComponentTransfer></filter>`;
const rgb = (type, attrs) => ['R', 'G', 'B'].map((c) => `<feFunc${c} type="${type}" ${attrs}/>`).join('');
const soft = '<filter id="soft"><feGaussianBlur stdDeviation="4" color-interpolation-filters="linearRGB"/></filter>';
const saltPepper = `<filter id="salt-pepper" x="0" y="0" width="100%" height="100%" color-interpolation-filters="linearRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" stitchTiles="stitch" result="noise"/>` +
  `<feColorMatrix in="noise" type="saturate" values="0" result="mono"/><feBlend in="SourceGraphic" in2="mono" mode="multiply" result="pepper"/>` +
  `<feBlend in="pepper" in2="mono" mode="overlay" result="salted"/><feComponentTransfer in="salted"><feFuncA type="linear" slope="1" intercept="0"/></feComponentTransfer></filter>`;
const paper = `<filter id="paper" color-interpolation-filters="linearRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>` +
  `<feColorMatrix in="noise" type="saturate" values="0" result="gray"/><feComponentTransfer in="gray" result="subtle">${rgb('linear', 'slope="0.12" intercept="0.44"')}</feComponentTransfer>` +
  `<feBlend in="SourceGraphic" in2="subtle" mode="multiply"/></filter>`;
const vignetteGrad = '<radialGradient id="vignette-grad" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.45"/></radialGradient>';

const recipes = [];
const add = (r) => recipes.push({ source: 'svg-creator', ...r });

// ---------------------------------------------------------------- 1. filters

add({ id: 'drop-shadow', section: 'Filters', title: 'Drop shadow (blue-tinted)',
  test: svg(shadow('f', 4, 3, 5, 0.3), blob('filter="url(#f)"')), baseline: svg('', blob()) });
add({ id: 'contact-shadow', section: 'Filters', title: 'Contact shadow',
  test: svg(shadow('f', 1.5, 0, 1, 0.4), blob('filter="url(#f)"')), baseline: svg('', blob()) });
add({ id: 'cast-shadow', section: 'Filters', title: 'Cast shadow',
  test: svg(shadow('f', 6, 4, 8, 0.2), blob('filter="url(#f)"')), baseline: svg('', blob()) });
add({ id: 'glow', section: 'Filters', title: 'Soft glow (on dark)',
  test: svg(`<filter id="f" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="linearRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`, blob('filter="url(#f)"'), { bg: '#1d2433' }),
  baseline: svg('', blob(), { bg: '#1d2433' }) });
add({ id: 'inner-shadow', section: 'Filters', title: 'Inner shadow',
  test: svg(`<filter id="f" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="linearRGB"><feComponentTransfer in="SourceAlpha" result="inverse"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer><feGaussianBlur in="inverse" stdDeviation="3" result="blur"/><feOffset in="blur" dx="2" dy="3" result="offset"/><feComposite in="offset" in2="SourceAlpha" operator="in" result="inner"/><feFlood flood-color="#1e1b4b" flood-opacity="0.5" result="color"/><feComposite in="color" in2="inner" operator="in" result="shadow"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shadow"/></feMerge></filter>`, blob('filter="url(#f)"')),
  baseline: svg('', blob()) });
add({ id: 'salt-pepper-element', section: 'Filters', title: 'Salt & pepper grain on an element',
  claim: 'Apply at element level for selective texturing.',
  test: svg(saltPepper, blob('filter="url(#salt-pepper)"')), baseline: svg('', blob()) });
add({ id: 'salt-pepper-canvas', section: 'Filters', title: 'Salt & pepper grain on the whole canvas',
  test: svg(saltPepper, `<g filter="url(#salt-pepper)"><rect width="320" height="240" fill="#f4f1ea"/>${blob()}</g>`, { bg: null }),
  baseline: svg('', blob()) });
add({ id: 'paper-element', section: 'Filters', title: 'Paper texture on an element',
  test: svg(paper, blob('filter="url(#paper)"')), baseline: svg('', blob()) });
add({ id: 'paper-canvas', section: 'Filters', title: 'Paper texture on the whole canvas',
  test: svg(paper, `<g filter="url(#paper)"><rect width="320" height="240" fill="#f4f1ea"/>${blob()}</g>`, { bg: null }),
  baseline: svg('', blob()) });
add({ id: 'specular', section: 'Filters', title: 'Specular lighting',
  test: svg(`<filter id="f" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="linearRGB"><feSpecularLighting in="SourceAlpha" surfaceScale="5" specularConstant="0.75" specularExponent="25" lighting-color="#ffffff" result="specular"><fePointLight x="250" y="100" z="300"/></feSpecularLighting><feComposite in="specular" in2="SourceAlpha" operator="in" result="lit"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="lit"/></feMerge></filter>`, blob('filter="url(#f)"')),
  baseline: svg('', blob()) });
add({ id: 'diffuse', section: 'Filters', title: 'Diffuse lighting',
  test: svg(`<filter id="f" color-interpolation-filters="linearRGB"><feDiffuseLighting in="SourceAlpha" surfaceScale="4" diffuseConstant="1" lighting-color="#ffe4c4" result="diffuse"><feDistantLight azimuth="225" elevation="45"/></feDiffuseLighting><feComposite in="diffuse" in2="SourceGraphic" operator="in" result="lit"/><feBlend in="SourceGraphic" in2="lit" mode="multiply"/></filter>`, blob('filter="url(#f)"')),
  baseline: svg('', blob()) });
add({ id: 'emboss', section: 'Filters', title: 'Emboss (convolve)',
  test: svg('<filter id="f" color-interpolation-filters="linearRGB"><feConvolveMatrix order="3" kernelMatrix="-2 -1 0  -1 1 1  0 1 2"/></filter>', blob('filter="url(#f)"')),
  baseline: svg('', blob()) });
add({ id: 'sharpen', section: 'Filters', title: 'Sharpen (convolve) on text',
  test: svg('<filter id="f" color-interpolation-filters="linearRGB"><feConvolveMatrix order="3" kernelMatrix="0 -1 0  -1 5 -1  0 -1 0"/></filter>', `<g filter="url(#f)">${blob()}${label}</g>`),
  baseline: svg('', blob() + label) });
add({ id: 'frosted-glass', section: 'Filters', title: 'Glassmorphism panel over stripes',
  claim: 'Frosted glass: the panel should blur what lies behind it.',
  test: svg(`<filter id="f" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="linearRGB"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise"/><feColorMatrix in="noise" type="matrix" result="soft" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0"/><feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blurred"/><feDisplacementMap in="blurred" in2="soft" scale="12" xChannelSelector="R" yChannelSelector="G" result="distorted"/><feSpecularLighting in="soft" surfaceScale="2" specularConstant="0.6" specularExponent="30" lighting-color="#ffffff" result="shine"><fePointLight x="200" y="50" z="200"/></feSpecularLighting><feComposite in="shine" in2="SourceAlpha" operator="in" result="glass-shine"/><feMerge><feMergeNode in="distorted"/><feMergeNode in="glass-shine"/></feMerge></filter>`,
    stripes + '<rect x="70" y="50" width="180" height="140" rx="16" fill="#ffffff" fill-opacity="0.35" filter="url(#f)"/>', { bg: null }),
  baseline: svg('', stripes + '<rect x="70" y="50" width="180" height="140" rx="16" fill="#ffffff" fill-opacity="0.35"/>', { bg: null }) });
add({ id: 'vignette', section: 'Filters', title: 'Vignette overlay (mix-blend-mode)',
  test: svg(vignetteGrad, blob() + label + '<rect width="320" height="240" fill="url(#vignette-grad)" style="mix-blend-mode:multiply"/>'),
  baseline: svg('', blob() + label) });

// ---------------------------------------------------------------- 2-3. turbulence and grading

add({ id: 'turbulence-sweep', section: 'Turbulence', title: 'baseFrequency 0.02 / 0.1 / 0.3 / 0.7 / 1.5',
  test: svg([0.02, 0.1, 0.3, 0.7, 1.5].map((f, i) => `<filter id="t${i}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${f}" numOctaves="3" seed="4"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer></filter>`).join(''),
    [0, 1, 2, 3, 4].map((i) => `<rect x="${8 + i * 62}" y="40" width="56" height="160" filter="url(#t${i})"/>`).join('')),
  baseline: svg('', [0, 1, 2, 3, 4].map((i) => `<rect x="${8 + i * 62}" y="40" width="56" height="160" fill="#808080"/>`).join('')) });
for (const [id, title, funcs] of [
  ['grade-contrast', 'Contrast', rgb('linear', 'slope="1.5" intercept="-0.15"')],
  ['grade-warm', 'Warm shift', '<feFuncR type="linear" slope="1.1" intercept="0.05"/><feFuncG type="linear" slope="0.95" intercept="0"/><feFuncB type="linear" slope="0.85" intercept="-0.05"/>'],
  ['grade-cool', 'Cool shift', '<feFuncR type="linear" slope="0.85" intercept="-0.05"/><feFuncG type="linear" slope="0.9" intercept="0"/><feFuncB type="linear" slope="1.15" intercept="0.05"/>'],
  ['grade-posterize', 'Posterize', rgb('discrete', 'tableValues="0 0.25 0.5 0.75 1"')],
  ['grade-gamma', 'Gamma 0.7', rgb('gamma', 'amplitude="1" exponent="0.7" offset="0"')],
]) {
  add({ id, section: 'Color grading', title, test: svg(grade('f', funcs), `<g filter="url(#f)">${colorful}</g>`, { bg: null }), baseline: svg('', colorful, { bg: null }) });
}
add({ id: 'grade-duotone', section: 'Color grading', title: 'Duotone',
  test: svg('<filter id="f" color-interpolation-filters="linearRGB"><feColorMatrix type="saturate" values="0" result="gray"/><feComponentTransfer in="gray"><feFuncR type="table" tableValues="0.1 0.9"/><feFuncG type="table" tableValues="0.0 0.6"/><feFuncB type="table" tableValues="0.3 0.95"/></feComponentTransfer></filter>', `<g filter="url(#f)">${colorful}</g>`, { bg: null }),
  baseline: svg('', colorful, { bg: null }) });

// ---------------------------------------------------------------- 4. materials

const steel = '<linearGradient id="steel" x1="0" y1="0" x2="0" y2="1" color-interpolation="linearRGB"><stop offset="0%" stop-color="#e8e8e8"/><stop offset="20%" stop-color="#6b6b6b"/><stop offset="35%" stop-color="#d4d4d4"/><stop offset="50%" stop-color="#888"/><stop offset="65%" stop-color="#e0e0e0"/><stop offset="80%" stop-color="#555"/><stop offset="100%" stop-color="#b0b0b0"/></linearGradient>';
add({ id: 'steel', section: 'Materials', title: 'Steel gradient',
  test: svg(steel, '<rect x="60" y="50" width="200" height="140" rx="14" fill="url(#steel)"/>'),
  baseline: svg('', '<rect x="60" y="50" width="200" height="140" rx="14" fill="#9a9a9a"/>') });
add({ id: 'gold', section: 'Materials', title: 'Gold gradient (listed colors)',
  test: svg('<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1" color-interpolation="linearRGB"><stop offset="0%" stop-color="#fff7d1"/><stop offset="20%" stop-color="#b8860b"/><stop offset="35%" stop-color="#ffec99"/><stop offset="50%" stop-color="#daa520"/><stop offset="65%" stop-color="#ffd700"/><stop offset="80%" stop-color="#6b4c0a"/><stop offset="100%" stop-color="#8b6914"/></linearGradient>', '<rect x="60" y="50" width="200" height="140" rx="14" fill="url(#gold)"/>'),
  baseline: svg('', '<rect x="60" y="50" width="200" height="140" rx="14" fill="#daa520"/>') });
add({ id: 'glass', section: 'Materials', title: 'Glass layers over a scene',
  test: svg('<linearGradient id="glass-highlight" gradientTransform="rotate(-15)"><stop offset="0%" stop-color="white" stop-opacity="0.6"/><stop offset="100%" stop-color="white" stop-opacity="0"/></linearGradient>',
    colorful + '<g transform="translate(60 -30) scale(0.7)"><rect rx="12" width="200" height="300" fill="#88ccff" opacity="0.12"/><rect rx="8" x="15" y="8" width="50" height="240" fill="url(#glass-highlight)" opacity="0.5"/><rect rx="12" width="200" height="300" fill="none" stroke="#1e3a5f" stroke-width="1" opacity="0.3"/><ellipse cx="100" cy="285" rx="70" ry="10" fill="white" opacity="0.1"/></g>', { bg: null }),
  baseline: svg('', colorful, { bg: null }) });
add({ id: 'wood', section: 'Materials', title: 'Wood grain filter on a board',
  test: svg('<filter id="wood-grain" color-interpolation-filters="linearRGB"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.2" numOctaves="5" result="grain"/><feColorMatrix in="grain" type="matrix" result="brown" values="0.4 0.3 0.1 0 0.3  0.3 0.2 0.1 0 0.15  0.1 0.1 0.05 0 0.05  0 0 0 1 0"/></filter>', '<rect x="60" y="70" width="200" height="100" rx="8" fill="#9b6a3c" filter="url(#wood-grain)"/>'),
  baseline: svg('', '<rect x="60" y="70" width="200" height="100" rx="8" fill="#9b6a3c"/>') });
add({ id: 'water', section: 'Materials', title: 'Water: turbulence + displacement', source: 'svg-creator (described, parameters ours)',
  test: svg('<filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="0.01 0.08" numOctaves="2" seed="3" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="14" xChannelSelector="R" yChannelSelector="G"/></filter>', `<g filter="url(#f)">${stripes}</g>`, { bg: null }),
  baseline: svg('', stripes, { bg: null }) });
add({ id: 'stone', section: 'Materials', title: 'Stone: heavy multiplied noise', source: 'svg-creator (described, parameters from text)',
  test: svg('<filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="3" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feBlend in="SourceGraphic" in2="g" mode="multiply" result="m"/><feComposite in="m" in2="SourceAlpha" operator="in"/></filter>', '<polygon points="70,180 100,90 170,60 240,85 260,170 180,195" fill="#8d8478"/><polygon points="70,180 100,90 170,60 240,85 260,170 180,195" fill="#8d8478" filter="url(#f)" opacity="0.6"/>'),
  baseline: svg('', '<polygon points="70,180 100,90 170,60 240,85 260,170 180,195" fill="#8d8478"/>') });

// ---------------------------------------------------------------- 5. composition templates (as published)

const landscapeBody = (defs) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 800 500" role="img"><title>Landscape</title><defs>${defs}</defs>` +
  '<rect width="800" height="500" fill="url(#sky)"/><circle cx="600" cy="120" r="40" fill="#fbbf24"/><circle cx="600" cy="120" r="90" fill="url(#sun-glow)" opacity="0.4"/>' +
  '<path d="M0,350 Q200,220 400,310 Q550,260 800,320 L800,500 L0,500Z" fill="#94a3b8" opacity="0.4"/><path d="M0,380 Q150,290 300,350 Q450,310 600,340 L800,370 L800,500 L0,500Z" fill="#64748b" opacity="0.6"/>' +
  '<path d="M0,420 Q200,360 400,400 Q600,375 800,410 L800,500 L0,500Z" fill="url(#hill-gradient)"/><g id="trees" filter="url(#drop-shadow)"><use href="#tree" x="120" y="370" width="60" height="90"/><use href="#tree" x="350" y="380" width="45" height="70" opacity="0.85"/></g>' +
  '<rect y="280" width="800" height="220" fill="#bfdbfe" opacity="0.12"/><rect width="800" height="500" fill="url(#vignette-grad)"/></svg>';
add({ id: 'landscape-as-published', section: 'Templates', title: 'Landscape template, defs left as a comment',
  claim: 'Template with defs placeholder.', test: landscapeBody('<!-- sky, sun-glow, hill-gradient, drop-shadow, tree, vignette -->'),
  baseline: landscapeBody('') });
add({ id: 'landscape-completed', section: 'Templates', title: 'Landscape template with defs completed', source: 'svg-creator template, defs ours',
  test: landscapeBody('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="0.25" stop-color="#1e3a5f"/><stop offset="0.5" stop-color="#3b82f6"/><stop offset="0.75" stop-color="#93c5fd"/><stop offset="0.9" stop-color="#fde68a"/><stop offset="1" stop-color="#f97316"/></linearGradient><radialGradient id="sun-glow"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></radialGradient><linearGradient id="hill-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f7f4f"/><stop offset="1" stop-color="#1f4d33"/></linearGradient>' + shadow('drop-shadow', 4, 3, 5, 0.3) + '<symbol id="tree" viewBox="0 0 60 90"><rect x="26" y="60" width="8" height="30" fill="#5b3a1e"/><path d="M30 0 L58 64 H2 Z" fill="#2c6e49"/></symbol>' + vignetteGrad),
  baseline: landscapeBody('') });
const objectStudy = (extraDefs) => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 400 400"><defs><radialGradient id="obj" fx="0.35" fy="0.3" cx="45%" cy="45%" r="55%" color-interpolation="linearRGB"><stop offset="0%" stop-color="#fff7ed" stop-opacity="0.8"/><stop offset="15%" stop-color="#fb923c"/><stop offset="50%" stop-color="#ea580c"/><stop offset="85%" stop-color="#7c2d12"/><stop offset="100%" stop-color="#431407"/></radialGradient><filter id="soft"><feGaussianBlur stdDeviation="4" color-interpolation-filters="linearRGB"/></filter><clipPath id="obj-clip"><circle cx="200" cy="200" r="85"/></clipPath>${extraDefs}</defs>` +
  '<rect width="400" height="400" fill="url(#bg-grad)"/><ellipse cx="215" cy="340" rx="75" ry="12" fill="#1e1b4b" opacity="0.2" filter="url(#soft)"/><ellipse cx="205" cy="325" rx="50" ry="5" fill="#1e1b4b" opacity="0.35"/><circle cx="200" cy="210" r="85" fill="url(#obj)"/>' +
  '<ellipse cx="225" cy="235" rx="70" ry="75" fill="#3b1764" opacity="0.2" style="mix-blend-mode:multiply" clip-path="url(#obj-clip)"/><ellipse cx="175" cy="180" rx="35" ry="25" fill="#fff7ed" opacity="0.35" filter="url(#soft)"/><circle cx="170" cy="172" r="7" fill="white" opacity="0.85"/>' +
  '<ellipse cx="230" cy="250" rx="25" ry="35" fill="#fef3c7" opacity="0.12" clip-path="url(#obj-clip)"/><circle cx="200" cy="210" r="85" fill="none" filter="url(#salt-pepper)" opacity="0.08"/></svg>';
add({ id: 'object-study-as-published', section: 'Templates', title: 'Five-zone object study as published',
  test: objectStudy(''), baseline: objectStudy('').replace(/<circle cx="200" cy="210" r="85" fill="url\(#obj\)"\/>.*<\/svg>$/, '</svg>') });
add({ id: 'object-study-completed', section: 'Templates', title: 'Object study with bg-grad and salt-pepper defined', source: 'svg-creator template, two defs ours',
  test: objectStudy('<linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient>' + saltPepper),
  baseline: objectStudy('').replace(/<circle cx="200" cy="210" r="85" fill="url\(#obj\)"\/>.*<\/svg>$/, '</svg>') });
add({ id: 'character-lines', section: 'Templates', title: 'Character from thick round lines + joint cover',
  test: svg('', '<line x1="200" y1="80" x2="200" y2="200" stroke="#1e40af" stroke-width="30" stroke-linecap="round"/><line x1="200" y1="95" x2="160" y2="160" stroke="#dea87a" stroke-width="16" stroke-linecap="round"/><circle cx="200" cy="95" r="14" fill="#dea87a"/><circle cx="200" cy="50" r="24" fill="#dea87a"/>', { w: 400, h: 240 }),
  baseline: svg('', '', { w: 400, h: 240 }) });

// ---------------------------------------------------------------- 6. atmosphere

const night = '<rect width="320" height="240" fill="#1b2a41"/><path d="M0 190 Q80 150 160 180 T320 170 V240 H0Z" fill="#0d1726"/>';
add({ id: 'god-rays', section: 'Atmosphere', title: 'Light rays (screen blend)',
  test: svg('', night + '<g opacity="0.12" style="mix-blend-mode:screen" transform="scale(0.4)"><polygon points="500,80 280,500 340,500" fill="#fbbf24"/><polygon points="500,80 400,500 470,500" fill="#fbbf24"/><polygon points="500,80 550,500 640,500" fill="#fbbf24"/><polygon points="500,80 700,500 780,500" fill="#fbbf24"/></g>', { bg: null }),
  baseline: svg('', night, { bg: null }) });
add({ id: 'fog', section: 'Atmosphere', title: 'Fog band through a mask',
  test: svg('<mask id="fog-mask"><linearGradient id="fog-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="black"/><stop offset="30%" stop-color="white"/><stop offset="70%" stop-color="white"/><stop offset="100%" stop-color="black"/></linearGradient><rect y="120" width="320" height="100" fill="url(#fog-fade)"/></mask>', night + '<rect y="120" width="320" height="100" fill="white" opacity="0.25" mask="url(#fog-mask)"/>', { bg: null }),
  baseline: svg('', night, { bg: null }) });
add({ id: 'clouds', section: 'Atmosphere', title: 'Blurred ellipse clouds',
  test: svg(soft, '<g filter="url(#soft)"><ellipse cx="160" cy="100" rx="80" ry="35" fill="white" opacity="0.9"/><ellipse cx="115" cy="108" rx="55" ry="30" fill="white" opacity="0.85"/><ellipse cx="205" cy="106" rx="60" ry="28" fill="white" opacity="0.85"/><ellipse cx="160" cy="118" rx="90" ry="25" fill="white" opacity="0.8"/></g>', { bg: '#7fb3d5' }),
  baseline: svg('', '', { bg: '#7fb3d5' }) });

// ---------------------------------------------------------------- 7-8. icons and logos

const icon64 = (fx) => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 64 64"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1" color-interpolation="linearRGB"><stop offset="0%" stop-color="#818cf8"/><stop offset="50%" stop-color="#6366f1"/><stop offset="100%" stop-color="#4338ca"/></linearGradient><filter id="ico-shadow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="linearRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dy="2"/><feFlood flood-color="#1e1b4b" flood-opacity="0.25"/><feComposite operator="in" in2="SourceAlpha"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
  `<rect width="64" height="64" rx="14" fill="${fx ? 'url(#bg)' : '#6366f1'}" ${fx ? 'filter="url(#ico-shadow)"' : ''}/>${fx ? '<rect x="4" y="4" width="56" height="28" rx="10" fill="white" opacity="0.12"/>' : ''}` +
  '<g fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 42 L32 20 L42 42 M26 34 H38"/></g></svg>';
add({ id: 'icon-depth-64', section: 'Icons & logos', title: 'App icon with depth (64 viewBox)', test: icon64(true), baseline: icon64(false) });
const logoDim = (fx) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 200 200"><defs><linearGradient id="logo-fill" x1="0" y1="0" x2="0.5" y2="1" color-interpolation="linearRGB"><stop offset="0%" stop-color="#6366f1"/><stop offset="50%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#3730a3"/></linearGradient>${soft}</defs><rect width="200" height="200" fill="#f4f1ea"/>` +
  (fx ? '<circle cx="103" cy="106" r="72" fill="#1e1b4b" opacity="0.15" filter="url(#soft)"/>' : '') +
  `<circle cx="100" cy="100" r="70" fill="${fx ? 'url(#logo-fill)' : '#4f46e5'}"/>` + (fx ? '<path d="M45,75 Q100,40 155,75" fill="none" stroke="white" stroke-width="2" opacity="0.15" stroke-linecap="round"/>' : '') +
  '<path d="M70 130 L100 60 L130 130 Z M88 112 H112" fill="white"/></svg>';
add({ id: 'logo-dimension', section: 'Icons & logos', title: 'Logo with dimension', test: logoDim(true), baseline: logoDim(false) });

// ---------------------------------------------------------------- 10. data

add({ id: 'bar-gradient-shadow', section: 'Data', title: 'Bar with gradient + drop shadow',
  test: svg('<linearGradient id="bar" x1="0" y1="0" x2="0" y2="1" color-interpolation="linearRGB"><stop offset="0%" stop-color="#93c5fd"/><stop offset="50%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient>' + shadow('drop-shadow', 4, 3, 5, 0.3), '<rect x="60" y="80" width="50" height="130" rx="4" fill="url(#bar)" filter="url(#drop-shadow)"/><rect x="140" y="40" width="50" height="170" rx="4" fill="url(#bar)" filter="url(#drop-shadow)"/><rect x="220" y="120" width="50" height="90" rx="4" fill="url(#bar)" filter="url(#drop-shadow)"/>'),
  baseline: svg('', '<rect x="60" y="80" width="50" height="130" rx="4" fill="#3b82f6"/><rect x="140" y="40" width="50" height="170" rx="4" fill="#3b82f6"/><rect x="220" y="120" width="50" height="90" rx="4" fill="#3b82f6"/>') });
add({ id: 'donut-round-caps', section: 'Data', title: 'Donut 40 % segment: round caps (as published) vs butt',
  claim: 'stroke-dasharray = percentage × circumference.',
  test: svg('', '<circle cx="160" cy="120" r="80" fill="none" stroke="#e2e8f0" stroke-width="30"/><circle cx="160" cy="120" r="80" fill="none" stroke="#3b82f6" stroke-width="30" stroke-dasharray="201 503" transform="rotate(-90 160 120)" stroke-linecap="round"/>'),
  baseline: svg('', '<circle cx="160" cy="120" r="80" fill="none" stroke="#e2e8f0" stroke-width="30"/><circle cx="160" cy="120" r="80" fill="none" stroke="#3b82f6" stroke-width="30" stroke-dasharray="201 503" transform="rotate(-90 160 120)"/>') });

// ---------------------------------------------------------------- 11. backgrounds

add({ id: 'mesh-workaround', section: 'Backgrounds', title: 'Mesh gradient workaround + grain',
  test: svg('<radialGradient id="blob1" cx="30%" cy="25%" r="50%" fx="25%" fy="20%" color-interpolation="linearRGB"><stop offset="0%" stop-color="#818cf8" stop-opacity="0.6"/><stop offset="100%" stop-color="#818cf8" stop-opacity="0"/></radialGradient><radialGradient id="blob2" cx="70%" cy="60%" r="45%" color-interpolation="linearRGB"><stop offset="0%" stop-color="#f472b6" stop-opacity="0.5"/><stop offset="100%" stop-color="#f472b6" stop-opacity="0"/></radialGradient>' + saltPepper,
    '<rect width="320" height="240" fill="#0f172a"/><rect width="320" height="240" fill="url(#blob1)"/><rect width="320" height="240" fill="url(#blob2)"/><rect width="320" height="240" filter="url(#salt-pepper)" opacity="0.06"/>', { bg: null }),
  baseline: svg('', '<rect width="320" height="240" fill="#0f172a"/>', { bg: null }) });
add({ id: 'patterns', section: 'Backgrounds', title: 'Dot, diagonal, and wave tiles',
  test: svg('<pattern id="dots" patternUnits="userSpaceOnUse" width="20" height="20"><circle cx="10" cy="10" r="1.5" fill="#94a3b8"/></pattern><pattern id="diag" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#94a3b8" stroke-width="1"/></pattern><pattern id="wave" patternUnits="userSpaceOnUse" width="100" height="20"><path d="M0,10 Q25,0 50,10 Q75,20 100,10" fill="none" stroke="#94a3b8"/></pattern>',
    '<rect x="10" y="20" width="95" height="200" fill="url(#dots)"/><rect x="113" y="20" width="95" height="200" fill="url(#diag)"/><rect x="216" y="20" width="95" height="200" fill="url(#wave)"/>'),
  baseline: svg('', '') });

// ---------------------------------------------------------------- 12. power features

add({ id: 'paint-order-halo', section: 'Power features', title: 'paint-order halo text',
  test: svg('', stripes + '<text x="160" y="135" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#1f2a30" stroke="#ffffff" stroke-width="8" paint-order="stroke fill">Halo</text>', { bg: null }),
  baseline: svg('', stripes + '<text x="160" y="135" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#1f2a30">Halo</text>', { bg: null }) });
add({ id: 'non-scaling-stroke', section: 'Power features', title: 'vector-effect non-scaling-stroke under scale(3)',
  test: svg('', '<g transform="translate(20 30) scale(3)"><path d="M5 50 L30 10 L55 50 Z" fill="none" stroke="#1f2a30" stroke-width="2" vector-effect="non-scaling-stroke"/></g>'),
  baseline: svg('', '<g transform="translate(20 30) scale(3)"><path d="M5 50 L30 10 L55 50 Z" fill="none" stroke="#1f2a30" stroke-width="2"/></g>') });
add({ id: 'symbol-css-vars-attr', section: 'Power features', title: 'symbol + var() in presentation attributes (as published)',
  claim: 'use style="--icon-bg: #ef4444" recolors the symbol.',
  test: svg('<symbol id="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="var(--icon-bg, #3b82f6)"/><path d="M7 12 H17" stroke="var(--icon-stroke, white)" stroke-width="2"/></symbol>', '<use href="#icon" x="40" y="60" width="100" height="100" style="--icon-bg: #ef4444; --icon-stroke: #fff"/><use href="#icon" x="180" y="60" width="100" height="100"/>'),
  baseline: svg('', '') });
add({ id: 'symbol-css-vars-style', section: 'Power features', title: 'symbol + var() in style (corrected form)', source: 'ours, correction of the above',
  test: svg('<symbol id="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" style="fill: var(--icon-bg, #3b82f6)"/><path d="M7 12 H17" style="stroke: var(--icon-stroke, white)" stroke-width="2"/></symbol>', '<use href="#icon" x="40" y="60" width="100" height="100" style="--icon-bg: #ef4444; --icon-stroke: #fff"/><use href="#icon" x="180" y="60" width="100" height="100"/>'),
  baseline: svg('', '') });

// ---------------------------------------------------------------- claims about linearRGB

const gradPair = (attr) => svg(`<linearGradient id="g" ${attr}><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#00c000"/></linearGradient><linearGradient id="h" ${attr}><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#fde68a"/></linearGradient>`,
  '<rect x="20" y="40" width="280" height="70" fill="url(#g)"/><rect x="20" y="130" width="280" height="70" fill="url(#h)"/>');
add({ id: 'claim-gradient-linearrgb', section: 'Claims', title: 'color-interpolation="linearRGB" on gradients vs default',
  claim: 'Prevents dark banding in gradient midpoints.', source: 'svg-creator claim, test ours',
  test: gradPair('color-interpolation="linearRGB"'), baseline: gradPair('') });
const blurPair = (attr) => svg(`<filter id="f" ${attr}><feGaussianBlur stdDeviation="10"/></filter>`, '<g filter="url(#f)"><rect x="40" y="60" width="120" height="120" fill="#ff0000"/><rect x="160" y="60" width="120" height="120" fill="#00c000"/></g>');
add({ id: 'claim-filter-linearrgb-default', section: 'Claims', title: 'color-interpolation-filters="linearRGB" vs no attribute',
  claim: 'All filters need color-interpolation-filters="linearRGB".', source: 'svg-creator claim, test ours',
  test: blurPair('color-interpolation-filters="linearRGB"'), baseline: blurPair('') });
add({ id: 'claim-filter-srgb', section: 'Claims', title: 'color-interpolation-filters="sRGB" vs no attribute', source: 'ours (control)',
  test: blurPair('color-interpolation-filters="sRGB"'), baseline: blurPair('') });

// ---------------------------------------------------------------- repaired variants (ours)
// Each fixes a defect the published recipe showed in the lab, so the idea is
// judged separately from its first implementation.

const fix = (r) => add({ source: 'ours (repair)', section: 'Repairs', ...r });

// Grain and paper: keep the texture inside the shape and control its strength.
const grainIn = `<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" seed="7" result="noise"/>` +
  `<feColorMatrix in="noise" type="saturate" values="0" result="mono"/>` +
  `<feComponentTransfer in="mono" result="soft">${rgb('linear', 'slope="0.35" intercept="0.72"')}</feComponentTransfer>` +
  `<feBlend in="SourceGraphic" in2="soft" mode="multiply" result="tex"/><feComposite in="tex" in2="SourceAlpha" operator="in"/></filter>`;
fix({ id: 'fix-grain-element', title: 'Grain clipped to the shape (in SourceAlpha), strength via transfer',
  test: svg(grainIn, blob('filter="url(#grain)"')), baseline: svg('', blob()) });
const paperFix = `<filter id="paper2" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="2" result="noise"/>` +
  `<feColorMatrix in="noise" type="saturate" values="0" result="gray"/><feComponentTransfer in="gray" result="subtle">${rgb('linear', 'slope="0.16" intercept="0.9"')}</feComponentTransfer>` +
  `<feBlend in="SourceGraphic" in2="subtle" mode="multiply" result="tex"/><feComposite in="tex" in2="SourceAlpha" operator="in"/></filter>`;
fix({ id: 'fix-paper-canvas', title: 'Paper texture near white (0.90-1.06), clipped to source',
  test: svg(paperFix, `<g filter="url(#paper2)"><rect width="320" height="240" fill="#f4f1ea"/>${blob()}</g>`, { bg: null }), baseline: svg('', blob()) });

// Bevel: light a blurred alpha bump and ADD it (arithmetic) instead of painting it over.
const bevel = `<filter id="bevel" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">` +
  `<feGaussianBlur in="SourceAlpha" stdDeviation="4" result="bump"/>` +
  `<feSpecularLighting in="bump" surfaceScale="4" specularConstant="0.7" specularExponent="18" lighting-color="#ffffff" result="spec"><feDistantLight azimuth="225" elevation="40"/></feSpecularLighting>` +
  `<feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>` +
  `<feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0"/></filter>`;
fix({ id: 'fix-bevel', title: 'Specular bevel on a blurred alpha bump, added arithmetically',
  test: svg(bevel, blob('filter="url(#bevel)"')), baseline: svg('', blob()) });

// Frosted glass: SVG filters cannot read the backdrop, so blur a clipped copy of it.
const art = `<g id="art">${stripes}</g>`;
fix({ id: 'fix-frosted-glass', title: 'Frosted panel = blurred, clipped copy of the backdrop',
  test: svg('<clipPath id="panel"><rect x="70" y="50" width="180" height="140" rx="16"/></clipPath><filter id="fb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>',
    art + '<g clip-path="url(#panel)"><use href="#art" filter="url(#fb)"/><rect width="320" height="240" fill="#ffffff" fill-opacity="0.35"/></g><rect x="70.5" y="50.5" width="179" height="139" rx="16" fill="none" stroke="#ffffff" stroke-opacity="0.7"/>', { bg: null }),
  baseline: svg('', stripes + '<rect x="70" y="50" width="180" height="140" rx="16" fill="#ffffff" fill-opacity="0.35"/>', { bg: null }) });

// Wood: grain tinted around the board color and kept inside the board.
fix({ id: 'fix-wood', title: 'Wood grain multiplied into the board and clipped to it',
  test: svg('<filter id="wood2" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.015 0.25" numOctaves="4" seed="9" result="grain"/><feColorMatrix in="grain" type="saturate" values="0" result="g"/><feComponentTransfer in="g" result="gs">' + rgb('linear', 'slope="0.7" intercept="0.55"') + '</feComponentTransfer><feBlend in="SourceGraphic" in2="gs" mode="multiply" result="t"/><feComposite in="t" in2="SourceAlpha" operator="in"/></filter>', '<rect x="60" y="70" width="200" height="100" rx="8" fill="#9b6a3c" filter="url(#wood2)"/>'),
  baseline: svg('', '<rect x="60" y="70" width="200" height="100" rx="8" fill="#9b6a3c"/>') });

// Stone: visible texture, clipped.
fix({ id: 'fix-stone', title: 'Stone texture at full strength inside the shape',
  test: svg('<filter id="st2" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="4" seed="5" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComponentTransfer in="g" result="gs">' + rgb('linear', 'slope="0.9" intercept="0.45"') + '</feComponentTransfer><feBlend in="SourceGraphic" in2="gs" mode="multiply" result="m"/><feComposite in="m" in2="SourceAlpha" operator="in"/></filter>', '<polygon points="70,180 100,90 170,60 240,85 260,170 180,195" fill="#8d8478" filter="url(#st2)"/>'),
  baseline: svg('', '<polygon points="70,180 100,90 170,60 240,85 260,170 180,195" fill="#8d8478"/>') });

// Object study texture on the filled sphere instead of an unfilled circle's box.
fix({ id: 'fix-object-study', title: 'Object study with the clipped grain on the sphere', source: 'svg-creator template, repair ours',
  test: objectStudy('<linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient>' + grainIn.replace('id="grain"', 'id="salt-pepper"'))
    .replace('<circle cx="200" cy="210" r="85" fill="none" filter="url(#salt-pepper)" opacity="0.08"/>', '<circle cx="200" cy="210" r="85" fill="#ea580c" filter="url(#salt-pepper)" opacity="0.25"/>'),
  baseline: objectStudy('').replace(/<circle cx="200" cy="210" r="85" fill="url\(#obj\)"\/>.*<\/svg>$/, '</svg>') });

// Portable smooth gradient: interpolate in linear light ourselves and write the stops.
const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = (c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const linStops = (a, b, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n;
  const c = hex(a).map((v, k) => toSrgb(toLin(v) * (1 - t) + toLin(hex(b)[k]) * t));
  return `<stop offset="${t.toFixed(3)}" stop-color="rgb(${c.join(',')})"/>`;
}).join('');
fix({ id: 'fix-gradient-linear-stops', title: 'Linear-light gradient baked into 9 explicit sRGB stops',
  test: svg(`<linearGradient id="g">${linStops('#ff0000', '#00c000')}</linearGradient><linearGradient id="h">${linStops('#1e3a8a', '#fde68a')}</linearGradient>`, '<rect x="20" y="40" width="280" height="70" fill="url(#g)"/><rect x="20" y="130" width="280" height="70" fill="url(#h)"/>'),
  baseline: gradPair('') });

// Custom properties with a static fallback for renderers without var().
fix({ id: 'fix-symbol-vars-fallback', title: 'var() in style + plain presentation attribute fallback',
  test: svg('<symbol id="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#3b82f6" style="fill: var(--icon-bg, #3b82f6)"/><path d="M7 12 H17" stroke="#ffffff" style="stroke: var(--icon-stroke, white)" stroke-width="2"/></symbol>', '<use href="#icon" x="40" y="60" width="100" height="100" style="--icon-bg: #ef4444; --icon-stroke: #fff"/><use href="#icon" x="180" y="60" width="100" height="100"/>'),
  baseline: svg('', '') });

// Theming through currentColor, which static renderers implement.
fix({ id: 'fix-symbol-currentcolor', title: 'symbol recolored through currentColor + color on <use>',
  test: svg('<symbol id="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7 12 H17" stroke="#ffffff" stroke-width="2"/></symbol>', '<use href="#icon" x="40" y="60" width="100" height="100" color="#ef4444"/><use href="#icon" x="180" y="60" width="100" height="100" color="#3b82f6"/>'),
  baseline: svg('', '') });

// Donut with butt caps and a rounded look drawn by explicit end discs only when data allows.
fix({ id: 'fix-donut-exact', title: 'Donut 40 % with pathLength="100" and butt caps', source: 'ours',
  test: svg('', '<circle cx="160" cy="120" r="80" fill="none" stroke="#e2e8f0" stroke-width="30"/><circle cx="160" cy="120" r="80" fill="none" stroke="#3b82f6" stroke-width="30" pathLength="100" stroke-dasharray="40 60" transform="rotate(-90 160 120)"/>'),
  baseline: svg('', '<circle cx="160" cy="120" r="80" fill="none" stroke="#e2e8f0" stroke-width="30"/>') });

export default recipes;
