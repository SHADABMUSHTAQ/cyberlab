import {DEVICE_CATALOG, LABS, PHASES} from './data.js';
import {state, rank, level, currentLabIndex, isUnlocked, phaseProgress, setActiveNav, updateTopStats} from './state.js';
import {isSignedIn, cloud} from './cloud.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const main = () => $('#mainView');

let startLabHandler = () => {};
export function setStartLabHandler(fn) { startLabHandler = fn; }

function moduleCard(l, i) {
  const isDone = state.completed.includes(l.id);
  const isMast = state.mastered.includes(l.id);
  const unlocked = isUnlocked(i);

  return `
  <article class="module-card ${unlocked ? '' : 'locked'}" data-lab="${l.id}">
    <div class="module-top">
      <span class="difficulty">${l.difficulty}</span>
      <span class="duration">◷ ${l.duration}</span>
    </div>
    <div style="font-size:32px;margin:8px 0 12px">${l.icon}</div>
    <h3>${String(i + 1).padStart(2, '0')}. ${l.title}</h3>
    <p>${l.subtitle}</p>
    <div class="module-outcome"><b>Outcome:</b> ${l.outcome}</div>
    <div class="module-cta">
      <span>${isMast ? '★ Mastered' : isDone ? '✓ Completed' : unlocked ? 'Launch Lab' : '🔒 Locked'}</span>
      <span>${unlocked ? '→' : ''}</span>
    </div>
  </article>`;
}

function bind() {
  $$('[data-action="signin"]').forEach(b => b.onclick = () => document.querySelector('[data-action="profile"]')?.click());
  $$('[data-action="continue"]').forEach(b => b.onclick = () => startLabHandler(state.currentLab));
  $$('[data-action="sandbox"]').forEach(b => b.onclick = () => startLabHandler('sandbox'));
  $$('[data-action="learn"]').forEach(b => b.onclick = renderLearn);
  $$('[data-lab]').forEach(card => card.onclick = () => {
    const i = LABS.findIndex(l => l.id === card.dataset.lab);
    if (!isUnlocked(i)) return window.cyberToast?.('Complete preceding labs to unlock this module.');
    startLabHandler(card.dataset.lab);
  });
}

export function renderHome() {
  setActiveNav('home');
  const m = main();
  m.className = 'page-shell';
  const idx = currentLabIndex();
  const next = LABS[idx] || LABS[0];
  const pathDone = state.completed.length;

  m.innerHTML = `
  <section class="home-grid">
    <div class="welcome-card">
      <div>
        <span class="kicker"><i class="kicker-dot"></i> Hands-On Network Engineering</span>
        <h1>Build, cable & route networks <span>with your own hands.</span></h1>
        <p>Inspect enterprise hardware, connect physical copper patch leads, configure subnets, and inspect live packet flows with zero fluff.</p>
      </div>
      <div class="hero-actions">
        <button class="btn primary" data-action="continue">Continue Learning Track →</button>
        <button class="btn secondary" data-action="sandbox">🧪 Open Free Playground</button>
      </div>
    </div>
    
    <aside class="today-card">
      <div class="today-head">
        <h3>Current Objective</h3>
        <span>+150 XP</span>
      </div>
      <div class="mission-icon">${next.icon}</div>
      <h4>${next.title}</h4>
      <p>${next.outcome}</p>
      <div class="progress-line"><i style="width:${Math.min(100, (pathDone / (LABS.length - 1)) * 100)}%"></i></div>
      <div class="micro-copy">
        <span>Progress</span>
        <span>${pathDone}/${LABS.length - 1} Complete</span>
      </div>
      <button class="btn yellow" style="margin-top:auto" data-action="continue">Launch Next Lab →</button>
    </aside>
  </section>

  ${isSignedIn() ? '' : `
  <div class="cloud-callout">
    <div>
      <b>Guest Mode Active</b> · Sign in to save permanent certificates and maintain streaks.
    </div>
    <button class="btn soft" data-action="signin">Sign In</button>
  </div>`}

  <section class="metric-row">
    <div class="metric"><span class="metric-icon">🔥</span><div><strong>${state.streak}</strong><small>Day Streak</small></div></div>
    <div class="metric"><span class="metric-icon">✦</span><div><strong>${state.xp}</strong><small>Experience Points</small></div></div>
    <div class="metric"><span class="metric-icon">★</span><div><strong>${state.mastered.length}</strong><small>Mastered Labs</small></div></div>
    <div class="metric"><span class="metric-icon">⌁</span><div><strong>${rank()[1]}</strong><small>Current Rank</small></div></div>
  </section>

  <div class="section-head">
    <div>
      <h2>Curriculum Pathway</h2>
      <p>Six structured engineering phases.</p>
    </div>
    <button class="link-btn" data-action="learn">View All 13 Modules →</button>
  </div>

  <section class="journey">
    ${PHASES.map((p, i) => {
      const [d, t] = phaseProgress(p.id);
      return `
      <article class="phase-card">
        <span class="phase-num">PHASE ${String(p.id).padStart(2, '0')}</span>
        <h3>${p.title}</h3>
        <p>${p.desc}</p>
        <div class="phase-foot">
          <span>${p.range}</span>
          <span>${d}/${t}</span>
        </div>
      </article>`;
    }).join('')}
  </section>

  <div class="section-head">
    <div>
      <h2>Featured Foundations</h2>
      <p>Start with physical hardware and cabling.</p>
    </div>
  </div>
  <section class="library-grid">
    ${LABS.slice(0, 3).map((l, i) => moduleCard(l, i)).join('')}
  </section>`;

  bind();
  updateTopStats();
}

export function renderLearn() {
  setActiveNav('learn');
  const m = main();
  m.className = 'page-shell';
  m.innerHTML = `
  <div class="section-head" style="margin-top:0">
    <div>
      <span class="kicker"><i class="kicker-dot"></i> Complete Learning Pathway</span>
      <h2>13 Enterprise Hands-On Labs</h2>
      <p>Master networking from Layer 1 physical copper to Layer 7 applications.</p>
    </div>
    <button class="btn secondary" data-action="sandbox">🧪 Open Playground</button>
  </div>
  <section class="library-grid">
    ${LABS.slice(0, -1).map((l, i) => moduleCard(l, i)).join('')}
  </section>`;
  bind();
}

export function renderAchievements() {
  setActiveNav('achievements');
  const m = main();
  const cert = cloud.certificates?.[0];
  const badges = [
    ['🔌', 'First Link (L1)', 'Connect your first Cat6 RJ45 patch cable.', state.completed.includes('cabling-1')],
    ['🌐', 'LAN Architect (L3)', 'Assign IPv4 addresses and ping local host.', state.completed.includes('ipv4-1')],
    ['▤', 'Switch Operator (L2)', 'Inspect dynamic CAM MAC address learning.', state.completed.includes('switching-1')],
    ['◫', 'VLAN Segmenter', 'Partition switch into 802.1Q broadcast domains.', state.completed.includes('vlan-1')],
    ['◈', 'Gateway Pilot', 'Configure routed interfaces across IP subnets.', state.completed.includes('routing-1')],
    ['⇄', 'DORA Specialist', 'Automate endpoint addressing with DHCP.', state.completed.includes('dhcp-1')],
    ['Aa', 'DNS Resolver', 'Resolve FQDN hostnames via DNS A-records.', state.completed.includes('dns-1')],
    ['⬢', 'Security Guard', 'Enforce stateful firewall boundaries.', state.completed.includes('firewall-1')],
    ['↔', 'NAT Engineer', 'Translate private subnets to public edge IPs.', state.completed.includes('nat-1')],
    ['△', 'STP Loop Defender', 'Block redundant switching loops with STP.', state.completed.includes('stp-1')],
    ['◎', 'OSPF Navigator', 'Form dynamic OSPF neighbor adjacencies.', state.completed.includes('ospf-1')],
    ['🧰', 'Incident Troubleshooter', 'Diagnose multi-layer enterprise outage.', state.completed.includes('troubleshoot-1')],
    ['★', 'Master Engineer', 'Demonstrate independent mastery across labs.', state.mastered.length >= 3]
  ];

  m.className = 'page-shell';
  m.innerHTML = `
  <div class="section-head" style="margin-top:0">
    <div>
      <h2>Engineering Badges & Credentials</h2>
      <p>Verified hands-on accomplishments demonstrated in the simulator.</p>
    </div>
  </div>
  ${isSignedIn() ? `
  <div class="cloud-callout">
    <div>
      <b>${cert ? 'Certificate Issued' : 'Account-Backed Progress'}</b> · ${cert ? `Code: ${cert.certificate_code}` : 'Complete all phases to earn the Certified Network Associate credential.'}
    </div>
  </div>` : `
  <div class="cloud-callout">
    <div><b>Guest Mode</b> · Sign in to link achievements to your permanent engineering portfolio.</div>
    <button class="btn soft" data-action="signin">Sign In</button>
  </div>`}
  <section class="library-grid">
    ${badges.map(b => `
      <article class="module-card ${b[3] ? '' : 'locked'}">
        <div style="font-size:36px;margin-bottom:8px">${b[0]}</div>
        <h3>${b[1]}</h3>
        <p>${b[2]}</p>
        <div class="module-outcome"><b>Status:</b> ${b[3] ? '✓ Unlocked' : '🔒 Locked'}</div>
      </article>`).join('')}
  </section>`;
  bind();
}
