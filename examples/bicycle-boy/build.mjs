#!/usr/bin/env node
// Generator for boy-bike.svg: a boy riding a bicycle, looping CSS animation.
// Geometry is computed, not guessed: legs are solved by two-bone IK at 24 crank
// angles, the arm by IK to the grip, and every scrolling layer moves at a speed
// derived from the wheel's rolling speed on one 1600 ms clock.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'boy-bike.svg');
const f = (v) => Math.round(v * 100) / 100;
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// ---------------------------------------------------------------- palette
const C = {
  sky: '#d7ecf2', sun: '#ffd36b', cloud: '#ffffff', hillFar: '#bfe0cb', hill: '#a8d5b8', grass: '#8cc79f',
  trunk: '#8a5a3b', crown: '#4f9a6b', crown2: '#5fae7a', road: '#4a5560', roadEdge: '#6b7780', dash: '#f4f1ea',
  frame: '#e5484d', frameDark: '#b8323a', tire: '#1f2a30', rim: '#c9d1d6', spoke: '#aeb8be', metal: '#6b7780',
  shirt: '#2f6f9f', shirtDark: '#255a82', shorts: '#2b3a4a', shortsDark: '#1e2a36', skin: '#f2c49b', skinDark: '#d9a97c',
  shoe: '#1f2a30', helmet: '#f59e0b', helmetDark: '#d9860a', hair: '#5b3a1e', ink: '#1f2a30', cheek: '#f19a8a',
};

// ---------------------------------------------------------------- scene constants
const W = 480, H = 300;
const ROAD = 236;                 // top of the road
const R = 40;                     // wheel radius (outside of the tire)
const REAR = [168, 218], FRONT = [298, 218];
const BB = [226, 222];            // bottom bracket (crank axle)
const CRANK = 17;
const SEAT = [210, 158], HEAD_TOP = [284, 150], HEAD_BOT = [288, 168];
const HIP = [214, 146];
const THIGH = 43, SHIN = 46;        // near-straight knee (≈145°) at the bottom of the stroke, as a rider's should be
const SHOULDER = [240, 100];
const GRIP = [272, 141];
const UPPER = 30, FORE = 29;
const HEAD = [256, 73], HEAD_R = 18;

// One clock: every period is commensurate with the pedal turn.
const T_CRANK = 1600, T_WHEEL = 800;
const SPEED = (2 * Math.PI * R) / (T_WHEEL / 1000);   // px/s the road moves under the wheels
const DASH_PERIOD = SPEED * 0.4;                       // 400 ms per dash tile
const T_TREES = 3200, T_CLOUDS = 16000;                // 480 px tiles; both divide the 16 s loop

// ---------------------------------------------------------------- shapes
// A limb from (0,0) along +x: tapered capsule with round ends, widths w0 → w1.
// The sides are the true outer tangents of the two end circles, so the
// straight edges meet the round ends without a kink (path_audit found 3° kinks
// when the sides ran to the circles' tops instead).
function capsule(len, w0, w1) {
  const a = w0 / 2, b = w1 / 2;
  const beta = Math.asin((a - b) / len);
  const s = Math.sin(beta), c = Math.cos(beta);
  const p1u = [a * s, -a * c], p2u = [len + b * s, -b * c];
  const p2d = [len + b * s, b * c], p1d = [a * s, a * c];
  const P = (p) => `${f(p[0])} ${f(p[1])}`;
  return `M${P(p1u)} L${P(p2u)} A${f(b)} ${f(b)} 0 0 1 ${P(p2d)} L${P(p1d)} A${f(a)} ${f(a)} 0 ${beta > 0 ? 1 : 0} 1 ${P(p1u)} Z`;
}
// Two-bone IK: the joint on the side that `pick` prefers.
function ik(root, target, l1, l2, pick) {
  const d = Math.min(dist(root, target), l1 + l2 - 1e-6);
  const phi = Math.atan2(target[1] - root[1], target[0] - root[0]);
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const options = [phi - alpha, phi + alpha].map((t) => {
    const joint = [root[0] + l1 * Math.cos(t), root[1] + l1 * Math.sin(t)];
    return { t, joint };
  });
  const best = options.sort((p, q) => pick(q.joint) - pick(p.joint))[0];
  const psi = Math.atan2(target[1] - best.joint[1], target[0] - best.joint[0]);
  return { upper: deg(best.t), lower: deg(psi - best.t), joint: best.joint };
}
const unwrap = (list) => list.reduce((out, v) => {
  if (!out.length) return [v];
  let x = v;
  while (x - out.at(-1) > 180) x -= 360;
  while (x - out.at(-1) < -180) x += 360;
  return [...out, x];
}, []);

// ---------------------------------------------------------------- leg poses
const A0 = -40;           // near crank angle at t = 0 (degrees, clockwise, 0 = forward)
const STEPS = 24;
// Foot frame: origin at the pedal under the ball of the foot, x along the sole.
const ANKLE = [-8, -6];                                   // ankle relative to the ball of the foot
const pitchAt = (aDeg) => 10 + 8 * Math.sin(rad(aDeg));   // toes down most at the bottom of the stroke
function footAt(aDeg) {
  const a = rad(aDeg), p = rad(pitchAt(aDeg));
  const pedal = [BB[0] + CRANK * Math.cos(a), BB[1] + CRANK * Math.sin(a)];
  const ankle = [pedal[0] + ANKLE[0] * Math.cos(p) - ANKLE[1] * Math.sin(p), pedal[1] + ANKLE[0] * Math.sin(p) + ANKLE[1] * Math.cos(p)];
  return { pedal, ankle, pitch: pitchAt(aDeg) };
}
function legPoses(phase) {
  const poses = [];
  for (let k = 0; k <= STEPS; k++) {
    const foot = footAt(A0 + phase + (360 * k) / STEPS);
    const s = ik(HIP, foot.ankle, THIGH, SHIN, (j) => j[0]);   // knee forward
    poses.push({ thigh: s.upper, shin: s.lower, reach: dist(HIP, foot.ankle), foot });
  }
  return {
    thigh: unwrap(poses.map((p) => p.thigh)), shin: unwrap(poses.map((p) => p.shin)),
    reach: poses.map((p) => p.reach), feet: poses.map((p) => p.foot),
  };
}
const near = legPoses(0), far = legPoses(180);
const keyframes = (name, values) => `@keyframes ${name}{${values.map((v, k) => `${f((k / STEPS) * 100)}%{transform:rotate(${f(v)}deg)}`).join('')}}`;

// ---------------------------------------------------------------- scenery
const cloud = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="-14" cy="0" r="12"/><circle cx="4" cy="-8" r="16"/><circle cx="22" cy="0" r="11"/><rect x="-26" y="0" width="58" height="11" rx="5.5"/></g>`;
const cloudTile = [cloud(60, 52, 1), cloud(250, 34, 0.8), cloud(390, 70, 0.65)].join('');
const tree = (x, s, tone) => `<g transform="translate(${x} ${ROAD}) scale(${s})"><rect x="-3" y="-34" width="6" height="34" rx="2" fill="${C.trunk}"/><circle cx="0" cy="-44" r="17" fill="${tone}"/><circle cx="-9" cy="-36" r="11" fill="${tone}"/><circle cx="10" cy="-35" r="12" fill="${tone}"/></g>`;
const treeTile = [tree(36, 1, C.crown), tree(128, 0.8, C.crown2), tree(236, 1.1, C.crown), tree(330, 0.75, C.crown2), tree(420, 0.95, C.crown)].join('');
const dashes = Array.from({ length: Math.ceil(W / DASH_PERIOD) + 2 }, (_, i) => `<rect x="${f(i * DASH_PERIOD)}" y="277" width="58" height="5" rx="2.5"/>`).join('');

// ---------------------------------------------------------------- bicycle
const tube = (a, b, w = 6, color = C.frame) => `<path d="M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
const SEAT_JOIN = [211, 164];
function wheel(id, c) {
  const spokes = Array.from({ length: 12 }, (_, i) => {
    const t = (i * Math.PI) / 6;
    return `<path d="M${f(4 * Math.cos(t))} ${f(4 * Math.sin(t))} L${f(30 * Math.cos(t))} ${f(30 * Math.sin(t))}"/>`;
  }).join('');
  return `<g id="${id}" transform="translate(${c[0]} ${c[1]})">
    <circle r="${R - 3.5}" fill="none" stroke="${C.tire}" stroke-width="7"/>
    <g class="spin">
      <circle r="31" fill="none" stroke="${C.rim}" stroke-width="2"/>
      <g stroke="${C.spoke}" stroke-width="1.2" stroke-linecap="round">${spokes}</g>
      <rect x="29" y="-2" width="5" height="4" rx="1" fill="${C.metal}"/>
      <circle r="4.5" fill="${C.metal}"/>
    </g>
  </g>`;
}
function crank(id, cls, angle) {
  return `<g transform="translate(${BB[0]} ${BB[1]})"><g id="${id}" class="${cls}" transform="rotate(${angle})">
    <path d="${capsule(CRANK, 5, 4)}" fill="${C.metal}"/>
    <g transform="translate(${CRANK} 0)"><g class="${cls}-pedal" transform="rotate(${-angle})">
      <rect x="-7" y="-1.5" width="14" height="3" rx="1.5" fill="${C.tire}"/>
    </g></g>
  </g></g>`;
}
// A sneaker in the foot frame: heel behind the ankle, ball over the pedal, toe cap in front.
// Every join is tangent (path_audit flagged 13–17° kinks in the first version):
// rounded heel, heel counter, vamp, toe cap, flat sole.
const SHOE = 'M-10.5 1.6 C-13 1.6 -13.6 -1.5 -13.2 -4 C-12.8 -6.6 -11.4 -9 -9 -9.1 L-4 -9.2 C0 -9.3 2 -7 4.6 -5.2 C7.2 -3.4 9 -2.6 8.8 -0.6 C8.6 1.2 7 1.6 5 1.6 L-10.5 1.6 Z';
function foot(id, cls, feet, color) {
  const f0 = feet[0];
  return `<g id="${id}" class="${cls}" transform="translate(${f(f0.pedal[0])} ${f(f0.pedal[1])}) rotate(${f(f0.pitch)})">
    <path id="${id.replace('-foot', '-shoe')}" d="${SHOE}" fill="${color}"/>
    <path d="M-11 0.4 L7.5 0.4" stroke="#f4f1ea" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/>
  </g>`;
}
const footKeyframes = (name, feet) => `@keyframes ${name}{${feet.map((ft, k) => `${f((k / STEPS) * 100)}%{transform:translate(${f(ft.pedal[0])}px,${f(ft.pedal[1])}px) rotate(${f(ft.pitch)}deg)}`).join('')}}`;
function leg(id, cls, poses, colors) {
  return `<g id="${id}" transform="translate(${HIP[0]} ${HIP[1]})"><g class="${cls}-thigh" transform="rotate(${f(poses.thigh[0])})">
    <g transform="translate(${THIGH} 0)"><g class="${cls}-shin" transform="rotate(${f(poses.shin[0])})">
      <path d="${capsule(SHIN, 11, 8)}" fill="${colors.skin}"/>
      <path d="M${SHIN - 9} -4.6 L${SHIN - 1} -4.2 L${SHIN - 1} 4.2 L${SHIN - 9} 4.6 Z" fill="#ffffff" opacity="0.9"/>
    </g></g>
    <path d="${capsule(THIGH, 15, 12)}" fill="${colors.skin}"/>
    <path d="${capsule(THIGH * 0.62, 18, 15)}" fill="${colors.shorts}"/>
  </g></g>`;
}

// ---------------------------------------------------------------- rider upper body
// Character motion (the classic principles, applied):
//   timing / slow in-out   the torso rocks forward and dips on each pedal
//                          downstroke (800 ms), eased by a cosine curve
//   follow-through         the head lags the torso by 15 % of a stroke and
//                          counter-rotates, so the eyes stay steadier than the body
//   secondary action       the wind flutters a hair tuft (400 ms)
//   solid drawing          hands stay on the grips: the arm is re-solved by IK for
//                          every torso sample, not rotated as a rigid piece
//   appeal                 a slightly larger head and a catch-light in the eye
const torsoAngle = deg(Math.atan2(SHOULDER[1] - HIP[1], SHOULDER[0] - HIP[0]));
const torsoLen = dist(HIP, SHOULDER);
const NECK = [SHOULDER[0] + 5, SHOULDER[1] - 7];
const BODY_STEPS = 16;
const ROCK_DEG = 2.4, DIP_PX = 0.9, HEAD_LAG = 0.15;
const ease = (u) => (1 - Math.cos(2 * Math.PI * u)) / 2;          // 0 → 1 → 0 over a stroke
const bodyAt = (u) => ({ rock: ROCK_DEG * ease(u), dip: DIP_PX * ease(u) });
const torsoFrames = Array.from({ length: BODY_STEPS + 1 }, (_, k) => bodyAt(k / BODY_STEPS));
const headFrames = torsoFrames.map((_, k) => {
  const u = k / BODY_STEPS;
  const lagged = bodyAt((u - HEAD_LAG + 1) % 1);
  return -0.55 * lagged.rock + 1.1 * Math.sin(2 * Math.PI * (u - HEAD_LAG));
});
// Shoulder in world space for a torso pose (rotation about the hip, then the dip).
const shoulderAt = ({ rock, dip }) => {
  const a = rad(rock), dx = SHOULDER[0] - HIP[0], dy = SHOULDER[1] - HIP[1];
  return [HIP[0] + dx * Math.cos(a) - dy * Math.sin(a), HIP[1] + dx * Math.sin(a) + dy * Math.cos(a) + dip];
};
const armFrames = torsoFrames.map((p) => { const s = shoulderAt(p); return { s, ...ik(s, GRIP, UPPER, FORE, (j) => j[1]) }; });
const armUpper = unwrap(armFrames.map((a) => a.upper)), armLower = unwrap(armFrames.map((a) => a.lower));
const pct = (k, n) => f((k / n) * 100);
const bodyKeyframes = [
  `@keyframes torso{${torsoFrames.map((p, k) => `${pct(k, BODY_STEPS)}%{transform:translateY(${f(p.dip)}px) rotate(${f(p.rock)}deg)}`).join('')}}`,
  `@keyframes head-lag{${headFrames.map((v, k) => `${pct(k, BODY_STEPS)}%{transform:rotate(${f(v)}deg)}`).join('')}}`,
  `@keyframes arm-upper{${armFrames.map((a, k) => `${pct(k, BODY_STEPS)}%{transform:translate(${f(a.s[0])}px,${f(a.s[1])}px) rotate(${f(armUpper[k])}deg)}`).join('')}}`,
  `@keyframes arm-fore{${armLower.map((v, k) => `${pct(k, BODY_STEPS)}%{transform:rotate(${f(v)}deg)}`).join('')}}`,
].join('\n');

// A child's head in profile, facing right (review round 1: "face not anatomy
// correct"). Proportions: a large round cranium over a small face; the eye just
// below the head's middle and set back from the profile; a button nose; lips and
// chin under it; the ear behind the jaw hinge; the helmet strap runs in front of
// the ear along the jaw to under the chin, never across the cheek.
function headShape(c) {
  const [x, y] = c;
  const P = (dx, dy) => `${f(x + dx)} ${f(y + dy)}`;
  const face = `M${P(-16, 7)} C${P(-20, -0.2)} ${P(-13, -20)} ${P(0, -20)} C${P(10, -20)} ${P(16, -13)} ${P(16.5, -5)}`
    + ` C${P(16.8, -0.2)} ${P(18, 0)} ${P(20.3, 2.6)} Q${P(21.2, 3.64)} ${P(18.4, 4.9)}`          // brow, button nose
    + ` C${P(18.8, 6.1)} ${P(18.6, 7.2)} ${P(17.9, 7.9)} C${P(18.3, 9)} ${P(17.8, 10.2)} ${P(16.9, 10.6)}` // lips
    + ` C${P(16.6, 13.4)} ${P(14, 15.6)} ${P(10.5, 15.8)}`                                   // chin
    + ` C${P(5, 16.4)} ${P(0.5, 15)} ${P(-3.5, 12.6)} C${P(-8, 13.2)} ${P(-13.5, 11.5)} ${P(-16, 7)} Z`; // jaw, nape
  return `
    <g transform="translate(${P(-14, -2)})"><g class="flutter-hair" transform="rotate(-6)"><path d="M0 0 Q-8 -1 -11 5 Q-5 4 -2 8 Z" fill="${C.hair}"/></g></g>
    <path id="face" d="${face}" fill="${C.skin}"/>
    <path d="M${P(-17.5, -3)} Q${P(-18, 5)} ${P(-14.5, 9)} Q${P(-10, 4)} ${P(-8.5, -3)} Z" fill="${C.hair}"/>
    <g transform="translate(${P(-4.5, 4)})"><ellipse rx="3.4" ry="4.4" fill="${C.skinDark}"/><path d="M1.2 -2.2 Q-1.4 -1 -0.4 1.8" fill="none" stroke="${C.skin}" stroke-width="1" stroke-linecap="round"/></g>
    <path d="M${P(0.5, -6)} L${P(2.5, 7)} Q${P(3.7, 14.8)} ${P(11, 15.8)}" fill="none" stroke="${C.helmetDark}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M${P(8.5, -3.4)} Q${P(11, -5)} ${P(13.8, -3.6)}" fill="none" stroke="${C.hair}" stroke-width="1.4" stroke-linecap="round"/>
    <ellipse cx="${f(x + 11)}" cy="${f(y + 1.2)}" rx="2" ry="2.5" fill="${C.ink}"/>
    <circle cx="${f(x + 11.7)}" cy="${f(y + 0.3)}" r="0.75" fill="#ffffff"/>
    <circle cx="${f(x + 11)}" cy="${f(y + 8)}" r="3" fill="${C.cheek}" opacity="0.55"/>
    <path d="M${P(14.2, 9.4)} Q${P(15.8, 10.8)} ${P(17.5, 9.6)}" fill="none" stroke="${C.ink}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M${P(-19, -2)} C${P(-20, -26)} ${P(16, -30)} ${P(20, -8)} L${P(22.5, -5.5)} Q${P(4, -11)} ${P(-19, -2)} Z" fill="${C.helmet}"/>
    <path d="M${P(-6, -21)} Q${P(2, -23.5)} ${P(11, -18)}" fill="none" stroke="${C.helmetDark}" stroke-width="2.3" stroke-linecap="round"/>`;
}
const rel = (p) => [f(p[0] - HIP[0]), f(p[1] - HIP[1])];
const NECK_BASE = [SHOULDER[0] + 1, SHOULDER[1] - 2];
const NAPE = [HEAD[0] - 3, HEAD[1] + 11];        // behind the jaw, inside the head outline
const neckAngle = deg(Math.atan2(NAPE[1] - NECK_BASE[1], NAPE[0] - NECK_BASE[0]));
const neckLen = dist(NECK_BASE, NAPE) + 2;
const upperBody = `<g id="rider-upper" transform="translate(${HIP[0]} ${HIP[1]})"><g class="torso">
  <g transform="rotate(${f(torsoAngle)})">
    <path d="${capsule(12, 27, 25)}" fill="${C.shorts}"/>
    <!-- The shirt-tail flutter was removed in review round 4: a detached dark flap read as a strange object. -->
    <g transform="translate(12 0)"><path d="${capsule(torsoLen - 12, 26, 24)}" fill="${C.shirt}"/></g>
  </g>
  <!-- Neck from the collar into the nape, drawn under the head; long enough that
       the head's lagging nod never opens a gap (review round 1). -->
  <path d="${capsule(neckLen, 10, 9.5)}" transform="translate(${rel(NECK_BASE).join(' ')}) rotate(${f(neckAngle)})" fill="${C.skin}"/>
  <g transform="translate(${rel(NECK).join(' ')})"><g id="head" class="head-lag" transform="rotate(${f(headFrames[0])})">${headShape([f(HEAD[0] - NECK[0]), f(HEAD[1] - NECK[1])])}
  </g></g>
</g></g>`;
const armGroup = `<g id="near-arm"><g class="arm-upper" transform="translate(${f(armFrames[0].s[0])} ${f(armFrames[0].s[1])}) rotate(${f(armUpper[0])})">
  <g transform="translate(${UPPER} 0)"><g class="arm-fore" transform="rotate(${f(armLower[0])})"><path d="${capsule(FORE, 9, 8)}" fill="${C.skin}"/><circle cx="${FORE}" cy="0" r="5.2" fill="${C.skin}"/></g></g>
  <path d="${capsule(UPPER, 13, 11)}" fill="${C.shirt}"/>
</g></g>`;

// ---------------------------------------------------------------- motion CSS
const css = `
#bike-rider .spin, #bike-rider [class*=crank], #bike-rider [class*=thigh], #bike-rider [class*=shin], .scroll, #bike-rider,
.torso, .head-lag, .arm-upper, .arm-fore, .flutter-hair, .foot-near, .foot-far { transform-origin: 0 0; }
@media (prefers-reduced-motion: no-preference) {
  /* One clock: pedal turn ${T_CRANK} ms; wheels ${T_WHEEL} ms; road ${400} ms; trees ${T_TREES} ms; clouds ${T_CLOUDS} ms. */
  .spin { animation: spin ${T_WHEEL}ms linear infinite; }
  .crank-near { animation: crank-near ${T_CRANK}ms linear infinite; }
  .crank-near-pedal { animation: pedal-near ${T_CRANK}ms linear infinite; }
  .crank-far { animation: crank-far ${T_CRANK}ms linear infinite; }
  .crank-far-pedal { animation: pedal-far ${T_CRANK}ms linear infinite; }
  .near-thigh { animation: near-thigh ${T_CRANK}ms linear infinite; }
  .near-shin { animation: near-shin ${T_CRANK}ms linear infinite; }
  .far-thigh { animation: far-thigh ${T_CRANK}ms linear infinite; }
  .far-shin { animation: far-shin ${T_CRANK}ms linear infinite; }
  .foot-near { animation: foot-near ${T_CRANK}ms linear infinite; }
  .foot-far { animation: foot-far ${T_CRANK}ms linear infinite; }
  #road-dashes { animation: scroll-dash 400ms linear infinite; }
  #trees { animation: scroll-tile ${T_TREES}ms linear infinite; }
  #clouds { animation: scroll-tile ${T_CLOUDS}ms linear infinite; }
  #bike-rider { animation: bob ${T_WHEEL}ms cubic-bezier(0.45, 0, 0.55, 1) infinite; }
  /* Body on the pedal stroke (${T_WHEEL} ms): sampled, so linear between samples. */
  .torso { animation: torso ${T_WHEEL}ms linear infinite; }
  .head-lag { animation: head-lag ${T_WHEEL}ms linear infinite; }
  .arm-upper { animation: arm-upper ${T_WHEEL}ms linear infinite; }
  .arm-fore { animation: arm-fore ${T_WHEEL}ms linear infinite; }
  /* Secondary action: wind (400 ms); the easing sits on the animation, not in keyframes. */
  .flutter-hair { animation: flutter-hair 400ms cubic-bezier(0.45, 0, 0.55, 1) infinite; }
}
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes crank-near { from { transform: rotate(${A0}deg); } to { transform: rotate(${A0 + 360}deg); } }
@keyframes pedal-near { from { transform: rotate(${-A0}deg); } to { transform: rotate(${-A0 - 360}deg); } }
@keyframes crank-far { from { transform: rotate(${A0 + 180}deg); } to { transform: rotate(${A0 + 540}deg); } }
@keyframes pedal-far { from { transform: rotate(${-A0 - 180}deg); } to { transform: rotate(${-A0 - 540}deg); } }
${footKeyframes('foot-near', near.feet)}
${footKeyframes('foot-far', far.feet)}
${keyframes('near-thigh', near.thigh)}
${keyframes('near-shin', near.shin)}
${keyframes('far-thigh', far.thigh)}
${keyframes('far-shin', far.shin)}
@keyframes scroll-dash { from { transform: translateX(0); } to { transform: translateX(${f(-DASH_PERIOD)}px); } }
@keyframes scroll-tile { from { transform: translateX(0); } to { transform: translateX(-${W}px); } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-0.6px); } }
${bodyKeyframes}
@keyframes flutter-hair { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(8deg); } }
`;

// ---------------------------------------------------------------- document
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="bb-title bb-desc">
<title id="bb-title">A boy riding his bicycle</title>
<desc id="bb-desc">A boy in a blue shirt and an orange helmet pedals a red bicycle along a road past trees, under a sunny sky.</desc>
<style>${css}</style>
<defs><clipPath id="bb-frame"><rect width="${W}" height="${H}"/></clipPath></defs>
<g id="scene" clip-path="url(#bb-frame)">
<g id="sky"><rect width="${W}" height="${H}" fill="${C.sky}"/><circle cx="410" cy="52" r="22" fill="${C.sun}"/></g>
<g id="clouds" class="scroll" fill="${C.cloud}">${cloudTile}<g transform="translate(${W} 0)">${cloudTile}</g></g>
<g id="hills">
  <path d="M0 196 C70 160 140 170 210 188 S350 160 480 180 L480 ${ROAD} L0 ${ROAD} Z" fill="${C.hillFar}"/>
  <path d="M0 214 C90 190 170 204 250 212 S400 196 480 206 L480 ${ROAD} L0 ${ROAD} Z" fill="${C.hill}"/>
</g>
<g id="trees" class="scroll">${treeTile}<g transform="translate(${W} 0)">${treeTile}</g></g>
<g id="road">
  <rect y="${ROAD}" width="${W}" height="${H - ROAD}" fill="${C.road}"/>
  <rect y="${ROAD}" width="${W}" height="3" fill="${C.roadEdge}"/>
</g>
<g id="road-dashes" class="scroll" fill="${C.dash}" opacity="0.9">${dashes}</g>
<g id="shadows" fill="#000000" opacity="0.18">
  <ellipse cx="${REAR[0]}" cy="${REAR[1] + R + 1}" rx="34" ry="3"/><ellipse cx="${FRONT[0]}" cy="${FRONT[1] + R + 1}" rx="34" ry="3"/>
</g>
<g id="bike-rider">
  ${leg('far-leg', 'far', far, { skin: C.skinDark, shorts: C.shortsDark })}
  ${foot('far-foot', 'foot-far', far.feet, C.shoe)}
  ${crank('far-crank', 'crank-far', A0 + 180)}
  ${wheel('rear-wheel', REAR)}
  ${wheel('front-wheel', FRONT)}
  <g id="frame">
    <path d="M${BB[0]} ${BB[1] - 10} L${REAR[0]} ${REAR[1] - 5} M${BB[0]} ${BB[1] + 10} L${REAR[0]} ${REAR[1] + 5}" stroke="${C.metal}" stroke-width="1.6" fill="none"/>
    <circle cx="${BB[0]}" cy="${BB[1]}" r="10" fill="none" stroke="${C.metal}" stroke-width="3"/>
    ${tube(REAR, BB, 5, C.frameDark)}
    ${tube(REAR, SEAT_JOIN, 5, C.frameDark)}
    ${tube(BB, SEAT)}
    ${tube(SEAT_JOIN, HEAD_TOP)}
    ${tube(BB, HEAD_BOT)}
    ${tube(HEAD_TOP, HEAD_BOT, 8)}
    <path d="M${HEAD_BOT[0]} ${HEAD_BOT[1]} Q${FRONT[0] - 4} ${FRONT[1] - 22} ${FRONT[0]} ${FRONT[1]}" stroke="${C.frame}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M${HEAD_TOP[0]} ${HEAD_TOP[1]} L${HEAD_TOP[0] - 2} ${HEAD_TOP[1] - 10} M${HEAD_TOP[0] - 2} ${HEAD_TOP[1] - 10} Q${GRIP[0] + 4} ${GRIP[1] - 11} ${GRIP[0]} ${GRIP[1]}" stroke="${C.metal}" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M${SEAT[0]} ${SEAT[1]} L${SEAT[0] - 1} ${SEAT[1] - 6}" stroke="${C.metal}" stroke-width="4" stroke-linecap="round"/>
    <path d="M${SEAT[0] - 11} ${SEAT[1] - 11} Q${SEAT[0] - 1} ${SEAT[1] - 13} ${SEAT[0] + 12} ${SEAT[1] - 9} Q${SEAT[0] + 1} ${SEAT[1] - 4} ${SEAT[0] - 10} ${SEAT[1] - 5} Q${SEAT[0] - 15} ${SEAT[1] - 8} ${SEAT[0] - 11} ${SEAT[1] - 11} Z" fill="${C.tire}"/>
  </g>
  ${crank('near-crank', 'crank-near', A0)}
  ${leg('near-leg', 'near', near, { skin: C.skin, shorts: C.shorts })}
  ${foot('near-foot', 'foot-near', near.feet, C.shoe)}
  ${upperBody}
  ${armGroup}
</g>
</g>
</svg>
`;
writeFileSync(OUT, svg);

const reach = [...near.reach, ...far.reach];
function handDrift() {
  let worst = 0;
  for (let k = 0; k < BODY_STEPS; k++) {
    for (let s = 1; s < 10; s++) {
      const u = s / 10, A = armFrames[k], B = armFrames[k + 1];
      const sx = A.s[0] + (B.s[0] - A.s[0]) * u, sy = A.s[1] + (B.s[1] - A.s[1]) * u;
      const up = rad(armUpper[k] + (armUpper[k + 1] - armUpper[k]) * u);
      const lo = rad(armLower[k] + (armLower[k + 1] - armLower[k]) * u);
      const el = [sx + UPPER * Math.cos(up), sy + UPPER * Math.sin(up)];
      const hand = [el[0] + FORE * Math.cos(up + lo), el[1] + FORE * Math.sin(up + lo)];
      worst = Math.max(worst, dist(hand, GRIP));
    }
  }
  return f(worst);
}
// Between keyframes the browser interpolates the angles linearly; measure how far
// the foot then drifts from the true pedal position (sampled at 10 points per step).
function drift(poses, phase) {
  let worst = 0;
  for (let k = 0; k < STEPS; k++) {
    for (let s = 1; s < 10; s++) {
      const u = s / 10;
      const th = rad(poses.thigh[k] + (poses.thigh[k + 1] - poses.thigh[k]) * u);
      const sh = rad(poses.shin[k] + (poses.shin[k + 1] - poses.shin[k]) * u);
      const knee = [HIP[0] + THIGH * Math.cos(th), HIP[1] + THIGH * Math.sin(th)];
      const foot = [knee[0] + SHIN * Math.cos(th + sh), knee[1] + SHIN * Math.sin(th + sh)];
      const target = footAt(A0 + phase + (360 * (k + u)) / STEPS).ankle;
      worst = Math.max(worst, dist(foot, target));
    }
  }
  return f(worst);
}
console.log(JSON.stringify({
  out: OUT,
  bytes: Buffer.byteLength(svg),
  legReach: { min: f(Math.min(...reach)), max: f(Math.max(...reach)), limbTotal: THIGH + SHIN },
  footDriftPx: { near: drift(near, 0), far: drift(far, 180) },
  handDriftPx: handDrift(),
  armReach: { distance: f(dist(SHOULDER, GRIP)), limbTotal: UPPER + FORE },
  speeds: { roadPxPerS: f(SPEED), dashPeriodPx: f(DASH_PERIOD), treesPxPerS: f(W / (T_TREES / 1000)), cloudsPxPerS: f(W / (T_CLOUDS / 1000)) },
}, null, 2));
