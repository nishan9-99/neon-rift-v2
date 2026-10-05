"""Current-build bug regressions. Uses a disposable browser profile."""
import os, json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
URL = ROOT.joinpath('index.html').as_uri() + '?debug=1'
checks = []
def check(name, passed, detail=None):
    checks.append(dict(name=name, passed=bool(passed), detail=detail))
    print('PASS' if passed else 'FAIL', name, detail if detail is not None else '')
with sync_playwright() as pw:
    b = pw.chromium.launch(**({'executable_path': os.environ['NEON_CHROME'], 'args': ['--no-sandbox']} if os.environ.get('NEON_CHROME') else {}))
    pg = b.new_page(viewport={'width':1280, 'height':720}); errors=[]
    pg.on('pageerror', lambda e: errors.append(str(e))); pg.goto(URL)
    pg.evaluate('''window.encodeTestSave = raw => {
      const json=JSON.stringify(raw); let a=1,b=0;
      for(let i=0;i<json.length;i++){a=(a+json.charCodeAt(i))%65521;b=(b+a)%65521;}
      return 'NRSAVE1:'+(((b<<16)|a)>>>0).toString(16).padStart(8,'0')+':'+btoa(unescape(encodeURIComponent(json)));
    }''')
    for label, raw, expected in [
      ('overspec', {'precision':100, 'hypercharge':999}, {'precision':5,'hypercharge':5}),
      ('negative', {'precision':-1,'hypercharge':5}, {}),
      ('fractional', {'precision':2.9}, {'precision':2}),
      ('missing prerequisites', {'hypercharge':2,'swift_bolt':1,'elite_radar':3}, {}),
      ('unknown/non-numeric', {'not_a_node':10,'precision':'oops'}, {}),
      ('array', [10], {})]:
        result=pg.evaluate('''([raw])=>{NR.save.importSave(encodeTestSave({v:2,talents:raw}));NR.ui.coreMatrix();return NR.save.data.talents;}''',[raw])
        check('import '+label, result==expected,result)
    result=pg.evaluate('''()=>{localStorage.removeItem('neon-rift-save-v2');localStorage.setItem('neon_rift_talents',JSON.stringify({precision:10,hypercharge:100,elite_radar:3,unknown:5}));NR.save.load();NR.ui.coreMatrix();return NR.save.data.talents;}''')
    check('legacy key caps/prerequisites',result=={'precision':5,'hypercharge':5},result)
    result=pg.evaluate('''()=>{localStorage.removeItem('neon-rift-save-v2');localStorage.setItem('neon_rift_talents','[1,2,3]');NR.save.load();NR.ui.coreMatrix();return NR.save.data.talents;}''')
    check('legacy key malformed shape',result=={},result)
    result=pg.evaluate('''()=>{NR.save.reset();localStorage.setItem('neon_rift_talents',JSON.stringify({precision:5}));NR.save.load();return NR.save.data.talents;}''')
    check('main save wins over stale legacy key',result=={},result)
    result=pg.evaluate('''()=>{NR.save.data.talents={precision:-100,hypercharge:Infinity};NR.ui.coreMatrix();return NR.save.data.talents;}''')
    check('UI direct invalid-state recovery',result=={},result)
    result=pg.evaluate('''()=>{NR.save.reset();NR.save.data.talents={precision:1};NR.save.data.shards=200;const x=NR.save.exportSave(),before=JSON.stringify(NR.save.data);NR.save.reset();NR.save.importSave(x);return before===JSON.stringify(NR.save.data);}''')
    check('export/import exact roundtrip',result)
    result=pg.evaluate('''()=>{let x=NR.save.exportSave();try{NR.save.importSave(x.replace(/:[0-9a-f]{8}:/,':00000000:'));return false;}catch(e){return e.message.includes('checksum');}}''')
    check('reject wrong checksum',result)
    result=pg.evaluate('''()=>{NR.save.data.talents={precision:1,hypercharge:1};NR.save.data.shards=0;const refund=NR.save.respecTalents();NR.save.load();return{refund,shards:NR.save.data.shards,talents:NR.save.data.talents};}''')
    check('respec exact refund and reload',result=={'refund':140,'shards':140,'talents':{}},result)
    result=pg.evaluate('''()=>{function sample(rank){NR.save.reset();NR.game.startRun(true);NR.save.data.talents={shard_attractor:1,scavenger_matrix:1,protocol_analyst:1,elite_radar:rank};NR.rng.seed(123);let count=0;for(let i=0;i<1000;i++){NR.world.enemies=[];if(NR.enemies.create('chaser',500,300,20).elite)count++;}return count;}return{rank0:sample(0),rank3:sample(3)};}''')
    check('Elite Radar increases spawn rate',result['rank3']>result['rank0'],result)
    result=pg.evaluate('''()=>{function sample(rank){NR.save.reset();NR.game.startRun(true);Object.keys(NR.ACHIEVEMENTS).forEach(id=>NR.save.data.achievements[id]=1);NR.save.data.talents={shard_attractor:1,scavenger_matrix:1,protocol_analyst:1,elite_radar:rank};const before=NR.save.data.shards,e=NR.enemies.create('tank',500,300,8,true);e.elite=true;NR.enemies.kill(e);return NR.save.data.shards-before;}return{rank0:sample(0),rank1:sample(1),rank3:sample(3)};}''')
    check('Elite Radar rewards match ranks',result=={'rank0':0,'rank1':1,'rank3':3},result)
    for off in [-20,20,4]:
        result=pg.evaluate('''off=>{NR.game.startRun(true);const p=NR.player.p;p.weapon='rail';p.evolvedWeapon='singularity_lance';p.angle=0;NR.input.mouse.down=true;const e=NR.enemies.create('tank',p.x+100,p.y+off,1,true);e.hp=10000;NR.weapons.rail(p,.11);return e.y-p.y;}''',off)
        check('Lance pull toward beam '+str(off),abs(result)<abs(off) and (result*off>=0),result)
    result=pg.evaluate('''()=>{NR.save.reset();NR.game.startRun(true);NR.save.data.stats.scavengerAccum=.75;NR.save.commit(true);NR.save.load();return NR.save.data.stats.scavengerAccum;}''')
    check('Scavenger fractional reward persists',result==.75,result)
    result=pg.evaluate('''()=>{let out={};for(const[id,evo]of Object.entries(NR.CONFIG.EVOLUTIONS)){NR.game.startRun(true);NR.player.god=true;const p=NR.player.p;p.weapon=evo.base;p.upgrades={};Object.values(NR.UPGRADES).filter(d=>d.tags.includes(evo.base)).forEach(d=>p.upgrades[d.id]=d.maxLevel);p.upgrades[evo.catalyst]=1;p.level=12;let offered=false;for(let i=0;i<100;i++)if(NR.progress.offer(false).some(d=>d.id===id))offered=true;NR.progress.install(id);NR.input.mouse.down=true;NR.input.aim.x=p.x+100;NR.input.aim.y=p.y;const enemy=NR.enemies.create('tank',p.x+100,p.y,1,true);enemy.hp=10000;enemy.maxHp=10000;NR.world.spawnLeft=999;NR.world.queue=[];NR.world.spawnTimer=999;for(let i=0;i<90;i++)NR.game.step(1/60);out[id]={offered,installed:p.evolvedWeapon===id,damage:10000-enemy.hp};}return out;}''')
    for key,value in result.items():check('evolution '+key,value['offered'] and value['installed'] and value['damage']>0,value)
    pg.evaluate('NR.save.reset();NR.ui.coreMatrix()');pg.wait_for_timeout(3000);pg.screenshot(path='/tmp/neon-fixed-matrix.png')
    pg.evaluate('NR.game.startRun(true);NR.player.god=true;NR.waves.setWave(5)');pg.wait_for_timeout(6000);pg.screenshot(path='/tmp/neon-fixed-boss.png')
    pg.set_viewport_size({'width':390,'height':844});pg.evaluate('NR.game.setState("MENU");NR.ui.coreMatrix()');pg.wait_for_timeout(1200);pg.screenshot(path='/tmp/neon-fixed-mobile.png')
    check('no page errors',not errors,errors);b.close()
ROOT.joinpath('tests/regression-results.json').write_text(json.dumps(checks,indent=2))
print(sum(c['passed'] for c in checks),'/',len(checks))
assert all(c['passed'] for c in checks)
