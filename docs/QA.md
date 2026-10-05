# Verification record: 2.0.1 review build

October 5, 2026. Local Chrome tests on this fixed ZIP. Not pushed or deployed.

## Fresh executed checks
- `core_playwright.py`: 33/33 passed; no page/console errors; file://, storage blocked/full and audio-absent fallbacks.
- `effects_playwright.py`: 25/25 passed; effects, pickups, input, death/restart, migration and audio voice budget.
- `regression_playwright.py`: 25/25 passed. Overspec/negative/fractional/unknown talent imports, missing prerequisite removal, legacy talent-key migration, stale-key precedence, direct UI recovery, exact export roundtrip, wrong-checksum rejection, respec reload, persistent fractional scavenger rewards, all five evolved weapons.
- Elite Radar deterministic sample: rank 0 = 157/1,000 elite affixes; rank 3 = 210/1,000. Both use seed 123 and a fresh enemy list per spawn, isolating probability from alive caps. Rank 0/1/3 rewards = 0/1/3 shards excluding achievement rewards.
- Singularity Lance: signed offsets -20, +20 and +4 pixels moved to zero after one tick, with no cross-beam overshoot.
- `targeted_playwright.py`: hazard warnings/damage, pause freeze, spawn safety, rarity eligibility/fallback (including eligible evolutions), ship stats, intro skip and dash immunity returned valid results without page errors.
- Controller-driven invincible run: wave 11, level 11, two boss wins, 92 kills, about 287 game seconds. Real shots/XP/wave transitions, not manual enemy kill damage. This does not prove human survivability.
- Base weapon invincible boss benchmarks: Pulse 73.9s, Nova 90.0s, Rail 73.4s, Arc 74.3s, Void 63.0s. Idealized scripted position and no upgrades, not sustained DPS parity.
- Accelerated soak: 1,790.25 game seconds, wave 53. Max 35 enemies / 54 player bullets / 32 enemy bullets / 36 gems / 500 particles / 24 floating texts / 24 effects. No NaN positions. Not a wall-clock heap/audio leak benchmark.
- All 21 JavaScript modules pass syntax checking.
- Actual desktop Core Matrix, boss gameplay and portrait Core Matrix screenshots inspected; scroll layout and controls still render. Playthrough script also records portrait/landscape gameplay and protocol choice captures.

## Results and scope
JSON files in tests/ record these current runs. Missing optional Firefox/WebKit browser binaries are reported unverified, not passed. Historical reports are named separately; the earlier guide PDF is archived.

## Still unverified
Real iOS/Android input and performance, Safari/Edge/full Firefox compatibility, assistive-technology ergonomics, real-time 30-minute memory/audio stability, every hazard-dodge route, +/-15% sustained DPS parity, exact match to an absent original change brief. Evolution tests prove basic eligibility/install/damage, not exhaustive visual/balance correctness. No claim that every possible issue is fixed.

## Owner review
Extract the ZIP and open index.html. Try waves 1-5, unlock/buy an item, open the Core Matrix, make a backup in Settings, restore it, reload, and check portrait/landscape on your own phone. Do not treat imported saves as trusted or private unless you know their source.
