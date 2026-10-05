import os
from playwright.sync_api import sync_playwright
import json
from pathlib import Path
checks=[]
def ck(n,v,d=''):checks.append({'name':n,'pass':bool(v),'detail':d});print('PASS' if v else 'FAIL',n,d)
with sync_playwright() as pw:
 b=pw.chromium.launch(**({"executable_path": os.environ["NEON_CHROME"], "args": ["--no-sandbox"]} if os.environ.get("NEON_CHROME") else {}));pg=b.new_page(viewport={'width':1280,'height':720});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.goto((Path(__file__).resolve().parents[1]/'index.html').as_uri()+'?debug=1');pg.evaluate('NR.game.startRun(true);NR.player.god=true')
 r=pg.evaluate('''()=>{const N=NR,W=N.world,p=N.player.p;let out={};N.game.setState('PLAYING');p.upgrades={};p.buffs={};p.weapon='pulse';const e=N.enemies.create('tank',p.x+100,p.y,1,true);e.hp=e.maxHp=10000;
N.progress.install('burn');N.combat.hit(e,100,e.x,e.y);out.burn=e.burns.length>0;N.progress.install('freeze');N.rng.chance=()=>true;N.combat.hit(e,10,e.x,e.y);out.freeze=e.slow===2;N.progress.install('chain');const e2=N.enemies.create('tank',e.x+20,e.y,1,true);N.combat.hit(e,10,e.x,e.y);out.chain=e2.hp<90;N.progress.install('explosive');const e3=N.enemies.create('tank',e.x+25,e.y,1,true);N.combat.hit(e,10,e.x,e.y);out.explosive=e3.hp<90;N.progress.install('singularity');p.singularityTimer=12;N.player.update(1/60);out.singularity=!!W.well;
p.upgrades={barrier:1};p.hp=21;p.invuln=0;N.player.god=false;N.player.damage(10);out.barrier=p.barrierUsed&&p.invuln===1.5&&p.hp===26;
p.upgrades={second_chance:1};p.hp=1;p.invuln=0;N.player.damage(1000);out.revive=p.alive&&p.revived&&p.hp===p.maxHp*.5;
p.upgrades={regen:2};p.hp=50;p.sinceHit=5;N.player.update(1);out.regen=p.hp>50;
p.upgrades={dash_reactor:1};p.dash=.15;const ram=N.enemies.create('tank',p.x,p.y,1,true);N.player.update(.001);out.ram=ram.hp<90;
p.upgrades={overkill:1};const kill=N.enemies.create('chaser',500,500,1,true),near=N.enemies.create('chaser',510,500,1,true);N.enemies.kill(kill);out.overkill=near.hp<20;
for(const id of Object.keys(N.PICKUPS)){p.hp=50;p.abilityCd=0;W.pickups=[];N.pickups.create(p.x,p.y,id);N.pickups.update(0);out['pickup_'+id]=id==='shield'?p.hp===75:p.buffs[id]>0;}
W.gems.clear();for(let i=0;i<200;i++)N.pickups.gem(100,100,1);out.gemCap=W.gems.list.length===120&&W.gems.list.reduce((a,g)=>a+g.value,0)===200;
p.upgrades={};N.player.god=true;return out;}''')
 for k,v in r.items():ck(k,v)
 # elite caps under affix pressure
 r=pg.evaluate('''()=>{NR.world.enemies=[];NR.world.wave=8;for(let i=0;i<25;i++)NR.enemies.create('chaser',300+i*5,300,8);return NR.world.enemies.filter(e=>e.elite).length;}''');ck('elite affixes respect cap',r<=1,r)
 # normal play start and death/restart sans god
 pg.evaluate('NR.game.startRun(true);NR.player.god=false');pg.mouse.move(900,350);pg.mouse.down();pg.keyboard.down('d');pg.wait_for_timeout(300);pg.keyboard.press(' ');pg.wait_for_timeout(40);pg.keyboard.up('d');pg.mouse.up();ck('real input movement dash shoot',pg.evaluate('NR.player.p.x>640&&NR.player.p.dashCd>0&&NR.player.p.shots>0'))
 pg.evaluate('NR.player.p.invuln=0;NR.player.damage(999999)');pg.wait_for_timeout(3300);ck('death summary visible',pg.evaluate('NR.game.state')=='RUN_SUMMARY');pg.screenshot(path='/tmp/rift_summary.png');pg.get_by_text('PLAY AGAIN',exact=True).click();pg.wait_for_timeout(900);ck('restart resets run',pg.evaluate('NR.world.wave===1&&NR.world.kills===0&&NR.player.p.level===1'))
 # menus visuals / focus
 pg.evaluate('NR.game.setState("MENU");NR.save.data.shards=1000;NR.ui.loadout()');pg.screenshot(path='/tmp/rift_armory.png');pg.evaluate('NR.ui.archives("enemies")');pg.screenshot(path='/tmp/rift_archives.png');pg.evaluate('NR.ui.settings("MENU")');pg.screenshot(path='/tmp/rift_settings.png');pg.locator('select').nth(2).select_option('on');ck('reduced motion immediate',pg.evaluate('NR.reduced()&&document.body.dataset.reduced==="on"'))
 pg.evaluate('NR.ui.back();NR.game.startRun(true);NR.audio.unlock()');pg.wait_for_timeout(300);ck('audio voice budget',pg.evaluate('NR.audio.voiceCount()')<=28,pg.evaluate('NR.audio.voiceCount()'))
 # proper migration fresh context
 cc=b.new_context();cc.add_init_script("localStorage.setItem('neon-rift-best','4321');localStorage.removeItem('neon-rift-save-v2')");pp=cc.new_page();pp.goto((Path(__file__).resolve().parents[1]/'index.html').as_uri());ck('V1 best-score migration',pp.evaluate('NR.save.data.best')==4321);cc.close()
 ck('extra tests console clean',not errs,errs);b.close()
Path('/tmp/rift-extra-qa.json').write_text(json.dumps(checks,indent=2));print(sum(x['pass'] for x in checks),'/',len(checks))
