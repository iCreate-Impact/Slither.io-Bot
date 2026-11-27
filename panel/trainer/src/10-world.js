  // ---- game-state readers ---------------------------------------------
  function liveSelf() {
    var me = window.slither;
    if (!me) return null;
    if (num(me.id, -1) <= 0) return null;
    if (!window.playing) return null;
    if (!isFinite(num(me.xx, NaN)) || !isFinite(num(me.yy, NaN))) return null;
    return me;
  }

  function displayScore(me) {
    try {
      var k = Math.max(0, Math.floor(num(me.sct, 0) + num(me.rsc, 0)));
      var fam = num(me.fam, 0);
      var a = window.fpsls ? num(window.fpsls[k], 0) : 0;
      var b = window.fmlts ? num(window.fmlts[k], 1) : 1;
      if (!a || !b) return null;
      return Math.floor((a + fam / b - 1) * 15 - 5);
    } catch (e) {
      return null;
    }
  }

  function arenaInfo() {
    var a = num(window.flux_grd, 0);
    var b = num(window.real_flux_grd, 0);
    var r = Infinity;
    if (a > 100) r = Math.min(r, a);
    if (b > 100) r = Math.min(r, b);
    if (!isFinite(r)) r = 4500;
    var c = num(window.grd, 16384);
    return { cx: c, cy: c, r: r };
  }

  function snakeRadius(s) {
    var sc = clamp(num(s.sc, 1), 0.5, 8);
    return TUNE.BODY_HALF * sc;
  }

  // Bounded max-heap of body candidates. The heap keeps the closest
  // THREAT_POINTS points per snake without sorting or retaining the rest.
  function bodyHeapPush(heap, item) {
    heap.push(item);
    var i = heap.length - 1;
    while (i > 0) {
      var parent = (i - 1) >> 1;
      if (heap[parent].d2 >= item.d2) break;
      heap[i] = heap[parent];
      i = parent;
    }
    heap[i] = item;
  }

  function bodyHeapReplace(heap, item) {
    heap[0] = item;
    var i = 0;
    for (;;) {
      var left = i * 2 + 1;
      var right = left + 1;
      var largest = i;
      if (left < heap.length && heap[left].d2 > heap[largest].d2) largest = left;
      if (right < heap.length && heap[right].d2 > heap[largest].d2) largest = right;
      if (largest === i) break;
      var tmp = heap[i];
      heap[i] = heap[largest];
      heap[largest] = tmp;
      i = largest;
    }
  }

  function collectThreats(me, now) {
    now = now || performance.now();
    var points = [];
    var heads = [];
    var snakes = [];
    var bodies = {};
    var bodyNear = {};
    var meId = String(me.id);
    var range = TUNE.THREAT_RANGE;
    var range2 = range * range;
    var bodyRange2 = (range * 1.05) * (range * 1.05);
    var list = Array.isArray(window.slithers) ? window.slithers : [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!s || s === me || String(s.id) === meId) continue;
      if (num(s.id, -1) <= 0) continue;
      var sx = num(s.xx, NaN);
      var sy = num(s.yy, NaN);
      if (!isFinite(sx) || !isFinite(sy)) continue;
      var d2 = dist2(sx, sy, me.xx, me.yy);
      var headNear = d2 <= range2;
      if (!headNear && !Array.isArray(s.pts)) continue;

      // A visible death is the only reliable kill confirmation. It also
      // creates a short-lived feast site, because a large snake drops a lot
      // of food around its head.
      if (s.dead) {
        var deadKey = String(s.id);
        if (!state.deadIds[deadKey]) {
          state.deadIds[deadKey] = 1;
          if (String(state.huntTargetId) === deadKey || d2 < 900 * 900) {
            state.kills++;
            state.corpse = {
              x: sx, y: sy, until: now + TUNE.CORPSE_MS, source: 'kill'
            };
          }
        }
        continue;
      }

      var r = snakeRadius(s);
      var ang = num(s.ang, 0);
      var speed = Math.max(0, num(s.sp, 0)) * TUNE.SPEED_MULT;
      var boost = !!(s.wmd || s.md) || speed > 300;
      var headR = r + TUNE.HEAD_MARGIN + Math.min(20, speed * 0.045);
      if (headNear) {
        var head = {
          x: sx, y: sy, r: headR, head: true, id: s.id,
          d: Math.sqrt(d2), ang: ang, speed: speed, boost: boost,
          sct: Math.max(0, num(s.sct, 0)), sc: clamp(num(s.sc, 1), 0.5, 8),
          s: s
        };
        heads.push(head);
        // The head is also a static obstacle at its current position. The
        // moving prediction below covers the near future; keeping the current
        // capsule closes the gap at t=0.
        points.push({ x: sx, y: sy, r: headR, head: true, id: s.id, hunt: false });
        snakes.push({
          id: String(s.id), head: head, d: head.d, sct: head.sct,
          sc: head.sc, speed: speed, boost: boost, x: sx, y: sy,
          ang: ang, r: headR, s: s
        });
      }

      // Keep the closest local body points. A long snake can cross the
      // player while its head is outside the threat radius, so body
      // collection is independent of head distance. The bounded max-heap
      // guarantees that the nearest points survive the per-snake budget even
      // when a long trail coils through the area hundreds of points deep.
      var pts = Array.isArray(s.pts) ? s.pts : [];
      var heap = [];
      var nearD2 = Infinity;
      for (var j = pts.length - 1; j >= 0; j--) {
        var p = pts[j];
        if (!p || p.dying) continue;
        var px = num(p.xx, NaN);
        var py = num(p.yy, NaN);
        if (!isFinite(px) || !isFinite(py)) continue;
        var pd2 = dist2(px, py, me.xx, me.yy);
        if (pd2 > bodyRange2) continue;
        if (pd2 < nearD2) nearD2 = pd2;
        if (heap.length < TUNE.THREAT_POINTS) {
          bodyHeapPush(heap, { x: px, y: py, d2: pd2 });
        } else if (pd2 < heap[0].d2) {
          bodyHeapReplace(heap, { x: px, y: py, d2: pd2 });
        }
      }
      if (heap.length) {
        heap.sort(function (a, b) { return a.d2 - b.d2; });
        var body = [];
        for (var k = 0; k < heap.length; k++) {
          body.push({
            x: heap[k].x, y: heap[k].y, r: r + 3,
            head: false, id: s.id, hunt: false
          });
        }
        var key = String(s.id);
        bodies[key] = body;
        bodyNear[key] = nearD2;
      }
    }
    return {
      points: points,
      headPoints: points,
      heads: heads,
      snakes: snakes,
      bodies: bodies,
      bodyNear: bodyNear
    };
  }

  // Build the body obstacle list for one planner tick. The selected target
  // gets its body points first, then the remaining bodies are added nearest
  // first. This prevents a crowded scene from silently dropping the body of
  // the snake the planner is actually hunting.
  function buildBodyPoints(threats, targetId) {
    var out = [];
    var ids = [];
    var seen = {};
    var id;
    if (targetId !== null && targetId !== undefined && threats.bodies[targetId]) {
      ids.push(targetId);
      seen[targetId] = true;
    }
    var rest = [];
    for (id in threats.bodies) {
      if (!Object.prototype.hasOwnProperty.call(threats.bodies, id)) continue;
      if (seen[id]) continue;
      rest.push(id);
    }
    rest.sort(function (a, b) {
      var da = threats.bodyNear[a];
      var db = threats.bodyNear[b];
      if (da === undefined) da = Infinity;
      if (db === undefined) db = Infinity;
      return da - db;
    });
    ids = ids.concat(rest);
    for (var i = 0; i < ids.length && out.length < TUNE.THREAT_TOTAL; i++) {
      var body = threats.bodies[ids[i]];
      for (var j = 0; j < body.length && out.length < TUNE.THREAT_TOTAL; j++) {
        out.push(body[j]);
      }
    }
    return out;
  }

  function collectSelfBody(me) {
    var pts = Array.isArray(me.pts) ? me.pts : [];
    var r = snakeRadius(me);
    var out = [];
    if (!pts.length) return out;
    var skip2 = TUNE.SELF_SKIP * TUNE.SELF_SKIP;
    var range2 = 1400 * 1400;
    // Walk from the head end so a coiled snake is covered close to the
    // head first. Every local point is kept (no stride holes).
    for (var i = pts.length - 1; i >= 0 && out.length < TUNE.SELF_POINTS; i--) {
      var p = pts[i];
      if (!p || p.dying) continue;
      var px = num(p.xx, NaN);
      var py = num(p.yy, NaN);
      if (!isFinite(px) || !isFinite(py)) continue;
      var d2 = dist2(px, py, me.xx, me.yy);
      if (d2 < skip2 || d2 > range2) continue;
      out.push({ x: px, y: py, r: r + 2, head: false, self: true });
    }
    return out;
  }

  function collectFoods(me, range, limit) {
    range = clamp(num(range, TUNE.FOOD_RANGE), 200, TUNE.THREAT_RANGE * 1.1);
    limit = Math.max(8, Math.floor(num(limit, TUNE.FOOD_POINTS)));
    var list = Array.isArray(window.foods) ? window.foods : [];
    var range2 = range * range;
    var out = [];
    var corpse = state.corpse && performance.now() < state.corpse.until ? state.corpse : null;
    var corpse2 = TUNE.CORPSE_RADIUS * TUNE.CORPSE_RADIUS;
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (!f) continue;
      var fx = num(f.xx, NaN);
      var fy = num(f.yy, NaN);
      if (!isFinite(fx) || !isFinite(fy)) continue;
      var d2 = dist2(fx, fy, me.xx, me.yy);
      if (d2 > range2) continue;
      var sz = Math.max(1, num(f.sz, 1));
      // A normal pellet is a small snack; a big corpse pellet is worth a
      // detour. This is deliberately super-linear in size.
      var w = 0.6 + Math.min(14, sz * 0.9);
      var isCorpse = !!(corpse && dist2(fx, fy, corpse.x, corpse.y) < corpse2);
      if (isCorpse) w *= TUNE.CORPSE_WEIGHT;
      out.push({ x: fx, y: fy, sz: sz, w: w, d2: d2, corpse: isCorpse });
    }
    // A lone pellet is a snack; a tight stream of pellets is a feeding lane.
    // Do the density pass before ranking so clusters rise above isolated
    // bait, then rank by distance discounted by the adjusted value.
    enrichFoodDensity(out);
    out.sort(function (a, b) {
      return (a.d2 / (1 + a.w * 0.35)) - (b.d2 / (1 + b.w * 0.35));
    });
    return out.slice(0, limit);
  }

  function detectCorpse(foods, now) {
    if (state.corpse && now < state.corpse.until) return;
    var big = [];
    for (var i = 0; i < foods.length; i++) {
      var f = foods[i];
      if (f.sz >= 6 && f.d2 < 1300 * 1300) big.push(f);
    }
    if (big.length < 5) return;
    var best = null;
    for (var c = 0; c < big.length; c++) {
      var count = 0;
      var total = 0;
      for (var k = 0; k < big.length; k++) {
        if (dist2(big[c].x, big[c].y, big[k].x, big[k].y) < TUNE.CORPSE_RADIUS * TUNE.CORPSE_RADIUS) {
          count++;
          total += big[k].sz;
        }
      }
      if (count >= 5 && total >= 55 && (!best || total > best.total)) {
        best = { x: big[c].x, y: big[c].y, total: total, count: count };
      }
    }
    if (best) {
      state.corpse = {
        x: best.x, y: best.y, until: now + TUNE.CORPSE_MS, source: 'cluster'
      };
      state.lastKillAt = now;
    }
  }

