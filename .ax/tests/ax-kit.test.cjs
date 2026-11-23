// AX 킷 CLI·루프 판정·맵·init 테스트
'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {execFileSync,spawnSync}=require('node:child_process');
const REPO=path.join(__dirname,'..','..');

function kit(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ax-kit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.cpSync(path.join(REPO,'.ax'),path.join(dir,'.ax'),{recursive:true,filter:src=>!/[\\/](project|runs)([\\/]|$)/.test(src)});
 fs.cpSync(path.join(REPO,'.claude'),path.join(dir,'.claude'),{recursive:true});
 const run=(args,input)=>{const r=spawnSync(process.execPath,[path.join(dir,'.ax/bin/ax.cjs'),...args],{input,encoding:'utf8',env:{...process.env,AX_ROOT:dir}});if(r.status!==0)throw Error(r.stderr.trim());return r.stdout;};
 const json=(args,input)=>JSON.parse(run(args,input));
 return {dir,run,json};
}
function setupAll(k,service='web-saas'){
 const rec=k.json(['recommend',service]);rec.profile.name='정산 포털';rec.profile.summary='거래처별 정산 조회';
 for(const l of ['profile','prompt','context','harness','loop','graph'])k.json(['set',l],JSON.stringify(rec[l]));
 return rec;
}

test('kit: every service preset produces a valid configuration',t=>{
 const k=kit(t);const services=k.json(['presets']).map(x=>x.id);assert.ok(services.includes('custom')&&services.length>=8);
 for(const s of services){setupAll(k,s);assert.deepEqual(k.json(['validate']),{ok:true},s);}
});

test('kit: hook guides first-run onboarding, resume, and the configured summary',t=>{
 const k=kit(t);assert.match(k.run(['status','--hook']),/어떤 서비스를 만드실건가요/);
 const rec=k.json(['recommend','backend-api']);rec.profile.name='API';rec.profile.summary='주문 API';k.json(['set','profile'],JSON.stringify(rec.profile));
 assert.match(k.run(['status','--hook']),/다음 L1 프롬프트/);
 setupAll(k,'backend-api');const text=k.run(['status','--hook']);assert.match(text,/정산 포털 · backend-api/);assert.match(text,/검수 ax-verifier/);
});

test('kit: invalid settings are rejected with a reason',t=>{
 const k=kit(t);
 assert.throws(()=>k.run(['set','profile'],JSON.stringify({serviceType:'spaceship',name:'x',summary:'y'})),/serviceType/);
 assert.throws(()=>k.run(['set','prompt'],JSON.stringify({role:'r',techniques:['mind-reading']})),/알 수 없는 기법/);
 const rec=setupAll(k);
 assert.throws(()=>k.run(['set','loop'],JSON.stringify({...rec.loop,verifier:{enabled:true,agent:'ghost'}})),/ghost/);
 assert.throws(()=>k.run(['set','loop'],JSON.stringify({...rec.loop,successCriteria:[{id:'a',text:'b',check:'no-such-check'}]})),/no-such-check/);
 assert.throws(()=>k.run(['set','loop'],JSON.stringify({...rec.loop,stopCriteria:{...rec.loop.stopCriteria,maxIterations:50}})),/maxIterations/);
 const g={nodes:[{id:'a',kind:'agent',agent:'main',title:'A'},{id:'b',kind:'loop',title:'B'}],edges:[['a','b'],['b','a']]};
 assert.throws(()=>k.run(['set','graph'],JSON.stringify(g)),/자동 순환/);
 g.nodes.push({id:'h',kind:'human',title:'승인'});g.edges=[['a','b'],['b','h'],['h','a','수정']];assert.doesNotThrow(()=>k.run(['set','graph'],JSON.stringify(g)));
 assert.throws(()=>k.run(['set','graph'],JSON.stringify({nodes:[{id:'x',kind:'agent',agent:'nobody',title:'X'}],edges:[]})),/nobody/);
});

test('loop: CLI decides CONTINUE / DONE / STOP from success and stop criteria',t=>{
 const k=kit(t);setupAll(k);
 const ids=k.json(['show','loop']).successCriteria.map(c=>c.id);
 const verdict=(met,extra={})=>JSON.stringify({criteria:ids.map(id=>({id,met:met===true||(Array.isArray(met)&&met.includes(id)),evidence:'e'})),stop:[],failures:[],...extra});
 let r=k.json(['loop','start','정산 목록']);let d=k.json(['loop','record',r.runId],verdict(['acceptance']));
 assert.equal(d.decision,'CONTINUE');assert.ok(d.fix.some(x=>x.startsWith('checks-pass')));
 assert.equal(k.json(['loop','record',r.runId],verdict(true)).decision,'DONE');
 assert.throws(()=>k.run(['loop','record',r.runId],verdict(true)),/종료된/);
 r=k.json(['loop','start','반복 실패']);k.json(['loop','record',r.runId],verdict(false));d=k.json(['loop','record',r.runId],verdict(false));
 assert.equal(d.decision,'STOP');assert.match(d.reason,/같은 실패/);assert.equal(d.ask,true);
 r=k.json(['loop','start','최대']);for(const m of [[],['acceptance']])k.json(['loop','record',r.runId],verdict(m));d=k.json(['loop','record',r.runId],verdict(['checks-pass']));
 assert.equal(d.decision,'STOP');assert.match(d.reason,/최대 반복 3회/);
 r=k.json(['loop','start','범위']);d=k.json(['loop','record',r.runId],verdict(false,{stop:[{id:'scope-creep',triggered:true,evidence:'명세 밖 파일'}]}));assert.match(d.reason,/scope-creep/);
 r=k.json(['loop','start','결정']);assert.equal(k.json(['loop','record',r.runId],verdict(false,{needsUser:true})).decision,'STOP');
 r=k.json(['loop','start','누락']);assert.throws(()=>k.run(['loop','record',r.runId],JSON.stringify({criteria:[{id:'acceptance',met:true}]})),/빠졌습니다/);
 assert.equal(k.json(['loop','record',r.runId],verdict(true,{failures:['SQL 인젝션 가능']})).decision,'CONTINUE');
});

test('kit: Claude Code files are well-formed and the hook command exists',()=>{
 const settings=JSON.parse(fs.readFileSync(path.join(REPO,'.claude/settings.json'),'utf8'));
 assert.match(settings.hooks.SessionStart[0].hooks[0].command,/\.ax\/bin\/ax\.cjs status --hook/);
 for(const dir of ['agents','skills']){
  const base=path.join(REPO,'.claude',dir);
  for(const f of fs.readdirSync(base)){const file=dir==='skills'?path.join(base,f,'SKILL.md'):path.join(base,f);const fm=fs.readFileSync(file,'utf8').match(/^---\n([\s\S]*?)\n---/);assert.ok(fm,file);assert.match(fm[1],/^name: \S+/m,file);assert.match(fm[1],/^description: .{20,}/m,file);}
 }
 const graphs=JSON.parse(fs.readFileSync(path.join(REPO,'.ax/presets/services.json'),'utf8')).graphs;
 for(const g of Object.values(graphs))for(const n of g.nodes)if(n.agent)assert.ok(fs.existsSync(path.join(REPO,'.claude/agents',n.agent+'.md')),n.agent);
 assert.ok(!fs.existsSync(path.join(REPO,'.ax/project')),'템플릿에는 프로젝트 설정이 없어야 첫 실행 온보딩이 시작됩니다');
 assert.ok(!fs.existsSync(path.join(REPO,'.ax/kit.lock.json')),'킷 원본은 init 전 상태여야 합니다');
 assert.match(fs.readFileSync(path.join(REPO,'CLAUDE.md'),'utf8'),/^@\.ax\/CLAUDE\.md$/m);
 assert.ok(fs.readFileSync(path.join(REPO,'README.md'),'utf8').startsWith('<!-- ax-kit-readme -->'));
 for(const f of ['package.json','desktop','public'])assert.ok(!fs.existsSync(path.join(REPO,f)),`킷 저장소에는 ${f}가 없어야 새 프로젝트와 충돌하지 않습니다`);
});

test('map: engineering.html is regenerated on set, loop and edit hook, and reflects the configuration',t=>{
 const k=kit(t);const html=()=>fs.readFileSync(path.join(k.dir,'.ax/engineering.html'),'utf8');
 k.run(['render']);assert.match(html(),/세팅 전 프로젝트/);assert.match(html(),/\/ax-setup profile/);
 const rec=setupAll(k);let h=html();
 for(const text of ['정산 포털','L4','반복 횟수가','ax-verifier','scope-creep','<svg','명세 승인','되돌아가는 엣지','6/6 완료'])assert.ok(h.includes(text),text);
 assert.ok(!/<script/i.test(h),'정적 HTML');
 const ids=rec.loop.successCriteria.map(c=>c.id);const r=k.json(['loop','start','<b>목록</b>']);
 k.json(['loop','record',r.runId],JSON.stringify({criteria:ids.map(id=>({id,met:true})),failures:[]}));
 h=html();assert.ok(h.includes('&lt;b&gt;목록&lt;/b&gt;'));assert.ok(!h.includes('<b>목록</b>'));assert.match(h,/pill ok">DONE/);
 const loopFile=path.join(k.dir,'.ax/project/loop.json');const l=JSON.parse(fs.readFileSync(loopFile,'utf8'));l.stopCriteria.maxIterations=7;fs.writeFileSync(loopFile,JSON.stringify(l));
 k.run(['render','--hook'],JSON.stringify({tool_input:{file_path:path.join(k.dir,'src/app.ts')}}));assert.ok(!html().includes('<b>7회</b>'));
 k.run(['render','--hook'],JSON.stringify({tool_input:{file_path:loopFile}}));assert.ok(html().includes('<b>7회</b>'));
});

test('cli: loop start does not wait on an open stdin (Bash tool keeps stdin open)',t=>{
 const {spawn}=require('node:child_process');const k=kit(t);setupAll(k);
 return new Promise((resolve,reject)=>{const c=spawn(process.execPath,[path.join(k.dir,'.ax/bin/ax.cjs'),'loop','start','작업'],{stdio:['pipe','pipe','pipe'],env:{...process.env,AX_ROOT:k.dir}});const timer=setTimeout(()=>{c.kill();reject(Error('stdin을 기다리며 멈춤'));},5000);c.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('exit '+code));});});
});

test('init: a fresh clone becomes a new project linked to the kit origin',t=>{
 const k=kit(t);fs.copyFileSync(path.join(REPO,'README.md'),path.join(k.dir,'README.md'));fs.copyFileSync(path.join(REPO,'CLAUDE.md'),path.join(k.dir,'CLAUDE.md'));
 const g=(...a)=>execFileSync('git',a,{cwd:k.dir,encoding:'utf8'}).trim();
 g('init','-q');g('-c','user.email=t@t','-c','user.name=t','commit','-q','--allow-empty','-m','kit');g('remote','add','origin','https://github.com/example/ax-kit.git');
 assert.match(k.run(['status','--hook']),/킷 원본/);assert.equal(k.json(['status']).initialized,false);
 const r=k.json(['init']);assert.equal(r.initialized,true);
 assert.equal(g('remote'),'ax');assert.equal(g('remote','get-url','ax'),'https://github.com/example/ax-kit.git');
 const lock=JSON.parse(fs.readFileSync(path.join(k.dir,'.ax/kit.lock.json'),'utf8'));assert.equal(lock.source,'https://github.com/example/ax-kit.git');assert.match(lock.commit,/^[0-9a-f]{40}$/);
 assert.ok(!fs.existsSync(path.join(k.dir,'.ax/tests')));assert.match(fs.readFileSync(path.join(k.dir,'README.md'),'utf8'),/^<!-- ax-project-readme -->\n# 새 프로젝트/);
 assert.match(k.run(['status','--hook']),/어떤 서비스를 만드실건가요/);assert.throws(()=>k.run(['init']),/이미 init/);
 setupAll(k);const readme=fs.readFileSync(path.join(k.dir,'README.md'),'utf8');assert.match(readme,/# 정산 포털/);assert.match(readme,/거래처별 정산 조회/);
});

test('init: refuses outside a git repository',t=>{const k=kit(t);assert.throws(()=>k.run(['init']),/git 저장소가 아닙니다/);});

test('rule: every service recommends the no-comment rule and kit code follows it',t=>{
 const k=kit(t);for(const s of k.json(['presets']).map(x=>x.id))assert.ok(k.json(['recommend',s,'harness']).rules.some(r=>r.startsWith('코드 주석 금지')),s);
 for(const f of ['.ax/bin/ax.cjs','.ax/bin/render.cjs','.ax/tests/ax-kit.test.cjs']){const lines=fs.readFileSync(path.join(REPO,f),'utf8').split('\n');const start=lines[0].startsWith('#!')?1:0;
  assert.match(lines[start],/^\/\/ \S/,`${f}: 맨 위 타이틀`);assert.equal(lines.filter(l=>/^\s*\/\//.test(l)).length,1,`${f}: 타이틀 외 주석`);}
});
