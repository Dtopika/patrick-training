const CACHE='patrick-training-v3.3';
const CORE=["./","./index.html","./styles.css","./styles-base.css","./styles-ui.css","./styles-avatar.css","./commands-1.js","./commands-2.js","./commands-3.js","./commands-4.js","./levels.js","./app-core.js","./app-session.js","./pwa.js","./manifest.webmanifest","./icons/icon-192.webp","./icons/icon-512.webp","./icons/icon-192.png","./assets/patrick-banner.webp"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));});
