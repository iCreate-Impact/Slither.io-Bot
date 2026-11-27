#!/usr/bin/env python3
"""Build the single-file trainer bundle from the source modules.

The browser trainer is deliberately distributed as one script so the
Tampermonkey @require URL, the bookmarklet and the Playwright tests all load
exactly the same runtime.  The source is split into small modules for
maintenance; this script concatenates them in dependency order.

Usage:
    python panel/trainer/build.py
    python panel/trainer/build.py --check
"""

from __future__ import annotations

import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
BUNDLE = HERE / "trainer.js"

MODULES = [
    "00-foundation.js",
    "10-world.js",
    "15-map.js",
    "20-hunt.js",
    "25-feed.js",
    "30-planner.js",
    "40-control.js",
    "50-panel.js",
    "60-input.js",
    "70-main.js",
]


def build() -> str:
    missing = [name for name in MODULES if not (SRC / name).is_file()]
    if missing:
        raise SystemExit("missing source modules: " + ", ".join(missing))
    return "".join((SRC / name).read_text(encoding="utf-8") for name in MODULES)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if the checked-in bundle differs from the modules",
    )
    args = parser.parse_args()
    text = build()
    if args.check:
        current = BUNDLE.read_text(encoding="utf-8")
        if current != text:
            print("trainer.js is stale; run: python panel/trainer/build.py")
            return 1
        print("trainer.js is current")
        return 0
    BUNDLE.write_text(text, encoding="utf-8")
    print(f"wrote {BUNDLE} ({len(text)} chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
