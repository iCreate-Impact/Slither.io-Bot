"""Closed-loop trainer scenarios in the user's installed browser.

Run from this directory or from the repository root:

    python panel/trainer/tests/test_modes.py
    python panel/trainer/tests/test_modes.py --headed --seconds 5
    python panel/trainer/tests/test_modes.py --modes body_far_head,body_target_last
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

from playwright_browser import add_browser_args, launch_browser

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TRAINER = ROOT / "panel" / "trainer" / "trainer.js"
SIM = HERE / "sim_modes.html"

DEFAULT_MODES = [
    "walls",
    "wall",
    "headon",
    "headon_boost",
    "headon_fast",
    "cross",
    "behind",
    "behind_boost",
    "behind_boost_short",
    "tail_boost",
    "tail_chase",
    "hunt",
    "hunt_cut",
    "hunt_far",
    "hunt_kill",
    "hunt_flee",
    "hunt_early",
    "hunt_peer",
    "hunt_evasive",
    "hunt_evasive_peer",
    "hunt_bigger",
    "hunt_crowd",
    "body_far_head",
    "body_far_moving",
    "body_target_last",
    "body_many",
    "feast",
    "radar",
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--modes",
        default=",".join(DEFAULT_MODES),
        help="comma-separated scenario names",
    )
    parser.add_argument(
        "--seconds",
        type=float,
        default=8.0,
        help="closed-loop time per scenario (default: 8)",
    )
    add_browser_args(parser)
    args = parser.parse_args()

    modes = [m.strip() for m in args.modes.split(",") if m.strip()]
    results = []

    with sync_playwright() as playwright:
        browser = launch_browser(playwright, headless=not args.headed)
        for mode in modes:
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            try:
                page.goto(SIM.as_uri() + "?mode=" + mode)
                page.add_script_tag(path=str(TRAINER))
                page.wait_for_timeout(300)
                page.evaluate(
                    "() => document.getElementById('slither-trainer-host')"
                    ".shadowRoot.getElementById('takeBtn').click()"
                )
                # Early/peer chases need enough time to close a 300+ unit gap
                # without a cut boost; the early target is short and the
                # first cut can overshoot, so give it a little more margin.
                if mode == "hunt_early":
                    seconds = max(args.seconds, 16.0)
                elif mode in ("hunt_peer", "hunt_evasive", "hunt_evasive_peer"):
                    seconds = max(args.seconds, 12.0)
                elif mode in ("tail_boost", "tail_chase"):
                    seconds = max(args.seconds, 10.0)
                else:
                    seconds = args.seconds
                early = None
                if mode == "body_target_last":
                    # The trainer is now aggressive enough to kill this
                    # stationary target. Capture the body-priority snapshot
                    # while the target is still alive, then finish the run to
                    # check that the kill was clean.
                    page.wait_for_timeout(1500)
                    early = page.evaluate(
                        """() => ({
                          target: window.__slitherTrainer.state.huntTarget
                            ? String(window.__slitherTrainer.state.huntTarget.id)
                            : null,
                          bodyIds: (window.__slitherTrainer.state.snapshot
                            ? window.__slitherTrainer.state.snapshot.threats
                            : []).map((point) => String(point.id))
                        })"""
                    )
                    page.wait_for_timeout(max(0, int(seconds * 1000) - 1500))
                else:
                    page.wait_for_timeout(int(seconds * 1000))
                info = page.evaluate(
                    """() => ({
                      sim: window.__sim,
                      state: {
                        takeover: window.__slitherTrainer.state.takeover,
                        mode: window.__slitherTrainer.state.mode,
                        clearance: window.__slitherTrainer.state.clearance,
                        threats: window.__slitherTrainer.state.threats,
                        fps: window.__slitherTrainer.state.fps,
                        target: window.__slitherTrainer.state.huntTarget
                          ? String(window.__slitherTrainer.state.huntTarget.id)
                          : null,
                        bodyIds: (window.__slitherTrainer.state.snapshot
                          ? window.__slitherTrainer.state.snapshot.threats
                          : []).map((point) => String(point.id))
                      },
                      self: {
                        x: window.slither.xx,
                        y: window.slither.yy,
                        ang: window.slither.ang,
                        sct: window.slither.sct
                      },
                      playing: window.playing
                    })"""
                )
                ok = (
                    not errors
                    and info["state"]["takeover"]
                    and info["sim"]["collisions"] == 0
                    and info["sim"]["minEnemy"] > 34
                    and info["sim"]["minWall"] > 0
                )
                if mode == "body_target_last":
                    final_target_ok = (
                        info["state"]["target"] is not None
                        and info["state"]["target"] in info["state"]["bodyIds"]
                    )
                    early_target_ok = (
                        early is not None
                        and early["target"] is not None
                        and early["target"] in early["bodyIds"]
                    )
                    ok = ok and (final_target_ok or early_target_ok)
                if mode in (
                    "hunt_early", "hunt_peer", "tail_boost", "tail_chase"
                ):
                    ok = ok and info["sim"].get("kills", 0) >= 1
                # hunt_evasive / hunt_evasive_peer are pressure scenarios:
                # the prey flees perfectly and matches our speed, so the
                # trainer must survive and keep pursuing without ramming the
                # body. A kill is not required because that kiter can always
                # turn away in open space.
                results.append((mode, ok, info, errors))
                print(
                    ("PASS" if ok else "FAIL"),
                    mode,
                    json.dumps(info["sim"]),
                    "errors:",
                    errors,
                )
            finally:
                page.close()
        browser.close()

    failed = [result for result in results if not result[1]]
    print(f"{len(results) - len(failed)}/{len(results)} modes passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
