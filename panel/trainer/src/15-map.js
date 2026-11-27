  // ---- strategic map probe ---------------------------------------------
  // The client already exposes the arena and the snakes/food it has received.
  // This layer keeps a coarse visited grid and chooses an unvisited frontier.
  // It is deliberately local: no extra requests, no server reads, and the
  // safety planner can always overrule the frontier heading.
  var MAP = {
    grid: null,
    inside: null,
    cols: 0,
    rows: 0,
    cell: TUNE.MAP_CELL,
    originX: 0,
    originY: 0,
    arenaCx: 0,
    arenaCy: 0,
    arenaR: 0,
    meId: null,
    lastSampleAt: 0,
    lastX: null,
    lastY: null,
    visited: 0,
    insideCount: 0,
    coverage: 0,
    samples: 0,
    target: null,
    targetAt: 0,
    heading: null
  };

  function mapArenaStable(arena) {
    // flux_grd can drift by more than a grid bucket as the client receives
    // updates. Rounding a key still crossed boundaries and reset live
    // coverage back to one cell. Compare against the actual geometry used to
    // build the grid instead, with a tolerance wider than the jitter but
    // small enough that a real arena change still starts a fresh map.
    var tolerance = Math.max(650, MAP.cell);
    return Math.abs(arena.cx - MAP.arenaCx) <= tolerance &&
      Math.abs(arena.cy - MAP.arenaCy) <= tolerance &&
      Math.abs(arena.r - MAP.arenaR) <= tolerance;
  }

  function mapReset(me, arena, now) {
    var cell = Math.max(420, TUNE.MAP_CELL);
    var span = Math.ceil((arena.r * 2) / cell) + 2;
    var total = span * span;
    MAP.grid = new Uint8Array(total);
    MAP.inside = new Uint8Array(total);
    MAP.cols = span;
    MAP.rows = span;
    MAP.cell = cell;
    MAP.originX = arena.cx - (span * cell) / 2;
    MAP.originY = arena.cy - (span * cell) / 2;
    MAP.arenaCx = arena.cx;
    MAP.arenaCy = arena.cy;
    MAP.arenaR = arena.r;
    MAP.meId = me && me.id !== undefined ? String(me.id) : null;
    MAP.lastSampleAt = 0;
    MAP.lastX = me ? num(me.xx, arena.cx) : arena.cx;
    MAP.lastY = me ? num(me.yy, arena.cy) : arena.cy;
    MAP.visited = 0;
    MAP.insideCount = 0;
    MAP.coverage = 0;
    MAP.samples = 0;
    MAP.target = null;
    MAP.targetAt = 0;
    MAP.heading = null;

    var radius = Math.max(200, arena.r - TUNE.MAP_WALL_PAD);
    var radius2 = radius * radius;
    for (var row = 0; row < span; row++) {
      for (var col = 0; col < span; col++) {
        var x = MAP.originX + (col + 0.5) * cell;
        var y = MAP.originY + (row + 0.5) * cell;
        if (dist2(x, y, arena.cx, arena.cy) <= radius2) {
          MAP.inside[row * span + col] = 1;
          MAP.insideCount++;
        }
      }
    }
    state.coverage = 0;
    state.mapVisited = 0;
    state.mapCells = MAP.insideCount;
    state.mapHeading = null;
    state.mapTarget = null;
    state.mapSamples = 0;
    if (me) mapVisit(me.xx, me.yy);
    if (now !== undefined) MAP.lastSampleAt = now;
  }

  function mapVisit(x, y) {
    if (!MAP.grid || !MAP.inside) return;
    var col = Math.floor((x - MAP.originX) / MAP.cell);
    var row = Math.floor((y - MAP.originY) / MAP.cell);
    if (col < 0 || row < 0 || col >= MAP.cols || row >= MAP.rows) return;
    var key = row * MAP.cols + col;
    if (!MAP.inside[key]) return;
    if (MAP.grid[key] === 0) MAP.visited++;
    if (MAP.grid[key] < 255) MAP.grid[key]++;
  }

  function mapMarkSegment(x0, y0, x1, y1) {
    var dx = x1 - x0;
    var dy = y1 - y0;
    var distance = Math.sqrt(dx * dx + dy * dy);
    // A sample every ~45% of a cell keeps the trail continuous without
    // spending thousands of operations when a boost moves us far.
    var steps = Math.max(1, Math.ceil(distance / (MAP.cell * 0.45)));
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      mapVisit(x0 + dx * t, y0 + dy * t);
    }
  }

  function mapSample(me, arena, now) {
    var id = me && me.id !== undefined ? String(me.id) : null;
    if (!MAP.grid || !mapArenaStable(arena) || MAP.meId !== id) {
      mapReset(me, arena, now);
    }
    if (!me) return MAP;
    if (now - MAP.lastSampleAt < TUNE.MAP_SAMPLE_MS) return MAP;
    var x = num(me.xx, arena.cx);
    var y = num(me.yy, arena.cy);
    mapMarkSegment(MAP.lastX, MAP.lastY, x, y);
    MAP.lastX = x;
    MAP.lastY = y;
    MAP.lastSampleAt = now;
    MAP.samples++;
    MAP.coverage = MAP.insideCount > 0 ?
      MAP.visited / Math.max(1, MAP.insideCount) : 0;
    state.coverage = MAP.coverage;
    state.mapVisited = MAP.visited;
    state.mapCells = MAP.insideCount;
    state.mapSamples = MAP.samples;
    return MAP;
  }

  function mapCellCenter(col, row) {
    return {
      x: MAP.originX + (col + 0.5) * MAP.cell,
      y: MAP.originY + (row + 0.5) * MAP.cell
    };
  }

  function mapChooseFrontier(me, arena, now) {
    if (!MAP.grid) return null;
    var target = MAP.target;
    if (target) {
      var td = Math.sqrt(dist2(me.xx, me.yy, target.x, target.y));
      if (td > TUNE.MAP_TARGET_DIST && now - MAP.targetAt < 1800) {
        return {
          x: target.x, y: target.y, heading: MAP.heading,
          distance: td, unvisited: target.unvisited
        };
      }
    }
    if (now - MAP.targetAt < TUNE.MAP_FRONTIER_MS && target) {
      return {
        x: target.x, y: target.y, heading: MAP.heading,
        distance: Math.sqrt(dist2(me.xx, me.yy, target.x, target.y)),
        unvisited: target.unvisited
      };
    }

    var best = null;
    var bestScore = -Infinity;
    var unvisitedLeft = 0;
    for (var row = 0; row < MAP.rows; row++) {
      for (var col = 0; col < MAP.cols; col++) {
        var key = row * MAP.cols + col;
        if (!MAP.inside[key]) continue;
        var visits = MAP.grid[key];
        if (visits === 0) unvisitedLeft++;
        var point = mapCellCenter(col, row);
        var d = Math.sqrt(dist2(me.xx, me.yy, point.x, point.y));
        if (d < 220) continue;
        // Nearest unvisited cell first: this produces a sweep instead of a
        // random walk. Once the map is covered, prefer the least-visited
        // cell far enough away to be a useful new sweep.
        var score;
        if (visits === 0) score = 1000000 - d;
        else score = -visits * 8000 - d;
        if (MAP.heading !== null) {
          var toCell = Math.atan2(point.y - me.yy, point.x - me.xx);
          score += Math.cos(angleDiff(toCell, MAP.heading)) * 120;
        }
        if (score > bestScore) {
          bestScore = score;
          best = point;
          best.unvisited = visits === 0;
        }
      }
    }
    if (!best) {
      MAP.target = null;
      MAP.heading = null;
      state.mapHeading = null;
      state.mapTarget = null;
      return null;
    }
    MAP.target = best;
    MAP.targetAt = now;
    MAP.heading = Math.atan2(best.y - me.yy, best.x - me.xx);
    MAP.target.unvisited = best.unvisited;
    state.mapHeading = MAP.heading;
    state.mapTarget = { x: best.x, y: best.y, unvisited: !!best.unvisited };
    return {
      x: best.x,
      y: best.y,
      heading: MAP.heading,
      distance: Math.sqrt(dist2(me.xx, me.yy, best.x, best.y)),
      unvisited: !!best.unvisited,
      left: unvisitedLeft
    };
  }
