# Changelog

## 2.0.1 - owner review build (October 5, 2026)
- Shared talent validation on main-save load, legacy-key migration, import, export, respec and grid entry. Unknown IDs removed; integer ranks capped per node; prerequisite chain enforced; safe grid pip counts.
- Main save takes precedence over stale dedicated talent key. Persist normalized migration. Preserve Scavenger Matrix fractional reward accumulator across reload.
- Elite Radar now increases base elite-affix probability by 15% relatively per rank, retains alive caps and awards +1 shard per rank. Label now states relative elite-affix chance.
- Singularity Lance pull direction fixed; pull amount capped to distance from beam.
- README/QA refreshed; obsolete guides/reports labeled historical. Added current setup/review guide and 25-case regression suite.
- Test scripts optionally accept NEON_CHROME, and the targeted fallback assertion accepts an eligible evolution before fallback cards.
- Current results/screenshots included, Python cache and duplicate guide removed. No GitHub push or deployment.


## 2.0.0 - playable RIFT PROTOCOL build (October 4, 2026)
The owner's updated request asked for a continuous full build instead of phase-by-phase stops. Phase numbers below describe work groups, not separate public releases or Git tags. Nothing was deployed or pushed.

- Phase 0: audited the supplied root Phase 1 code and preserved the legacy V1 file byte-for-byte. Original test result: 26/27; corrupt-save notice timing failed.
- Phase 1 repairs: retained classic NR scripts, baseline movement/dash/Pulse and HP rescale; corrected corrupted loadout validation, storage fallback precedence, spawn warning bounds, safe transitions and pause/settings return.
- Phase 2: XP/gems, levels, queued three-card offers, stat pipeline, 28 global protocols plus weapon protocols, caps, combo and pooled texts.
- Phase 3: five weapon patterns, charge/release Rail, Shockburst, four ships, persistent loadout and armory preview.
- Phase 4: threat-budget director, scripted introductions, seven enemy types, affixes, elite/alive caps, six powerups and warnings.
- Phase 5: data-driven Rift Overlord, five attacks, phases, scalable recurring bosses, rewards, Nova unlock and boss HUD. Alpha milestone implemented; no Git tag created.
- Phase 6: run summary/count-up, shards/shop, 12 achievements, archives/settings, migration/validation/corrupt recovery. Beta milestone implemented; no Git tag created.
- Phase 7: four themes, five events, Mine/Rift Zone/Drag Field; events disabled on boss waves.
- Phase 8: synthesized audio/music, voice limits, reduced motion, focus navigation/trap, touch layouts, flash limits, quality tiers and visual checks.
- Phase 9: automated tests, controller-driven run through waves 1-10, accelerated near-30-minute game-time soak, Chrome/Firefox checks, README, guide and honest QA notes.

### Tuning / interpretation
- Arc direct damage 9 -> 14; Void direct damage 20 -> 44, to improve their single-target pace without changing patterns.
- First boss grants 50 shards; subsequent bosses grant 40, reconciling the brief's reward screen with the meta formula.
- Energy Mine has a 1s spawn warning followed by a 0.8s proximity fuse. Volatile enemy affixes retain the brief's separate 0.5s warning.
- Late Tank speed is capped at 130 to follow the stated global speed-cap rule.

### Not claimed
No Safari/Edge/device matrix completion, real-phone 60fps guarantee, no-unavoidable-damage proof, measured heap-stability guarantee or exact ±15% sustained-DPS result. Optional COULD tier not shipped. See docs/QA.md.
