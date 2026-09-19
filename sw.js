importScripts('./config.js?v610-r1');
const CACHE=globalThis.PATRICK_CONFIG.CACHE_NAME;
const CORE=["./","./index.html","./styles.css?v610-r1","./styles-base.css?v610-r1","./styles-ui.css?v610-r1","./styles-avatar.css?v610-r1","./styles-media.css?v610-r1","./styles-splash.css?v610-r1","./styles-session.css?v610-r1","./styles-profile.css?v610-r1","./styles-polish.css?v610-r1","./styles-notifications.css?v610-r1","./styles-v56.css?v610-r1","./styles-v6.css?v610-r1","./config.js?v610-r1","./training-engine.js?v610-r1","./backup-schema.js?v610-r1","./splash.js?v610-r1","./commands-1.js?v610-r1","./commands-2.js?v610-r1","./commands-3.js?v610-r1","./commands-4.js?v610-r1","./levels.js?v610-r1","./videos.js?v610-r1","./db.js?v610-r1","./app-core.js?v610-r1","./profile.js?v610-r1","./progress.js?v610-r1","./app-media.js?v610-r1","./app-session.js?v610-r1","./pwa.js?v610-r1","./manifest.webmanifest?v610-r1","./icons/icon-192.webp","./icons/icon-512.webp","./icons/icon-512-maskable.svg","./icons/icon-192.png","./assets/patrick-banner.webp"];
const REMINDER_TAG='patrick-daily-reminder';
const DB_NAME='patrick-training-db',DB_VERSION=1,STORE='kv';

self.addEventListener('install',e=>{e.waitUntil(Promise.all([caches.open(CACHE).then(c=>c.addAll(CORE)),self.skipWaiting()]))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('patrick-training-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
async function networkAndCache(request){
  const response=await fetch(request);
  if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone())}
  return response;
}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);if(url.origin!==self.location.origin)return;
  const navigation=e.request.mode==='navigate'||e.request.destination==='document';
  if(navigation){
    e.respondWith(networkAndCache(e.request).catch(async()=>await caches.match(e.request)||await caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||networkAndCache(e.request)).catch(()=>new Response('',{status:504,statusText:'Offline y recurso no cacheado'})));
});

function openReminderDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('IndexedDB unavailable'))})}
async function reminderDbGet(key){const db=await openReminderDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result?.value);req.onerror=()=>reject(req.error)})}
async function reminderDbSet(key,value){const db=await openReminderDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key,value,updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function dateKey(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return`${y}-${m}-${d}`}
function timePassed(value){const [h,m]=String(value||'19:00').split(':').map(Number),now=new Date();return now.getHours()>h||(now.getHours()===h&&now.getMinutes()>=m)}
function trainedToday(history){const today=dateKey();return Array.isArray(history)&&history.some(item=>{const d=new Date(item?.at);return !Number.isNaN(d.getTime())&&dateKey(d)===today})}
function streakFromHistory(history){const days=new Set((Array.isArray(history)?history:[]).map(x=>{const d=new Date(x?.at);return Number.isNaN(d.getTime())?null:dateKey(d)}).filter(Boolean));if(!days.size)return 0;const cursor=new Date();cursor.setHours(0,0,0,0);if(!days.has(dateKey(cursor)))cursor.setDate(cursor.getDate()-1);let count=0;while(days.has(dateKey(cursor))){count++;cursor.setDate(cursor.getDate()-1)}return count}
async function maybeNotifyDaily(){
  try{
    const config=await reminderDbGet('patrickNotifications');if(!config?.enabled||!timePassed(config.time))return;
    const today=dateKey();if(config.lastNotifiedDate===today)return;
    const history=await reminderDbGet('patrickHistory')||[];if(trainedToday(history))return;
    const profile=await reminderDbGet('patrickDogProfile')||{},name=String(profile.name||'Patrick').trim()||'Patrick';
    const day=new Intl.DateTimeFormat('es-CO',{weekday:'long'}).format(new Date()),streak=streakFromHistory(history);
    const title=`Hoy es ${day} 🐾`,body=streak>0?`Tu racha va en ${streak} ${streak===1?'día':'días'}. Una micro-sesión con ${name} la mantiene.`:`Una micro-sesión corta con ${name} es suficiente para empezar la racha.`;
    await self.registration.showNotification(title,{body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:REMINDER_TAG,renotify:false,data:{url:self.registration.scope},vibrate:[120,70,120]});
    config.lastNotifiedDate=today;await reminderDbSet('patrickNotifications',config);
  }catch(e){console.warn('Patrick reminder check failed',e)}
}
self.addEventListener('periodicsync',event=>{if(event.tag===REMINDER_TAG)event.waitUntil(maybeNotifyDaily())});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus'in client)return client.focus()}return self.clients.openWindow(event.notification.data?.url||self.registration.scope)}));
});
