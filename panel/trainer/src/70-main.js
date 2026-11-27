  // ---- main loop -------------------------------------------------------
  function tick(now) {
    requestAnimationFrame(tick);

    state.frames++;
    if (now - state.fpsAt >= 500) {
      state.fps = Math.round((state.frames * 1000) / Math.max(1, now - state.fpsAt));
      state.frames = 0;
      state.fpsAt = now;
    }

    var me = liveSelf();
    if (me) {
      var id = num(me.id, 0);
      if (state.sessionId !== id) {
        state.sessionId = id;
        state.heading = num(me.ang, 0);
        state.boost = false;
        state.boostUntil = 0;
        state.boostCooldownUntil = 0;
        resetHuntState(true);
        state.mode = 'cruise';
        state.snapshot = null;
        if (state.armed && !state.takeover) beginTakeover('new run');
      }
      if (state.takeover) {
        controlTick(me, now);
      } else if (now - state.lastRadarAt >= 120) {
        sampleSnapshot(me, now);
      }
    } else {
      if (state.takeover) {
        // A death or disconnect ends control. It never clicks Play.
        stopTakeover(state.settings.autoArm, 'session ended');
      }
      if (state.sessionId !== null) {
        state.sessionId = null;
        state.snapshot = null;
        state.mode = 'idle';
        state.heading = 0;
        state.clearance = null;
        state.threats = 0;
        state.boost = false;
        state.boostUntil = 0;
        state.boostCooldownUntil = 0;
        state.coverage = 0;
        state.mapHeading = null;
        state.mapTarget = null;
        resetHuntState(true);
      }
    }

    updateUi(now);
  }

  // ---- boot ------------------------------------------------------------
  function boot() {
    if (!document.documentElement) {
      setTimeout(boot, 50);
      return;
    }
    buildPanel();
    bindUi();
    installInputShield();
    installPanelShield();
    installHotkeys();
    requestAnimationFrame(tick);

    window.__slitherTrainer = {
      version: VERSION,
      state: state,
      settings: state.settings,
      tune: TUNE,
      show: function () { setHidden(false); },
      hide: function () { setHidden(true); },
      arm: armTakeover,
      start: function () { return beginTakeover('api'); },
      release: function () { stopTakeover(false, 'api release'); },
      toggle: toggleTakeover,
      planner: {
        choosePlan: choosePlan,
        evaluatePath: evaluatePath,
        collectThreats: collectThreats,
        collectSelfBody: collectSelfBody,
        collectFoods: collectFoods,
        assessDanger: assessDanger,
        selectHuntTarget: selectHuntTarget,
        detectCorpse: detectCorpse,
        enrichFoodDensity: enrichFoodDensity,
        mapSample: mapSample,
        mapChooseFrontier: mapChooseFrontier,
        mapReset: mapReset,
        arenaInfo: arenaInfo
      }
    };

    console.info('[trainer] panel ready v' + VERSION +
      ' \u2014 it starts nothing; it takes over the run you already started.');
  }

  boot();
})();

