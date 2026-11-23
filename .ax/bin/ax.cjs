#!/usr/bin/env node
// AX 킷 CLI: init·세팅 검증/저장·추천·루프 판정·엔지니어링 맵 갱신
'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');

const ROOT=process.env.AX_ROOT||path.resolve(__dirname,'..','..');
const AX=path.join(ROOT,'.ax');const PROJECT=path.join(AX,'project');const RUNS=path.join(AX,'runs');
const STEPS=['profile','prompt','context','harness','loop','graph'];
const STEP_LABEL={profile:'L0 서비스·프로젝트 변수',prompt:'L1 프롬프트',context:'L2 컨텍스트',harness:'L3 하네스',loop:'L4 루프',graph:'L5 그래프'};
const presets=()=>JSON.parse(fs.readFileSync(path.join(AX,'presets','services.json'),'utf8'));
const read=(f,fallback=null)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error(`${path.relative(ROOT,f)} JSON 오류: ${e.message}`);}};
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});const tmp=f+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,2)+'\n');fs.renameSync(tmp,f);};
const layerFile=l=>path.join(PROJECT,`${l}.json`);
const setupFile=path.join(PROJECT,'setup.json');

const fail=m=>{throw Error(m);};
const str=(v,k,max=2000,req=true)=>{if(v===undefined||v===''){if(req)fail(`${k}: 필수입니다.`);return;}if(typeof v!=='string'||v.length>max)fail(`${k}: ${max}자 이하 문자열이어야 합니다.`);};
const strs=(v,k,max=30)=>{if(v===undefined)return;if(!Array.isArray(v)||v.length>max||v.some(x=>typeof x!=='string'||!x.trim()||x.length>500))fail(`${k}: 문자열 배열(최대 ${max}개)이어야 합니다.`);};
const id=(v,k)=>{if(typeof v!=='string'||!/^[a-z0-9][a-z0-9-]{0,40}$/.test(v))fail(`${k}: 소문자·숫자·하이픈 id여야 합니다.`);};
const uniq=(rows,k)=>{const s=new Set();for(const r of rows){if(s.has(r.id))fail(`${k}: 중복 id ${r.id}`);s.add(r.id);}};
function agents(){const dir=path.join(ROOT,'.claude','agents');try{return new Set(fs.readdirSync(dir).filter(f=>f.endsWith('.md')).map(f=>f.slice(0,-3)));}catch{return new Set();}}

const VALIDATE={
 profile(v){const services=Object.keys(presets().services);if(v.serviceType!=='custom'&&!services.includes(v.serviceType))fail(`serviceType: ${services.join('|')}|custom 중 하나여야 합니다.`);str(v.name,'name',80);str(v.summary,'summary',1000);for(const k of ['platform','stack','users','constraints','glossary'])str(v[k],k,1500,false);},
 prompt(v){str(v.role,'role',300);str(v.style,'style',1000,false);str(v.outputFormat,'outputFormat',500,false);str(v.extra,'extra',2000,false);strs(v.guardrails,'guardrails');const t=presets().techniques;strs(v.techniques,'techniques',15);for(const x of v.techniques||[])if(!t[x])fail(`techniques: 알 수 없는 기법 ${x} (${Object.keys(t).join(', ')})`);},
 context(v){strs(v.include,'include',40);strs(v.exclude,'exclude',40);str(v.strategy,'strategy',1000,false);if(v.maxFileChars!==undefined&&(!Number.isInteger(v.maxFileChars)||v.maxFileChars<1000||v.maxFileChars>100000))fail('maxFileChars: 1000~100000 정수');},
 harness(v){if(!Array.isArray(v.checks))fail('checks: 배열이어야 합니다 (비어도 됨).');for(const c of v.checks){id(c.id,'checks.id');str(c.title,'checks.title',100);str(c.command,'checks.command',300);if(typeof c.required!=='boolean')fail('checks.required: true/false');}uniq(v.checks,'checks');strs(v.rules,'rules',50);},
 loop(v){
  const ver=v.verifier||fail('verifier: 필수');if(typeof ver.enabled!=='boolean')fail('verifier.enabled: true/false');if(ver.enabled){str(ver.agent,'verifier.agent',60);if(!agents().has(ver.agent))fail(`verifier.agent: .claude/agents/${ver.agent}.md 가 없습니다.`);}strs(ver.focus,'verifier.focus',10);
  if(!Array.isArray(v.successCriteria)||!v.successCriteria.length||v.successCriteria.length>12)fail('successCriteria: 1~12개 필요');for(const c of v.successCriteria){id(c.id,'successCriteria.id');str(c.text,'successCriteria.text',300);if(c.check!==undefined)id(c.check,'successCriteria.check');}uniq(v.successCriteria,'successCriteria');
  const s=v.stopCriteria||fail('stopCriteria: 필수');if(!Number.isInteger(s.maxIterations)||s.maxIterations<1||s.maxIterations>10)fail('stopCriteria.maxIterations: 1~10');if(!Number.isInteger(s.repeatFailureLimit)||s.repeatFailureLimit<2||s.repeatFailureLimit>5)fail('stopCriteria.repeatFailureLimit: 2~5');
  for(const c of s.custom||[]){id(c.id,'stopCriteria.custom.id');str(c.text,'stopCriteria.custom.text',300);}uniq(s.custom||[],'stopCriteria.custom');
  if(!['ask-user','stop'].includes(v.onStop))fail('onStop: ask-user|stop');
  const harness=read(layerFile('harness'));for(const c of v.successCriteria)if(c.check&&!harness?.checks?.some(x=>x.id===c.check))fail(`successCriteria.${c.id}.check: 하네스 검사 ${c.check} 가 없습니다.`);
 },
 graph(v){
  str(v.title,'title',200,false);if(!Array.isArray(v.nodes)||!v.nodes.length||v.nodes.length>20)fail('nodes: 1~20개');const known=agents();
  for(const n of v.nodes){id(n.id,'nodes.id');str(n.title,'nodes.title',120);if(!['agent','loop','human','check'].includes(n.kind))fail(`nodes.${n.id}.kind: agent|loop|human|check`);if(n.kind==='agent'&&n.agent!=='main'&&!known.has(n.agent))fail(`nodes.${n.id}.agent: .claude/agents/${n.agent}.md 가 없습니다 (또는 "main").`);}
  uniq(v.nodes,'nodes');const ids=new Set(v.nodes.map(n=>n.id));
  if(!Array.isArray(v.edges))fail('edges: 배열');for(const e of v.edges){if(!Array.isArray(e)||!ids.has(e[0])||!ids.has(e[1]))fail(`edges: 잘못된 엣지 ${JSON.stringify(e)}`);}
  const human=new Set(v.nodes.filter(n=>n.kind==='human').map(n=>n.id));const next=new Map();for(const [a,b] of v.edges)if(!human.has(a)&&!human.has(b))(next.get(a)||next.set(a,[]).get(a)).push(b);
  const mark=new Map();const visit=x=>{if(mark.get(x)===1)fail(`사람 노드를 거치지 않는 자동 순환이 있습니다 (${x}). 순환에 human 노드를 넣으세요.`);if(mark.get(x)===2)return;mark.set(x,1);for(const y of next.get(x)||[])visit(y);mark.set(x,2);};ids.forEach(visit);
  if(v.nodes.some(n=>n.kind==='loop')&&!read(layerFile('loop')))fail('loop 노드가 있으면 루프(L4) 설정이 먼저 필요합니다.');
 }
};
function validateLayer(layer,v){if(!STEPS.includes(layer))fail(`layer: ${STEPS.join('|')}`);if(!v||typeof v!=='object'||Array.isArray(v))fail('JSON 객체여야 합니다.');VALIDATE[layer](v);return v;}

function recommend(service,layer){
 const p=presets();const s=service==='custom'?{label:'직접 정의',graph:p.base.graph}:p.services[service];if(!s)fail(`서비스 유형: ${Object.keys(p.services).join('|')}|custom`);
 const out={
  profile:{serviceType:service,name:'',summary:'',...(s.profileHints||{}),users:'',constraints:'',glossary:''},
  prompt:{role:'',style:'',outputFormat:'',...p.base.prompt,...(s.prompt||{}),guardrails:[...p.base.prompt.guardrails,...(s.prompt?.guardrails||[])]},
  context:{...p.base.context,...(s.context||{}),exclude:p.base.context.exclude},
  harness:{checks:s.harness?.checks||[],rules:[...p.base.harness.rules,...(s.harness?.rules||[])]},
  loop:{...p.base.loop,...(s.loop||{}),stopCriteria:{...p.base.loop.stopCriteria,...(s.loop?.stopCriteria||{})}},
  graph:{template:s.graph||p.base.graph,...p.graphs[s.graph||p.base.graph]}
 };
 out.prompt.techniqueNotes=Object.fromEntries((out.prompt.techniques||[]).map(t=>[t,p.techniques[t]]));
 return layer?out[layer]:out;
}

const LOCK=path.join(AX,'kit.lock.json');const README=path.join(ROOT,'README.md');
const KIT_README_MARK='<!-- ax-kit-readme -->';const PROJECT_README_MARK='<!-- ax-project-readme -->';
function git(args){return require('node:child_process').execFileSync('git',args,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function projectReadme(p){return `${PROJECT_README_MARK}
# ${p?.name||'새 프로젝트'}

${p?.summary||'/ax-setup을 마치면 서비스 이름과 요약이 이곳에 채워집니다.'}
${p?`
- 서비스 유형: ${p.serviceType}${p.platform?`\n- 플랫폼: ${p.platform}`:''}${p.stack?`\n- 스택: ${p.stack}`:''}${p.users?`\n- 주요 사용자: ${p.users}`:''}
`:''}
## AI 작업 방식
이 프로젝트는 AX AI 엔지니어링 킷으로 세팅되었습니다. 설정 한눈에 보기: \`node .ax/bin/ax.cjs render --open\` · 킷 설명: [.ax/README.md](.ax/README.md)
`;}
function init(){
 if(read(LOCK))fail('이미 init된 프로젝트입니다 (.ax/kit.lock.json).');
 try{git(['rev-parse','--is-inside-work-tree']);}catch{fail('git 저장소가 아닙니다. 킷을 클론한 폴더에서 실행하거나 git init 후 다시 실행하세요.');}
 const done=[];let source='',commit='',ref='';
 try{commit=git(['rev-parse','HEAD']);ref=git(['rev-parse','--abbrev-ref','HEAD']);}catch{}
 const remotes=git(['remote']).split('\n').filter(Boolean);
 if(remotes.includes('origin')&&!remotes.includes('ax')){source=git(['remote','get-url','origin']);git(['remote','rename','origin','ax']);done.push(`원격 origin → ax (킷 원본: ${source}). 새 저장소는 git remote add origin <주소>로 연결하세요.`);}
 else if(remotes.includes('ax'))source=git(['remote','get-url','ax']);
 if(fs.existsSync(README)&&fs.readFileSync(README,'utf8').includes(KIT_README_MARK)){fs.writeFileSync(README,projectReadme(null));done.push('README.md를 프로젝트용으로 교체');}
 const tests=path.join(AX,'tests');if(fs.existsSync(tests)){fs.rmSync(tests,{recursive:true,force:true});done.push('킷 개발용 테스트(.ax/tests) 제거');}
 write(LOCK,{kitVersion:presets().kitVersion,source,ref,commit,initializedAt:new Date().toISOString()});done.push('.ax/kit.lock.json 기록 (킷 버전·출처)');
 refresh();return {initialized:true,done,next:'/ax-setup — "어떤 서비스를 만드실건가요?"부터 진행'};
}

function status(){const setup=read(setupFile,{steps:{}});const done=STEPS.filter(s=>setup.steps?.[s]);return {initialized:Boolean(read(LOCK)),complete:done.length===STEPS.length,done,next:STEPS.find(s=>!setup.steps?.[s])||null,kitVersion:presets().kitVersion,profile:read(layerFile('profile'))};}
function hookText(){
 const s=status();
 if(!s.initialized&&!s.done.length)return `[AX 킷] 이 폴더는 AX AI 엔지니어링 킷 원본(클론 직후 상태)입니다.
사용자의 첫 메시지를 확인한 뒤, 새 프로젝트로 시작할지 물어보세요. 시작하면 /ax-setup 절차(.claude/skills/ax-setup/SKILL.md)를
0단계(init)부터 진행하고 "어떤 서비스를 만드실건가요?"를 묻습니다. 킷 자체를 수정하려는 것이라면 init하지 마세요.`;
 if(!s.done.length)return `[AX 킷] 이 프로젝트는 아직 AI 엔지니어링 세팅 전입니다.
사용자의 첫 메시지가 무엇이든, 먼저 짧게 안내한 뒤 /ax-setup 절차(.claude/skills/ax-setup/SKILL.md)를 따라
"어떤 서비스를 만드실건가요?"부터 한 단계씩 물어보세요. 사용자가 세팅을 미루겠다고 하면 그 요청을 따르세요.`;
 if(!s.complete)return `[AX 킷] 세팅 진행 중: 완료 ${s.done.map(x=>STEP_LABEL[x]).join(', ')} / 다음 ${STEP_LABEL[s.next]}.
첫 응답에서 이어서 진행할지 물어보고, 진행하면 /ax-setup 절차를 ${STEP_LABEL[s.next]}부터 재개하세요.`;
 const L=l=>read(layerFile(l));const prompt=L('prompt'),loop=L('loop'),graph=L('graph'),harness=L('harness');
 return `[AX 킷 v${s.kitVersion}] ${s.profile.name} · ${s.profile.serviceType}
- 서비스: ${s.profile.summary}
- 프롬프트: 역할 "${prompt.role}" · 기법 ${(prompt.techniques||[]).join(', ')} · 가드레일 ${(prompt.guardrails||[]).length}개 (.ax/project/prompt.json)
- 하네스 검사: ${harness.checks.map(c=>`${c.id}(${c.command})`).join(', ')||'없음'}
- 루프: 성공 기준 ${loop.successCriteria.map(c=>c.id).join(', ')} · 최대 ${loop.stopCriteria.maxIterations}회 · 검수 ${loop.verifier.enabled?loop.verifier.agent:'없음'}
- 그래프: ${graph.nodes.map(n=>n.id).join(' → ')}
구현 작업은 /ax-run 절차(그래프 순서, 루프 노드는 /ax-loop)를 따르고, 설정 변경 요청은 /ax-setup <layer>로 처리하세요.`;
}

function decide(run){
 const cfg=run.config;const last=run.iterations.at(-1);const v=last.verdict;
 const unmet=cfg.successCriteria.filter(c=>!v.criteria?.find(x=>x.id===c.id)?.met).map(c=>c.id);
 const triggered=(v.stop||[]).filter(x=>x.triggered).map(x=>x.id);
 if(!unmet.length&&!(v.failures||[]).length)return {decision:'DONE',reason:'모든 성공 기준 충족'};
 if(v.needsUser)return {decision:'STOP',reason:'검수 에이전트가 사용자 결정이 필요하다고 판단',ask:true};
 if(triggered.length)return {decision:'STOP',reason:`종료 기준 발동: ${triggered.join(', ')}`,ask:cfg.onStop==='ask-user'};
 if(run.iterations.length>=cfg.stopCriteria.maxIterations)return {decision:'STOP',reason:`최대 반복 ${cfg.stopCriteria.maxIterations}회 도달`,ask:cfg.onStop==='ask-user'};
 const k=cfg.stopCriteria.repeatFailureLimit;const tail=run.iterations.slice(-k);
 if(tail.length===k&&tail.every(x=>x.signature===last.signature))return {decision:'STOP',reason:`같은 실패가 ${k}회 반복 (진전 없음)`,ask:cfg.onStop==='ask-user'};
 return {decision:'CONTINUE',reason:'미충족 기준 수정 후 재검수',fix:[...unmet.map(id=>`${id}: ${cfg.successCriteria.find(c=>c.id===id).text} — ${v.criteria?.find(x=>x.id===id)?.evidence||'근거 없음'}`),...(v.failures||[])]};
}
function loopCmd(sub,arg,input){
 if(sub==='start'){const cfg=read(layerFile('loop'));if(!cfg)fail('루프(L4) 설정이 없습니다. /ax-setup loop 를 먼저 진행하세요.');str(arg,'title',200);const runId=new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)+'-'+crypto.randomBytes(3).toString('hex');write(path.join(RUNS,runId+'.json'),{runId,title:arg,startedAt:new Date().toISOString(),config:cfg,iterations:[],status:'running'});return {runId,maxIterations:cfg.stopCriteria.maxIterations,successCriteria:cfg.successCriteria,stopCriteria:cfg.stopCriteria,verifier:cfg.verifier};}
 const f=path.join(RUNS,`${arg}.json`);if(!/^[\w-]+$/.test(arg||''))fail('runId 형식 오류');const run=read(f);if(!run)fail(`실행 기록이 없습니다: ${arg}`);
 if(sub==='status')return run;
 if(sub==='record'){
  if(run.status!=='running')fail(`이미 종료된 실행입니다 (${run.status}).`);const v=JSON.parse(input);
  if(!Array.isArray(v.criteria))fail('verdict.criteria 배열이 필요합니다.');for(const c of v.criteria)if(typeof c.id!=='string'||typeof c.met!=='boolean')fail('verdict.criteria: {id, met:boolean, evidence}');
  const missing=run.config.successCriteria.filter(c=>!v.criteria.some(x=>x.id===c.id)).map(c=>c.id);if(missing.length)fail(`verdict에 성공 기준 판정이 빠졌습니다: ${missing.join(', ')}`);
  const signature=crypto.createHash('sha1').update(JSON.stringify([v.criteria.filter(c=>!c.met).map(c=>c.id).sort(),(v.failures||[]).slice().sort()])).digest('hex').slice(0,10);
  run.iterations.push({n:run.iterations.length+1,at:new Date().toISOString(),verdict:v,signature});const d=decide(run);run.iterations.at(-1).decision=d;
  if(d.decision!=='CONTINUE'){run.status=d.decision==='DONE'?'done':'stopped';run.finishedAt=new Date().toISOString();}
  write(f,run);return {iteration:run.iterations.length,...d};
 }
 fail('loop start|record|status');
}

const HTML=path.join(AX,'engineering.html');
function renderHtml(){
 const cfg=Object.fromEntries(STEPS.map(l=>[l,read(layerFile(l))]));
 const html=require('./render.cjs').render({root:ROOT,cfg,setup:read(setupFile,{steps:{}}),presets:presets()});
 const tmp=HTML+'.tmp';fs.writeFileSync(tmp,html);fs.renameSync(tmp,HTML);return HTML;
}
const refresh=()=>{try{renderHtml();}catch(e){process.stderr.write(`엔지니어링 맵 갱신 실패: ${e.message}\n`);}};
function openFile(f){const {spawn}=require('node:child_process');const [cmd,args]=process.platform==='darwin'?['open',[f]]:process.platform==='win32'?['cmd',['/c','start','',f]]:['xdg-open',[f]];spawn(cmd,args,{detached:true,stdio:'ignore'}).unref();}

function mermaid(g){return ['flowchart LR',...g.nodes.map(n=>{const t=`${n.title}${n.agent?` · ${n.agent}`:''}`.replace(/"/g,"'");return `  ${n.id}${{human:`{{"👤 ${t}"}}`,loop:`(("🔁 ${t}"))`,check:`[/"✓ ${t}"/]`,agent:`["🤖 ${t}"]`}[n.kind]}`;}),...g.edges.map(([a,b,l])=>`  ${a} -->${l?`|${l}|`:''} ${b}`)].join('\n');}

async function stdin(){if(process.stdin.isTTY)return '';let s='';for await(const c of process.stdin)s+=c;return s;}
async function main(argv){
 const [cmd,a,b]=argv;const out=v=>process.stdout.write((typeof v==='string'?v:JSON.stringify(v,null,2))+'\n');
 if(cmd==='init')return out(init());
 if(cmd==='status'){if(a==='--hook')refresh();return out(a==='--hook'?hookText():status());}
 if(cmd==='render'){
  if(a==='--hook'){let file='';try{file=JSON.parse(await stdin()).tool_input?.file_path||'';}catch{}const rel=path.relative(ROOT,path.resolve(ROOT,file)).split(path.sep).join('/');if(/^(\.ax\/(project|presets)\/|\.claude\/agents\/)/.test(rel))refresh();return;}
  const f=renderHtml();if(a==='--open')openFile(f);return out({html:path.relative(ROOT,f)});
 }
 if(cmd==='presets'){const p=presets();return out(Object.entries(p.services).map(([k,s])=>({id:k,label:s.label,description:s.description})).concat([{id:'custom',label:'직접 정의',description:'목록에 없는 서비스 — 기본값에서 시작'}]));}
 if(cmd==='recommend')return out(recommend(a,b));
 if(cmd==='set'){const v=validateLayer(a,JSON.parse(await stdin()));write(layerFile(a),v);const setup=read(setupFile,{steps:{}});setup.kitVersion=presets().kitVersion;setup.steps[a]=new Date().toISOString();if(STEPS.every(s=>setup.steps[s]))setup.completedAt||=new Date().toISOString();write(setupFile,setup);if(a==='profile'&&fs.existsSync(README)&&fs.readFileSync(README,'utf8').startsWith(PROJECT_README_MARK))fs.writeFileSync(README,projectReadme(v));refresh();return out({saved:a,html:'.ax/engineering.html',...status()});}
 if(cmd==='show')return out(a?read(layerFile(a)):Object.fromEntries(STEPS.map(s=>[s,read(layerFile(s))])));
 if(cmd==='validate'){const errors=[];for(const s of STEPS){const v=read(layerFile(s));if(!v){errors.push(`${s}: 미설정`);continue;}try{validateLayer(s,v);}catch(e){errors.push(`${s}: ${e.message}`);}}return out(errors.length?{ok:false,errors}:{ok:true});}
 if(cmd==='graph'&&a==='mermaid'){const g=read(layerFile('graph'));if(!g)fail('그래프(L5) 설정이 없습니다.');return out(mermaid(g));}
 if(cmd==='loop'){const r=loopCmd(a,b,a==='record'?await stdin():'');if(a!=='status')refresh();return out(r);}
 out('사용법: ax.cjs init|status|presets|recommend <service> [layer]|set <layer>|show [layer]|validate|graph mermaid|loop start|record|status');process.exitCode=cmd?1:0;
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 if(process.argv.includes('--hook')){process.stdout.write(`[AX 킷] 상태를 읽지 못했습니다: ${e.message}\n`);return;}
 process.stderr.write(`오류: ${e.message}\n`);process.exitCode=1;});
module.exports={validateLayer,recommend,decide,status,hookText,mermaid,renderHtml,STEPS};
