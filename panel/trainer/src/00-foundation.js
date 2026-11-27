/* Slither.io Trainer Panel
 * ------------------------------------------------------------------
 * Injects a small control panel into an already-running slither.io tab
 * and steers the snake that is currently on screen.
 *
 * It never launches a browser, never navigates, never clicks Play and
 * never reconnects. If there is no live snake, it waits or arms for the
 * next run that the user starts manually.
 *
 * Usage: open https://slither.io, start a run, then paste this file in
 * the DevTools console (or install trainer.user.js with Tampermonkey).
 * Click "Take over". Click "Release" (or Alt+Shift+X) to give control
 * back immediately.
 *
 * The panel lives in a shadow root so the game's CSS cannot reach it.
 * While takeover is active it:
 *   - writes window.xm / window.ym (screen-centre offsets);
 *   - writes window.slither.wmd (boost) and window.wmd for older clients;
 *   - temporarily replaces the game's mouse/touch handlers;
 *   - blocks game input events outside the panel.
 * On release it restores the handlers it replaced.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  if (window.__slitherTrainer && window.__slitherTrainer.version) {
    console.info('[trainer] already installed');
    return;
  }

  var VERSION = '0.4.0';
  var STORAGE_KEY = 'slitherTrainer.settings.v1';
  var TAU = Math.PI * 2;

  // ---- planner tunables ------------------------------------------------
  // The planner is a risk-adjusted expected-value search. Survival is a hard
  // constraint; growth and kills are scored only on paths that stay clear.
  var TUNE = {
    HORIZON: 1.4,          // rollout seconds
    STEPS: 15,             // rollout samples
    CONTROL_LAG: 0.24,     // server/control delay before a new turn applies
    EMERGENCY_LAG: 0.04,   // panic turn when a head-on collision is imminent
    TURN_RATE: 4.125,      // rad/s, matches the client's base turn rate
    SPEED_MULT: 31.25,     // world units/s per sp unit
    SPEED_MIN: 120,
    BOOST_SPEED: 430,
    COARSE_N: 24,          // headings over the full circle
    FINE_N: 14,            // headings around the previous choice
    FINE_SPAN: 0.85,       // radians
    ULTRA_N: 8,            // final local refinement around the winner
    ULTRA_SPAN: 0.20,      // radians
    THREAT_RANGE: 2400,    // detect every visible snake inside this radius
    THREAT_POINTS: 64,     // local body points kept per enemy
    THREAT_TOTAL: 460,     // global body-point budget for 60 fps
    HEAD_MARGIN: 26,
    HEAD_TURN_RATE: 2.2,   // how fast an enemy is assumed to turn at us
    HEAD_PREDICT: 0.42,    // seconds of enemy-head motion used by the rollout
    HUNT_HEAD_TURN: 0.6,   // target noses are assumed to keep their line longer
    HEAD_WEIGHT: 2.2,      // clearance reward for keeping away from a nose
    ESCAPE_BIAS: 28,       // directional nudge toward the committed escape line
    SELF_SKIP: 95,         // do not treat our own neck as an obstacle
    SELF_POINTS: 120,      // local self body points kept
    BODY_HALF: 14.5,       // rendered half-width at sc = 1
    WALL_MARGIN: 360,
    WALL_HARD: 80,
    FOOD_RANGE: 1900,
    FOOD_REACH: 360,
    FOOD_POINTS: 96,
    FOOD_RADAR_POINTS: 128,
    FOOD_WEIGHT: 24,
    FOOD_LANE_WEIGHT: 12,
    FOOD_CLUSTER_RADIUS: 155,
    FOOD_CLUSTER_BONUS: 0.16,
    CORPSE_RADIUS: 360,
    CORPSE_MS: 12000,
    CORPSE_WEIGHT: 12,
    DANGER_CLEAR: 18,
    BOOST_CLEAR: 12,
    BOOST_MS: 800,
    BOOST_COOLDOWN: 350,
    HEADON_BOOST_MS: 1200,
    HEADON_BOOST_COOLDOWN: 120,
    CUT_BOOST_MS: 300,
    CUT_BOOST_COOLDOWN: 3400,
    CHASE_BOOST_MS: 280,
    CHASE_BOOST_COOLDOWN: 2600,
    HUNT_BOOST_MS: 700,
    HUNT_BOOST_COOLDOWN: 450,
    PREV_BONUS: 10,
    RADAR_RANGE: 2400,
    HUNT_MIN_LEN: 6,
    // Peer-sized prey is allowed when it is crossing or slow. A target that
    // is longer than the player is still rejected below, and head-on peers
    // still go through the close-range bailout.
    HUNT_MAX_RATIO: 1.0,
    HUNT_BOOST_RATIO: 1.0,
    TAIL_BAIT_RATIO: 1.0,
    HUNT_MIN_DIST: 75,
    HUNT_MAX_DIST: 900,
    HUNT_CROWD_RADIUS: 520,
    HUNT_MAX_CROWD: 1,
    HUNT_LOCK_MS: 4200,
    HUNT_STANDOFF: 90,
    HUNT_BONUS: 110,
    CHASE_BONUS: 260,
    HUNT_BODY_BONUS: 85,
    // Feeding is now much stronger in neutral play, so cut it harder while a
    // kill is live. The old 0.25 was tuned against weaker food attraction and
    // let a dense pellet ring pull the chase off a peer target.
    HUNT_FOOD_SCALE: 0.08,
    HUNT_CLEAR_CAP: 26,
    OPEN_BIAS: 55,
    OPEN_RANGE: 1900,
    OPEN_COMMIT_MS: 3200,
    // Strategic map/foraging layer. The planner still has the final say on
    // safety; this only gives it a gentle reason to sweep unexplored ground
    // instead of circling a farmed-out patch.
    MAP_BIAS: 34,
    MAP_CELL: 620,
    MAP_SAMPLE_MS: 180,
    MAP_FRONTIER_MS: 700,
    MAP_TARGET_DIST: 300,
    MAP_WALL_PAD: 500,
    SAFE_BONUS: 2000,
    UNSAFE_PENALTY: 2000
  };

  var DEFAULT_SETTINGS = {
    safety: 18,
    foodPull: 1.15,
    explore: 0.6,
    hunt: true,
    aggression: 1.2,
    radarRange: 2400,
    boostEscape: true,
    autoArm: true,
    x: null,
    y: null
  };

  // ---- small helpers ---------------------------------------------------
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function normAngle(a) {
    a = (a + Math.PI) % TAU;
    if (a < 0) a += TAU;
    return a - Math.PI;
  }

  function angleDiff(target, current) {
    return normAngle(target - current);
  }

  function dist2(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
  }

  function fmt(v) {
    return (v === null || v === undefined || !isFinite(v)) ? '\u2013' : String(Math.round(v));
  }

  function loadSettings() {
    var saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (e) {}
    var s = {};
    for (var k in DEFAULT_SETTINGS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, k)) {
        s[k] = (saved[k] === undefined) ? DEFAULT_SETTINGS[k] : saved[k];
      }
    }
    s.safety = clamp(num(s.safety, DEFAULT_SETTINGS.safety), 4, 40);
    s.foodPull = clamp(num(s.foodPull, DEFAULT_SETTINGS.foodPull), 0, 2);
    s.explore = clamp(num(s.explore, DEFAULT_SETTINGS.explore), 0, 1);
    s.hunt = (s.hunt === undefined) ? DEFAULT_SETTINGS.hunt : !!s.hunt;
    s.aggression = clamp(num(s.aggression, DEFAULT_SETTINGS.aggression), 0, 2);
    s.radarRange = clamp(num(s.radarRange, DEFAULT_SETTINGS.radarRange), 800, TUNE.THREAT_RANGE);
    s.boostEscape = !!s.boostEscape;
    s.autoArm = !!s.autoArm;
    s.x = (s.x === null || s.x === undefined || s.x === '') ? null : num(s.x, null);
    s.y = (s.y === null || s.y === undefined || s.y === '') ? null : num(s.y, null);
    return s;
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        safety: state.settings.safety,
        foodPull: state.settings.foodPull,
        explore: state.settings.explore,
        hunt: state.settings.hunt,
        aggression: state.settings.aggression,
        radarRange: state.settings.radarRange,
        boostEscape: state.settings.boostEscape,
        autoArm: state.settings.autoArm,
        x: state.settings.x,
        y: state.settings.y
      }));
    } catch (e) {}
  }

  // ---- state -----------------------------------------------------------
  var state = {
    settings: loadSettings(),
    takeover: false,
    armed: false,
    hidden: false,
    minimized: false,
    sessionId: null,
    mode: 'idle',
    heading: 0,
    clearance: null,
    threats: 0,
    boost: false,
    fps: 0,
    frames: 0,
    fpsAt: 0,
    lastUiAt: 0,
    lastRadarAt: 0,
    boostUntil: 0,
    boostCooldownUntil: 0,
    cutBoostCooldownUntil: 0,
    chaseBoostCooldownUntil: 0,
    huntBoostCooldownUntil: 0,
    chaseUntil: 0,
    escapeHeading: null,
    escapeThreatId: null,
    escapeUntil: 0,
    migrateHeading: null,
    migrateUntil: 0,
    danger: 0,
    nearest: null,
    huntTargetId: null,
    huntTarget: null,
    huntUntil: 0,
    huntCooldownId: null,
    huntCooldownUntil: 0,
    kills: 0,
    corpse: null,
    deadIds: {},
    coverage: 0,
    mapVisited: 0,
    mapCells: 0,
    mapHeading: null,
    mapTarget: null,
    mapSamples: 0,
    snapshot: null
  };

