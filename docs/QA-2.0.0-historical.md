# Verification record

Build: 2.0.0, October 4, 2026. This is an honest executed-check record, not a promise that every acceptance box is proven.

## Executed
- Chrome file://: 33/33 core assertions; 25/25 effect/input assertions. No page errors or warning/error console messages in those final suites; no external network requests.
- Firefox file://: MENU/PLAYING boot and integrated `NR.test.run()` passed without page errors.
- Chrome static host: PLAYING, gesture-started Web Audio and integrated smoke passed. Two live audio nodes at the sampled point.
- Input: real mouse/keyboard move/fire/dash, pause/resume, restart, synthetic per-pointer touch ownership. Settings-return preserves the paused run. Dash invulnerability blocks damage.
- Progression: XP, queued level-ups, frozen overlay, three distinct offers, stacking/caps, maxed fallback, rarity/weapon filters, install lock, all global special effects tested individually.
- Combat: five weapon patterns hit; Shockburst; six pickups; burn/freeze/chain/explosion/singularity/barrier/revive/regen/dash ram/overkill; gem merge cap.
- Boss: wave 5/10 schedule, intro skip, five telegraphed attack paths, phase thresholds, reward screen, free pick, Nova unlock. Recurring bosses add an offset ring variant. Base-weapon idealized fights were 65-84 seconds across five weapons in the final benchmark; invincibility was used to isolate outgoing damage and scripted positioning, not to prove normal-player survivability.
- Controller-driven progression (invincibility on, actual shots/XP/wave clears, no forced kill damage) reached wave 11, level 11 and two boss wins. Upgraded first boss took 52.4 seconds in the final seed run. First level-up occurred in wave 2. Strong protocols can beat bosses faster than the 60-90s base target.
- Accelerated ~30-minute simulation: 1790.1 game seconds, reached wave 59. Max 35 enemies / 31 player bullets / 32 enemy bullets / 48 gems / 500 particles / 24 texts / 33 short effects. No NaN positions; glow cache 19. This is NOT a 30-minute wall-clock heap/audio leak benchmark.
- Storage: V1 4321 best imported; corruption backup + notice; invalid fields; unknown loadouts; unavailable/full storage; reload purchase/loadout persistence.
- Missing Web Audio did not stop play.
- Hazards: warning intervals harmless; mine deals 25 after fuse, zone deals 6, drag deals no damage. Spawn-distance sample minimum 325px in the tested desktop setup.
- Visual inspection: actual screenshots at 1280x720, 390x844 touch portrait, 844x390 touch landscape and 2560x1080 ultrawide; menus, scrollable armory/settings, protocol cards, boss HUD, all four theme contrasts. Toasts are deferred/hidden on protocol choices so cards stay readable.
- Desktop headless Chrome sampled about 60-61 requestAnimationFrame callbacks/s. This is not a guarantee for phones or all graphics hardware.
- Legacy V1 SHA-256 unchanged: 6d62b30e020d1c67a64c8efe1d87f9f8a96d4b586cccb315ddb3a8b335bf10fa.

## Still unverified or simplified
- Edge and Safari, real iOS/Android devices, physical mid-range-phone performance and a real-time 30-minute heap/audio-node soak.
- Proof that every attack/hazard is avoidable in every viewport; safety warnings and i-frames exist, but exhaustive route testing was not done.
- Sustained DPS within +/-15% for every weapon/build/range. Starting values conflict with this target; Arc/Void were tuned, while measured fight times remain the disclosed benchmark.
- Exact last-detail visual/audio parity with the full brief. Some cues share recipes, no camera zoom, summary count-up is compact, archives use simple vector previews. Some effect timings/constants remain inline rather than all living in config/data.
- Fourteen-mode state structure is present and draw/update/enter/exit/onInput hooks exist, but world drawing is centralized through the renderer rather than separate bespoke drawings for each mode.
- The folder is fully playable without installs. Optional Python tests are development-only.
- Optional COULD tier omitted: alternate abilities, permanent nodes, second boss, save export/import, auto-aim, Laser Grid. No Git tags, deploy, account, ads, external assets or backend.

## Manual acceptance pass for the owner
1. Extract the folder, open root index.html, enter; move/aim/fire/dash and confirm the V1 feel.
2. Play waves 1-2, collect diamonds, choose with click / 1-3. Pause while a cooldown/buff runs, resume.
3. Reach wave 5. Dodge dashed warnings, dash through shock rings, defeat Overlord; check rewards and Nova unlock.
4. Die, read summary, buy a ship/weapon/arena, reload and confirm it persists.
5. Test touch movement + aim/fire with separate fingers, lift just the movement finger, then dash/ability.
6. Rotate, try portrait and landscape; test reduced motion, muted play and each arena.
7. On Edge/Safari/real phone, report any exact console error or control issue for a root-cause fix.
