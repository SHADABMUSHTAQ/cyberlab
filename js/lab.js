import {DEVICE_CATALOG,LABS} from './data.js';
import {SimulationEngine,CLIEngine} from './engine.js';
import {state,setCurrentLab,completeLab,masterLab,markOrientation,rank} from './state.js';
import {createPanels} from './lab-panels.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],main=()=>$('#mainView'),modalRoot=()=>$('#modalRoot');
let homeHandler=()=>{},sim=new SimulationEngine(),cli=new CLIEngine(sim),lab=null,stepIndex=0,mode='guided',selectedDevice=null,inspectorTab='overview',activeCable=null,cableStart=null,dragging=null,terminalOpen=false,packetAnimation=null,panels=null;
const actions=[];

export function setHomeHandler(fn){homeHandler=fn}
function toast(m){window.cyberToast?.(m)}
function record(kind,target,extra={}){actions.push({kind,target,ts:Date.now(),...extra});if(actions.length>120)actions.shift()}
function has(kind,target,since=0){return actions.some(a=>a.ts>=since&&a.kind===kind&&(target==null||a.target===target||String(a.target).includes(target)))}
function defaultPos(type,i,n){const map={pc:{x:120,y:390},switch:{x:390,y:320},router:{x:620,y:240},firewall:{x:720,y:390},server:{x:590,y:430},accesspoint:{x:570,y:180},patchpanel:{x:820,y:165}};let p={...(map[type]||{x:180+i*130,y:350})};if(n>1){p.x+=118*(n-1);p.y-=65*(n-1)}return p}
function setupDevices(){const used={};lab.devices.forEach((type,i)=>{used[type]=(used[type]||0)+1;const p=defaultPos(type,i,used[type]);sim.addDevice(type,p.x,p.y,used[type]>1?`${DEVICE_CATALOG[type].short}-${used[type]}`:DEVICE_CATALOG[type].short)})}

export function startLab(id){
  lab=LABS.find(l=>l.id===id)||LABS[0];setCurrentLab(id);sim.reset();cli=new CLIEngine(sim);stepIndex=0;mode=id==='sandbox'?'practice':'guided';selectedDevice=null;terminalOpen=false;activeCable=null;cableStart=null;dragging=null;packetAnimation=null;panels=null;actions.length=0;setupDevices();renderLab();
  if(id!=='sandbox')showOrientation(true);
}

function currentStep(){return lab.steps?.[stepIndex]}
function stepActionText(s=currentStep()){
  if(!s)return 'Explore the lab freely.';
  const map={inspect:'Click the highlighted device',inspectPort:'Click the highlighted port',cableTool:'Click the highlighted RJ45 cable',connect:'Connect the two highlighted ports',terminal:'Select the PC, open Terminal, then run ipconfig',configIp:'Select the highlighted device → Network → enter the address',ping:'Select the PC → Terminal → run ping 192.168.10.20'};
  return map[s.kind]||s.title;
}
function renderLab(){
  const guided=mode==='guided';
  const addShelf=lab.id==='sandbox'?`<span class="shelf-title">Add device</span>${['pc','switch','router','firewall','server'].map(t=>`<button class="shelf-item" data-add-device="${t}"><span>${DEVICE_CATALOG[t].icon}</span><span>${DEVICE_CATALOG[t].short}</span></button>`).join('')}<span class="shelf-divider"></span>`:'';
  main().className='lab-shell';main().innerHTML=`
  <div class="lab-header">
    <button class="back-btn" data-action="leave" aria-label="Back to modules">←</button>
    <div class="lab-title-block"><span class="lab-number">${lab.id==='sandbox'?'PLAYGROUND':`LAB ${String(LABS.findIndex(x=>x.id===lab.id)+1).padStart(2,'0')}`}</span><div><h2>${lab.title}</h2><p>${lab.subtitle}</p></div></div>
    <div class="mode-switch"><button data-mode="guided" class="${guided?'active':''}">Guided</button><button data-mode="practice" class="${mode==='practice'?'active':''}">Practice</button></div>
    <div class="lab-actions"><button data-action="resetLab">↻ Reset</button><button data-action="helpLab">? Guide</button></div>
  </div>
  <div class="lab-layout">
    <aside class="coach-panel" id="coachPanel"></aside>
    <section class="lab-stage-wrap" id="labStageWrap">
      <div class="now-banner" id="nowBanner"><span class="now-pulse"></span><div><small>DO THIS NOW</small><b>${guided?stepActionText():'Solve the objective without step-by-step help'}</b></div><button data-action="showTarget">Show me</button></div>
      <div class="room-wall"></div><div class="desk-plane"></div>
      <div class="pegboard"><div class="peg-title">CABLES</div><div class="peg-tools"><button class="cable-reel" data-cable="rj45"><span class="coil"></span><span>RJ45</span></button><button class="cable-reel console" data-cable="console"><span class="coil"></span><span>Console</span></button></div></div>
      <div class="rack"><div class="rack-label">RACK</div>${Array.from({length:6},()=>`<div class="rack-slot">${'<i></i>'.repeat(9)}</div>`).join('')}</div>
      <svg class="cable-svg" id="cableSvg"></svg><div class="stage" id="stage"></div>
      <div class="connection-status" id="connectionStatus"></div><div class="stage-hint" id="stageHint"></div>
      <div class="device-shelf">${addShelf}<span class="shelf-title">Tools</span><button class="shelf-item" data-cable="rj45"><span>🔌</span><span>RJ45</span></button><button class="shelf-item" data-action="terminal"><span>⌨</span><span>Terminal</span></button></div>
      <button class="terminal-fab" data-action="terminal">⌨ Terminal</button><div class="terminal-drawer" id="terminalDrawer"></div><div id="inspectorRoot"></div>
    </section>
  </div>`;
  renderCoach();renderStage();renderTerminal();bindLabActions();updateNowBanner();updateConnectionStatus();highlightCurrentTarget();
}

function renderCoach(){
  const p=$('#coachPanel'),steps=lab.steps||[],s=currentStep();if(!p)return;
  if(mode==='practice'||!s){p.innerHTML=`<div class="coach-title"><div class="coach-bot">🧪</div><div><h3>${lab.id==='sandbox'?'Free Playground':'Independent Practice'}</h3><p>${lab.id==='sandbox'?'Experiment without consequences.':'No highlighted answers. Prove you can do it alone.'}</p></div></div><div class="coach-step emphasis"><span class="step-label">YOUR MISSION</span><h4>${lab.outcome}</h4><p>${lab.id==='sandbox'?'Inspect devices, click ports, cable equipment and use the terminal whenever you want.':'Use the same real workflow: inspect → connect → configure → test.'}</p>${lab.id!=='sandbox'?'<button class="btn yellow coach-next" data-action="verifyPractice">Verify my work</button>':''}</div><div class="coach-footer"><b>Stuck?</b> Reset the lab and switch back to Guided mode. Practice should test you, not trap you.</div>`;p.querySelector('[data-action="verifyPractice"]')?.addEventListener('click',verifyPractice);return}
  p.innerHTML=`<div class="coach-title"><div class="coach-bot">🌱</div><div><h3>Byte</h3><p>Your lab partner. One action at a time.</p></div></div>
  <div class="lesson-progress">${steps.map((_,i)=>`<i class="${i<stepIndex?'done':i===stepIndex?'current':''}"></i>`).join('')}</div>
  <div class="coach-step emphasis"><span class="step-label">STEP ${stepIndex+1} / ${steps.length}</span><h4>${s.title}</h4><p>${s.body}</p><div class="do-card"><small>DO THIS</small><b>${stepActionText(s)}</b></div><div class="coach-tip"><b>Why it matters</b><span>${s.tip}</span></div><div class="coach-buttons"><button class="btn soft" data-action="showTarget">Show me where</button><button class="btn primary coach-next" data-action="checkStep">I did it →</button></div></div>
  <div class="objectives"><h4>Progress</h4>${steps.map((x,i)=>`<div class="objective ${i<stepIndex?'done':i===stepIndex?'active':''}"><span class="obj-dot">${i<stepIndex?'✓':i===stepIndex?'→':'○'}</span><span>${x.title}</span></div>`).join('')}</div>
  <div class="coach-footer">You do not need to know commands in advance. When a command is needed, Byte tells you exactly what to try and what it proves.</div>`;
  p.querySelector('[data-action="checkStep"]').onclick=checkStep;p.querySelector('[data-action="showTarget"]').onclick=showTarget;
}

function renderDevice(d){
  const cat=DEVICE_CATALOG[d.type],ports=cat.ports;let body='';
  if(d.type==='pc')body=`<div class="device-body"><div class="pc-screen"><span>CYBERLAB</span></div><span class="port endpoint-port ${sim.linkFor(d.id,'eth0')?'connected':''}" data-port="eth0"><em>Eth0</em></span></div>`;
  else if(d.type==='server')body=`<div class="device-body"><div class="server-lights"><span></span><span></span><span></span><span></span></div><div class="port-strip endpoint-strip">${ports.map(p=>`<span class="port ${sim.linkFor(d.id,p.id)?'connected':''}" data-port="${p.id}"><em>${p.label}</em></span>`).join('')}</div></div>`;
  else body=`<div class="device-body"><div class="dev-brand">${cat.name.toUpperCase()}</div><div class="port-strip">${ports.slice(0,8).map(p=>`<span class="port ${sim.linkFor(d.id,p.id)?'connected':''}" data-port="${p.id}"><em>${p.label}</em></span>`).join('')}</div></div>`;
  return `<div class="lab-device ${d.type} ${selectedDevice===d.id?'selected':''}" data-device="${d.id}" style="left:${d.x}px;top:${d.y}px">${body}<div class="device-label">${d.name}<small>${cat.category}</small></div></div>`;
}
function renderStage(){const stage=$('#stage');if(!stage)return;stage.innerHTML=sim.devices.map(renderDevice).join('');bindDeviceEvents();renderCables();highlightCurrentTarget()}
function bindDeviceEvents(){
  $$('.lab-device').forEach(el=>{el.onpointerdown=e=>{if(e.target.closest('.port'))return;selectDevice(el.dataset.device);const d=sim.getDevice(el.dataset.device);dragging={id:d.id,startX:e.clientX,startY:e.clientY,origX:d.x,origY:d.y};el.setPointerCapture?.(e.pointerId)};el.onpointermove=e=>{if(!dragging||dragging.id!==el.dataset.device)return;const nx=Math.max(12,dragging.origX+e.clientX-dragging.startX),ny=Math.max(88,dragging.origY+e.clientY-dragging.startY);sim.setPosition(dragging.id,nx,ny);el.style.left=nx+'px';el.style.top=ny+'px';renderCables()};el.onpointerup=()=>dragging=null});
  $$('.port').forEach(p=>p.onpointerdown=e=>{e.preventDefault();e.stopPropagation();handlePort(e.target.closest('[data-device]').dataset.device,p.dataset.port)})
}
function selectDevice(id){selectedDevice=id;renderStage();renderInspector();renderTerminal();record('inspect',id);stageHint(`${sim.getDevice(id).name} selected. Inspect it on the right.`)}
function handlePort(dev,port){
  selectDevice(dev);inspectorTab='ports';renderInspector();record('inspectPort',`${dev}:${port}`);
  if(!activeCable){stageHint(`${sim.getDevice(dev).name} ${port} selected. To connect it, pick RJ45 first.`);updateConnectionStatus();return}
  if(!cableStart){cableStart={dev,port};updateConnectionStatus();stageHint(`First end attached to ${sim.getDevice(dev).name} ${port}. Now click the destination port.`);highlightCurrentTarget();return}
  if(cableStart.dev===dev&&cableStart.port===port){cableStart=null;updateConnectionStatus();stageHint('Cable start cancelled. Choose the first port again.');return}
  const r=sim.connect(cableStart.dev,cableStart.port,dev,port,activeCable);
  if(r.ok){toast('Cable connected. Both link LEDs are green.');record('connect',`${cableStart.dev}:${cableStart.port}>${dev}:${port}`);record('connect',`${dev}:${port}>${cableStart.dev}:${cableStart.port}`)}else toast(r.message);
  cableStart=null;activeCable=null;$$('[data-cable]').forEach(x=>x.classList.remove('active'));renderStage();renderInspector();updateConnectionStatus();
}
function chooseCable(type){activeCable=type;cableStart=null;$$('[data-cable]').forEach(x=>x.classList.toggle('active',x.dataset.cable===type));record('cableTool',type);updateConnectionStatus();stageHint(`${type==='rj45'?'RJ45 Ethernet':'Console'} cable is in your hand. Click the FIRST port.`);highlightCurrentTarget()}
function updateConnectionStatus(){const el=$('#connectionStatus');if(!el)return;if(!activeCable){el.className='connection-status';el.innerHTML='';return}const label=activeCable==='rj45'?'RJ45 Ethernet':'Console';el.className='connection-status show';el.innerHTML=cableStart?`<span>🔌</span><div><small>${label} · END 1 CONNECTED</small><b>${sim.getDevice(cableStart.dev)?.name} ${cableStart.port}</b><em>Now click the second port</em></div><button data-cancel-cable>Cancel</button>`:`<span>🔌</span><div><small>${label} SELECTED</small><b>Click the first port</b><em>Port labels appear when you hover</em></div><button data-cancel-cable>Cancel</button>`;el.querySelector('[data-cancel-cable]').onclick=()=>{activeCable=null;cableStart=null;$$('[data-cable]').forEach(x=>x.classList.remove('active'));updateConnectionStatus();highlightCurrentTarget()}}
function stageHint(msg){const h=$('#stageHint');if(!h)return;h.textContent=msg;h.classList.add('show');clearTimeout(h._t);h._t=setTimeout(()=>h.classList.remove('show'),4200)}
function highlightPort(dev,port){document.querySelector(`[data-device="${dev}"] [data-port="${CSS.escape(port)}"]`)?.classList.add('target')}
function getPortCenter(key){const [dev,port]=key.split(':');const el=document.querySelector(`[data-device="${dev}"] [data-port="${CSS.escape(port)}"]`)||document.querySelector(`[data-device="${dev}"] .device-body`);if(!el)return null;const r=el.getBoundingClientRect(),w=$('#labStageWrap').getBoundingClientRect();return{x:r.left+r.width/2-w.left,y:r.top+r.height/2-w.top}}
function renderCables(){const svg=$('#cableSvg');if(!svg)return;svg.innerHTML='';for(const l of sim.links){const a=getPortCenter(l.a),b=getPortCenter(l.b);if(!a||!b)continue;const mx=(a.x+b.x)/2,p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',`M ${a.x} ${a.y} C ${mx} ${a.y+50}, ${mx} ${b.y+50}, ${b.x} ${b.y}`);p.setAttribute('class',`cable-line ${l.cable==='console'?'console':''}`);p.dataset.link=l.id;svg.appendChild(p)}if(packetAnimation)animatePacket(packetAnimation)}
function animatePacket(info){const svg=$('#cableSvg'),pair=info?.path?.slice(0,2);if(!svg||!pair||pair.length<2)return;const link=sim.links.find(l=>(l.a.startsWith(pair[0]+':')&&l.b.startsWith(pair[1]+':'))||(l.b.startsWith(pair[0]+':')&&l.a.startsWith(pair[1]+':')));if(!link)return;const path=svg.querySelector(`[data-link="${link.id}"]`);if(!path)return;const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r','7');c.setAttribute('class','packet-dot');svg.appendChild(c);let start;function tick(t){start??=t;const u=Math.min(1,(t-start)/1050),pt=path.getPointAtLength(path.getTotalLength()*u);c.setAttribute('cx',pt.x);c.setAttribute('cy',pt.y);if(u<1)requestAnimationFrame(tick);else c.remove()}requestAnimationFrame(tick);packetAnimation=null}

function ensurePanels(){if(!panels)panels=createPanels({sim,catalog:DEVICE_CATALOG,selected:()=>selectedDevice?sim.getDevice(selectedDevice):null,tab:()=>inspectorTab,setTab:t=>inspectorTab=t,closeInspect:()=>{selectedDevice=null;panels.renderInspector();renderStage()},toast,record,toggleTerminal,terminalOpen:()=>terminalOpen,runCommand});return panels}
function renderInspector(){ensurePanels().renderInspector()}
function renderTerminal(){ensurePanels().renderTerminal()}
function toggleTerminal(force){terminalOpen=force??!terminalOpen;if(terminalOpen&&!selectedDevice){toast('Select a device first. The terminal belongs to the device you are operating.');terminalOpen=false}renderTerminal();if(terminalOpen&&selectedDevice)record('terminal',sim.getDevice(selectedDevice).type)}
function runCommand(cmd){if(!selectedDevice)return toast('Select the device you want to operate first.');const clean=String(cmd||'').trim();if(!clean)return;const out=$('#terminalOutput'),r=cli.execute(selectedDevice,clean);if(out){out.textContent+=`\n${sim.getDevice(selectedDevice).name}> ${clean}\n${r.text}\n`;out.scrollTop=out.scrollHeight}record('command',clean.toLowerCase(),{deviceType:sim.getDevice(selectedDevice).type});if(r.packet){packetAnimation=r.packet;renderCables();if(r.ok!==false)record('ping',clean.split(/\s+/)[1])}}

function stepIsDone(s=currentStep()){
  if(!s)return true;const byType=t=>sim.devices.filter(d=>d.type===t);
  if(s.kind==='inspect')return byType(s.target).some(d=>has('inspect',d.id));
  if(s.kind==='inspectPort'){const [t,p]=s.target.split(':');return byType(t).some(d=>has('inspectPort',`${d.id}:${p}`));}
  if(s.kind==='cableTool')return has('cableTool',s.target);
  if(s.kind==='connect'){const [left,right]=s.target.split('>'),[lt,lp]=left.split(':'),[rt,rp]=right.split(':');return sim.links.some(l=>{const [ad,ap]=l.a.split(':'),[bd,bp]=l.b.split(':'),A=sim.getDevice(ad),B=sim.getDevice(bd);return A&&B&&((A.type===lt&&ap===lp&&B.type===rt&&bp===rp)||(B.type===lt&&bp===lp&&A.type===rt&&ap===rp))})}
  if(s.kind==='terminal')return has('command','ipconfig')&&actions.some(a=>a.kind==='command'&&a.deviceType===s.target&&a.target==='ipconfig');
  if(s.kind==='configIp'){const expected=s.target==='pc'?'192.168.10.10':'192.168.10.20';return byType(s.target).some(d=>{const c=sim.getIp(d.id);return c.ip===expected&&c.mask==='255.255.255.0'})}
  if(s.kind==='ping')return has('ping',s.target);
  return false;
}
function missingMessage(s=currentStep()){
  if(!s)return 'Nothing is missing.';
  const map={inspect:'Click the highlighted device once. Its inspector should open on the right.',inspectPort:'Open the highlighted device and click the glowing port itself.',cableTool:'Click RJ45 in the cable area. You should see a green “cable selected” tray.',connect:'RJ45 must connect the exact two requested ports. Watch for green LEDs on both ends.',terminal:'Select the PC, open Terminal, and actually run `ipconfig` by pressing Enter.',configIp:'Open the highlighted endpoint → Network. Enter the exact IPv4 address and 255.255.255.0, then Save.',ping:'Select the PC → Terminal. Run `ping 192.168.10.20` and get replies.'};return map[s.kind]||'Complete the current action first.'
}
function checkStep(){const s=currentStep();if(!s)return;if(!stepIsDone(s)){stageHint(missingMessage(s));showTarget();return toast('Almost. Byte highlighted what is still missing.')}stepIndex++;if(stepIndex>=lab.steps.length){completeLab(lab.id,actions);return achievement()}renderCoach();updateNowBanner();highlightCurrentTarget();toast('Correct. Next action is ready.')}
function verifyPractice(){let ok=false;if(lab.id==='physical-1')ok=['switch','router','firewall'].every(t=>sim.devices.filter(d=>d.type===t).some(d=>has('inspect',d.id)))&&sim.devices.filter(d=>d.type==='switch').some(d=>has('inspectPort',`${d.id}:gi0/1`));if(lab.id==='cabling-1'){const pc=sim.devices.find(d=>d.type==='pc'),sw=sim.devices.find(d=>d.type==='switch');ok=!!(pc&&sw&&sim.links.some(l=>(l.a===pc.id+':eth0'&&l.b===sw.id+':gi0/1')||(l.b===pc.id+':eth0'&&l.a===sw.id+':gi0/1'))&&actions.some(a=>a.kind==='command'&&a.deviceType==='pc'&&a.target==='ipconfig'))}if(lab.id==='ipv4-1'){const pc=sim.devices.find(d=>d.type==='pc'),srv=sim.devices.find(d=>d.type==='server');ok=!!(pc&&srv&&sim.getIp(pc.id).ip==='192.168.10.10'&&sim.getIp(pc.id).mask==='255.255.255.0'&&sim.getIp(srv.id).ip==='192.168.10.20'&&sim.getIp(srv.id).mask==='255.255.255.0'&&has('ping','192.168.10.20'))}if(!['physical-1','cabling-1','ipv4-1'].includes(lab.id))return toast('This advanced lab is not yet eligible for mastery.');if(!ok){stageHint('Practice is not verified yet. Check the mission goal and prove every required result.');return toast('Not verified yet.')}masterLab(lab.id,actions);achievement(true)}

function achievement(mastery=false){const root=modalRoot();root.innerHTML=`<div class="modal-backdrop"><div class="modal-card achievement"><div class="trophy">🏆</div><span class="kicker"><i class="kicker-dot"></i> ${mastery?'INDEPENDENT MASTERY':'GUIDED LAB COMPLETE'}</span><h2>${lab.title}</h2><p>${mastery?'You proved the skill without step-by-step guidance.':'Good. Now repeat it without Byte to turn completion into mastery.'}</p><div class="reward-row"><div class="reward"><b>+${mastery?250:150}</b><small>XP</small></div><div class="reward"><b>${state.completed.length}</b><small>labs complete</small></div><div class="reward"><b>${rank()[1]}</b><small>rank</small></div></div><div class="modal-actions"><button class="btn secondary" data-home>Back to journey</button>${mastery?'':'<button class="btn primary" data-practice>Try Practice mode →</button>'}</div></div></div>`;root.querySelector('[data-home]').onclick=()=>{root.innerHTML='';homeHandler()};root.querySelector('[data-practice]')?.addEventListener('click',()=>{root.innerHTML='';mode='practice';stepIndex=0;sim.reset();actions.length=0;selectedDevice=null;panels=null;setupDevices();renderLab()})}
function showOrientation(){const root=modalRoot(),first=currentStep();root.innerHTML=`<div class="modal-backdrop"><div class="modal-card orientation-v2"><div class="orientation-art">${lab.icon}</div><span class="kicker"><i class="kicker-dot"></i> ${mode==='guided'?'GUIDED LAB':'PRACTICE LAB'}</span><h2>${lab.title}</h2><p>${lab.subtitle}</p><div class="mission-brief"><small>YOUR GOAL</small><b>${lab.outcome}</b></div><div class="orientation-list"><div class="orientation-item"><span>1</span><span><b>Follow the green pulse.</b> It marks the device, port, cable or control you need now.</span></div><div class="orientation-item"><span>2</span><span><b>One action at a time.</b> The left guide and the top “Do this now” banner stay synchronized.</span></div><div class="orientation-item"><span>3</span><span><b>You can’t get lost.</b> Click “Show me” whenever you’re unsure and Byte will re-highlight the target.</span></div></div><div class="first-action"><small>FIRST ACTION</small><b>${first?stepActionText(first):'Explore the lab'}</b></div><button class="btn primary" data-start style="width:100%">Start the lab →</button></div></div>`;root.querySelector('[data-start]').onclick=()=>{markOrientation(lab.id);root.innerHTML='';showTarget()}}
function updateNowBanner(){const b=$('#nowBanner');if(!b)return;const strong=b.querySelector('b');if(strong)strong.textContent=mode==='guided'?stepActionText():'Solve the objective without step-by-step help'}
function showTarget(){highlightCurrentTarget();const s=currentStep();if(!s)return;stageHint(stepActionText(s));const focused=document.querySelector('.focused,.port.target,.cable-reel.active');focused?.scrollIntoView?.({behavior:'smooth',block:'center',inline:'center'});focused?.animate?.([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],{duration:650,iterations:2})}
function highlightCurrentTarget(){
  $$('.lab-device').forEach(x=>x.classList.remove('focused'));$$('.port').forEach(x=>x.classList.remove('target'));if(mode!=='guided')return;const s=currentStep();if(!s)return;
  if(['inspect','terminal','configIp'].includes(s.kind)){const d=sim.devices.find(d=>d.type===s.target);if(d)document.querySelector(`[data-device="${d.id}"]`)?.classList.add('focused')}
  if(s.kind==='inspectPort'){const [t,p]=s.target.split(':'),d=sim.devices.find(d=>d.type===t);if(d){document.querySelector(`[data-device="${d.id}"]`)?.classList.add('focused');highlightPort(d.id,p)}}
  if(s.kind==='cableTool')document.querySelectorAll(`[data-cable="${s.target}"]`).forEach(x=>x.classList.add('active'));
  if(s.kind==='connect'){const [left,right]=s.target.split('>'),[lt,lp]=left.split(':'),[rt,rp]=right.split(':'),A=sim.devices.find(d=>d.type===lt),B=sim.devices.find(d=>d.type===rt);if(A){document.querySelector(`[data-device="${A.id}"]`)?.classList.add('focused');highlightPort(A.id,lp)}if(B){document.querySelector(`[data-device="${B.id}"]`)?.classList.add('focused');highlightPort(B.id,rp)}}
}
function bindLabActions(){
  $('[data-action="leave"]').onclick=homeHandler;
  $$('[data-mode]').forEach(b=>b.onclick=()=>{if(b.dataset.mode==='practice'&&!state.completed.includes(lab.id)&&lab.id!=='sandbox')return toast('Finish Guided mode once before Practice mode.');mode=b.dataset.mode;stepIndex=0;sim.reset();actions.length=0;selectedDevice=null;terminalOpen=false;activeCable=null;cableStart=null;panels=null;setupDevices();renderLab();if(lab.id!=='sandbox')showOrientation()});
  $('[data-action="resetLab"]').onclick=()=>{sim.reset();actions.length=0;stepIndex=0;selectedDevice=null;terminalOpen=false;activeCable=null;cableStart=null;setupDevices();panels=null;renderLab();toast('Reset complete. Start again from Step 1.')};
  $('[data-action="helpLab"]').onclick=showOrientation;$$('[data-action="showTarget"]').forEach(b=>b.onclick=showTarget);$$('[data-cable]').forEach(b=>b.onclick=()=>chooseCable(b.dataset.cable));$$('[data-action="terminal"]').forEach(b=>b.onclick=()=>toggleTerminal());
  $$('[data-add-device]').forEach(b=>b.onclick=()=>{const t=b.dataset.addDevice;sim.addDevice(t,220+Math.random()*380,250+Math.random()*170);renderStage();toast(`${DEVICE_CATALOG[t].name} added.`)})
}
