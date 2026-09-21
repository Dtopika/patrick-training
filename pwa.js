let deferredPrompt=null,serviceWorkerRegistration=null,pwaUpdateState='idle',pwaLastUpdateCheck=null;
const installBtn=document.getElementById('installBtn');
const networkStatus=document.getElementById('networkStatus');
const displayModeStandalone=()=>['standalone','fullscreen','minimal-ui'].some(mode=>window.matchMedia('(display-mode: '+mode+')').matches);
const launchedFromAndroidApp=()=>document.referrer?.startsWith('android-app://');
const standalone=()=>displayModeStandalone()||window.navigator.standalone===true||launchedFromAndroidApp();
const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function pwaRuntimeStatus(){return{online:navigator.onLine,standalone:standalone(),serviceWorker:!!serviceWorkerRegistration,updateState:pwaUpdateState,lastChecked:pwaLastUpdateCheck}}
function emitPwaStatus(){window.dispatchEvent(new CustomEvent('patrick:pwa-status',{detail:pwaRuntimeStatus()}))}
async function checkPwaUpdate(){
  if(!('serviceWorker'in navigator)){pwaUpdateState='unsupported';emitPwaStatus();return pwaRuntimeStatus()}
  pwaUpdateState='checking';emitPwaStatus();
  try{
    const reg=serviceWorkerRegistration||await navigator.serviceWorker.ready;serviceWorkerRegistration=reg;await reg.update();pwaLastUpdateCheck=new Date().toISOString();
    pwaUpdateState=reg.waiting||reg.installing?'update-found':'current';emitPwaStatus();return pwaRuntimeStatus();
  }catch(e){pwaUpdateState='error';emitPwaStatus();throw e}
}
window.PatrickPWA=Object.freeze({status:pwaRuntimeStatus,checkForUpdate:checkPwaUpdate});

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
    if(hadController)toast(copyText('Actualización instalada. Se aplicará al volver a abrir.'));
    hadController=true;pwaUpdateState='current';emitPwaStatus();
  });
  window.addEventListener('load',async()=>{
    try{serviceWorkerRegistration=await navigator.serviceWorker.register('./sw.js?v770-r1');serviceWorkerRegistration.addEventListener?.('updatefound',()=>{pwaUpdateState='update-found';emitPwaStatus()});syncInstallUI();emitPwaStatus()}
    catch(e){console.warn('Service Worker registration failed',e)}
  });
}
window.addEventListener('load',maybeShowIosInstallHint);
syncInstallUI();syncNetworkUI();
