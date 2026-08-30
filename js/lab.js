import {DEVICE_CATALOG, LABS} from './data.js';
import {SimulationEngine, CLIEngine} from './engine.js';
import {state, setCurrentLab, completeLab, masterLab, markOrientation, rank} from './state.js';
import {createPanels} from './lab-panels.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const main = () => $('#mainView');
const modalRoot = () => $('#modalRoot');

let homeHandler = () => {};
let sim = new SimulationEngine();
let cli = new CLIEngine(sim);
let lab = null;
let stepIndex = 0;
let mode = 'guided';
let selectedDevice = null;
let inspectorTab = 'overview';
let activeCable = null;
let cableStart = null;
let dragging = null;
let terminalOpen = false;
let packetAnimation = null;
let panels = null;
const actions = [];

export function setHomeHandler(fn) { homeHandler = fn; }
function toast(m) { window.cyberToast?.(m); }

function record(kind, target, extra = {}) {
  actions.push({ kind, target, ts: Date.now(), ...extra });
  if (actions.length > 150) actions.shift();
}

function has(kind, target, since = 0) {
  return actions.some(a => a.ts >= since && a.kind === kind && (target == null || a.target === target || String(a.target).includes(target)));
}

// Auto-centered positions to guarantee 100% visibility on all viewports without scrolling
function defaultPos(type, i, n, total) {
  const stageWrap = $('#labStageWrap');
  const w = stageWrap ? stageWrap.clientWidth : 750;
  const h = stageWrap ? stageWrap.clientHeight : 520;
  
  const map = {
    pc: { x: Math.max(30, w * 0.08), y: h * 0.45 },
    switch: { x: Math.max(180, w * 0.35), y: h * 0.28 },
    router: { x: Math.max(180, w * 0.35), y: h * 0.58 },
    firewall: { x: Math.max(340, w * 0.62), y: h * 0.45 },
    server: { x: Math.max(340, w * 0.65), y: h * 0.28 },
    accesspoint: { x: Math.max(340, w * 0.65), y: h * 0.15 },
    patchpanel: { x: Math.max(340, w * 0.65), y: h * 0.15 }
  };
  
  let p = { ...(map[type] || { x: 50 + i * 160, y: 180 }) };
  if (n > 1) {
    p.x += 140 * (n - 1);
    p.y += 50 * (n - 1);
  }
  return p;
}

function setupDevices() {
  const used = {};
  lab.devices.forEach((type, i) => {
    used[type] = (used[type] || 0) + 1;
    const p = defaultPos(type, i, used[type], lab.devices.length);
    sim.addDevice(type, p.x, p.y, used[type] > 1 ? `${DEVICE_CATALOG[type].short}-${used[type]}` : DEVICE_CATALOG[type].short);
  });
}

export function startLab(id) {
  lab = LABS.find(l => l.id === id) || LABS[0];
  setCurrentLab(id);
  sim.reset();
  cli = new CLIEngine(sim);
  stepIndex = 0;
  mode = id === 'sandbox' ? 'practice' : 'guided';
  selectedDevice = null;
  terminalOpen = false;
  activeCable = null;
  cableStart = null;
  dragging = null;
  packetAnimation = null;
  panels = null;
  actions.length = 0;
  setupDevices();
  renderLab();
  if (id !== 'sandbox') showOrientation(true);
}

function currentStep() {
  return lab.steps?.[stepIndex];
}

function stepActionText(s = currentStep()) {
  if (!s) return 'Explore the enterprise lab freely.';
  const map = {
    inspect: 'Click highlighted device to inspect architecture',
    inspectPort: 'Click glowing interface in Ports tab',
    cableTool: 'Select Cat6 RJ45 from the bottom dock',
    connect: 'Connect the two highlighted ports with the cable',
    terminal: 'Open Terminal and run suggested command',
    configIp: 'Open Inspector → Network → commit IPv4 settings',
    ping: 'Open Terminal and execute ping test'
  };
  return map[s.kind] || s.title;
}

function renderLab() {
  const guided = mode === 'guided';

  main().className = 'lab-shell';
  main().innerHTML = `
  <div class="lab-header">
    <div class="lab-header-left">
      <button class="back-btn" data-action="leave" title="Back to curriculum">←</button>
      <div class="lab-title-group">
        <span class="lab-badge">${lab.id === 'sandbox' ? 'PLAYGROUND' : `LAB ${String(LABS.findIndex(x => x.id === lab.id) + 1).padStart(2, '0')}`}</span>
        <h2>${lab.title}</h2>
      </div>
    </div>
    
    <div class="mode-toggle">
      <button data-mode="guided" class="${guided ? 'active' : ''}">Guided</button>
      <button data-mode="practice" class="${mode === 'practice' ? 'active' : ''}">Practice</button>
    </div>
    
    <div class="header-actions">
      <button data-action="resetLab" title="Reset topology">↻ Reset</button>
      <button data-action="helpLab" title="Lab instructions">? Guide</button>
    </div>
  </div>

  <div class="lab-layout">
    <aside class="coach-panel" id="coachPanel"></aside>
    
    <section class="lab-stage-wrap" id="labStageWrap">
      <svg class="cable-svg" id="cableSvg"></svg>
      <div class="stage" id="stage"></div>
      
      <div class="connection-status" id="connectionStatus"></div>
      <div class="stage-hint" id="stageHint"></div>

      <!-- Minimalist Floating Tool Dock -->
      <div class="stage-dock">
        <button class="dock-btn" data-cable="rj45"><span>🔌</span><span>Cat6 RJ45</span></button>
        <button class="dock-btn" data-cable="console"><span>⚡</span><span>Console</span></button>
        <div class="dock-divider"></div>
        <button class="dock-btn" data-action="terminal"><span>⌨</span><span>Terminal</span></button>
        <button class="dock-btn" data-action="openTeardownDirect"><span>🔬</span><span>3D Teardown</span></button>
      </div>

      <div class="terminal-drawer" id="terminalDrawer"></div>
      <div id="inspectorRoot"></div>
    </section>
  </div>`;

  renderCoach();
  renderStage();
  renderTerminal();
  bindLabActions();
  updateConnectionStatus();
  highlightCurrentTarget();
}

function renderCoach() {
  const p = $('#coachPanel');
  const steps = lab.steps || [];
  const s = currentStep();
  if (!p) return;

  if (mode === 'practice' || !s) {
    p.innerHTML = `
    <div>
      <div class="coach-header">
        <div class="coach-avatar">🧪</div>
        <div>
          <h3>${lab.id === 'sandbox' ? 'Playground' : 'Practice Mode'}</h3>
          <p>Independent execution</p>
        </div>
      </div>
      <div class="coach-step-box">
        <span class="step-kicker">MISSION OUTCOME</span>
        <h4>${lab.outcome}</h4>
        <p>${lab.id === 'sandbox' ? 'Add hardware, plug cables, configure subnets, and test CLI commands.' : 'Follow engineering workflow: Cable L1 → Address L3 → Verify with CLI.'}</p>
        ${lab.id !== 'sandbox' ? '<button class="btn yellow" style="width:100%" data-action="verifyPractice">Verify Topology →</button>' : ''}
      </div>
    </div>
    <div style="font-size:10px;color:#7a9688;line-height:1.4">
      Switch to <b>Guided</b> mode anytime for step-by-step assistance.
    </div>`;
    p.querySelector('[data-action="verifyPractice"]')?.addEventListener('click', verifyPractice);
    return;
  }

  p.innerHTML = `
  <div>
    <div class="coach-header">
      <div class="coach-avatar">🌱</div>
      <div>
        <h3>Byte</h3>
        <p>Lab Partner</p>
      </div>
    </div>
    <div class="step-progress-bar">
      ${steps.map((_, i) => `<i class="${i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}"></i>`).join('')}
    </div>
    <div class="coach-step-box">
      <span class="step-kicker">STEP ${stepIndex + 1} OF ${steps.length}</span>
      <h4>${s.title}</h4>
      <p>${s.body}</p>
      
      <div class="action-card">
        <small>ACTION REQUIRED</small>
        <b>${stepActionText(s)}</b>
      </div>

      <div class="coach-tip-card">
        <b>Engineering Rationale</b>
        <span>${s.tip}</span>
      </div>

      <div class="coach-nav-buttons">
        <button class="btn secondary" data-action="showTarget">Show Target</button>
        <button class="btn primary" data-action="checkStep">Verify →</button>
      </div>
    </div>
  </div>

  <div class="objectives-compact">
    ${steps.map((x, i) => `
      <div class="obj-row ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}">
        <span class="obj-dot">${i < stepIndex ? '✓' : i === stepIndex ? '→' : '○'}</span>
        <span>${x.title}</span>
      </div>`).join('')}
  </div>`;

  p.querySelector('[data-action="checkStep"]').onclick = checkStep;
  p.querySelector('[data-action="showTarget"]').onclick = showTarget;
}

function renderDevice(d) {
  const cat = DEVICE_CATALOG[d.type];
  const ports = cat.ports;
  let body = '';

  if (d.type === 'pc') {
    body = `
    <div class="device-body">
      <div class="pc-screen">
        <span>CYBERLAB OS</span>
        <span>${d.name}</span>
        <span>IP: ${sim.getIp(d.id).ip}</span>
      </div>
      <span class="port endpoint-port ${sim.linkFor(d.id, 'eth0') ? 'connected' : ''}" data-port="eth0"><em>Eth0 (RJ45)</em></span>
    </div>`;
  } else if (d.type === 'server') {
    body = `
    <div class="device-body" style="height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 8px">
      <div style="font-size:7px;font-weight:900;color:#c6d6cf">2U SERVER</div>
      <div class="port-strip">
        ${ports.map(p => `
          <div class="port-jack-block">
            <div class="port-dual-leds"><span class="mini-led ${sim.linkFor(d.id, p.id) ? 'link-up' : ''}"></span></div>
            <span class="port ${sim.linkFor(d.id, p.id) ? 'connected' : ''}" data-port="${p.id}"><em>${p.label}</em></span>
          </div>`).join('')}
      </div>
    </div>`;
  } else if (d.type === 'switch') {
    body = `
    <div class="device-body">
      <div class="rack-ear-left"><span class="rack-screw"></span><span class="rack-screw"></span></div>
      <div class="rack-ear-right"><span class="rack-screw"></span><span class="rack-screw"></span></div>
      <div class="switch-header">
        <span>24-PORT GIGABIT SWITCH</span>
        <div class="switch-sys-leds"><span class="sys-led"></span></div>
      </div>
      <div class="port-strip">
        ${ports.slice(0, 8).map(p => `
          <div class="port-jack-block">
            <div class="port-dual-leds">
              <span class="mini-led ${sim.linkFor(d.id, p.id) ? 'link-up' : ''}"></span>
              <span class="mini-led ${sim.linkFor(d.id, p.id) ? 'act-blink' : ''}"></span>
            </div>
            <span class="port ${p.type === 'console' ? 'console-port' : ''} ${sim.linkFor(d.id, p.id) ? 'connected' : ''}" data-port="${p.id}"><em>${p.label}</em></span>
          </div>`).join('')}
      </div>
    </div>`;
  } else {
    body = `
    <div class="device-body">
      <div class="rack-ear-left"><span class="rack-screw"></span><span class="rack-screw"></span></div>
      <div class="rack-ear-right"><span class="rack-screw"></span><span class="rack-screw"></span></div>
      <div class="switch-header">
        <span>${cat.short.toUpperCase()}</span>
        <div class="switch-sys-leds"><span class="sys-led"></span></div>
      </div>
      <div class="port-strip">
        ${ports.map(p => `
          <div class="port-jack-block">
            <div class="port-dual-leds">
              <span class="mini-led ${sim.linkFor(d.id, p.id) ? 'link-up' : ''}"></span>
              <span class="mini-led ${sim.linkFor(d.id, p.id) ? 'act-blink' : ''}"></span>
            </div>
            <span class="port ${p.type === 'console' ? 'console-port' : ''} ${sim.linkFor(d.id, p.id) ? 'connected' : ''}" data-port="${p.id}"><em>${p.label}</em></span>
          </div>`).join('')}
      </div>
    </div>`;
  }

  return `
  <div class="lab-device ${d.type} ${selectedDevice === d.id ? 'selected' : ''}" data-device="${d.id}" style="left:${d.x}px;top:${d.y}px">
    ${body}
    <div class="device-label">
      <span>${d.name}</span>
      <button class="btn-micro-teardown" data-inspect-teardown="${d.id}" title="3D Hardware Teardown">🔬 3D</button>
    </div>
  </div>`;
}

function renderStage() {
  const stage = $('#stage');
  if (!stage) return;
  stage.innerHTML = sim.devices.map(renderDevice).join('');
  bindDeviceEvents();
  renderCables();
  highlightCurrentTarget();
}

function bindDeviceEvents() {
  $$('[data-inspect-teardown]').forEach(btn => {
    btn.onpointerdown = e => {
      e.stopPropagation();
      e.preventDefault();
      const dev = sim.getDevice(btn.dataset.inspectTeardown);
      if (dev) ensurePanels().openTeardownModal(dev);
    };
  });

  $$('.lab-device').forEach(el => {
    el.onpointerdown = e => {
      if (e.target.closest('.port') || e.target.closest('button')) return;
      e.stopPropagation();
      const devId = el.dataset.device;
      selectDevice(devId);
      const d = sim.getDevice(devId);
      if (!d) return;
      dragging = { id: d.id, startX: e.clientX, startY: e.clientY, origX: d.x, origY: d.y, el };
      el.setPointerCapture?.(e.pointerId);
    };
    el.onpointermove = e => {
      if (!dragging || dragging.id !== el.dataset.device) return;
      const stageWrap = $('#labStageWrap');
      const maxW = stageWrap ? stageWrap.clientWidth - 180 : 700;
      const maxH = stageWrap ? stageWrap.clientHeight - 110 : 450;
      const nx = Math.max(10, Math.min(maxW, dragging.origX + e.clientX - dragging.startX));
      const ny = Math.max(10, Math.min(maxH, dragging.origY + e.clientY - dragging.startY));
      sim.setPosition(dragging.id, nx, ny);
      el.style.left = nx + 'px';
      el.style.top = ny + 'px';
      renderCables();
    };
    el.onpointerup = e => {
      if (dragging?.el) {
        try { dragging.el.releasePointerCapture?.(e.pointerId); } catch (_) {}
      }
      dragging = null;
    };
    el.onpointercancel = () => { dragging = null; };
  });

  $$('.port').forEach(p => {
    p.onpointerdown = e => {
      e.preventDefault();
      e.stopPropagation();
      const devEl = e.target.closest('[data-device]');
      if (devEl) handlePort(devEl.dataset.device, p.dataset.port);
    };
  });
}

function selectDevice(id) {
  selectedDevice = id;
  $$('.lab-device').forEach(el => el.classList.toggle('selected', el.dataset.device === id));
  renderInspector();
  renderTerminal();
  record('inspect', id);
  const dev = sim.getDevice(id);
  if (dev) stageHint(`${dev.name} selected.`);
}

function handlePort(dev, port) {
  selectDevice(dev);
  inspectorTab = 'ports';
  renderInspector();
  record('inspectPort', `${dev}:${port}`);

  if (!activeCable) {
    stageHint(`${sim.getDevice(dev)?.name} [${port}]. Click Cat6 RJ45 in the bottom dock to cable.`);
    updateConnectionStatus();
    return;
  }
  if (!cableStart) {
    cableStart = { dev, port };
    updateConnectionStatus();
    stageHint(`Connected to ${sim.getDevice(dev)?.name} [${port}]. Now click target port.`);
    highlightCurrentTarget();
    return;
  }
  if (cableStart.dev === dev && cableStart.port === port) {
    cableStart = null;
    updateConnectionStatus();
    stageHint('Cabling canceled.');
    return;
  }

  const r = sim.connect(cableStart.dev, cableStart.port, dev, port, activeCable);
  if (r.ok) {
    toast('Cat6 Link Established (1000BASE-T Full Duplex).');
    record('connect', `${cableStart.dev}:${cableStart.port}>${dev}:${port}`);
    record('connect', `${dev}:${port}>${cableStart.dev}:${cableStart.port}`);
  } else {
    toast(r.message);
  }

  cableStart = null;
  activeCable = null;
  $$('[data-cable]').forEach(x => x.classList.remove('active'));
  renderStage();
  renderInspector();
  updateConnectionStatus();
}

function chooseCable(type) {
  if (activeCable === type) {
    activeCable = null;
    cableStart = null;
  } else {
    activeCable = type;
    cableStart = null;
  }
  $$('[data-cable]').forEach(x => x.classList.toggle('active', x.dataset.cable === activeCable));
  record('cableTool', type);
  updateConnectionStatus();
  if (activeCable) stageHint(`${type === 'rj45' ? 'Cat6 RJ45' : 'Console Cable'} armed. Click first port.`);
  highlightCurrentTarget();
}

function updateConnectionStatus() {
  const el = $('#connectionStatus');
  if (!el) return;
  if (!activeCable) {
    el.className = 'connection-status';
    el.innerHTML = '';
    return;
  }
  el.className = 'connection-status show';
  el.innerHTML = cableStart
    ? `<span>🔌</span><b>${sim.getDevice(cableStart.dev)?.name} [${cableStart.port}]</b> ➔ Click destination port <button data-cancel-cable>Cancel</button>`
    : `<span>🔌</span><b>${activeCable === 'rj45' ? 'Cat6 RJ45' : 'Console Cable'}</b> ➔ Click first port <button data-cancel-cable>Cancel</button>`;
  el.querySelector('[data-cancel-cable]').onclick = () => {
    activeCable = null;
    cableStart = null;
    $$('[data-cable]').forEach(x => x.classList.remove('active'));
    updateConnectionStatus();
    highlightCurrentTarget();
  };
}

function stageHint(msg) {
  const h = $('#stageHint');
  if (!h) return;
  h.textContent = msg;
  h.classList.add('show');
  clearTimeout(h._t);
  h._t = setTimeout(() => h.classList.remove('show'), 3500);
}

function highlightPort(dev, port) {
  document.querySelector(`[data-device="${dev}"] [data-port="${CSS.escape(port)}"]`)?.classList.add('target');
}

function getPortCenter(key) {
  const [dev, port] = key.split(':');
  const el = document.querySelector(`[data-device="${dev}"] [data-port="${CSS.escape(port)}"]`) || document.querySelector(`[data-device="${dev}"] .device-body`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const w = $('#labStageWrap').getBoundingClientRect();
  return { x: r.left + r.width / 2 - w.left, y: r.top + r.height / 2 - w.top };
}

function renderCables() {
  const svg = $('#cableSvg');
  if (!svg) return;
  svg.innerHTML = '';
  for (const l of sim.links) {
    const a = getPortCenter(l.a);
    const b = getPortCenter(l.b);
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', `M ${a.x} ${a.y} C ${mx} ${a.y + 40}, ${mx} ${b.y + 40}, ${b.x} ${b.y}`);
    p.setAttribute('class', `cable-line ${l.cable === 'console' ? 'console' : ''}`);
    p.dataset.link = l.id;
    svg.appendChild(p);
  }
  if (packetAnimation) animatePacket(packetAnimation);
}

function animatePacket(info) {
  const svg = $('#cableSvg');
  const path = info?.path;
  if (!svg || !path || path.length < 2) return;

  let currentHop = 0;
  function animateHop() {
    if (currentHop >= path.length - 1) return;
    const aDev = path[currentHop], bDev = path[currentHop + 1];
    const link = sim.links.find(l => (l.a.startsWith(aDev + ':') && l.b.startsWith(bDev + ':')) || (l.b.startsWith(aDev + ':') && l.a.startsWith(bDev + ':')));
    if (!link) { currentHop++; animateHop(); return; }

    const svgPath = svg.querySelector(`[data-link="${link.id}"]`);
    if (!svgPath) { currentHop++; animateHop(); return; }

    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', '6');
    c.setAttribute('class', 'packet-dot');
    c.title = 'Click to inspect in Wireshark viewer';
    c.onclick = () => {
      inspectorTab = 'packets';
      panels?.setCapturedPacket(info);
      renderInspector();
    };
    svg.appendChild(c);

    let start;
    function tick(t) {
      start ??= t;
      const u = Math.min(1, (t - start) / 600);
      const pt = svgPath.getPointAtLength(svgPath.getTotalLength() * u);
      c.setAttribute('cx', pt.x);
      c.setAttribute('cy', pt.y);
      if (u < 1) {
        requestAnimationFrame(tick);
      } else {
        c.remove();
        currentHop++;
        animateHop();
      }
    }
    requestAnimationFrame(tick);
  }
  animateHop();
  packetAnimation = null;
}

function ensurePanels() {
  if (!panels) {
    panels = createPanels({
      sim,
      catalog: DEVICE_CATALOG,
      selected: () => (selectedDevice ? sim.getDevice(selectedDevice) : null),
      tab: () => inspectorTab,
      setTab: t => (inspectorTab = t),
      closeInspect: () => {
        selectedDevice = null;
        $$('.lab-device').forEach(el => el.classList.remove('selected'));
        panels.renderInspector();
        renderTerminal();
      },
      toast,
      record,
      toggleTerminal,
      terminalOpen: () => terminalOpen,
      runCommand
    });
  }
  return panels;
}

function renderInspector() { ensurePanels().renderInspector(); }
function renderTerminal() { ensurePanels().renderTerminal(); }

function toggleTerminal(force) {
  terminalOpen = force ?? !terminalOpen;
  if (terminalOpen && !selectedDevice) {
    const first = sim.devices[0];
    if (first) selectDevice(first.id);
  }
  renderTerminal();
  if (terminalOpen && selectedDevice) record('terminal', sim.getDevice(selectedDevice).type);
}

function runCommand(cmd) {
  if (!selectedDevice) return toast('Select a device to execute command.');
  const clean = String(cmd || '').trim();
  if (!clean) return;
  const out = $('#terminalOutput');
  const r = cli.execute(selectedDevice, clean);
  if (out) {
    out.textContent += `\n${sim.getDevice(selectedDevice).name}> ${clean}\n${r.text}\n`;
    out.scrollTop = out.scrollHeight;
  }
  record('command', clean.toLowerCase(), { deviceType: sim.getDevice(selectedDevice).type });
  if (r.packet) {
    packetAnimation = r.packet;
    renderCables();
    if (r.ok !== false) record('ping', clean.split(/\s+/)[1]);
  }
}

// Full 13-Lab Validation Engine
function stepIsDone(s = currentStep()) {
  if (!s) return true;
  const byType = t => sim.devices.filter(d => d.type === t);

  if (s.kind === 'inspect') return byType(s.target).some(d => has('inspect', d.id));
  if (s.kind === 'inspectPort') {
    const [t, p] = s.target.split(':');
    return byType(t).some(d => has('inspectPort', `${d.id}:${p}`));
  }
  if (s.kind === 'cableTool') return has('cableTool', s.target);
  if (s.kind === 'connect') {
    const [left, right] = s.target.split('>');
    const [lt, lp] = left.split(':'), [rt, rp] = right.split(':');
    return sim.links.some(l => {
      const [ad, ap] = l.a.split(':'), [bd, bp] = l.b.split(':');
      const A = sim.getDevice(ad), B = sim.getDevice(bd);
      return A && B && (((A.type === lt || A.id === lt) && ap === lp && (B.type === rt || B.id === rt) && bp === rp) ||
                        ((B.type === lt || B.id === lt) && bp === lp && (A.type === rt || A.id === rt) && ap === rp));
    });
  }
  if (s.kind === 'terminal') return has('command', 'ipconfig') || has('command', 'show') || actions.some(a => a.kind === 'command' && a.deviceType === s.target);
  if (s.kind === 'configIp') {
    return byType(s.target).some(d => {
      const c = sim.getIp(d.id);
      return c.ip.startsWith('192.168.') || c.ip.startsWith('10.') || c.ip.startsWith('203.');
    });
  }
  if (s.kind === 'ping') return has('ping', s.target) || actions.some(a => a.kind === 'ping');
  return false;
}

function missingMessage(s = currentStep()) {
  if (!s) return 'Step complete.';
  const map = {
    inspect: 'Click the highlighted device to inspect it.',
    inspectPort: 'Click the highlighted port row in the Inspector.',
    cableTool: 'Select Cat6 RJ45 from the bottom dock.',
    connect: 'Plug Cat6 RJ45 into the two requested interfaces.',
    terminal: 'Open Terminal and run the requested command.',
    configIp: 'Configure and save the IPv4 stack address.',
    ping: 'Run ping in the Terminal to test connectivity.'
  };
  return map[s.kind] || 'Complete highlighted action first.';
}

function checkStep() {
  const s = currentStep();
  if (!s) return;
  if (!stepIsDone(s)) {
    stageHint(missingMessage(s));
    showTarget();
    return toast('Action pending. See highlighted target.');
  }
  stepIndex++;
  if (stepIndex >= lab.steps.length) {
    completeLab(lab.id, actions);
    return achievement();
  }
  renderCoach();
  highlightCurrentTarget();
  toast('Step verified!');
}

function verifyPractice() {
  const links = sim.links;
  const devices = sim.devices;
  let ok = false;

  if (lab.id === 'physical-1') {
    ok = ['switch', 'router', 'firewall'].every(t => devices.some(d => d.type === t && has('inspect', d.id)));
  } else if (lab.id === 'cabling-1') {
    const pc = devices.find(d => d.type === 'pc'), sw = devices.find(d => d.type === 'switch');
    ok = !!(pc && sw && links.some(l => (l.a.startsWith(pc.id) && l.b.startsWith(sw.id)) || (l.b.startsWith(pc.id) && l.a.startsWith(sw.id))));
  } else if (lab.id === 'ipv4-1' || lab.id === 'switching-1') {
    const pc = devices.find(d => d.type === 'pc'), srv = devices.find(d => d.type === 'server');
    ok = !!(pc && srv && sim.getIp(pc.id).ip.startsWith('192.168.') && sim.getIp(srv.id).ip.startsWith('192.168.') && has('ping'));
  } else if (lab.id === 'routing-1' || lab.id === 'firewall-1' || lab.id === 'nat-1') {
    ok = links.length >= 2 && actions.some(a => a.kind === 'ping' || a.kind === 'command');
  } else {
    ok = links.length >= 1 && actions.length >= 2;
  }

  if (!ok) {
    stageHint('Objectives pending. Verify links, IPs, and test commands.');
    return toast('Verification incomplete.');
  }
  masterLab(lab.id, actions);
  achievement(true);
}

function achievement(mastery = false) {
  const root = modalRoot();
  root.innerHTML = `
  <div class="modal-backdrop">
    <div class="modal-card achievement">
      <div class="trophy">🏆</div>
      <h2>${lab.title}</h2>
      <p>${mastery ? 'Complete independent mastery demonstrated.' : 'Guided module completed successfully.'}</p>
      <div class="reward-row">
        <div class="reward"><b>+${mastery ? 250 : 150}</b><small>XP</small></div>
        <div class="reward"><b>${state.completed.length}</b><small>Completed</small></div>
        <div class="reward"><b>${rank()[1]}</b><small>Rank</small></div>
      </div>
      <div class="modal-actions">
        <button class="btn secondary" data-home>Return to Modules</button>
        ${mastery ? '' : '<button class="btn primary" data-practice>Practice Mode →</button>'}
      </div>
    </div>
  </div>`;
  root.querySelector('[data-home]').onclick = () => { root.innerHTML = ''; homeHandler(); };
  root.querySelector('[data-practice]')?.addEventListener('click', () => {
    root.innerHTML = '';
    mode = 'practice';
    stepIndex = 0;
    sim.reset();
    actions.length = 0;
    selectedDevice = null;
    panels = null;
    setupDevices();
    renderLab();
  });
}

function showOrientation() {
  const root = modalRoot();
  root.innerHTML = `
  <div class="modal-backdrop">
    <div class="modal-card">
      <div class="orientation-art">${lab.icon}</div>
      <h2>${lab.title}</h2>
      <p>${lab.subtitle}</p>
      <div class="mission-brief">
        <small>MISSION</small>
        <b>${lab.outcome}</b>
      </div>
      <div class="orientation-list">
        <div class="orientation-item"><span>1</span><span>Follow the glowing green targets on ports and tools.</span></div>
        <div class="orientation-item"><span>2</span><span>Click moving packets to inspect real-world headers.</span></div>
        <div class="orientation-item"><span>3</span><span>Execute real diagnostic commands in the terminal.</span></div>
      </div>
      <button class="btn primary" data-start style="width:100%">Begin Lab →</button>
    </div>
  </div>`;
  root.querySelector('[data-start]').onclick = () => {
    markOrientation(lab.id);
    root.innerHTML = '';
    showTarget();
  };
}

function showTarget() {
  highlightCurrentTarget();
  const s = currentStep();
  if (!s) return;
  stageHint(stepActionText(s));
  const focused = document.querySelector('.focused, .port.target, .dock-btn.active');
  focused?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 500, iterations: 2 });
}

function highlightCurrentTarget() {
  $$('.lab-device').forEach(x => x.classList.remove('focused'));
  $$('.port').forEach(x => x.classList.remove('target'));
  if (mode !== 'guided') return;
  const s = currentStep();
  if (!s) return;

  if (['inspect', 'terminal', 'configIp'].includes(s.kind)) {
    const d = sim.devices.find(d => d.type === s.target || d.id === s.target);
    if (d) document.querySelector(`[data-device="${d.id}"]`)?.classList.add('focused');
  }
  if (s.kind === 'inspectPort') {
    const [t, p] = s.target.split(':');
    const d = sim.devices.find(d => d.type === t || d.id === t);
    if (d) {
      document.querySelector(`[data-device="${d.id}"]`)?.classList.add('focused');
      highlightPort(d.id, p);
    }
  }
  if (s.kind === 'cableTool') {
    document.querySelectorAll(`[data-cable="${s.target}"]`).forEach(x => x.classList.add('active'));
  }
  if (s.kind === 'connect') {
    const [left, right] = s.target.split('>');
    const [lt, lp] = left.split(':'), [rt, rp] = right.split(':');
    const A = sim.devices.find(d => d.type === lt || d.id === lt);
    const B = sim.devices.find(d => d.type === rt || d.id === rt);
    if (A) {
      document.querySelector(`[data-device="${A.id}"]`)?.classList.add('focused');
      highlightPort(A.id, lp);
    }
    if (B) {
      document.querySelector(`[data-device="${B.id}"]`)?.classList.add('focused');
      highlightPort(B.id, rp);
    }
  }
}

function bindLabActions() {
  $('[data-action="leave"]').onclick = homeHandler;
  $$('[data-mode]').forEach(b => {
    b.onclick = () => {
      if (b.dataset.mode === 'practice' && !state.completed.includes(lab.id) && lab.id !== 'sandbox') {
        return toast('Complete Guided mode once before unlocking Practice.');
      }
      mode = b.dataset.mode;
      stepIndex = 0;
      sim.reset();
      actions.length = 0;
      selectedDevice = null;
      terminalOpen = false;
      activeCable = null;
      cableStart = null;
      panels = null;
      setupDevices();
      renderLab();
      if (lab.id !== 'sandbox') showOrientation();
    };
  });
  $('[data-action="resetLab"]').onclick = () => {
    sim.reset();
    actions.length = 0;
    stepIndex = 0;
    selectedDevice = null;
    terminalOpen = false;
    activeCable = null;
    cableStart = null;
    setupDevices();
    panels = null;
    renderLab();
    toast('Topology reset.');
  };
  $('[data-action="helpLab"]').onclick = showOrientation;
  $$('[data-cable]').forEach(b => b.onclick = () => chooseCable(b.dataset.cable));
  $$('[data-action="terminal"]').forEach(b => b.onclick = () => toggleTerminal());
  $$('[data-action="openTeardownDirect"]').forEach(b => b.onclick = () => {
    const dev = selectedDevice ? sim.getDevice(selectedDevice) : sim.devices[0];
    if (dev) ensurePanels().openTeardownModal(dev);
  });
}
