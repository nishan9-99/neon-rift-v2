(function() {
  'use strict';
  const NR = window.NR = window.NR || {};
  const C = NR.CONFIG,
    U = NR.utils,
    rng = NR.rng,
    clamp = U.clamp;

  /* ---------------- shared world ---------------- */
  const W = NR.world = {
    W: 1,
    H: 1,
    S: 1,
    DPR: 1,
    t: 0,
    fps: 60,
    timeScale: 1,
    debugScale: 1,
    hitStop: 0,
    bullets: new NR.Pool(C.perf.bullets, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 4,
      life: 0,
      dmg: 10,
      pierce: 0,
      lastHit: null,
      color: C.colors.cyanHi
    })),
    particles: NR.particles.pool,
    enemies: [],
    telegraphs: [],
    pickups: [],
    stars: [],
    fragments: [],
    shake: 0,
    flash: 0,
    wave: 0,
    spawnLeft: 0,
    spawnTotal: 0,
    spawnTimer: 0,
    cleared: false,
    restTimer: 0,
    score: 0,
    kills: 0,
    runTime: 0,
    newBest: false,
    gems: new NR.Pool(C.gems.cap, () => ({})),
    enemyBullets: new NR.Pool(200, () => ({})),
    floating: new NR.Pool(24, () => ({})),
    effects: [],
    hazards: [],
    shockRings: [],
    boss: null,
    bossKills: 0,
    bossShards: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    dashKills: 0,
    waveDamaged: false,
    event: null
  };

  const hash = new NR.SpatialHash(C.world.hashCell, C.world.hashMaxRadius);
  let canvas = null,
    last = 0,
    rawLast = 0;
  let stateName = 'BOOT',
    state = null,
    pausedFrom = 'PLAYING';
  let stateTime = 0,
    introSkip = false;
  NR.levelReturn = 'PLAYING';
  const STATES = {};

  const PLAY = {
    RUN_INTRO: 1,
    PLAYING: 1,
    BOSS_INTRO: 1,
    BOSS_FIGHT: 1,
    WAVE_COMPLETE: 1,
    DYING: 1
  };
  C.meta = {
    shardWave: 4,
    shardKillDivisor: 8,
    shardLevel: 2
  };
  NR.reduced = () => {
    const s = NR.save.data.settings.reducedMotion;
    return s === 'on' || s === 'auto' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  NR.float = (x, y, text, color) => {
    if (!NR.save.data.settings.damageNumbers) return;
    const o = W.floating.spawn();
    if (o) Object.assign(o, {
      x,
      y,
      text: String(text),
      color,
      life: .8,
      max: .8
    });
  };

  function setState(name) {
    const next = STATES[name];
    if (!next) throw new Error('Unknown state ' + name);
    const prev = stateName;
    if (state && state.exit) state.exit(name);
    stateName = name;
    state = next;
    stateTime = 0;
    NR.game.state = name;
    NR.bus.emit('stateChanged', name);
    if (next.enter) next.enter(prev);
  }

  /* ---------------- sizing ---------------- */
  function resize() {
    const coarse = NR.input.touchCapable;
    W.DPR = Math.min(window.devicePixelRatio || 1, coarse ? C.world.dprMobile : C.world.dprDesktop);
    W.W = Math.max(1, window.innerWidth);
    W.H = Math.max(1, window.innerHeight);
    canvas.width = Math.round(W.W * W.DPR);
    canvas.height = Math.round(W.H * W.DPR);
    W.S = clamp(Math.min(W.W, W.H) / C.world.refH, C.world.minScale, C.world.maxScale);
    const want = Math.floor(W.W * W.H / 10500);
    while (W.stars.length < want) W.stars.push({
      u: Math.random(),
      v: Math.random(),
      r: rng.range(0.3, 1.5),
      p: rng.range(0, 6.28)
    });
    if (W.stars.length > want) W.stars.length = want;
    hash.resize(W.W, W.H);
    const p = NR.player.p;
    if (p) {
      const r = p.r * W.S;
      p.x = clamp(p.x, r, Math.max(r, W.W - r));
      p.y = clamp(p.y, r, Math.max(r, W.H - r));
    }
    NR.render.rebuild();
  }

  /* ---------------- simulation ---------------- */
  function updateWorld(dt, noPlayer) {
    const S = W.S,
      P = NR.player.p;
    W.runTime += dt;
    W.comboTimer = Math.max(0, W.comboTimer - dt);
    if (!W.comboTimer) W.combo = 0;
    for (let i = W.effects.length - 1; i >= 0; i--) {
      W.effects[i].t += dt;
      if (W.effects[i].t >= W.effects[i].life) W.effects.splice(i, 1);
    }
    if (W.effects.length > 48) W.effects.splice(0, W.effects.length - 48);
    for (let i = W.floating.list.length - 1; i >= 0; i--) {
      const o = W.floating.list[i];
      o.life -= dt;
      o.y -= 30 * dt;
      if (o.life <= 0) W.floating.killAt(i);
    }
    W.shake = Math.max(0, W.shake - dt * C.damage.shakeDecay);
    W.flash = Math.max(0, W.flash - dt);
    if (!noPlayer && P.alive) NR.player.update(dt);

    /* bullets vs enemies via spatial hash */
    hash.clear();
    for (let i = 0; i < W.enemies.length; i++) hash.insert(W.enemies[i]);
    const bl = W.bullets.list;
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i];
      NR.weapons.updateBullet(b, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      /* check hit against rift_node */
      let nodeHit = false;
      for (let nh = 0; nh < W.hazards.length; nh++) {
        const h = W.hazards[nh];
        if (h.id === 'rift_node' && !h.detonating && Math.hypot(h.x - b.x, h.y - b.y) < (h.r + b.r) * S) {
          h.detonating = true;
          NR.particles.burst(h.x, h.y, C.colors.cyanHi, 8, 120);
          nodeHit = true;
          break;
        }
      }
      if (nodeHit) {
        if (b.isFlak || (P && P.evolvedWeapon === 'supernova')) {
          NR.weapons.flakBurst(b.x, b.y, b.dmg);
        }
        W.bullets.killAt(i);
        continue;
      }
      if (b.life <= 0 || b.x < 0 || b.x > W.W || b.y < 0 || b.y > W.H) {
        if (b.isFlak) NR.weapons.flakBurst(b.x, b.y, b.dmg);
        W.bullets.killAt(i);
        continue;
      }
      const br = b.r * S,
        near = hash.query(b.x, b.y, br);
      let hit = null,
        best = Infinity;
      for (let k = 0; k < near.length; k++) {
        const e = near[k];
        if (e.dead || e.cloak || (b.hitIds && b.hitIds.includes(e))) continue;
        const dx = e.x - b.x,
          dy = e.y - b.y,
          d2 = dx * dx + dy * dy,
          rr = e.r * S + br;
        if (d2 < rr * rr && d2 < best) {
          best = d2;
          hit = e;
        }
      }
      if (!hit && W.boss && !W.boss.dead && Math.hypot(W.boss.x - b.x, W.boss.y - b.y) < W.boss.r + br) hit = W.boss;
      if (hit) {
        NR.enemies.hit(hit, b);
        if (b.pierce > 0 && !hit.boss) {
          b.pierce--;
          b.lastHit = hit;
          b.hitIds.push(hit);
        } else W.bullets.killAt(i);
      }
    }
    NR.enemies.compact();

    /* Update Plasma Pockets from Supernova */
    if (W.plasmaPockets && W.plasmaPockets.length) {
      for (let i = W.plasmaPockets.length - 1; i >= 0; i--) {
        const pk = W.plasmaPockets[i];
        pk.life -= dt;
        const tickDmg = pk.dps * dt;
        W.enemies.concat(W.boss ? [W.boss] : []).forEach(e => {
          if (e.dead || e.cloak) return;
          if (Math.hypot(e.x - pk.x, e.y - pk.y) < pk.r + (e.r || 10) * S) {
            NR.combat.hit(e, tickDmg, e.x, e.y, true);
          }
        });
        if (pk.life <= 0) W.plasmaPockets.splice(i, 1);
      }
    }

    /* Update Void Mines from Void Slip */
    if (W.voidMines && W.voidMines.length) {
      for (let i = W.voidMines.length - 1; i >= 0; i--) {
        const vm = W.voidMines[i];
        vm.age += dt;
        vm.life -= dt;
        if (vm.age >= vm.arm) {
          let triggered = false;
          W.enemies.concat(W.boss ? [W.boss] : []).forEach(e => {
            if (e.dead || e.cloak) return;
            if (Math.hypot(e.x - vm.x, e.y - vm.y) < (vm.trigger + (e.r || 10)) * S) {
              triggered = true;
            }
          });
          if (triggered || vm.life <= 0) {
            NR.combat.blast(vm.x, vm.y, vm.r * S, vm.damage, 80);
            W.effects.push({ kind: 'ring', x: vm.x, y: vm.y, r: vm.r * S, t: 0, life: .35, color: C.colors.pink });
            NR.particles.burst(vm.x, vm.y, C.colors.pink, 14, 150);
            W.voidMines.splice(i, 1);
          }
        } else if (vm.life <= 0) {
          W.voidMines.splice(i, 1);
        }
      }
    }

    /* Update Event Horizon gravity tethers */
    if (NR.weapons && NR.weapons.updateTethers) {
      NR.weapons.updateTethers(dt);
    }

    if (P.alive || noPlayer) NR.enemies.update(dt);
    NR.bosses.updateProjectiles(dt);
    NR.pickups.update(dt);
    NR.particles.update(dt);
  }

  function resetRun() {
    W.bullets.clear();
    NR.particles.clear();
    W.gems.clear();
    W.enemyBullets.clear();
    W.floating.clear();
    W.effects.length = 0;
    W.hazards.length = 0;
    W.plasmaPockets = [];
    W.voidMines = [];
    W.activeTethers = [];
    W.shockRings.length = 0;
    W.boss = null;
    W.bossKills = 0;
    W.bossShards = 0;
    W.combo = 0;
    W.comboTimer = 0;
    W.maxCombo = 0;
    W.dashKills = 0;
    W.well = null;
    W.debugScale = 1;
    W.enemies.length = 0;
    W.telegraphs.length = 0;
    W.pickups.length = 0;
    W.score = 0;
    W.kills = 0;
    W.runTime = 0;
    W.shake = 0;
    W.flash = 0;
    W.newBest = false;
    W.timeScale = 1;
    W.hitStop = 0;
    NR.input.dashAt = -1e9;
    NR.player.reset();
    NR.waves.reset();
    NR.input.releaseAll();
    Object.entries(NR.save.data.loadout).forEach(([k, id]) => NR.discover({
      weapon: "weapons",
      ship: "ships",
      arena: "arenas",
      ability: "abilities"
    } [k], id));
  }

  function finishRun() {
    const d = NR.save.data;
    W.newBest = W.score > d.best;
    if (W.newBest) d.best = W.score;
    d.stats.runs++;
    d.stats.kills += W.kills;
    d.stats.highestWave = Math.max(d.stats.highestWave, W.wave);
    d.stats.timePlayed += W.runTime;
    W.earnedShards = Math.floor(W.wave * C.meta.shardWave + W.kills / C.meta.shardKillDivisor + NR.player.p.level * C.meta.shardLevel);
    d.shards += W.earnedShards;
    NR.save.commit(true);
  }

  /* ---------------- states ---------------- */
  STATES.BOOT = {
    update() {}
  };

  STATES.MENU = {
    enter() {
      W.timeScale = 1;
      NR.ui.menu();
    },
    update(dt, real) {
      W.fragments.forEach(f => {
        f.x += f.vx * real;
        f.y += f.vy * real;
        f.rot += f.vr * real;
        if (f.x < -60) f.x = W.W + 60;
        if (f.x > W.W + 60) f.x = -60;
        if (f.y < -60) f.y = W.H + 60;
        if (f.y > W.H + 60) f.y = -60;
      });
    }
  };
  STATES.RUN_INTRO = {
    enter() {
      introSkip = false;
      resetRun();
      NR.ui.setScreen('run');
      NR.ui.hideCard();
      NR.ui.announce('INITIALIZING RIFT\u2026 SIGNAL LOCKED // ENTERING ARENA', C.runIntro + 0.1);
    },
    update(dt, real) {
      if (stateTime >= C.runIntro || introSkip) {
        NR.ui.clearAnnounce();
        NR.waves.next();
        if (W.wave % 5 !== 0) setState('PLAYING');
      }
    }
  };

  function afterWorld() {
    if (!NR.player.p.alive) {
      setState('DYING');
      return true;
    }
    return false;
  }

  STATES.PLAYING = {
    enter() {
      NR.ui.setScreen('run');
    },
    update(dt) {
      updateWorld(dt);
      if (afterWorld()) return;
      if (NR.player.p.pending > 0) {
        setState('LEVEL_UP');
        return;
      }
      if (NR.waves.update(dt) === 'cleared') {
        W.restTimer = C.waves.restTime;
        setState('WAVE_COMPLETE');
      }
    }
  };

  STATES.WAVE_COMPLETE = {
    update(dt) {
      updateWorld(dt);
      if (afterWorld()) return;
      if (NR.player.p.pending > 0) {
        setState('LEVEL_UP');
        return;
      }
      W.restTimer -= dt;
      if (W.restTimer <= 0) {
        NR.waves.next();
        if (W.wave % 5 !== 0) setState('PLAYING');
      }
    }
  };

  STATES.DYING = {
    enter() {
      introSkip = false;
      NR.ui.announce('SIGNAL LOST', 1.5);
      const p = NR.player.p;
      W.timeScale = NR.reduced() ? 1 : C.dying.slow;
      NR.particles.burst(p.x, p.y, C.colors.cyan, 40, 260);
      NR.particles.burst(p.x, p.y, '#ff4c87', 24, 200);
      W.shake = C.damage.maxShake;
      NR.bus.emit('playerDied');
    },
    update(dt, real) {
      if (stateTime > .6) W.timeScale = 1;
      updateWorld(dt, true);
      if (stateTime > 1.5) NR.ui.announce('RUN COMPLETE', .3);
      if (stateTime >= C.dying.time || (introSkip && stateTime > 0.3)) setState('RUN_SUMMARY');
    },
    exit() {
      W.timeScale = 1;
    }
  };

  STATES.RUN_SUMMARY = {
    enter() {
      introSkip = false;
      finishRun();
      const d = NR.save.data;
      NR.ui.showCard({
        eyebrow: 'SIGNAL LOST // RUN COMPLETE',
        title: 'GAME <span>OVER</span>',
        desc: 'You survived ' + W.wave + ' wave' + (W.wave === 1 ? '' : 's') + ' and scored ' + W.score.toLocaleString() + ' points.',
        info: '<span class="badge">' + (W.newBest ? 'NEW HIGH SCORE ' : 'BEST SCORE ') + d.best.toLocaleString() + '</span><br>' +
          '<div class="summary-grid"><span>WAVE <b>' + W.wave + '</b></span><span>SCORE <b>' + Math.floor(W.score).toLocaleString() + '</b></span><span>KILLS <b>' + W.kills + '</b></span><span>BOSSES <b>' + W.bossKills + '</b></span><span>TIME <b>' + U.fmtTime(W.runTime) + '</b></span><span>RIFT LEVEL <b>' + NR.player.p.level + '</b></span><span>XP EARNED <b>' + Math.floor(NR.player.p.xpTotal) + '</b></span><span>SHARDS <b>+' + (W.earnedShards + W.bossShards) + '</b></span></div>',
        buttons: [{
          label: 'PLAY AGAIN',
          primary: true,
          onClick: () => NR.game.startRun()
        }, {
          label: 'LOADOUT / ARMORY',
          onClick: () => NR.ui.loadout()
        }, {
          label: 'MAIN MENU',
          onClick: () => setState('MENU')
        }]
      });
      NR.ui.startCountUp();
    },
    update(dt, real) {
      NR.ui.countUp(real);
    },
    exit() {
      NR.ui.hideCard();
    }
  };

  STATES.PAUSED = {
    enter(prev) {
      if (prev !== 'SETTINGS') pausedFrom = prev;
      NR.input.releaseAll();
      NR.ui.showCard({
        eyebrow: 'TAKE A BREATH',
        title: 'GAME <span>PAUSED</span>',
        desc: 'The rift can wait. Your run is safe.',
        info: 'Press P or Esc to resume.',
        buttons: [{
          label: 'RESUME',
          primary: true,
          onClick: () => NR.game.togglePause()
        }, {
          label: 'RESTART RUN',
          confirm: true,
          onClick: () => NR.game.startRun()
        }, {
          label: 'SETTINGS',
          onClick: () => NR.ui.settings('PAUSED')
        }, {
          label: 'AUTO-PAUSE ON FOCUS LOSS: ' + (NR.save.data.settings.autoPause ? 'ON' : 'OFF'),
          onClick: btn => {
            const s = NR.save.data.settings;
            s.autoPause = !s.autoPause;
            NR.save.commit();
            btn.textContent = 'AUTO-PAUSE ON FOCUS LOSS: ' + (s.autoPause ? 'ON' : 'OFF');
          }
        }, {
          label: 'QUIT TO MENU',
          confirm: true,
          onClick: () => setState('MENU')
        }]
      });
    },
    update() {},
    exit() {
      NR.ui.hideCard();
    }
  };


  STATES.LEVEL_UP = {
    enter(prev) {
      NR.levelReturn = prev;
      NR.ui.levelUp(false);
    },
    update() {}
  };
  STATES.BOSS_REWARD = {
    enter() {
      NR.ui.levelUp(true);
    },
    update() {}
  };
  STATES.BOSS_INTRO = {
    enter() {
      NR.ui.hideCard();
      NR.input.releaseAll();
      W.event = null;
      W.hazards.length = 0;
      const bossTier = Math.max(1, Math.floor(W.wave / 5));
      const bossId = (bossTier % 2 === 1) ? 'overlord' : 'null_sentinel';
      const b = NR.bosses.create(bossId, bossTier);
      introSkip = false;
      NR.ui.announce('RIFT SIGNATURE DETECTED // ' + b.def.name, 3);
    },
    update() {
      if (stateTime >= 3 || (introSkip && stateTime >= 1)) {
        NR.ui.announce(W.boss ? W.boss.def.name : 'BOSS', 1);
        setState('BOSS_FIGHT');
      }
    }
  };
  STATES.BOSS_FIGHT = {
    enter() {
      NR.ui.setScreen('run');
    },
    update(dt, real) {
      updateWorld(dt);
      if (afterWorld()) return;
      NR.waves.telegraphs(dt);
      NR.bosses.update(dt, real);
      if (stateName !== 'BOSS_FIGHT') return;
      if (NR.player.p.pending > 0 && W.boss && !W.boss.dead) setState('LEVEL_UP');
    }
  };
  ['LOADOUT', 'ARCHIVES', 'ACHIEVEMENTS', 'SETTINGS'].forEach(k => STATES[k] = {
    update() {}
  });
  Object.values(STATES).forEach(s => {
    if (!s.enter) s.enter = () => {};
    if (!s.exit) s.exit = () => {};
    if (!s.draw) s.draw = () => NR.render.frame(!['MENU', 'BOOT', 'LOADOUT', 'ARCHIVES', 'ACHIEVEMENTS'].includes(NR.game.state));
    if (!s.onInput) s.onInput = () => {};
  });

  /* ---------------- public API ---------------- */
  NR.game = {
    state: 'BOOT',
    isPlayState() {
      return !!PLAY[stateName];
    },
    getState() {
      return stateName;
    },
    setState,
    startRun(instant) {
      if (instant === true) {
        resetRun();
        NR.ui.setScreen('run');
        NR.ui.hideCard();
        NR.waves.next();
        if (W.wave % 5 !== 0) setState('PLAYING');
      } else setState('RUN_INTRO');
    },
    togglePause() {
      if (stateName === 'PLAYING' || stateName === 'WAVE_COMPLETE' || stateName === 'BOSS_FIGHT') setState('PAUSED');
      else if (stateName === 'PAUSED') setState(pausedFrom);
    },
    hitStop(sec) {
      W.hitStop = Math.max(W.hitStop, sec);
    },
    step(real) {
      /* advance one frame without rendering (used by tests) */
      if (!['PAUSED', 'LEVEL_UP', 'BOSS_REWARD', 'SETTINGS'].includes(stateName)) W.t += real;
      if (W.hitStop > 0) W.hitStop = Math.max(0, W.hitStop - real);
      const dt = real * (W.hitStop > 0 && !NR.reduced() ? 0 : W.timeScale) * W.debugScale;
      stateTime += real;
      state.update(dt, real);
      state.onInput(NR.input);
      NR.ui.update(real);
      NR.audio.update();
    },
    resize,
    init() {
      canvas = document.getElementById('game');
      if (!NR.render.init(canvas)) {
        document.body.textContent = 'This browser does not support HTML5 canvas.';
        return;
      }
      for (let i = 0; i < 16; i++) {
        W.fragments.push({
          x: Math.random() * innerWidth,
          y: Math.random() * innerHeight,
          vx: rng.range(-24, 24),
          vy: rng.range(-18, 18),
          rot: rng.range(0, 6.28),
          vr: rng.range(-0.4, 0.4),
          s: rng.range(10, 34),
          n: [3, 4, 6, 8][i % 4],
          a: rng.range(0.12, 0.3),
          color: [C.colors.cyan, C.colors.pink, C.colors.purple, C.colors.orange][i % 4]
        });
      }
      NR.player.reset();
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', () => setTimeout(resize, 120));

      NR.bus.on('input:pause', () => NR.game.togglePause());
      NR.bus.on('input:any', () => {
        if (((stateName === 'BOSS_INTRO' && stateTime >= 1) || ((stateName === 'RUN_INTRO' || stateName === 'DYING' || stateName === 'RUN_SUMMARY') && stateTime > 0.12))) introSkip = true;
      });
      NR.bus.on('input:blur', () => {
        if (NR.save.data.settings.autoPause && (stateName === 'PLAYING' || stateName === 'WAVE_COMPLETE' || stateName === 'BOSS_FIGHT')) setState('PAUSED');
      });
      NR.bus.on('input:hidden', () => {
        if (stateName === 'PLAYING' || stateName === 'WAVE_COMPLETE' || stateName === 'BOSS_FIGHT') setState('PAUSED');
      });

      setState('MENU');
      last = rawLast = performance.now();
      requestAnimationFrame(frame);
    }
  };

  function frame(now) {
    const raw = (now - rawLast) / 1000;
    rawLast = now;
    if (raw > .022 && raw < .25) W.slowTime = (W.slowTime || 0) + raw;
    else W.slowTime = 0;
    if (W.slowTime >= 2) {
      const q = NR.save.data.settings.particles;
      if (q === 'high') NR.save.data.settings.particles = 'medium';
      else if (q === 'medium') NR.save.data.settings.particles = 'low';
      W.slowTime = 0;
      NR.save.commit();
    }
    if (raw > 0) W.fps += (clamp(1 / raw, 1, 240) - W.fps) * 0.05;
    const real = Math.min((now - last) / 1000 || 0, C.world.maxDt);
    last = now;
    NR.game.step(real);
    state.draw();
    if (stateName !== 'MENU') NR.ui.hud();
    requestAnimationFrame(frame);
  }
})();
