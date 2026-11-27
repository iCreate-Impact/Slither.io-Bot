  // ---- panel UI --------------------------------------------------------
  var host = null;
  var shadow = null;
  var els = {};
  var drag = null;

  function buildPanel() {
    host = document.createElement('div');
    host.id = 'slither-trainer-host';
    host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;pointer-events:none;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = [
      '<style>',
      ':host{color-scheme:dark;}',
      '[hidden]{display:none !important;}',
      '*{box-sizing:border-box;}',
      '.panel{width:318px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);display:flex;flex-direction:column;',
      'background:linear-gradient(180deg,rgba(17,26,36,.97),rgba(9,14,20,.97));',
      'border:1px solid #24384c;border-radius:12px;',
      'box-shadow:0 20px 50px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.04);',
      'color:#dbe7f3;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
      'overflow:hidden;pointer-events:auto;user-select:none;}',
      '.hdr{display:flex;align-items:center;gap:8px;padding:10px 10px 9px;border-bottom:1px solid #1e2e3e;',
      'cursor:grab;touch-action:none;background:rgba(255,255,255,.015);}',
      '.hdr:active{cursor:grabbing;}',
      '.dot{width:8px;height:8px;border-radius:50%;background:#64748b;box-shadow:0 0 0 3px rgba(100,116,139,.12);flex:none;}',
      '.dot[data-kind="active"]{background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.16);}',
      '.dot[data-kind="armed"]{background:#fbbf24;box-shadow:0 0 0 3px rgba(251,191,36,.16);}',
      '.dot[data-kind="dead"]{background:#fb7185;box-shadow:0 0 0 3px rgba(251,113,133,.16);}',
      '.title{font-size:11px;letter-spacing:.14em;font-weight:700;color:#e6f1fb;white-space:nowrap;}',
      '.title b{color:#5eead4;}',
      '.ver{margin-left:auto;color:#53677c;font-size:10px;}',
      '.icon{width:20px;height:20px;border:1px solid #26384a;border-radius:5px;background:#101a24;',
      'color:#9fb3c8;cursor:pointer;font:12px/1 ui-monospace,monospace;padding:0;flex:none;}',
      '.icon:hover{color:#fff;border-color:#3a5570;}',
      '.body{padding:10px;overflow:auto;}',
      '.statusrow{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:9px;}',
      '.status{font-size:11px;color:#a9bdd1;min-width:0;}',
      '.status[data-kind="active"]{color:#a7f3d0;}',
      '.status[data-kind="armed"]{color:#fde68a;}',
      '.status[data-kind="dead"]{color:#fecdd3;}',
      '.pill{font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:999px;',
      'border:1px solid #2b4257;color:#8fa6bb;background:#0c151e;white-space:nowrap;}',
      '.pill[data-mode="escape"]{color:#fecdd3;border-color:#7f1d2d;background:#2a0d13;}',
      '.pill[data-mode="danger"]{color:#fed7aa;border-color:#7c4a1d;background:#2a1a0d;}',
      '.pill[data-mode="avoid"]{color:#fde68a;border-color:#66511d;background:#211c0d;}',
      '.pill[data-mode="farm"]{color:#bbf7d0;border-color:#1d5f3a;background:#0c2118;}',
      '.pill[data-mode="feast"]{color:#fde68a;border-color:#7c5a16;background:#251d08;}',
      '.pill[data-mode="hunt"]{color:#fecdd3;border-color:#7f1d2d;background:#2a0d13;}',
      '.pill[data-mode="coil"]{color:#fbcfe8;border-color:#7e2b5a;background:#280d1d;}',
      '.pill[data-mode="cut"]{color:#fed7aa;border-color:#9a3412;background:#2a130b;}',
      '.pill[data-mode="bait"]{color:#fbcfe8;border-color:#7e2b5a;background:#280d1d;}',
      '.pill[data-mode="explore"]{color:#a5f3fc;border-color:#155e75;background:#08212b;}',
      '.pill[data-mode="cruise"]{color:#bae6fd;border-color:#1d4f6b;background:#0c1c26;}',
      '.targetline{margin:-3px 0 8px;min-height:12px;color:#71889d;font-size:9px;letter-spacing:.02em;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.targetline[data-kind="hunt"]{color:#fda4af;}',
      '.targetline[data-kind="feast"]{color:#fde68a;}',
      '.mapline{margin:-4px 0 8px;min-height:11px;color:#67e8f9;font-size:9px;',
      'letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:9px;}',
      '.stat{background:#0b131c;border:1px solid #1c2c3b;border-radius:7px;padding:5px 6px;min-width:0;}',
      '.stat b{display:block;font-size:14px;color:#e8f3ff;font-weight:600;overflow:hidden;text-overflow:ellipsis;}',
      '.stat span{display:block;font-size:9px;color:#6f859b;letter-spacing:.06em;text-transform:uppercase;}',
      '.radarwrap{position:relative;width:190px;height:190px;margin:0 auto 9px;border:1px solid #1c2c3b;',
      'border-radius:8px;overflow:hidden;background:#081018;}',
      '.radar{display:block;width:190px;height:190px;}',
      '.radarlabel{position:absolute;right:6px;bottom:4px;font-size:8px;color:#4d657a;letter-spacing:.06em;}',
      '.actions{display:flex;gap:6px;margin-bottom:8px;}',
      'button{font:inherit;}',
      '.btn{flex:1;padding:7px 8px;border-radius:7px;border:1px solid #2a4055;background:#101b26;',
      'color:#c9dcee;cursor:pointer;}',
      '.btn:hover:not(:disabled){border-color:#3d5c78;color:#fff;}',
      '.btn:disabled{opacity:.45;cursor:default;}',
      '.btn.primary{border-color:#1c7f72;background:linear-gradient(180deg,#0f766e,#0b5f59);',
      'color:#eafffb;font-weight:700;}',
      '.btn.primary:hover:not(:disabled){border-color:#2dd4bf;}',
      '.btn.ghost{flex:0 0 92px;}',
      '.check{display:flex;align-items:center;gap:6px;color:#93a9be;font-size:11px;margin:5px 0;cursor:pointer;}',
      '.check input{accent-color:#14b8a6;}',
      '.slider{display:grid;grid-template-columns:52px 1fr 28px;align-items:center;gap:6px;',
      'color:#93a9be;font-size:10px;margin:6px 0;}',
      '.slider input{width:100%;accent-color:#14b8a6;}',
      '.slider output{text-align:right;color:#cfe2f2;}',
      '.hint{margin-top:8px;padding-top:7px;border-top:1px solid #1b2a38;color:#5e7388;font-size:9px;line-height:1.7;}',
      '.hint kbd{display:inline-block;padding:0 3px;border:1px solid #2b4055;border-radius:3px;',
      'background:#0b141d;color:#8fa6bb;font:9px ui-monospace,monospace;}',
      '.note{margin-top:5px;color:#4f657a;font-size:9px;}',
      '.tab{position:fixed;top:16px;right:16px;width:38px;height:38px;border-radius:50%;',
      'border:1px solid #2dd4bf;background:#0b1a1a;color:#5eead4;font:700 15px ui-monospace,monospace;',
      'cursor:pointer;pointer-events:auto;box-shadow:0 8px 24px rgba(0,0,0,.5);}',
      '.tab:hover{background:#0f2a28;}',
      '</style>',
      '<div class="panel" id="panel">',
      '  <div class="hdr" id="hdr">',
      '    <span class="dot" id="dot" data-kind="idle"></span>',
      '    <span class="title">SLITHER <b>TRAINER</b></span>',
      '    <span class="ver">v' + VERSION + '</span>',
      '    <button type="button" class="icon" id="minBtn" title="Minimize">\u2013</button>',
      '    <button type="button" class="icon" id="hideBtn" title="Hide (Alt+B)">\u00d7</button>',
      '  </div>',
      '  <div class="body" id="body">',
      '    <div class="statusrow">',
      '      <span class="status" id="status" data-kind="idle">Waiting for a run</span>',
      '      <span class="pill" id="mode" data-mode="idle">idle</span>',
      '    </div>',
      '    <div class="stats">',
      '      <div class="stat"><b id="len">\u2013</b><span>length</span></div>',
      '      <div class="stat"><b id="score">\u2013</b><span>score</span></div>',
      '      <div class="stat"><b id="rank">\u2013</b><span>rank</span></div>',
      '      <div class="stat"><b id="near">\u2013</b><span>nearby</span></div>',
      '      <div class="stat"><b id="fps">\u2013</b><span>fps</span></div>',
      '      <div class="stat"><b id="clr">\u2013</b><span>clearance</span></div>',
      '    </div>',
      '    <div class="targetline" id="targetline">No hunt target</div>',
      '    <div class="mapline" id="mapline">Map \u2013</div>',
      '    <div class="radarwrap">',
      '      <canvas class="radar" id="radar" width="220" height="220"></canvas>',
      '      <span class="radarlabel" id="radarlabel">2,400 unit radar</span>',
      '    </div>',
      '    <div class="actions">',
      '      <button type="button" class="btn primary" id="takeBtn">Take over</button>',
      '      <button type="button" class="btn ghost" id="releaseBtn" disabled>Release</button>',
      '    </div>',
      '    <label class="check"><input type="checkbox" id="autoArm"> Re-arm after death</label>',
      '    <label class="check"><input type="checkbox" id="hunt"> Hunt snakes</label>',
      '    <div class="slider"><span>Safety</span><input type="range" id="safety" min="4" max="40" step="1"><output id="safetyOut">18</output></div>',
      '    <div class="slider"><span>Food pull</span><input type="range" id="foodPull" min="0" max="2" step="0.1"><output id="foodPullOut">1.2</output></div>',
      '    <div class="slider"><span>Explore</span><input type="range" id="explore" min="0" max="1" step="0.1"><output id="exploreOut">0.6</output></div>',
      '    <div class="slider"><span>Aggro</span><input type="range" id="aggression" min="0" max="2" step="0.1"><output id="aggressionOut">1.0</output></div>',
      '    <div class="slider"><span>Radar</span><input type="range" id="radarRange" min="800" max="2400" step="100"><output id="radarRangeOut">2400</output></div>',
      '    <label class="check"><input type="checkbox" id="boostEscape"> Allow gated boost</label>',
      '    <div class="hint"><kbd>Alt</kbd>+<kbd>B</kbd> panel &middot; <kbd>Alt</kbd>+<kbd>T</kbd> takeover<br><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> release</div>',
      '    <div class="note">Starts nothing. Takes over the snake you already spawned.</div>',
      '  </div>',
      '</div>',
      '<button type="button" class="tab" id="tab" hidden title="Show trainer (Alt+B)">T</button>'
    ].join('\n');

    document.documentElement.appendChild(host);

    els.panel = shadow.getElementById('panel');
    els.hdr = shadow.getElementById('hdr');
    els.dot = shadow.getElementById('dot');
    els.status = shadow.getElementById('status');
    els.mode = shadow.getElementById('mode');
    els.len = shadow.getElementById('len');
    els.score = shadow.getElementById('score');
    els.rank = shadow.getElementById('rank');
    els.near = shadow.getElementById('near');
    els.fps = shadow.getElementById('fps');
    els.clr = shadow.getElementById('clr');
    els.radar = shadow.getElementById('radar');
    els.radarlabel = shadow.getElementById('radarlabel');
    els.targetline = shadow.getElementById('targetline');
    els.mapline = shadow.getElementById('mapline');
    els.body = shadow.getElementById('body');
    els.minBtn = shadow.getElementById('minBtn');
    els.hideBtn = shadow.getElementById('hideBtn');
    els.tab = shadow.getElementById('tab');
    els.takeBtn = shadow.getElementById('takeBtn');
    els.releaseBtn = shadow.getElementById('releaseBtn');
    els.autoArm = shadow.getElementById('autoArm');
    els.safety = shadow.getElementById('safety');
    els.safetyOut = shadow.getElementById('safetyOut');
    els.foodPull = shadow.getElementById('foodPull');
    els.foodPullOut = shadow.getElementById('foodPullOut');
    els.explore = shadow.getElementById('explore');
    els.exploreOut = shadow.getElementById('exploreOut');
    els.boostEscape = shadow.getElementById('boostEscape');
    els.hunt = shadow.getElementById('hunt');
    els.aggression = shadow.getElementById('aggression');
    els.aggressionOut = shadow.getElementById('aggressionOut');
    els.radarRange = shadow.getElementById('radarRange');
    els.radarRangeOut = shadow.getElementById('radarRangeOut');

    els.safety.value = state.settings.safety;
    els.safetyOut.textContent = state.settings.safety;
    els.foodPull.value = state.settings.foodPull;
    els.foodPullOut.textContent = Number(state.settings.foodPull).toFixed(1);
    els.explore.value = state.settings.explore;
    els.exploreOut.textContent = Number(state.settings.explore).toFixed(1);
    els.hunt.checked = !!state.settings.hunt;
    els.aggression.value = state.settings.aggression;
    els.aggressionOut.textContent = Number(state.settings.aggression).toFixed(1);
    els.radarRange.value = state.settings.radarRange;
    els.radarRangeOut.textContent = Math.round(state.settings.radarRange);
    els.boostEscape.checked = !!state.settings.boostEscape;
    els.autoArm.checked = !!state.settings.autoArm;

    applySavedPosition();
  }

  function applySavedPosition() {
    var s = state.settings;
    if (s.x === null || s.y === null) return;
    var r = host.getBoundingClientRect();
    var x = clamp(s.x, 4, Math.max(4, window.innerWidth - r.width - 4));
    var y = clamp(s.y, 4, Math.max(4, window.innerHeight - r.height - 4));
    host.style.left = x + 'px';
    host.style.top = y + 'px';
    host.style.right = 'auto';
  }

  function setMinimized(v) {
    state.minimized = !!v;
    if (!els.body) return;
    els.body.hidden = state.minimized;
    els.minBtn.textContent = state.minimized ? '+' : '\u2013';
    els.minBtn.title = state.minimized ? 'Expand' : 'Minimize';
  }

  function setHidden(v) {
    state.hidden = !!v;
    if (!els.panel) return;
    els.panel.hidden = state.hidden;
    els.tab.hidden = !state.hidden;
  }

  function onDragStart(e) {
    if (e.button !== undefined && e.button !== 0) return;
    var target = e.target;
    if (target && target.closest && target.closest('button')) return;
    var r = host.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    host.style.left = r.left + 'px';
    host.style.top = r.top + 'px';
    host.style.right = 'auto';
    e.preventDefault();
    e.stopPropagation();
    window.addEventListener('pointermove', onDragMove, true);
    window.addEventListener('pointerup', onDragEnd, true);
    window.addEventListener('pointercancel', onDragEnd, true);
  }

  function onDragMove(e) {
    if (!drag) return;
    var r = host.getBoundingClientRect();
    var x = clamp(e.clientX - drag.dx, 4, Math.max(4, window.innerWidth - r.width - 4));
    var y = clamp(e.clientY - drag.dy, 4, Math.max(4, window.innerHeight - r.height - 4));
    host.style.left = x + 'px';
    host.style.top = y + 'px';
    e.preventDefault();
    e.stopPropagation();
  }

  function onDragEnd(e) {
    if (!drag) return;
    drag = null;
    window.removeEventListener('pointermove', onDragMove, true);
    window.removeEventListener('pointerup', onDragEnd, true);
    window.removeEventListener('pointercancel', onDragEnd, true);
    state.settings.x = parseFloat(host.style.left);
    state.settings.y = parseFloat(host.style.top);
    if (!isFinite(state.settings.x)) state.settings.x = null;
    if (!isFinite(state.settings.y)) state.settings.y = null;
    saveSettings();
    e.preventDefault();
    e.stopPropagation();
  }

  function bindUi() {
    els.minBtn.addEventListener('click', function () { setMinimized(!state.minimized); });
    els.hideBtn.addEventListener('click', function () { setHidden(true); });
    els.tab.addEventListener('click', function () { setHidden(false); });
    els.takeBtn.addEventListener('click', function () {
      if (state.takeover || state.armed) return;
      if (liveSelf()) beginTakeover('panel');
      else armTakeover();
    });
    els.releaseBtn.addEventListener('click', function () {
      stopTakeover(false, 'panel release');
    });
    els.autoArm.addEventListener('change', function () {
      state.settings.autoArm = !!els.autoArm.checked;
      saveSettings();
    });
    els.hunt.addEventListener('change', function () {
      state.settings.hunt = !!els.hunt.checked;
      if (!state.settings.hunt) {
        state.huntTarget = null;
        state.huntTargetId = null;
      }
      saveSettings();
    });
    els.boostEscape.addEventListener('change', function () {
      state.settings.boostEscape = !!els.boostEscape.checked;
      saveSettings();
    });
    els.safety.addEventListener('input', function () {
      state.settings.safety = clamp(num(els.safety.value, 18), 4, 40);
      els.safetyOut.textContent = state.settings.safety;
    });
    els.safety.addEventListener('change', saveSettings);
    els.foodPull.addEventListener('input', function () {
      state.settings.foodPull = clamp(num(els.foodPull.value, 1), 0, 2);
      els.foodPullOut.textContent = Number(state.settings.foodPull).toFixed(1);
    });
    els.foodPull.addEventListener('change', saveSettings);
    els.explore.addEventListener('input', function () {
      state.settings.explore = clamp(num(els.explore.value, DEFAULT_SETTINGS.explore), 0, 1);
      els.exploreOut.textContent = Number(state.settings.explore).toFixed(1);
    });
    els.explore.addEventListener('change', saveSettings);
    els.aggression.addEventListener('input', function () {
      state.settings.aggression = clamp(num(els.aggression.value, 1), 0, 2);
      els.aggressionOut.textContent = Number(state.settings.aggression).toFixed(1);
    });
    els.aggression.addEventListener('change', saveSettings);
    els.radarRange.addEventListener('input', function () {
      state.settings.radarRange = clamp(num(els.radarRange.value, TUNE.RADAR_RANGE), 800, TUNE.THREAT_RANGE);
      els.radarRangeOut.textContent = Math.round(state.settings.radarRange);
      drawRadar();
    });
    els.radarRange.addEventListener('change', saveSettings);
    els.hdr.addEventListener('pointerdown', onDragStart);

    window.addEventListener('resize', function () {
      if (!host.style.left) return;
      var r = host.getBoundingClientRect();
      host.style.left = clamp(parseFloat(host.style.left) || 4, 4, Math.max(4, window.innerWidth - r.width - 4)) + 'px';
      host.style.top = clamp(parseFloat(host.style.top) || 4, 4, Math.max(4, window.innerHeight - r.height - 4)) + 'px';
    });
  }

  function updateUi(now) {
    if (!els.status || now - state.lastUiAt < 100) return;
    state.lastUiAt = now;

    var me = liveSelf();
    var text = 'Waiting for a run \u2014 start it yourself';
    var kind = 'idle';

    if (state.takeover && me) {
      text = 'Takeover active \u00b7 run #' + me.id;
      kind = 'active';
    } else if (state.armed) {
      text = me ? 'Armed \u2014 starting takeover' : 'Armed \u2014 start a run yourself';
      kind = 'armed';
    } else if (me) {
      text = 'Run live \u00b7 trainer idle';
    } else if (state.sessionId !== null) {
      text = 'Run ended \u00b7 trainer idle';
      kind = 'dead';
    }

    els.status.textContent = text;
    els.status.dataset.kind = kind;
    els.dot.dataset.kind = kind;
    els.mode.textContent = me ? state.mode : 'idle';
    els.mode.dataset.mode = me ? state.mode : 'idle';

    els.len.textContent = me ? fmt(num(me.sct, 0)) : '\u2013';
    var score = me ? displayScore(me) : null;
    els.score.textContent = score === null ? '\u2013' : fmt(score);
    els.rank.textContent = me ? fmt(num(window.rank, 0)) : '\u2013';
    els.near.textContent = me ? fmt(state.threats) : '\u2013';
    els.fps.textContent = fmt(state.fps);
    els.clr.textContent = (me && state.clearance !== null && state.clearance < 900) ? fmt(state.clearance) : '\u2013';

    var tline = 'Kills ' + state.kills + ' \u00b7 no hunt target';
    var tkind = '';
    if (state.takeover && me && state.huntTarget) {
      tline = 'TARGET #' + state.huntTarget.id + ' \u00b7 len ' +
        fmt(state.huntTarget.sct) + ' \u00b7 ' + fmt(state.huntTarget.d) +
        'u \u00b7 kills ' + state.kills;
      tkind = 'hunt';
    } else if (state.takeover && me && state.corpse && now < state.corpse.until) {
      var cd = Math.sqrt(dist2(me.xx, me.yy, state.corpse.x, state.corpse.y));
      tline = 'Feast site \u00b7 ' + fmt(cd) + 'u \u00b7 kills ' + state.kills;
      tkind = 'feast';
    } else if (!state.takeover) {
      tline = 'Trainer idle \u00b7 takes over the run you start';
    }
    els.targetline.textContent = tline;
    els.targetline.dataset.kind = tkind;

    var mline = 'Map \u2013';
    if (me && state.mapCells > 0) {
      var pct = state.coverage * 100;
      mline = 'Map ' + (pct >= 10 ? Math.round(pct) : pct.toFixed(1)) +
        '% \u00b7 ' + state.mapVisited + '/' + state.mapCells + ' cells';
      if (state.mapTarget) {
        var md = Math.sqrt(dist2(me.xx, me.yy, state.mapTarget.x, state.mapTarget.y));
        mline += ' \u00b7 frontier ' + fmt(md) + 'u';
      }
    }
    els.mapline.textContent = mline;

    if (state.takeover) {
      els.takeBtn.disabled = true;
      els.takeBtn.textContent = 'Takeover active';
    } else if (state.armed) {
      els.takeBtn.disabled = true;
      els.takeBtn.textContent = 'Armed for next run';
    } else {
      els.takeBtn.disabled = false;
      els.takeBtn.textContent = me ? 'Take over now' : 'Arm for next run';
    }
    els.releaseBtn.disabled = !(state.takeover || state.armed);

    els.autoArm.checked = !!state.settings.autoArm;
    els.hunt.checked = !!state.settings.hunt;
    els.boostEscape.checked = !!state.settings.boostEscape;
    var active = shadow.activeElement;
    if (active !== els.safety) {
      els.safety.value = state.settings.safety;
      els.safetyOut.textContent = state.settings.safety;
    }
    if (active !== els.foodPull) {
      els.foodPull.value = state.settings.foodPull;
      els.foodPullOut.textContent = Number(state.settings.foodPull).toFixed(1);
    }
    if (active !== els.explore) {
      els.explore.value = state.settings.explore;
      els.exploreOut.textContent = Number(state.settings.explore).toFixed(1);
    }
    if (active !== els.aggression) {
      els.aggression.value = state.settings.aggression;
      els.aggressionOut.textContent = Number(state.settings.aggression).toFixed(1);
    }
    if (active !== els.radarRange) {
      els.radarRange.value = state.settings.radarRange;
      els.radarRangeOut.textContent = Math.round(state.settings.radarRange);
    }

    drawRadar();
  }

  function drawRadar() {
    var canvas = els.radar;
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var w = canvas.width;
    var h = canvas.height;
    var cx = w / 2;
    var cy = h / 2;
    var range = clamp(num(state.settings.radarRange, TUNE.RADAR_RANGE), 800, TUNE.THREAT_RANGE);
    var scale = (Math.min(w, h) / 2 - 10) / range;
    if (els.radarlabel) {
      var rangeText = String(Math.round(range)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      els.radarlabel.textContent = rangeText + ' unit radar';
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#081018';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(94,234,212,.12)';
    ctx.lineWidth = 1;
    for (var i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (Math.min(w, h) / 2 - 10) * i / 3, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(94,234,212,.08)';
    ctx.beginPath();
    ctx.moveTo(cx, 8);
    ctx.lineTo(cx, h - 8);
    ctx.moveTo(8, cy);
    ctx.lineTo(w - 8, cy);
    ctx.stroke();

    var snap = state.snapshot;
    if (!snap) {
      ctx.fillStyle = '#3f566b';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('no live run', cx, cy + 3);
      return;
    }

    // Arena boundary (usually far outside the radar; canvas clips it).
    var ax = cx + (snap.arena.cx - snap.me.x) * scale;
    var ay = cy + (snap.arena.cy - snap.me.y) * scale;
    ctx.strokeStyle = 'rgba(251,191,36,.35)';
    ctx.beginPath();
    ctx.arc(ax, ay, snap.arena.r * scale, 0, TAU);
    ctx.stroke();

    // Our own body, so a coil or a tight turn is visible.
    ctx.fillStyle = 'rgba(45,212,191,.45)';
    for (var sb = 0; sb < snap.selfBody.length; sb++) {
      var sbp = snap.selfBody[sb];
      var sbx = cx + (sbp.x - snap.me.x) * scale;
      var sby = cy + (sbp.y - snap.me.y) * scale;
      if (sbx < -4 || sby < -4 || sbx > w + 4 || sby > h + 4) continue;
      ctx.fillRect(sbx - 1, sby - 1, 2, 2);
    }

    // Food. Corpse pellets are amber and much easier to spot.
    for (var f = 0; f < snap.foods.length; f++) {
      var food = snap.foods[f];
      var fx = cx + (food.x - snap.me.x) * scale;
      var fy = cy + (food.y - snap.me.y) * scale;
      if (fx < -4 || fy < -4 || fx > w + 4 || fy > h + 4) continue;
      ctx.fillStyle = food.corpse ? 'rgba(251,191,36,.95)' : 'rgba(74,222,128,.72)';
      var fr = 1.1 + Math.min(2.8, food.sz * 0.16);
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, TAU);
      ctx.fill();
    }

    // Enemy bodies. The target's body is highlighted so the player can see
    // which snake the trainer is trying to trap.
    for (var t = 0; t < snap.threats.length; t++) {
      var th = snap.threats[t];
      if (th.head) continue;
      var tx = cx + (th.x - snap.me.x) * scale;
      var ty = cy + (th.y - snap.me.y) * scale;
      if (tx < -10 || ty < -10 || tx > w + 10 || ty > h + 10) continue;
      ctx.fillStyle = th.hunt ? 'rgba(251,113,133,.72)' : 'rgba(251,146,60,.55)';
      ctx.fillRect(tx - 1, ty - 1, 2, 2);
    }

    // Planned rollout path.
    if (snap.path && snap.path.length >= 4) {
      ctx.strokeStyle = 'rgba(94,234,212,.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (var p = 0; p + 1 < snap.path.length; p += 2) {
        var px = cx + (snap.path[p] - snap.me.x) * scale;
        var py = cy + (snap.path[p + 1] - snap.me.y) * scale;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      var lastX = snap.path[snap.path.length - 2];
      var lastY = snap.path[snap.path.length - 1];
      ctx.fillStyle = 'rgba(94,234,212,.85)';
      ctx.beginPath();
      ctx.arc(cx + (lastX - snap.me.x) * scale, cy + (lastY - snap.me.y) * scale, 1.8, 0, TAU);
      ctx.fill();
    }

    // Heads and their predicted tracks.
    for (var hd = 0; hd < snap.heads.length; hd++) {
      var head = snap.heads[hd];
      var hx = cx + (head.x - snap.me.x) * scale;
      var hy = cy + (head.y - snap.me.y) * scale;
      if (hx < -20 || hy < -20 || hx > w + 20 || hy > h + 20) continue;
      var track = Math.min(320, 24 + head.speed * 0.55);
      ctx.strokeStyle = head.boost ? 'rgba(248,113,113,.58)' : 'rgba(251,113,133,.24)';
      ctx.lineWidth = head.boost ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(head.ang) * track * scale,
        hy + Math.sin(head.ang) * track * scale);
      ctx.stroke();
      ctx.fillStyle = head.hunt ? '#fda4af' : (head.boost ? '#f87171' : '#fb7185');
      ctx.beginPath();
      ctx.arc(hx, hy, 2.4 + Math.min(2.4, head.sc * 0.7), 0, TAU);
      ctx.fill();
      if (head.boost) {
        ctx.strokeStyle = 'rgba(248,113,113,.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hx, hy, 5.5 + Math.min(2.5, head.sc * 0.5), 0, TAU);
        ctx.stroke();
      }
    }

    // Hunt target: dashed lead line plus a crosshair.
    if (snap.target) {
      var tgx = cx + (snap.target.x - snap.me.x) * scale;
      var tgy = cy + (snap.target.y - snap.me.y) * scale;
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(253,164,175,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tgx, tgy);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(tgx, tgy, 7, 0, TAU);
      ctx.moveTo(tgx - 10, tgy);
      ctx.lineTo(tgx - 4, tgy);
      ctx.moveTo(tgx + 4, tgy);
      ctx.lineTo(tgx + 10, tgy);
      ctx.moveTo(tgx, tgy - 10);
      ctx.lineTo(tgx, tgy - 4);
      ctx.moveTo(tgx, tgy + 4);
      ctx.lineTo(tgx, tgy + 10);
      ctx.stroke();
      if (snap.target.maneuver) {
        ctx.fillStyle = 'rgba(253,164,175,.85)';
        ctx.font = '8px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(snap.target.maneuver, tgx + 10, tgy - 7);
      }
    }

    // Corpse / feast site.
    if (snap.corpse) {
      var cgx = cx + (snap.corpse.x - snap.me.x) * scale;
      var cgy = cy + (snap.corpse.y - snap.me.y) * scale;
      ctx.strokeStyle = 'rgba(251,191,36,.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cgx, cgy, 6, 0, TAU);
      ctx.moveTo(cgx - 8, cgy);
      ctx.lineTo(cgx + 8, cgy);
      ctx.moveTo(cgx, cgy - 8);
      ctx.lineTo(cgx, cgy + 8);
      ctx.stroke();
    }

    // Planned heading and self marker.
    var hx2 = Math.cos(snap.heading || 0);
    var hy2 = Math.sin(snap.heading || 0);
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + hx2 * 18, cy + hy2 * 18);
    ctx.stroke();

    ctx.fillStyle = '#eafffb';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, TAU);
    ctx.stroke();
  }

