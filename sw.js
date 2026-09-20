importScripts('./config.js?v750-r3');
const CACHE=globalThis.PATRICK_CONFIG.CACHE_NAME;
const CORE=["./","./index.html","./styles.css?v750-r3","./styles-base.css?v750-r3","./styles-ui.css?v750-r3","./styles-avatar.css?v750-r3","./styles-media.css?v750-r3","./styles-splash.css?v750-r3","./styles-session.css?v750-r3","./styles-profile.css?v750-r3","./styles-polish.css?v750-r3","./styles-notifications.css?v750-r3","./styles-insights.css?v750-r3","./config.js?v750-r3","./training-engine.js?v750-r3","./backup-schema.js?v750-r3","./splash.js?v750-r3","./commands-1.js?v750-r3","./i18n-data.js?v750-r3","./i18n.js?v750-r3","./commands-2.js?v750-r3","./commands-3.js?v750-r3","./commands-4.js?v750-r3","./levels.js?v750-r3","./videos.js?v750-r3","./db.js?v750-r3","./app-core.js?v750-r3","./profile.js?v750-r3","./profile-setup.js?v750-r3","./profile-data.js?v750-r3","./profile-reminders.js?v750-r3","./profile-settings.js?v750-r3","./progress.js?v750-r3","./app-media.js?v750-r3","./app-insights.js?v750-r3","./app-session.js?v750-r3","./pwa.js?v750-r3","./manifest.webmanifest?v750-r3","./icons/icon-192.webp","./icons/icon-512.webp","./icons/icon-512-maskable.svg","./icons/icon-192.png","./assets/patrick-banner.webp"];
const REMINDER_TAG='patrick-daily-reminder';
const DB_NAME='patrick-training-db',DB_VERSION=globalThis.PATRICK_CONFIG.DB_VERSION,STORE='kv';

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
    const profile=await reminderDbGet('patrickDogProfile')||{},name=String(profile.name||'Patrick').trim()||'Patrick',lang=['es','en','de'].includes(await reminderDbGet('patrickAppLanguage'))?await reminderDbGet('patrickAppLanguage'):'es';
    const locale=lang==='en'?'en-US':lang==='de'?'de-DE':'es-CO',day=new Intl.DateTimeFormat(locale,{weekday:'long'}).format(new Date()),streak=streakFromHistory(history);
    const title=lang==='en'?`Today is ${day} 🐾`:lang==='de'?`Heute ist ${day} 🐾`:`Hoy es ${day} 🐾`,body=streak>0?(lang==='en'?`Your streak is ${streak} ${streak===1?'day':'days'}. One micro-session with ${name} keeps it going.`:lang==='de'?`Deine Serie steht bei ${streak} ${streak===1?'Tag':'Tagen'}. Eine Mikro-Einheit mit ${name} hält sie am Laufen.`:`Tu racha va en ${streak} ${streak===1?'día':'días'}. Una micro-sesión con ${name} la mantiene.`):(lang==='en'?`One short micro-session with ${name} is enough to start the streak.`:lang==='de'?`Eine kurze Mikro-Einheit mit ${name} reicht aus, um die Serie zu starten.`:`Una micro-sesión corta con ${name} es suficiente para empezar la racha.`);
    await self.registration.showNotification(title,{body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:REMINDER_TAG,renotify:false,data:{url:self.registration.scope},vibrate:[120,70,120]});
    config.lastNotifiedDate=today;await reminderDbSet('patrickNotifications',config);
  }catch(e){console.warn('Patrick reminder check failed',e)}
}
self.addEventListener('periodicsync',event=>{if(event.tag===REMINDER_TAG)event.waitUntil(maybeNotifyDaily())});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus'in client)return client.focus()}return self.clients.openWindow(event.notification.data?.url||self.registration.scope)}));
});
