#!/usr/bin/env python3
# Sample the live food field: count, size distribution, and large-pellet spikes
# (dead-snake drops).  Uses the current bot only to stay alive and move.
import argparse
import json
import time
from playwright.sync_api import sync_playwright

from slither_bot import BOT_JS, chromium_path


def main():
    ap = argparse.ArgumentParser(description="slither.io food-field probe")
    ap.add_argument("--out", default="food_probe.json")
    args = ap.parse_args()
    exe = chromium_path()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=exe,
                                   args=["--no-sandbox", "--disable-gpu",
                                         "--disable-dev-shm-usage", "--mute-audio"])
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto("https://slither.io/", wait_until="domcontentloaded", timeout=60000)
            end = time.time() + 40
            while time.time() < end:
                if page.evaluate("() => !!window.play_btn && !!document.getElementById('nick')"):
                    break
                page.wait_for_timeout(250)
            page.evaluate("window.__slitherVerbose=false; window.__slitherNick='FoodProbe'")
            page.evaluate(BOT_JS)
            end = time.time() + 25
            while time.time() < end:
                if page.evaluate("() => !!window.playing && !!window.slither && window.slither.id > 0"):
                    break
                page.wait_for_timeout(250)
            out = page.evaluate(r"""
              async () => {
                const rows = [];
                for (let i = 0; i < 300; i++) {
                  if (!window.playing || !window.slither) break;
                  const s = window.slither;
                  const fs = (window.foods || []).filter(f => f && isFinite(+f.xx));
                  const sz = fs.map(f => +f.sz || 0).sort((a,b)=>a-b);
                  const vals = fs.map(f => ({x:+f.xx, y:+f.yy, sz:+f.sz||0,
                    d: Math.hypot(+f.xx-s.xx, +f.yy-s.yy)}));
                  vals.sort((a,b)=>b.sz-a.sz);
                  rows.push({
                    t: Math.round(performance.now()),
                    n: fs.length,
                    sct: s.sct,
                    score: 0,
                    max: sz.length ? sz[sz.length-1] : 0,
                    p99: sz.length ? sz[Math.floor(sz.length*0.99)] : 0,
                    p90: sz.length ? sz[Math.floor(sz.length*0.90)] : 0,
                    med: sz.length ? sz[Math.floor(sz.length*0.50)] : 0,
                    sum: sz.reduce((a,b)=>a+b,0),
                    top: vals.slice(0,5).map(v => ({sz:+v.sz.toFixed(1), d:Math.round(v.d)}))
                  });
                  await new Promise(r => setTimeout(r, 100));
                }
                return rows;
              }
            """)
            print(json.dumps(out))
            with open(args.out, "w") as f:
                json.dump(out, f)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
