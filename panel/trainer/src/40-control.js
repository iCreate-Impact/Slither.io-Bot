  function applySteering(heading, boost) {
    // The client treats xm/ym as offsets from the centre of the viewport:
    //   window.onmousemove -> xm = clientX - ww / 2
    //   slither.eang       -> atan2(ym, xm)
    var mag = 600;
    window.xm = Math.cos(heading) * mag;
    window.ym = Math.sin(heading) * mag;
    // Current client: boost lives on the snake object.
    // Older clients / other builds: window.wmd. Set both, harmlessly.
    try {
      if (window.slither) window.slither.wmd = !!boost;
    } catch (e) {}
    window.wmd = !!boost;
  }

  function releaseSteering() {
    var me = window.slither;
    var h = me ? num(me.ang, state.heading) : state.heading;
    // Keep the requested heading so releasing does not yank the snake
    // toward atan2(0, 0). The next real mouse move overrides this.
    window.xm = Math.cos(h) * 600;
    window.ym = Math.sin(h) * 600;
    try {
      if (me) me.wmd = false;
    } catch (e) {}
    window.wmd = false;
    // Clear the client's keyboard steering flags and pending key accumulators.
    try {
      window.kd_u = false;
      window.kd_l = false;
      window.kd_r = false;
      window.kd_l_frb = 0;
      window.kd_r_frb = 0;
    } catch (e) {}
  }

  function makeSnapshot(me, arena, threats, foods, heading, plan, selfBody) {
    var heads = [];
    for (var i = 0; i < threats.heads.length; i++) {
      var h = threats.heads[i];
      heads.push({
        x: h.x, y: h.y, ang: h.ang, speed: h.speed, boost: h.boost,
        sct: h.sct, sc: h.sc, r: h.r, d: h.d, id: h.id, hunt: !!h.hunt
      });
    }
    var bodyPoints = (threats.bodyPoints || []).slice(0, 460);
    return {
      me: { x: num(me.xx, 0), y: num(me.yy, 0), ang: num(me.ang, 0) },
      arena: arena,
      heading: heading,
      path: plan && plan.path ? plan.path.slice(0, 80) : [],
      threats: bodyPoints,
      heads: heads,
      selfBody: selfBody ? selfBody.slice(0, 120) : [],
      foods: foods.slice(0, TUNE.FOOD_RADAR_POINTS),
      target: plan && plan.target ? {
        id: plan.target.id, x: plan.target.x, y: plan.target.y,
        sct: plan.target.sct, d: plan.target.d, ang: plan.target.ang,
        maneuver: plan.target.maneuver
      } : null,
      corpse: state.corpse ? { x: state.corpse.x, y: state.corpse.y } : null,
      danger: state.danger,
      kills: state.kills,
      coverage: state.coverage,
      mapVisited: state.mapVisited,
      mapCells: state.mapCells,
      mapTarget: state.mapTarget ? { x: state.mapTarget.x, y: state.mapTarget.y } : null,
      range: state.settings.radarRange
    };
  }

  function controlTick(me, now) {
    var arena = arenaInfo();
    var threats = collectThreats(me, now);
    var selfBody = collectSelfBody(me);
    var foods = collectFoods(me, Math.max(TUNE.FOOD_RANGE, state.settings.radarRange),
      TUNE.FOOD_RADAR_POINTS);
    var plan = choosePlan(me, threats, selfBody, foods, arena, now);
    if (!plan) return;

    state.heading = plan.heading;
    state.clearance = plan.minClear;
    state.threats = plan.threatCount;
    state.mode = plan.mode;
    state.boost = !!plan.boost;
    applySteering(plan.heading, state.boost);
    state.snapshot = makeSnapshot(me, arena, threats, foods, plan.heading, plan, selfBody);
    state.lastRadarAt = now;
  }

  function sampleSnapshot(me, now) {
    var arena = arenaInfo();
    var threats = collectThreats(me, now);
    threats.bodyPoints = buildBodyPoints(threats, null);
    var selfBody = collectSelfBody(me);
    var foods = collectFoods(me, Math.max(TUNE.FOOD_RANGE, state.settings.radarRange),
      TUNE.FOOD_RADAR_POINTS);
    if (state.corpse && now >= state.corpse.until) state.corpse = null;
    mapSample(me, arena, now);
    mapChooseFrontier(me, arena, now);
    var danger = assessDanger(me, threats, arena);
    state.danger = danger.level;
    state.nearest = danger.nearest;
    state.snapshot = makeSnapshot(me, arena, threats, foods, num(me.ang, 0), null, selfBody);
    state.threats = threats.heads.length;
    state.clearance = null;
    state.lastRadarAt = now;
  }

