  function evaluatePath(me, targetHeading, ctx) {
    var steps = TUNE.STEPS;
    var dt = TUNE.HORIZON / steps;
    var lagSteps = (ctx.emergency ? TUNE.EMERGENCY_LAG : TUNE.CONTROL_LAG) / dt;
    var turnRate = TUNE.TURN_RATE *
      clamp(num(me.scang, 1), 0.13, 1.2) *
      clamp(num(me.spang, 1), 0.7, 1.25);
    var maxTurn = turnRate * dt;
    var startAng = num(me.ang, 0);
    var preAng = num(me.eang, state.heading);
    var x = num(me.xx, 0);
    var y = num(me.yy, 0);
    var h = startAng;
    var minClear = 999;
    var minWall = 999;
    var score = 0;
    var path = [];
    var obstacles = ctx.obstacles;
    var heads = ctx.heads;
    var arena = ctx.arena;
    var selfR = ctx.selfR;
    var safety = ctx.safety;
    var speed = ctx.speed;
    var i;
    var j;

    for (i = 1; i <= steps; i++) {
      var desired = (i <= lagSteps) ? preAng : targetHeading;
      h += clamp(angleDiff(desired, h), -maxTurn, maxTurn);
      x += Math.cos(h) * speed * dt;
      y += Math.sin(h) * speed * dt;
      path.push(x, y);
      var early = 1 - ((i - 1) / steps) * 0.55;

      for (j = 0; j < obstacles.length; j++) {
        var o = obstacles[j];
        var dx = x - o.x;
        var dy = y - o.y;
        var rr = o.r + selfR + safety;
        var clear = Math.sqrt(dx * dx + dy * dy) - rr;
        if (clear < minClear) minClear = clear;
        if (clear < 0) score += clear * 70 * early;
        else {
          var ow = o.hunt ? 0.30 : 1;
          var clearCap = o.hunt ? TUNE.HUNT_CLEAR_CAP : 150;
          score += Math.min(clear, clearCap) * 2.1 * ow * early;
        }
        // A hunt must not buy a cut with a scrape. The capped reward above
        // keeps target avoidance from dominating, but below the normal
        // danger margin the target becomes a hard safety constraint again.
        if (o.hunt && clear < TUNE.DANGER_CLEAR) {
          score -= (TUNE.DANGER_CLEAR - clear) * 220 * early;
        }
      }

      // Moving heads are predicted separately. Fixed ghost dots create
      // holes between samples; a continuous time-to-collision capsule is
      // much more reliable for dodging and for cutting across a nose.
      for (j = 0; j < heads.length; j++) {
        var hd = heads[j];
        var t = i * dt;
        // Predict only the next fraction of a second. Extrapolating a
        // chasing head across the whole rollout makes every escape path
        // look doomed and causes the trainer to turn into the chaser.
        var predT = Math.min(t, TUNE.HEAD_PREDICT);
        var ha = hd.ang;
        if (hd.d < 900 && predT > 0.05) {
          var toMe = Math.atan2(me.yy - hd.y, me.xx - hd.x);
          var headTurn = hd.hunt ? TUNE.HUNT_HEAD_TURN : TUNE.HEAD_TURN_RATE;
          ha += clamp(angleDiff(toMe, hd.ang),
            -headTurn * predT, headTurn * predT);
        }
        var hx = hd.x + Math.cos(ha) * hd.speed * predT;
        var hy = hd.y + Math.sin(ha) * hd.speed * predT;
        var hClear = Math.sqrt(dist2(x, y, hx, hy)) - (hd.r + selfR + safety);
        if (hClear < minClear) minClear = hClear;
        if (hClear < 0) score += hClear * 80 * early;
        else {
          var hw = hd.hunt ? 0.55 : TUNE.HEAD_WEIGHT;
          var hCap = hd.hunt ? TUNE.HUNT_CLEAR_CAP : 140;
          score += Math.min(hClear, hCap) * hw * early;
        }
        if (hd.hunt && hClear < TUNE.DANGER_CLEAR) {
          score -= (TUNE.DANGER_CLEAR - hClear) * 160 * early;
        }
      }

      var wd = Math.sqrt(dist2(x, y, arena.cx, arena.cy));
      var wall = arena.r - wd - TUNE.WALL_MARGIN - safety;
      if (wall < minWall) minWall = wall;
      if (wall < 0) score += wall * 60 * early;
      else score += Math.min(wall, 260) * 0.35 * early;

      // Do not let the rollout coil back through the path it just made.
      if (me.sct >= 8) {
        var selfFutureR = selfR * 2 + 10;
        for (var q = 0; q + 1 < path.length - 8; q += 2) {
          var selfD = Math.sqrt(dist2(x, y, path[q], path[q + 1]));
          if (selfD < selfFutureR) score += (selfD - selfFutureR) * 140 * early;
        }
      }
    }

    var foodScore = 0;
    if (ctx.foods.length && state.settings.foodPull > 0) {
      for (var p = 0; p + 1 < path.length; p += 2) {
        var px = path[p];
        var py = path[p + 1];
        var decay = 1.2 - 0.6 * (p / path.length);
        for (var f = 0; f < ctx.foods.length; f++) {
          var food = ctx.foods[f];
          var fd2 = dist2(px, py, food.x, food.y);
          if (fd2 < TUNE.FOOD_REACH * TUNE.FOOD_REACH) {
            var fd = Math.sqrt(fd2);
            foodScore += food.w * (1 - fd / TUNE.FOOD_REACH) * decay;
          }
        }
      }
      foodScore *= state.settings.foodPull;
      var foodScale = ctx.huntTarget ? TUNE.HUNT_FOOD_SCALE : 1;
      // Do not trade a safe escape line for a pellet. During an urgent dodge
      // food has almost no vote; otherwise a ring of food can pull the snake
      // back across the nose it is trying to leave.
      if (ctx.escape) foodScale *= 0.06;
      score += foodScore * TUNE.FOOD_WEIGHT * foodScale;

      // A lane bonus makes distant food visible to the planner instead of
      // only rewarding food that happens to be within reach of the rollout.
      var lane = 0;
      for (var lf = 0; lf < ctx.foods.length; lf++) {
        var lfood = ctx.foods[lf];
        var lfd = Math.sqrt(lfood.d2);
        if (lfd >= TUNE.FOOD_RANGE) continue;
        var la = Math.atan2(lfood.y - me.yy, lfood.x - me.xx);
        var align = Math.cos(angleDiff(targetHeading, la));
        if (align > 0.2) lane += lfood.w * align * (1 - lfd / TUNE.FOOD_RANGE);
      }
      lane *= state.settings.foodPull;
      score += lane * TUNE.FOOD_LANE_WEIGHT * foodScale;
      foodScore += lane;
    }

    var huntScore = 0;
    var ht = ctx.huntTarget;
    if (ht && ctx.aggression > 0) {
      var htX = ht.x;
      var htY = ht.y;
      var htAng = ht.ang;
      var htSpeed = ht.speed;
      var td = Math.max(1, ht.d);
      var toT = Math.atan2(htY - me.yy, htX - me.xx);
      var standoff = clamp(TUNE.HUNT_STANDOFF + ht.sct * 1.6, 100, 210);
      var desiredHunt;
      if (ctx.maneuver === 'bait') {
        // Hold the current line. A smaller snake chasing our tail dies on the
        // body already behind us; turning across its nose moves that body out
        // of its path and turns a free kill into another close miss.
        desiredHunt = startAng;
      } else if (ctx.maneuver === 'cut') {
        desiredHunt = htAng + ctx.huntSide * Math.PI / 2;
        desiredHunt = angleBlend(desiredHunt, toT, clamp((td - 260) / 600, 0, 0.45));
      } else if (ctx.maneuver === 'chase') {
        // A slower snake running away leaves its body directly in our path.
        // Aim for a lead point beside its nose so we overtake alongside it
        // instead of rear-ending its tail, then cut across when we are ahead.
        var chaseLead = clamp(td / Math.max(180, ctx.speed + htSpeed), 0.25, 1.6);
        var sideOff = ht.r + selfR + safety + 30;
        // Close to a fleeing snake, the normal standoff is too narrow to
        // clear its tail. Open the flank so a boost can actually overtake.
        if (td < 420) sideOff *= 1.5;
        var chaseX = htX + Math.cos(htAng) * htSpeed * chaseLead -
          Math.sin(htAng) * sideOff * ctx.huntSide;
        var chaseY = htY + Math.sin(htAng) * htSpeed * chaseLead +
          Math.cos(htAng) * sideOff * ctx.huntSide;
        desiredHunt = Math.atan2(chaseY - me.yy, chaseX - me.xx);
      } else if (ctx.maneuver === 'coil') {
        var ux = Math.cos(toT);
        var uy = Math.sin(toT);
        var tx = -uy * ctx.huntSide;
        var ty = ux * ctx.huntSide;
        var radial = clamp((td - standoff) / 240, -0.9, 1.0);
        desiredHunt = Math.atan2(ty + uy * radial * 1.15, tx + ux * radial * 1.15);
      } else {
        var leadT = clamp(td / Math.max(180, ctx.speed + htSpeed), 0.2, 1.1);
        var leadX = htX + Math.cos(htAng) * htSpeed * leadT;
        var leadY = htY + Math.sin(htAng) * htSpeed * leadT;
        desiredHunt = Math.atan2(leadY - me.yy, leadX - me.xx);
      }
      var huntAlign = Math.cos(angleDiff(targetHeading, desiredHunt));
      var huntBonus = ctx.maneuver === 'chase' ? TUNE.CHASE_BONUS : TUNE.HUNT_BONUS;
      huntScore += huntAlign * huntBonus * ctx.aggression;

      if (ctx.maneuver !== 'bait') {
        var endX = path[path.length - 2];
        var endY = path[path.length - 1];
        var endD = Math.sqrt(dist2(endX, endY, htX, htY));
        if (endD > standoff) {
          huntScore += clamp(1 - (endD - standoff) / 520, 0, 1) * 22 * ctx.aggression;
        } else if (endD < standoff * 0.7) {
          huntScore -= (standoff * 0.7 - endD) * 0.9 * ctx.aggression;
        }
      }

      // Body-trap model: the target dies if its head reaches our body.
      // Our head must stay clear, but our trailing body is a weapon.
      var hitR = ht.sc * TUNE.BODY_HALF + selfR + 8;
      var trap = 0;
      for (var tt = 0.2; tt <= 1.3; tt += 0.22) {
        var px = htX + Math.cos(htAng) * htSpeed * tt;
        var py = htY + Math.sin(htAng) * htSpeed * tt;
        var minD = 999;
        for (var q = 0; q < ctx.selfBody.length; q++) {
          var sd = Math.sqrt(dist2(px, py, ctx.selfBody[q].x, ctx.selfBody[q].y));
          if (sd < minD) minD = sd;
        }
        for (var qp = 0; qp + 1 < path.length; qp += 2) {
          var pd = Math.sqrt(dist2(px, py, path[qp], path[qp + 1]));
          if (pd < minD) minD = pd;
        }
        if (minD < hitR) trap += 1;
        else if (minD < hitR + 90) trap += 1 - (minD - hitR) / 90;
      }
      huntScore += trap * TUNE.HUNT_BODY_BONUS * ctx.aggression;
      score += huntScore;
    }

    // If there is a real threat, bias toward the escape vector. Otherwise
    // the trainer is free to farm or hunt instead of running constantly.
    if (ctx.escape && ctx.nearest) {
      var away = ctx.evadeHeading;
      if (away === null || away === undefined) {
        away = Math.atan2(me.yy - ctx.nearest.y, me.xx - ctx.nearest.x);
      }
      var escapeWeight = TUNE.ESCAPE_BIAS * clamp(num(ctx.danger && ctx.danger.level, 0), 0, 1);
      score += Math.cos(angleDiff(targetHeading, away)) * escapeWeight;
    }
    if (ctx.openHeading !== null && ctx.openHeading !== undefined && ctx.openWeight > 0) {
      score += Math.cos(angleDiff(targetHeading, ctx.openHeading)) *
        TUNE.OPEN_BIAS * ctx.openWeight;
    }
    if (ctx.mapHeading !== null && ctx.mapHeading !== undefined &&
        !ctx.huntTarget && !ctx.escape && ctx.mapWeight > 0) {
      score += Math.cos(angleDiff(targetHeading, ctx.mapHeading)) *
        TUNE.MAP_BIAS * ctx.mapWeight;
    }
    if (ctx.danger && ctx.danger.wall < TUNE.WALL_MARGIN + 220) {
      var toCenter = Math.atan2(arena.cy - me.yy, arena.cx - me.xx);
      score += Math.cos(angleDiff(targetHeading, toCenter)) * 14;
    }

    // Prefer continuing in roughly the current direction. This is what
    // stops the planner from oscillating between two equally safe paths.
    score += Math.cos(angleDiff(targetHeading, startAng)) * 4;
    score += Math.cos(angleDiff(targetHeading, state.heading)) * TUNE.PREV_BONUS;

    if (minClear >= 0 && minWall >= 0) score += TUNE.SAFE_BONUS;
    else score -= TUNE.UNSAFE_PENALTY;

    return {
      score: score,
      minClear: minClear,
      minWall: minWall,
      foodScore: foodScore,
      huntScore: huntScore,
      path: path
    };
  }

  function nearestHead(me, heads) {
    var best = null;
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      var d = Math.sqrt(dist2(me.xx, me.yy, h.x, h.y));
      if (!best || d < best.d) best = { x: h.x, y: h.y, d: d };
    }
    return best;
  }

  function choosePlan(me, threats, selfBody, foods, arena, now) {
    var selfR = snakeRadius(me);
    var safety = state.settings.safety;
    var baseSpeed = Math.max(TUNE.SPEED_MIN, num(me.sp, 5.5) * TUNE.SPEED_MULT);
    var speed = state.boost ? TUNE.BOOST_SPEED : baseSpeed;
    var base = num(me.ang, state.heading);
    var prev = isFinite(state.heading) ? state.heading : base;
    var candidates = [];
    var i;

    var danger = assessDanger(me, threats, arena);
    state.danger = danger.level;
    state.nearest = danger.nearest;
    if (state.corpse && now >= state.corpse.until) state.corpse = null;
    detectCorpse(foods, now);
    // Keep the coarse map warm every tick, even while hunting. The frontier
    // heading only votes when the local area is calm and no target/feast is
    // active; otherwise it is just instrumentation.
    mapSample(me, arena, now);
    var mapInfo = mapChooseFrontier(me, arena, now);

    var target = selectHuntTarget(me, threats, arena, now);
    var selfLen = Math.max(0, num(me.sct, 0));
    var tailBait = target ? isTailBait(me, target, selfLen) : false;
    if (target && !tailBait &&
        target.d < selfR + snakeRadius(target) + 70 &&
        (target.sct >= Math.max(16, selfLen * 0.75) || target.boost)) {
      // Head-to-head at this range is a coin flip: our head can touch the
      // target body just as easily as its head can touch ours. Bail out,
      // let the target run into the body behind us, and do not reacquire it
      // for a moment. A genuinely tiny snake has a short body and cannot
      // cover the same distance, so the close cut is still worth taking.
      state.huntCooldownId = String(target.id);
      state.huntCooldownUntil = now + 1200;
      target = null;
      state.huntTarget = null;
      state.huntTargetId = null;
      state.boostUntil = 0;
    }
    var modeDanger = danger;
    if (target) {
      // Ignore the target itself when deciding whether hunting is safe.
      // Otherwise an incoming smaller snake would always look like danger,
      // and the trainer would flee instead of cutting across its nose.
      modeDanger = assessDanger(me, threats, arena, target.id);
      var keepSmall = target.sct < selfLen * 0.65 && target.d < 380;
      if ((modeDanger.urgent || modeDanger.level > 0.58) && !keepSmall) {
        target = null;
        state.huntTarget = null;
        state.huntTargetId = null;
      } else {
        var toT = Math.atan2(target.y - me.yy, target.x - me.xx);
        var facing = Math.cos(angleDiff(target.ang, toT));
        var along = (target.x - me.xx) * Math.cos(target.ang) +
          (target.y - me.yy) * Math.sin(target.ang);
        if (target.d < 340 && along < -30) target.maneuver = 'cut';
        else if (target.d < 420 && facing < -0.1) target.maneuver = 'cut';
        else if (target.d < 240 && facing > 0.4) target.maneuver = 'cut';
        else if (facing > 0.3) target.maneuver = 'chase';
        else if (target.d < 460) {
          // A slower target cannot outrun the cut; circling it with coil
          // only burns time. Equal or faster prey is the case where the
          // tangent coil actually helps bring the body around.
          target.maneuver = target.speed < baseSpeed * 0.95 ? 'cut' : 'coil';
        } else target.maneuver = 'hunt';
        if (tailBait) target.maneuver = 'bait';
        target.huntSide = chooseHuntSide(me, target, arena, threats.heads);
        var fromTarget = Math.atan2(me.yy - target.y, me.xx - target.x);
        var lateral = Math.sin(angleDiff(fromTarget, target.ang));
        if (target.maneuver === 'chase') {
          // Approach from the side we are already on. Aiming across the
          // target's body makes the planner treat its own tail as a wall and
          // settle into a parallel chase that never closes the distance.
          if (Math.abs(lateral) > 0.15) target.huntSide = lateral > 0 ? 1 : -1;
        } else if (target.maneuver === 'cut' && Math.abs(lateral) > 0.15) {
          // Cross toward the target's path, not away from it.
          target.huntSide = lateral > 0 ? -1 : 1;
        }
        state.huntTarget = target;
      }
    }
    if (modeDanger.chase) state.chaseUntil = now + 1600;
    var chaseActive = now < state.chaseUntil;
    if (chaseActive) {
      // A small target can be finished quickly, but only when the snake
      // chasing us is still far away. Ignoring a close chaser to chase a
      // minnow is how a short run turns into a death.
      var chaser = modeDanger.nearest || danger.nearest;
      var committedSmall = target && target.sct < selfLen * 0.7 &&
        target.d < 320 && (!chaser || chaser.d > 650);
      if (!committedSmall) {
        modeDanger.level = Math.max(modeDanger.level, 0.62);
        if (target) {
          target = null;
          state.huntTarget = null;
          state.huntTargetId = null;
        }
      }
    }

    var targetKey = target ? String(target.id) : null;
    var bodyPoints = buildBodyPoints(threats, targetKey);
    threats.bodyPoints = bodyPoints;
    for (i = 0; i < threats.points.length; i++) {
      threats.points[i].hunt = !!targetKey && String(threats.points[i].id) === targetKey;
    }
    for (i = 0; i < bodyPoints.length; i++) {
      bodyPoints[i].hunt = !!targetKey && String(bodyPoints[i].id) === targetKey;
    }
    for (i = 0; i < threats.heads.length; i++) {
      threats.heads[i].hunt = !!targetKey && String(threats.heads[i].id) === targetKey;
    }

    var evadeHeading = null;
    if (modeDanger.nearest && (modeDanger.urgent || modeDanger.level > 0.55)) {
      var near = modeDanger.nearest;
      var nearId = String(near.id);
      var needNew = state.escapeHeading === null || now >= state.escapeUntil ||
        state.escapeThreatId !== nearId;
      if (needNew) {
        var away = Math.atan2(me.yy - near.y, me.xx - near.x);
        var toCenter = Math.atan2(arena.cy - me.yy, arena.cx - me.xx);
        var left = away + Math.PI / 2;
        var right = away - Math.PI / 2;
        var centerSide = Math.cos(angleDiff(left, toCenter)) >= Math.cos(angleDiff(right, toCenter)) ? 1 : -1;
        var enemyFromMe = Math.atan2(near.y - me.yy, near.x - me.xx);
        var lateral = Math.sin(angleDiff(enemyFromMe, base));
        var side = Math.abs(lateral) > 0.2 ? (lateral > 0 ? -1 : 1) : centerSide;
        var isBehind = Math.cos(angleDiff(enemyFromMe, base)) < -0.2;
        // If the enemy nose is coming at us, running straight away keeps us
        // inside its line and lets a faster snake close the gap. Step across
        // its nose instead. The side pick keeps the dodge away from the wall
        // and from a second head where possible.
        var enemyAtUs = Math.cos(angleDiff(near.ang, enemyFromMe + Math.PI));
        var headOn = enemyAtUs > 0.25 && near.d < 900;
        // A head-on escape must leave the enemy's line, not orbit its nose.
        // Lock a perpendicular world heading for long enough to actually
        // break away; recomputing "away" every second just circles the head
        // while the faster snake turns inside the loop.
        var escapeAngle = away;
        if (isBehind) {
          escapeAngle = away + side * 0.95;
        } else if (headOn) {
          var perpA = near.ang + Math.PI / 2;
          var perpB = near.ang - Math.PI / 2;
          escapeAngle = Math.cos(angleDiff(perpA, away)) >=
            Math.cos(angleDiff(perpB, away)) ? perpA : perpB;
        }
        state.escapeHeading = escapeAngle;
        state.escapeThreatId = nearId;
        state.escapeUntil = now + (headOn ? 1800 : 1100);
      }
      evadeHeading = state.escapeHeading;
    } else {
      state.escapeHeading = null;
      state.escapeThreatId = null;
      state.escapeUntil = 0;
    }

    var openHeading = null;
    var openWeight = 0;
    if (threats.heads.length > 1) {
      if (state.migrateHeading === null || now >= state.migrateUntil) {
        state.migrateHeading = chooseOpenHeading(me, threats, arena, target ? target.id : null);
        state.migrateUntil = now + TUNE.OPEN_COMMIT_MS;
      }
      openHeading = state.migrateHeading;
      var nearbyHeads = 0;
      for (i = 0; i < threats.heads.length; i++) {
        if (dist2(me.xx, me.yy, threats.heads[i].x, threats.heads[i].y) < 1200 * 1200) {
          nearbyHeads++;
        }
      }
      openWeight = nearbyHeads <= 1 ? 0 :
        clamp(0.04 + (nearbyHeads - 1) * 0.18 + danger.level * 0.35, 0, 1);
      if (target) openWeight *= 0.3;
      if (modeDanger.urgent) openWeight *= 0.2;
    } else {
      state.migrateHeading = null;
      state.migrateUntil = 0;
    }

    var mapWeight = 0;
    if (mapInfo && !target && !state.corpse &&
        state.settings.explore > 0 && !modeDanger.urgent &&
        modeDanger.level <= 0.55) {
      var nearFood = 0;
      for (i = 0; i < foods.length; i++) {
        if (foods[i].d2 < 650 * 650) nearFood++;
      }
      // A dense local farm is already the best use of time. The frontier
      // becomes a real vote only when the nearby field is thin.
      mapWeight = state.settings.explore *
        clamp(0.9 - nearFood * 0.02, 0.25, 0.9);
    }

    var ctx = {
      obstacles: threats.points.concat(bodyPoints, selfBody),
      heads: threats.heads,
      foods: foods,
      arena: arena,
      selfR: selfR,
      selfBody: selfBody,
      safety: safety,
      speed: speed,
      huntTarget: target,
      maneuver: target ? target.maneuver : null,
      huntSide: target ? target.huntSide : 1,
      aggression: clamp(num(state.settings.aggression, 1), 0, 2),
      escape: modeDanger.urgent || modeDanger.level > 0.55,
      emergency: !!(danger.urgent && danger.nearest && danger.nearest.d < 340),
      danger: modeDanger,
      nearest: modeDanger.nearest || danger.nearest,
      evadeHeading: evadeHeading,
      openHeading: openHeading,
      openWeight: openWeight,
      mapHeading: mapInfo ? mapInfo.heading : null,
      mapWeight: mapWeight
    };

    for (i = 0; i < TUNE.COARSE_N; i++) {
      candidates.push(base + (i * TAU) / TUNE.COARSE_N);
    }
    for (i = 0; i < TUNE.FINE_N; i++) {
      var t = TUNE.FINE_N === 1 ? 0.5 : i / (TUNE.FINE_N - 1);
      candidates.push(prev + (t - 0.5) * TUNE.FINE_SPAN);
    }
    candidates.push(base);

    var best = null;
    for (i = 0; i < candidates.length; i++) {
      var h = candidates[i];
      var res = evaluatePath(me, h, ctx);
      if (!best || res.score > best.score) {
        best = {
          heading: h,
          score: res.score,
          minClear: res.minClear,
          minWall: res.minWall,
          foodScore: res.foodScore,
          huntScore: res.huntScore,
          path: res.path
        };
      }
    }
    if (!best) return null;

    // Second pass: refine the winner with a narrow fan. This gives much
    // finer steering than the coarse circle without paying for it globally.
    var refineCenter = best.heading;
    for (i = 0; i < TUNE.ULTRA_N; i++) {
      var u = TUNE.ULTRA_N === 1 ? 0.5 : i / (TUNE.ULTRA_N - 1);
      var uh = refineCenter + (u - 0.5) * TUNE.ULTRA_SPAN;
      var ures = evaluatePath(me, uh, ctx);
      if (ures.score > best.score) {
        best = {
          heading: uh,
          score: ures.score,
          minClear: ures.minClear,
          minWall: ures.minWall,
          foodScore: ures.foodScore,
          huntScore: ures.huntScore,
          path: ures.path
        };
      }
    }

    var mode = 'cruise';
    if (best.minClear < 0 || modeDanger.urgent) mode = 'escape';
    else if (modeDanger.level > 0.55) mode = 'danger';
    else if (target) mode = target.maneuver;
    else if (state.corpse && state.settings.foodPull > 0) mode = 'feast';
    else if (best.foodScore > 0.5) mode = 'farm';
    else if (mapWeight > 0) mode = 'explore';

    // The target's own body is part of minClear, so a normal close chase
    // routinely sits below DANGER_CLEAR. Dropping the hunt at the full
    // threshold turned every equal-speed pursuit into a stalemate. A slower
    // target cannot ram us, so press that kill all the way in; against an
    // equal or faster snake, abandon a genuinely tight line and cancel the
    // hunt boost so the trainer cannot coast into the body.
    var closeLimit = target &&
      (target.maneuver === 'bait' || target.speed < baseSpeed * 0.95) ?
      0 : TUNE.DANGER_CLEAR * 0.5;
    if (target && best.minClear < closeLimit) {
      mode = 'danger';
      target = null;
      state.huntTarget = null;
      state.huntTargetId = null;
      state.boostUntil = 0;
    }

    var boost = now < state.boostUntil;
    if (boost && best.minWall < 60) {
      boost = false;
      state.boostUntil = 0;
    }
    if (!boost && state.settings.boostEscape && now > state.boostCooldownUntil) {
      if (mode === 'escape' && best.minClear < TUNE.BOOST_CLEAR &&
          best.minWall > 60 && num(me.sct, 0) >= 3) {
        var nearest = modeDanger.nearest || danger.nearest;
        if (nearest && nearest.d < 480) {
          var away = Math.atan2(me.yy - nearest.y, me.xx - nearest.x);
          // A lateral escape is valid even when it is not pointing straight
          // away from the head. Only refuse a boost that drives into the nose.
          if (Math.cos(angleDiff(best.heading, away)) > -0.1) {
            var toNear = Math.atan2(nearest.y - me.yy, nearest.x - me.xx);
            var incoming = Math.cos(angleDiff(nearest.ang, toNear + Math.PI)) > 0.2;
            var boostMs = incoming ? TUNE.HEADON_BOOST_MS : TUNE.BOOST_MS;
            var coolMs = incoming ? TUNE.HEADON_BOOST_COOLDOWN : TUNE.BOOST_COOLDOWN;
            state.boostUntil = now + boostMs;
            state.boostCooldownUntil = now + boostMs + coolMs;
            boost = true;
          }
        }
      }
    }
    // Gated cut-off boost. This is only for a smaller, isolated target and
    // only when the current path is clear; it is never used to chase food.
    if (!boost && target && state.settings.boostEscape &&
        now > state.cutBoostCooldownUntil && mode === 'cut' &&
        target.d > 120 && target.d < 540 && num(me.sct, 0) >= 12 &&
        best.minClear > 20 && best.minWall > 120) {
      var cutTo = Math.atan2(target.y - me.yy, target.x - me.xx);
      if (Math.cos(angleDiff(best.heading, cutTo)) > 0.05) {
        state.boostUntil = now + TUNE.CUT_BOOST_MS;
        state.cutBoostCooldownUntil = now + TUNE.CUT_BOOST_MS + TUNE.CUT_BOOST_COOLDOWN;
        boost = true;
      }
    }
    // A slower target that is being run down is a legitimate boost case.
    // Without it a near-peer chase can take ten seconds and let the target
    // leave the area, which is the opposite of an aggressive hunting style.
    if (!boost && target && state.settings.boostEscape && mode === 'chase' &&
        now > state.chaseBoostCooldownUntil && target.d > 140 && target.d < 680 &&
        target.speed < baseSpeed * 0.98 && num(me.sct, 0) >= 16 &&
        best.minClear > 24 && best.minWall > 120) {
      var chaseTo = Math.atan2(target.y - me.yy, target.x - me.xx);
      if (Math.cos(angleDiff(best.heading, chaseTo)) > 0.15) {
        state.boostUntil = now + TUNE.CHASE_BOOST_MS;
        state.chaseBoostCooldownUntil = now + TUNE.CHASE_BOOST_MS + TUNE.CHASE_BOOST_COOLDOWN;
        boost = true;
      }
    }
    // Equal-speed snakes are the common live case. Without a committed
    // boost the trainer can follow one for thirty seconds while it grows,
    // which is not hunting. Close the gap, get ahead, then let the target
    // run into the body we have already placed across its path.
    if (!boost && target && state.settings.boostEscape && mode !== 'escape' &&
        now > state.huntBoostCooldownUntil &&
        (mode === 'cut' || mode === 'chase' || mode === 'coil' || mode === 'hunt') &&
        target.d > 110 && target.d < TUNE.HUNT_MAX_DIST * 1.15 &&
        target.speed < baseSpeed * 1.06 &&
        target.sct <= num(me.sct, 0) * TUNE.HUNT_BOOST_RATIO &&
        num(me.sct, 0) >= 8 &&
        // The target's own body is part of minClear. A fixed 26-unit gate
        // therefore disables the boost exactly when the prey is close enough
        // to catch, leaving the trainer to follow at equal speed forever.
        best.minClear > TUNE.DANGER_CLEAR - 2 && best.minWall > 120) {
      var huntFromT = Math.atan2(me.yy - target.y, me.xx - target.x);
      var huntLat = Math.abs(Math.sin(angleDiff(huntFromT, target.ang))) * target.d;
      var huntTo = Math.atan2(target.y - me.yy, target.x - me.xx);
      var huntAlign = Math.cos(angleDiff(best.heading, huntTo));
      // Directly behind a close, equal-speed snake, boosting straight at it
      // only pushes our head into its tail. A slower target is still safe to
      // run down. Against an equal-speed kiter, boost only when the planned
      // line is visibly off the tail and there is enough clearance to pass.
      var tailRisk = huntLat < 45 && target.d < 300 &&
        target.speed > baseSpeed * 0.95;
      var flankBoost = !tailRisk ||
        (huntAlign < 0.97 && target.d > 190 && best.minClear > TUNE.DANGER_CLEAR);
      if (flankBoost && huntAlign > -0.6 &&
          (target.d > 260 || huntLat > 70 || huntAlign < 0.86)) {
        state.boostUntil = now + TUNE.HUNT_BOOST_MS;
        state.huntBoostCooldownUntil = now + TUNE.HUNT_BOOST_MS + TUNE.HUNT_BOOST_COOLDOWN;
        boost = true;
      }
    }

    return {
      heading: best.heading,
      minClear: best.minClear,
      minWall: best.minWall,
      foodScore: best.foodScore,
      huntScore: best.huntScore,
      mode: mode,
      boost: boost,
      threatCount: threats.heads.length,
      target: target,
      danger: modeDanger,
      path: best.path
    };
  }

