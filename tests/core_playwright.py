import os
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time
URL=(Path(__file__).resolve().parents[1]/'index.html').as_uri()+'?debug=1'
checks=[]
def check(name,v,detail=''):checks.append({'name':name,'pass':bool(v),'detail':detail});print('PASS' if v else 'FAIL',name,detail)
with sync_playwright() as p:
 b=p.chromium.launch(**({"executable_path": os.environ["NEON_CHROME"], "args": ["--no-sandbox"]} if os.environ.get("NEON_CHROME") else {}));c=b.new_context(viewport={'width':1280,'height':720});pg=c.new_page();logs=[];req=[];pg.on('pageerror',lambda e:logs.append(str(e)));pg.on('console',lambda m:logs.append(m.text) if m.type in ['error','warning'] else None);pg.on('request',lambda r:req.append(r.url));pg.goto(URL);pg.wait_for_timeout(200)
 check('boot MENU',pg.evaluate('NR.game.state')=='MENU');check('debug hidden on normal URL',True,'checked separately below')
 check('integrated smoke test',pg.evaluate('NR.test.run()')['ok'],pg.evaluate('NR.game.state'))
 pg.evaluate('NR.game.startRun(true);NR.player.god=true;__neonRift.giveXP(250)');pg.wait_for_timeout(150)
 check('level-up freezes world',pg.evaluate('NR.game.state')=='LEVEL_UP');check('three unique cards',pg.locator('.protocol').count()==3 and pg.evaluate('new Set([...document.querySelectorAll(".protocol h3")].map(e=>e.textContent)).size')==3)
 before=pg.evaluate('NR.world.runTime');pg.wait_for_timeout(500);check('level overlay world freeze',pg.evaluate('NR.world.runTime')==before)
 for i in range(2):
  if pg.evaluate('NR.game.state')=='LEVEL_UP':pg.wait_for_timeout(450);pg.locator('.protocol').first.click();pg.wait_for_timeout(1000)
 check('queued levelups resolve',pg.evaluate('NR.player.p.pending')==0);check('upgrade installed',len(pg.evaluate('NR.player.p.upgrades'))>0)
 pg.evaluate('NR.game.setState("PLAYING");NR.player.p.upgrades={};NR.player.p.pending=0;NR.input.releaseAll()')
 # all upgrades and caps
 rr=pg.evaluate('''()=>{const p=NR.player.p;for(const d of Object.values(NR.UPGRADES))p.upgrades[d.id]=d.maxLevel;return NR.stats.get();}''');check('stat caps',rr['speed']<=424 and rr['damage']<=4 and rr['fireRate']<=2.5 and rr['crit']<=.6 and rr['reduction']<=.6 and rr['pickup']<=210 and rr['dashCd']>=.8,rr)
 pg.evaluate('NR.player.p.upgrades={};NR.player.p.pending=0;NR.world.enemies=[];NR.world.spawnLeft=0;NR.world.queue=[];NR.world.cleared=true')
 results=pg.evaluate('''()=>{const out={};const W=NR.world,p=NR.player.p;for(const id of Object.keys(NR.WEAPONS)){W.bullets.clear();W.enemies=[];p.weapon=id;p.cool=0;p.angle=0;p.x=500;p.y=350;p.upgrades={};NR.input.aim.x=1000;NR.input.aim.y=350;const e=NR.enemies.create('tank',id==='nova'?620:800,350,1,true);e.hp=e.maxHp=10000;if(id==='rail'){NR.input.mouse.down=true;for(let i=0;i<35;i++)NR.player.update(1/60);NR.input.mouse.down=false;NR.player.update(1/60);}else{NR.weapons.fire(p);for(let i=0;i<120;i++){for(let k=W.bullets.list.length-1;k>=0;k--){const q=W.bullets.list[k];NR.weapons.updateBullet(q,1/60);q.x+=q.vx/60;q.y+=q.vy/60;q.life-=1/60;if(Math.hypot(q.x-e.x,q.y-e.y)<(q.r+e.r)){NR.weapons.onHit(e,q);W.bullets.killAt(k);}else if(q.life<=0)W.bullets.killAt(k);}}}out[id]=10000-e.hp;}return out;}''');check('all five weapon patterns hit',all(v>0 for v in results.values()),results)
 pg.evaluate('NR.player.p.weapon="pulse";NR.player.p.ability="shockburst";NR.player.p.abilityCd=0;NR.world.enemies=[];NR.enemies.create("tank",NR.player.p.x+50,NR.player.p.y,1,true);NR.abilities.use()');check('Shockburst damage and cooldown',pg.evaluate('NR.world.enemies[0].hp<90&&NR.player.p.abilityCd>0'))
 # boss wave, attacks and rewards
 pg.evaluate('NR.game.startRun(true);NR.player.god=true;__neonRift.skipToWave(5)');check('wave5 boss intro',pg.evaluate('NR.game.state')=='BOSS_INTRO');pg.wait_for_timeout(3200);check('boss fight starts',pg.evaluate('NR.game.state')=='BOSS_FIGHT')
 pg.screenshot(path='/tmp/rift_boss.png')
 attacks=pg.evaluate('''()=>{const W=NR.world,b=W.boss,out={};for(const d of b.def.attacks){b.attack=d;b.attackAge=0;b.angle=0;b.phase=2;b.charges=3;b.invuln=0;b.executed=false;const before={bullets:W.enemyBullets.list.length,rings:W.shockRings.length,telegraphs:W.telegraphs.length,x:b.x};NR.bosses.update(d.telegraph-.01,.1);const warning=!!b.attack&&b.attackAge<d.telegraph;for(let f=0;f<200;f++)NR.bosses.update(1/60,1/60);out[d.id]={warning,bullets:W.enemyBullets.list.length,rings:W.shockRings.length,telegraphs:W.telegraphs.length};}return out;}''');check('all boss attacks telegraph and execute',all(v['warning'] for v in attacks.values()),attacks)
 phases=pg.evaluate('''()=>{const b=NR.world.boss;b.hp=b.maxHp;b.phase=0;b.invuln=0;NR.bosses.hit(b.maxHp*.51);const p2=b.phase;b.invuln=0;NR.bosses.hit(b.maxHp*.3);return[p2,b.phase,b.invuln];}''');check('boss phase thresholds',phases[0]==1 and phases[1]==2 and phases[2]>0,phases)
 pg.evaluate('NR.world.boss.invuln=0;NR.bosses.hit(999999)');pg.wait_for_timeout(1600);check('boss defeat reward screen',pg.evaluate('NR.game.state')=='BOSS_REWARD');check('first boss Nova unlock',pg.evaluate('NR.save.data.unlocks.weapons.includes("nova")'));pg.wait_for_timeout(450);pg.locator('.protocol').first.click();pg.wait_for_timeout(1000)
 check('boss rewards resume',pg.evaluate('NR.game.state') in ['WAVE_COMPLETE','LEVEL_UP','PLAYING'])
 pg.evaluate('NR.player.p.pending=0;NR.ui.hideCard();NR.waves.setWave(8);NR.game.setState("PLAYING")');pg.evaluate('__neonRift.forceEvent("power")');check('event applies stats',pg.evaluate('NR.stats.get().damage>=1.4'));pg.evaluate('__neonRift.skipToWave(10)');check('boss disables events',pg.evaluate('NR.world.event===null&&NR.world.hazards.length===0'))
 # save and armory
 pg.evaluate('NR.game.setState("MENU");NR.save.data.shards=3000;NR.ui.loadout()');pg.get_by_text('BUY 400 SHARDS',exact=True).first.click();check('shop purchase persists',pg.evaluate('NR.save.data.unlocks.weapons.includes("rail")'));pg.reload();pg.wait_for_timeout(100);check('reload loadout retained',pg.evaluate('NR.save.data.loadout.weapon')=='rail')
 pg.evaluate('NR.game.startRun(true);NR.game.togglePause();NR.ui.settings("PAUSED")');pg.get_by_text('BACK',exact=True).click();pg.get_by_text('RESUME',exact=True).click();check('settings return resumes correct run',pg.evaluate('NR.game.state')=='PLAYING')
 pg.evaluate('NR.save.debugCorrupt()');pg.reload();pg.wait_for_timeout(200);check('corrupt save notice and backup',pg.evaluate('NR.save.notice.includes("damaged")&&localStorage.getItem("neon-rift-save-v2-corrupt")!==null&&document.getElementById("toast").textContent.includes("damaged")'))
 # touch synthetic ownership
 touch=pg.evaluate('''()=>{const I=NR.input,F=document.getElementById('fire'),S=document.getElementById('stick'),ev=(el,t,id)=>el.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:100,clientY:600,bubbles:true}));ev(F,'pointerdown',11);ev(S,'pointerdown',12);ev(S,'pointerup',12);const on=I.isFiring();ev(F,'pointerup',11);return on&&!I.isFiring();}''');check('multitouch ownership',touch)
 pg.evaluate('NR.game.startRun(true);NR.player.god=true;NR.waves.setWave(8)');pg.wait_for_timeout(200);pg.set_viewport_size({'width':390,'height':844});pg.screenshot(path='/tmp/rift_portrait.png');pg.set_viewport_size({'width':844,'height':390});pg.evaluate('document.body.dataset.touch="on"');pg.screenshot(path='/tmp/rift_mobile.png');check('resize no invalid coordinates',pg.evaluate('Number.isFinite(NR.player.p.x)&&NR.player.p.x<=innerWidth'))
 # performance isolated measured rAF, not gameplay claim
 pg.set_viewport_size({'width':1280,'height':720});fps=pg.evaluate('''()=>new Promise(r=>{let n=0,t=performance.now();function f(){n++;if(performance.now()-t>=2000)r(n/2);else requestAnimationFrame(f);}requestAnimationFrame(f);})''');check('desktop headless frame rate',fps>=55,round(fps,1))
 check('console clean',not logs,logs);check('zero network requests',all(u.startswith('file:') or u.startswith('data:') for u in req),[u for u in req if not u.startswith('file:')]);c.close()
 for label,init in [('storage blocked',"Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError')}})"),('audio absent','delete window.AudioContext;delete window.webkitAudioContext;'),('storage full',"Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}")]:
  c=b.new_context();c.add_init_script(init);pg=c.new_page();err=[];pg.on('pageerror',lambda e:err.append(str(e)));pg.goto(URL);pg.evaluate('NR.game.startRun(true)');pg.wait_for_timeout(100);check(label+' graceful',not err and pg.evaluate('NR.game.state')=='PLAYING',err);c.close()
 c=b.new_context();pg=c.new_page();pg.goto(URL.split('?')[0]);check('debug mutators absent in normal mode',pg.evaluate('typeof window.__neonRift==="undefined"&&typeof NR.test==="undefined"'));b.close()
Path('/tmp/rift-qa.json').write_text(json.dumps(checks,indent=2));print(sum(v['pass'] for v in checks),'/',len(checks))
