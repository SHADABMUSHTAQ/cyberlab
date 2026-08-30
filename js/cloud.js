const AUTH_URL='https://ep-cool-dream-axwypvxo.neonauth.c-4.us-east-2.aws.neon.tech/neondb/auth';
const DATA_API_URL='https://ep-cool-dream-axwypvxo.apirest.c-4.us-east-2.aws.neon.tech/neondb/rest/v1';

let cloudClient=null;
async function getClient(){if(cloudClient)return cloudClient;const mod=await import('https://esm.sh/@neondatabase/neon-js@0.6.2-beta?bundle');cloudClient=mod.createClient({auth:{url:AUTH_URL},dataApi:{url:DATA_API_URL}});return cloudClient;}
export {cloudClient};
export const cloud={status:'loading',user:null,session:null,certificates:[],error:null};
let listeners=[];
export function onCloudChange(fn){listeners.push(fn);return()=>listeners=listeners.filter(x=>x!==fn)}
function emit(){for(const fn of listeners)try{fn(cloud)}catch(e){console.warn('cloud listener',e)}}
function normalizeSession(result){const data=result?.data||{};const session=data.session||null;const user=data.user||session?.user||null;return{session,user}}
export async function initCloud(){
  try{
    const r=await (await getClient()).auth.getSession();
    if(r?.error)throw r.error;
    const {session,user}=normalizeSession(r);
    cloud.session=session;cloud.user=user;cloud.status=user?'signed-in':'guest';cloud.error=null;
  }catch(error){cloud.status='guest';cloud.error=error?.message||String(error);console.warn('Cloud services unavailable; continuing in Guest mode.',error)}
  emit();return cloud;
}
export async function signIn(email,password){const r=await (await getClient()).auth.signIn.email({email,password,rememberMe:true});if(r.error)throw new Error(r.error.message||'Sign in failed');await initCloud();return cloud.user}
export async function signUp(name,email,password){const r=await (await getClient()).auth.signUp.email({name:name||email.split('@')[0]||'Explorer',email,password});if(r.error)throw new Error(r.error.message||'Sign up failed');await initCloud();return cloud.user}
export async function signOut(){const r=await (await getClient()).auth.signOut();if(r?.error)throw new Error(r.error.message||'Sign out failed');cloud.user=null;cloud.session=null;cloud.certificates=[];cloud.status='guest';emit()}
export function isSignedIn(){return !!cloud.user}
export function userId(){return cloud.user?.id||cloud.user?.user?.id||null}
export function displayName(){return cloud.user?.name||cloud.user?.email?.split('@')[0]||'Explorer'}

async function ensureProfile(){
  const uid=userId();if(!uid)return;
  const {data,error}=await (await getClient()).from('profiles').select('user_id,display_name').eq('user_id',uid).limit(1);
  if(error)throw new Error(error.message||'Could not load profile');
  if(!data?.length){const ins=await (await getClient()).from('profiles').insert({user_id:uid,display_name:displayName()}).select('user_id,display_name');if(ins.error)throw new Error(ins.error.message||'Could not create profile')}
}
function unique(arr){return [...new Set(arr)]}
export async function loadCloudProgress(){
  if(!isSignedIn())return null;
  await ensureProfile();
  const [attemptsRes,streakRes,certRes]=await Promise.all([
    (await getClient()).from('lab_attempts').select('lab_id,mode,status,score,completed_at,started_at').eq('status','completed').order('completed_at',{ascending:true}),
    (await getClient()).from('user_streaks').select('current_streak,longest_streak,last_learning_date').limit(1),
    (await getClient()).from('certificates').select('certificate_code,pathway,learner_name,issued_at,revoked_at').order('issued_at',{ascending:false})
  ]);
  for(const r of [attemptsRes,streakRes,certRes])if(r.error)throw new Error(r.error.message||'Cloud progress query failed');
  const completed=unique((attemptsRes.data||[]).filter(x=>x.mode==='guided').map(x=>x.lab_id));
  const mastered=unique((attemptsRes.data||[]).filter(x=>x.mode==='practice').map(x=>x.lab_id));
  const xp=completed.length*150+mastered.length*250;
  const streak=streakRes.data?.[0]?.current_streak||0;
  cloud.certificates=(certRes.data||[]).filter(x=>!x.revoked_at);emit();
  return{completed,mastered,xp,streak:Math.max(0,streak)};
}
function todayISO(){return new Date().toISOString().slice(0,10)}
function dayDiff(a,b){if(!a||!b)return null;return Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000)}
async function touchStreak(){
  const uid=userId();if(!uid)return;
  const r=await (await getClient()).from('user_streaks').select('current_streak,longest_streak,last_learning_date').eq('user_id',uid).limit(1);if(r.error)throw new Error(r.error.message);
  const row=r.data?.[0],today=todayISO();
  if(!row){const ins=await (await getClient()).from('user_streaks').insert({user_id:uid,current_streak:1,longest_streak:1,last_learning_date:today});if(ins.error)throw new Error(ins.error.message);return 1}
  const diff=dayDiff(today,row.last_learning_date);let current=row.current_streak||0;if(diff===0)return current;if(diff===1)current+=1;else current=1;
  const upd=await (await getClient()).from('user_streaks').update({current_streak:current,longest_streak:Math.max(row.longest_streak||0,current),last_learning_date:today,updated_at:new Date().toISOString()}).eq('user_id',uid);if(upd.error)throw new Error(upd.error.message);return current;
}
export async function persistCompletion({labId,mode,score=100,evidence=[]}){
  const uid=userId();if(!uid)return{guest:true};
  const existing=await (await getClient()).from('lab_attempts').select('id').eq('user_id',uid).eq('lab_id',labId).eq('mode',mode).eq('status','completed').limit(1);
  if(existing.error)throw new Error(existing.error.message);
  if(existing.data?.length)return{duplicate:true};
  const attempt=await (await getClient()).from('lab_attempts').insert({user_id:uid,lab_id:labId,mode,status:'completed',score,hints_used:0,completed_at:new Date().toISOString()}).select('id');
  if(attempt.error)throw new Error(attempt.error.message||'Could not save attempt');
  const attemptId=attempt.data?.[0]?.id;
  if(attemptId){
    const rows=(evidence.length?evidence:[{kind:'lab_verified',target:labId}]).slice(-20).map(e=>({attempt_id:attemptId,user_id:uid,lab_id:labId,event_type:e.kind||'evidence',target:String(e.target??''),payload:{source:'cyberlab-browser-simulator',ts:e.ts||Date.now()},verified:false}));
    const ev=await (await getClient()).from('evidence_events').insert(rows);if(ev.error)console.warn('Evidence sync failed',ev.error);
  }
  const streak=await touchStreak();return{saved:true,streak};
}
