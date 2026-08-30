import {cloud,isSignedIn,signIn,signUp,signOut,displayName,loadCloudProgress} from './cloud.js';
import {applyCloudProgress,leaveCloudMode,updateTopStats} from './state.js';

const $=s=>document.querySelector(s);
let rerender=()=>{};
export function setAuthRerender(fn){rerender=fn||(()=>{})}
export function paintProfile(){
  const chip=$('[data-action="profile"]');if(!chip)return;
  const avatar=chip.querySelector('.avatar'),name=chip.querySelector('b'),small=chip.querySelector('small');
  if(isSignedIn()){
    const n=displayName();avatar.textContent=(n[0]||'E').toUpperCase();name.textContent=n;small.textContent='Cloud progress synced';chip.classList.add('signed-in');
  }else{avatar.textContent='G';name.textContent='Guest';small.textContent='Sign in to sync progress';chip.classList.remove('signed-in')}
}
function modal(html){const root=$('#modalRoot');root.innerHTML=`<div class="modal-backdrop"><div class="modal-card auth-card">${html}</div></div>`;root.querySelector('[data-close]')?.addEventListener('click',()=>root.innerHTML='');return root}
function formTemplate(signup=false){return `<button class="modal-x" data-close aria-label="Close">×</button><div class="auth-logo"><img src="/assets/logo.svg" alt=""><span><b>Cyber</b>Lab</span></div><span class="kicker"><i class="kicker-dot"></i> ${signup?'Create your learner account':'Welcome back'}</span><h2>${signup?'Save your progress everywhere':'Sign in to CyberLab'}</h2><p class="auth-copy">${signup?'Your guided labs, independent mastery and streak will sync securely across devices.':'Continue your networking path on any device.'}</p><form id="authForm" class="auth-form">${signup?'<label>Name<input name="name" autocomplete="name" required maxlength="60" placeholder="Your name"></label>':''}<label>Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label>Password<input name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="8" required placeholder="At least 8 characters"></label><div class="auth-error" id="authError"></div><button class="btn primary" type="submit" style="width:100%">${signup?'Create account':'Sign in'} →</button></form><button class="auth-switch" data-switch>${signup?'Already have an account? Sign in':'New here? Create an account'}</button><div class="auth-note">Guest mode stays available. Signing in is only required for cross-device progress and verified account history.</div>`}
async function authenticate(signup){
  const root=modal(formTemplate(signup));
  root.querySelector('[data-switch]').onclick=()=>authenticate(!signup);
  root.querySelector('#authForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),err=root.querySelector('#authError'),btn=e.currentTarget.querySelector('button[type="submit"]');err.textContent='';btn.disabled=true;btn.textContent='Connecting…';try{if(signup)await signUp(fd.get('name'),fd.get('email'),fd.get('password'));else await signIn(fd.get('email'),fd.get('password'));const progress=await loadCloudProgress();applyCloudProgress(progress);root.innerHTML='';paintProfile();updateTopStats();window.cyberToast?.('Signed in — cloud progress loaded.');rerender()}catch(ex){err.textContent=ex.message||'Authentication failed';btn.disabled=false;btn.textContent=signup?'Create account →':'Sign in →'}}
}
export function showAccount(){
  if(!isSignedIn())return authenticate(false);
  const n=displayName(),root=modal(`<button class="modal-x" data-close aria-label="Close">×</button><div class="auth-logo"><img src="/assets/logo.svg" alt=""><span><b>Cyber</b>Lab</span></div><span class="kicker"><i class="kicker-dot"></i> Learner account</span><h2>${n}</h2><p class="auth-copy">Your completed labs and independent mastery are synced through your authenticated CyberLab account.</p><div class="account-grid"><div><b>${cloud.user?.email||''}</b><small>Email</small></div><div><b>Protected</b><small>Row-level data access</small></div></div><button class="btn secondary" data-signout style="width:100%;margin-top:14px">Sign out</button>`);
  root.querySelector('[data-signout]').onclick=async()=>{try{await signOut();leaveCloudMode();root.innerHTML='';paintProfile();window.cyberToast?.('Signed out. Guest progress remains on this device.');rerender()}catch(e){window.cyberToast?.(e.message)}}
}
