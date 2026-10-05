(function() {
  'use strict';
  const N = window.NR,
    C = N.CONFIG,
    R = N.rng;
  N.WEAPONS = {
    pulse: {
      name: 'PULSE CANNON',
      price: 0,
      damage: 10,
      cooldown: .115,
      speed: 750,
      life: .9,
      r: 4,
      recoil: 8,
      color: C.colors.cyanHi,
      sound: 'shot_pulse',
      pattern: 'bullet',
      tags: ['projectile'],
      description: 'Balanced automatic rounds'
    },
    nova: {
      name: 'NOVA SHOTGUN',
      price: 0,
      bossUnlock: true,
      damage: 7,
      cooldown: .75,
      speed: 700,
      life: .45,
      r: 3,
      recoil: 90,
      pellets: 8,
      spread: 28 * Math.PI / 180,
      color: C.colors.orange,
      sound: 'shot_nova',
      pattern: 'shotgun',
      tags: ['projectile'],
      description: 'Eight pellets in a short-range cone'
    },
    rail: {
      name: 'RAIL RIFLE',
      price: 400,
      damage: 120,
      cooldown: .9,
      charge: .5,
      r: 11,
      recoil: 160,
      pierce: 5,
      color: C.colors.purple,
      sound: 'shot_rail',
      pattern: 'beam',
      tags: ['hitscan'],
      description: 'Hold to charge / release to pierce'
    },
    arc: {
      name: 'ARC BLASTER',
      price: 300,
      damage: 14,
      cooldown: .16,
      speed: 900,
      life: .5,
      r: 4,
      recoil: 6,
      targets: 2,
      chainRange: 140,
      chainDamage: .6,
      color: C.colors.green,
      sound: 'shot_arc',
      pattern: 'arc',
      tags: ['projectile'],
      description: 'Fast darts chain to nearby targets'
    },
    void: {
      name: 'VOID ORB',
      price: 500,
      damage: 44,
      splash: 15,
      radius: 55,
      cooldown: .6,
      speed: 170,
      life: 2.6,
      r: 9,
      recoil: 20,
      turn: 2.5,
      range: 300,
      color: C.colors.pink,
      sound: 'shot_void',
      pattern: 'orb',
      tags: ['projectile'],
      description: 'Slow homing orb / area detonation'
    }
  };
  N.combat = {
    hit(e, amount, x, y, secondary) {
      if (!e || e.dead || e.cloak) return;
      const p = N.player.p,
        s = N.stats.get(),
        u = p.upgrades;
      let dmg = amount;
      if (e.elite || e.boss) dmg *= 1 + .25 * (u.amplifier || 0);
      if (e.boss && N.save && N.save.data && N.save.data.talents && N.save.data.talents.terminal_force) {
        dmg *= (1 + 0.06 * N.save.data.talents.terminal_force);
      }
      if (e.affix === 'armored') dmg *= .7;
      if (!e.boss && N.world.enemies.some(o => o.type === 'sentinel' && o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 110 * N.world.S)) dmg *= .5;
      if (!secondary && R.chance(Math.min(C.caps.crit, s.crit + (p.weapon === 'pulse' ? .05 * (u.pulse_crit || 0) : 0)))) dmg *= s.critMult;
      if (e.boss) {
        N.bosses.hit(dmg);
        N.float(x || e.x, y || e.y, Math.round(dmg), C.colors.cyanHi);
        return;
      }
      e.hp -= dmg;
      e.hit = .13;
      N.bus.emit('enemyHit', {
        enemy: e,
        killed: e.hp <= 0,
        damage: dmg
      });
      N.float(e.x, e.y, Math.round(dmg), C.colors.text);
      N.particles.burst(e.x, e.y, e.color, 4, 100);
      if (dmg >= 500) N.achievements.unlock('overkill');
      if (!secondary) {
        if (u.burn) {
          e.burns = e.burns || [];
          if (e.burns.length < 12) e.burns.push({
            left: C.effects.burnDuration,
            rate: dmg * C.effects.burnFraction * u.burn / C.effects.burnDuration
          });
        }
        if (u.freeze && R.chance(C.effects.freezeChance * u.freeze)) e.slow = C.effects.freezeDuration;
        if (u.explosive && R.chance(C.effects.blastChance)) this.blast(e.x, e.y, C.effects.blastRadius * N.world.S, dmg * C.effects.blastFraction, 0, e);
        if (u.chain && R.chance(C.effects.chainChance * u.chain)) this.chain(e, dmg * C.effects.chainFraction, C.effects.chainTargets + u.chain - 1, C.effects.chainRange * N.world.S);
      }
      if (e.hp <= 0) N.enemies.kill(e);
    },
    blast(x, y, r, damage, push, except) {
      N.world.enemies.forEach(e => {
        const dx = e.x - x,
          dy = e.y - y,
          l = Math.hypot(dx, dy);
        if (e !== except && l < r + e.r * N.world.S) {
          this.hit(e, damage, e.x, e.y, true);
          if (push) {
            e.x += dx / Math.max(1, l) * push * N.world.S;
            e.y += dy / Math.max(1, l) * push * N.world.S;
          }
        }
      });
      const b = N.world.boss;
      if (b && Math.hypot(b.x - x, b.y - y) < r + b.r) this.hit(b, damage, x, y, true);
    },
    chain(e, damage, n, range, isTesla) {
      let cur = e;
      const seen = [e];
      for (let i = 0; i < n; i++) {
        let near = null,
          dist = range;
        N.world.enemies.forEach(o => {
          const l = Math.hypot(o.x - cur.x, o.y - cur.y);
          if (!o.dead && !o.cloak && !seen.includes(o) && l < dist) {
            near = o;
            dist = l;
          }
        });
        if (!near) break;
        if (isTesla) near.stun = Math.max(near.stun || 0, 0.35);
        N.world.effects.push({
          kind: 'line',
          x: cur.x,
          y: cur.y,
          x2: near.x,
          y2: near.y,
          t: 0,
          life: .18,
          color: isTesla ? '#74FFB7' : C.colors.green
        });
        this.hit(near, damage, near.x, near.y, true);
        seen.push(near);
        cur = near;
      }
    }
  };

  let pairIdCounter = 0;

  function bullet(p, d, angle, s, opts) {
    const W = N.world,
      b = W.bullets.spawn();
    if (!b) return;
    const u = p.upgrades;
    opts = opts || {};
    const dmgMult = opts.dmgMult || 1;
    const lifeMult = opts.lifeMult || 1;
    const spdMult = opts.spdMult || 1;
    const col = opts.color || d.color;
    Object.assign(b, {
      x: p.x + (opts.offsetX || 0) + Math.cos(angle) * p.r * W.S,
      y: p.y + (opts.offsetY || 0) + Math.sin(angle) * p.r * W.S,
      vx: Math.cos(angle) * (opts.speed || d.speed) * s.speedBullet * spdMult * W.S,
      vy: Math.sin(angle) * (opts.speed || d.speed) * s.speedBullet * spdMult * W.S,
      r: (opts.r || d.r) * s.size,
      life: d.life * lifeMult,
      dmg: d.damage * s.damage * dmgMult,
      pierce: opts.pierce !== undefined ? opts.pierce : s.pierce,
      lastHit: null,
      hitIds: [],
      color: col,
      weapon: p.weapon,
      angle,
      bounces: opts.bounces || 0,
      isFlak: !!opts.isFlak,
      isTesla: !!opts.isTesla,
      isTetherOrb: !!opts.isTetherOrb,
      pairId: opts.pairId || 0
    });
    if (p.weapon === 'pulse' && !p.evolvedWeapon) {
      const k = 1 + .1 * (u.pulse_speed || 0);
      b.vx *= k;
      b.vy *= k;
    }
    return b;
  }

  N.weapons = {
    current: 'pulse',
    bullet,
    spawnBullet: bullet,
    flakBurst(x, y, dmg) {
      const W = N.world, S = W.S;
      N.combat.blast(x, y, 70 * S, (dmg || 10) * 2.4, 60);
      W.effects.push({
        kind: 'ring',
        x,
        y,
        r: 70 * S,
        t: 0,
        life: .35,
        color: '#FFBD66'
      });
      N.particles.burst(x, y, '#FFBD66', 10, 140);
      W.plasmaPockets = W.plasmaPockets || [];
      if (W.plasmaPockets.length >= 10) W.plasmaPockets.shift();
      W.plasmaPockets.push({
        x,
        y,
        r: 62 * S,
        life: 2.6,
        maxLife: 2.6,
        dps: (dmg || 10) * 1.6
      });
    },
    fire(p) {
      const d = N.WEAPONS[p.weapon],
        s = N.stats.get(),
        u = p.upgrades,
        evo = p.evolvedWeapon;
      if (!d || p.cool > 0 || (p.weapon === 'rail' && !evo)) return;

      /* Kinetic Conduit check */
      if (p.dash > 0 && u.kinetic_conduit && (p.weapon === 'rail' || p.weapon === 'arc' || evo === 'singularity_lance' || evo === 'tesla_storm')) {
        p.invuln = Math.min(1.5, p.invuln + (N.CONFIG.PROTOCOLS.kinetic_conduit.extend || 0.2));
        N.particles.burst(p.x, p.y, C.colors.purple, 4, 80);
      }

      /* Hyper Pulse Evolution */
      if (evo === 'hyper_pulse') {
        const perpX = -Math.sin(p.angle),
          perpY = Math.cos(p.angle);
        const gaps = [-7, 0, 7];
        for (let i = 0; i < 3; i++) {
          const offX = perpX * gaps[i] * N.world.S;
          const offY = perpY * gaps[i] * N.world.S;
          bullet(p, d, p.angle, s, {
            bounces: 2,
            dmgMult: 1.15,
            lifeMult: 1.6,
            color: '#7DFDF3',
            offsetX: offX,
            offsetY: offY
          });
        }
        p.shots++;
        p.cool = (d.cooldown * 0.82) / s.fireRate;
        p.vx -= Math.cos(p.angle) * d.recoil * N.world.S;
        p.vy -= Math.sin(p.angle) * d.recoil * N.world.S;
        N.particles.burst(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, '#7DFDF3', 4, 90);
        N.bus.emit('weaponFired', d);
        return;
      }

      /* Supernova Evolution */
      if (evo === 'supernova') {
        const extra = 2;
        const count = d.pellets + (u.nova_pellets || 0) + extra;
        const cone = d.spread * Math.pow(.85, u.nova_spread || 0);
        for (let i = 0; i < count; i++) {
          const ang = p.angle + (count > 1 ? (i / (count - 1) - .5) * cone : 0);
          bullet(p, d, ang, s, {
            isFlak: true,
            dmgMult: 1.2,
            color: '#FFBD66'
          });
        }
        p.shots++;
        p.cool = (d.cooldown * Math.pow(.9, u.nova_cooldown || 0)) / s.fireRate;
        p.vx -= Math.cos(p.angle) * d.recoil * N.world.S;
        p.vy -= Math.sin(p.angle) * d.recoil * N.world.S;
        N.particles.burst(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, '#FFBD66', 8, 120);
        N.bus.emit('weaponFired', d);
        return;
      }

      /* Tesla Storm Evolution */
      if (evo === 'tesla_storm') {
        bullet(p, d, p.angle, s, {
          isTesla: true,
          dmgMult: 1.0,
          color: '#74FFB7'
        });
        p.shots++;
        p.cool = (d.cooldown * 0.85) / s.fireRate;
        p.vx -= Math.cos(p.angle) * d.recoil * N.world.S;
        p.vy -= Math.sin(p.angle) * d.recoil * N.world.S;
        N.particles.burst(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, '#74FFB7', 4, 80);
        N.bus.emit('weaponFired', d);
        return;
      }

      /* Event Horizon Evolution */
      if (evo === 'event_horizon') {
        const pairId = ++pairIdCounter;
        bullet(p, d, p.angle - 0.2, s, {
          isTetherOrb: true,
          pairId,
          color: '#F85D9C',
          speed: 205,
          pierce: 3
        });
        bullet(p, d, p.angle + 0.2, s, {
          isTetherOrb: true,
          pairId,
          color: '#F85D9C',
          speed: 205,
          pierce: 3
        });
        p.shots++;
        p.cool = d.cooldown / s.fireRate;
        p.vx -= Math.cos(p.angle) * d.recoil * N.world.S;
        p.vy -= Math.sin(p.angle) * d.recoil * N.world.S;
        N.particles.burst(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, '#F85D9C', 6, 90);
        N.bus.emit('weaponFired', d);
        return;
      }

      /* Standard base firing */
      let count = p.weapon === 'nova' ? d.pellets + (u.nova_pellets || 0) : 1 + (u.multishot || 0) + (p.weapon === 'void' ? (u.void_volley || 0) : 0);
      const cone = p.weapon === 'nova' ? d.spread * Math.pow(.85, u.nova_spread || 0) : .12 * (count - 1);
      for (let i = 0; i < count; i++) bullet(p, d, p.angle + (count > 1 ? (i / (count - 1) - .5) * cone : 0), s);
      p.shots++;
      if (p.weapon === 'pulse' && u.pulse_burst && p.shots % 6 === 0) {
        for (let i = 0; i < u.pulse_burst; i++) bullet(p, d, p.angle + (i - .5) * .06, s);
      }
      p.cool = d.cooldown / s.fireRate * (p.weapon === 'nova' ? Math.pow(.9, u.nova_cooldown || 0) : 1);
      p.vx -= Math.cos(p.angle) * d.recoil * N.world.S;
      p.vy -= Math.sin(p.angle) * d.recoil * N.world.S;
      N.particles.burst(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, d.color, 3, 70);
      N.bus.emit('weaponFired', d);
    },
    rail(p, dt) {
      const firing = N.input.isFiring(),
        d = N.WEAPONS.rail,
        s = N.stats.get(),
        evo = p.evolvedWeapon;

      /* Singularity Lance Evolution (Continuous Channel) */
      if (evo === 'singularity_lance') {
        if (firing) {
          p.lanceTick = (p.lanceTick || 0) + dt;
          if (p.dash > 0 && p.upgrades.kinetic_conduit) {
            p.invuln = Math.min(1.5, p.invuln + (N.CONFIG.PROTOCOLS.kinetic_conduit.extend || 0.2) * dt);
          }
          if (p.lanceTick >= 0.1) {
            p.lanceTick = 0;
            const dx = Math.cos(p.angle),
              dy = Math.sin(p.angle),
              W = N.world,
              len = Math.hypot(W.W, W.H),
              width = 16 * W.S,
              damage = d.damage * s.damage * 0.16;
            const targets = W.enemies.concat(W.boss ? [W.boss] : []).map(e => ({
              e,
              t: (e.x - p.x) * dx + (e.y - p.y) * dy,
              perp: Math.abs((e.x - p.x) * dy - (e.y - p.y) * dx),
              side: (e.x - p.x) * dy - (e.y - p.y) * dx
            })).filter(o => o.t > 0 && o.perp < width * 2.5 + o.e.r * W.S).sort((a, b) => a.t - b.t);

            targets.slice(0, 12).forEach(o => {
              N.combat.hit(o.e, damage, o.e.x, o.e.y);
              /* Pull towards beam center */
              const perpPull = 210 * W.S * 0.1;
              if (Math.abs(o.side) > 2) {
                const pullDir = o.side > 0 ? 1 : -1;
                const amount = Math.min(perpPull, Math.abs(o.side));
                o.e.x += -dy * pullDir * amount;
                o.e.y += dx * pullDir * amount;
              }
            });
            W.effects.push({
              kind: 'beam',
              x: p.x,
              y: p.y,
              x2: p.x + dx * len,
              y2: p.y + dy * len,
              t: 0,
              life: .14,
              width,
              color: '#B277FF'
            });
            N.particles.burst(p.x + dx * 24, p.y + dy * 24, '#B277FF', 2, 60);
          }
        } else {
          p.lanceTick = 0.1;
        }
        p.wasFiring = firing;
        return;
      }

      /* Base Rail Rifle */
      if (firing && p.cool <= 0) p.charge = Math.min(d.charge * Math.pow(.88, p.upgrades.rail_charge || 0), p.charge + dt);
      if (!firing && p.wasFiring && p.charge > 0 && p.cool <= 0) {
        if (p.dash > 0 && p.upgrades.kinetic_conduit) {
          p.invuln = Math.min(1.5, p.invuln + (N.CONFIG.PROTOCOLS.kinetic_conduit.extend || 0.2));
          N.particles.burst(p.x, p.y, C.colors.purple, 4, 80);
        }
        const f = Math.min(1, p.charge / (d.charge * Math.pow(.88, p.upgrades.rail_charge || 0))),
          damage = d.damage * s.damage * (.4 + .6 * f),
          dx = Math.cos(p.angle),
          dy = Math.sin(p.angle),
          W = N.world,
          len = Math.hypot(W.W, W.H),
          width = d.r * (1 + .2 * (p.upgrades.rail_width || 0)) * W.S;
        const targets = W.enemies.concat(W.boss ? [W.boss] : []).map(e => ({
          e,
          t: (e.x - p.x) * dx + (e.y - p.y) * dy,
          perp: Math.abs((e.x - p.x) * dy - (e.y - p.y) * dx)
        })).filter(o => o.t > 0 && o.perp < width + o.e.r * W.S).sort((a, b) => a.t - b.t);
        targets.slice(0, Math.min(8, d.pierce + s.pierce + (p.upgrades.rail_pierce || 0)) + 1).forEach(o => N.combat.hit(o.e, damage, o.e.x, o.e.y));
        W.effects.push({
          kind: 'beam',
          x: p.x,
          y: p.y,
          x2: p.x + dx * len,
          y2: p.y + dy * len,
          t: 0,
          life: .24,
          width,
          color: d.color
        });
        p.shots++;
        p.cool = d.cooldown / s.fireRate;
        p.vx -= dx * d.recoil * W.S;
        p.vy -= dy * d.recoil * W.S;
        p.charge = 0;
        N.bus.emit('weaponFired', d);
      }
      p.wasFiring = firing;
    },
    updateBullet(b, dt) {
      const p = N.player.p,
        u = p.upgrades,
        d = N.WEAPONS[b.weapon];

      /* Hyper Pulse wall bounce */
      if (b.bounces > 0) {
        const W = N.world,
          br = b.r * W.S;
        let bounced = false;
        if (b.x - br < 0) {
          b.x = br;
          b.vx = Math.abs(b.vx);
          bounced = true;
        } else if (b.x + br > W.W) {
          b.x = W.W - br;
          b.vx = -Math.abs(b.vx);
          bounced = true;
        }
        if (b.y - br < 0) {
          b.y = br;
          b.vy = Math.abs(b.vy);
          bounced = true;
        } else if (b.y + br > W.H) {
          b.y = W.H - br;
          b.vy = -Math.abs(b.vy);
          bounced = true;
        }
        if (bounced) {
          b.bounces--;
          N.particles.burst(b.x, b.y, b.color, 4, 110);
        }
      }

      /* Homing targeting */
      if ((u.homing || b.weapon === 'void') && b.weapon !== 'rail') {
        let target = null,
          dist = (b.weapon === 'void' ? d.range : C.effects.homingRange) * N.world.S;
        N.world.enemies.concat(N.world.boss ? [N.world.boss] : []).forEach(e => {
          const l = Math.hypot(e.x - b.x, e.y - b.y);
          if (!e.dead && !e.cloak && l < dist) {
            dist = l;
            target = e;
          }
        });
        if (target) {
          const want = Math.atan2(target.y - b.y, target.x - b.x),
            now = Math.atan2(b.vy, b.vx),
            diff = Math.atan2(Math.sin(want - now), Math.cos(want - now)),
            turn = (b.weapon === 'void' ? d.turn * (1 + .2 * (u.void_turn || 0)) : C.effects.homingTurn * u.homing) * dt,
            ang = now + N.utils.clamp(diff, -turn, turn),
            speed = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(ang) * speed;
          b.vy = Math.sin(ang) * speed;
        }
      }
    },
    updateTethers(dt) {
      const W = N.world,
        S = W.S,
        bl = W.bullets.list;
      W.activeTethers = [];
      const paired = {};
      for (let i = 0; i < bl.length; i++) {
        const b = bl[i];
        if (b.isTetherOrb && b.pairId) {
          paired[b.pairId] = paired[b.pairId] || [];
          paired[b.pairId].push(b);
        }
      }
      Object.values(paired).forEach(pair => {
        if (pair.length >= 2) {
          const b1 = pair[0],
            b2 = pair[1];
          const dist = Math.hypot(b2.x - b1.x, b2.y - b1.y);
          if (dist <= 300 * S) {
            W.activeTethers.push({
              x1: b1.x,
              y1: b1.y,
              x2: b2.x,
              y2: b2.y,
              color: '#F85D9C',
              width: 14 * S
            });
            /* Tearing damage and pull to enemies along tether */
            const dx = b2.x - b1.x,
              dy = b2.y - b1.y,
              len = Math.max(1, dist);
            const midX = (b1.x + b2.x) / 2,
              midY = (b1.y + b2.y) / 2;
            W.enemies.concat(W.boss ? [W.boss] : []).forEach(e => {
              if (e.dead || e.cloak) return;
              const ex = e.x - b1.x,
                ey = e.y - b1.y;
              const proj = (ex * dx + ey * dy) / len;
              if (proj >= 0 && proj <= len) {
                const perp = Math.abs(ex * dy - ey * dx) / len;
                if (perp < 22 * S + e.r * S) {
                  N.combat.hit(e, b1.dmg * 0.3 * (dt / 0.15), e.x, e.y, true);
                  const toMidX = midX - e.x,
                    toMidY = midY - e.y,
                    toMidL = Math.max(1, Math.hypot(toMidX, toMidY));
                  e.x += (toMidX / toMidL) * 140 * S * dt;
                  e.y += (toMidY / toMidL) * 140 * S * dt;
                }
              }
            });
          }
        }
      });
    },
    onHit(e, b) {
      N.combat.hit(e, b.dmg, b.x, b.y);
      if (b.isTesla || b.weapon === 'arc') {
        const d = N.WEAPONS.arc,
          u = N.player.p.upgrades,
          isTesla = b.isTesla || N.player.p.evolvedWeapon === 'tesla_storm';
        if (isTesla) {
          e.stun = Math.max(e.stun || 0, 0.35);
        }
        const targets = isTesla ? 6 : (d.targets + (u.arc_targets || 0));
        const chainRange = (isTesla ? 170 : (d.chainRange * (1 + .15 * (u.arc_range || 0)))) * N.world.S;
        const chainDmg = isTesla ? (b.dmg * 0.86) : (b.dmg * d.chainDamage * (1 + .1 * (u.arc_damage || 0)));
        N.combat.chain(e, chainDmg, targets, chainRange, isTesla);
      }
      if (b.isFlak || N.player.p.evolvedWeapon === 'supernova') {
        N.weapons.flakBurst(b.x, b.y, b.dmg);
      } else if (b.weapon === 'void' && !b.isTetherOrb) {
        const d = N.WEAPONS.void;
        N.combat.blast(b.x, b.y, d.radius * (1 + .15 * (N.player.p.upgrades.void_radius || 0)) * N.world.S, d.splash * N.stats.get().damage, 0, e);
        N.world.effects.push({
          kind: 'ring',
          x: b.x,
          y: b.y,
          r: d.radius * N.world.S,
          t: 0,
          life: .3,
          color: d.color
        });
      }
    }
  };
})();
