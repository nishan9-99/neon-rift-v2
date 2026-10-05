(function() {
  'use strict';
  const NR = window.NR = window.NR || {};
  const clamp = NR.utils.clamp;
  const KEY = 'neon-rift-save-v2',
    V1KEY = 'neon-rift-best',
    BADKEY = 'neon-rift-save-v2-corrupt',
    TALENTS_KEY = 'neon_rift_talents';
  const mem = {}; /* in-memory fallback when storage is unavailable */
  let timer = null,
    dirty = false;

  function store() {
    try {
      const s = window.localStorage;
      s.getItem(KEY);
      return s;
    } catch (e) {
      return null;
    }
  }

  function read(k) {
    if (k in mem) return mem[k];
    const s = store();
    if (s) {
      try {
        return s.getItem(k);
      } catch (e) {
        /* fall through */ }
    }
    return k in mem ? mem[k] : null;
  }

  function write(k, v) {
    const s = store();
    if (s) {
      try {
        s.setItem(k, v);
        delete mem[k];
        return;
      } catch (e) {
        /* quota */ }
    }
    mem[k] = v;
  }

  function checksum(str) {
    let a = 1, b = 0;
    for (let i = 0; i < str.length; i++) {
      a = (a + str.charCodeAt(i)) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function defaults() {
    return {
      v: 2,
      best: 0,
      stats: {
        runs: 0,
        kills: 0,
        bossKills: 0,
        highestWave: 0,
        timePlayed: 0,
        dashKills: 0,
        scavengerAccum: 0
      },
      shards: 0,
      unlocks: {
        weapons: ['pulse'],
        ships: ['striker'],
        abilities: ['dash'],
        arenas: ['origin']
      },
      talents: {},
      nodes: {},
      achievements: {},
      archives: [],
      loadout: {
        weapon: 'pulse',
        ship: 'striker',
        ability: 'dash',
        arena: 'origin'
      },
      settings: {
        master: 1,
        sfx: 1,
        music: 0.25,
        shake: 'full',
        particles: 'high',
        reducedMotion: 'auto',
        damageNumbers: true,
        touchControls: 'auto',
        aimAssist: 'low',
        autoPause: true,
        leftHanded: false,
        muted: false
      },
      tutorialDone: false
    };
  }
  const num = (v, d, lo, hi) => {
    v = Number(v);
    return isFinite(v) ? clamp(v, lo, hi) : d;
  };
  const oneOf = (v, d, list) => (list.indexOf(v) >= 0 ? v : d);
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  const strList = (v, d) => {
    const out = d.slice();
    if (Array.isArray(v)) v.forEach(x => {
      if (typeof x === 'string' && x.length < 40 && out.indexOf(x) < 0 && out.length < 64) out.push(x);
    });
    return out;
  };
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

  // One validator for main saves, legacy talent storage, imports and UI recovery.
  function sanitizeTalents(raw) {
    const source = obj(raw), out = {};
    const branches = (NR.CONFIG.TALENTS && NR.CONFIG.TALENTS.branches) || {};
    Object.values(branches).forEach(branch => {
      let previous = 1;
      branch.nodes.forEach(node => {
        const rank = previous >= 1 ? Math.floor(num(source[node.id], 0, 0, node.max)) : 0;
        if (rank > 0) out[node.id] = rank;
        previous = rank;
      });
    });
    return out;
  }

  function readLegacyTalents() {
    try { return sanitizeTalents(JSON.parse(read(TALENTS_KEY) || '{}')); }
    catch (e) { return {}; }
  }

  function validate(raw) {
    const d = defaults(),
      r = obj(raw),
      s = obj(r.stats),
      u = obj(r.unlocks),
      l = obj(r.loadout),
      st = obj(r.settings);
    const out = d;
    out.best = Math.floor(num(r.best, 0, 0, 1e9));
    out.stats = {
      runs: Math.floor(num(s.runs, 0, 0, 1e9)),
      kills: Math.floor(num(s.kills, 0, 0, 1e9)),
      bossKills: Math.floor(num(s.bossKills, 0, 0, 1e9)),
      highestWave: Math.floor(num(s.highestWave, 0, 0, 1e6)),
      timePlayed: num(s.timePlayed, 0, 0, 1e10),
      dashKills: Math.floor(num(s.dashKills, 0, 0, 1e9)),
      scavengerAccum: num(s.scavengerAccum, 0, 0, 1)
    };
    out.shards = Math.floor(num(r.shards, 0, 0, 1e9));
    ['weapons', 'ships', 'abilities', 'arenas'].forEach(k => {
      out.unlocks[k] = strList(u[k], d.unlocks[k]);
    });
    out.loadout = {
      weapon: typeof l.weapon === 'string' ? l.weapon : d.loadout.weapon,
      ship: typeof l.ship === 'string' ? l.ship : d.loadout.ship,
      ability: typeof l.ability === 'string' ? l.ability : d.loadout.ability,
      arena: typeof l.arena === 'string' ? l.arena : d.loadout.arena
    };
    out.talents = sanitizeTalents(r.talents);
    const ach = obj(r.achievements);
    Object.keys(ach).slice(0, 64).forEach(k => {
      const t = Number(ach[k]);
      if (isFinite(t)) out.achievements[k] = t;
    });
    out.archives = strList(r.archives, []);
    const nodes = obj(r.nodes);
    Object.keys(nodes).slice(0, 16).forEach(k => {
      out.nodes[k] = Math.floor(num(nodes[k], 0, 0, 5));
    });
    const ds = d.settings;
    out.settings = {
      master: num(st.master, ds.master, 0, 1),
      sfx: num(st.sfx, ds.sfx, 0, 1),
      music: num(st.music, ds.music, 0, 1),
      shake: oneOf(st.shake, ds.shake, ['off', 'low', 'full']),
      particles: oneOf(st.particles, ds.particles, ['high', 'medium', 'low']),
      reducedMotion: oneOf(st.reducedMotion, ds.reducedMotion, ['auto', 'on', 'off']),
      damageNumbers: bool(st.damageNumbers, ds.damageNumbers),
      touchControls: oneOf(st.touchControls, ds.touchControls, ['auto', 'on', 'off']),
      aimAssist: oneOf(st.aimAssist, ds.aimAssist, ['off', 'low', 'strong']),
      autoPause: bool(st.autoPause, ds.autoPause),
      leftHanded: bool(st.leftHanded, ds.leftHanded),
      muted: bool(st.muted, ds.muted)
    };
    out.tutorialDone = bool(r.tutorialDone, false);
    return out;
  }

  const S = NR.save = {
    data: defaults(),
    notice: '',
    sanitizeTalents,
    sanitizeLoadout() {
      const d = S.data,
        tables = {
          weapons: NR.WEAPONS,
          ships: NR.SHIPS,
          abilities: NR.ABILITIES,
          arenas: NR.ARENAS
        },
        keys = {
          weapons: 'weapon',
          ships: 'ship',
          abilities: 'ability',
          arenas: 'arena'
        };
      Object.keys(tables).forEach(k => {
        d.unlocks[k] = d.unlocks[k].filter(id => Object.prototype.hasOwnProperty.call(tables[k], id));
        const f = defaults().unlocks[k][0];
        if (!d.unlocks[k].includes(f)) d.unlocks[k].unshift(f);
        if (!d.unlocks[k].includes(d.loadout[keys[k]])) d.loadout[keys[k]] = f;
      });
    },
    load() {
      S.notice = '';
      const raw = read(KEY);
      if (raw === null) {
        S.data = defaults();
        const v1 = Number(read(V1KEY)); /* one-time V1 migration */
        if (isFinite(v1) && v1 > 0) {
          S.data.best = Math.floor(clamp(v1, 0, 1e9));
        }
        S.data.talents = readLegacyTalents();
        S.commit(true);
        return S.data;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.v !== 2) throw new Error('bad shape');
        S.data = validate(parsed);
        // The main save is authoritative. Use the old key only for older saves
        // with no talents field; never resurrect talents removed by respec/import.
        if (!Object.prototype.hasOwnProperty.call(parsed, 'talents')) {
          S.data.talents = readLegacyTalents();
        }
        S.commit(true);
      } catch (e) {
        write(BADKEY, String(raw).slice(0, 200000));
        S.data = defaults();
        S.notice = 'Save data was damaged. Started a fresh save (old copy kept).';
        S.commit(true);
      }
      return S.data;
    },
    commit(now) {
      dirty = true;
      if (now) return S.flush();
      if (!timer) timer = setTimeout(S.flush, 400);
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!dirty) return;
      dirty = false;
      try {
        write(KEY, JSON.stringify(S.data));
        write(TALENTS_KEY, JSON.stringify(S.data.talents || {}));
      } catch (e) {
        /* ignore */ }
    },
    reset() {
      S.data = defaults();
      S.commit(true);
    },
    exportSave() {
      const payload = JSON.stringify(validate(S.data));
      const b64 = btoa(unescape(encodeURIComponent(payload)));
      const cs = checksum(payload).toString(16).padStart(8, '0');
      const prefix = (NR.CONFIG.saveExport && NR.CONFIG.saveExport.prefix) || 'NRSAVE1';
      return prefix + ':' + cs + ':' + b64;
    },
    importSave(encoded) {
      if (!encoded || typeof encoded !== 'string') throw new Error('Empty save string provided.');
      const parts = encoded.trim().split(':');
      const prefix = (NR.CONFIG.saveExport && NR.CONFIG.saveExport.prefix) || 'NRSAVE1';
      if (parts.length !== 3 || parts[0] !== prefix) {
        throw new Error('Invalid save format. Expected ' + prefix + ' header.');
      }
      const expectedCs = parts[1];
      let json = '';
      try {
        json = decodeURIComponent(escape(atob(parts[2])));
      } catch (e) {
        throw new Error('Corrupted or invalid Base64 data payload.');
      }
      const actualCs = checksum(json).toString(16).padStart(8, '0');
      if (actualCs !== expectedCs) {
        throw new Error('Integrity checksum verification failed. Save is corrupted.');
      }
      let parsed = null;
      try {
        parsed = JSON.parse(json);
      } catch (e) {
        throw new Error('Malformed JSON content in save payload.');
      }
      if (!parsed || parsed.v !== 2) {
        throw new Error('Incompatible save schema version.');
      }
      S.data = validate(parsed);
      S.sanitizeLoadout();
      S.commit(true);
      return { success: true, shards: S.data.shards, best: S.data.best };
    },
    respecTalents() {
      const talents = sanitizeTalents(S.data.talents);
      const cfg = NR.CONFIG.TALENTS;
      let refund = 0;
      if (cfg && cfg.branches) {
        Object.values(cfg.branches).forEach(b => {
          b.nodes.forEach(n => {
            const rank = talents[n.id] || 0;
            for (let r = 0; r < rank; r++) {
              refund += Math.round(n.baseCost * Math.pow(cfg.growth, r));
            }
          });
        });
      }
      S.data.shards += refund;
      S.data.talents = {};
      S.commit(true);
      return refund;
    },
    debugCorrupt() {
      write(KEY, '{not valid json');
    }
  };

  window.addEventListener('pagehide', S.flush);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) S.flush();
  });
})();
