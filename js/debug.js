(function() {
  'use strict';
  const N = window.NR;
  N.debugSnapshot = () => {
    const W = N.world,
      p = N.player.p;
    return {
      mode: N.game.state,
      wave: W.wave,
      score: W.score,
      health: p.hp,
      level: p.level,
      xp: p.xp,
      enemies: W.enemies.length,
      bullets: W.bullets.list.length,
      enemyBullets: W.enemyBullets.list.length,
      particles: W.particles.list.length,
      gems: W.gems.list.length,
      spawnLeft: W.spawnLeft,
      telegraphs: W.telegraphs.length,
      pickups: W.pickups.length,
      weapon: p.weapon,
      ship: p.ship,
      upgrades: Object.assign({}, p.upgrades),
      boss: W.boss ? {
        hp: W.boss.hp,
        maxHp: W.boss.maxHp,
        phase: W.boss.phase,
        attack: W.boss.attack && W.boss.attack.id
      } : null,
      fps: Math.round(W.fps),
      canvas: {
        width: document.getElementById('game').width,
        height: document.getElementById('game').height
      },
      player: {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        alive: p.alive,
        dashCd: p.dashCd
      },
      targets: W.enemies.map(e => ({
        x: e.x,
        y: e.y,
        type: e.type
      }))
    };
  };
  window.__neonRiftDebug = N.debugSnapshot;
  if (!/[?&]debug=1\b/.test(location.search)) return;
  const run = () => {
    if (!N.game.isPlayState() || N.game.state === 'RUN_INTRO') N.game.startRun(true);
  };
  window.__neonRift = {
    skipToWave(n) {
      run();
      N.waves.setWave(n);
    },
    spawn(type, n) {
      run();
      for (let i = 0; i < (n || 1); i++) N.waves.schedule(type);
    },
    spawnBoss(id) {
      run();
      N.world.wave = Math.max(5, N.world.wave);
      N.world.event = null;
      N.world.hazards.length = 0;
      N.game.setState('BOSS_INTRO');
      if (id && id !== 'overlord') N.bosses.create(id, 1);
    },
    giveXP(n) {
      run();
      N.progress.gain(n);
    },
    levelUp() {
      run();
      N.progress.gain(N.progress.need(N.player.p.level));
    },
    giveUpgrade(id) {
      run();
      if (N.UPGRADES[id]) N.progress.install(id);
    },
    setWeapon(id) {
      run();
      if (N.WEAPONS[id]) {
        N.player.p.weapon = id;
        N.weapons.current = id;
        N.player.p.cool = 0;
        N.player.p.charge = 0;
      }
    },
    forceEvent(id) {
      return N.waves.forceEvent(id);
    },
    god(on) {
      N.player.god = !!on;
    },
    timeScale(x) {
      N.world.debugScale = Math.max(0, Number(x) || 0);
    },
    perfOverlay(on) {
      N.ui.perfOverlay(on);
    },
    corruptSave() {
      N.save.debugCorrupt();
    },
    seed(n) {
      N.rng.seed(n);
    }
  };
  N.test = {
    run() {
      const errs = [],
        W = N.world,
        I = N.input;
      const assert = (v, s) => {
        if (!v) errs.push(s);
      };
      try {
        N.rng.seed(1234);
        N.game.startRun(true);
        N.player.god = true;
        const p = N.player.p;
        for (let f = 0; f < 2400; f++) {
          I.mouse.down = true;
          let nearest = W.enemies.find(e => !e.dead);
          I.aim.x = nearest ? nearest.x : W.W;
          I.aim.y = nearest ? nearest.y : W.H / 2;
          I.keys.clear();
          I.keys.add(f % 240 < 120 ? 'd' : 'a');
          if (f % 150 === 0) I.queueDash();
          if (f === 200) N.progress.gain(400);
          if (['LEVEL_UP', 'BOSS_REWARD'].includes(N.game.state)) {
            N.ui.update(.5);
            N.ui.choose(0);
            N.ui.update(1);
          }
          if (f === 800) N.waves.setWave(5);
          if (f === 1200 && W.boss) {
            W.boss.invuln = 0;
            N.bosses.hit(99999);
          }
          N.game.step(1 / 60);
          N.render.frame(true);
          assert(Number.isFinite(p.x) && Number.isFinite(p.y), 'player NaN');
          assert(W.enemies.length <= N.waves.aliveCap(), 'enemy cap');
          assert(W.bullets.list.length <= 400 && W.enemyBullets.list.length <= 200, 'bullet cap');
          assert(W.gems.list.length <= 120 && W.particles.list.length <= 500 && W.floating.list.length <= 24, 'effect cap');
        }
        N.player.god = false;
        p.invuln = 0;
        p.revived = true;
        N.player.damage(99999);
        for (let i = 0; i < 240; i++) N.game.step(1 / 60);
        assert(N.game.state === 'RUN_SUMMARY', 'summary state');
      } catch (e) {
        errs.push(e.stack);
      }
      N.input.releaseAll();
      N.player.god = false;
      N.game.setState('MENU');
      return {
        ok: !errs.length,
        errors: [...new Set(errs)]
      };
    }
  };
})();
