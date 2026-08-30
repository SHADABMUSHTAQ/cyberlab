import {RANKS,LABS} from './data.js';
const STORAGE='cyberlab-v8-state';
const defaults={xp:0,completed:[],mastered:[],currentLab:'physical-1',streak:0,orientationSeen:[],activeTab:'home',cloud:false};
export let state=loadState();
function loadState(){try{return {...defaults,...JSON.parse(localStorage.getItem(STORAGE)||'{}')}}catch{return {...defaults}}}
export function saveState(){localStorage.setItem(STORAGE,JSON.stringify(state));updateTopStats()}
export function rank(){let r=RANKS[0];for(const item of RANKS)if(state.xp>=item[0])r=item;return r}
export function level(){return RANKS.findIndex(r=>r===rank())+1}
export function updateTopStats(){const x=document.querySelector('#xpValue'),l=document.querySelector('#levelLabel');if(x)x.textContent=state.xp;if(l)l.textContent=`Level ${level()} · ${rank()[1]}`}
export function currentLabIndex(){return Math.max(0,LABS.findIndex(l=>l.id===state.currentLab))}
export function isUnlocked(index){return index===0||state.completed.includes(LABS[index-1].id)||index<=2}
export function phaseProgress(p){const ls=LABS.filter(l=>l.phase===p),done=ls.filter(l=>state.completed.includes(l.id)||state.mastered.includes(l.id)).length;return [done,ls.length]}
export function setActiveNav(name){document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));state.activeTab=name;saveState()}
export function addXp(n){state.xp+=n;saveState()}
export function completeLab(id,evidence=[]){if(!state.completed.includes(id)){state.completed.push(id);state.xp+=150;saveState();syncHandler?.({labId:id,mode:'guided',score:100,evidence})}}
export function masterLab(id,evidence=[]){if(!state.mastered.includes(id)){state.mastered.push(id);state.xp+=250;saveState();syncHandler?.({labId:id,mode:'practice',score:100,evidence})}}
export function markOrientation(id){if(!state.orientationSeen.includes(id)){state.orientationSeen.push(id);saveState()}}
export function setCurrentLab(id){state.currentLab=id;saveState()}

let syncHandler=null;
export function setProgressSyncHandler(fn){syncHandler=fn}
export function applyCloudProgress(progress){if(!progress)return;state.completed=[...new Set(progress.completed||[])];state.mastered=[...new Set(progress.mastered||[])];state.xp=Number(progress.xp||0);state.streak=Number(progress.streak||0);state.cloud=true;saveState()}
export function leaveCloudMode(){state.cloud=false;saveState()}
