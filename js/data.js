export const RANKS=[
  [0,'New Explorer'],
  [250,'Cable Rookie'],
  [600,'LAN Builder'],
  [1050,'Switching Scout'],
  [1600,'Routing Apprentice'],
  [2300,'Network Technician'],
  [3100,'Network Administrator'],
  [4100,'Infrastructure Architect']
];

export const DEVICE_CATALOG={
  pc:{
    id:'pc',
    name:'Enterprise Workstation PC',
    short:'PC',
    icon:'🖥️',
    category:'Host Endpoint',
    layer:'Layers 1–7 (Application to Physical)',
    definition:'An end-user workstation running network applications. Generates Layer 7 data, encapsulates it into TCP/IP packets, and transmits Layer 2 Ethernet frames onto the local area network.',
    specs:{
      'Form Factor':'Minitower Desktop Workstation',
      'NIC':'1 × Intel I219-LM 1000BASE-T Gigabit Ethernet',
      'MAC Address':'00:1A:2B:XX:XX:XX (Locally Administered)',
      'IP Stack':'IPv4 / IPv6 Dual Stack',
      'Power Supply':'300W 80-Plus Gold Active PFC',
      'OS':'CyberLab Enterprise Linux / Workstation',
      'Role':'End-user Host & Network Client'
    },
    hotspots:[
      {name:'Intel Gigabit NIC Port',desc:'10/100/1000BASE-T RJ45 jack with integrated magnetics and Dual Link/Activity LEDs.'},
      {name:'Power Supply Rocker Switch',desc:'AC mains I/O isolation switch for the 300W internal power supply.'},
      {name:'Motherboard I/O Shield',desc:'Houses display outputs (DisplayPort/HDMI), USB 3.2 Gen 2 ports, and HD audio.'},
      {name:'Chassis Cooling Exhaust Fan',desc:'92mm PWM variable-speed cooling fan expelling warm air from the CPU heatsink.'}
    ],
    ports:[
      {id:'eth0',label:'Eth0',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'Integrated Gigabit Ethernet Network Interface'}
    ]
  },
  switch:{
    id:'switch',
    name:'24-Port Gigabit Managed Access Switch',
    short:'Switch',
    icon:'▤',
    category:'Layer 2 Infrastructure',
    layer:'Layer 2 (Data Link)',
    definition:'An enterprise 1U Layer 2 switch connecting LAN endpoints. Features 24 Gigabit RJ45 ports, 2 SFP+ 10G uplinks, a CAM table for dedicated collision-free microsegmentation, and dual hot-swappable power supplies.',
    specs:{
      'Form Factor':'1U 19-Inch Rackmount Steel Chassis',
      'Ports':'24 × 10/100/1000BASE-T + 2 × 10G SFP+ Optical Cages',
      'Switching Capacity':'128 Gbps Non-Blocking Wire-Speed Fabric',
      'Forwarding Rate':'95.2 Mpps Hardware Forwarding',
      'MAC Table Size':'16,000 Entries (CAM Memory)',
      'VLAN Support':'IEEE 802.1Q (Up to 4094 VLAN IDs)',
      'Spanning Tree':'IEEE 802.1w Rapid Spanning Tree Protocol (RSTP)',
      'Power Supplies':'Dual Hot-Swappable 350W Redundant AC PSUs',
      'Cooling':'3 × Variable-Speed Redundant Fan Modules (Front-to-Back Airflow)'
    },
    hotspots:[
      {name:'Port Block 1–12 (Bank 1)',desc:'12 × Gold-plated 8P8C RJ45 jacks with integrated pulse transformers and dual Link/Act LEDs.'},
      {name:'Port Block 13–24 (Bank 2)',desc:'12 × High-density Gigabit Ethernet ports supporting 802.3at PoE+ power delivery.'},
      {name:'10G SFP+ Transceiver Cages',desc:'Dual Small Form-factor Pluggable cages for 10 Gigabit multi-mode/single-mode fiber optic uplinks.'},
      {name:'Mode Select Button & LED Matrix',desc:'Toggles port LED display between STAT (Link/Activity), SPEED (10/100/1000), DUPLEX, and PoE power.'},
      {name:'RJ45 Serial Console Port',desc:'RS-232 serial management port (9600-8-N-1) for out-of-band CLI configuration.'},
      {name:'Dual Hot-Swap Power Supplies (Rear)',desc:'350W 1+1 redundant AC power modules with locking extraction levers and status LEDs.'},
      {name:'Redundant Exhaust Fan Tray (Rear)',desc:'Three 40mm brushless fans providing front-to-back chassis cooling.'}
    ],
    ports:[
      ...Array.from({length:8},(_,i)=>({id:`gi0/${i+1}`,label:`Gi0/${i+1}`,type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:`Gigabit Ethernet Access/Trunk Port ${i+1}`})),
      {id:'console',label:'Console',type:'console',speed:'9600 baud',connector:'RJ45/Serial',desc:'Out-of-Band RS-232 Serial Management Console'}
    ]
  },
  router:{
    id:'router',
    name:'Modular Enterprise Edge Router',
    short:'Router',
    icon:'◈',
    category:'Layer 3 Infrastructure',
    layer:'Layer 3 (Network)',
    definition:'A 1U modular Layer 3 edge router that connects distinct IP subnets and WANs. Features hardware-accelerated routing, dynamic routing protocols (OSPF/BGP), and modular Network Interface Module (NIM) expansion slots.',
    specs:{
      'Form Factor':'1U 19-Inch Rackmount Metal Chassis',
      'Interfaces':'4 × Routed GigabitEthernet (G0/0 to G0/3)',
      'Expansion':'2 × Network Interface Module (NIM) Slots with Thumbscrews',
      'Forwarding Rate':'1.5 Mpps Hardware-Accelerated Routing',
      'Routing Protocols':'Static, Connected, OSPFv2 (Area 0), BGP, RIPv2',
      'NAT / PAT':'Stateful Port Address Translation (NAT Overload)',
      'Management':'RJ45 Console + AUX Port + Dedicated Gigabit MGMT Interface',
      'Power':'Internal Universal AC Power Supply (100–240V)'
    },
    hotspots:[
      {name:'GigabitEthernet 0/0 (LAN Gateway)',desc:'Primary routed Layer 3 interface acting as the Default Gateway for the local subnet.'},
      {name:'GigabitEthernet 0/1 (WAN Interface)',desc:'Public-facing routed interface with NAT Overload enabled for Internet connectivity.'},
      {name:'NIM Expansion Slot 0 & 1',desc:'Removable blank metal faceplates with captive thumbscrews for T1/E1, Serial, or 4G LTE modules.'},
      {name:'System / RPS Status LEDs',desc:'Multicolor LEDs indicating Power, System Boot State, and Redundant Power Supply status.'},
      {name:'Grounding Lug & Rocker Switch (Rear)',desc:'Dual-hole chassis ground lug and main AC power toggle switch.'}
    ],
    ports:[
      {id:'g0/0',label:'G0/0',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'GigabitEthernet 0/0 (LAN Gateway Interface)'},
      {id:'g0/1',label:'G0/1',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'GigabitEthernet 0/1 (WAN / Remote Interface)'},
      {id:'g0/2',label:'G0/2',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'GigabitEthernet 0/2 (DMZ / Branch Interface)'},
      {id:'g0/3',label:'G0/3',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'GigabitEthernet 0/3 (Auxiliary Routed Interface)'},
      {id:'console',label:'Console',type:'console',speed:'9600 baud',connector:'RJ45/Serial',desc:'Serial Console Management Port'}
    ]
  },
  firewall:{
    id:'firewall',
    name:'Next-Generation Security Firewall',
    short:'Firewall',
    icon:'⬢',
    category:'Security Appliance',
    layer:'Layers 3–7 (Network to Application)',
    definition:'A dedicated stateful security gateway enforcing granular policies between security zones (Inside, Outside, DMZ). Features hardware crypto acceleration, stateful connection tracking, and deep packet inspection.',
    specs:{
      'Form Factor':'1U 19-Inch High-Density Security Appliance',
      'Security Zones':'Inside (Trust), Outside (Untrust), DMZ (Public Services)',
      'Throughput':'2.5 Gbps Stateful Firewall / 1.2 Gbps Threat Prevention',
      'Inspection':'Stateful Packet Inspection (SPI) & Layer 7 Application Control',
      'Security Policy':'Ordered Access Control Lists (ACLs) with Implicit Deny',
      'NAT Engine':'Dynamic Source NAT (Inside to Outside), Static Destination NAT',
      'Management':'Dedicated OOB Management Port + Serial Console'
    },
    hotspots:[
      {name:'Inside (Trust) Zone Port',desc:'Gigabit Ethernet interface connecting to the secure internal corporate network.'},
      {name:'Outside (Untrust) Zone Port',desc:'Edge interface connected to the untrusted WAN / Internet upstream provider.'},
      {name:'DMZ Zone Port',desc:'Isolated perimeter network interface hosting public-facing web/DNS servers.'},
      {name:'High-Availability (HA) Sync Port',desc:'Dedicated heartbeat interface for active/standby stateful failover clustering.'},
      {name:'Threat Status LED Bar',desc:'Visual diagnostic bar indicating active policy enforcement and blocked intrusion attempts.'}
    ],
    ports:[
      {id:'inside',label:'Inside (Trust)',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'Inside LAN Trusted Security Zone Interface'},
      {id:'outside',label:'Outside (Untrust)',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'Outside WAN Untrusted Security Zone Interface'},
      {id:'dmz',label:'DMZ',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'Demilitarized Zone for Public-Facing Servers'},
      {id:'console',label:'Console',type:'console',speed:'9600 baud',connector:'RJ45/Serial',desc:'Out-of-Band Security Console'}
    ]
  },
  server:{
    id:'server',
    name:'2U Enterprise Rackmount Server',
    short:'Server',
    icon:'▥',
    category:'Host Endpoint',
    layer:'Layers 1–7 (Application to Physical)',
    definition:'A 2U enterprise dual-socket server hosting essential core services (DHCP daemon, DNS resolver, Web HTTP/HTTPS). Equipped with 8 hot-swap SAS drive caddies, redundant power supplies, and multi-homed Gigabit NICs.',
    specs:{
      'Form Factor':'2U 19-Inch Enterprise Server Chassis',
      'Processors':'Dual Intel Xeon Silver 4314 (32 Total vCPUs)',
      'Memory':'64 GB DDR4-3200 ECC Registered RAM',
      'Storage Array':'8 × 1.92TB Enterprise SAS SSDs (Hardware RAID-10)',
      'Network Adapters':'Quad Intel I350 1000BASE-T Gigabit Ethernet Ports',
      'Remote Management':'Dedicated IPMI 2.0 / iLO / iDRAC Port with Web GUI',
      'Power Supplies':'Dual 750W Titanium Hot-Swap 1+1 Redundant PSUs'
    },
    hotspots:[
      {name:'8 × Hot-Swap SAS Drive Caddies',desc:'Tool-less drive trays with dual status LEDs (Green = Online, Amber = Activity/Rebuild).'},
      {name:'Power Button with Blue LED Ring',desc:'Momentary power switch with integrated system power status and UID locator light.'},
      {name:'Diagnostic USB & VGA Port',desc:'Front crash-cart interface for direct local KVM console administration.'},
      {name:'Quad 10GbE Network Adapter (Rear)',desc:'Four enterprise PCIe network interfaces for service load balancing and VLAN teaming.'},
      {name:'Dedicated Out-of-Band IPMI Port (Rear)',desc:'Dedicated 100BASE-TX port for lights-out server telemetry, power control, and remote KVM.'},
      {name:'Dual 750W Titanium PSUs (Rear)',desc:'Hot-pluggable power supplies supporting AC line redundancy.'}
    ],
    ports:[
      {id:'eth0',label:'Eth0',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'Primary Service Network Adapter'},
      {id:'eth1',label:'Eth1',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'Secondary / Backup Network Adapter'}
    ]
  },
  accesspoint:{
    id:'accesspoint',
    name:'Enterprise Wi-Fi 6 Access Point',
    short:'AP',
    icon:'⌁',
    category:'Wireless Infrastructure',
    layer:'Layer 2 (Data Link)',
    definition:'A ceiling-mount dual-band Wi-Fi 6 access point. Bridges wireless 802.11ax clients onto the wired 802.3 Ethernet LAN infrastructure with PoE+ power delivery.',
    specs:{
      'Form Factor':'Low-Profile Ceiling / Wall Mount Saucer Dome',
      'Uplink':'1 × 2.5G / 1G Multigigabit RJ45 Port (802.3at PoE+)',
      'Radios':'Dual-Band Wi-Fi 6 (2.4 GHz 4x4 + 5 GHz 4x4 MU-MIMO)',
      'Max PHY Rate':'4.8 Gbps Aggregate Wireless Throughput',
      'Status Light':'Multi-Color Halo LED Ring (Green = Online, Blue = Active, Amber = Boot)'
    },
    hotspots:[
      {name:'PoE+ Gigabit Uplink Port (Rear)',desc:'Receives both 1 Gbps Ethernet data and 30W DC electrical power over a single Cat6 cable.'},
      {name:'Multi-Color Halo Status LED',desc:'360° ring light providing immediate visual health and client association status.'},
      {name:'Kensington Lock & Mounting Bracket',desc:'Reinforced metal twist-lock plate for ceiling grid installation.'}
    ],
    ports:[
      {id:'eth0',label:'Eth0 (PoE+)',type:'ethernet',speed:'1 Gbps',connector:'RJ45',desc:'PoE+ Gigabit Ethernet Uplink Port'}
    ]
  },
  patchpanel:{
    id:'patchpanel',
    name:'24-Port Cat6 Structured Patch Panel',
    short:'Patch Panel',
    icon:'⠿',
    category:'Passive Physical Layer',
    layer:'Layer 1 (Physical)',
    definition:'A 1U 19-inch structured cabling patch panel organizing permanent horizontal building copper cables. Features 24 numbered 8P8C modular jacks on the front and 110-IDC punchdown wiring blocks on the rear.',
    specs:{
      'Form Factor':'1U 19-Inch Rackmount Metal Patch Bay',
      'Ports':'24 × Unshielded Twisted Pair (UTP) Cat6 RJ45 Jacks',
      'Wiring Standard':'TIA/EIA-568-A and TIA/EIA-568-B Color-Coded Blocks',
      'Bandwidth':'250 MHz (Certified for 1000BASE-T Gigabit Ethernet)',
      'Cable Management':'Rear Strain-Relief Cable Tie Bar'
    },
    hotspots:[
      {name:'24 × Numbered RJ45 Jacks (Front)',desc:'Gold-plated 8P8C modular jacks with white writable port identification labels.'},
      {name:'110-IDC Punchdown Blocks (Rear)',desc:'Gas-tight insulation displacement contacts color-coded for 4-pair solid copper wire termination.'},
      {name:'Cable Strain Relief Bar (Rear)',desc:'Heavy-duty steel support bar with velcro tie points to prevent cable sagging.'}
    ],
    ports:Array.from({length:8},(_,i)=>({id:`jack${i+1}`,label:`Jack ${i+1}`,type:'ethernet',speed:'Passive',connector:'RJ45',desc:`Horizontal Cable Termination Jack ${i+1}`}))
  }
};

export const LABS=[
  {
    id:'physical-1',
    phase:1,
    title:'Meet the Network Lab',
    subtitle:'Physical hardware inspection before command execution.',
    duration:'10 min',
    difficulty:'Beginner',
    icon:'🔎',
    devices:['pc','switch','router','firewall'],
    outcome:'Identify real-world networking hardware (PC, Switch, Router, Firewall), their OSI layer roles, and physical interfaces.',
    steps:[
      {kind:'inspect',target:'switch',title:'Inspect the 24-Port Managed Switch',body:'Click the Switch on the workbench. Explore its Overview, Ports, and Specs tabs to understand Layer 2 frame switching and CAM tables.',tip:'A switch operates at Layer 2 (Data Link). It forwards frames based on hardware MAC addresses.'},
      {kind:'inspectPort',target:'switch:gi0/1',title:'Inspect GigabitEthernet Port Gi0/1',body:'Open the Ports tab and click on Gi0/1. Notice its 1 Gbps speed, RJ45 8P8C connector, and LED indicators.',tip:'Gi0/1 stands for GigabitEthernet 0/1. Enterprise switches number interfaces by slot/port.'},
      {kind:'inspect',target:'router',title:'Inspect the Modular Edge Router',body:'Click the Router. Notice how its role differs from a switch: it connects different IP networks at Layer 3 using routing tables.',tip:'Routers inspect Layer 3 IP headers and determine the best next-hop path.'},
      {kind:'inspect',target:'firewall',title:'Inspect the Next-Gen Firewall',body:'Click the Firewall. Notice its dedicated security zones: Inside (Trust), Outside (Untrust), and DMZ.',tip:'Firewalls enforce security policies by inspecting traffic state and access control rules.'}
    ]
  },
  {
    id:'cabling-1',
    phase:1,
    title:'Cable a PC to a Switch',
    subtitle:'Build your first physical 1000BASE-T Ethernet link.',
    duration:'12 min',
    difficulty:'Beginner',
    icon:'🔌',
    devices:['pc','switch'],
    outcome:'Select a Cat6 RJ45 patch cable, connect PC Eth0 to Switch Gi0/1, observe physical link negotiation, and verify in the terminal.',
    steps:[
      {kind:'inspectPort',target:'pc:eth0',title:'Locate the PC Network Interface (Eth0)',body:'Click the Workstation PC and inspect its Eth0 port on the backplate. This is where your RJ45 copper patch lead plugs in.',tip:'Every Ethernet NIC has a unique burned-in 48-bit MAC address.'},
      {kind:'cableTool',target:'rj45',title:'Pick up a Cat6 RJ45 Cable',body:'Click the RJ45 cable on the pegboard tool rack. Your cursor is now armed with a Cat6 patch lead.',tip:'Cat6 copper cables use 4 twisted pairs of copper wires to carry 1 Gbps signals up to 100 meters.'},
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Connect PC Eth0 to Switch Gi0/1',body:'Click PC Eth0, then click Switch Gi0/1. Watch both link LEDs turn solid green as 1000BASE-T auto-negotiation completes.',tip:'A green link proves Layer 1 physical continuity and Layer 2 electrical synchronization.'},
      {kind:'terminal',target:'pc',title:'Verify Link Status in PC Terminal',body:'Click the PC, open the Terminal drawer, and execute `ipconfig`. Observe that Eth0 is connected.',tip:'Suggested command chips let you run diagnostic commands with a single click.'}
    ]
  },
  {
    id:'ipv4-1',
    phase:1,
    title:'IPv4 Subnetting & Addressing',
    subtitle:'Turn a physical link into an operational Layer 3 LAN.',
    duration:'18 min',
    difficulty:'Beginner',
    icon:'🌐',
    devices:['pc','switch','server'],
    outcome:'Cable endpoints to a switch, assign static IPv4 addresses in the 192.168.10.0/24 subnet, and prove end-to-end ping connectivity.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Connect PC Eth0 to Switch Gi0/1',body:'Use an RJ45 cable to connect PC Eth0 to Switch Gi0/1.',tip:'Physical Layer 1 connectivity is the prerequisite for Layer 3 communication.'},
      {kind:'connect',target:'server:eth0>switch:gi0/2',title:'Connect Server Eth0 to Switch Gi0/2',body:'Connect Server Eth0 to Switch Gi0/2 using an RJ45 cable.',tip:'Both devices now share the same Layer 2 broadcast domain.'},
      {kind:'configIp',target:'pc',title:'Assign Static IPv4 to PC (192.168.10.10/24)',body:'Select PC → Network tab. Set IPv4 to `192.168.10.10` and Subnet Mask to `255.255.255.0` (/24). Click Save.',tip:'A /24 subnet mask leaves 8 bits for host addresses (up to 254 hosts).'},
      {kind:'configIp',target:'server',title:'Assign Static IPv4 to Server (192.168.10.20/24)',body:'Select Server → Network tab. Set IPv4 to `192.168.10.20` and Subnet Mask to `255.255.255.0`. Click Save.',tip:'Because both IPs share the network prefix 192.168.10.0, they can communicate directly without a router.'},
      {kind:'ping',target:'192.168.10.20',title:'Verify Connectivity with ICMP Echo (Ping)',body:'Select PC, open Terminal, and run `ping 192.168.10.20`. Watch the ICMP packet travel through the switch and receive replies.',tip:'Ping uses ICMP Echo Request (Type 8) and Echo Reply (Type 0) to measure reachability.'}
    ]
  },
  {
    id:'switching-1',
    phase:2,
    title:'Switch Ports & MAC Learning',
    subtitle:'Discover how Layer 2 switches build their CAM tables.',
    duration:'20 min',
    difficulty:'Beginner',
    icon:'▤',
    devices:['pc','switch','server'],
    outcome:'Generate network traffic and inspect how the switch learns MAC addresses on incoming frames to eliminate collision domains.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Cable PC to Switch Gi0/1',body:'Connect PC Eth0 to Switch Gi0/1 with an RJ45 cable.',tip:'When the link comes up, the switch port transitions to forwarding.'},
      {kind:'connect',target:'server:eth0>switch:gi0/2',title:'Cable Server to Switch Gi0/2',body:'Connect Server Eth0 to Switch Gi0/2 with an RJ45 cable.',tip:'Switches forward frames based on destination MAC addresses.'},
      {kind:'configIp',target:'pc',title:'Configure PC IPv4 (192.168.10.10)',body:'Set PC IPv4 to `192.168.10.10` / `255.255.255.0`.',tip:'Layer 3 IP packets are encapsulated inside Layer 2 Ethernet frames.'},
      {kind:'configIp',target:'server',title:'Configure Server IPv4 (192.168.10.20)',body:'Set Server IPv4 to `192.168.10.20` / `255.255.255.0`.',tip:'Both hosts are in the same local subnet.'},
      {kind:'ping',target:'192.168.10.20',title:'Generate Traffic & Inspect CAM Table',body:'Select PC → Terminal → run `ping 192.168.10.20`. Then select Switch → Terminal → run `show mac address-table`.',tip:'Notice how the switch dynamically learned the PC MAC address on port Gi0/1!'}
    ]
  },
  {
    id:'vlan-1',
    phase:2,
    title:'VLAN Fundamentals (802.1Q)',
    subtitle:'Logically partition one physical switch into isolated LANs.',
    duration:'25 min',
    difficulty:'Beginner',
    icon:'◫',
    devices:['pc','switch','server'],
    outcome:'Configure Virtual LANs (VLAN 10 and VLAN 20), assign access ports, and prove broadcast isolation between subnets.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Connect PC to Switch Gi0/1',body:'Cable PC Eth0 to Switch Gi0/1.',tip:'By default, all switch ports belong to VLAN 1 (Default VLAN).'},
      {kind:'connect',target:'server:eth0>switch:gi0/2',title:'Connect Server to Switch Gi0/2',body:'Cable Server Eth0 to Switch Gi0/2.',tip:'VLANs create separate Layer 2 broadcast domains on the same physical hardware.'},
      {kind:'configIp',target:'pc',title:'Set PC IP (192.168.10.10)',body:'Set PC IP to `192.168.10.10` / `255.255.255.0`.',tip:'Host in VLAN 10.'},
      {kind:'configIp',target:'server',title:'Set Server IP (192.168.20.20)',body:'Set Server IP to `192.168.20.20` / `255.255.255.0`.',tip:'Host in VLAN 20.'},
      {kind:'terminal',target:'switch',title:'Create VLANs & Assign Access Ports',body:'Select Switch → Terminal. Run `show vlan brief` to inspect VLAN status.',tip:'Without a Layer 3 router, devices in different VLANs cannot communicate.'}
    ]
  },
  {
    id:'routing-1',
    phase:3,
    title:'Route Between Two Subnets',
    subtitle:'Use an enterprise router as the default gateway.',
    duration:'30 min',
    difficulty:'Beginner',
    icon:'◈',
    devices:['pc','switch','router','server'],
    outcome:'Configure router interfaces G0/0 and G0/1, set default gateways on endpoints, and route packets across subnets.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Connect PC to Switch Gi0/1',body:'Connect PC Eth0 to Switch Gi0/1.',tip:'PC is on the LAN subnet 192.168.10.0/24.'},
      {kind:'connect',target:'switch:gi0/8>router:g0/0',title:'Connect Switch to Router G0/0',body:'Connect Switch Gi0/8 to Router G0/0 (LAN Gateway interface).',tip:'Router G0/0 acts as the Default Gateway for the 192.168.10.0/24 subnet.'},
      {kind:'connect',target:'router:g0/1>server:eth0',title:'Connect Router G0/1 to Server Eth0',body:'Connect Router G0/1 to Server Eth0 (Server subnet 192.168.20.0/24).',tip:'Router G0/1 acts as the gateway for 192.168.20.0/24.'},
      {kind:'configIp',target:'pc',title:'Configure PC IP & Default Gateway',body:'Set PC IPv4 to `192.168.10.10`, Mask `255.255.255.0`, and Gateway to `192.168.10.1`.',tip:'When an endpoint sends packets to a remote subnet, it forwards them to its Default Gateway MAC address.'},
      {kind:'ping',target:'192.168.20.20',title:'Route Packets Across Subnets',body:'Select PC → Terminal → run `ping 192.168.20.20`. Watch the router forward the packet between subnets!',tip:'The router decrements IP TTL and rewrites Layer 2 Ethernet headers at each hop.'}
    ]
  },
  {
    id:'dhcp-1',
    phase:3,
    title:'DHCP in a Small Office',
    subtitle:'Automate endpoint IP addressing with the DORA handshake.',
    duration:'22 min',
    difficulty:'Beginner',
    icon:'⇄',
    devices:['pc','switch','server'],
    outcome:'Connect a client to a server running DHCP, request dynamic addressing via `ipconfig /renew`, and observe Discover-Offer-Request-Ack.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Connect PC to Switch',body:'Connect PC Eth0 to Switch Gi0/1.',tip:'The PC starts with no IP address.'},
      {kind:'connect',target:'server:eth0>switch:gi0/2',title:'Connect DHCP Server to Switch',body:'Connect Server Eth0 to Switch Gi0/2.',tip:'The server runs a DHCP daemon with a configured address pool.'},
      {kind:'configIp',target:'server',title:'Assign Server Static IP (192.168.10.1)',body:'Set Server IPv4 to `192.168.10.1` / `255.255.255.0`.',tip:'DHCP servers must always have fixed, static IP addresses.'},
      {kind:'terminal',target:'pc',title:'Execute DHCP DORA Request',body:'Select PC → Terminal → run `ipconfig /renew`.',tip:'The PC sends a DHCP Discover broadcast, receives an Offer, sends a Request, and receives an Acknowledgment (DORA).'},
      {kind:'ping',target:'192.168.10.1',title:'Test Dynamic Connection',body:'Select PC → Terminal → run `ping 192.168.10.1`.',tip:'Dynamic IP assignment eliminates manual configuration errors across large fleets.'}
    ]
  },
  {
    id:'dns-1',
    phase:3,
    title:'DNS: Names to IP Addresses',
    subtitle:'Understand domain name resolution before network services load.',
    duration:'20 min',
    difficulty:'Beginner',
    icon:'Aa',
    devices:['pc','switch','server'],
    outcome:'Resolve FQDN hostnames using `nslookup app.lab`, inspect DNS A-records, and separate DNS failures from Layer 3 network faults.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Connect PC to Switch',body:'Cable PC Eth0 to Switch Gi0/1.',tip:'Physical link connects client to LAN.'},
      {kind:'connect',target:'server:eth0>switch:gi0/2',title:'Connect DNS/Web Server to Switch',body:'Cable Server Eth0 to Switch Gi0/2.',tip:'Server hosts both DNS (UDP 53) and HTTP Web services.'},
      {kind:'configIp',target:'pc',title:'Set PC IP (192.168.10.10)',body:'Set PC IPv4 to `192.168.10.10` / `255.255.255.0`.',tip:'PC client configuration.'},
      {kind:'configIp',target:'server',title:'Set Server IP (192.168.10.20)',body:'Set Server IPv4 to `192.168.10.20` / `255.255.255.0`.',tip:'Server holds the DNS A-Record for app.lab -> 192.168.10.20.'},
      {kind:'terminal',target:'pc',title:'Resolve app.lab via nslookup',body:'Select PC → Terminal → run `nslookup app.lab` to query the DNS resolver.',tip:'DNS converts human-friendly domain names (app.lab) into routable IP addresses (192.168.10.20).'}
    ]
  },
  {
    id:'firewall-1',
    phase:4,
    title:'Firewall Security Zones & Rules',
    subtitle:'Enforce stateful traffic policies between Inside, Outside, and DMZ.',
    duration:'30 min',
    difficulty:'Intermediate',
    icon:'⬢',
    devices:['pc','switch','firewall','server'],
    outcome:'Build Inside and Outside security zones through a Next-Gen Firewall, inspect ACL rules, and verify permitted vs denied traffic.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Connect PC to Inside Switch',body:'Connect PC Eth0 to Switch Gi0/1.',tip:'PC is in the Inside (Trusted) security zone.'},
      {kind:'connect',target:'switch:gi0/8>firewall:inside',title:'Connect Switch to Firewall Inside Port',body:'Connect Switch Gi0/8 to Firewall Inside (Trust) port.',tip:'Inside interface connects to internal LAN.'},
      {kind:'connect',target:'firewall:outside>server:eth0',title:'Connect Firewall Outside Port to Server',body:'Connect Firewall Outside (Untrust) port to Server Eth0.',tip:'Server is in the Outside (Untrusted) WAN zone.'},
      {kind:'configIp',target:'pc',title:'Set PC IP & Firewall Gateway',body:'Set PC IPv4 to `192.168.10.10`, Mask `255.255.255.0`, Gateway `192.168.10.1`.',tip:'Firewall Inside port IP is 192.168.10.1.'},
      {kind:'ping',target:'192.168.20.20',title:'Inspect Firewall Policy & Ping Server',body:'Select PC → Terminal → run `ping 192.168.20.20`. Watch the firewall permit trusted outbound traffic while blocking unauthorized inbound connections.',tip:'Stateful firewalls track outbound connections and automatically allow returning response packets.'}
    ]
  },
  {
    id:'nat-1',
    phase:4,
    title:'NAT & PAT at the Edge',
    subtitle:'Translate RFC 1918 private addresses for Internet routing.',
    duration:'30 min',
    difficulty:'Intermediate',
    icon:'↔',
    devices:['pc','switch','router','server'],
    outcome:'Inspect Port Address Translation (PAT / NAT Overload) mapping multiple private LAN hosts to a single public IP address.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Cable PC to LAN Switch',body:'Connect PC Eth0 to Switch Gi0/1.',tip:'Private LAN subnet (192.168.10.0/24).'},
      {kind:'connect',target:'switch:gi0/8>router:g0/0',title:'Cable Switch to Router G0/0',body:'Connect Switch Gi0/8 to Router G0/0 (NAT Inside interface).',tip:'Router G0/0 is designated as ip nat inside.'},
      {kind:'connect',target:'router:g0/1>server:eth0',title:'Cable Router G0/1 to WAN Server',body:'Connect Router G0/1 (NAT Outside public IP 203.0.113.1) to Server Eth0.',tip:'Public Internet subnet (203.0.113.0/24).'},
      {kind:'configIp',target:'pc',title:'Configure Private PC Addressing',body:'Set PC IPv4 to `192.168.10.10`, Gateway `192.168.10.1`.',tip:'Private RFC 1918 addresses are non-routable on the public Internet.'},
      {kind:'ping',target:'203.0.113.100',title:'Send Traffic & Observe NAT Translation',body:'Select PC → Terminal → run `ping 203.0.113.100`. Then select Router → run `show running-config` to inspect the NAT translation table.',tip:'NAT substitutes the private source IP with the public edge IP, allowing Internet communication.'}
    ]
  },
  {
    id:'stp-1',
    phase:5,
    title:'Redundant Switching & STP (802.1w)',
    subtitle:'Build high-availability switching loops without broadcast storms.',
    duration:'35 min',
    difficulty:'Intermediate',
    icon:'△',
    devices:['pc','switch','switch','server'],
    outcome:'Connect redundant switch links, observe Spanning Tree Protocol elect a Root Bridge and block redundant loops, then observe failover.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch-1:gi0/1',title:'Connect PC to Switch 1',body:'Connect PC Eth0 to Switch-1 Gi0/1.',tip:'Switch-1 is the primary distribution switch.'},
      {kind:'connect',target:'switch-1:gi0/7>switch-2:gi0/7',title:'Connect Primary Trunk Link (Switch 1 to 2)',body:'Connect Switch-1 Gi0/7 to Switch-2 Gi0/7.',tip:'Trunk link 1 connects both switches.'},
      {kind:'connect',target:'switch-1:gi0/8>switch-2:gi0/8',title:'Connect Redundant Link (Switch 1 to 2)',body:'Connect Switch-1 Gi0/8 to Switch-2 Gi0/8. Notice how STP sets one link into Blocking state to prevent a loop!',tip:'Without STP, broadcast frames would loop endlessly and crash the network.'},
      {kind:'connect',target:'switch-2:gi0/1>server:eth0',title:'Connect Switch 2 to Server',body:'Connect Switch-2 Gi0/1 to Server Eth0.',tip:'Endpoint connected to secondary switch.'},
      {kind:'terminal',target:'switch-1',title:'Inspect Spanning-Tree State in CLI',body:'Select Switch-1 → Terminal → run `show interfaces status`. Observe the Forwarding and Blocking port states.',tip:'If the primary link fails, STP unblocks the redundant path within milliseconds.'}
    ]
  },
  {
    id:'ospf-1',
    phase:5,
    title:'Dynamic Routing with OSPFv2',
    subtitle:'Let enterprise routers dynamically exchange network topology.',
    duration:'35 min',
    difficulty:'Intermediate',
    icon:'◎',
    devices:['pc','switch','router','router','server'],
    outcome:'Form dynamic OSPF neighbor adjacencies in Area 0, exchange Link-State Advertisements (LSAs), and populate the IP routing table.',
    steps:[
      {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Cable PC to LAN Switch',body:'Connect PC Eth0 to Switch Gi0/1.',tip:'PC is on Area 0 LAN.'},
      {kind:'connect',target:'switch:gi0/8>router-1:g0/0',title:'Cable Switch to Router 1',body:'Connect Switch Gi0/8 to Router-1 G0/0.',tip:'Router 1 LAN interface.'},
      {kind:'connect',target:'router-1:g0/1>router-2:g0/1',title:'Cable Router 1 to Router 2 (Point-to-Point WAN)',body:'Connect Router-1 G0/1 to Router-2 G0/1 with an Ethernet cable.',tip:'Inter-router backbone link.'},
      {kind:'connect',target:'router-2:g0/0>server:eth0',title:'Cable Router 2 to Server',body:'Connect Router-2 G0/0 to Server Eth0.',tip:'Remote subnet (10.0.0.0/24).'},
      {kind:'terminal',target:'router-1',title:'Inspect OSPF Routing Table in CLI',body:'Select Router-1 → Terminal → run `show ip route` to view dynamically learned OSPF routes.',tip:'OSPF uses Dijkstra shortest-path first algorithm to compute optimal loop-free routes.'}
    ]
  },
  {
    id:'troubleshoot-1',
    phase:6,
    title:'Incident: The Office Network Is Down',
    subtitle:'Diagnose and resolve multi-layer networking faults under pressure.',
    duration:'45 min',
    difficulty:'Challenge',
    icon:'🧰',
    devices:['pc','switch','router','firewall','server'],
    outcome:'Apply structured bottom-up OSI troubleshooting (Physical → Data Link → Network) to diagnose missing links, IP misconfigurations, and firewall blocks.',
    steps:[
      {kind:'inspect',target:'pc',title:'Step 1: Check Physical Layer (L1)',body:'Check physical cables and link LEDs. Ensure PC Eth0 is cabled to Switch Gi0/1 and Switch is cabled to the Router.',tip:'Over 60% of real-world network outages are Layer 1 physical faults.'},
      {kind:'terminal',target:'pc',title:'Step 2: Check Layer 3 Addressing (ipconfig)',body:'Open the PC terminal and run `ipconfig`. Ensure the IPv4 address, Subnet Mask, and Default Gateway are correctly configured.',tip:'An incorrect subnet mask prevents local and remote communication.'},
      {kind:'ping',target:'192.168.10.1',title:'Step 3: Ping the Default Gateway',body:'Run `ping 192.168.10.1` from the PC to verify your local router gateway is reachable.',tip:'If the gateway responds, the local LAN is operational.'},
      {kind:'ping',target:'192.168.20.20',title:'Step 4: Restore End-to-End Server Connectivity',body:'Run `ping 192.168.20.20` to verify end-to-end connectivity across the network.',tip:'Congratulations! You diagnosed and resolved a multi-layer production outage.'}
    ]
  },
  {
    id:'sandbox',
    phase:6,
    title:'Free Enterprise Network Playground',
    subtitle:'No constraints. Build, cable, and configure anything you want.',
    duration:'∞',
    difficulty:'Sandbox',
    icon:'🧪',
    devices:Object.keys(DEVICE_CATALOG),
    outcome:'Experiment freely with devices, cables, ports, subnets, VLANs, routers, firewalls, and CLI commands.',
    steps:[]
  }
];

export const PHASES=[
 {id:1,title:'Physical Foundations',desc:'Hardware inspection, Cat6 copper cabling, 1000BASE-T link negotiation, and basic IPv4 LAN addressing.',range:'Labs 1–3'},
 {id:2,title:'Layer 2 Switching',desc:'CAM MAC address learning tables, unicast/broadcast forwarding, and 802.1Q VLAN logical isolation.',range:'Labs 4–5'},
 {id:3,title:'Layer 3 IP & Core Services',desc:'Multi-hop routing, default gateways, automated DHCP DORA addressing, and DNS hostname resolution.',range:'Labs 6–8'},
 {id:4,title:'Network Security & NAT',desc:'Stateful firewall inspection, Inside/Outside security zones, ACL rules, and RFC 1918 Port Address Translation.',range:'Labs 9–10'},
 {id:5,title:'Resilient Infrastructure',desc:'Spanning Tree Protocol (STP 802.1w) loop prevention, redundant failover, and dynamic OSPFv2 link-state routing.',range:'Labs 11–12'},
 {id:6,title:'Incident Troubleshooting',desc:'Multi-fault enterprise outage scenarios, structured OSI diagnostics, and open physical playground.',range:'Labs 13–14'}
];
