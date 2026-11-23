const CACHE='cloutfit-v1';
const SHELL=['./','index.html','styles.css','app.js','closet.js','manifest.webmanifest','assets/mannequin-woman.webp','assets/mannequin-man.webp','assets/mannequins.json','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.origin===location.origin){e.respondWith(fetch(e.request).then(n=>{if(n.ok){const c=n.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return n}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));return}
  if(u.host.includes('fonts.g')){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{caches.open(CACHE).then(c=>c.put(e.request,n.clone()));return n})))}});
