export const RANKS=[
  [0,'New Explorer'],[250,'Cable Rookie'],[600,'LAN Builder'],[1050,'Switching Scout'],[1600,'Routing Apprentice'],[2300,'Network Technician'],[3100,'Network Troubleshooter'],[4100,'Infrastructure Operator']
];

export const DEVICE_CATALOG={
  pc:{id:'pc',name:'Desktop PC',short:'PC',icon:'🖥️',category:'Endpoint',layer:'Layers 1–7',definition:'A host that sends and receives application data on a network.',specs:{Interfaces:'1 × Gigabit Ethernet',Memory:'8 GB',OS:'CyberLab Workstation',Role:'User endpoint'},ports:[{id:'eth0',label:'Eth0',type:'ethernet',speed:'1 Gbps'}]},
  switch:{id:'switch',name:'Access Switch',short:'Switch',icon:'▤',category:'Network device',layer:'Layer 2',definition:'A switch forwards Ethernet frames inside a LAN using MAC addresses.',specs:{Ports:'24 × 1 GbE + 2 uplinks',Switching:'Layer 2',VLANs:'Supported',Management:'CLI'},ports:Array.from({length:8},(_,i)=>({id:`gi0/${i+1}`,label:`Gi0/${i+1}`,type:'ethernet',speed:'1 Gbps'})).concat([{id:'console',label:'Console',type:'console',speed:'Serial'}])},
  router:{id:'router',name:'Edge Router',short:'Router',icon:'◈',category:'Network device',layer:'Layer 3',definition:'A router forwards IP packets between different networks using a routing table.',specs:{Interfaces:'4 × Gigabit Ethernet',Routing:'Static + OSPF',NAT:'Supported',Management:'CLI'},ports:[{id:'g0/0',label:'G0/0',type:'ethernet',speed:'1 Gbps'},{id:'g0/1',label:'G0/1',type:'ethernet',speed:'1 Gbps'},{id:'g0/2',label:'G0/2',type:'ethernet',speed:'1 Gbps'},{id:'console',label:'Console',type:'console',speed:'Serial'}]},
  firewall:{id:'firewall',name:'Network Firewall',short:'Firewall',icon:'⬢',category:'Security device',layer:'Layers 3–7',definition:'A firewall enforces security policy by permitting or denying network traffic.',specs:{Interfaces:'4 × Gigabit Ethernet',Policy:'Stateful rules',NAT:'Supported',Zones:'Inside / Outside / DMZ'},ports:[{id:'inside',label:'Inside',type:'ethernet',speed:'1 Gbps'},{id:'outside',label:'Outside',type:'ethernet',speed:'1 Gbps'},{id:'dmz',label:'DMZ',type:'ethernet',speed:'1 Gbps'},{id:'console',label:'Console',type:'console',speed:'Serial'}]},
  server:{id:'server',name:'Rack Server',short:'Server',icon:'▥',category:'Endpoint',layer:'Layers 1–7',definition:'A server provides network services such as web, DNS, DHCP, files, or authentication.',specs:{Interfaces:'2 × Gigabit Ethernet',Memory:'16 GB',Services:'Web / DNS / DHCP',Role:'Infrastructure endpoint'},ports:[{id:'eth0',label:'Eth0',type:'ethernet',speed:'1 Gbps'},{id:'eth1',label:'Eth1',type:'ethernet',speed:'1 Gbps'}]},
  accesspoint:{id:'accesspoint',name:'Wireless Access Point',short:'AP',icon:'⌁',category:'Wireless',layer:'Layer 2',definition:'An access point bridges wireless clients onto a wired LAN.',specs:{Ethernet:'1 × Gigabit Ethernet',Wireless:'Wi‑Fi 6',Bands:'2.4 / 5 GHz',Role:'Wireless bridge'},ports:[{id:'eth0',label:'Eth0',type:'ethernet',speed:'1 Gbps'}]},
  patchpanel:{id:'patchpanel',name:'Patch Panel',short:'Patch panel',icon:'⠿',category:'Passive cabling',layer:'Layer 1',definition:'A patch panel organizes permanent building cabling and provides front-facing jacks for patch leads.',specs:{Ports:'24 × RJ45',Category:'Cat6',Active:'No',Role:'Cable termination'},ports:Array.from({length:8},(_,i)=>({id:`jack${i+1}`,label:`Jack ${i+1}`,type:'ethernet',speed:'Passive'}))}
};

export const LABS=[
  {id:'physical-1',phase:1,title:'Meet the Network Lab',subtitle:'Inspect devices before touching commands.',duration:'12 min',difficulty:'Beginner',icon:'🔎',devices:['pc','switch','router','firewall'],outcome:'Identify what a PC, switch, router and firewall do, and inspect their ports.',steps:[
    {kind:'inspect',target:'switch',title:'Inspect the switch',body:'Start with the switch on the workbench. Click it and explore its Overview, Ports and Specs tabs.',tip:'A switch is mainly a Layer 2 device. You do not need the terminal yet.'},
    {kind:'inspectPort',target:'switch:gi0/1',title:'Find a usable Ethernet port',body:'Open the Ports tab and locate Gi0/1. This is a Gigabit Ethernet interface.',tip:'Port names are labels, not commands. Gi means Gigabit Ethernet.'},
    {kind:'inspect',target:'router',title:'Compare it with a router',body:'Inspect the router and notice how its role changes from switching inside one LAN to routing between networks.',tip:'Focus on purpose first; configuration comes later.'},
    {kind:'inspect',target:'firewall',title:'Inspect the firewall',body:'Look at its Inside, Outside and DMZ interfaces. Think of them as different security zones.',tip:'A firewall is not “just a router”; it also enforces traffic policy.'}
  ]},
  {id:'cabling-1',phase:1,title:'Cable a PC to a Switch',subtitle:'Build your first physical Ethernet link.',duration:'15 min',difficulty:'Beginner',icon:'🔌',devices:['pc','switch'],outcome:'Choose RJ45 copper and connect PC Eth0 to switch Gi0/1.',steps:[
    {kind:'inspectPort',target:'pc:eth0',title:'Find the PC network interface',body:'Click the PC and inspect Eth0. This is where the Ethernet cable will plug in.',tip:'Do not open the terminal yet. First prove you understand the physical connection.'},
    {kind:'cableTool',target:'rj45',title:'Pick up an RJ45 cable',body:'Choose RJ45 from the cable pegboard. Your pointer becomes a cable tool.',tip:'Ethernet ports accept the RJ45 copper cable in this lab.'},
    {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Connect the correct ports',body:'Drag from PC Eth0 to Switch Gi0/1. Watch both link LEDs turn green.',tip:'A green link only proves Layer 1/2 connectivity. It does not prove IP connectivity.'},
    {kind:'terminal',target:'pc',title:'Observe the PC from the terminal',body:'Now open the PC terminal and run ipconfig. You are observing configuration, not memorizing syntax.',tip:'Use the suggested command chip if you are new.'}
  ]},
  {id:'ipv4-1',phase:1,title:'Give Devices IPv4 Addresses',subtitle:'Turn a physical link into a working LAN.',duration:'22 min',difficulty:'Beginner',icon:'🌐',devices:['pc','switch','server'],outcome:'Configure two endpoints in one subnet and verify them with ping.',steps:[
    {kind:'connect',target:'pc:eth0>switch:gi0/1',title:'Build the PC link',body:'Connect PC Eth0 to switch Gi0/1.',tip:'Physical first, addressing second.'},
    {kind:'connect',target:'server:eth0>switch:gi0/2',title:'Build the server link',body:'Connect Server Eth0 to switch Gi0/2.',tip:'Both hosts will share the same Layer 2 switch.'},
    {kind:'configIp',target:'pc',title:'Configure PC IPv4',body:'Open the PC inspector → Network tab and set 192.168.10.10 /24.',tip:'A /24 mask is 255.255.255.0.'},
    {kind:'configIp',target:'server',title:'Configure server IPv4',body:'Set the server to 192.168.10.20 /24.',tip:'Both addresses are inside 192.168.10.0/24.'},
    {kind:'ping',target:'192.168.10.20',title:'Prove connectivity',body:'Open the PC terminal and ping 192.168.10.20. Then watch the packet move through the cable.',tip:'If it fails, inspect Layer 1 first, then IP addressing.'}
  ]},
  {id:'switching-1',phase:2,title:'Switch Ports & MAC Learning',subtitle:'See how Layer 2 forwarding works.',duration:'25 min',difficulty:'Beginner',icon:'▤',devices:['pc','switch','server'],outcome:'Build a LAN, generate traffic and inspect the switch MAC table.',steps:[]},
  {id:'vlan-1',phase:2,title:'VLAN Fundamentals',subtitle:'Separate one switch into logical LANs.',duration:'30 min',difficulty:'Beginner',icon:'◫',devices:['pc','switch','server'],outcome:'Create VLANs, assign access ports and observe isolation.',steps:[]},
  {id:'routing-1',phase:3,title:'Route Between Two LANs',subtitle:'Use a router as the default gateway.',duration:'35 min',difficulty:'Beginner',icon:'◈',devices:['pc','switch','router','server'],outcome:'Configure router interfaces and send packets between subnets.',steps:[]},
  {id:'dhcp-1',phase:3,title:'DHCP in a Small Office',subtitle:'Automate endpoint addressing.',duration:'28 min',difficulty:'Beginner',icon:'⇄',devices:['pc','switch','router','server'],outcome:'Request an address and inspect the DORA exchange.',steps:[]},
  {id:'dns-1',phase:3,title:'DNS: Names to Addresses',subtitle:'See what happens before a website loads.',duration:'25 min',difficulty:'Beginner',icon:'Aa',devices:['pc','switch','server'],outcome:'Resolve app.lab and separate DNS failure from network failure.',steps:[]},
  {id:'firewall-1',phase:4,title:'Firewall Zones & Rules',subtitle:'Permit useful traffic and block unwanted traffic.',duration:'38 min',difficulty:'Intermediate',icon:'⬢',devices:['pc','switch','router','firewall','server'],outcome:'Build Inside/Outside paths and apply a simple policy.',steps:[]},
  {id:'nat-1',phase:4,title:'NAT & PAT at the Edge',subtitle:'Translate private addresses for outside access.',duration:'40 min',difficulty:'Intermediate',icon:'↔',devices:['pc','switch','router','server'],outcome:'Create an inside/outside topology and inspect translation state.',steps:[]},
  {id:'stp-1',phase:5,title:'Redundant Switching & STP',subtitle:'Build redundancy without creating a loop.',duration:'42 min',difficulty:'Intermediate',icon:'△',devices:['pc','switch','switch','server'],outcome:'Create a redundant topology and identify the blocked path.',steps:[]},
  {id:'ospf-1',phase:5,title:'Dynamic Routing with OSPF',subtitle:'Let routers learn remote networks.',duration:'50 min',difficulty:'Intermediate',icon:'◎',devices:['pc','switch','router','router','server'],outcome:'Form a neighbor relationship and inspect learned routes.',steps:[]},
  {id:'troubleshoot-1',phase:6,title:'The Office Network Is Down',subtitle:'Diagnose multiple faults from symptoms.',duration:'55 min',difficulty:'Challenge',icon:'🧰',devices:['pc','switch','router','firewall','server'],outcome:'Use a layered troubleshooting method to restore service.',steps:[]},
  {id:'sandbox',phase:6,title:'Free Network Playground',subtitle:'No objectives. Build anything you want.',duration:'∞',difficulty:'Sandbox',icon:'🧪',devices:Object.keys(DEVICE_CATALOG),outcome:'Experiment freely with devices, cables, ports and commands.',steps:[]}
];

export const PHASES=[
 {id:1,title:'Physical Foundations',desc:'Devices, ports, cables and link state.',range:'Labs 1–3'},
 {id:2,title:'Switching',desc:'MAC learning, access ports and VLANs.',range:'Labs 4–5'},
 {id:3,title:'IP & Services',desc:'Routing, gateways, DHCP and DNS.',range:'Labs 6–8'},
 {id:4,title:'Network Security',desc:'Firewalls, ACL thinking and NAT.',range:'Labs 9–10'},
 {id:5,title:'Resilient Networks',desc:'STP, redundancy and OSPF.',range:'Labs 11–12'},
 {id:6,title:'Troubleshooting',desc:'Multi-fault incidents and free practice.',range:'Labs 13–14'}
];
