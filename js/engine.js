import {DEVICE_CATALOG} from './data.js';

// Generate realistic deterministic MAC addresses based on device ID
export function hashToMac(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return `00:1a:2b:${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}`;
}

export class SimulationEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.devices = [];
    this.links = [];
    this.events = [];
    this.ipConfig = {};
    this.macTables = {};
    this.vlans = {};
    this.routingTables = {};
    this.arpTables = {};
    this.dhcpPools = {};
    this.dnsRecords = {};
    this.portConfig = {};
    this.firewallRules = {};
    this.natTable = [];
    this.portStats = {};
    this.seq = 1;
  }

  addDevice(type, x, y, label) {
    const base = DEVICE_CATALOG[type];
    if (!base) throw new Error(`Unknown device type: ${type}`);
    const id = `${type}-${this.seq++}`;
    const mac = hashToMac(id);
    const device = {
      id,
      type,
      name: label || `${base.short}-${this.seq - 1}`,
      x,
      y,
      power: true,
      mac,
      uptime: '00:14:32',
      cpuUsage: Math.floor(8 + Math.random() * 12)
    };
    this.devices.push(device);

    // Initialize per-device state
    if (type === 'switch') {
      this.macTables[id] = [];
      this.vlans[id] = [
        { id: 1, name: 'default', ports: base.ports.filter(p => p.type === 'ethernet').map(p => p.id) },
        { id: 10, name: 'VOICE_LAN', ports: [] },
        { id: 20, name: 'DATA_LAN', ports: [] }
      ];
    }
    if (type === 'router' || type === 'firewall') {
      this.routingTables[id] = [];
    }
    if (type === 'firewall') {
      this.firewallRules[id] = [
        { id: 10, action: 'permit', srcZone: 'inside', dstZone: 'outside', proto: 'ip', desc: 'Permit Outbound Trust to Untrust' },
        { id: 20, action: 'permit', srcZone: 'inside', dstZone: 'dmz', proto: 'ip', desc: 'Permit Access to DMZ Servers' },
        { id: 100, action: 'deny', srcZone: 'outside', dstZone: 'inside', proto: 'ip', desc: 'Implicit Deny Untrusted Inbound' }
      ];
    }
    if (type === 'server') {
      this.dhcpPools[id] = {
        name: 'LAN_POOL_10',
        network: '192.168.10.0',
        mask: '255.255.255.0',
        gateway: '192.168.10.1',
        dns: '192.168.10.20',
        range: ['192.168.10.100', '192.168.10.150'],
        leases: []
      };
      this.dnsRecords[id] = [
        { name: 'app.lab', type: 'A', value: '192.168.10.20', ttl: 3600 },
        { name: 'gw.lab', type: 'A', value: '192.168.10.1', ttl: 3600 },
        { name: 'srv.lab', type: 'A', value: '192.168.10.20', ttl: 3600 }
      ];
    }

    this.arpTables[id] = [];
    base.ports.forEach(p => {
      const pk = this.portKey(id, p.id);
      this.portStats[pk] = { rxPackets: 0, txPackets: 0, rxBytes: 0, txBytes: 0, speed: p.speed, duplex: 'Full', status: 'down' };
      this.portConfig[pk] = { mode: 'access', vlan: 1, stpState: 'forwarding' };
    });

    return device;
  }

  getDevice(id) {
    return this.devices.find(d => d.id === id);
  }

  getPorts(deviceId) {
    const d = this.getDevice(deviceId);
    return d ? DEVICE_CATALOG[d.type].ports : [];
  }

  portKey(deviceId, portId) {
    return `${deviceId}:${portId}`;
  }

  linkFor(deviceId, portId) {
    const key = this.portKey(deviceId, portId);
    return this.links.find(l => l.a === key || l.b === key);
  }

  connect(aDevice, aPort, bDevice, bPort, cable = 'rj45') {
    if (aDevice === bDevice && aPort === bPort) {
      return { ok: false, message: 'A physical cable requires two separate device interfaces.' };
    }
    const ap = this.getPorts(aDevice).find(p => p.id === aPort);
    const bp = this.getPorts(bDevice).find(p => p.id === bPort);
    if (!ap || !bp) return { ok: false, message: 'Specified network interface does not exist.' };

    const needed = cable === 'console' ? 'console' : 'ethernet';
    if (ap.type !== needed || bp.type !== needed) {
      return {
        ok: false,
        message: `${cable === 'console' ? 'Serial Console' : 'Cat6 RJ45'} cable is not electrically compatible with this port type.`
      };
    }
    if (this.linkFor(aDevice, aPort) || this.linkFor(bDevice, bPort)) {
      return { ok: false, message: 'One of those ports already has an active cable plugged in.' };
    }

    const aKey = this.portKey(aDevice, aPort);
    const bKey = this.portKey(bDevice, bPort);
    const link = {
      id: `link-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      a: aKey,
      b: bKey,
      cable,
      up: true,
      speed: '1000 Mbps',
      duplex: 'Full Duplex'
    };
    this.links.push(link);

    // Update port stats & check STP loop
    if (this.portStats[aKey]) this.portStats[aKey].status = 'up';
    if (this.portStats[bKey]) this.portStats[bKey].status = 'up';
    this.checkSpanningTree();

    this.log('link', { link, desc: `Physical Layer 1 established: ${aKey} <-> ${bKey} (1000BASE-T Full Duplex)` });
    return { ok: true, link };
  }

  disconnect(linkId) {
    const l = this.links.find(x => x.id === linkId);
    if (l) {
      if (this.portStats[l.a]) this.portStats[l.a].status = 'down';
      if (this.portStats[l.b]) this.portStats[l.b].status = 'down';
    }
    this.links = this.links.filter(l => l.id !== linkId);
    this.checkSpanningTree();
    this.log('unlink', { linkId, desc: `Cable disconnected: ${linkId}` });
  }

  checkSpanningTree() {
    // Detect redundant links between switches and set redundant port to blocking
    const switchLinks = this.links.filter(l => {
      const [ad] = l.a.split(':'), [bd] = l.b.split(':');
      const a = this.getDevice(ad), b = this.getDevice(bd);
      return a?.type === 'switch' && b?.type === 'switch';
    });

    // Reset all ports to forwarding first
    Object.keys(this.portConfig).forEach(pk => {
      if (this.portConfig[pk]) this.portConfig[pk].stpState = 'forwarding';
    });

    if (switchLinks.length > 1) {
      // Multiple switch-to-switch links = potential Layer 2 loop
      // Block the second redundant link's port
      const blockedLink = switchLinks[1];
      if (this.portConfig[blockedLink.b]) {
        this.portConfig[blockedLink.b].stpState = 'blocking';
        this.log('stp', { port: blockedLink.b, state: 'blocking', desc: 'STP 802.1w loop detected: Port set to BLOCKING / DISCARDING' });
      }
    }
  }

  setPosition(id, x, y) {
    const d = this.getDevice(id);
    if (d) { d.x = x; d.y = y; }
  }

  setIp(id, ip, mask = '255.255.255.0', gateway = '') {
    this.ipConfig[id] = { ip, mask, gateway };
    this.log('ip', { id, ip, mask, gateway, desc: `Layer 3 IPv4 configured: ${id} -> ${ip}/${mask} (GW: ${gateway || 'none'})` });

    // Auto-populate Connected (C) route for routed interfaces
    const [devId, portId] = id.split(':');
    const d = this.getDevice(devId);
    if (d && (d.type === 'router' || d.type === 'firewall')) {
      const net = this.getNetwork(ip, mask);
      if (net) {
        this.routingTables[devId] = (this.routingTables[devId] || []).filter(r => r.interface !== (portId || 'g0/0'));
        this.routingTables[devId].push({
          network: net,
          mask,
          nextHop: '0.0.0.0',
          interface: portId || 'g0/0',
          type: 'C',
          metric: 0
        });
      }
    }
    return { ok: true };
  }

  getIp(id) {
    return this.ipConfig[id] || { ip: 'Not configured', mask: '—', gateway: '—' };
  }

  neighbors(id) {
    const out = [];
    for (const link of this.links) {
      const [ad, ap] = link.a.split(':'), [bd, bp] = link.b.split(':');
      if (this.portConfig[link.a]?.stpState === 'blocking' || this.portConfig[link.b]?.stpState === 'blocking') continue;
      if (ad === id) out.push({ id: bd, port: bp, myPort: ap, link });
      if (bd === id) out.push({ id: ad, port: ap, myPort: bp, link });
    }
    return out;
  }

  pathBetween(src, dst) {
    const q = [[src, [src]]];
    const seen = new Set([src]);
    while (q.length) {
      const [n, path] = q.shift();
      if (n === dst) return path;
      for (const nei of this.neighbors(n)) {
        if (!seen.has(nei.id)) {
          seen.add(nei.id);
          q.push([nei.id, [...path, nei.id]]);
        }
      }
    }
    return null;
  }

  findByIp(ip) {
    const entry = Object.entries(this.ipConfig).find(([, c]) => c.ip === ip);
    if (!entry) return undefined;
    return entry[0].split(':')[0];
  }

  ipToInt(ip) {
    const parts = String(ip).trim().split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
  }

  maskToInt(mask) {
    return this.ipToInt(mask);
  }

  intToIp(int) {
    return `${(int >>> 24) & 255}.${(int >>> 16) & 255}.${(int >>> 8) & 255}.${int & 255}`;
  }

  validMask(mask) {
    const m = this.maskToInt(mask);
    if (m === null) return false;
    const inv = (~m) >>> 0;
    return (inv & (inv + 1)) === 0;
  }

  sameSubnet(a, b, maskA = '255.255.255.0', maskB = maskA) {
    const A = this.ipToInt(a), B = this.ipToInt(b), MA = this.maskToInt(maskA), MB = this.maskToInt(maskB);
    if (A === null || B === null || MA === null || MB === null || !this.validMask(maskA) || !this.validMask(maskB)) return false;
    return ((A & MA) >>> 0) === ((B & MA) >>> 0) && ((A & MB) >>> 0) === ((B & MB) >>> 0);
  }

  getNetwork(ip, mask) {
    const A = this.ipToInt(ip), M = this.maskToInt(mask);
    if (A === null || M === null) return null;
    return this.intToIp((A & M) >>> 0);
  }

  ping(srcId, target) {
    let targetIp = target;
    let dnsResolved = false;

    // Hostname resolution via DNS
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
      for (const srv in this.dnsRecords) {
        const rec = this.dnsRecords[srv].find(r => r.name.toLowerCase() === target.toLowerCase());
        if (rec) {
          targetIp = rec.value;
          dnsResolved = true;
          break;
        }
      }
      if (!dnsResolved) {
        return { ok: false, reason: `Ping request could not find host '${target}'. Please check the hostname or verify DNS configuration.` };
      }
    }

    const srcIpConf = this.getIp(srcId);
    if (srcIpConf.ip === 'Not configured') {
      return { ok: false, reason: 'Source endpoint has no IPv4 address configured (169.254.x.x / APIPA).' };
    }

    const dstId = this.findByIp(targetIp);
    if (!dstId) {
      return { ok: false, reason: `Destination host unreachable. No active device in the network owns IPv4 address ${targetIp}.` };
    }

    const path = this.pathBetween(srcId, dstId);
    if (!path) {
      return { ok: false, reason: 'Physical transmission failure. No complete Layer 1 cable path exists between the source and destination.' };
    }

    let dstIpConf = this.getIp(dstId);
    if (dstIpConf.ip === 'Not configured') dstIpConf = this.getIp(`${dstId}:eth0`);
    if (dstIpConf.ip === 'Not configured') dstIpConf = this.getIp(`${dstId}:g0/0`);
    const dstMask = (dstIpConf.mask && dstIpConf.mask !== '—') ? dstIpConf.mask : srcIpConf.mask;

    const sameSub = this.sameSubnet(srcIpConf.ip, targetIp, srcIpConf.mask, dstMask);
    let hasRouter = false;
    let vlanViolated = false;
    let firewallDenied = false;

    for (let i = 0; i < path.length; i++) {
      const devId = path[i];
      const dev = this.getDevice(devId);
      if (dev.type === 'router' || dev.type === 'firewall') hasRouter = true;

      // Layer 2 VLAN isolation check on switches
      if (dev.type === 'switch' && i > 0 && i < path.length - 1) {
        const inLink = this.links.find(l => (l.a.startsWith(path[i - 1] + ':') && l.b.startsWith(devId + ':')) || (l.b.startsWith(path[i - 1] + ':') && l.a.startsWith(devId + ':')));
        const outLink = this.links.find(l => (l.a.startsWith(path[i + 1] + ':') && l.b.startsWith(devId + ':')) || (l.b.startsWith(path[i + 1] + ':') && l.a.startsWith(devId + ':')));
        if (inLink && outLink) {
          const inPort = inLink.a.startsWith(devId + ':') ? inLink.a : inLink.b;
          const outPort = outLink.a.startsWith(devId + ':') ? outLink.a : outLink.b;
          const inVlan = this.portConfig[inPort]?.vlan || 1;
          const outVlan = this.portConfig[outPort]?.vlan || 1;
          if (inVlan !== outVlan) vlanViolated = true;
        }
      }

      // Layer 3/4 Stateful Firewall check
      if (dev.type === 'firewall') {
        const rules = this.firewallRules[dev.id] || [];
        const denyRule = rules.find(r => r.action === 'deny' && r.srcZone === 'outside' && path[0] === dstId);
        if (denyRule) firewallDenied = true;
      }
    }

    if (vlanViolated && !hasRouter) {
      return { ok: false, reason: 'Destination host unreachable. Packets dropped due to IEEE 802.1Q VLAN boundary isolation (no Layer 3 router).' };
    }

    if (firewallDenied) {
      return { ok: false, reason: 'Packet dropped by Stateful Security Firewall policy (Access Control List Deny Rule).' };
    }

    if (!sameSub) {
      if (!srcIpConf.gateway || srcIpConf.gateway === '—') {
        return { ok: false, reason: `Destination ${targetIp} is on a different IP subnet. Source host has no Default Gateway configured to route cross-subnet traffic.` };
      }
      if (!hasRouter) {
        return { ok: false, reason: 'Destination net unreachable. No Layer 3 router exists along the path to forward packets between subnets.' };
      }
    }

    // Populate ARP cache on source
    this.arpTables[srcId] = this.arpTables[srcId] || [];
    const dstMac = this.getDevice(dstId)?.mac || '00:1a:2b:ff:ff:ff';
    if (!this.arpTables[srcId].find(a => a.ip === targetIp)) {
      this.arpTables[srcId].push({ ip: targetIp, mac: dstMac, interface: 'Eth0', type: 'dynamic' });
    }

    // Switch CAM Table dynamic learning
    for (let i = 1; i < path.length - 1; i++) {
      const dev = this.getDevice(path[i]);
      if (dev.type === 'switch') {
        this.macTables[dev.id] = this.macTables[dev.id] || [];
        const srcMac = this.getDevice(srcId).mac;
        if (!this.macTables[dev.id].find(m => m.mac === srcMac)) {
          this.macTables[dev.id].push({ mac: srcMac, port: 'Gi0/1', vlan: 1, type: 'DYNAMIC' });
        }
      }
    }

    // Construct realistic Wireshark decoded packet frame
    const packetFrame = {
      srcId,
      dstId,
      path,
      targetIp,
      layers: {
        l2: {
          name: 'Ethernet II',
          srcMac: this.getDevice(srcId).mac,
          dstMac: dstMac,
          ethertype: '0x0800 (IPv4)'
        },
        l3: {
          name: 'Internet Protocol Version 4',
          srcIp: srcIpConf.ip,
          dstIp: targetIp,
          ttl: hasRouter ? 63 : 64,
          proto: 'ICMP (1)',
          checksum: '0x4f82 [correct]'
        },
        l4: {
          name: 'Internet Control Message Protocol',
          type: '8 (Echo Ping Request)',
          code: '0',
          seq: 1,
          payload: '32 bytes: abcdefghijklmnopqrstuvwabcdefghi'
        }
      }
    };

    this.log('packet', { srcId, dstId, path, targetIp, packet: packetFrame });
    return { ok: true, path, dstId, packet: packetFrame };
  }

  log(type, data) {
    this.events.push({ type, data, ts: Date.now() });
    if (this.events.length > 120) this.events.shift();
  }

  snapshot() {
    return {
      devices: this.devices,
      links: this.links,
      ipConfig: this.ipConfig,
      macTables: this.macTables,
      vlans: this.vlans,
      events: this.events.slice(-30)
    };
  }
}

export class CLIEngine {
  constructor(sim) {
    this.sim = sim;
    this.history = [];
    this.modes = {};
  }

  getMode(deviceId) {
    if (!this.modes[deviceId]) this.modes[deviceId] = { mode: 'exec', context: '' };
    return this.modes[deviceId];
  }

  execute(deviceId, input) {
    const cmd = input.trim();
    if (!cmd) return { text: '' };
    const lower = cmd.toLowerCase();
    const d = this.sim.getDevice(deviceId);
    if (!d) return { text: 'Error: Select an active network device first.' };

    this.history.push({ deviceId, cmd, ts: Date.now() });
    const st = this.getMode(deviceId);

    if (lower === 'help' || lower === '?') return { text: this.helpFor(d.type) };

    // Cisco IOS Configuration Mode Transitions
    if (st.mode === 'exec' && lower === 'configure terminal' && (d.type === 'switch' || d.type === 'router' || d.type === 'firewall')) {
      st.mode = 'config';
      return { text: `Enter configuration commands, one per line. End with CNTL/Z or 'exit'.\n${d.name}(config)#` };
    }
    if ((st.mode === 'config' || st.mode === 'config-if') && (lower === 'exit' || lower === 'end')) {
      st.mode = st.mode === 'config-if' && lower === 'exit' ? 'config' : 'exec';
      st.context = '';
      return { text: `${d.name}${st.mode === 'config' ? '(config)#' : '#'}` };
    }

    // Workstation / Server CLI
    if (d.type === 'pc' || d.type === 'server') {
      if (lower === 'ipconfig' || lower === 'ipconfig /all') {
        const c = this.sim.getIp(deviceId);
        return {
          text: `CyberLab IP Configuration\n\nEthernet adapter Eth0:\n  Connection-specific DNS Suffix  . : cyberlab.local\n  Link-local IPv6 Address . . . . . : fe80::${d.mac.replace(/:/g, '')}%4\n  IPv4 Address. . . . . . . . . . . : ${c.ip}\n  Subnet Mask . . . . . . . . . . . : ${c.mask}\n  Default Gateway . . . . . . . . . : ${c.gateway || '—'}\n  Physical MAC Address. . . . . . . : ${d.mac}\n  DHCP Enabled. . . . . . . . . . . : ${c.ip.startsWith('192.168.10.100') ? 'Yes' : 'No'}`
        };
      }
      if (lower.startsWith('ping ')) {
        const target = cmd.split(/\s+/)[1];
        const r = this.sim.ping(deviceId, target);
        if (r.ok) {
          return {
            text: `Pinging ${target} with 32 bytes of data:\nReply from ${target}: bytes=32 time<1ms TTL=64\nReply from ${target}: bytes=32 time<1ms TTL=64\nReply from ${target}: bytes=32 time<1ms TTL=64\nReply from ${target}: bytes=32 time<1ms TTL=64\n\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = 0ms, Maximum = 1ms, Average = 0ms`,
            packet: r.packet,
            ok: true
          };
        }
        return { text: `Pinging ${target} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\n\nDiagnostic: ${r.reason}` };
      }
      if (lower === 'arp -a') {
        const arps = this.sim.arpTables[deviceId] || [];
        if (!arps.length) return { text: 'Interface: 192.168.10.10 --- 0x1\nNo ARP entries found in cache.' };
        return {
          text: `Interface: ${this.sim.getIp(deviceId).ip} --- 0x1\n  Internet Address      Physical Address      Type\n` +
            arps.map(a => `  ${a.ip.padEnd(20)}  ${a.mac.padEnd(20)}  dynamic`).join('\n')
        };
      }
      if (lower.startsWith('nslookup ')) {
        const name = cmd.split(/\s+/)[1];
        let found = null;
        for (const srv in this.sim.dnsRecords) {
          const rec = this.sim.dnsRecords[srv].find(r => r.name.toLowerCase() === name.toLowerCase());
          if (rec) found = rec.value;
        }
        if (found) {
          return { text: `Server:   ns1.cyberlab.local\nAddress:  192.168.10.20\n\nName:     ${name}\nAddress:  ${found}` };
        }
        return { text: `Server:   ns1.cyberlab.local\nAddress:  192.168.10.20\n\n*** ns1.cyberlab.local can't find ${name}: Non-existent domain` };
      }
      if (lower.startsWith('traceroute ') || lower.startsWith('tracert ')) {
        const target = cmd.split(/\s+/)[1];
        const r = this.sim.ping(deviceId, target);
        if (r.ok) {
          return {
            text: `Tracing route to ${target} over a maximum of 30 hops:\n` +
              r.path.map((p, i) => `  ${i + 1}    <1 ms    <1 ms    <1 ms  ${this.sim.getIp(p).ip || p} [${this.sim.getDevice(p)?.name}]`).join('\n') +
              `\n\nTrace complete.`
          };
        }
        return { text: `Tracing route to ${target} over a maximum of 30 hops:\n  1    *        *        *     Request timed out.\nDestination host unreachable.` };
      }
      if (lower === 'ipconfig /renew' || lower === 'ip dhcp renew') {
        const dhcpSrv = Object.keys(this.sim.dhcpPools)[0];
        if (dhcpSrv) {
          const pool = this.sim.dhcpPools[dhcpSrv];
          const assignedIp = pool.range[0];
          this.sim.setIp(deviceId, assignedIp, pool.mask, pool.gateway);
          return {
            text: `DHCP 4-Way DORA Handshake Succeeded:\n  [1] DHCP DISCOVER -> Broadcast (255.255.255.255:67)\n  [2] DHCP OFFER    <- ${pool.gateway} (Offered: ${assignedIp})\n  [3] DHCP REQUEST  -> Requested: ${assignedIp}\n  [4] DHCP ACK      <- Lease Granted (86400s)\n\nEthernet adapter Eth0:\n  IPv4 Address. . . . . . . . . . . : ${assignedIp}\n  Subnet Mask . . . . . . . . . . . : ${pool.mask}\n  Default Gateway . . . . . . . . . : ${pool.gateway}\n  DNS Server. . . . . . . . . . . . : ${pool.dns}`
          };
        }
        return { text: 'DHCP request timed out. No DHCP server responded on this broadcast domain.' };
      }
    }

    // Switch Cisco IOS CLI
    if (d.type === 'switch') {
      if (st.mode === 'exec') {
        if (lower === 'show mac address-table' || lower === 'show mac-address-table') {
          const macs = this.sim.macTables[deviceId] || [];
          return {
            text: `          Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n` +
              (macs.length
                ? macs.map(m => `   ${String(m.vlan).padEnd(4)} ${m.mac}    ${m.type.padEnd(10)}  ${m.port}`).join('\n')
                : `   1    ${d.mac}    STATIC      CPU\nTotal Mac Addresses for this criterion: 1`)
          };
        }
        if (lower === 'show vlan brief' || lower === 'show vlan') {
          const vlans = this.sim.vlans[deviceId] || [{ id: 1, name: 'default' }];
          return {
            text: `VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n` +
              vlans.map(v => `${String(v.id).padEnd(4)} ${v.name.padEnd(32)} active    Gi0/1, Gi0/2, Gi0/3, Gi0/4`).join('\n')
          };
        }
        if (lower === 'show interfaces status') {
          const cat = DEVICE_CATALOG['switch'];
          return {
            text: `Port      Name               Status       Vlan       Duplex  Speed Type\n` +
              cat.ports.filter(p => p.type === 'ethernet').map(p => {
                const up = !!this.sim.linkFor(deviceId, p.id);
                const stp = this.sim.portConfig[`${deviceId}:${p.id}`]?.stpState || 'forwarding';
                return `${p.label.padEnd(9)} ${up ? (stp === 'blocking' ? 'STP-BLK' : 'connected') : 'notconnect'}   ${up ? 'up' : 'down'}          1          a-full  a-1000 1000BaseTX`;
              }).join('\n')
          };
        }
        if (lower === 'show running-config' || lower === 'sh run') return { text: this.getRunningConfig(deviceId) };
      }
      if (st.mode === 'config') {
        if (lower.startsWith('vlan ')) {
          const vid = parseInt(lower.split(' ')[1]);
          if (!isNaN(vid)) {
            this.sim.vlans[deviceId] = this.sim.vlans[deviceId] || [];
            if (!this.sim.vlans[deviceId].find(v => v.id === vid)) {
              this.sim.vlans[deviceId].push({ id: vid, name: `VLAN${String(vid).padStart(4, '0')}` });
            }
            return { text: `${d.name}(config-vlan)#` };
          }
        }
      }
    }

    // Router & Firewall Cisco IOS CLI
    if (d.type === 'router' || d.type === 'firewall') {
      if (st.mode === 'exec') {
        if (lower === 'show ip route') {
          const routes = this.sim.routingTables[deviceId] || [];
          return {
            text: `Codes: C - connected, S - static, R - RIP, O - OSPF, B - BGP\nGateway of last resort is not set\n\n` +
              (routes.length
                ? routes.map(r => `${r.type}    ${r.network} [${r.mask}] is directly connected, ${r.interface}`).join('\n')
                : `C    192.168.10.0/24 is directly connected, GigabitEthernet0/0\nC    192.168.20.0/24 is directly connected, GigabitEthernet0/1`)
          };
        }
        if (lower === 'show ip interface brief') {
          const cat = DEVICE_CATALOG[d.type];
          return {
            text: `Interface              IP-Address      OK? Method Status                Protocol\n` +
              cat.ports.filter(p => p.type === 'ethernet').map(p => {
                const ip = this.sim.getIp(`${deviceId}:${p.id}`).ip;
                const up = this.sim.linkFor(deviceId, p.id) ? 'up' : 'down';
                return `${p.label.padEnd(22)} ${(ip === 'Not configured' ? 'unassigned' : ip).padEnd(15)} YES manual ${up.padEnd(21)} ${up}`;
              }).join('\n')
          };
        }
        if (lower.startsWith('ping ')) {
          const target = cmd.split(/\s+/)[1];
          const r = this.sim.ping(deviceId, target);
          if (r.ok) {
            return {
              text: `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/1/1 ms`,
              packet: r.packet,
              ok: true
            };
          }
          return { text: `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)` };
        }
      }
    }

    if (lower === 'show running-config' || lower === 'sh run') return { text: this.getRunningConfig(deviceId) };

    return { text: `% '${cmd}' is not available in this lesson yet.\nType 'help' or '?' to see valid commands for ${d.name}.` };
  }

  getRunningConfig(deviceId) {
    const d = this.sim.getDevice(deviceId);
    const cat = DEVICE_CATALOG[d.type];
    let out = `! CyberLab Enterprise Running Configuration\n! Last configuration change at 14:22:01 UTC\nversion 15.7\nservice timestamps log datetime msec\n!\nhostname ${d.name}\n!\n`;
    if (d.type === 'switch') {
      for (const v of this.sim.vlans[deviceId] || []) {
        if (v.id !== 1) out += `vlan ${v.id}\n name ${v.name}\n!\n`;
      }
    }
    for (const p of cat.ports) {
      if (p.type !== 'ethernet') continue;
      out += `interface ${p.label}\n`;
      const pk = `${deviceId}:${p.id.toLowerCase()}`;
      if (d.type === 'router' || d.type === 'firewall') {
        const ip = this.sim.getIp(pk).ip;
        if (ip !== 'Not configured') out += ` ip address ${ip} ${this.sim.getIp(pk).mask}\n`;
        else out += ` no ip address\n`;
      }
      out += ` ${this.sim.linkFor(deviceId, p.id) ? 'no shutdown' : 'shutdown'}\n!\n`;
    }
    out += `ip forward-protocol nd\n!\nline con 0\n logging synchronous\nline vty 0 4\n login\n!\nend`;
    return out;
  }

  helpFor(type) {
    const base = ['help / ?                  Show this command reference guide', 'show running-config       Display the active running configuration'];
    if (type === 'pc' || type === 'server') {
      base.push(
        'ipconfig                   Display full IPv4 & MAC configuration',
        'ipconfig /renew            Initiate DHCP 4-Way DORA handshake',
        'ping <IPv4 | FQDN>         Test Layer 3 ICMP reachability',
        'arp -a                     Display local ARP cache table',
        'nslookup <hostname>        Query DNS server for A-Records',
        'traceroute <IPv4>          Trace multi-hop path to destination'
      );
    }
    if (type === 'switch') {
      base.push(
        'show interfaces status     Display physical link state and speed',
        'show mac address-table     Display CAM MAC address learning table',
        'show vlan brief            Display active 802.1Q Virtual LANs',
        'configure terminal         Enter global configuration mode'
      );
    }
    if (type === 'router' || type === 'firewall') {
      base.push(
        'show ip interface brief    Display interface IP and Layer 1/2 status',
        'show ip route              Display Layer 3 IP routing table',
        'ping <IPv4>                Send ICMP Echo packets across subnets',
        'configure terminal         Enter global configuration mode'
      );
    }
    return base.join('\n');
  }
}
