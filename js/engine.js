import {DEVICE_CATALOG} from './data.js';

function hashToMac(id) {
    let h = 0; for (let i=0; i<id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
    const hex = (h>>>0).toString(16).padStart(8, '0');
    return `00:1a:2b:${hex.slice(0,2)}:${hex.slice(2,4)}:${hex.slice(4,6)}`;
}

export class SimulationEngine{
  constructor(){this.reset();}
  reset(){
    this.devices=[];
    this.links=[];
    this.events=[];
    this.ipConfig={};
    this.macTables={};
    this.vlans={};
    this.routingTables={};
    this.arpTables={};
    this.dhcpPools={};
    this.dnsRecords={};
    this.portConfig={};
    this.seq=1;
  }
  addDevice(type,x,y,label){
    const base=DEVICE_CATALOG[type];
    if(!base)throw new Error('Unknown device');
    const id=`${type}-${this.seq++}`;
    const device={id,type,name:label||`${base.short}-${this.seq-1}`,x,y,power:true, mac:hashToMac(id)};
    this.devices.push(device);
    if(type==='switch') {
        this.macTables[id] = [];
        this.vlans[id] = [{id:1, name:'default'}];
    }
    if(type==='router'||type==='firewall') {
        this.routingTables[id] = [];
    }
    this.arpTables[id] = [];
    return device;
  }
  getDevice(id){return this.devices.find(d=>d.id===id)}
  getPorts(deviceId){const d=this.getDevice(deviceId);return d?DEVICE_CATALOG[d.type].ports:[]}
  portKey(deviceId,portId){return `${deviceId}:${portId}`}
  linkFor(deviceId,portId){const key=this.portKey(deviceId,portId);return this.links.find(l=>l.a===key||l.b===key)}
  connect(aDevice,aPort,bDevice,bPort,cable='rj45'){
    if(aDevice===bDevice&&aPort===bPort)return {ok:false,message:'A cable needs two different interfaces.'};
    const ap=this.getPorts(aDevice).find(p=>p.id===aPort),bp=this.getPorts(bDevice).find(p=>p.id===bPort);if(!ap||!bp)return {ok:false,message:'That interface does not exist.'};
    const needed=cable==='console'?'console':'ethernet';
    if(ap.type!==needed||bp.type!==needed)return {ok:false,message:`${cable==='console'?'Console':'RJ45'} cable is not compatible with one of those ports.`};
    if(this.linkFor(aDevice,aPort)||this.linkFor(bDevice,bPort))return {ok:false,message:'One of those ports already has a cable.'};
    const link={id:`link-${Date.now()}-${Math.random().toString(16).slice(2)}`,a:this.portKey(aDevice,aPort),b:this.portKey(bDevice,bPort),cable,up:true};
    this.links.push(link);this.log('link',{link});return {ok:true,link};
  }
  disconnect(linkId){this.links=this.links.filter(l=>l.id!==linkId);this.log('unlink',{linkId})}
  setPosition(id,x,y){const d=this.getDevice(id);if(d){d.x=x;d.y=y}}
  
  setIp(id,ip,mask='255.255.255.0',gateway=''){
    this.ipConfig[id]={ip,mask,gateway};
    this.log('ip',{id,ip,mask,gateway});
    
    // Auto-add connected route for routers
    const [devId, portId] = id.split(':');
    const d = this.getDevice(devId);
    if (d && (d.type==='router'||d.type==='firewall') && portId) {
        const net = this.getNetwork(ip, mask);
        if (net) {
            this.routingTables[devId] = this.routingTables[devId].filter(r => r.interface !== portId);
            this.routingTables[devId].push({network: net, mask, nextHop: '0.0.0.0', interface: portId, type: 'C'});
        }
    }
    return {ok:true};
  }
  
  getIp(id){return this.ipConfig[id]||{ip:'Not configured',mask:'—',gateway:'—'}}
  neighbors(id){
    const out=[];
    for(const link of this.links){
      const [ad]=link.a.split(':'),[bd]=link.b.split(':');
      if(ad===id)out.push(bd);
      if(bd===id)out.push(ad);
    }
    return out;
  }
  pathBetween(src,dst){
    const q=[[src,[src]]],seen=new Set([src]);
    while(q.length){
      const [n,path]=q.shift();
      if(n===dst)return path;
      for(const nei of this.neighbors(n)){
        if(!seen.has(nei)){seen.add(nei);q.push([nei,[...path,nei]])}
      }
    }
    return null;
  }
  findByIp(ip){
    const entry = Object.entries(this.ipConfig).find(([,c])=>c.ip===ip);
    if (!entry) return undefined;
    return entry[0].split(':')[0];
  }
  
  ipToInt(ip){const parts=String(ip).trim().split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return null;return (((parts[0]<<24)>>>0)+(parts[1]<<16)+(parts[2]<<8)+parts[3])>>>0}
  maskToInt(mask){return this.ipToInt(mask)}
  intToIp(int){return `${(int>>>24)&255}.${(int>>>16)&255}.${(int>>>8)&255}.${int&255}`}
  validMask(mask){const m=this.maskToInt(mask);if(m===null)return false;const inv=(~m)>>>0;return (inv & (inv+1))===0}
  sameSubnet(a,b,maskA='255.255.255.0',maskB=maskA){const A=this.ipToInt(a),B=this.ipToInt(b),MA=this.maskToInt(maskA),MB=this.maskToInt(maskB);if(A===null||B===null||MA===null||MB===null||!this.validMask(maskA)||!this.validMask(maskB))return false;return ((A&MA)>>>0)===((B&MA)>>>0)&&((A&MB)>>>0)===((B&MB)>>>0)}
  getNetwork(ip, mask) {
    const A = this.ipToInt(ip), M = this.maskToInt(mask);
    if (A === null || M === null) return null;
    return this.intToIp((A & M) >>> 0);
  }

  ping(srcId,target){
    let targetIp = target;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
        let found = false;
        for (const srv in this.dnsRecords) {
            const rec = this.dnsRecords[srv].find(r => r.name === target);
            if (rec) { targetIp = rec.value; found = true; break; }
        }
        if (!found) return {ok:false, reason:`Ping request could not find host ${target}. Please check the name and try again.`};
    }
    
    const srcIpConf = this.getIp(srcId);
    if (srcIpConf.ip === 'Not configured') return {ok:false, reason:'Source has no IP address.'};
    
    const dstId = this.findByIp(targetIp);
    if (!dstId) return {ok:false, reason:'No device in the lab currently owns that IP address.'};
    
    const path = this.pathBetween(srcId, dstId);
    if (!path) return {ok:false, reason:'No physical path exists between the devices.'};

    const dstIpConf = this.getIp(dstId) || this.getIp(`${dstId}:eth0`) || this.getIp(`${dstId}:g0/0`);
    const sameSub = this.sameSubnet(srcIpConf.ip, targetIp, srcIpConf.mask, dstIpConf.mask || srcIpConf.mask);
    
    let needsRouter = !sameSub;
    let hasRouter = false;
    let vlanViolated = false;
    
    for (let i = 0; i < path.length; i++) {
        const devId = path[i];
        const dev = this.getDevice(devId);
        if (dev.type === 'router' || dev.type === 'firewall') hasRouter = true;
        
        if (dev.type === 'switch' && i > 0 && i < path.length - 1) {
            const inLink = this.links.find(l => (l.a.startsWith(path[i-1]+':') && l.b.startsWith(devId+':')) || (l.b.startsWith(path[i-1]+':') && l.a.startsWith(devId+':')));
            const outLink = this.links.find(l => (l.a.startsWith(path[i+1]+':') && l.b.startsWith(devId+':')) || (l.b.startsWith(path[i+1]+':') && l.a.startsWith(devId+':')));
            if (inLink && outLink) {
                const inPort = inLink.a.startsWith(devId+':') ? inLink.a : inLink.b;
                const outPort = outLink.a.startsWith(devId+':') ? outLink.a : outLink.b;
                const inVlan = this.portConfig[inPort]?.vlan || 1;
                const outVlan = this.portConfig[outPort]?.vlan || 1;
                if (inVlan !== outVlan) vlanViolated = true;
            }
        }
    }
    
    if (vlanViolated && !hasRouter) return {ok: false, reason: 'Destination host unreachable. VLAN isolation.'};
    
    if (needsRouter) {
        if (!srcIpConf.gateway || srcIpConf.gateway === '—') return {ok:false, reason:'Destination host unreachable. No default gateway.'};
        const gwId = this.findByIp(srcIpConf.gateway);
        if (!gwId) return {ok:false, reason:'Default gateway unreachable.'};
        if (!hasRouter) return {ok:false, reason:'Destination host unreachable. Cannot reach gateway.'};
        
        const routerDev = path.find(id => this.getDevice(id).type === 'router' || this.getDevice(id).type === 'firewall');
        if (routerDev) {
            const route = this.routingTables[routerDev]?.find(r => this.sameSubnet(targetIp, r.network, r.mask, r.mask));
            if (!route) return {ok:false, reason:'Destination net unreachable. No route.'};
        }
    }

    this.arpTables[srcId] = this.arpTables[srcId] || [];
    if (!this.arpTables[srcId].find(a=>a.ip===targetIp)) {
        this.arpTables[srcId].push({ip:targetIp, mac:this.getDevice(dstId).mac, interface:'eth0'});
    }
    
    for (let i = 1; i < path.length - 1; i++) {
        const dev = this.getDevice(path[i]);
        if (dev.type === 'switch') {
            this.macTables[dev.id] = this.macTables[dev.id] || [];
            const srcMac = this.getDevice(srcId).mac;
            if (!this.macTables[dev.id].find(m=>m.mac===srcMac)) {
                this.macTables[dev.id].push({mac: srcMac, port: 'gi0/1', vlan: 1}); // simplified port
            }
        }
    }

    this.log('packet',{srcId,dstId,path,targetIp});
    return {ok:true,path,dstId};
  }
  
  log(type,data){this.events.push({type,data,ts:Date.now()});if(this.events.length>100)this.events.shift()}
  snapshot(){return {devices:this.devices,links:this.links,ipConfig:this.ipConfig,events:this.events.slice(-30)}}
}

export class CLIEngine {
  constructor(sim) {
    this.sim = sim;
    this.history = [];
    this.modes = {}; 
  }

  getMode(deviceId) {
    if (!this.modes[deviceId]) this.modes[deviceId] = {mode: 'exec', context: ''};
    return this.modes[deviceId];
  }

  execute(deviceId, input) {
    const cmd = input.trim();
    if (!cmd) return {text: ''};
    const lower = cmd.toLowerCase();
    const d = this.sim.getDevice(deviceId);
    if (!d) return {text: 'Select a device first.'};

    this.history.push({deviceId, cmd, ts: Date.now()});
    let st = this.getMode(deviceId);

    if (lower === 'help' || lower === '?') return {text: this.helpFor(d.type)};
    
    if (st.mode === 'exec' && lower === 'configure terminal' && (d.type === 'switch' || d.type === 'router' || d.type === 'firewall')) {
        st.mode = 'config';
        return {text: ''};
    }
    if ((st.mode === 'config' || st.mode === 'config-if') && (lower === 'exit' || lower === 'end')) {
        st.mode = st.mode === 'config-if' && lower === 'exit' ? 'config' : 'exec';
        st.context = '';
        return {text: ''};
    }

    if (d.type === 'pc' || d.type === 'server') {
        if (lower === 'ipconfig' || lower === 'ipconfig /all') {
            const c = this.sim.getIp(deviceId);
            return {text: `Ethernet adapter Eth0\n\n  IPv4 Address . . . . . . : ${c.ip}\n  Subnet Mask  . . . . . . : ${c.mask}\n  Default Gateway . . . . : ${c.gateway||'—'}`};
        }
        if (lower.startsWith('ping ')) {
            const target = cmd.split(/\s+/)[1];
            const r = this.sim.ping(deviceId, target);
            return r.ok ? {text: `Pinging ${target} with 32 bytes of data:\nReply from ${target}: bytes=32 time<1ms TTL=64\nReply from ${target}: bytes=32 time<1ms TTL=64\n\nPackets: Sent = 2, Received = 2, Lost = 0`, packet: r} : {text: `Pinging ${target}...\n${r.reason}`};
        }
        if (lower === 'arp -a') {
            const arps = this.sim.arpTables[deviceId] || [];
            if (!arps.length) return {text: 'No ARP entries found.'};
            return {text: `Interface: ${this.sim.getIp(deviceId).ip} --- 0x1\n  Internet Address      Physical Address      Type\n` + arps.map(a => `  ${a.ip.padEnd(20)}  ${a.mac}     dynamic`).join('\n')};
        }
        if (lower.startsWith('nslookup ')) {
            const name = cmd.split(/\s+/)[1];
            let found = null;
            for (const srv in this.sim.dnsRecords) {
                const rec = this.sim.dnsRecords[srv].find(r => r.name === name);
                if (rec) found = rec.value;
            }
            if (found) return {text: `Server:  UnKnown\nAddress:  192.168.1.1\n\nName:    ${name}\nAddress:  ${found}`};
            return {text: `*** UnKnown can't find ${name}: Non-existent domain`};
        }
        if (lower.startsWith('traceroute ') || lower.startsWith('tracert ')) {
            const target = cmd.split(/\s+/)[1];
            const r = this.sim.ping(deviceId, target);
            if (r.ok) {
                return {text: `Tracing route to ${target} over a maximum of 30 hops:\n` + r.path.map((p, i) => `  ${i+1}    <1 ms    <1 ms    <1 ms  ${this.sim.getIp(p).ip || p}`).join('\n') + `\n\nTrace complete.`};
            }
            return {text: `Tracing route to ${target}...\nDestination host unreachable.`};
        }
        if (lower === 'ip dhcp renew' || lower === 'ipconfig /renew') {
            const dhcpSrv = Object.keys(this.sim.dhcpPools)[0];
            if (dhcpSrv) {
                const pool = this.sim.dhcpPools[dhcpSrv];
                const ip = pool.range[0]; 
                this.sim.setIp(deviceId, ip, pool.mask, pool.gateway);
                this.sim.log('dhcp', {deviceId, type: 'DORA'});
                return {text: `Ethernet adapter Eth0:\n\n  IPv4 Address . . . . . . : ${ip}\n  Subnet Mask  . . . . . . : ${pool.mask}\n  Default Gateway . . . . : ${pool.gateway}`};
            }
            return {text: 'DHCP request timed out.'};
        }
    }

    if (d.type === 'switch') {
        if (st.mode === 'exec') {
            if (lower === 'show mac address-table' || lower === 'show mac-address-table') {
                const macs = this.sim.macTables[deviceId] || [];
                return {text: `Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----\n` + macs.map(m => ` ${m.vlan.toString().padEnd(6)} ${m.mac}    DYNAMIC     ${m.port}`).join('\n')};
            }
            if (lower === 'show vlan brief') {
                const vlans = this.sim.vlans[deviceId] || [{id:1, name:'default'}];
                return {text: 'VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n' + vlans.map(v => `${v.id.toString().padEnd(4)} ${v.name.padEnd(32)} active`).join('\n')};
            }
            if (lower === 'show interfaces status') {
                const cat = DEVICE_CATALOG['switch'];
                return {text: cat.ports.filter(p=>p.type==='ethernet').map(p=>`${p.label.padEnd(8)} ${(this.sim.linkFor(deviceId,p.id)?'connected':'notconnect').padEnd(12)} ${this.sim.portConfig[`${deviceId}:${p.id}`]?.vlan||'1'}      auto   auto  10/100/1000BaseTX`).join('\n')};
            }
            if (lower === 'show running-config') return {text: this.getRunningConfig(deviceId)};
        }
        if (st.mode === 'config') {
            if (lower.startsWith('vlan ')) {
                const vid = parseInt(lower.split(' ')[1]);
                if (!this.sim.vlans[deviceId].find(v=>v.id===vid)) this.sim.vlans[deviceId].push({id:vid, name:`VLAN${vid.toString().padStart(4,'0')}`});
                return {text: ''};
            }
            if (lower.startsWith('name ') && this.history[this.history.length-2]?.cmd.toLowerCase().startsWith('vlan ')) {
                const name = lower.split(' ')[1];
                const vid = parseInt(this.history[this.history.length-2].cmd.split(' ')[1]);
                const v = this.sim.vlans[deviceId].find(v=>v.id===vid);
                if (v) v.name = name;
                return {text: ''};
            }
            if (lower.startsWith('interface ')) {
                st.mode = 'config-if';
                st.context = lower.split(' ')[1];
                return {text: ''};
            }
        }
        if (st.mode === 'config-if') {
            const portKey = `${deviceId}:${st.context.toLowerCase()}`;
            if (!this.sim.portConfig[portKey]) this.sim.portConfig[portKey] = {};
            if (lower === 'switchport mode access') {
                this.sim.portConfig[portKey].mode = 'access';
                return {text: ''};
            }
            if (lower.startsWith('switchport access vlan ')) {
                this.sim.portConfig[portKey].vlan = parseInt(lower.split(' ')[3]);
                return {text: ''};
            }
        }
    }

    if (d.type === 'router' || d.type === 'firewall') {
        if (st.mode === 'exec') {
            if (lower === 'show ip route') {
                const routes = this.sim.routingTables[deviceId] || [];
                return {text: `Codes: C - connected, S - static\n\nGateway of last resort is not set\n\n` + routes.map(r => `${r.type}    ${r.network} [${r.mask}] via ${r.nextHop}, ${r.interface}`).join('\n')};
            }
            if (lower === 'show ip interface brief') {
                const cat = DEVICE_CATALOG[d.type];
                return {text: `Interface              IP-Address      OK? Method Status                Protocol\n` + cat.ports.filter(p=>p.type==='ethernet').map(p=>{
                    const ip = this.sim.getIp(`${deviceId}:${p.id}`).ip;
                    const up = this.sim.linkFor(deviceId,p.id) ? 'up' : 'down';
                    return `${p.label.padEnd(22)} ${(ip==='Not configured'?'unassigned':ip).padEnd(15)} YES manual ${up.padEnd(21)} ${up}`;
                }).join('\n')};
            }
            if (lower === 'show running-config') return {text: this.getRunningConfig(deviceId)};
            if (lower.startsWith('ping ')) {
                const target = cmd.split(/\s+/)[1];
                const r = this.sim.ping(deviceId, target);
                return r.ok ? {text: `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/1/1 ms`, packet: r} : {text: `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)`};
            }
        }
        if (st.mode === 'config') {
            if (lower.startsWith('ip route ')) {
                const parts = lower.split(' ');
                const net = parts[2], mask = parts[3], nexthop = parts[4];
                this.sim.routingTables[deviceId].push({network: net, mask, nextHop: nexthop, interface: '', type: 'S'});
                return {text: ''};
            }
            if (lower.startsWith('interface ')) {
                st.mode = 'config-if';
                st.context = lower.split(' ')[1];
                return {text: ''};
            }
        }
        if (st.mode === 'config-if') {
            const portKey = `${deviceId}:${st.context.toLowerCase()}`;
            if (lower.startsWith('ip address ')) {
                const parts = lower.split(' ');
                this.sim.setIp(portKey, parts[2], parts[3]);
                return {text: ''};
            }
            if (lower === 'no shutdown') {
                return {text: `%LINK-3-UPDOWN: Interface ${st.context}, changed state to up\n`};
            }
        }
    }

    if (lower === 'show running-config') return {text: this.getRunningConfig(deviceId)};

    return {text: `% Invalid input detected at '^' marker.`};
  }

  getRunningConfig(deviceId) {
      const d = this.sim.getDevice(deviceId);
      const cat = DEVICE_CATALOG[d.type];
      let out = `! CyberLab educational configuration\nhostname ${d.name}\n!\n`;
      if (d.type === 'switch') {
          for (const v of this.sim.vlans[deviceId]||[]) {
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
          } else if (d.type === 'switch') {
              const conf = this.sim.portConfig[pk];
              if (conf && conf.mode) out += ` switchport mode ${conf.mode}\n`;
              if (conf && conf.vlan) out += ` switchport access vlan ${conf.vlan}\n`;
          }
          out += ` ${this.sim.linkFor(deviceId, p.id)?'no shutdown':'shutdown'}\n!\n`;
      }
      out += `end`;
      return out;
  }

  helpFor(type) {
    const base = ['help / ?                  Show this command guide', 'show running-config       View a simplified running configuration'];
    if (type === 'pc' || type === 'server') {
        base.push('ipconfig                   View IPv4 settings', 'ipconfig /renew            Request DHCP address', 'ping <IPv4>                Test IP connectivity', 'arp -a                     View ARP cache', 'nslookup <name>            Query DNS server', 'traceroute <ip>            Trace path to destination');
    }
    if (type === 'switch') {
        base.push('show interfaces status     Check switch port link state', 'show vlan brief            View VLANs', 'show mac address-table     View MAC table', 'configure terminal         Enter configuration mode');
    }
    if (type === 'router' || type === 'firewall') {
        base.push('show ip interface brief    Check routed interfaces', 'show ip route              View routing table', 'ping <ip>                  Test IP connectivity', 'configure terminal         Enter configuration mode');
    }
    return base.join('\n');
  }
}
