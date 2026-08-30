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

function defaultPos(type, i, n) {
  const map = {
    pc: { x: 50, y: 340 },
    switch: { x: 230, y: 220 },
    router: { x: 230, y: 370 },
    firewall: { x: 420, y: 340 },
    server: { x: 420, y: 200 },
    accesspoint: { x: 460, y: 140 },
    patchpanel: { x: 460, y: 140 }
  };
  let p = { ...(map[type] || { x: 80 + i * 130, y: 280 }) };
  if (n > 1) {
    p.x += 100 * (n - 1);
    p.y += 40 * (n - 1);
  }
  return p;
}

function setupDevices() {
  const used = {};
  lab.devices.forEach((type, i) => {
    used[type] = (used[type] || 0) + 1;
    const p = defaultPos(type, i, used[type]);
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
    inspect: 'Click the highlighted device to inspect its architecture',
    inspectPort: 'Click the glowing port interface to inspect PHY state',
    cableTool: 'Click Cat6 RJ45 on the cable pegboard',
    connect: 'Connect the two highlighted ports with the cable',
    terminal: 'Open Terminal and execute the suggested command',
    configIp: 'Open device Inspector → Network tab → configure IPv4 settings',
    ping: 'Open Terminal and execute ping to test connectivity'
  };
  return map[s.kind] || s.title;
}

function renderLab() {
  const guided = mode === 'guided';
  const addShelf = lab.id === 'sandbox'
    ? `<span class="shelf-title">Add Hardware</span>${['pc', 'switch', 'router', 'firewall', 'server'].map(t => `<button class="shelf-item" data-add-device="${t}"><span>${DEVICE_CATALOG[t].icon}</span><span>${DEVICE_CATALOG[t].short}</span></button>`).join('')}<span class="shelf-divider"></span>`
    : '';

  main().className = 'lab-shell';
  main().innerHTML = `
  <div class="lab-header">
    <button class="back-btn" data-action="leave" aria-label="Back to learning modules">←</button>
    <div class="lab-title-block">
      <span class="lab-number">${lab.id === 'sandbox' ? 'PLAYGROUND' : `LAB ${String(LABS.findIndex(x => x.id === lab.id) + 1).padStart(2, '0')}`}</span>
      <div>
        <h2>${lab.title}</h2>
        <p>${lab.subtitle}</p>
      </div>
    </div>
    <div class="mode-switch">
      <button data-mode="guided" class="${guided ? 'active' : ''}">Guided Mode</button>
      <button data-mode="practice" class="${mode === 'practice' ? 'active' : ''}">Practice Mode</button>
    </div>
    <div class="lab-actions">
      <button data-action="resetLab">↻ Reset Topology</button>
      <button data-action="helpLab">? Lab Guide</button>
    </div>
  </div>
  <div class="lab-layout">
    <aside class="coach-panel" id="coachPanel"></aside>
    <section class="lab-stage-wrap" id="labStageWrap">
      <div class="now-banner" id="nowBanner">
        <span class="now-pulse"></span>
        <div>
          <small>DO THIS NOW</small>
          <b>${guided ? stepActionText() : 'Solve the mission independently without step-by-step guidance'}</b>
        </div>
        <button data-action="showTarget">Show me target</button>
      </div>
      <div class="room-wall"></div>
      <div class="desk-plane"></div>
      <div class="pegboard">
        <div class="peg-title">PATCH LEADS</div>
        <div class="peg-tools">
          <button class="cable-reel" data-cable="rj45"><span class="coil"></span><span>Cat6 RJ45</span></button>
          <button class="cable-reel console" data-cable="console"><span class="coil"></span><span>Console</span></button>
        </div>
      </div>
      <div class="rack">
        <div class="rack-label">42U RACK</div>
        ${Array.from({ length: 6 }, () => `<div class="rack-slot">${'<i></i>'.repeat(9)}</div>`).join('')}
      </div>
      <svg class="cable-svg" id="cableSvg"></svg>
      <div class="stage" id="stage"></div>
      <div class="connection-status" id="connectionStatus"></div>
      <div class="stage-hint" id="stageHint"></div>
      <div class="device-shelf">
        ${addShelf}
        <span class="shelf-title">Tools</span>
        <button class="shelf-item" data-cable="rj45"><span>🔌</span><span>Cat6 RJ45</span></button>
        <button class="shelf-item" data-action="terminal"><span>⌨</span><span>Terminal</span></button>
      </div>
      <button class="terminal-fab" data-action="terminal">⌨ Terminal CLI</button>
      <div class="terminal-drawer" id="terminalDrawer"></div>
      <div id="inspectorRoot"></div>
    </section>
  </div>`;

  renderCoach();
  renderStage();
  renderTerminal();
  bindLabActions();
  updateNowBanner();
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
    <div class="coach-title">
      <div class="coach-bot">🧪</div>
      <div>
        <h3>${lab.id === 'sandbox' ? 'Open Network Playground' : 'Independent Practice Mode'}</h3>
        <p>${lab.id === 'sandbox' ? 'Build and test enterprise topologies freely.' : 'No highlighted hints. Demonstrate mastery alone.'}</p>
      </div>
    </div>
    <div class="coach-step emphasis">
      <span class="step-label">MISSION BRIEF</span>
      <h4>${lab.outcome}</h4>
      <p>${lab.id === 'sandbox' ? 'Add devices, plug in cables, assign IPs, configure VLANs, and run CLI commands.' : 'Follow standard engineering workflow: Inspect → Cable L1 → Configure L3 → Verify with Ping & CLI.'}</p>
      ${lab.id !== 'sandbox' ? '<button class="btn yellow coach-next" data-action="verifyPractice">Verify My Topology →</button>' : ''}
    </div>
    <div class="coach-footer">
      <b>Stuck?</b> Switch back to Guided mode to review step-by-step diagnostics.
    </div>`;
    p.querySelector('[data-action="verifyPractice"]')?.addEventListener('click', verifyPractice);
    return;
  }

  p.innerHTML = `
  <div class="coach-title">
    <div class="coach-bot">🌱</div>
    <div>
      <h3>Byte</h3>
      <p>Enterprise Network Lab Partner</p>
    </div>
  </div>
  <div class="lesson-progress">
    ${steps.map((_, i) => `<i class="${i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}"></i>`).join('')}
  </div>
  <div class="coach-step emphasis">
    <span class="step-label">STEP ${stepIndex + 1} OF ${steps.length}</span>
    <h4>${s.title}</h4>
    <p>${s.body}</p>
    <div class="do-card">
      <small>ACTION REQUIRED</small>
      <b>${stepActionText(s)}</b>
    </div>
    <div class="coach-tip">
      <b>Networking Rationale</b>
      <span>${s.tip}</span>
    </div>
    <div class="coach-buttons">
      <button class="btn soft" data-action="showTarget">Show Target</button>
      <button class="btn primary coach-next" data-action="checkStep">Verify Step →</button>
    </div>
  </div>
  <div class="objectives">
    <h4>Lab Progress</h4>
    ${steps.map((x, i) => `
      <div class="objective ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}">
        <span class="obj-dot">${i < stepIndex ? '✓' : i === stepIndex ? '→' : '○'}</span>
        <span>${x.title}</span>
      </div>`).join('')}
  </div>
  <div class="coach-footer">
    Learn how real packets travel from application layer to physical copper. Click 'Show Target' anytime you need guidance.
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
    <div class="device-body">
      <div class="server-bay-grid">
        ${Array.from({ length: 6 }, () => `<div class="sas-caddy"><span></span></div>`).join('')}
      </div>
      <div class="port-strip endpoint-strip">
        ${ports.map(p => `<span class="port ${sim.linkFor(d.id, p.id) ? 'connected' : ''}" data-port="${p.id}"><em>${p.label}</em></span>`).join('')}
      </div>
    </div>`;
  } else if (d.type === 'switch') {
    body = `
    <div class="device-body">
      <div class="rack-ear-left"><span class="rack-screw"></span><span class="rack-screw"></span></div>
      <div class="rack-ear-right"><span class="rack-screw"></span><span class="rack-screw"></span></div>
      <div class="switch-header">
        <span>24-PORT GIGABIT MANAGED SWITCH</span>
        <div class="switch-sys-leds"><span class="sys-led"></span><span class="sys-led" style="background:#f2c94c"></span></div>
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
        <span class="dev-brand">${cat.name.toUpperCase()}</span>
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
    <div class="device-label">${d.name}<small>${cat.category}</small></div>
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
  $$('.lab-device').forEach(el => {
    el.onpointerdown = e => {
      if (e.target.closest('.port')) return;
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
      const maxW = stageWrap ? stageWrap.clientWidth - 190 : 800;
      const maxH = stageWrap ? stageWrap.clientHeight - 130 : 600;
      const nx = Math.max(10, Math.min(maxW, dragging.origX + e.clientX - dragging.startX));
      const ny = Math.max(70, Math.min(maxH, dragging.origY + e.clientY - dragging.startY));
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
  if (dev) stageHint(`${dev.name} (${DEVICE_CATALOG[dev.type].name}) selected.`);
}

function handlePort(dev, port) {
  selectDevice(dev);
  inspectorTab = 'ports';
  renderInspector();
  record('inspectPort', `${dev}:${port}`);

  if (!activeCable) {
    stageHint(`${sim.getDevice(dev)?.name} [${port}] selected. To cable it, select Cat6 RJ45 from tools.`);
    updateConnectionStatus();
    return;
  }
  if (!cableStart) {
    cableStart = { dev, port };
    updateConnectionStatus();
    stageHint(`First RJ45 connector plugged into ${sim.getDevice(dev)?.name} [${port}]. Now click destination port.`);
    highlightCurrentTarget();
    return;
  }
  if (cableStart.dev === dev && cableStart.port === port) {
    cableStart = null;
    updateConnectionStatus();
    stageHint('Cable start canceled.');
    return;
  }

  const r = sim.connect(cableStart.dev, cableStart.port, dev, port, activeCable);
  if (r.ok) {
    toast('Cat6 RJ45 Connected. Link auto-negotiation complete (1000BASE-T Full Duplex).');
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
  activeCable = type;
  cableStart = null;
  $$('[data-cable]').forEach(x => x.classList.toggle('active', x.dataset.cable === type));
  record('cableTool', type);
  updateConnectionStatus();
  stageHint(`${type === 'rj45' ? 'Cat6 RJ45 Patch Cable' : 'Serial Console Cable'} armed. Click the FIRST port interface.`);
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
  const label = activeCable === 'rj45' ? 'Cat6 Gigabit RJ45' : 'RS-232 Console Rollover';
  el.className = 'connection-status show';
  el.innerHTML = cableStart
    ? `<span>🔌</span><div><small>${label} · END 1 CONNECTED</small><b>${sim.getDevice(cableStart.dev)?.name} [${cableStart.port}]</b><em>Click second destination port</em></div><button data-cancel-cable>Cancel</button>`
    : `<span>🔌</span><div><small>${label} SELECTED</small><b>Click first interface port</b><em>Port tooltips show negotiated speed</em></div><button data-cancel-cable>Cancel</button>`;
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
  h._t = setTimeout(() => h.classList.remove('show'), 4500);
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
    p.setAttribute('d', `M ${a.x} ${a.y} C ${mx} ${a.y + 45}, ${mx} ${b.y + 45}, ${b.x} ${b.y}`);
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

  // Animate hop-by-hop
  let currentHop = 0;
  function animateHop() {
    if (currentHop >= path.length - 1) return;
    const aDev = path[currentHop], bDev = path[currentHop + 1];
    const link = sim.links.find(l => (l.a.startsWith(aDev + ':') && l.b.startsWith(bDev + ':')) || (l.b.startsWith(aDev + ':') && l.a.startsWith(bDev + ':')));
    if (!link) { currentHop++; animateHop(); return; }

    const svgPath = svg.querySelector(`[data-link="${link.id}"]`);
    if (!svgPath) { currentHop++; animateHop(); return; }

    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', '7');
    c.setAttribute('class', 'packet-dot');
    c.title = 'Click to inspect Frame Decode in Wireshark viewer';
    c.onclick = () => {
      inspectorTab = 'packets';
      panels?.setCapturedPacket(info);
      renderInspector();
    };
    svg.appendChild(c);

    let start;
    function tick(t) {
      start ??= t;
      const u = Math.min(1, (t - start) / 750);
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
    toast('Select an active device first. Terminal console connects to selected hardware.');
    terminalOpen = false;
  }
  renderTerminal();
  if (terminalOpen && selectedDevice) record('terminal', sim.getDevice(selectedDevice).type);
}

function runCommand(cmd) {
  if (!selectedDevice) return toast('Select a device interface to run terminal commands.');
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

// Validation engine across all 13 Labs
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
    const expected = s.target === 'pc' ? '192.168.10.10' : s.target === 'server' ? '192.168.10.20' : '192.168.10.1';
    return byType(s.target).some(d => {
      const c = sim.getIp(d.id);
      return c.ip.startsWith('192.168.') || c.ip.startsWith('10.') || c.ip.startsWith('203.');
    });
  }
  if (s.kind === 'ping') return has('ping', s.target) || actions.some(a => a.kind === 'ping');
  return false;
}

function missingMessage(s = currentStep()) {
  if (!s) return 'All actions verified.';
  const map = {
    inspect: 'Click the highlighted device to inspect its hardware details.',
    inspectPort: 'Click on the glowing physical port row in the Inspector.',
    cableTool: 'Select Cat6 RJ45 from the patch leads pegboard.',
    connect: 'Plug the Cat6 cable into the two requested interface ports.',
    terminal: 'Open the Terminal and execute the requested diagnostic command.',
    configIp: 'Open Inspector → Network tab and save the valid IPv4 address.',
    ping: 'Run ping in the Terminal and verify ICMP replies on the wire.'
  };
  return map[s.kind] || 'Complete the highlighted objective first.';
}

function checkStep() {
  const s = currentStep();
  if (!s) return;
  if (!stepIsDone(s)) {
    stageHint(missingMessage(s));
    showTarget();
    return toast('Action pending. Byte has highlighted the required target.');
  }
  stepIndex++;
  if (stepIndex >= lab.steps.length) {
    completeLab(lab.id, actions);
    return achievement();
  }
  renderCoach();
  updateNowBanner();
  highlightCurrentTarget();
  toast('Step verified! Next objective unlocked.');
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
    ok = links.length >= 1 && actions.length >= 3;
  }

  if (!ok) {
    stageHint('Practice objectives not fully met yet. Check cables, IPv4 addresses, and run test commands.');
    return toast('Topology verification pending.');
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
      <span class="kicker"><i class="kicker-dot"></i> ${mastery ? 'INDEPENDENT MASTERY' : 'GUIDED LAB COMPLETE'}</span>
      <h2>${lab.title}</h2>
      <p>${mastery ? 'You successfully demonstrated complete independent mastery of this networking module.' : 'Outstanding work! Complete in Practice mode to earn full Mastery rank.'}</p>
      <div class="reward-row">
        <div class="reward"><b>+${mastery ? 250 : 150}</b><small>XP Gained</small></div>
        <div class="reward"><b>${state.completed.length}</b><small>Labs Complete</small></div>
        <div class="reward"><b>${rank()[1]}</b><small>Current Rank</small></div>
      </div>
      <div class="modal-actions">
        <button class="btn secondary" data-home>Return to Learning Path</button>
        ${mastery ? '' : '<button class="btn primary" data-practice>Try Practice Mode →</button>'}
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
  const first = currentStep();
  root.innerHTML = `
  <div class="modal-backdrop">
    <div class="modal-card orientation-v2">
      <div class="orientation-art">${lab.icon}</div>
      <span class="kicker"><i class="kicker-dot"></i> ${mode === 'guided' ? 'ENTERPRISE GUIDED LAB' : 'PRACTICE SIMULATION'}</span>
      <h2>${lab.title}</h2>
      <p>${lab.subtitle}</p>
      <div class="mission-brief">
        <small>MISSION OUTCOME</small>
        <b>${lab.outcome}</b>
      </div>
      <div class="orientation-list">
        <div class="orientation-item"><span>1</span><span><b>Follow the green pulsing target.</b> Identifies exact physical ports, cables, and CLI tools.</span></div>
        <div class="orientation-item"><span>2</span><span><b>Inspect live packet flows.</b> Click animated packets on cables to decode real Ethernet/IP/ICMP headers.</span></div>
        <div class="orientation-item"><span>3</span><span><b>Hands-on engineering.</b> Real Cisco-style CLI commands and real-world networking mechanics.</span></div>
      </div>
      <div class="first-action">
        <small>INITIAL ACTION</small>
        <b>${first ? stepActionText(first) : 'Explore the enterprise lab'}</b>
      </div>
      <button class="btn primary" data-start style="width:100%">Initialize Lab Environment →</button>
    </div>
  </div>`;
  root.querySelector('[data-start]').onclick = () => {
    markOrientation(lab.id);
    root.innerHTML = '';
    showTarget();
  };
}

function updateNowBanner() {
  const b = $('#nowBanner');
  if (!b) return;
  const strong = b.querySelector('b');
  if (strong) strong.textContent = mode === 'guided' ? stepActionText() : 'Solve the objective without step-by-step guidance';
}

function showTarget() {
  highlightCurrentTarget();
  const s = currentStep();
  if (!s) return;
  stageHint(stepActionText(s));
  const focused = document.querySelector('.focused, .port.target, .cable-reel.active');
  focused?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });
  focused?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 600, iterations: 2 });
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
        return toast('Complete Guided mode once before unlocking Independent Practice.');
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
    toast('Topology reset. Restarting from Step 1.');
  };
  $('[data-action="helpLab"]').onclick = showOrientation;
  $$('[data-action="showTarget"]').forEach(b => b.onclick = showTarget);
  $$('[data-cable]').forEach(b => b.onclick = () => chooseCable(b.dataset.cable));
  $$('[data-action="terminal"]').forEach(b => b.onclick = () => toggleTerminal());
  $$('[data-add-device]').forEach(b => b.onclick = () => {
    const t = b.dataset.addDevice;
    sim.addDevice(t, 180 + Math.random() * 320, 200 + Math.random() * 180);
    renderStage();
    toast(`${DEVICE_CATALOG[t].name} deployed to workbench.`);
  });
}
