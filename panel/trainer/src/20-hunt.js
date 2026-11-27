  // ---- planner ---------------------------------------------------------
  function angleBlend(a, b, t) {
    t = clamp(t, 0, 1);
    var x = Math.cos(a) * (1 - t) + Math.cos(b) * t;
    var y = Math.sin(a) * (1 - t) + Math.sin(b) * t;
    return Math.atan2(y, x);
  }

  function isTailBait(me, s, selfLen) {
    // Equal-sized chasers are valid bait too. The kill comes from the head
    // behind us hitting our body, so the chaser's size is less important
    // than the fact that it is faster and already committed to our line.
    if (!s || s.sct > selfLen * TUNE.TAIL_BAIT_RATIO) return false;
    var toT = Math.atan2(s.y - me.yy, s.x - me.xx);
    var behind = Math.cos(angleDiff(toT, num(me.ang, 0))) < -0.35;
    var towardUs = Math.cos(angleDiff(s.ang, toT + Math.PI)) > 0.15;
    var selfSpeed = Math.max(TUNE.SPEED_MIN, num(me.sp, 5.5) * TUNE.SPEED_MULT);
    // A slower snake behind us cannot reach the tail. Hold the line only
    // when the chaser can actually catch up; otherwise turn and cut it.
    var canCatch = !!s.boost || num(s.speed, 0) >= selfSpeed * 1.0;
    return behind && towardUs && canCatch;
  }

  function chooseHuntSide(me, target, arena, heads) {
    var centerAng = Math.atan2(arena.cy - me.yy, arena.cx - me.xx);
    function scoreSide(sign) {
      var a = target.ang + sign * Math.PI / 2;
      var score = Math.cos(angleDiff(a, centerAng)) * 0.8;
      for (var i = 0; i < heads.length; i++) {
        var h = heads[i];
        if (String(h.id) === String(target.id)) continue;
        var d = Math.sqrt(dist2(me.xx, me.yy, h.x, h.y));
        if (d > 900) continue;
        var ha = Math.atan2(h.y - me.yy, h.x - me.xx);
        score -= Math.max(0, Math.cos(angleDiff(a, ha))) * (1 - d / 900) * 1.5;
      }
      return score;
    }
    return scoreSide(1) >= scoreSide(-1) ? 1 : -1;
  }

  // Time-to-collision model. This is what stops the trainer from treating
  // every visible head as a reason to flee. A head that is moving away or
  // passing wide is not a threat, even if it is close.
  function assessDanger(me, threats, arena, excludeId) {
    var heads = threats.heads;
    var level = 0;
    var urgent = false;
    var nearest = null;
    var crowd = 0;
    var nearby = 0;
    var chaseThreat = false;
    var selfSpeed = Math.max(TUNE.SPEED_MIN, num(me.sp, 5.5) * TUNE.SPEED_MULT);
    var selfLen = Math.max(0, num(me.sct, 0));
    var selfAng = num(me.ang, 0);
    var svx = Math.cos(selfAng) * selfSpeed;
    var svy = Math.sin(selfAng) * selfSpeed;
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (excludeId !== undefined && excludeId !== null && String(h.id) === String(excludeId)) continue;
      var dx = h.x - me.xx;
      var dy = h.y - me.yy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (!nearest || d < nearest.d) {
        nearest = {
          x: h.x, y: h.y, d: d, ang: h.ang, speed: h.speed,
          sct: h.sct, boost: h.boost, id: h.id
        };
      }
      // A three-length snake near a twenty-length snake is food or a
      // nuisance, not a reason to abandon a hunt. Its head can still kill on
      // contact, but the path planner already treats that as a hard obstacle.
      var tiny = h.sct < selfLen * 0.45;
      if (d < 620 && !tiny) crowd++;
      if (d < 1200 && !tiny) nearby++;
      if (d > TUNE.THREAT_RANGE) continue;
      var nx = dx / Math.max(1, d);
      var ny = dy / Math.max(1, d);
      var evx = Math.cos(h.ang) * h.speed;
      var evy = Math.sin(h.ang) * h.speed;
      var rvx = evx - svx;
      var rvy = evy - svy;
      var dot = nx * rvx + ny * rvy;
      var closing = -dot;
      var cpa = d;
      var ttc = Infinity;
      var rel2 = rvx * rvx + rvy * rvy;
      if (rel2 > 1) {
        cpa = Math.sqrt(Math.max(0, d * d - dot * dot));
        if (closing > 10) ttc = d / closing;
      }
      var t = 0;
      if (closing > 15 && ttc < 1.35) {
        t += ((1.35 - ttc) / 1.35) * clamp(1 - cpa / 520, 0, 1);
      }
      if (d < 260) t += ((260 - d) / 260) * 0.55;
      // A faster snake sitting behind us is a real threat even when the
      // instantaneous closing speed is low: it can follow and eventually
      // catch up. React before it is already on our tail.
      var toEnemy = Math.atan2(dy, dx);
      var behind = Math.cos(angleDiff(toEnemy, selfAng)) < -0.25;
      var towardUs = Math.cos(angleDiff(h.ang, toEnemy + Math.PI)) > 0.15;
      // A much larger snake that is closing or boosting nearby is an
      // existential threat even while it is still outside head-on range.
      // React before it is close enough to trap the player against a second
      // body; the old model only counted near heads and late time-to-collision.
      if (d < 1200 && h.sct > selfLen * 1.3 &&
          h.speed > selfSpeed * 1.1 && towardUs) {
        var bigThreat = (1 - d / 1200) * 0.85;
        if (h.boost) bigThreat *= 1.15;
        if (bigThreat > t) t = bigThreat;
      }
      if (behind && towardUs && !tiny && h.speed > selfSpeed * 1.03 && d < 1000) {
        chaseThreat = true;
        var catchT = d / Math.max(1, h.speed - selfSpeed);
        var chase = clamp(1 - catchT / 30, 0, 1) * 0.55 +
          clamp(1 - d / 1000, 0, 1) * 0.25;
        if (chase > t) t = chase;
      }
      if (h.boost) t *= 1.3;
      if (tiny) t *= 0.45;
      if (h.sct > selfLen * 1.15) t *= 1.12;
      if (t > level) level = t;
      if (t > 0.62) urgent = true;
      if (closing > 30 && cpa < 80 && ttc < 0.95 && !tiny) urgent = true;
      if (d < (tiny ? 95 : 130)) urgent = true;
    }
    if (crowd > 3) level += (crowd - 3) * 0.12;
    if (crowd > 6) urgent = true;
    if (nearby > 2) level += (nearby - 2) * 0.09;
    if (nearby > 6) urgent = true;
    var wd = Math.sqrt(dist2(me.xx, me.yy, arena.cx, arena.cy));
    var wall = arena.r - wd;
    if (wall < TUNE.WALL_MARGIN + 200) {
      level += ((TUNE.WALL_MARGIN + 200 - wall) / (TUNE.WALL_MARGIN + 200)) * 0.55;
    }
    if (wall < TUNE.WALL_MARGIN) urgent = true;
    return {
      level: clamp(level, 0, 1.5), urgent: urgent, nearest: nearest,
      crowd: crowd, nearby: nearby, wall: wall, chase: chaseThreat
    };
  }

  // Pick the least crowded sector around the player. This is not a panic
  // turn: it is what stops a short snake from being herded through a pack of
  // larger snakes for the whole run. Food and hunting still win when the
  // local area is calm, because the bias only scales with nearby threat
  // density.
  function chooseOpenHeading(me, threats, arena, excludeId) {
    var heads = threats.heads;
    var selfLen = num(me.sct, 0);
    var best = null;
    var bestScore = -Infinity;
    for (var i = 0; i < 24; i++) {
      var a = (i * TAU) / 24;
      var score = 0;
      for (var j = 0; j < heads.length; j++) {
        var h = heads[j];
        if (excludeId !== undefined && excludeId !== null && String(h.id) === String(excludeId)) continue;
        var d = Math.sqrt(dist2(me.xx, me.yy, h.x, h.y));
        if (d > TUNE.OPEN_RANGE) continue;
        var toH = Math.atan2(h.y - me.yy, h.x - me.xx);
        var align = Math.cos(angleDiff(a, toH));
        if (align <= 0) continue;
        var weight = 1 - d / TUNE.OPEN_RANGE;
        var size = h.sct > selfLen * 1.15 ? 2.2 : (h.sct > selfLen * 0.85 ? 1.5 : 1);
        score -= align * align * weight * size * (h.boost ? 1.25 : 1) * 10;
      }
      var ex = me.xx + Math.cos(a) * 600;
      var ey = me.yy + Math.sin(a) * 600;
      var wall = arena.r - Math.sqrt(dist2(ex, ey, arena.cx, arena.cy)) - TUNE.WALL_MARGIN - 100;
      if (wall < 0) score += wall * 0.8;
      score += Math.cos(angleDiff(a, num(me.ang, 0))) * 2;
      if (!best || score > bestScore) {
        best = a;
        bestScore = score;
      }
    }
    return best;
  }

  function selectHuntTarget(me, threats, arena, now) {
    if (!state.settings.hunt || state.settings.aggression <= 0) {
      state.huntTargetId = null;
      state.huntTarget = null;
      return null;
    }
    var selfLen = Math.max(0, num(me.sct, 0));
    if (selfLen < TUNE.HUNT_MIN_LEN) {
      state.huntTargetId = null;
      state.huntTarget = null;
      return null;
    }
    var selfSpeed = Math.max(TUNE.SPEED_MIN, num(me.sp, 5.5) * TUNE.SPEED_MULT);
    var byId = {};
    var i;
    for (i = 0; i < threats.snakes.length; i++) {
      byId[threats.snakes[i].id] = threats.snakes[i];
    }
    var current = state.huntTargetId ? byId[String(state.huntTargetId)] : null;
    var currentCooling = current && state.huntCooldownId &&
      String(state.huntCooldownId) === String(current.id) &&
      now < state.huntCooldownUntil;
    if (current && !currentCooling && now < state.huntUntil &&
        current.d < TUNE.HUNT_MAX_DIST * 1.3 &&
        current.sct <= selfLen * TUNE.HUNT_MAX_RATIO) {
      var currentToT = Math.atan2(current.y - me.yy, current.x - me.xx);
      var currentAway = Math.cos(angleDiff(current.ang, currentToT));
      var currentTail = isTailBait(me, current, selfLen);
      // A target that boosts or turns into a faster runner is no longer a
      // kill; it is a chase that drags the trainer across the map. Drop the
      // lock before that happens, not after thirty seconds of pursuit. A
      // smaller snake boosting up our tail is the exception: it is running
      // into the body behind us, not away from it.
      var uncatchable = (!currentTail && current.boost && current.d > 200) ||
        (currentAway > 0.55 && current.speed >= selfSpeed * 0.98);
      if (!uncatchable) {
        state.huntTarget = current;
        return current;
      }
    }

    var aggression = clamp(num(state.settings.aggression, 1), 0, 2);
    // Peer-sized prey is now fair game when it is slow or crossing. A snake
    // longer than the player is still rejected, and a head-on peer still
    // triggers the close-range bailout. The extra aggression goes into range,
    // lock time and body-trap commitment rather than blind head-on ramming.
    var maxRatio = Math.min(1, TUNE.HUNT_MAX_RATIO + (aggression - 1) * 0.12);
    var maxDist = TUNE.HUNT_MAX_DIST * (0.85 + aggression * 0.15);
    var maxCrowd = TUNE.HUNT_MAX_CROWD + (aggression > 1.5 ? 1 : 0);
    var best = null;
    for (i = 0; i < threats.snakes.length; i++) {
      var s = threats.snakes[i];
      // A target that just forced us to bail out at head-contact range gets
      // a short cooldown. Reacquiring it immediately made the trainer turn
      // straight back into the body it had just escaped.
      if (state.huntCooldownId && now < state.huntCooldownUntil &&
          String(state.huntCooldownId) === String(s.id)) continue;
      if (s.sct < 4 || s.sct > selfLen * maxRatio) continue;
      if (s.d < TUNE.HUNT_MIN_DIST || s.d > maxDist) continue;
      var tailBait = isTailBait(me, s, selfLen);
      if (s.boost && s.d > 260 && !tailBait) continue;
      var crowd = 0;
      for (var k = 0; k < threats.heads.length; k++) {
        var h = threats.heads[k];
        if (String(h.id) === s.id) continue;
        if (dist2(h.x, h.y, s.x, s.y) < TUNE.HUNT_CROWD_RADIUS * TUNE.HUNT_CROWD_RADIUS) crowd++;
      }
      if (crowd > maxCrowd) continue;
      var targetWall = arena.r - Math.sqrt(dist2(s.x, s.y, arena.cx, arena.cy));
      if (targetWall < 360) continue;
      var toTarget = Math.atan2(s.y - me.yy, s.x - me.xx);
      var away = Math.cos(angleDiff(s.ang, toTarget));
      // A snake running directly away at our speed or faster cannot be
      // caught without giving up the farming line, and following it drags
      // the trainer across the map for nothing. Slower runners and crossing
      // snakes stay on the list; those are the catchable kills.
      if (away > 0.55 && s.speed >= selfSpeed * 0.98) continue;
      var ratio = s.sct / Math.max(1, selfLen);
      var score = 50 + s.sct * 1.4 + (maxDist - s.d) * 0.045 -
        ratio * 28 - crowd * 26 - (s.boost && !tailBait ? 35 : 0);
      if (tailBait) score += 18;
      score += Math.cos(angleDiff(toTarget, me.ang)) * 10;
      score *= 0.75 + aggression * 0.25;
      if (!best || score > best.score) {
        best = {
          id: s.id, head: s.head, d: s.d, sct: s.sct, sc: s.sc,
          speed: s.speed, boost: s.boost, x: s.x, y: s.y, ang: s.ang,
          r: s.head.r, s: s.s, score: score
        };
      }
    }
    if (best) {
      state.huntTargetId = best.id;
      state.huntUntil = now + TUNE.HUNT_LOCK_MS;
      state.huntTarget = best;
      return best;
    }
    state.huntTargetId = null;
    state.huntTarget = null;
    return null;
  }

