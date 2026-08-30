import {renderHome,renderLearn,renderAchievements,setStartLabHandler} from './home.js';
import {startLab,setHomeHandler} from './lab.js';
import {updateTopStats,setProgressSyncHandler,applyCloudProgress,state} from './state.js';
import {initCloud,loadCloudProgress,persistCompletion,isSignedIn} from './cloud.js';
import {paintProfile,showAccount,setAuthRerender} from './auth-ui.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const toast=$('#toast');window.cyberToast=msg=>{toast.textContent=msg;toast.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toast.classList.remove('show'),3000)};
setStartLabHandler(startLab);setHomeHandler(renderHome);setAuthRerender(()=>{if(state.activeTab==='learn')renderLearn();else if(state.activeTab==='achievements')renderAchievements();else renderHome()});
setProgressSyncHandler(async payload=>{if(!isSignedIn())return;try{const r=await persistCompletion(payload);if(r?.streak){state.streak=r.streak}const progress=await loadCloudProgress();applyCloudProgress(progress);paintProfile();window.cyberToast?.('Progress synced to your account.')}catch(e){console.error(e);window.cyberToast?.('Lab saved locally; cloud sync will retry after sign-in.')}});
$$('.nav-item').forEach(b=>b.onclick=()=>{if(b.dataset.nav==='home')renderHome();if(b.dataset.nav==='learn')renderLearn();if(b.dataset.nav==='playground')startLab('sandbox');if(b.dataset.nav==='achievements')renderAchievements()});
$('[data-action="home"]').onclick=renderHome;$('[data-action="profile"]').onclick=showAccount;
function boot(){
  // The learning UI must never wait for cloud/auth. Render immediately.
  paintProfile();renderHome();updateTopStats();
  initCloud().then(async()=>{
    if(isSignedIn())try{const progress=await loadCloudProgress();applyCloudProgress(progress)}catch(e){console.warn('Cloud progress unavailable',e);window.cyberToast?.('Cloud sync is unavailable right now. Your lab still works in Guest mode.')}
    paintProfile();
    if(state.activeTab==='learn')renderLearn();else if(state.activeTab==='achievements')renderAchievements();else if(state.activeTab==='home')renderHome();
    updateTopStats();
  }).catch(e=>console.warn('Cloud startup skipped; Guest mode remains available.',e));
}
boot();
