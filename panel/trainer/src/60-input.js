  // ---- input shield ----------------------------------------------------
  var GAME_HANDLER_KEYS = ['onmousemove', 'onmousedown', 'ontouchstart', 'ontouchmove', 'ontouchend'];
  var savedHandlers = null;
  var stubHandlers = null;
  var BLOCK_EVENTS = ['mousemove', 'mousedown', 'mouseup', 'pointermove', 'pointerdown',
    'pointerup', 'touchstart', 'touchmove', 'touchend', 'click', 'contextmenu', 'wheel'];
  var BLOCK_KEYS = {
    Space: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Enter: 1
  };

  function isPanelEvent(e) {
    if (!host) return false;
    var t = e.target;
    if (t && (t === host || (host.contains && host.contains(t)))) return true;
    if (typeof e.composedPath === 'function') {
      var path = e.composedPath();
      for (var i = 0; i < path.length; i++) {
        if (path[i] === host) return true;
      }
    }
    return false;
  }

  function silenceGameInput() {
    if (savedHandlers) return;
    savedHandlers = {};
    stubHandlers = {};
    for (var i = 0; i < GAME_HANDLER_KEYS.length; i++) {
      var key = GAME_HANDLER_KEYS[i];
      savedHandlers[key] = window[key];
      /* eslint-disable no-loop-func */
      var stub = function (e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      };
      /* eslint-enable no-loop-func */
      stubHandlers[key] = stub;
      try {
        window[key] = stub;
      } catch (e) {}
    }
  }

  function restoreGameInput() {
    if (!savedHandlers) return;
    for (var i = 0; i < GAME_HANDLER_KEYS.length; i++) {
      var key = GAME_HANDLER_KEYS[i];
      try {
        // Only restore if the page has not replaced our stub in the meantime.
        if (window[key] === stubHandlers[key]) window[key] = savedHandlers[key];
      } catch (e) {}
    }
    savedHandlers = null;
    stubHandlers = null;
  }

  function onShieldEvent(e) {
    // Idle input belongs to the player, except while the panel is being
    // dragged: moving the panel must not also steer the snake.
    if (!state.takeover && !drag) return;
    if (isPanelEvent(e)) return;
    // Dragging tracks the pointer outside the panel. Let only the pointer
    // events that drive the drag through; game mouse/touch input stays blocked.
    if (drag && (e.type === 'pointermove' || e.type === 'pointerup' || e.type === 'pointercancel')) return;
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
  }

  function onShieldKey(e) {
    if (!state.takeover) return;
    if (isPanelEvent(e)) return;
    if (BLOCK_KEYS[e.code] || BLOCK_KEYS[e.key]) {
      if (e.cancelable) e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function installInputShield() {
    var opts = { capture: true, passive: false };
    for (var i = 0; i < BLOCK_EVENTS.length; i++) {
      window.addEventListener(BLOCK_EVENTS[i], onShieldEvent, opts);
    }
    window.addEventListener('keydown', onShieldKey, true);
    window.addEventListener('keyup', onShieldKey, true);
  }

  function installPanelShield() {
    var stop = function (e) { e.stopPropagation(); };
    var types = ['mousemove', 'pointermove', 'touchmove',
      'mousedown', 'mouseup', 'pointerdown', 'pointerup',
      'touchstart', 'touchend', 'click', 'contextmenu', 'wheel'];
    for (var i = 0; i < types.length; i++) {
      host.addEventListener(types[i], stop, { passive: false });
    }
  }

  function installHotkeys() {
    window.addEventListener('keydown', function (e) {
      if (!e.altKey || e.repeat) return;
      if (e.code === 'KeyB') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setHidden(!state.hidden);
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleTakeover();
      } else if (e.code === 'KeyX' && e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        stopTakeover(false, 'hotkey release');
      }
    }, true);
  }

  // ---- takeover --------------------------------------------------------
  function resetHuntState(full) {
    state.huntTargetId = null;
    state.huntTarget = null;
    state.huntUntil = 0;
    state.huntCooldownId = null;
    state.huntCooldownUntil = 0;
    state.cutBoostCooldownUntil = 0;
    state.chaseBoostCooldownUntil = 0;
    state.huntBoostCooldownUntil = 0;
    state.chaseUntil = 0;
    state.escapeHeading = null;
    state.escapeThreatId = null;
    state.escapeUntil = 0;
    state.bodyCautionUntil = 0;
    state.migrateHeading = null;
    state.migrateUntil = 0;
    if (full) {
      state.kills = 0;
      state.corpse = null;
      state.deadIds = {};
      state.danger = 0;
      state.nearest = null;
    }
  }

  function beginTakeover(source) {
    var me = liveSelf();
    if (!me) {
      armTakeover();
      return false;
    }
    if (state.takeover) return true;
    state.takeover = true;
    state.armed = true;
    state.sessionId = num(me.id, state.sessionId);
    state.missingSince = 0;
    state.heading = num(me.ang, 0);
    state.boost = false;
    state.boostUntil = 0;
    state.boostCooldownUntil = 0;
    resetHuntState(false);
    state.mode = 'cruise';
    state.clearance = null;
    silenceGameInput();
    applySteering(state.heading, false);
    sampleSnapshot(me, performance.now());
    state.lastUiAt = 0;
    updateUi(performance.now());
    console.info('[trainer] takeover active on run', me.id, source ? '(' + source + ')' : '');
    return true;
  }

  function armTakeover() {
    if (state.takeover) return;
    state.armed = true;
    state.mode = 'idle';
    state.boost = false;
    state.boostUntil = 0;
    state.boostCooldownUntil = 0;
    resetHuntState(false);
    releaseSteering();
    state.lastUiAt = 0;
    updateUi(performance.now());
    console.info('[trainer] armed; start or resume a run yourself');
  }

  function stopTakeover(keepArmed, reason) {
    var was = state.takeover;
    state.takeover = false;
    state.armed = !!keepArmed;
    state.missingSince = 0;
    state.boost = false;
    state.boostUntil = 0;
    state.boostCooldownUntil = 0;
    resetHuntState(false);
    state.mode = 'idle';
    state.clearance = null;
    // Only touch the game's steering if this call actually ends control.
    // Otherwise the emergency-release hotkey would yank an idle player's
    // snake toward its current heading.
    if (was) releaseSteering();
    restoreGameInput();
    state.lastUiAt = 0;
    updateUi(performance.now());
    if (was) console.info('[trainer] released:', reason || 'released');
  }

  function toggleTakeover() {
    if (state.takeover || state.armed) {
      stopTakeover(false, 'toggle');
    } else if (liveSelf()) {
      beginTakeover('toggle');
    } else {
      armTakeover();
    }
  }

