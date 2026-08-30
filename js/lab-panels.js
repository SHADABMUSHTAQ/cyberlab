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

    // Default Overview
    return `
    <div class="device-profile enterprise-profile">
      <div class="device-profile-icon">${cat.icon}</div>
      <div class="profile-meta">
        <span class="category-pill">${cat.category}</span>
        <h4>${cat.name}</h4>
        <p>Burned-in MAC: <code>${d.mac || '00:1a:2b:00:00:00'}</code></p>
      </div>
    </div>
    <div class="def-card">
      <b>OSI Function & Purpose</b><br>
      ${cat.definition}
    </div>
    <div class="insight-card">
      <span>Architectural Insight</span>
      <b>${d.type === 'switch' ? 'Switches maintain hardware CAM tables to direct frames straight to destination ports, eliminating collisions.' :
          d.type === 'router' ? 'Routers act as Default Gateways, stripping Layer 2 headers, evaluating Layer 3 IP destinations, and forwarding across subnets.' :
          d.type === 'firewall' ? 'Stateful firewalls maintain connection state tables to inspect and control bidirectional traffic flows between security zones.' :
          d.type === 'server' ? 'Enterprise servers provide automated infrastructure services (DHCP address allocation & DNS domain resolution).' :
          'Workstations generate application requests, encapsulate them into packets, and transmit frames onto the physical medium.'}</b>
    </div>`;
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

  function setCapturedPacket(pkt) {
    capturedPacket = pkt;
  }

  return { renderInspector, renderTerminal, setCapturedPacket };
}
