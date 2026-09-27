"""Tests for scripts/path_audit.py: each finding kind fires on its defect and
stays quiet on clean geometry. Run: python -m unittest discover tools/tests"""
import argparse
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'plugins/draw-better-svg/skills/draw-better-svg/scripts/path_audit.py'
sys.path.insert(0, str(SCRIPT.parent))
import path_audit  # noqa: E402

DEFAULTS = argparse.Namespace(smooth=3.0, corner=20.0, tiny=0.002, short=0.02, facet_length=0.06, stair=6, facet=5,
                              handle=1.5, limit=8, budget=None)


def run(body, view_box='0 0 200 200'):
    with tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False, encoding='utf-8') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}">{body}</svg>')
    report, _ = path_audit.audit(Path(f.name), DEFAULTS)
    Path(f.name).unlink()
    return report


class Clean(unittest.TestCase):
    def test_circle_from_arcs(self):
        r = run('<path d="M50 100 A50 50 0 1 1 150 100 A50 50 0 1 1 50 100 Z"/>')
        self.assertEqual(r['errors'], [])
        self.assertEqual(sum(r['summary'].values()), 0, r['warnings'])

    def test_square_corners_are_not_kinks(self):
        r = run('<path d="M20 20 H180 V180 H20 Z"/>')
        self.assertEqual(sum(r['summary'].values()), 0)
        self.assertEqual(r['paths'][0]['corners'], 4)

    def test_smooth_s_curve(self):
        r = run('<path d="M20 100 C60 20 100 20 100 100 S140 180 180 100"/>')
        self.assertEqual(sum(r['summary'].values()), 0, r['warnings'])

    def test_packed_arc_flags_and_relative_commands(self):
        r = run('<path d="m40 100a60 60 0 00120 0l0 10h-120z"/>')
        self.assertEqual(r['errors'], [])
        self.assertEqual(r['paths'][0]['subpaths'], 1)


class Defects(unittest.TestCase):
    def test_near_kink(self):
        # The second curve starts 8 degrees off the first one's end tangent.
        r = run('<path d="M20 100 C60 60 90 60 100 60 C110 61.4 150 70 180 100"/>')
        self.assertEqual(r['summary']['near-kink'], 1, r['warnings'])
        self.assertAlmostEqual(r['findings']['near-kink'][0]['angle'], 8.0, delta=0.5)

    def test_staircase(self):
        steps = ''.join(f' h2 v2' for _ in range(8))
        r = run(f'<path d="M20 20{steps}"/>')
        self.assertEqual(r['summary']['staircase'], 1)

    def test_faceted_polyline(self):
        import math
        pts = ' '.join(f'{100 + 60 * math.cos(math.radians(a)):.2f},{100 + 60 * math.sin(math.radians(a)):.2f}' for a in range(0, 90, 10))
        r = run(f'<polyline points="{pts}" fill="none"/>')
        self.assertEqual(r['summary']['faceted'], 1, r['warnings'])

    def test_tiny_segment(self):
        r = run('<path d="M20 20 L100 20 L100.1 20 L180 100"/>')
        self.assertEqual(r['summary']['tiny'], 1)

    def test_long_handle(self):
        r = run('<path d="M90 100 C200 0 -20 0 110 100"/>')
        self.assertEqual(r['summary']['long-handle'], 1)

    def test_malformed_is_an_error(self):
        r = run('<path d="M10 10 C20 20 30"/>')
        self.assertTrue(r['errors'])
        self.assertIn('malformed', r['errors'][0])


class Cli(unittest.TestCase):
    def test_overlay_and_exit_codes(self):
        with tempfile.TemporaryDirectory() as tmp:
            art = Path(tmp) / 'a.svg'
            art.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M20 20' + ' h2 v2' * 8 + '"/></svg>')
            out = Path(tmp) / 'o.svg'
            ok = subprocess.run([sys.executable, str(SCRIPT), str(art), '--json', '--svg-out', str(out)], capture_output=True, text=True)
            self.assertEqual(ok.returncode, 0)
            self.assertEqual(json.loads(ok.stdout)['summary']['staircase'], 1)
            self.assertIn('<svg', out.read_text())
            strict = subprocess.run([sys.executable, str(SCRIPT), str(art), '--strict'], capture_output=True, text=True)
            self.assertEqual(strict.returncode, 1)


if __name__ == '__main__':
    unittest.main()
