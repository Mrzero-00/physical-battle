// 엔지니어링 맵(.ax/engineering.html) 생성기
'use strict';
const fs=require('node:fs');const path=require('node:path');

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LAYERS=[['profile','L0','프로젝트 변수','어떤 서비스인가'],['prompt','L1','프롬프트','무엇을 어떻게 지시하나'],['context','L2','컨텍스트','무엇을 읽히나'],['harness','L3','하네스','무엇으로 검사하나'],['loop','L4','루프','언제 다시 하고 언제 멈추나'],['graph','L5','그래프','어떤 순서로 잇나']];
const KIND={agent:{label:'에이전트',icon:'🤖'},loop:{label:'루프',icon:'🔁'},check:{label:'검사',icon:'✓'},human:{label:'사람 승인',icon:'👤'}};

function wrap(text,max=12){const out=[];let line='';for(const word of String(text).split(/(\s+)/)){if((line+word).length>max&&line.trim()){out.push(line.trim());line=word.trimStart();}else line+=word;while(line.length>max){out.push(line.slice(0,max));line=line.slice(max);}}if(line.trim())out.push(line.trim());return out.slice(0,3);}
const svgText=(lines,x,y,cls='',lh=15)=>lines.map((l,i)=>`<text x="${x}" y="${y+i*lh-(lines.length-1)*lh/2}" class="${cls}" text-anchor="middle" dominant-baseline="middle">${esc(l)}</text>`).join('');

function graphSVG(g){
 const W=136,H=70,GAP=46,PAD=16,TOP=86;const idx=new Map(g.nodes.map((n,i)=>[n.id,i]));const cx=i=>PAD+i*(W+GAP)+W/2;
 const forward=g.edges.filter(([a,b])=>idx.get(b)>idx.get(a));const back=g.edges.filter(([a,b])=>idx.get(b)<=idx.get(a));
 const width=PAD*2+g.nodes.length*W+(g.nodes.length-1)*GAP;const height=TOP+H+70+back.length*14;
 const parts=[];let skip=0;
 for(const [a,b,label] of forward){const i=idx.get(a),j=idx.get(b);
  if(j===i+1){const x1=cx(i)+W/2,x2=cx(j)-W/2,y=TOP+H/2;parts.push(`<path d="M${x1} ${y} L${x2-2} ${y}" class="edge" marker-end="url(#arrow)"/>`);if(label)parts.push(`<text x="${(x1+x2)/2}" y="${y-9}" class="elabel" text-anchor="middle">${esc(label)}</text>`);}
  else{const h=40+(skip++%2)*18,x1=cx(i),x2=cx(j);parts.push(`<path d="M${x1} ${TOP} C${x1} ${TOP-h}, ${x2} ${TOP-h}, ${x2} ${TOP-2}" class="edge" marker-end="url(#arrow)"/>`);if(label)parts.push(`<text x="${(x1+x2)/2}" y="${TOP-h*0.75-6}" class="elabel" text-anchor="middle">${esc(label)}</text>`);}
 }
 back.forEach(([a,b,label],k)=>{const i=idx.get(a),j=idx.get(b),x1=cx(i),x2=cx(j),y=TOP+H,h=34+k*14;
  parts.push(`<path d="M${x1} ${y} C${x1} ${y+h}, ${x2} ${y+h}, ${x2} ${y+2}" class="edge back" marker-end="url(#arrow-back)"/>`);
  parts.push(`<text x="${(x1+x2)/2}" y="${y+h*0.75+12}" class="elabel back" text-anchor="middle">↺ ${esc(label||'되돌아감')}</text>`);});
 g.nodes.forEach((n,i)=>{const x=cx(i)-W/2,k=KIND[n.kind]||KIND.agent;
  parts.push(`<g class="node ${esc(n.kind)}"><rect x="${x}" y="${TOP}" width="${W}" height="${H}" rx="${n.kind==='loop'?H/2:10}"/><text x="${x+10}" y="${TOP+15}" class="nkind">${k.icon} ${esc(k.label)}</text>${svgText(wrap(n.title,11),cx(i),TOP+H/2+5,'ntitle')}${n.agent?`<text x="${cx(i)}" y="${TOP+H-8}" class="nagent" text-anchor="middle">${esc(n.agent)}</text>`:''}</g>`);});
 return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(g.title||'그래프')}"><defs>${['arrow','arrow-back'].map(id=>`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="${id}"/></marker>`).join('')}</defs>${parts.join('')}</svg>`;
}

function loopSVG(loop){
 const verifier=loop.verifier?.enabled?loop.verifier.agent:'검수 없음(자기 점검)';const s=loop.stopCriteria;
 const box=(x,y,w,h,cls,title,sub)=>`<g class="node ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>${svgText([title],x+w/2,y+h/2-8,'ntitle')}${svgText(wrap(sub,18),x+w/2,y+h/2+12,'nagent',13)}</g>`;
 return `<svg viewBox="0 0 760 300" width="760" height="300" role="img" aria-label="루프 흐름"><defs>${['arrow','arrow-back'].map(id=>`<marker id="l${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="${id}"/></marker>`).join('')}</defs>
 ${box(20,90,150,70,'agent','① 구현','main 에이전트')}
 ${box(220,90,150,70,'verify','② 검수',verifier)}
 ${box(420,90,150,70,'decide','③ 판정','ax.cjs loop record')}
 ${box(620,20,120,56,'done','DONE','성공 기준 모두 충족')}
 ${box(620,200,120,64,'stop','STOP',loop.onStop==='ask-user'?'사용자에게 다음 행동 질문':'중단')}
 <path d="M170 125 L216 125" class="edge" marker-end="url(#larrow)"/><path d="M370 125 L416 125" class="edge" marker-end="url(#larrow)"/>
 <path d="M570 110 C600 110, 590 48, 616 48" class="edge" marker-end="url(#larrow)"/>
 <path d="M570 140 C600 140, 590 232, 616 232" class="edge stopline" marker-end="url(#larrow)"/>
 <path d="M495 160 C495 260, 95 260, 95 164" class="edge back" marker-end="url(#larrow-back)"/>
 <text x="295" y="250" class="elabel back" text-anchor="middle">↺ CONTINUE · 미충족 기준 + 결함(fix 목록)만 수정</text>
 <text x="295" y="76" class="elabel" text-anchor="middle">구현자의 자기 평가는 전달하지 않음</text>
 <text x="690" y="290" class="elabel" text-anchor="middle">최대 ${esc(s.maxIterations)}회 · 같은 실패 ${esc(s.repeatFailureLimit)}회</text></svg>`;
}

function agentsInfo(root){const dir=path.join(root,'.claude','agents');let files=[];try{files=fs.readdirSync(dir).filter(f=>f.endsWith('.md'));}catch{}
 return files.map(f=>{const fm=(fs.readFileSync(path.join(dir,f),'utf8').match(/^---\n([\s\S]*?)\n---/)||[])[1]||'';const get=k=>(fm.match(new RegExp(`^${k}:\\s*(.*)$`,'m'))||[])[1]||'';return {name:get('name')||f.slice(0,-3),description:get('description'),tools:get('tools')||'(상속)',model:get('model')||'inherit'};});}
function runsInfo(root,limit=8){const dir=path.join(root,'.ax','runs');let files=[];try{files=fs.readdirSync(dir).filter(f=>f.endsWith('.json'));}catch{}
 return files.map(f=>{try{return JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));}catch{return null;}}).filter(Boolean).sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt))).slice(0,limit);}

const list=(rows,empty='없음')=>rows?.length?`<ul>${rows.map(x=>`<li>${x}</li>`).join('')}</ul>`:`<p class="muted">${empty}</p>`;
const chips=rows=>rows?.length?`<div class="chips">${rows.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>`:'<p class="muted">없음</p>';
const kv=rows=>`<dl class="kv">${rows.filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>`<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
const pending=(label)=>`<div class="pending">아직 세팅하지 않았습니다 · <code>/ax-setup ${esc(label)}</code></div>`;
const when=iso=>iso?new Date(iso).toLocaleString('ko-KR',{dateStyle:'short',timeStyle:'short'}):'';

function render({root,cfg,setup,presets}){
 const p=cfg.profile,pr=cfg.prompt,cx=cfg.context,h=cfg.harness,l=cfg.loop,g=cfg.graph;
 const agents=agentsInfo(root);const runs=runsInfo(root);const done=LAYERS.filter(([k])=>cfg[k]).length;
 const svcLabel=p?(presets.services[p.serviceType]?.label||'직접 정의'):'';
 const usedBy=name=>[...(g?.nodes||[]).filter(n=>n.agent===name).map(n=>`그래프 · ${n.title}`),...(l?.verifier?.enabled&&l.verifier.agent===name?['루프 · 검수']:[])];
 const summary={
  profile:p?`${esc(p.name)} · ${esc(svcLabel)}`:'',
  prompt:pr?`${esc(pr.role)} · 기법 ${pr.techniques?.length||0}`:'',
  context:cx?`포함 ${cx.include?.length||0} · 제외 ${cx.exclude?.length||0}`:'',
  harness:h?`검사 ${h.checks.length} (필수 ${h.checks.filter(c=>c.required).length}) · 규칙 ${h.rules?.length||0}`:'',
  loop:l?`성공 ${l.successCriteria.length} · 최대 ${l.stopCriteria.maxIterations}회 · ${l.verifier.enabled?esc(l.verifier.agent):'검수 없음'}`:'',
  graph:g?`노드 ${g.nodes.length} · 사람 승인 ${g.nodes.filter(n=>n.kind==='human').length}`:''
 };
 const section=(key,body)=>{const [,code,name,q]=LAYERS.find(x=>x[0]===key);return `<section id="${key}" class="layer"><header><span class="code">${code}</span><div><h2>${name}</h2><p>${q}</p></div>${setup.steps?.[key]?`<span class="stamp">수정 ${esc(when(setup.steps[key]))}</span>`:''}</header>${cfg[key]?body():pending(key)}${cfg[key]?`<details class="raw"><summary>원본 설정 · .ax/project/${key}.json</summary><pre>${esc(JSON.stringify(cfg[key],null,2))}</pre></details>`:''}</section>`;};

 const body=`
<header class="top"><div><div class="eyebrow">AX AI ENGINEERING · KIT v${esc(presets.kitVersion)}</div><h1>${p?esc(p.name):'세팅 전 프로젝트'}</h1><p class="lead">${p?`${esc(svcLabel)} — ${esc(p.summary)}`:'Claude Code에서 <code>/ax-setup</code>을 실행하면 "어떤 서비스를 만드실건가요?"부터 세팅을 시작합니다.'}</p></div>
<div class="progress" aria-label="세팅 진행 ${done}/6">${LAYERS.map(([k,code])=>`<span class="${cfg[k]?'on':''}" title="${code}">${code}</span>`).join('')}<small>${done}/6 완료 · 갱신 ${esc(when(new Date().toISOString()))}</small></div></header>
<nav>${LAYERS.map(([k,code,name])=>`<a href="#${k}">${code} ${name}</a>`).join('')}<a href="#agents">서브에이전트</a><a href="#runs">루프 실행 기록</a></nav>
<div class="overview">${LAYERS.map(([k,code,name])=>`<a class="card ${cfg[k]?'':'off'}" href="#${k}"><span class="code">${code}</span><strong>${name}</strong><span>${summary[k]||'미설정'}</span></a>`).join('')}</div>
<section class="flow"><h2>전체 흐름</h2><div class="pipeline">${[['L0','서비스 변수','모든 지시의 전제'],['L1','프롬프트','역할·기법·가드레일'],['L2','컨텍스트','scout가 필요한 것만'],['L5','그래프','노드 순서·사람 승인'],['L4','루프','구현 ↔ 독립 검수'],['L3','하네스','검사 명령·규칙']].map(([c,t,d])=>`<div><span class="code">${c}</span><strong>${t}</strong><small>${d}</small></div>`).join('<i>→</i>')}</div><p class="muted">요구사항은 그래프(L5)를 따라 진행되고, 각 노드는 프롬프트(L1)·컨텍스트(L2) 설정으로 일하며, 구현 노드는 루프(L4)에서 하네스(L3) 검사와 성공 기준으로 판정됩니다.</p></section>

${section('profile',()=>kv([['서비스 유형',`${esc(svcLabel)} <code>${esc(p.serviceType)}</code>`],['이름',esc(p.name)],['요약',esc(p.summary)],['플랫폼',esc(p.platform)],['스택',esc(p.stack)],['주요 사용자',esc(p.users)],['비기능 제약',esc(p.constraints)],['용어집',esc(p.glossary)]]))}

${section('prompt',()=>`<div class="assembly">${['기본 원칙 (CLAUDE.md)','L0 서비스 변수','역할 · 문체','기법','가드레일','작업 요청'].map((x,i)=>`<span>${i+1}. ${x}</span>`).join('<i>+</i>')}</div>${kv([['역할',esc(pr.role)],['문체·진행 방식',esc(pr.style)],['출력 형식',esc(pr.outputFormat)],['추가 지침',esc(pr.extra)]])}<h3>기법</h3><div class="techs">${(pr.techniques||[]).map(t=>`<div><code>${esc(t)}</code><span>${esc(presets.techniques[t]||'')}</span></div>`).join('')}</div><h3>가드레일</h3>${list((pr.guardrails||[]).map(esc))}`)}

${section('context',()=>`<div class="two"><div><h3>먼저 읽힐 자료</h3>${list((cx.include||[]).map(x=>`<code>${esc(x)}</code>`))}</div><div><h3>읽히지 않을 것</h3>${list((cx.exclude||[]).map(x=>`<code>${esc(x)}</code>`))}</div></div>${kv([['파일당 최대',cx.maxFileChars?`${Number(cx.maxFileChars).toLocaleString()}자`:''],['수집 전략',esc(cx.strategy)],['담당','<code>ax-context-scout</code> — 파일 덤프 대신 위치와 결론만 전달']])}`)}

${section('harness',()=>`<h3>검사 명령</h3>${h.checks.length?`<div class="table"><table><thead><tr><th>id</th><th>검사</th><th>명령</th><th>필수</th><th>연결된 성공 기준</th></tr></thead><tbody>${h.checks.map(c=>`<tr><td><code>${esc(c.id)}</code></td><td>${esc(c.title)}</td><td><code>${esc(c.command)}</code></td><td>${c.required?'<span class="pill ok">필수</span>':'<span class="pill">선택</span>'}</td><td>${esc((l?.successCriteria||[]).filter(s=>s.check===c.id).map(s=>s.id).join(', ')||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">검사 명령 없음 — 루프 검수가 파일 확인에만 의존합니다.</p>'}<h3>프로젝트 규칙</h3>${list((h.rules||[]).map(esc))}`)}

${section('loop',()=>`<div class="diagram">${loopSVG(l)}</div>
<div class="two"><div><h3>성공 기준 <small>모두 충족 + 결함 없음 → DONE</small></h3>${list(l.successCriteria.map(c=>`<code>${esc(c.id)}</code> ${esc(c.text)}${c.check?` <span class="pill">검사 ${esc(c.check)}</span>`:''}`))}</div>
<div><h3>검수 서브에이전트</h3>${kv([['에이전트',l.verifier.enabled?`<code>${esc(l.verifier.agent)}</code> (읽기 전용 · 독립 판정)`:'<span class="pill warn">꺼짐</span> 구현자가 스스로 점검'],['검수 중점',(l.verifier.focus||[]).map(esc).join(' · ')]])}</div></div>
<h3>판정 규칙 <small>ax.cjs loop record가 위에서부터 순서대로 확인</small></h3>
<ol class="rules">
<li><span class="pill ok">DONE</span> 모든 성공 기준(${l.successCriteria.length}개) 충족이고 결함(failures) 없음</li>
<li><span class="pill stop">STOP</span> 검수자가 <b>사용자 결정 필요</b>(needsUser)라고 판단</li>
${(l.stopCriteria.custom||[]).map(c=>`<li><span class="pill stop">STOP</span> 종료 기준 <code>${esc(c.id)}</code> 발동 — ${esc(c.text)}</li>`).join('')}
<li><span class="pill stop">STOP</span> 반복 횟수가 <b>${esc(l.stopCriteria.maxIterations)}회</b>에 도달</li>
<li><span class="pill stop">STOP</span> 최근 <b>${esc(l.stopCriteria.repeatFailureLimit)}회</b> 실패 내용이 동일 (진전 없음)</li>
<li><span class="pill">CONTINUE</span> 그 외 — 미충족 기준과 결함만 fix 목록으로 넘겨 다시 구현</li>
</ol><p class="muted">STOP 이후: ${l.onStop==='ask-user'?'사용자에게 기준 조정 · 반복 추가 · 범위 축소 · 중단 중 선택을 묻습니다. 허락 없이 반복을 늘리지 않습니다.':'그대로 중단합니다.'}</p>`)}

${section('graph',()=>`<p class="muted">${esc(g.title||'')}</p><div class="diagram">${graphSVG(g)}</div><div class="legend">${Object.entries(KIND).map(([k,v])=>`<span class="lg ${k}">${v.icon} ${v.label}</span>`).join('')}<span class="lg backlg">↺ 되돌아가는 엣지 — 사람 승인을 거쳐야만 허용</span></div>
<div class="table"><table><thead><tr><th>노드</th><th>종류</th><th>실행 방식</th><th>다음</th></tr></thead><tbody>${g.nodes.map(n=>`<tr><td><b>${esc(n.title)}</b><br><code>${esc(n.id)}</code></td><td>${KIND[n.kind]?.icon||''} ${esc(KIND[n.kind]?.label||n.kind)}</td><td>${{human:'AskUserQuestion으로 승인·선택 — 응답 없이 통과 불가',agent:`서브에이전트 <code>${esc(n.agent)}</code> 호출`,loop:'/ax-loop — L4 루프 설정으로 구현·검수 반복',check:'L3 필수 검사 실행 — 실패 시 진행 중단'}[n.kind]||''}</td><td>${g.edges.filter(e=>e[0]===n.id).map(e=>`${esc(e[1])}${e[2]?` <small>(${esc(e[2])})</small>`:''}`).join('<br>')||'끝'}</td></tr>`).join('')}</tbody></table></div>`)}

<section id="agents" class="layer"><header><span class="code">AG</span><div><h2>서브에이전트</h2><p>.claude/agents</p></div></header><div class="agents">${agents.map(a=>`<div class="agent"><div class="row"><strong>${esc(a.name)}</strong><span class="pill">${esc(a.model)}</span></div><p>${esc(a.description)}</p><small>도구: ${esc(a.tools)}</small><small>사용처: ${esc(usedBy(a.name).join(' · ')||'직접 호출')}</small></div>`).join('')||'<p class="muted">없음</p>'}</div></section>

<section id="runs" class="layer"><header><span class="code">RUN</span><div><h2>최근 루프 실행</h2><p>.ax/runs — 반복마다 미충족 기준과 판정</p></div></header>${runs.length?runs.map(r=>`<div class="run"><div class="row"><strong>${esc(r.title)}</strong><span class="pill ${r.status==='done'?'ok':r.status==='stopped'?'stop':''}">${esc({done:'DONE',stopped:'STOP',running:'진행 중'}[r.status]||r.status)}</span><small>${esc(when(r.startedAt))} · ${r.iterations.length}/${esc(r.config?.stopCriteria?.maxIterations)}회</small></div><ol class="iters">${r.iterations.map(it=>{const unmet=(it.verdict.criteria||[]).filter(c=>!c.met).map(c=>c.id);return `<li><span class="pill ${it.decision?.decision==='DONE'?'ok':it.decision?.decision==='STOP'?'stop':''}">${esc(it.decision?.decision)}</span> ${unmet.length?`미충족 ${unmet.map(x=>`<code>${esc(x)}</code>`).join(' ')}`:'기준 모두 충족'}${(it.verdict.failures||[]).length?` · 결함 ${it.verdict.failures.length}`:''} <small>${esc(it.decision?.reason)}</small></li>`;}).join('')}</ol></div>`).join(''):'<p class="muted">아직 실행 기록이 없습니다. <code>/ax-loop</code> 또는 <code>/ax-run</code>을 실행하면 여기에 쌓입니다.</p>'}</section>
<footer>자동 생성 파일 · 직접 수정하지 마세요 · <code>node .ax/bin/ax.cjs render</code></footer>`;
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AX 엔지니어링 맵</title><style>${CSS}</style></head><body><main>${body}</main></body></html>\n`;
}

const CSS=`:root{--bg:#f6f7f5;--panel:#fff;--ink:#1d2622;--muted:#6b7570;--line:#e3e7e4;--accent:#127a66;--accent-soft:#e5f3ef;--human:#b07a1c;--human-soft:#fdf4e3;--agent:#3f63a8;--agent-soft:#eaf0fb;--loop:#127a66;--loop-soft:#e5f3ef;--check:#5d6670;--check-soft:#eef0f2;--stop:#b5482f;--stop-soft:#fcebe6;--code:#f0f2f0}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121614;--panel:#1a201d;--ink:#e6ece8;--muted:#9aa59f;--line:#2b332f;--accent:#5cc8ae;--accent-soft:#18332c;--human:#e3b25c;--human-soft:#352a17;--agent:#8eaef0;--agent-soft:#1c2740;--loop:#5cc8ae;--loop-soft:#18332c;--check:#aab3bb;--check-soft:#252b30;--stop:#f08a70;--stop-soft:#3a201a;--code:#232a26}}
:root[data-theme="dark"]{--bg:#121614;--panel:#1a201d;--ink:#e6ece8;--muted:#9aa59f;--line:#2b332f;--accent:#5cc8ae;--accent-soft:#18332c;--human:#e3b25c;--human-soft:#352a17;--agent:#8eaef0;--agent-soft:#1c2740;--loop:#5cc8ae;--loop-soft:#18332c;--check:#aab3bb;--check-soft:#252b30;--stop:#f08a70;--stop-soft:#3a201a;--code:#232a26}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.65 -apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo","Segoe UI",sans-serif}main{max-width:1180px;margin:0 auto;padding:32px 16px 48px}
h1{font-size:28px;letter-spacing:-.6px;margin:4px 0 6px}h2{font-size:18px;margin:0;letter-spacing:-.3px}h3{font-size:13px;margin:22px 0 8px;color:var(--ink)}h3 small{font-weight:400;color:var(--muted);margin-left:6px}p{margin:0}.muted,small{color:var(--muted)}code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--code);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
.eyebrow{font-size:11px;letter-spacing:1.6px;color:var(--accent);font-weight:700}.lead{color:var(--muted);max-width:720px}
.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;flex-wrap:wrap;margin-bottom:18px}.progress{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.progress span{font:600 11px ui-monospace,monospace;padding:4px 7px;border-radius:5px;background:var(--code);color:var(--muted)}.progress span.on{background:var(--accent);color:var(--panel)}.progress small{width:100%;text-align:right;margin-top:4px}
nav{position:sticky;top:0;z-index:2;background:var(--bg);display:flex;gap:6px;overflow-x:auto;padding:10px 0;margin-bottom:14px;border-bottom:1px solid var(--line)}nav a{white-space:nowrap;color:var(--muted);text-decoration:none;font-size:12px;padding:5px 9px;border-radius:6px}nav a:hover{background:var(--panel);color:var(--ink)}
.overview{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:18px}.card{display:flex;flex-direction:column;gap:3px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;text-decoration:none;color:inherit;min-width:0}.card:hover{border-color:var(--accent)}.card.off{opacity:.6;border-style:dashed}.card span:last-child{font-size:12px;color:var(--muted);overflow-wrap:anywhere}.code{font:700 11px ui-monospace,monospace;color:var(--accent);letter-spacing:.5px}
section{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:16px;min-width:0}.layer>header{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}.layer>header .code{background:var(--accent-soft);padding:6px 8px;border-radius:6px}.layer>header p{color:var(--muted);font-size:12px}.stamp{margin-left:auto;font-size:11px;color:var(--muted);white-space:nowrap}
.flow h2{margin-bottom:12px}.pipeline{display:flex;align-items:stretch;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px}.pipeline>div{flex:1 0 120px;border:1px solid var(--line);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:2px}.pipeline i{align-self:center;color:var(--muted);font-style:normal}.pipeline small{font-size:11px}
.kv{display:grid;grid-template-columns:140px 1fr;gap:8px 16px;margin:0}.kv dt{color:var(--muted);font-size:12px}.kv dd{margin:0;overflow-wrap:anywhere}
ul{margin:0;padding-left:18px}li{margin:3px 0}.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}.chips{display:flex;flex-wrap:wrap;gap:6px}.chip,.pill{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:var(--code);color:var(--muted);white-space:nowrap}.pill.ok{background:var(--accent-soft);color:var(--accent)}.pill.stop{background:var(--stop-soft);color:var(--stop)}.pill.warn{background:var(--human-soft);color:var(--human)}
.assembly{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:14px}.assembly span{font-size:12px;padding:5px 9px;border-radius:6px;background:var(--agent-soft);color:var(--agent)}.assembly i{color:var(--muted);font-style:normal}
.techs{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}.techs div{border:1px solid var(--line);border-radius:8px;padding:9px 11px;display:flex;flex-direction:column;gap:3px}.techs span{font-size:12px;color:var(--muted)}
.table{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;font-size:11px;color:var(--muted);font-weight:500;border-bottom:1px solid var(--line);padding:8px}td{border-bottom:1px solid var(--line);padding:9px 8px;vertical-align:top}tr:last-child td{border:0}
.diagram{overflow-x:auto;margin:6px 0 10px;padding:4px 0}.diagram svg{display:block;max-width:none}
.edge{fill:none;stroke:var(--muted);stroke-width:1.5}.edge.back{stroke:var(--human);stroke-dasharray:5 4}.edge.stopline{stroke:var(--stop)}.arrow{fill:var(--muted)}.arrow-back{fill:var(--human)}.elabel{font-size:11px;fill:var(--muted)}.elabel.back{fill:var(--human)}
.node rect{stroke-width:1.5}.node.agent rect{fill:var(--agent-soft);stroke:var(--agent)}.node.loop rect,.node.verify rect{fill:var(--loop-soft);stroke:var(--loop)}.node.check rect,.node.decide rect{fill:var(--check-soft);stroke:var(--check)}.node.human rect{fill:var(--human-soft);stroke:var(--human);stroke-dasharray:4 3}.node.done rect{fill:var(--accent-soft);stroke:var(--accent)}.node.stop rect{fill:var(--stop-soft);stroke:var(--stop)}
.ntitle{font-size:13px;font-weight:600;fill:var(--ink)}.nkind{font-size:10px;fill:var(--muted)}.nagent{font-size:10.5px;fill:var(--muted)}
.legend{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px}.lg{font-size:11px;padding:3px 9px;border-radius:6px;border:1px solid var(--line)}.lg.agent{background:var(--agent-soft)}.lg.loop{background:var(--loop-soft)}.lg.check{background:var(--check-soft)}.lg.human{background:var(--human-soft)}.lg.backlg{color:var(--human)}
.rules{margin:0;padding-left:20px}.rules li{margin:6px 0}
.agents{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}.agent{border:1px solid var(--line);border-radius:9px;padding:12px;display:flex;flex-direction:column;gap:5px}.agent p{font-size:12.5px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.row small{margin-left:auto}
.run{border:1px solid var(--line);border-radius:9px;padding:12px;margin-bottom:10px}.iters{margin:8px 0 0;padding-left:20px}.iters li{margin:5px 0;font-size:13px}.iters small{display:block}
.pending{border:1px dashed var(--line);border-radius:8px;padding:14px;color:var(--muted);font-size:13px}.raw{margin-top:14px}.raw summary{cursor:pointer;font-size:12px;color:var(--muted)}.raw pre{background:var(--code);padding:12px;border-radius:8px;overflow:auto;font-size:12px;max-height:360px}
footer{text-align:center;color:var(--muted);font-size:11px;margin-top:24px}
@media (max-width:900px){.overview{grid-template-columns:repeat(3,minmax(0,1fr))}.two{grid-template-columns:1fr}}@media (max-width:560px){.overview{grid-template-columns:1fr 1fr}.kv{grid-template-columns:1fr}.kv dt{margin-top:6px}h1{font-size:23px}}`;

module.exports={render,graphSVG,loopSVG};
