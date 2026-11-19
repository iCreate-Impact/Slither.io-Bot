#!/usr/bin/env python3
# Live mechanics probe for slither.io.
#
# Starts a run with the current safe bot, then samples:
#   - self server position (xx, yy) vs interpolated render position (xx+fx, yy+fy)
#   - enemy body point motion (tagged point objects) to verify static trail
#   - server update cadence and angle tracking
#   - leaderboard rows / rank / own score
#   - arena, food, snake counts
#
# Run: .venv/bin/python recon_mechanics.py --headless --seconds 45

import argparse
import json
import os
import time

from playwright.sync_api import sync_playwright

from slither_bot import BOT_JS, chromium_path

URL = "https://slither.io/"

SAMPLER_JS = r"""
() => {
  if (window.__mech) return 'already';
  const rec = window.__mech = {
    started: performance.now(), frames: [], snaps: [], tagged: [], tagSeq: 0,
    selfSeries: []
  };

  function arena() {
    const a = +window.flux_grd, b = +window.real_flux_grd;
    let r = Math.min(isFinite(a) && a > 100 ? a : Infinity,
                     isFinite(b) && b > 100 ? b : Infinity);
    if (!isFinite(r)) r = 4500;
    return { cx: +window.grd || 16384, r: r };
  }

  function lbRows() {
    const rows = { scores: [], names: [], ranks: [] };
    try {
      if (window.lbs) rows.scores = [...window.lbs.children]
        .filter(e => e.tagName === 'SPAN').map(e => (e.innerText || '').trim());
      if (window.lbn) rows.names = [...window.lbn.children]
        .filter(e => e.tagName === 'SPAN').map(e => (e.innerText || '').trim());
      if (window.lbp) rows.ranks = [...window.lbp.children]
        .filter(e => e.tagName === 'SPAN').map(e => (e.innerText || '').trim());
    } catch (e) {}
    return rows;
  }

  function scoreOf(s) {
    try {
      const k = (+s.sct || 0) + (+s.rsc || 0);
      const f = +s.fam || 0;
      if (!window.fpsls || !window.fmlts) return null;
      return Math.floor(((+window.fpsls[k] || 0) + f / (+window.fmlts[k] || 1) - 1) * 15 - 5);
    } catch (e) { return null; }
  }

  function slimPt(p) {
    return {
      xx: +(p.xx || 0), yy: +(p.yy || 0),
      fx: +(p.fx || 0), fy: +(p.fy || 0),
      da: +(p.da || 0), dying: !!p.dying,
      tag: p.__mtag || 0
    };
  }

  function tagNerby(me) {
    const all = window.slithers || [];
    const near = [];
    for (const o of all) {
      if (!o || String(o.id) === String(me.id) || o.dead || o.dying) continue;
      const d = Math.hypot(o.xx - me.xx, o.yy - me.yy);
      if (d < 1400) near.push({ o: o, d: d });
    }
    near.sort((a, b) => a.d - b.d);
    for (let ni = 0; ni < Math.min(2, near.length); ni++) {
      const o = near[ni].o;
      const ps = o.pts || [];
      for (const idx of [0, 5, 10, 15, 20, 25, ps.length - 1, ps.length - 4]) {
        if (idx < 0 || idx >= ps.length) continue;
        const p = ps[idx];
        if (!p || p.dying || p.__mtag) continue;
        p.__mtag = ++rec.tagSeq;
        rec.tagged.push({ tag: p.__mtag, owner: o.id, p: p, idx0: idx });
      }
    }
    if (rec.tagged.length > 60) rec.tagged.splice(0, rec.tagged.length - 60);
  }

  let last = 0;
  function frame(ts) {
    if (window.__mechStop) return;
    requestAnimationFrame(frame);
    const s = window.slither;
    if (!s || !window.playing) return;
    tagNerby(s);

    rec.selfSeries.push({
      t: +(ts - rec.started).toFixed(1),
      xx: +s.xx.toFixed(2), yy: +s.yy.toFixed(2),
      fx: +(s.fx || 0).toFixed(2), fy: +(s.fy || 0).toFixed(2),
      ang: +s.ang.toFixed(4), eang: +s.eang.toFixed(4), wang: +s.wang.toFixed(4),
      sp: +s.sp.toFixed(2), sct: s.sct, sc: +s.sc.toFixed(3),
      scang: +s.scang.toFixed(4), spang: +s.spang.toFixed(4),
      xm: +window.xm.toFixed(0), ym: +window.ym.toFixed(0)
    });
    if (rec.selfSeries.length > 6000) rec.selfSeries.splice(0, 2000);

    for (const tg of rec.tagged) {
      if (!tg.series) tg.series = [];
      const p = tg.p;
      let oo = null;
      try { oo = window.os && window.os['s' + tg.owner]; } catch (e) {}
      let idx = -1, npts = -1, hxx = null, hyy = null;
      if (oo) {
        idx = (oo.pts || []).indexOf(p);
        npts = (oo.pts || []).length;
        hxx = oo.xx; hyy = oo.yy;
      }
      tg.series.push({
        t: +(ts - rec.started).toFixed(1),
        xx: +p.xx.toFixed(2), yy: +p.yy.toFixed(2),
        fx: +(p.fx || 0).toFixed(2), fy: +(p.fy || 0).toFixed(2),
        dying: !!p.dying, idx: idx, npts: npts,
        hxx: hxx, hyy: hyy,
        active: idx >= 0
      });
      if (tg.series.length > 900) tg.series.splice(0, 300);
    }

    if (ts - last < 100) return;
    last = ts;

    const A = arena();
    const near = [];
    for (const o of (window.slithers || [])) {
      if (!o || String(o.id) === String(s.id) || o.dead || o.dying) continue;
      const d = Math.hypot(o.xx - s.xx, o.yy - s.yy);
      if (d < 2200) near.push({ o: o, d: d });
    }
    near.sort((a, b) => a.d - b.d);
    const rows = lbRows();
    rec.snaps.push({
      t: +(ts - rec.started).toFixed(0),
      self: {
        id: s.id, xx: +s.xx.toFixed(1), yy: +s.yy.toFixed(1),
        fx: +(s.fx || 0).toFixed(1), fy: +(s.fy || 0).toFixed(1),
        ang: +s.ang.toFixed(3), eang: +s.eang.toFixed(3), wang: +s.wang.toFixed(3),
        sp: +s.sp.toFixed(2), sct: s.sct, sc: +s.sc.toFixed(3),
        fam: +(s.fam || 0).toFixed(4), rsc: +s.rsc || 0, kills: +s.kill_count || 0,
        score: scoreOf(s), dist: +Math.hypot(s.xx - A.cx, s.yy - A.cy).toFixed(0)
      },
      arena: { r: +A.r.toFixed(0), cx: A.cx },
      rank: window.rank, bestRank: window.best_rank,
      slitherCount: window.slither_count,
      mscps: window.mscps,
      leader: rows,
      foods: (window.foods || []).length,
      preys: (window.preys || []).length,
      near: near.slice(0, 6).map(({ o, d }) => ({
        id: o.id, d: +d.toFixed(0), sct: o.sct, sc: +o.sc.toFixed(2),
        sp: +o.sp.toFixed(2), ang: +o.ang.toFixed(3),
        wang: +o.wang.toFixed(3), kills: +o.kill_count || 0,
        xx: +o.xx.toFixed(1), yy: +o.yy.toFixed(1),
        fx: +(o.fx || 0).toFixed(1), fy: +(o.fy || 0).toFixed(1),
        npts: (o.pts || []).length,
        pts: (o.pts || []).slice(-8).map(slimPt)
      })),
      tagged: rec.tagged.map(tg => {
        const p = tg.p;
        return { tag: tg.tag, owner: tg.owner, idx0: tg.idx0,
                 xx: +p.xx.toFixed(2), yy: +p.yy.toFixed(2),
                 fx: +(p.fx || 0).toFixed(2), fy: +(p.fy || 0).toFixed(2),
                 dying: !!p.dying };
      })
    });
    if (rec.snaps.length > 3000) rec.snaps.splice(0, 1000);
  }
  requestAnimationFrame(frame);
  return 'sampling';
}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=URL)
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--browser")
    ap.add_argument("--seconds", type=float, default=45)
    ap.add_argument("--out", default="slither_mechanics.json")
    args = ap.parse_args()

    exe = args.browser or chromium_path()
    with sync_playwright() as p:
        kw = {"headless": args.headless}
        if exe:
            kw["executable_path"] = exe
        if args.headless:
            kw["args"] = ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--mute-audio"]
        browser = p.chromium.launch(**kw)
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(args.url, wait_until="domcontentloaded", timeout=60000)
            end = time.time() + 40
            while time.time() < end:
                if page.evaluate("() => !!window.play_btn && !!document.getElementById('nick')"):
                    break
                page.wait_for_timeout(250)
            print("[*] starting")
            page.evaluate("window.__slitherVerbose = false")
            page.evaluate("window.__slitherNick = 'MechProbe'")
            page.evaluate(BOT_JS)
            page.wait_for_timeout(2000)
            # Make sure we are actually in a run before sampling.
            end = time.time() + 20
            while time.time() < end:
                if page.evaluate("() => !!window.playing && !!window.slither && window.slither.id > 0"):
                    break
                page.wait_for_timeout(250)
            print("[*] sampler:", page.evaluate(SAMPLER_JS))
            page.wait_for_timeout(args.seconds * 1000)
            data = page.evaluate("() => { window.__mechStop = true; return window.__mech; }")
            with open(args.out, "w") as f:
                json.dump(data, f)
            print(f"[*] wrote {args.out}: snaps={len(data.get('snaps', []))} "
                  f"frames={len(data.get('selfSeries', []))} tagged={len(data.get('tagged', []))}")
            # Compact summary.
            snaps = data.get("snaps", [])
            if snaps:
                first, last = snaps[0], snaps[-1]
                print("[*] self t0:", json.dumps(first.get("self")))
                print("[*] self tN:", json.dumps(last.get("self")))
                print("[*] rank t0/tN:", first.get("rank"), last.get("rank"),
                      "best:", last.get("bestRank"), "snakes:", last.get("slitherCount"))
                print("[*] leader tN:", json.dumps(last.get("leader"))[:1200])
        finally:
            browser.close()


if __name__ == "__main__":
    main()
