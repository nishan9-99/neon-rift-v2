import os
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
out={}
with sync_playwright() as p:
 b=p.chromium.launch(**({"executable_path": os.environ["NEON_CHROME"], "args": ["--no-sandbox"]} if os.environ.get("NEON_CHROME") else {}));pg=b.new_page(viewport={'width':1280,'height':720});err=[];pg.on('pageerror',lambda e:err.append(str(e)));pg.goto((Path(__file__).resolve().parents[1]/'index.html').as_uri()+'?debug=1')
 out['hazards']=pg.evaluate('''()=>{NR.game.startRun(true);const W=NR.world,p=NR.player.p;NR.player.god=false;p.x=640;p.y=360;let out={};for(const id of ['mine','zone','drag']){p.hp=100;p.invuln=0;W.hazards=[{id,x:p.x,y:p.y,r:90,age:0,warning:NR.HAZARDS[id].warning,life:NR.HAZARDS[id].life,fuse:0,tick:0}];NR.waves.variety(.5);const safe=p.hp===100;for(let i=0;i<120;i++)NR.waves.variety(1/60);out[id]={telegraphSafe:safe,damage:100-p.hp};}return out;}''')
 out['pause_freeze']=pg.evaluate('''()=>{NR.game.startRun(true);NR.player.p.abilityCd=5;NR.player.p.buffs.core=4;NR.game.setState('PAUSED');const before=JSON.stringify({t:NR.world.t,c:NR.player.p.abilityCd,b:NR.player.p.buffs,r:NR.world.runTime});for(let i=0;i<120;i++)NR.game.step(1/60);return before===JSON.stringify({t:NR.world.t,c:NR.player.p.abilityCd,b:NR.player.p.buffs,r:NR.world.runTime});}''')
 out['spawn_safety']=pg.evaluate('''()=>{NR.game.startRun(true);const W=NR.world,p=NR.player.p;let min=Infinity;for(let i=0;i<100;i++){NR.waves.schedule('chaser');const t=W.telegraphs.at(-1);min=Math.min(min,Math.hypot(t.x-p.x,t.y-p.y));}return min;}''')
 out['rarity_and_fallback']=pg.evaluate('''()=>{const p=NR.player.p;p.upgrades={};p.weapon='rail';p.level=1;let valid=true;for(let i=0;i<100;i++){const a=NR.progress.offer(false);if(a.some(d=>['Epic','Legendary'].includes(d.rarity)||d.tags&&d.tags.length&&!d.tags.includes('rail'))||new Set(a.map(d=>d.id)).size!==3)valid=false;}Object.values(NR.UPGRADES).forEach(d=>p.upgrades[d.id]=d.maxLevel);const a=NR.progress.offer(false);return{valid,fallback:a.length===3&&a.every(d=>d.id.startsWith('fallback')||d.isEvolution)};}''')
 out['ship_tradeoffs']=pg.evaluate('''()=>{const a={};for(const ship of Object.keys(NR.SHIPS)){NR.save.data.loadout.ship=ship;NR.game.startRun(true);a[ship]=NR.stats.get();}return a;}''')
 out['boss_intro_skip']=pg.evaluate('''()=>{NR.game.startRun(true);NR.waves.setWave(5);NR.game.step(1.1);NR.bus.emit('input:any');NR.game.step(.01);return NR.game.state;}''')
 out['damage_dash_immunity']=pg.evaluate('''()=>{const p=NR.player.p;p.hp=p.maxHp;p.invuln=.3;NR.player.damage(25);return p.hp===p.maxHp;}''')
 out['errors']=err;b.close()
Path('/tmp/rift-target-qa.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
