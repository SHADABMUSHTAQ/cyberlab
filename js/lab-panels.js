export function createPanels(ctx) {
  const $ = s => document.querySelector(s);
  let capturedPacket = null;

  function renderInspector() {
    const root = $('#inspectorRoot');
    if (!root) return;
    const d = ctx.selected();
    if (!d) {
      root.innerHTML = '';
      return;
    }
    const cat = ctx.catalog[d.type];
    const cfg = ctx.sim.getIp(d.id);
    
    // Dynamic tabs based on device architecture
    const tabs = ['overview', 'ports', 'specs'];
    if (d.type === 'pc' || d.type === 'server') tabs.push('network');
    if (d.type === 'switch') tabs.push('vlans');
    if (d.type === 'router') tabs.push('routing');
    if (d.type === 'firewall') tabs.push('security');
    if (d.type === 'server') tabs.push('services');
    tabs.push('packets');

    root.innerHTML = `
    <aside class="inspector enterprise-inspector">
      <div class="inspect-head">
        <div class="inspect-brand">
          <span class="panel-eyebrow">${cat.category.toUpperCase()}</span>
          <h3>${cat.name}</h3>
          <p>${d.name} · <span class="badge-layer">${cat.layer}</span></p>
        </div>
        <button class="close-x" data-action="closeInspect" aria-label="Close inspector">✕</button>
      </div>
      <div class="inspect-tabs">
        ${tabs.map(t => `<button data-tab="${t}" class="${ctx.tab() === t ? 'active' : ''}">${tabLabel(t)}</button>`).join('')}
      </div>
      <div class="inspect-body">
        ${renderTabBody(d, cat, cfg, ctx.tab())}
      </div>
    </aside>`;

    root.querySelector('[data-action="closeInspect"]').onclick = () => ctx.closeInspect();
    root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      ctx.setTab(b.dataset.tab);
      renderInspector();
    });
    
    // Launch Photorealistic Teardown Modal
    root.querySelector('[data-action="openTeardown"]')?.addEventListener('click', () => {
      openTeardownModal(d);
    });

    // Port inspection clicks
    root.querySelectorAll('[data-inspect-port]').forEach(b => b.onclick = () => {
      ctx.record('inspectPort', `${d.id}:${b.dataset.inspectPort}`);
      const isUp = b.dataset.portState === 'up';
      ctx.toast(`${d.name} [${b.dataset.inspectPort}]: ${isUp ? '● Link UP (1000BASE-T Full Duplex)' : '○ Link DOWN (No physical cable)'}`);
      b.classList.add('seen');
    });

    // Save IPv4 settings
    root.querySelector('[data-action="saveIp"]')?.addEventListener('click', () => {
      const ip = root.querySelector('#ipField')?.value.trim() || '';
      const mask = root.querySelector('#maskField')?.value.trim() || '255.255.255.0';
      const gw = root.querySelector('#gwField')?.value.trim() || '';
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || !/^\d{1,3}(\.\d{1,3}){3}$/.test(mask)) {
        return ctx.toast('Please enter a valid IPv4 address (e.g. 192.168.10.10) and subnet mask.');
      }
      ctx.sim.setIp(d.id, ip, mask, gw);
      ctx.toast(`${d.name} IPv4 settings committed to interface.`);
      ctx.record('configIp', d.type);
      renderInspector();
    });

    // Create VLAN
    root.querySelector('[data-action="addVlan"]')?.addEventListener('click', () => {
      const vid = parseInt(root.querySelector('#vlanIdField')?.value);
      const vname = root.querySelector('#vlanNameField')?.value.trim();
      if (isNaN(vid) || vid < 1 || vid > 4094) return ctx.toast('Enter a valid VLAN ID (1–4094).');
      ctx.sim.vlans[d.id] = ctx.sim.vlans[d.id] || [];
      if (!ctx.sim.vlans[d.id].find(v => v.id === vid)) {
        ctx.sim.vlans[d.id].push({ id: vid, name: vname || `VLAN${String(vid).padStart(4, '0')}`, ports: [] });
        ctx.toast(`VLAN ${vid} created on ${d.name}.`);
        ctx.record('configVlan', vid);
        renderInspector();
      }
    });
  }

  function tabLabel(t) {
    const map = {
      overview: 'Hardware',
      ports: 'Ports & PHY',
      specs: 'Datasheet',
      network: 'IPv4 Stack',
      vlans: '802.1Q VLANs',
      routing: 'IP Routing',
      security: 'Firewall ACLs',
      services: 'DHCP & DNS',
      packets: 'Frame Decode'
    };
    return map[t] || t.charAt(0).toUpperCase() + t.slice(1);
  }

  function renderTabBody(d, cat, cfg, tab) {
    if (tab === 'overview') {
      return `
      <div class="device-profile enterprise-profile">
        <div class="device-profile-icon">${cat.icon}</div>
        <div class="profile-meta">
          <span class="category-pill">${cat.category}</span>
          <h4>${cat.name}</h4>
          <p>MAC: <code>${d.mac || '00:1a:2b:00:00:00'}</code></p>
        </div>
      </div>
      <button class="btn primary btn-teardown" data-action="openTeardown" style="width:100%;margin-bottom:12px">
        🔍 Inspect Hardware (Front & Rear 3D View) →
      </button>
      <div class="def-card">
        <b>OSI Layer Role & Physical Architecture</b><br>
        ${cat.definition}
      </div>
      <div class="insight-card">
        <span>Hardware Highlights</span>
        <b>${cat.hotspots?.map(h => h.name).slice(0, 3).join(' • ') || 'Industrial rackmount chassis with enterprise redundancy.'}</b>
      </div>`;
    }

    if (tab === 'ports') {
      return `
      <div class="def-card">
        <b>Physical Interfaces & PHY Negotiation</b><br>
        Click any port row below to inspect electrical link state, MAC addressing, and negotiated speed.
      </div>
      <div class="port-table">
        ${cat.ports.map(p => {
          const up = !!ctx.sim.linkFor(d.id, p.id);
          const pk = `${d.id}:${p.id}`;
          const stp = ctx.sim.portConfig[pk]?.stpState || 'forwarding';
          const vlan = ctx.sim.portConfig[pk]?.vlan || 1;
          return `
          <button class="port-row port-row-btn ${stp === 'blocking' ? 'stp-blocking' : ''}" data-inspect-port="${p.id}" data-port-state="${up ? 'up' : 'down'}">
            <span class="port-led ${up ? (stp === 'blocking' ? 'blocking' : 'up') : ''}"></span>
            <div class="port-info">
              <b>${p.label} ${stp === 'blocking' ? '<small class="tag-stp">STP BLK</small>' : ''}</b>
              <small>${p.connector} · ${p.speed} · VLAN ${vlan}</small>
            </div>
            <span class="port-state ${up ? (stp === 'blocking' ? 'blocking' : 'up') : ''}">
              ${up ? (stp === 'blocking' ? '⊗ STP Blocked' : '● Link 1G Full') : '○ Disconnected'}
            </span>
          </button>`;
        }).join('')}
      </div>`;
    }

    if (tab === 'specs') {
      return `
      <div class="spec-intro">Enterprise Hardware Datasheet & OSI Architecture</div>
      <div class="spec-grid">
        ${Object.entries(cat.specs).map(([k, v]) => `
          <div class="spec">
            <small>${k}</small>
            <b>${v}</b>
          </div>`).join('')}
      </div>`;
    }

    if (tab === 'network') {
      return `
      <div class="def-card">
        <b>Layer 3 IPv4 Configuration</b><br>
        Assign static Layer 3 identity and Default Gateway for inter-subnet communication.
      </div>
      <div class="network-form">
        <label>
          <span>IPv4 Address (Host IP)</span>
          <input id="ipField" value="${cfg.ip === 'Not configured' ? '' : cfg.ip}" placeholder="192.168.10.10">
        </label>
        <label>
          <span>Subnet Mask (CIDR Prefix)</span>
          <input id="maskField" value="${cfg.mask === '—' ? '255.255.255.0' : cfg.mask}" placeholder="255.255.255.0">
        </label>
        <label>
          <span>Default Gateway (Router Interface)</span>
          <input id="gwField" value="${cfg.gateway === '—' ? '' : (cfg.gateway || '')}" placeholder="192.168.10.1">
        </label>
        <button class="btn primary" data-action="saveIp">Commit IPv4 Stack Settings</button>
      </div>`;
    }

    if (tab === 'vlans') {
      const vlans = ctx.sim.vlans[d.id] || [{ id: 1, name: 'default' }];
      return `
      <div class="def-card">
        <b>IEEE 802.1Q Virtual LAN Partitioning</b><br>
        Isolate collision & broadcast domains into distinct logical subnets.
      </div>
      <div class="vlan-list">
        ${vlans.map(v => `
          <div class="vlan-row">
            <span class="vlan-badge">VLAN ${v.id}</span>
            <div><b>${v.name}</b><small>Status: Active · Ports: Access Mode</small></div>
          </div>`).join('')}
      </div>
      <div class="vlan-form">
        <input id="vlanIdField" type="number" placeholder="VLAN ID (e.g. 10)" style="width:110px">
        <input id="vlanNameField" placeholder="VLAN Name (e.g. DATA_LAN)" style="flex:1">
        <button class="btn soft" data-action="addVlan">+ Add VLAN</button>
      </div>`;
    }

    if (tab === 'routing') {
      const routes = ctx.sim.routingTables[d.id] || [];
      return `
      <div class="def-card">
        <b>Layer 3 IP Routing Table (FIB)</b><br>
        Directly connected and static route entries determining next-hop packet egress.
      </div>
      <div class="route-table">
        <div class="route-head"><span>Type</span><span>Destination Subnet</span><span>Next Hop</span><span>Interface</span></div>
        ${(routes.length ? routes : [
          { type: 'C', network: '192.168.10.0', mask: '255.255.255.0', nextHop: '0.0.0.0', interface: 'G0/0' },
          { type: 'C', network: '192.168.20.0', mask: '255.255.255.0', nextHop: '0.0.0.0', interface: 'G0/1' }
        ]).map(r => `
          <div class="route-row">
            <span class="route-type ${r.type === 'C' ? 'connected' : 'static'}">${r.type}</span>
            <b>${r.network}/${r.mask === '255.255.255.0' ? '24' : r.mask}</b>
            <small>${r.nextHop === '0.0.0.0' ? 'Direct' : r.nextHop}</small>
            <span>${r.interface}</span>
          </div>`).join('')}
      </div>`;
    }

    if (tab === 'security') {
      const rules = ctx.sim.firewallRules[d.id] || [];
      return `
      <div class="def-card">
        <b>Stateful Firewall Access Control Lists (ACLs)</b><br>
        Security boundary enforcement between Inside (Trust), Outside (Untrust), and DMZ.
      </div>
      <div class="acl-list">
        ${rules.map(r => `
          <div class="acl-row ${r.action}">
            <span class="acl-action ${r.action}">${r.action.toUpperCase()}</span>
            <div>
              <b>${r.desc}</b>
              <small>${r.srcZone.toUpperCase()} → ${r.dstZone.toUpperCase()} (Proto: ${r.proto.toUpperCase()})</small>
            </div>
          </div>`).join('')}
      </div>`;
    }

    if (tab === 'services') {
      const pool = ctx.sim.dhcpPools[d.id];
      const dns = ctx.sim.dnsRecords[d.id] || [];
      return `
      <div class="def-card">
        <b>Core Infrastructure Services</b><br>
        Automated DHCP DORA dynamic addressing pool & authoritative DNS hostname resolver.
      </div>
      <div class="service-block">
        <h4>DHCP Pool Daemon (${pool?.name || 'ACTIVE'})</h4>
        <div class="spec-grid">
          <div class="spec"><small>Pool Subnet</small><b>${pool?.network || '192.168.10.0'}/24</b></div>
          <div class="spec"><small>Lease Range</small><b>${pool?.range?.join(' – ') || '100 – 150'}</b></div>
          <div class="spec"><small>Default Gateway</small><b>${pool?.gateway || '192.168.10.1'}</b></div>
          <div class="spec"><small>DNS Server</small><b>${pool?.dns || '192.168.10.20'}</b></div>
        </div>
      </div>
      <div class="service-block" style="margin-top:12px">
        <h4>DNS A-Records (Zone: cyberlab.local)</h4>
        <div class="dns-list">
          ${dns.map(rec => `
            <div class="dns-row">
              <b>${rec.name}</b>
              <span class="dns-type">IN A</span>
              <code>${rec.value}</code>
            </div>`).join('')}
        </div>
      </div>`;
    }

    if (tab === 'packets') {
      const ev = ctx.sim.events.filter(e => e.type === 'packet').slice(-1)[0]?.data?.packet || capturedPacket;
      if (!ev) {
        return `
        <div class="def-card">
          <b>Wireshark Protocol Frame Inspector</b><br>
          Run a <code>ping</code> or <code>ipconfig /renew</code> in the terminal to capture and decode live frames on the wire.
        </div>
        <div class="packet-placeholder">
          <span>📡</span>
          <p>No active packet captured on wire yet.<br>Generate network traffic to view Layer 2/3/4 packet headers.</p>
        </div>`;
      }
      return `
      <div class="def-card">
        <b>Wireshark Live Packet Header Breakdown</b><br>
        Inspecting decoded PDU (Protocol Data Unit) captured from wire transmission.
      </div>
      <div class="wireshark-viewer">
        <div class="packet-layer">
          <div class="layer-head">▼ Layer 2: Ethernet II (Physical Data Link)</div>
          <div class="layer-body">
            <div><span>Source MAC:</span> <code>${ev.layers?.l2?.srcMac || '00:1a:2b:4c:5d:01'}</code></div>
            <div><span>Destination MAC:</span> <code>${ev.layers?.l2?.dstMac || '00:1a:2b:7a:8b:02'}</code></div>
            <div><span>EtherType:</span> <code>${ev.layers?.l2?.ethertype || '0x0800 (IPv4)'}</code></div>
          </div>
        </div>
        <div class="packet-layer">
          <div class="layer-head">▼ Layer 3: Internet Protocol Version 4 (Network Header)</div>
          <div class="layer-body">
            <div><span>Source IPv4:</span> <code>${ev.layers?.l3?.srcIp || '192.168.10.10'}</code></div>
            <div><span>Destination IPv4:</span> <code>${ev.layers?.l3?.dstIp || '192.168.10.20'}</code></div>
            <div><span>Time To Live (TTL):</span> <code>${ev.layers?.l3?.ttl || 64}</code></div>
            <div><span>Protocol:</span> <code>${ev.layers?.l3?.proto || 'ICMP (1)'}</code></div>
          </div>
        </div>
        <div class="packet-layer">
          <div class="layer-head">▼ Layer 4: ${ev.layers?.l4?.name || 'ICMP Echo Request'}</div>
          <div class="layer-body">
            <div><span>Type / Code:</span> <code>${ev.layers?.l4?.type || '8 (Echo Request)'}</code></div>
            <div><span>Payload:</span> <code>${ev.layers?.l4?.payload || '32 bytes [abcdefghijklmnopqrstuvw]'}</code></div>
          </div>
        </div>
      </div>`;
    }
  }

  function renderTerminal() {
    const box = $('#terminalDrawer');
    if (!box) return;
    const d = ctx.selected();
    const suggestions = d
      ? (d.type === 'pc' || d.type === 'server'
          ? ['ipconfig', 'ping 192.168.10.20', 'arp -a', 'ipconfig /renew', 'nslookup app.lab', 'help']
          : d.type === 'switch'
          ? ['show interfaces status', 'show mac address-table', 'show vlan brief', 'show running-config']
          : ['show ip interface brief', 'show ip route', 'ping 192.168.20.20', 'show running-config'])
      : [];

    box.className = `terminal-drawer ${ctx.terminalOpen() ? 'open' : ''}`;
    box.innerHTML = `
    <div class="terminal-top">
      <span class="term-dot"></span><span class="term-dot"></span><span class="term-dot"></span>
      <b>${d ? `${d.name} (${ctx.catalog[d.type].category})` : 'Terminal'}</b>
      <button data-action="closeTerminal" aria-label="Close terminal">✕</button>
    </div>
    <div class="terminal-content">
      <div class="terminal-pane">
        <div class="terminal-output" id="terminalOutput">${d ? `Connected to ${d.name} over serial console / SSH.\nType a command or click a chip on the right.\n` : 'Select an active device to open terminal console.\n'}</div>
        <div class="terminal-input-row">
          <span class="prompt">${d ? d.name : 'lab'}&gt;</span>
          <input class="terminal-input" id="terminalInput" autocomplete="off" placeholder="Type network command (e.g. ipconfig, ping, show mac address-table)…">
          <button class="term-run" data-run-command>Run ↵</button>
        </div>
      </div>
      <aside class="command-help">
        <h4>Diagnostic Commands</h4>
        ${suggestions.map(s => `<button class="cmd-chip" data-cmd="${s}"><span>▶</span>${s}</button>`).join('')}
        <p class="command-explain">Command chips execute live diagnostic scripts on the active device.</p>
      </aside>
    </div>`;

    box.querySelector('[data-action="closeTerminal"]').onclick = () => ctx.toggleTerminal(false);
    box.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => ctx.runCommand(b.dataset.cmd));

    const inp = $('#terminalInput');
    const run = () => {
      if (inp?.value.trim()) {
        ctx.runCommand(inp.value);
        inp.value = '';
      }
    };
    if (inp) inp.onkeydown = e => { if (e.key === 'Enter') run(); };
    box.querySelector('[data-run-command]')?.addEventListener('click', run);
  }

  // ==========================================================================
  // PHOTOREALISTIC RESPONSIVE HARDWARE TEARDOWN MODAL
  // ==========================================================================
  function openTeardownModal(d) {
    const modalRoot = $('#modalRoot');
    if (!modalRoot) return;
    const cat = ctx.catalog[d.type];
    let currentSide = 'front'; // 'front' | 'rear'

    function renderTeardown() {
      modalRoot.innerHTML = `
      <div class="modal-backdrop teardown-backdrop">
        <div class="modal-card teardown-card">
          <div class="teardown-head">
            <div>
              <span class="panel-eyebrow">PHYSICAL HARDWARE TEARDOWN</span>
              <h2>${cat.name}</h2>
              <p>${d.name} · ${cat.specs['Form Factor'] || '1U 19-Inch Rack Chassis'}</p>
            </div>
            <div class="teardown-head-actions">
              <button class="btn soft side-toggle-btn" data-toggle-side>
                🔄 Flip to ${currentSide === 'front' ? 'REAR VIEW' : 'FRONT VIEW'}
              </button>
              <button class="close-x" data-close-teardown>✕</button>
            </div>
          </div>

          <div class="teardown-view-container">
            <div class="chassis-viewer-svg-wrap">
              ${renderChassisSVG(d, currentSide)}
            </div>
          </div>

          <div class="teardown-info-grid">
            <div class="teardown-spec-card">
              <h4>Engineering Datasheet</h4>
              <div class="spec-grid">
                ${Object.entries(cat.specs).map(([k, v]) => `
                  <div class="spec"><small>${k}</small><b>${v}</b></div>
                `).join('')}
              </div>
            </div>
            <div class="teardown-hotspot-card">
              <h4>Component Architecture (Click to inspect)</h4>
              <div class="hotspot-list">
                ${(cat.hotspots || []).map((h, i) => `
                  <div class="hotspot-item" data-hotspot="${i}">
                    <span class="hotspot-num">${i + 1}</span>
                    <div>
                      <b>${h.name}</b>
                      <p>${h.desc}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>`;

      modalRoot.querySelector('[data-close-teardown]').onclick = () => {
        modalRoot.innerHTML = '';
      };
      modalRoot.querySelector('[data-toggle-side]').onclick = () => {
        currentSide = currentSide === 'front' ? 'rear' : 'front';
        renderTeardown();
      };
      modalRoot.querySelectorAll('[data-hotspot]').forEach(item => {
        item.onclick = () => {
          const idx = parseInt(item.dataset.hotspot);
          const spot = cat.hotspots?.[idx];
          if (spot) {
            ctx.toast(`[${spot.name}]: ${spot.desc}`);
            item.classList.toggle('active');
          }
        };
      });
    }

    renderTeardown();
  }

  // 100% Scalable Vector Hardware Faceplate Graphics
  function renderChassisSVG(d, side) {
    if (d.type === 'switch') {
      if (side === 'front') {
        return `
        <svg viewBox="0 0 960 140" class="chassis-vector-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="chassisSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2d3b35"/><stop offset="50%" stop-color="#1b2521"/><stop offset="100%" stop-color="#0f1513"/></linearGradient>
            <linearGradient id="earSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3d4e46"/><stop offset="100%" stop-color="#1a2420"/></linearGradient>
          </defs>
          <!-- Left/Right Rackmount Ears -->
          <rect x="0" y="0" width="22" height="140" rx="3" fill="url(#earSteel)" stroke="#090d0b"/>
          <circle cx="11" cy="20" r="5" fill="#506159" stroke="#1c2420"/><circle cx="11" cy="120" r="5" fill="#506159" stroke="#1c2420"/>
          <rect x="938" y="0" width="22" height="140" rx="3" fill="url(#earSteel)" stroke="#090d0b"/>
          <circle cx="949" cy="20" r="5" fill="#506159" stroke="#1c2420"/><circle cx="949" cy="120" r="5" fill="#506159" stroke="#1c2420"/>
          <!-- Main 19" Steel Chassis Faceplate -->
          <rect x="22" y="8" width="916" height="124" rx="4" fill="url(#chassisSteel)" stroke="#0b100e" stroke-width="2"/>
          <rect x="24" y="10" width="912" height="1" fill="#4d6157" opacity="0.6"/>
          
          <!-- Silkscreen Branding & Mode Section -->
          <text x="40" y="38" fill="#d9ece2" font-size="12" font-weight="900" font-family="Arial, sans-serif" letter-spacing="1">CYBERLAB CATALYST 2400-G</text>
          <text x="40" y="52" fill="#7d968b" font-size="9" font-family="Arial, sans-serif">24-PORT 1000BASE-T MANAGED ENTERPRISE SWITCH</text>
          <rect x="40" y="70" width="46" height="20" rx="3" fill="#131e19" stroke="#364c40"/>
          <text x="50" y="84" fill="#9db5aa" font-size="9" font-weight="800" font-family="Arial, sans-serif">MODE</text>
          <circle cx="100" cy="80" r="3.5" fill="#22c55e"/><text x="108" y="83" fill="#8da498" font-size="8" font-family="Arial, sans-serif">STAT</text>
          <circle cx="138" cy="80" r="3.5" fill="#22c55e"/><text x="146" y="83" fill="#8da498" font-size="8" font-family="Arial, sans-serif">SPEED</text>
          <circle cx="186" cy="80" r="3.5" fill="#22c55e"/><text x="194" y="83" fill="#8da498" font-size="8" font-family="Arial, sans-serif">DUPLEX</text>

          <!-- Port Bank 1 (Ports 1-12) -->
          <rect x="245" y="24" width="285" height="92" rx="4" fill="#0c1310" stroke="#25352c"/>
          <text x="255" y="38" fill="#6d887a" font-size="8" font-weight="900" font-family="Arial, sans-serif" letter-spacing="0.5">PORTS 1–12 (1000BASE-T)</text>
          ${Array.from({ length: 6 }, (_, i) => {
            const upTop = ctx.sim.linkFor(d.id, `gi0/${i * 2 + 1}`);
            const upBot = ctx.sim.linkFor(d.id, `gi0/${i * 2 + 2}`);
            return `
            <!-- Top Port ${i * 2 + 1} -->
            <g transform="translate(${255 + i * 44}, 44)">
              <circle cx="6" cy="4" r="2" fill="${upTop ? '#22c55e' : '#37473f'}"/>
              <rect x="0" y="8" width="24" height="20" rx="2" fill="#050807" stroke="#486053"/>
              <text x="12" y="35" fill="#8ca598" font-size="7" font-weight="700" text-anchor="middle" font-family="Arial">${i * 2 + 1}</text>
            </g>
            <!-- Bottom Port ${i * 2 + 2} -->
            <g transform="translate(${255 + i * 44}, 82)">
              <circle cx="6" cy="4" r="2" fill="${upBot ? '#22c55e' : '#37473f'}"/>
              <rect x="0" y="8" width="24" height="20" rx="2" fill="#050807" stroke="#486053"/>
              <text x="12" y="35" fill="#8ca598" font-size="7" font-weight="700" text-anchor="middle" font-family="Arial">${i * 2 + 2}</text>
            </g>`;
          }).join('')}

          <!-- Port Bank 2 (Ports 13-24) -->
          <rect x="545" y="24" width="285" height="92" rx="4" fill="#0c1310" stroke="#25352c"/>
          <text x="555" y="38" fill="#6d887a" font-size="8" font-weight="900" font-family="Arial, sans-serif" letter-spacing="0.5">PORTS 13–24 (PoE+ 802.3at)</text>
          ${Array.from({ length: 6 }, (_, i) => `
            <g transform="translate(${555 + i * 44}, 44)">
              <circle cx="6" cy="4" r="2" fill="#37473f"/>
              <rect x="0" y="8" width="24" height="20" rx="2" fill="#050807" stroke="#486053"/>
              <text x="12" y="35" fill="#8ca598" font-size="7" font-weight="700" text-anchor="middle" font-family="Arial">${i * 2 + 13}</text>
            </g>
            <g transform="translate(${555 + i * 44}, 82)">
              <circle cx="6" cy="4" r="2" fill="#37473f"/>
              <rect x="0" y="8" width="24" height="20" rx="2" fill="#050807" stroke="#486053"/>
              <text x="12" y="35" fill="#8ca598" font-size="7" font-weight="700" text-anchor="middle" font-family="Arial">${i * 2 + 14}</text>
            </g>`).join('')}

          <!-- SFP+ Uplinks & Console -->
          <rect x="840" y="24" width="88" height="92" rx="4" fill="#0c1310" stroke="#25352c"/>
          <text x="846" y="38" fill="#718d7f" font-size="7.5" font-weight="900" font-family="Arial">10G SFP+ / CON</text>
          <rect x="846" y="46" width="22" height="26" rx="2" fill="#141f19" stroke="#718d7f"/>
          <text x="857" y="62" fill="#a4beb1" font-size="6" text-anchor="middle" font-family="Arial">25G</text>
          <rect x="874" y="46" width="22" height="26" rx="2" fill="#141f19" stroke="#718d7f"/>
          <text x="885" y="62" fill="#a4beb1" font-size="6" text-anchor="middle" font-family="Arial">26G</text>
          <!-- Console -->
          <rect x="846" y="80" width="50" height="26" rx="2" fill="#050807" stroke="#92751f"/>
          <text x="871" y="96" fill="#f2c94c" font-size="6.5" font-weight="900" text-anchor="middle" font-family="Arial">CONSOLE</text>
        </svg>`;
      } else {
        return `
        <svg viewBox="0 0 960 140" class="chassis-vector-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="chassisRear" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#24302a"/><stop offset="100%" stop-color="#121815"/></linearGradient>
          </defs>
          <rect x="0" y="0" width="22" height="140" rx="3" fill="#2d3a33" stroke="#090d0b"/>
          <rect x="938" y="0" width="22" height="140" rx="3" fill="#2d3a33" stroke="#090d0b"/>
          <rect x="22" y="8" width="916" height="124" rx="4" fill="url(#chassisRear)" stroke="#0b100e" stroke-width="2"/>

          <!-- 3x Variable Speed Fans -->
          <text x="45" y="34" fill="#718d7f" font-size="9" font-weight="900" font-family="Arial">REDUNDANT COOLING FAN EXHAUST</text>
          ${Array.from({ length: 3 }, (_, i) => `
            <g transform="translate(${45 + i * 85}, 46)">
              <circle cx="36" cy="36" r="34" fill="#080c0a" stroke="#2e4237" stroke-width="2"/>
              <circle cx="36" cy="36" r="24" fill="none" stroke="#486052" stroke-width="2" stroke-dasharray="6,4"/>
              <circle cx="36" cy="36" r="6" fill="#1b2520"/>
            </g>`).join('')}

          <!-- Grounding Terminal -->
          <g transform="translate(340, 50)">
            <text x="0" y="16" fill="#a4beb1" font-size="14">⏚</text>
            <circle cx="28" cy="12" r="4" fill="#b45309" stroke="#222"/>
            <circle cx="28" cy="32" r="4" fill="#b45309" stroke="#222"/>
            <text x="40" y="24" fill="#6d887a" font-size="8" font-family="Arial">SAFETY GROUND</text>
          </g>

          <!-- Dual Hot-Swap Power Supplies -->
          <g transform="translate(500, 24)">
            <!-- PSU 1 -->
            <rect x="0" y="0" width="200" height="92" rx="4" fill="#0d1411" stroke="#364c40"/>
            <text x="12" y="20" fill="#a4beb1" font-size="8.5" font-weight="800" font-family="Arial">PSU 1 (350W AC 100-240V)</text>
            <rect x="12" y="32" width="28" height="8" rx="2" fill="#c2410c"/>
            <rect x="50" y="32" width="34" height="24" rx="2" fill="#050807" stroke="#4a6357"/>
            <circle cx="100" cy="44" r="3.5" fill="#22c55e"/><text x="108" y="47" fill="#22c55e" font-size="8" font-family="Arial">● OK</text>

            <!-- PSU 2 -->
            <rect x="215" y="0" width="200" height="92" rx="4" fill="#0d1411" stroke="#364c40"/>
            <text x="227" y="20" fill="#a4beb1" font-size="8.5" font-weight="800" font-family="Arial">PSU 2 (350W AC 100-240V)</text>
            <rect x="227" y="32" width="28" height="8" rx="2" fill="#c2410c"/>
            <rect x="265" y="32" width="34" height="24" rx="2" fill="#050807" stroke="#4a6357"/>
            <circle cx="315" cy="44" r="3.5" fill="#22c55e"/><text x="323" y="47" fill="#22c55e" font-size="8" font-family="Arial">● OK</text>
          </g>
        </svg>`;
      }
    }

    if (d.type === 'router') {
      if (side === 'front') {
        return `
        <svg viewBox="0 0 960 140" class="chassis-vector-svg" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="routerSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2d3b35"/><stop offset="100%" stop-color="#141d19"/></linearGradient></defs>
          <rect x="0" y="0" width="22" height="140" rx="3" fill="#2d3a33"/>
          <rect x="938" y="0" width="22" height="140" rx="3" fill="#2d3a33"/>
          <rect x="22" y="8" width="916" height="124" rx="4" fill="url(#routerSteel)" stroke="#0b100e" stroke-width="2"/>

          <text x="40" y="38" fill="#d9ece2" font-size="12" font-weight="900" font-family="Arial">CYBERLAB MODULAR ROUTER 4331</text>
          <text x="40" y="52" fill="#7d968b" font-size="9" font-family="Arial">ENTERPRISE MULTI-SERVICE EDGE ROUTER</text>
          <circle cx="45" cy="75" r="3" fill="#22c55e"/><text x="52" y="78" fill="#8da498" font-size="7.5" font-family="Arial">PWR</text>
          <circle cx="85" cy="75" r="3" fill="#22c55e"/><text x="92" y="78" fill="#8da498" font-size="7.5" font-family="Arial">SYS</text>
          <circle cx="125" cy="75" r="3" fill="#22c55e"/><text x="132" y="78" fill="#8da498" font-size="7.5" font-family="Arial">ACT</text>

          <!-- 2x NIM Expansion Slots -->
          <rect x="220" y="24" width="260" height="92" rx="4" fill="#0a100d" stroke="#2e4438"/>
          <text x="232" y="40" fill="#6d887a" font-size="8" font-weight="900" font-family="Arial">NIM SLOT 0 (EXPANSION MODULE)</text>
          <circle cx="235" cy="70" r="4" fill="#718d7f"/><rect x="245" y="55" width="210" height="30" rx="2" fill="#131e19"/><circle cx="465" cy="70" r="4" fill="#718d7f"/>

          <!-- 3x Routed GE Interfaces + Console/AUX -->
          <rect x="500" y="24" width="425" height="92" rx="4" fill="#0a100d" stroke="#2e4438"/>
          <text x="512" y="40" fill="#6d887a" font-size="8" font-weight="900" font-family="Arial">ROUTED GIGABIT INTERFACES & MANAGEMENT</text>
          ${['GE0/0/0 (LAN)', 'GE0/0/1 (WAN)', 'GE0/0/2 (DMZ)'].map((l, i) => `
            <g transform="translate(${515 + i * 75}, 50)">
              <circle cx="8" cy="4" r="2.5" fill="#22c55e"/>
              <rect x="0" y="10" width="30" height="24" rx="2" fill="#050807" stroke="#486053"/>
              <text x="15" y="44" fill="#8da498" font-size="7" font-weight="700" text-anchor="middle" font-family="Arial">${l}</text>
            </g>`).join('')}

          <g transform="translate(${755}, 50)">
            <rect x="0" y="10" width="30" height="24" rx="2" fill="#050807" stroke="#92751f"/>
            <text x="15" y="44" fill="#f2c94c" font-size="7" font-weight="900" text-anchor="middle" font-family="Arial">CON</text>
          </g>
          <g transform="translate(${800}, 50)">
            <rect x="0" y="10" width="30" height="24" rx="2" fill="#050807" stroke="#92751f"/>
            <text x="15" y="44" fill="#f2c94c" font-size="7" font-weight="900" text-anchor="middle" font-family="Arial">AUX</text>
          </g>
        </svg>`;
      } else {
        return `
        <svg viewBox="0 0 960 140" class="chassis-vector-svg" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="22" height="140" rx="3" fill="#2d3a33"/>
          <rect x="938" y="0" width="22" height="140" rx="3" fill="#2d3a33"/>
          <rect x="22" y="8" width="916" height="124" rx="4" fill="#141d19" stroke="#0b100e" stroke-width="2"/>
          <circle cx="100" cy="70" r="35" fill="#080c0a" stroke="#2e4237" stroke-width="2"/>
          <text x="155" y="75" fill="#718d7f" font-size="9" font-family="Arial">SYSTEM EXHAUST FAN</text>
          <rect x="680" y="35" width="16" height="30" fill="#c2410c"/>
          <rect x="710" y="35" width="40" height="30" rx="2" fill="#050807" stroke="#4a6357"/>
          <text x="680" y="85" fill="#a4beb1" font-size="8" font-family="Arial">POWER SWITCH (100–240V ~ 1.5A)</text>
        </svg>`;
      }
    }

    if (d.type === 'server') {
      if (side === 'front') {
        return `
        <svg viewBox="0 0 960 180" class="chassis-vector-svg" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="serverBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#24332c"/><stop offset="100%" stop-color="#101814"/></linearGradient></defs>
          <rect x="0" y="0" width="22" height="180" rx="3" fill="#2d3a33"/>
          <rect x="938" y="0" width="22" height="180" rx="3" fill="#2d3a33"/>
          <rect x="22" y="6" width="916" height="168" rx="4" fill="url(#serverBezel)" stroke="#0b100e" stroke-width="2"/>
          <text x="40" y="32" fill="#d9ece2" font-size="11" font-weight="900" font-family="Arial">CYBERLAB POWEREDGE R750 (2U ENTERPRISE RACK SERVER)</text>

          <!-- 8x Hot-Swap SAS Caddies -->
          ${Array.from({ length: 8 }, (_, i) => `
            <g transform="translate(${40 + i * 92}, 46)">
              <rect x="0" y="0" width="86" height="108" rx="3" fill="#080c0a" stroke="#25352c"/>
              <rect x="8" y="10" width="70" height="10" rx="2" fill="#1b2520" stroke="#364c40"/>
              <circle cx="15" cy="30" r="2.5" fill="#22c55e"/><circle cx="25" cy="30" r="2.5" fill="#f59e0b"/>
              <text x="43" y="80" fill="#6d887a" font-size="8" font-weight="800" text-anchor="middle" font-family="Arial">SAS SSD ${i}</text>
              <text x="43" y="92" fill="#4d6157" font-size="7" text-anchor="middle" font-family="Arial">1.92TB</text>
            </g>`).join('')}

          <!-- Power Button & Diagnostic Panel -->
          <g transform="translate(800, 46)">
            <circle cx="20" cy="20" r="12" fill="#13221b" stroke="#22c55e" stroke-width="2"/>
            <text x="20" y="24" fill="#22c55e" font-size="10" text-anchor="middle">⏻</text>
            <rect x="0" y="44" width="40" height="18" rx="2" fill="#050807" stroke="#364c40"/>
            <text x="20" y="56" fill="#8da498" font-size="6" text-anchor="middle" font-family="Arial">VGA/USB</text>
          </g>
        </svg>`;
      } else {
        return `
        <svg viewBox="0 0 960 180" class="chassis-vector-svg" xmlns="http://www.w3.org/2000/svg">
          <rect x="22" y="6" width="916" height="168" rx="4" fill="#101814" stroke="#0b100e" stroke-width="2"/>
          <text x="40" y="32" fill="#d9ece2" font-size="11" font-weight="900" font-family="Arial">REAR I/O & POWER ARCHITECTURE</text>
          <!-- Quad NIC + iDRAC -->
          <rect x="40" y="46" width="360" height="108" rx="4" fill="#080c0a" stroke="#25352c"/>
          <text x="52" y="64" fill="#718d7f" font-size="8.5" font-weight="900" font-family="Arial">QUAD 10GbE BASE-T NIC + IPMI/iDRAC</text>
          ${Array.from({ length: 4 }, (_, i) => `
            <g transform="translate(${55 + i * 55}, 80)">
              <rect x="0" y="0" width="28" height="24" rx="2" fill="#050807" stroke="#486053"/>
              <text x="14" y="36" fill="#8da498" font-size="6.5" text-anchor="middle" font-family="Arial">NIC ${i + 1}</text>
            </g>`).join('')}
          <g transform="translate(290, 80)">
            <rect x="0" y="0" width="28" height="24" rx="2" fill="#050807" stroke="#92751f"/>
            <text x="14" y="36" fill="#f2c94c" font-size="6.5" font-weight="800" text-anchor="middle" font-family="Arial">iDRAC</text>
          </g>

          <!-- Dual 750W Titanium PSUs -->
          <g transform="translate(540, 46)">
            <rect x="0" y="0" width="170" height="108" rx="4" fill="#0d1411" stroke="#364c40"/>
            <text x="12" y="24" fill="#a4beb1" font-size="8" font-weight="800" font-family="Arial">PSU 1 (750W TITANIUM)</text>
            <rect x="12" y="40" width="24" height="10" rx="2" fill="#c2410c"/>
            <rect x="44" y="40" width="34" height="26" rx="2" fill="#050807" stroke="#4a6357"/>

            <rect x="190" y="0" width="170" height="108" rx="4" fill="#0d1411" stroke="#364c40"/>
            <text x="202" y="24" fill="#a4beb1" font-size="8" font-weight="800" font-family="Arial">PSU 2 (750W TITANIUM)</text>
            <rect x="202" y="40" width="24" height="10" rx="2" fill="#c2410c"/>
            <rect x="234" y="40" width="34" height="26" rx="2" fill="#050807" stroke="#4a6357"/>
          </g>
        </svg>`;
      }
    }

    // Workstation PC, Firewall & Default
    return `
    <svg viewBox="0 0 960 140" class="chassis-vector-svg" xmlns="http://www.w3.org/2000/svg">
      <rect x="22" y="8" width="916" height="124" rx="4" fill="#141d19" stroke="#0b100e" stroke-width="2"/>
      <text x="40" y="45" fill="#d9ece2" font-size="14" font-weight="900" font-family="Arial">${cat.name.toUpperCase()} (${side.toUpperCase()} VIEW)</text>
      <text x="40" y="70" fill="#718d7f" font-size="10" font-family="Arial">Form Factor: ${cat.specs['Form Factor'] || 'Enterprise Appliance Chassis'}</text>
      <text x="40" y="95" fill="#a4beb1" font-size="10" font-family="Arial">Ports: ${cat.ports.map(p => p.label).join(', ')}</text>
    </svg>`;
  }

  function setCapturedPacket(pkt) {
    capturedPacket = pkt;
  }

  return { renderInspector, renderTerminal, setCapturedPacket, openTeardownModal };
}
