(function() {
  'use strict';
  const NR = window.NR = window.NR || {};

  /* All tunables live here (or in the data tables of weapons.js / enemies.js). */
  NR.CONFIG = {
    VERSION: '2.0.0',
    FOOTER: 'NEON RIFT // SURVIVAL \u2014 RIFT PROTOCOL v2.0',
    TITLE: 'NEON RIFT',
    SUBTITLE: 'RIFT PROTOCOL',

    colors: {
      bg: '#080E1C',
      cyan: '#54F1DC',
      cyanHi: '#7DFDF3',
      pink: '#F85D9C',
      orange: '#FFBD66',
      purple: '#B277FF',
      green: '#74FFB7',
      red: '#FF456B',
      text: '#EBFAFF',
      muted: '#8BA3B6',
      outline: '#FFEEFA',
      core: '#142135'
    },

    world: {
      refH: 720,
      minScale: 0.8,
      maxScale: 1.3,
      maxDt: 0.033,
      dprDesktop: 2,
      dprMobile: 1.5,
      gridSpacing: 48,
      gridDrift: 4,
      hashCell: 64,
      hashMaxRadius: 40
    },

    player: {
      startAimOffset: 120,
      r: 14,
      hp: 100,
      speed: 265,
      accel: 10,
      dashAccel: 3
    },
    dash: {
      impulse: 650,
      duration: 0.18,
      invuln: 0.3,
      cooldown: 2.3,
      buffer: 0.15
    },
    damage: {
      playerInvuln: 0.8,
      contactCooldown: 0.6,
      shake: 12,
      flash: 0.28,
      shakeDecay: 30,
      maxShake: 14
    },

    waves: {
      baseCount: 5,
      perWave: 3,
      firstSpawnDelay: 0.9,
      gapBase: 0.78,
      gapPerWave: 0.033,
      gapMin: 0.2,
      gapJitter: [0.72, 1.18],
      restTime: 2.6,
      clearBonusPerWave: 200,
      clearHeal: 10,
      telegraph: 0.6,
      minSpawnDistance: 160,
      edgeInset: 36,
      aliveCapDesktop: 35,
      aliveCapMobile: 25,
      /* V1 spawn-type roll (kept for parity until the Phase 4 threat-budget director) */
      tankFrom: 4,
      tankMax: 0.18,
      tankPerWave: 0.014,
      dasherFrom: 2,
      dasherRoll: 0.37,
      hpScaleAfter: 10,
      hpScalePerWave: 0.05
    },

    pickups: {
      shield: {
        r: 10,
        life: 11,
        blink: 3,
        heal: 25,
        score: 50,
        chance: 0.085,
        tankChance: 0.4
      },
      max: 5
    },

    perf: {
      bullets: 400,
      particles: 500
    },
    runIntro: 0.6,
    dying: {
      time: 3.0,
      slow: 0.25
    }
  };

  const CC = NR.CONFIG.colors;

  /* ================= MODULE 1: Weapon Evolutions & Protocol Synergies ================= */
  /* Weapon level = 1 + total ranks of that weapon's dedicated upgrades (capped at maxLevel). */
  NR.CONFIG.weaponLevel = {
    maxLevel: 5
  };
  NR.CONFIG.TIER_EVOLVED = 'TIER_EVOLVED';
  /* Draft weights (Evolved is a priority weight, not a rarity roll). */
  NR.CONFIG.draftWeights = {
    Common: 60,
    Rare: 25,
    Epic: 12,
    Legendary: 3,
    Evolved: 520
  };
  /* catalyst = existing passive protocol id that unlocks the evolution. */
  NR.CONFIG.EVOLUTIONS = {
    hyper_pulse: {
      name: 'HYPER PULSE',
      base: 'pulse',
      catalyst: 'rapid_fire',
      catalystName: 'OVERCLOCK PROTOCOL',
      color: '#7DFDF3',
      description: 'Triple-barrel cyclic blaster. Rounds ricochet off arena bounds.',
      barrels: 3,
      barrelGap: 7,
      damageMult: 1.15,
      cooldownMult: .82,
      bounces: 2,
      lifeMult: 1.6
    },
    supernova: {
      name: 'SUPERNOVA',
      base: 'nova',
      catalyst: 'explosive',
      catalystName: 'BLAST RADIUS PROTOCOL',
      color: '#FFBD66',
      description: 'Flak shells burst into lingering burning plasma pockets.',
      extraPellets: 2,
      damageMult: 1.2,
      flakDamage: 2.4,
      flakRadius: 70,
      pocketRadius: 62,
      pocketLife: 2.6,
      pocketDps: 1.6,
      pocketCap: 10
    },
    tesla_storm: {
      name: 'TESLA STORM',
      base: 'arc',
      catalyst: 'chain',
      catalystName: 'CHAIN CAPACITOR PROTOCOL',
      color: '#74FFB7',
      description: 'Continuous discharge chains up to 6 targets with a conductive stun.',
      targets: 6,
      range: 340,
      cone: 40 * Math.PI / 180,
      chainRange: 170,
      tick: .11,
      falloff: .86,
      damageMult: 1.0,
      stun: .35
    },
    singularity_lance: {
      name: 'SINGULARITY LANCE',
      base: 'rail',
      catalyst: 'crit_core',
      catalystName: 'CRITICAL PROTOCOL',
      color: '#B277FF',
      description: 'Hold for a piercing continuous beam that drags enemies into its line.',
      tick: .1,
      damageFraction: .16,
      width: 16,
      pull: 210,
      maxTargets: 12
    },
    event_horizon: {
      name: 'EVENT HORIZON',
      base: 'void',
      catalyst: 'homing',
      catalystName: 'HOMING THRUSTERS PROTOCOL',
      color: '#F85D9C',
      description: 'Paired vortex orbs tear enemies apart with a gravity tether.',
      spread: .2,
      speed: 205,
      pierce: 3,
      tetherWidth: 22,
      tetherMax: 300,
      tetherTick: .15,
      tetherFraction: .3,
      tetherPull: 140,
      tetherCap: 12
    }
  };
  /* Cross-ability synergy protocols (registered into NR.UPGRADES by upgrades.js). */
  NR.CONFIG.PROTOCOLS = {
    void_slip: {
      name: 'VOID SLIP',
      rarity: 'Epic',
      description: 'Phase Dash leaves 3 micro-void mines that detonate on contact',
      requires: 'dash',
      mines: 3,
      arm: .25,
      life: 7,
      trigger: 26,
      radius: 62,
      damage: 34,
      cap: 12
    },
    shock_discharge: {
      name: 'SHOCK DISCHARGE',
      rarity: 'Epic',
      description: 'Shockburst also fires a 360-degree Nova burst using current weapon stats',
      requires: 'shockburst',
      count: 18
    },
    kinetic_conduit: {
      name: 'KINETIC CONDUIT',
      rarity: 'Rare',
      description: 'Firing Rail or Arc during Phase Dash extends dash invulnerability by 0.2s',
      requiresWeapons: ['rail', 'arc'],
      extend: .2
    }
  };

  /* ================= MODULE 2: Core Protocol Matrix (permanent talents) ================= */
  /* Cost = baseCost * growth ^ currentRank. Tier N requires >=1 rank in tier N-1 of the same branch. */
  NR.CONFIG.TALENTS = {
    growth: 1.8,
    branches: {
      offense: {
        name: 'OFFENSE',
        color: CC.pink,
        nodes: [
          { id: 'precision', name: 'PRECISION', baseCost: 60, max: 5, per: 0.02, unit: 'crit', label: v => '+' + Math.round(v * 100) + '% crit chance' },
          { id: 'hypercharge', name: 'HYPERCHARGE', baseCost: 80, max: 5, per: 0.04, unit: 'damage', label: v => '+' + Math.round(v * 100) + '% base weapon damage' },
          { id: 'swift_bolt', name: 'SWIFT BOLT', baseCost: 100, max: 3, per: 0.06, unit: 'speedBullet', label: v => '+' + Math.round(v * 100) + '% projectile speed' },
          { id: 'terminal_force', name: 'TERMINAL FORCE', baseCost: 140, max: 5, per: 0.06, unit: 'bossDamage', label: v => '+' + Math.round(v * 100) + '% boss damage' }
        ]
      },
      defense: {
        name: 'DEFENSE',
        color: CC.cyan,
        nodes: [
          { id: 'kinetic_buffer', name: 'KINETIC BUFFER', baseCost: 60, max: 5, per: 8, unit: 'hp', label: v => '+' + v + ' base shield' },
          { id: 'nanite_weave', name: 'NANITE WEAVE', baseCost: 90, max: 4, per: 0.5, unit: 'regenDelay', label: v => '-' + v.toFixed(1) + 's shield recharge delay, +' + (v * .2).toFixed(1) + ' shield/s' },
          { id: 'phase_mastery', name: 'PHASE MASTERY', baseCost: 100, max: 4, per: 0.05, unit: 'dashCd', label: v => '-' + Math.round(v * 100) + '% dash cooldown' },
          { id: 'iron_hull', name: 'IRON HULL', baseCost: 150, max: 4, per: 0.06, unit: 'breakReduction', label: v => '-' + Math.round(v * 100) + '% damage taken while shield is broken (<25%)' }
        ]
      },
      utility: {
        name: 'UTILITY',
        color: CC.orange,
        nodes: [
          { id: 'shard_attractor', name: 'SHARD ATTRACTOR', baseCost: 50, max: 5, per: 0.1, unit: 'pickup', label: v => '+' + Math.round(v * 100) + '% pickup radius' },
          { id: 'scavenger_matrix', name: 'SCAVENGER MATRIX', baseCost: 80, max: 5, per: 0.025, unit: 'shardPerKill', label: v => '+' + v.toFixed(3) + ' shards per kill' },
          { id: 'protocol_analyst', name: 'PROTOCOL ANALYST', baseCost: 200, max: 2, per: 1, unit: 'rerolls', label: v => '+' + v + ' starting reroll' + (v === 1 ? '' : 's') },
          { id: 'elite_radar', name: 'ELITE RADAR', baseCost: 160, max: 3, per: 0.15, unit: 'elite', label: v => '+' + Math.round(v * 100) + '% relative elite-affix chance, +' + Math.round(v / .15) + ' shard per elite' }
        ]
      }
    }
  };

  /* ================= MODULE 3: Arena hazards ================= */
  NR.CONFIG.arenaHazards = {
    from: 3,
    budgetBase: 0.6,
    budgetPerWave: 0.35,
    budgetCap: 5,
    bossWaveNodesFrom: 10,
    bossWaveNodes: 2,
    riftNode: {
      cost: 1,
      cap: 4,
      r: 16,
      warning: .5,
      radius: 150,
      damageBase: 160,
      damagePerWave: 22,
      push: 120,
      minPlayerDist: 220
    },
    gravityPocket: {
      cost: 2,
      cap: 2,
      r: 130,
      warning: 1,
      life: 12,
      gap: 9,
      drift: 38,
      pull: 120,
      drag: 1.6
    }
  };

  /* ================= MODULE 4: QoL ================= */
  NR.CONFIG.aimAssist = {
    arc: 25 * Math.PI / 180, /* degrees either side of the raw aim vector */
    range: 560,
    low: { strength: .45, rate: 7 },
    strong: { strength: .85, rate: 14 }
  };
  NR.CONFIG.audioFilter = {
    open: 22000,
    closed: 600,
    threshold: .25,
    recover: .3,
    sweepIn: .25,
    sweepOut: .6,
    heartGapMax: 1.0,
    heartGapMin: .55
  };
  NR.CONFIG.saveExport = {
    prefix: 'NRSAVE1',
    schema: 2
  };
})();
