import {DEVICE_CATALOG, LABS, PHASES} from './data.js';
import {state, rank, level, currentLabIndex, isUnlocked, phaseProgress, setActiveNav, updateTopStats} from './state.js';
import {isSignedIn, cloud} from './cloud.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const main = () => $('#mainView');

let startLabHandler = () => {};
export function setStartLabHandler(fn) { startLabHandler = fn; }

function deviceMiniSvg(type) {
  const g = '#1d2723', k = '#0a100d', led = '#28c776', y = '#f2c94c';
  if (type === 'pc') {
    return `<svg viewBox="0 0 180 100"><rect x="36" y="14" width="95" height="59" rx="7" fill="${g}"/><rect x="43" y="21" width="81" height="45" rx="3" fill="#0d1814"/><rect x="77" y="73" width="16" height="9" fill="${g}"/><rect x="61" y="82" width="50" height="6" rx="3" fill="#3a4f47"/><circle cx="50" cy="30" r="2" fill="${led}"/></svg>`;
  }
  if (type === 'router') {
    return `<svg viewBox="0 0 190 100"><rect x="18" y="28" width="154" height="45" rx="5" fill="${g}"/><circle cx="34" cy="50" r="3.5" fill="${led}"/><circle cx="44" cy="50" r="3.5" fill="${y}"/><rect x="88" y="42" width="18" height="17" rx="2" fill="${k}"/><rect x="112" y="42" width="18" height="17" rx="2" fill="${k}"/><text x="34" y="40" font-size="7" font-weight="900" fill="#b9cbcd">EDGE ROUTER</text></svg>`;
  }
  if (type === 'firewall') {
    return `<svg viewBox="0 0 190 100"><rect x="18" y="28" width="154" height="45" rx="5" fill="#382222"/><circle cx="34" cy="50" r="3.5" fill="#ff5c5c"/><text x="34" y="40" font-size="7" font-weight="900" fill="#ffd4d4">NEXT-GEN FIREWALL</text><rect x="90" y="42" width="18" height="17" rx="2" fill="${k}"/><rect x="114" y="42" width="18" height="17" rx="2" fill="${k}"/><rect x="138" y="42" width="18" height="17" rx="2" fill="${k}"/></svg>`;
  }
  if (type === 'server') {
    return `<svg viewBox="0 0 190 100"><rect x="42" y="10" width="106" height="78" rx="6" fill="${g}"/>${[22, 40, 58].map(t => `<rect x="52" y="${t}" width="86" height="12" rx="2" fill="${k}"/><circle cx="60" cy="${t + 6}" r="2" fill="${led}"/><circle cx="68" cy="${t + 6}" r="2" fill="${y}"/>`).join('')}</svg>`;
  }
  return `<svg viewBox="0 0 190 100"><rect x="16" y="26" width="158" height="48" rx="5" fill="${g}"/><text x="28" y="40" font-size="7" font-weight="900" fill="#d9e8e1">24-PORT GIGABIT SWITCH</text>${Array.from({ length: 8 }, (_, i) => `<rect x="${28 + i * 16}" y="48" width="11" height="11" rx="1.5" fill="${k}" stroke="#486055"/><circle cx="${31 + i * 16}" cy="45" r="1.5" fill="${i < 2 ? led : '#485850'}"/>`).join('')}</svg>`;
}

function moduleCard(l, i) {
  return `
  <article class="module-card ${isUnlocked(i) ? '' : 'locked'}" data-lab="${l.id}">
    <div class="module-icon">${deviceMiniSvg(l.devices.includes('switch') ? 'switch' : l.devices[0])}</div>
    <div class="module-top">
      <span class="difficulty">${l.difficulty}</span>
      <span class="duration">◷ ${l.duration}</span>
    </div>
    <h3>${String(i + 1).padStart(2, '0')} · ${l.title}</h3>
    <p>${l.subtitle}</p>
    <div class="module-outcome"><b>Outcome:</b> ${l.outcome}</div>
    <div class="module-cta">
      <b>${state.mastered.includes(l.id) ? '★ Mastered' : state.completed.includes(l.id) ? '✓ Completed' : 'Start Module'}</b>
      <span class="start-dot">→</span>
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
    if (!isUnlocked(i)) return window.cyberToast?.('Complete preceding networking labs to unlock this module.');
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
      <span class="kicker"><i class="kicker-dot"></i> Hands-on Enterprise Networking</span>
      <h1>Master real-world networks with your <span>own hands.</span></h1>
      <p>Inspect enterprise hardware, connect physical copper patch leads, configure CIDR subnets, troubleshoot Layer 2 CAM switching, and route multi-hop packets with live Wireshark-style frame inspection.</p>
      <div class="hero-actions">
        <button class="btn primary" data-action="continue">Continue Learning Track →</button>
        <button class="btn secondary" data-action="sandbox">🧪 Open Enterprise Playground</button>
      </div>
      <div class="hero-lab-visual" aria-hidden="true">
        <div class="hero-desk"></div>
        <div class="hero-screen"></div>
        <div class="hero-switch"><div class="hero-port-row">${'<i></i>'.repeat(7)}</div></div>
        <div class="hero-router"><div class="hero-port-row">${'<i></i>'.repeat(5)}</div></div>
        <div class="hero-cable"></div>
      </div>
    </div>
    <aside class="today-card">
      <div class="today-head">
        <h3>Current Mission</h3>
        <span>+150 XP</span>
      </div>
      <div class="mission-icon">${next.icon}</div>
      <h4>${next.title}</h4>
      <p>${next.outcome}</p>
      <div class="progress-line"><i style="width:${Math.min(100, (pathDone / (LABS.length - 1)) * 100)}%"></i></div>
      <div class="micro-copy">
        <span>Curriculum Progress</span>
        <span>${pathDone}/${LABS.length - 1} Labs Complete</span>
      </div>
      <button class="btn yellow" style="margin-top:auto" data-action="continue">Launch Lab →</button>
    </aside>
  </section>

  ${isSignedIn() ? '' : `
  <div class="cloud-callout">
    <div>
      <b>Enterprise Account & Cloud Synchronization</b><br>
      <span>Guest mode is fully free. Sign in anytime to sync your progress, maintain learning streaks, and receive verifiable network mastery certificates.</span>
    </div>
    <button class="btn soft" data-action="signin">Sign In / Register</button>
  </div>`}

  <section class="metric-row">
    <div class="metric"><span class="metric-icon">🔥</span><div><strong>${state.streak}</strong><small>Day Streak</small></div></div>
    <div class="metric"><span class="metric-icon">✦</span><div><strong>${state.xp}</strong><small>Experience Points</small></div></div>
    <div class="metric"><span class="metric-icon">★</span><div><strong>${state.mastered.length}</strong><small>Mastered Labs</small></div></div>
    <div class="metric"><span class="metric-icon">⌁</span><div><strong>${rank()[1]}</strong><small>Current Rank</small></div></div>
  </section>

  <div class="section-head">
    <div>
      <h2>Enterprise Networking Curriculum</h2>
      <p>Six comprehensive phases from physical Layer 1 cable continuity to dynamic Layer 3 link-state routing.</p>
    </div>
    <button class="link-btn" data-action="learn">View All 13 Labs →</button>
  </div>

  <section class="journey">
    ${PHASES.map((p, i) => {
      const [d, t] = phaseProgress(p.id);
      const locked = i > 0 && phaseProgress(PHASES[i - 1].id)[0] === 0 && !isUnlocked(i * 2);
      return `
      <article class="phase-card ${i === 0 ? 'current' : ''} ${locked ? 'locked' : ''}">
        <span class="phase-num">${String(p.id).padStart(2, '0')}</span>
        <h3>${p.title}</h3>
        <p>${p.desc}</p>
        <div class="phase-foot">
          <span>${p.range}</span>
          <span>${d}/${t} Complete</span>
        </div>
      </article>`;
    }).join('')}
  </section>

  <div class="section-head">
    <div>
      <h2>Featured Physical Foundations</h2>
      <p>Master real-world hardware, cabling, and basic IPv4 networking.</p>
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
      <span class="kicker"><i class="kicker-dot"></i> Complete Learning Track</span>
      <h2 style="margin-top:14px">Enterprise Networking: Cable to Application</h2>
      <p>Each module follows: Inspect Physical Hardware → Cable L1 → Configure L3 Stack → Test Protocol Flows → Independent Mastery.</p>
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
    ['🔌', 'First Link (L1)', 'Connect your first Cat6 RJ45 patch cable and achieve 1000BASE-T link negotiation.', state.completed.includes('cabling-1')],
    ['🌐', 'LAN Architect (L3)', 'Assign static IPv4 addresses and verify local LAN ICMP echo connectivity.', state.completed.includes('ipv4-1')],
    ['▤', 'Switch Operator (L2)', 'Observe dynamic CAM MAC address learning and inspect the hardware table.', state.completed.includes('switching-1')],
    ['◫', 'VLAN Segmenter', 'Partition a switch into isolated 802.1Q broadcast domains.', state.completed.includes('vlan-1')],
    ['◈', 'Gateway Pilot', 'Configure routed interfaces and forward packets across distinct IP subnets.', state.completed.includes('routing-1')],
    ['⇄', 'DORA Specialist', 'Automate endpoint addressing with dynamic DHCP address pools.', state.completed.includes('dhcp-1')],
    ['Aa', 'DNS Resolver', 'Resolve FQDN hostnames to routable IP addresses via DNS A-records.', state.completed.includes('dns-1')],
    ['⬢', 'Security Guard', 'Enforce stateful firewall boundaries between Inside, Outside, and DMZ.', state.completed.includes('firewall-1')],
    ['↔', 'NAT Engineer', 'Translate RFC 1918 private subnets to public edge addresses with PAT.', state.completed.includes('nat-1')],
    ['△', 'STP Loop Defender', 'Build redundant switch links and observe STP block loops without broadcast storms.', state.completed.includes('stp-1')],
    ['◎', 'OSPF Navigator', 'Establish dynamic link-state neighbor adjacencies in OSPF Area 0.', state.completed.includes('ospf-1')],
    ['🧰', 'Incident Troubleshooter', 'Diagnose and resolve a complex multi-layer enterprise production outage.', state.completed.includes('troubleshoot-1')],
    ['★', 'Master Engineer', 'Demonstrate independent mastery across labs in Practice mode.', state.mastered.length >= 3]
  ];

  m.className = 'page-shell';
  m.innerHTML = `
  <div class="section-head" style="margin-top:0">
    <div>
      <h2>Engineering Achievements & Verified Badges</h2>
      <p>Badges represent verified hands-on skills demonstrated in the simulator.</p>
    </div>
  </div>
  ${isSignedIn() ? `
  <div class="cloud-callout">
    <div>
      <b>${cert ? 'Verifiable Certificate Issued' : 'Account-Backed Progress Active'}</b><br>
      <span>${cert ? `Certificate Code: ${cert.certificate_code} · Pathway: ${cert.pathway}` : 'Complete all curriculum phases in Practice mode to earn an official CyberLab Certified Network Associate certificate.'}</span>
    </div>
  </div>` : `
  <div class="cloud-callout">
    <div>
      <b>Guest Mode Active</b><br>
      <span>Sign in to link achievements to your permanent engineering portfolio.</span>
    </div>
    <button class="btn soft" data-action="signin">Sign In</button>
  </div>`}
  <section class="library-grid">
    ${badges.map(b => `
      <article class="module-card ${b[3] ? '' : 'locked'}">
        <div class="module-icon" style="font-size:48px">${b[0]}</div>
        <h3>${b[1]}</h3>
        <p>${b[2]}</p>
        <div class="module-outcome"><b>Status:</b> ${b[3] ? '✓ Verified Unlocked' : '🔒 Locked'}</div>
      </article>`).join('')}
  </section>`;
  bind();
}
