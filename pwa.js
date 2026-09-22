let deferredPrompt=null,serviceWorkerRegistration=null,pwaUpdateState='idle',pwaLastUpdateCheck=null,pwaPublishedVersion=null;
const installBtn=document.getElementById('installBtn');
const networkStatus=document.getElementById('networkStatus');
const displayModeStandalone=()=>['standalone','fullscreen','minimal-ui'].some(mode=>window.matchMedia('(display-mode: '+mode+')').matches);
const launchedFromAndroidApp=()=>document.referrer?.startsWith('android-app://');
const standalone=()=>displayModeStandalone()||window.navigator.standalone===true||launchedFromAndroidApp();
const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function compareSemver(a,b){
  const parse=value=>String(value||'0').split('.').map(part=>Number(part)||0),aa=parse(a),bb=parse(b),length=Math.max(aa.length,bb.length);
  for(let i=0;i<length;i++){const delta=(aa[i]||0)-(bb[i]||0);if(delta)return delta>0?1:-1}return 0;
}
function pwaRuntimeStatus(){return{online:navigator.onLine,standalone:standalone(),serviceWorker:!!serviceWorkerRegistration,updateState:pwaUpdateState,lastChecked:pwaLastUpdateCheck,currentVersion:CONFIG?.APP_VERSION||null,publishedVersion:pwaPublishedVersion}}
async function fetchPublishedVersion(){
  const response=await fetch('./config.js?patrick-update-check='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error('Version check failed: '+response.status);
  const source=await response.text(),version=source.match(/APP_VERSION:'([^']+)'/)?.[1];
  if(!version)throw new Error('Published version not found');
  return version;
}
function emitPwaStatus(){window.dispatchEvent(new CustomEvent('patrick:pwa-status',{detail:pwaRuntimeStatus()}))}
async function checkPwaUpdate(){
  pwaUpdateState='checking';emitPwaStatus();
  if(!navigator.onLine){pwaUpdateState='offline';emitPwaStatus();throw new Error('Offline')}
  try{
    pwaPublishedVersion=await fetchPublishedVersion();
    if('serviceWorker'in navigator){
      const reg=serviceWorkerRegistration||await navigator.serviceWorker.getRegistration?.();
      if(reg){serviceWorkerRegistration=reg;await reg.update()}
    }
    pwaLastUpdateCheck=new Date().toISOString();
    pwaUpdateState=compareSemver(pwaPublishedVersion,CONFIG?.APP_VERSION)>0?'update-found':'current';
    emitPwaStatus();return pwaRuntimeStatus();
  }catch(e){pwaUpdateState=navigator.onLine?'error':'offline';emitPwaStatus();throw e}
}
async function applyPwaUpdate(){
  let status=pwaRuntimeStatus();
  if(compareSemver(status.publishedVersion,status.currentVersion)<=0)status=await checkPwaUpdate();
  if(compareSemver(status.publishedVersion,status.currentVersion)<=0)return status;
  pwaUpdateState='applying';emitPwaStatus();
  try{
    if('serviceWorker'in navigator){
      const reg=serviceWorkerRegistration||await navigator.serviceWorker.getRegistration?.();
      if(reg){serviceWorkerRegistration=reg;await reg.update();reg.waiting?.postMessage?.({type:'SKIP_WAITING'})}
    }
  }catch(e){console.warn('Service Worker update apply failed',e)}
  try{sessionStorage.setItem('patrickUpdateReload','1')}catch{}
  window.location.reload();
  return{...pwaRuntimeStatus(),reloading:true};
}
window.PatrickPWA=Object.freeze({status:pwaRuntimeStatus,checkForUpdate:checkPwaUpdate,applyUpdate:applyPwaUpdate});

function syncInstallUI(){
  const canInstall=!!deferredPrompt&&!standalone();
  if(!installBtn)return;
  installBtn.hidden=!canInstall;
  installBtn.style.display=canInstall?'grid':'none';
}
function syncNetworkUI(){
  const offline=!navigator.onLine;
  if(networkStatus){networkStatus.hidden=!offline;networkStatus.textContent=copyText('Sin conexión')}
  document.body.classList.toggle('isOffline',offline);emitPwaStatus();
}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  if(standalone()){deferredPrompt=null;syncInstallUI();return}
  deferredPrompt=e;syncInstallUI();
});
async function install(){
  if(!deferredPrompt||standalone()){syncInstallUI();return}
  deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;syncInstallUI();
}
installBtn?.addEventListener('click',install);
window.addEventListener('appinstalled',()=>{deferredPrompt=null;syncInstallUI();document.getElementById('iosInstallHint')?.remove();emitPwaStatus()});
['standalone','fullscreen','minimal-ui'].forEach(mode=>window.matchMedia('(display-mode: '+mode+')').addEventListener?.('change',syncInstallUI));
window.addEventListener('online',()=>{syncNetworkUI();toast(copyText('Conexión recuperada'))});
window.addEventListener('offline',()=>{syncNetworkUI();toast(copyText('Modo sin conexión'))});
window.addEventListener('pageshow',()=>{syncInstallUI();syncNetworkUI()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncInstallUI();serviceWorkerRegistration?.update?.().catch(()=>{})}});

function maybeShowIosInstallHint(){
  if(!isIos()||standalone()||sessionStorage.getItem('patrickIosInstallHintDismissed'))return;
  const main=document.querySelector('.appMain');if(!main)return;
  main.insertAdjacentHTML('beforebegin','<aside id="iosInstallHint" class="installHint" aria-label="'+escapeHtml(copyText('Instala Patrick Training'))+'"><div><strong>'+escapeHtml(copyText('Instala Patrick Training'))+'</strong><p>'+escapeHtml(copyText('En iPhone o iPad: toca Compartir y luego “Añadir a pantalla de inicio”.'))+'</p></div><button id="iosInstallDismiss" type="button" aria-label="'+escapeHtml(copyText('Cerrar aviso'))+'">'+icon('x')+'</button></aside>');
  document.getElementById('iosInstallDismiss').onclick=()=>{sessionStorage.setItem('patrickIosInstallHintDismissed','1');document.getElementById('iosInstallHint')?.remove()};
}

if('serviceWorker' in navigator){
  let hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(hadController){pwaUpdateState='ready-to-reopen';toast(copyText('Actualización instalada. Se aplicará al volver a abrir.'))}
    else pwaUpdateState='current';
    hadController=true;emitPwaStatus();
  });
  window.addEventListener('load',async()=>{
    try{serviceWorkerRegistration=await navigator.serviceWorker.register('./sw.js?v7101-r1');serviceWorkerRegistration.addEventListener?.('updatefound',()=>{pwaUpdateState='update-found';emitPwaStatus()});syncInstallUI();emitPwaStatus()}
    catch(e){console.warn('Service Worker registration failed',e)}
  });
}
window.addEventListener('load',maybeShowIosInstallHint);
syncInstallUI();syncNetworkUI();
