/* Slither.io client-state probe
 * ------------------------------------------------------------------
 * Read-only diagnostic for an already-running slither.io tab.
 *
 * Paste this file into the DevTools console after you have started a run.
 * It never writes window.xm / window.ym / window.wmd, never sends a packet,
 * never touches game memory, and never starts or reconnects a session.
 *
 * What it is for:
 *   - seeing which fields the client actually exposes;
 *   - measuring how many snakes/food points the client has received;
 *   - dumping the trainer's map coverage and hunt target;
 *   - collecting a reproducible snapshot before changing planner code.
 *
 * The game is server-authoritative. Editing local copies of length, speed,
 * collision state or another snake's fields does not change the server's
 * state and is not part of this probe.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  if (window.__slitherProbe && window.__slitherProbe.version) {
    console.info('[probe] already installed');
    return;
  }

  var VERSION = '1';
  var MAX_SNAKES = 48;
  var MAX_FOOD = 240;

  function number(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function finite(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function arena() {
    var a = number(window.flux_grd, 0);
    var b = number(window.real_flux_grd, 0);
    var radius = Infinity;
    if (a > 100) radius = Math.min(radius, a);
    if (b > 100) radius = Math.min(radius, b);
    if (!isFinite(radius)) radius = 4500;
    var center = number(window.grd, 16384);
    return { center: center, radius: radius };
  }

  function snakeSummary(snake, index, center) {
    if (!snake) return null;
    var x = number(snake.xx, NaN);
    var y = number(snake.yy, NaN);
    var dx = finite(x) ? x - center : NaN;
    var dy = finite(y) ? y - center : NaN;
    return {
      index: index,
      id: snake.id === undefined ? null : snake.id,
      x: finite(x) ? x : null,
      y: finite(y) ? y : null,
      distanceFromCenter: finite(dx) && finite(dy) ?
        Math.round(Math.sqrt(dx * dx + dy * dy)) : null,
      angle: number(snake.ang, null),
      speed: number(snake.sp, null),
      length: number(snake.sct, null),
      scale: number(snake.sc, null),
      turning: number(snake.scang, null),
      boost: !!(snake.wmd || snake.md) || number(snake.sp, 0) * 31.25 > 300,
      dead: !!snake.dead,
      bodyPoints: Array.isArray(snake.pts) ? snake.pts.length : 0,
      self: snake === window.slither
    };
  }

  function trace() {
    var limit = MAX_SNAKES;
    var snakes = Array.isArray(window.slithers) ? window.slithers : [];
    var foods = Array.isArray(window.foods) ? window.foods : [];
    var a = arena();
    var foodSummary = [];
    var foodTotal = 0;
    var bigFood = 0;
    for (var i = 0; i < foods.length; i++) {
      var food = foods[i];
      if (!food) continue;
      var x = number(food.xx, NaN);
      var y = number(food.yy, NaN);
      if (!isFinite(x) || !isFinite(y)) continue;
      foodTotal++;
      var size = number(food.sz, 1);
      if (size >= 6) bigFood++;
      if (foodSummary.length < MAX_FOOD) {
        foodSummary.push({
          x: x, y: y, size: size,
          distanceFromCenter: Math.round(Math.sqrt(
            (x - a.center) * (x - a.center) +
            (y - a.center) * (y - a.center)
          ))
        });
      }
    }
    var snakeList = [];
    for (var s = 0; s < snakes.length && s < limit; s++) {
      var summary = snakeSummary(snakes[s], s, a.center);
      if (summary) snakeList.push(summary);
    }
    var trainer = window.__slitherTrainer;
    return {
      version: VERSION,
      capturedAt: new Date().toISOString(),
      url: location.href,
      playing: !!window.playing,
      arena: a,
      counts: {
        snakes: snakes.length,
        snakesSampled: snakeList.length,
        food: foods.length,
        foodSampled: foodSummary.length,
        foodVisible: foodTotal,
        bigFoodVisible: bigFood
      },
      self: snakeSummary(window.slither, null, a.center),
      rank: number(window.rank, null),
      snakes: snakeList,
      food: foodSummary,
      trainer: trainer && trainer.state ? {
        version: trainer.version,
        takeover: !!trainer.state.takeover,
        armed: !!trainer.state.armed,
        mode: trainer.state.mode,
        kills: trainer.state.kills,
        coverage: trainer.state.coverage,
        mapVisited: trainer.state.mapVisited,
        mapCells: trainer.state.mapCells,
        mapTarget: trainer.state.mapTarget,
        huntTarget: trainer.state.huntTarget ? {
          id: trainer.state.huntTarget.id,
          length: trainer.state.huntTarget.sct,
          distance: trainer.state.huntTarget.d,
          maneuver: trainer.state.huntTarget.maneuver
        } : null
      } : null
    };
  }

  function summary(input) {
    var snap = input || trace();
    var self = snap.self || {};
    var lines = [
      'client probe ' + snap.capturedAt,
      'playing=' + snap.playing + ' rank=' + snap.rank,
      'arena center=' + snap.arena.center + ' radius=' + snap.arena.radius,
      'self id=' + self.id + ' len=' + self.length + ' x=' + self.x +
        ' y=' + self.y + ' speed=' + self.speed + ' boost=' + self.boost,
      'snakes=' + snap.counts.snakes + ' food visible=' +
        snap.counts.foodVisible + ' big pellets=' + snap.counts.bigFoodVisible
    ];
    if (snap.trainer) {
      lines.push(
        'trainer=' + snap.trainer.version + ' mode=' + snap.trainer.mode +
        ' kills=' + snap.trainer.kills +
        ' coverage=' + (snap.trainer.coverage * 100).toFixed(1) + '%'
      );
    }
    return lines.join('\n');
  }

  function log() {
    var snap = trace();
    console.info(summary(snap));
    console.log(snap);
    return snap;
  }

  function download() {
    var snap = trace();
    var text = JSON.stringify(snap, null, 2);
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'slither-probe-' + Date.now() + '.json';
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return snap;
  }

  function surface() {
    // These are normal local input fields consumed by the game's own event
    // loop. This function only reports them; it never writes them.
    return {
      steering: {
        xm: window.xm,
        ym: window.ym,
        note: 'offsets from the viewport centre; atan2(ym, xm) is the heading'
      },
      boost: {
        windowWmd: window.wmd,
        snakeWmd: window.slither ? window.slither.wmd : null,
        note: 'the trainer writes wmd only while it has takeover'
      },
      network: 'not exposed by this probe',
      memory: 'not touched by this probe'
    };
  }

  window.__slitherProbe = {
    version: VERSION,
    trace: trace,
    snapshot: trace,
    summary: summary,
    log: log,
    download: download,
    surface: surface
  };

  console.info('[probe] read-only client probe ready; try __slitherProbe.log()');
})();
