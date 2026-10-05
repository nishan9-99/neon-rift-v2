(function() {
  'use strict';
  const N = window.NR,
    C = N.CONFIG,
    U = N.utils;
  let el = {},
    cache = {},
    msg = 0,
    toasts = [],
    toastTime = 0,
    lock = 0,
    picks = [],
    reward = false,
    back = 'MENU',
    perfTime = 0,
    selected = 0,
    resuming = 0,
    countItems = [],
    countTime = 0;
  const $ = id => document.getElementById(id),
    txt = (id, v) => {
      if (cache[id] !== v) {
        cache[id] = v;
        $(id).textContent = v;
      }
    },
    width = (id, v) => {
      v = Math.round(v * 10) / 10;
      if (cache[id] !== v) {
        cache[id] = v;
        $(id).style.width = v + '%';
      }
    };

  function button(label, fn, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = cls || 'ghost';
    b.setAttribute('aria-label', label);
    b.onclick = () => {
      N.audio.unlock();
      N.bus.emit('ui:click');
      fn(b);
    };
    return b;
  }

  function open(title, desc, state) {
    N.game.setState(state);
    N.ui.showCard({
      eyebrow: 'RIFT PROTOCOL',
      title,
      desc,
      buttons: [{
        label: 'BACK',
        onClick: () => N.ui.back()
      }]
    });
    $('panelContent').textContent = '';
  }
  N.ui = {
    init() {
      ['footer', 'message', 'toast', 'veil', 'perf'].forEach(id => el[id] = $(id));
      $('footer').textContent = C.FOOTER;
      $('soundBtn').onclick = () => N.audio.setMuted(!N.audio.isMuted());
      $('pauseBtn').onclick = () => N.game.togglePause();
      N.bus.on('waveStarted', d => this.announce(d.boss ? 'RIFT SIGNATURE DETECTED // BOSS INCOMING' : 'WAVE ' + U.pad2(d.wave) + ' // HOSTILES DETECTED', .9));
      N.bus.on('waveCleared', d => this.announce((d.flawless ? 'FLAWLESS // ' : '') + 'WAVE CLEARED +' + d.bonus, 1.6));
      N.bus.on('achievementUnlocked', d => this.toast('ACHIEVEMENT UNLOCKED // ' + d.name + ' +' + d.reward + ' SHARDS', 2.5));
      N.bus.on('input:key', k => {
        if (N.game.state === 'RUN_SUMMARY') countTime = 1.5;
        if (N.game.state === 'LEVEL_UP' || N.game.state === 'BOSS_REWARD') {
          if (['1', '2', '3'].includes(k)) this.choose(+k - 1);
          if (k === 'r') this.reroll();
          if (k === 'arrowright' || k === 'arrowleft') {
            selected = (selected + (k === 'arrowright' ? 1 : 2)) % 3;
            const b = $('panelContent').querySelectorAll('.protocol');
            if (b[selected]) b[selected].focus();
          }
        } else if (k === 'escape' && ['LOADOUT', 'ARCHIVES', 'ACHIEVEMENTS', 'SETTINGS'].includes(N.game.state)) this.back();
      });
      $('veil').addEventListener('keydown', e => {
        if (e.key === 'Tab') {
          const focus = [...$('veil').querySelectorAll('button:not(:disabled),input,select')].filter(e => !e.hidden),
            first = focus[0],
            last = focus[focus.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
          return;
        }
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key) || ['LEVEL_UP', 'BOSS_REWARD'].includes(N.game.state)) return;
        const bs = [...$('veil').querySelectorAll('button,input,select')],
          i = bs.indexOf(document.activeElement);
        if (bs.length) bs[(i + (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1) + bs.length) % bs.length].focus();
        e.preventDefault();
      });
    },
    back() {
      if (back === 'PAUSED') {
        N.game.setState('PAUSED');
      } else N.game.setState('MENU');
    },
    setScreen(n) {
      document.body.dataset.screen = n;
    },
    showCard(s) {
      $('eyebrow').textContent = s.eyebrow || '';
      $('title').innerHTML = s.title || '';
      $('description').textContent = s.desc || '';
      $('instructions').innerHTML = s.info || '';
      $('instructions').hidden = !s.info;
      $('footer').hidden = !s.footer;
      $('panelContent').textContent = '';
      $('cardButtons').textContent = '';
      $('veil').classList.remove('hidden');
      $('veil').querySelector('.card').classList.remove('wide');
      (s.buttons || []).forEach(d => {
        let armed = false;
        const b = button(d.label, btn => {
          if (d.confirm && !armed) {
            armed = true;
            btn.textContent = 'CLICK AGAIN TO CONFIRM';
            setTimeout(() => {
              armed = false;
              btn.textContent = d.label;
            }, 3000);
            return;
          }
          d.onClick(btn);
        }, d.primary ? 'primary' : 'ghost');
        $('cardButtons').append(b);
      });
      const first = $('cardButtons').querySelector('button');
      if (first) first.focus({
        preventScroll: true
      });
    },
    hideCard() {
      $('veil').classList.add('hidden');
      if (document.activeElement !== document.body) document.activeElement.blur();
    },
    cardVisible() {
      return !$('veil').classList.contains('hidden');
    },
    clearAnnounce() {
      el.message.classList.remove('on');
      msg = 0;
    },
    announce(s, d) {
      el.message.textContent = s;
      el.message.classList.add('on');
      msg = d || 1.6;
    },
    toast(s, d) {
      toasts.push({
        s,
        d: d || 3
      });
    },
    perfOverlay(on) {
      el.perf.hidden = !on;
    },
    startCountUp() {
      countTime = 0;
      countItems = [...document.querySelectorAll('.summary-grid b')].filter(e => /^\+?[0-9,]+$/.test(e.textContent)).map(e => ({
        e,
        n: Number(e.textContent.replace(/[+,]/g, '')),
        plus: e.textContent.startsWith('+')
      }));
    },
    countUp(dt) {
      countTime = Math.min(1.5, countTime + dt);
      for (const o of countItems) o.e.textContent = (o.plus ? '+' : '') + Math.round(o.n * Math.min(1, countTime / 1.5)).toLocaleString();
    },
    menu() {
      back = 'MENU';
      this.setScreen('menu');
      this.showCard({
        eyebrow: 'RIFT PROTOCOL',
        title: 'NEON <span>RIFT</span>',
        desc: 'Break the swarm. Build your protocol. Collapse the rift.',
        info: '<span class="badge">' + N.save.data.shards + ' RIFT SHARDS</span> <span class="badge">BEST ' + N.save.data.best.toLocaleString() + '</span>',
        footer: true,
        buttons: [{
          label: 'ENTER THE RIFT',
          primary: true,
          onClick: () => N.game.startRun()
        }, {
          label: 'LOADOUT / ARMORY',
          onClick: () => this.loadout()
        }, {
          label: 'ARCHIVES',
          onClick: () => this.archives('enemies')
        }, {
          label: 'ACHIEVEMENTS',
          onClick: () => this.achievementScreen()
        }, {
          label: 'SETTINGS',
          onClick: () => this.settings('MENU')
        }, {
          label: 'HOW TO PLAY',
          onClick: () => this.help()
        }]
      });
    },
    help() {
      back = 'MENU';
      open('HOW TO <span>PLAY</span>', 'Keep moving. Collect XP diamonds. Pick protocols. A boss arrives every fifth wave.', 'ARCHIVES');
      $('panelContent').innerHTML = '<div class="help-grid"><p>WASD / ARROWS: move<br>MOUSE: aim<br>HOLD CLICK: fire<br>SPACE: Phase Dash<br>E / SHIFT: ability<br>P / ESC: pause<br>1 / 2 / 3: protocol choice</p><p>TOUCH: left stick moves. Drag the right side or hold FIRE to fire. DASH and ABILITY are separate buttons.<br>Rail: hold to charge, release to fire.<br>Dash through shock rings. Follow dashed warnings.</p></div>';
    },
    loadout(subtab) {
      subtab = subtab || 'equipment';
      if (subtab === 'matrix') return this.coreMatrix();
      back = 'MENU';
      const s = N.save.data;
      open('RIFT <span>ARMORY</span>', s.shards.toLocaleString() + ' RIFT SHARDS // CONFIGURE LOADOUT', 'LOADOUT');
      $('veil').querySelector('.card').classList.add('wide');

      const nav = document.createElement('div');
      nav.className = 'armory-nav';
      nav.append(button('EQUIPMENT', () => this.loadout('equipment'), 'primary'));
      nav.append(button('CORE MATRIX', () => this.loadout('matrix'), 'ghost'));
      $('panelContent').append(nav);

      const tables = {
          weapons: N.WEAPONS,
          ships: N.SHIPS,
          abilities: N.ABILITIES,
          arenas: N.ARENAS
        },
        keys = {
          weapons: 'weapon',
          ships: 'ship',
          abilities: 'ability',
          arenas: 'arena'
        };
      Object.entries(tables).forEach(([group, table]) => {
        const section = document.createElement('section');
        section.className = 'armory';
        const h = document.createElement('h2');
        h.textContent = group.toUpperCase();
        section.append(h);
        Object.entries(table).forEach(([id, d]) => {
          const owned = s.unlocks[group].includes(id),
            active = s.loadout[keys[group]] === id,
            row = document.createElement('div');
          row.className = 'item' + (active ? ' selected' : '');
          const info = document.createElement('div');
          info.innerHTML = '<strong>' + d.name + '</strong><p>' + (d.description || (id === 'shockburst' ? '170 radius / 60 damage / 14s cooldown' : 'Innate movement tool')) + '</p>';
          const bars = document.createElement('div');
          bars.className = 'statbars';
          if (group === 'weapons') bars.innerHTML = '<small>DAMAGE</small><meter min="0" max="120" value="' + d.damage + '"></meter><small>RATE</small><meter min="0" max="10" value="' + (1 / d.cooldown) + '"></meter>';
          if (group === 'ships') bars.innerHTML = '<svg width="80" height="44" viewBox="0 0 80 44" aria-label="Ship preview"><path d="M66 22L14 5L22 22L14 39Z" fill="#54F1DC" stroke="#EBFAFF"/><circle cx="34" cy="22" r="7" fill="#102c43"/></svg>';
          info.append(bars);
          row.append(info);
          row.append(button(owned ? (active ? 'EQUIPPED' : 'EQUIP') : d.bossUnlock ? 'DEFEAT FIRST BOSS' : 'BUY ' + d.price + ' SHARDS', () => {
            if (owned) {
              s.loadout[keys[group]] = id;
              N.discover(group, id);
            } else if (!d.bossUnlock && s.shards >= d.price) {
              s.shards -= d.price;
              s.unlocks[group].push(id);
              s.loadout[keys[group]] = id;
              N.discover(group, id);
              N.achievements.check();
            } else {
              this.toast(d.bossUnlock ? 'Defeat the Rift Overlord to unlock' : 'Not enough Rift Shards');
              return;
            }
            N.save.commit(true);
            this.loadout('equipment');
          }));
          section.append(row);
        });
        $('panelContent').append(section);
      });
    },
    coreMatrix() {
      back = 'MENU';
      const s = N.save.data;
      s.talents = N.save.sanitizeTalents(s.talents);
      open('CORE <span>MATRIX</span>', 'PERMANENT PROTOCOL GRID // ' + s.shards.toLocaleString() + ' RIFT SHARDS AVAILABLE', 'LOADOUT');
      $('veil').querySelector('.card').classList.add('wide');

      const nav = document.createElement('div');
      nav.className = 'armory-nav';
      nav.append(button('EQUIPMENT', () => this.loadout('equipment'), 'ghost'));
      nav.append(button('CORE MATRIX', () => this.loadout('matrix'), 'primary'));
      $('panelContent').append(nav);

      const container = document.createElement('div');
      container.className = 'matrix-container';

      const header = document.createElement('div');
      header.className = 'matrix-header';
      header.innerHTML = '<span class="matrix-shards">CURRENT SHARDS: <b>' + s.shards.toLocaleString() + '</b></span>';

      const respecBtn = button('RESPEC MATRIX (REFUND SHARDS)', () => {
        const refund = N.save.respecTalents();
        this.toast('Matrix refunded ' + refund + ' Rift Shards!', 2.5);
        this.coreMatrix();
      }, 'ghost');
      header.append(respecBtn);
      container.append(header);

      const branchesDiv = document.createElement('div');
      branchesDiv.className = 'matrix-branches';

      const cfg = N.CONFIG.TALENTS || {};
      Object.entries(cfg.branches || {}).forEach(([bKey, branch]) => {
        const bCol = document.createElement('div');
        bCol.className = 'matrix-branch ' + bKey;
        const bTitle = document.createElement('h2');
        bTitle.textContent = branch.name + ' PROTOCOLS';
        bCol.append(bTitle);

        const nodesDiv = document.createElement('div');
        nodesDiv.className = 'matrix-nodes';

        branch.nodes.forEach((node, idx) => {
          const rank = Math.max(0, Math.min(node.max, Math.floor(Number(s.talents[node.id]) || 0)));
          const maxed = rank >= node.max;
          const prereqMet = idx === 0 || (s.talents[branch.nodes[idx - 1].id] || 0) >= 1;
          const locked = !prereqMet;
          const cost = Math.round(node.baseCost * Math.pow(cfg.growth || 1.8, rank));
          const canAfford = s.shards >= cost;

          const nCard = document.createElement('div');
          nCard.className = 'matrix-node' + (locked ? ' locked' : '') + (maxed ? ' maxed' : '');

          const pips = '◆'.repeat(rank) + '◇'.repeat(Math.max(0, node.max - rank));
          const top = document.createElement('div');
          top.className = 'node-top';
          top.innerHTML = '<strong>' + (locked ? '🔒 ' : '') + node.name + '</strong><span class="node-pips">' + pips + ' ' + rank + '/' + node.max + '</span>';
          nCard.append(top);

          const desc = document.createElement('p');
          desc.className = 'node-desc';
          const curText = rank > 0 ? node.label(node.per * rank) : 'None';
          const nextText = !maxed ? node.label(node.per * (rank + 1)) : 'Max Rank';
          desc.innerHTML = (locked ? '<span style="color:#ff456b">Requires rank 1 in ' + branch.nodes[idx - 1].name + '</span><br>' : '') +
                           'Active: <b>' + curText + '</b>' +
                           (!maxed && !locked ? '<br>Next: <span style="color:#54F1DC">' + nextText + '</span>' : '');
          nCard.append(desc);

          const action = document.createElement('div');
          action.className = 'node-action';
          let btnLabel = 'UPGRADE (' + cost + ' SHARDS)';
          if (locked) btnLabel = 'LOCKED';
          else if (maxed) btnLabel = 'MAX RANK ACHIEVED';
          else if (!canAfford) btnLabel = 'NEED ' + cost + ' SHARDS';

          const upBtn = button(btnLabel, () => {
            if (locked || maxed || !canAfford) return;
            s.shards -= cost;
            s.talents[node.id] = rank + 1;
            N.save.commit(true);
            N.audio.play('upgrade');
            this.coreMatrix();
          }, locked || maxed ? 'ghost' : (canAfford ? 'primary' : 'ghost'));
          if (locked || maxed || !canAfford) upBtn.disabled = true;
          action.append(upBtn);
          nCard.append(action);

          nodesDiv.append(nCard);
        });

        bCol.append(nodesDiv);
        branchesDiv.append(bCol);
      });

      container.append(branchesDiv);
      $('panelContent').append(container);
    },
    showSaveModal(title, text, isExport) {
      open(title, isExport ? 'Copy your save data or store it safely.' : 'Paste exported save data below and confirm.', 'SETTINGS');
      $('veil').querySelector('.card').classList.add('wide');
      const box = document.createElement('div');
      box.className = 'save-modal';

      const ta = document.createElement('textarea');
      ta.value = text;
      ta.readOnly = isExport;
      ta.placeholder = isExport ? '' : 'Paste NRSAVE1:... string here';
      box.append(ta);

      const row = document.createElement('div');
      row.className = 'save-actions';

      if (isExport) {
        row.append(button('COPY TO CLIPBOARD', () => {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(ta.value).then(() => this.toast('Copied save string to clipboard!', 2.5)).catch(() => {});
          } else {
            ta.select();
            document.execCommand('copy');
            this.toast('Copied save to clipboard!', 2.5);
          }
        }, 'primary'));
        row.append(button('DOWNLOAD SAVE FILE', () => {
          const blob = new Blob([ta.value], { type: 'text/plain' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'neon-rift-save.txt';
          a.click();
          this.toast('Save file downloaded!', 2);
        }));
      } else {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt';
        fileInput.style.display = 'none';
        fileInput.onchange = e => {
          const f = e.target.files && e.target.files[0];
          if (f) {
            const reader = new FileReader();
            reader.onload = ev => {
              ta.value = ev.target.result;
            };
            reader.readAsText(f);
          }
        };
        box.append(fileInput);

        row.append(button('SELECT SAVE FILE', () => fileInput.click()));
        row.append(button('CONFIRM RESTORE', () => {
          try {
            const res = N.save.importSave(ta.value);
            this.toast('Save restored successfully! Best: ' + res.best.toLocaleString() + ' | Shards: ' + res.shards, 3);
            this.settings('MENU');
          } catch (err) {
            this.toast('Import failed: ' + err.message, 3.5);
          }
        }, 'primary'));
      }

      box.append(row);
      $('panelContent').append(box);
    },
    settings(from) {
      back = from || back;
      open('SYSTEM <span>SETTINGS</span>', 'Settings apply immediately. All data stays on this device.', 'SETTINGS');
      const s = N.save.data.settings,
        form = document.createElement('div');
      form.className = 'settings';
      const apply = () => {
        N.save.commit();
        N.audio.applyVolumes();
        const touch = s.touchControls === 'on' || s.touchControls === 'auto' && N.input.touchCapable;
        document.body.dataset.touch = touch ? 'on' : 'off';
        document.body.dataset.left = s.leftHanded ? 'on' : 'off';
        document.body.dataset.reduced = N.reduced() ? 'on' : 'off';
      };
      ['master', 'sfx', 'music'].forEach(k => {
        const l = document.createElement('label');
        l.textContent = k.toUpperCase() + ' VOLUME';
        const i = document.createElement('input');
        i.type = 'range';
        i.min = 0;
        i.max = 1;
        i.step = .01;
        i.value = s[k];
        i.setAttribute('aria-label', l.textContent);
        i.oninput = () => {
          s[k] = +i.value;
          apply();
        };
        l.append(i);
        form.append(l);
      });
      const enums = {
        shake: ['off', 'low', 'full'],
        particles: ['high', 'medium', 'low'],
        reducedMotion: ['auto', 'on', 'off'],
        touchControls: ['auto', 'on', 'off'],
        aimAssist: ['off', 'low', 'strong']
      };
      Object.entries(enums).forEach(([k, a]) => {
        const l = document.createElement('label');
        l.textContent = (k === 'aimAssist' ? 'TOUCH AIM-ASSIST' : k.replace(/([A-Z])/g, ' $1')).toUpperCase();
        const select = document.createElement('select');
        a.forEach(v => {
          const o = document.createElement('option');
          o.textContent = v.toUpperCase();
          o.value = v;
          select.append(o);
        });
        select.value = s[k] || a[0];
        select.onchange = () => {
          s[k] = select.value;
          apply();
        };
        l.append(select);
        form.append(l);
      });
      ['damageNumbers', 'autoPause', 'leftHanded', 'muted'].forEach(k => {
        const l = document.createElement('label');
        l.textContent = k.replace(/([A-Z])/g, ' $1').toUpperCase();
        const i = document.createElement('input');
        i.type = 'checkbox';
        i.checked = s[k];
        i.onchange = () => {
          s[k] = i.checked;
          apply();
        };
        l.append(i);
        form.append(l);
      });

      /* Save Export & Import */
      const saveSec = document.createElement('div');
      saveSec.className = 'armory';
      saveSec.innerHTML = '<h2>SAVE DATA BACKUP & RESTORE</h2>';
      const saveActions = document.createElement('div');
      saveActions.className = 'save-actions';
      saveActions.append(button('EXPORT SAVE', () => {
        const str = N.save.exportSave();
        this.showSaveModal('EXPORT SAVE DATA', str, true);
      }));
      saveActions.append(button('IMPORT SAVE', () => {
        this.showSaveModal('IMPORT SAVE DATA', '', false);
      }));
      saveSec.append(saveActions);
      form.append(saveSec);

      let armed = false;
      form.append(button('RESET PROGRESS', b => {
        if (!armed) {
          armed = true;
          b.textContent = 'CONFIRM RESET PROGRESS';
          return;
        }
        N.save.reset();
        N.save.sanitizeLoadout();
        N.game.setState('MENU');
      }));
      $('panelContent').append(form);
    },
    archives(group) {
      back = 'MENU';
      open('RIFT <span>ARCHIVES</span>', 'Discover a protocol by meeting or using it.', 'ARCHIVES');
      $('veil').querySelector('.card').classList.add('wide');
      const tables = {
          enemies: N.ENEMY_TYPES,
          weapons: Object.assign({}, N.WEAPONS, N.CONFIG.EVOLUTIONS || {}),
          bosses: N.BOSSES,
          upgrades: N.UPGRADES,
          ships: N.SHIPS,
          arenas: N.ARENAS
        },
        tabs = document.createElement('nav');
      Object.keys(tables).forEach(k => tabs.append(button(k.toUpperCase(), () => this.archives(k), group === k ? 'primary' : 'ghost')));
      $('panelContent').append(tabs);
      const lore = {
        chaser: 'A pursuit signal with no exit condition.',
        dasher: 'A burst engine wrapped around a razor core.',
        tank: 'Heavy plating protects a patient hunter.',
        phantom: 'A phase echo that attacks only after revealing its position.',
        bomber: 'A volatile core whose warning ring buys your escape.',
        mage: 'An unstable caster that relocates between volleys.',
        sentinel: 'A guardian that shields nearby allies.',
        overlord: 'Three rings anchor the fracture. Break its core to collapse the rift.',
        null_sentinel: 'Geometric sentinel commanding rotating quadrant death beams and satellite shield pylons.'
      };
      const grid = document.createElement('div');
      grid.className = 'archive-grid';
      Object.entries(tables[group]).forEach(([id, d]) => {
        const known = N.save.data.archives.includes(group + ':' + id),
          card = document.createElement('article');
        card.innerHTML = '<div class="vector">' + (known ? '<svg width="70" height="50" viewBox="0 0 70 50" aria-label="Entity preview"><polygon points="' + ({
          tri: '58,25 15,5 15,45',
          square: '15,5 55,5 55,45 15,45',
          hex: '55,25 45,7 25,7 15,25 25,43 45,43',
          oct: '55,15 45,5 25,5 15,15 15,35 25,45 45,45 55,35',
          pent: '35,3 58,20 48,45 22,45 12,20',
          diamond: '35,3 58,25 35,47 12,25',
          spike: '35,3 40,15 55,10 48,25 58,38 40,36 35,48 28,36 10,38 20,25 12,10 28,15'
        } [d.shape] || '35,3 58,25 35,47 12,25') + '" fill="#102136" stroke="' + (d.color || '#54F1DC') + '" stroke-width="2"/></svg>' : '?') + '</div><h3>' + (known ? d.name : '??? UNKNOWN ENTITY') + '</h3><p>' + (known ? (d.description ? typeof d.description === 'function' ? d.description(1) : d.description : (lore[id] || 'A decoded signal from the rift.') + ' / THREAT ' + ('★'.repeat(Math.min(5, Math.ceil(d.cost || 3))))) : (d.bossUnlock ? 'Defeat the Rift Overlord.' : group === 'bosses' ? 'Reach wave 5.' : d.from ? 'Encounter from wave ' + d.from + '.' : 'Meet or equip this entity to decode it.')) + '</p>' + (known && d.damage ? '<p>DAMAGE ' + d.damage + ' / COOLDOWN ' + d.cooldown + 's</p>' : '') + (known && d.contact ? '<p>CONTACT ' + d.contact + ' / THREAT ' + (d.cost || 5) + '</p>' : '');
        grid.append(card);
      });
      $('panelContent').append(grid);
    },
    achievementScreen() {
      back = 'MENU';
      open('RIFT <span>ACHIEVEMENTS</span>', 'Master the arena. Rewards are awarded only once.', 'ACHIEVEMENTS');
      const grid = document.createElement('div');
      grid.className = 'archive-grid';
      Object.entries(N.ACHIEVEMENTS).forEach(([id, d]) => {
        const t = N.save.data.achievements[id],
          a = document.createElement('article');
        a.innerHTML = '<div class="vector">' + (t ? '◆' : '◇') + '</div><h3>' + d.name + '</h3><p>' + d.description + '</p><small>' + d.reward + ' SHARDS / ' + (t ? 'UNLOCKED ' + new Date(t).toLocaleDateString() : 'LOCKED') + '</small>';
        grid.append(a);
      });
      $('panelContent').append(grid);
    },
    levelUp(isReward) {
      reward = !!isReward;
      lock = C.progress.offerLock;
      resuming = 0;
      selected = 0;
      N.input.releaseAll();
      picks = N.progress.offer(reward);
      this.showCard({
        eyebrow: reward ? 'RIFT COLLAPSED // BOSS DEFEATED' : 'RIFT LEVEL UP // LEVEL ' + N.player.p.level,
        title: 'CHOOSE YOUR <span>PROTOCOL</span>',
        desc: reward ? '+' + N.world.rewardInfo.xp + ' XP / +' + N.world.rewardInfo.score + ' SCORE / +' + N.world.rewardInfo.shards + ' SHARDS' + (N.world.rewardInfo.first ? ' / NOVA SHOTGUN UNLOCKED' : '') : 'Shape the next wave. Choose one upgrade.',
        buttons: reward ? [] : [{
          label: 'REROLL (' + N.player.p.rerolls + ')',
          onClick: () => this.reroll()
        }]
      });
      $('veil').querySelector('.card').classList.add('wide');
      const grid = document.createElement('div');
      grid.className = 'protocols';
      picks.forEach((d, i) => {
        const isEvo = !!d.isEvolution;
        const b = button('', () => this.choose(i), 'protocol ' + (isEvo ? 'evolved' : (d.rarity ? d.rarity.toLowerCase() : 'common'))),
          level = (N.player.p.upgrades[d.id] || 0) + 1;
        const descText = typeof d.description === 'function' ? d.description(level) : (d.description || '');
        const catText = isEvo ? 'WEAPON EVOLUTION' : ((d.category || 'PROTOCOL') + ' / ' + (d.rarity ? d.rarity.toUpperCase() : 'COMMON'));
        const rankText = isEvo ? 'EVO' : ['I', 'II', 'III', 'IV', 'V'][Math.min(4, Math.max(0, level - 1))];
        const iconText = isEvo ? '★' : ['◈', '◇', '△'][i % 3];
        b.innerHTML = '<small>' + catText + '</small><span class="protocol-icon">' + iconText + '</span><h3>' + d.name + '</h3><b>' + rankText + '</b><p>' + descText + '</p><small>[' + (i + 1) + '] INSTALL</small>';
        grid.append(b);
      });
      $('panelContent').append(grid);
      grid.querySelector('button').focus();
    },
    reroll() {
      if (lock > 0 || resuming || reward || N.player.p.rerolls <= 0) return;
      N.player.p.rerolls--;
      this.levelUp(false);
    },
    choose(i) {
      if (lock > 0 || resuming || !picks[i]) return;
      N.progress.install(picks[i].id);
      this.announce('PROTOCOL INSTALLED', .8);
      resuming = C.progress.resumeDelay;
      $('panelContent').querySelectorAll('button').forEach(b => b.disabled = true);
      N.player.p.invuln = Math.max(N.player.p.invuln, C.progress.resumeInvuln);
      N.particles.burst(N.player.p.x, N.player.p.y, C.colors.cyan, 20, 180);
    },
    hud() {
      const W = N.world,
        p = N.player.p;
      txt('wave', U.pad2(W.wave));
      txt('score', U.pad6(Math.floor(W.score)));
      txt('best', U.pad6(N.save.data.best));
      width('health', p.hp / p.maxHp * 100);
      txt('healthText', Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp));
      $('critical').hidden = p.hp > p.maxHp * .1;
      $('health').classList.toggle('low', p.hp <= p.maxHp * .25);
      txt('hostiles', U.pad2(N.waves.remaining()));
      txt('levelLabel', 'RIFT LEVEL ' + U.pad2(p.level));
      width('xpFill', p.xp / N.progress.need(p.level) * 100);
      txt('xpText', Math.floor(p.xp) + ' / ' + N.progress.need(p.level));
      txt('combo', W.combo >= 3 ? 'COMBO x' + W.combo + ' // +' + Math.round(5 * Math.min(40, W.combo)) + '% SCORE' : '');
      width('dashFill', p.dashCd <= 0 ? 100 : (1 - p.dashCd / p.dashCdMax) * 100);
      txt('dashText', p.dashCd <= 0 ? 'READY' : p.dashCd.toFixed(1) + 's');
      width('abilityFill', p.abilityCd <= 0 ? 100 : (1 - p.abilityCd / N.stats.get().abilityCd) * 100);
      txt('abilityText', p.ability === 'shockburst' ? (p.abilityCd <= 0 ? 'READY' : p.abilityCd.toFixed(1) + 's') : 'NOT EQUIPPED');
      txt('buffs', Object.entries(p.buffs).filter(([k, v]) => v > 0).map(([k, v]) => N.PICKUPS[k].name + ' ' + v.toFixed(0) + 's').join(' · '));
      $('bossHud').hidden = !W.boss;
      if (W.boss) {
        width('bossFill', W.boss.hp / W.boss.maxHp * 100);
        txt('bossHP', Math.ceil(W.boss.hp) + ' / ' + Math.round(W.boss.maxHp));
        txt('bossName', W.boss.def.name + ' // PHASE ' + (W.boss.phase + 1));
      }
      txt('soundLabel', N.audio.isMuted() ? 'SOUND OFF' : 'SOUND ON');
      txt('soundBtn', N.audio.isMuted() ? '♪̸' : '♫');
    },
    update(real) {
      lock = Math.max(0, lock - real);
      if (['LEVEL_UP', 'BOSS_REWARD'].includes(N.game.state)) el.toast.classList.remove('on');
      else if (toastTime > 0) el.toast.classList.add('on');
      if (resuming > 0) {
        resuming -= real;
        if (resuming <= 0) {
          this.hideCard();
          if (reward) {
            N.waves.clear();
            N.game.setState('WAVE_COMPLETE');
          } else {
            N.player.p.pending = Math.max(0, N.player.p.pending - 1);
            N.game.setState(N.levelReturn || (N.world.boss ? 'BOSS_FIGHT' : 'PLAYING'));
          }
          N.player.p.invuln = Math.max(N.player.p.invuln, C.progress.resumeInvuln);
          N.input.releaseAll();
        }
      }
      const W = N.world,
        p = N.player.p;
      if (['PLAYING', 'BOSS_FIGHT'].includes(N.game.state) && !N.save.data.tutorialDone) {
        if (!p.hints) p.hints = {
          move: false,
          fire: false,
          dash: false
        };
        if (Math.hypot(p.vx, p.vy) > 40) p.hints.move = true;
        if (p.shots > 0) p.hints.fire = true;
        if (p.lastDash >= 0) p.hints.dash = true;
        const h = !p.hints.move ? 'WASD / LEFT STICK - MOVE' : !p.hints.fire ? 'MOUSE / RIGHT SIDE - AIM AND FIRE' : !p.hints.dash ? 'SPACE / DASH BUTTON - PHASE DASH' : '';
        const hint = document.getElementById('tutorialHint');
        hint.textContent = h;
        if (!h) {
          N.save.data.tutorialDone = true;
          N.save.commit();
        }
      } else document.getElementById('tutorialHint').textContent = '';
      if (msg > 0) {
        msg -= real;
        if (msg <= 0) el.message.classList.remove('on');
      }
      if (toastTime > 0 && !['LEVEL_UP', 'BOSS_REWARD'].includes(N.game.state)) {
        toastTime -= real;
        if (toastTime <= 0) el.toast.classList.remove('on');
      }
      if (toastTime <= 0 && toasts.length && !['LEVEL_UP', 'BOSS_REWARD'].includes(N.game.state)) {
        const t = toasts.shift();
        el.toast.textContent = t.s;
        el.toast.classList.add('on');
        toastTime = t.d;
      }
      if (!el.perf.hidden) {
        perfTime -= real;
        if (perfTime <= 0) {
          perfTime = .4;
          const W = N.world;
          el.perf.textContent = 'FPS ' + Math.round(W.fps) + ' / E ' + W.enemies.length + ' / B ' + W.bullets.list.length + ' / P ' + W.particles.list.length + ' / G ' + W.gems.list.length;
        }
      }
    }
  };
})();
