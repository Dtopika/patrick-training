const APP_VERSION=window.PATRICK_APP_VERSION||'5.5';
window.PATRICK_APP_VERSION=APP_VERSION;

const displayModeStandalone=()=>['standalone','fullscreen','minimal-ui'].some(mode=>window.matchMedia(`(display-mode: ${mode})`).matches);
const launchedFromAndroidApp=()=>document.referrer?.startsWith('android-app://');
const standalone=()=>displayModeStandalone()||window.navigator.standalone===true||launchedFromAndroidApp();
const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

function removeInstallAction(){document.getElementById('installBtn')?.remove()}
function syncVisibleVersion(){const version=document.querySelector('.settingsDrawerFoot span');if(version)version.textContent=`v${APP_VERSION}`}
removeInstallAction();syncVisibleVersion();
new MutationObserver(()=>{removeInstallAction();syncVisibleVersion()}).observe(document.body,{childList:true,subtree:true});

window.addEventListener('beforeinstallprompt',e=>e.preventDefault());
window.addEventListener('appinstalled',()=>document.getElementById('iosInstallHint')?.remove());

function maybeShowIosInstallHint(){
  if(!isIos()||standalone()||sessionStorage.getItem('patrickIosInstallHintDismissed'))return;
  const main=document.querySelector('.appMain');if(!main)return;
  main.insertAdjacentHTML('beforebegin',`<aside id="iosInstallHint" class="installHint" aria-label="Instalar Patrick Training"><div><strong>Instala Patrick Training</strong><p>En iPhone o iPad: toca Compartir y luego “Añadir a pantalla de inicio”.</p></div><button id="iosInstallDismiss" type="button" aria-label="Cerrar aviso">${icon('x')}</button></aside>`);
  document.getElementById('iosInstallDismiss').onclick=()=>{sessionStorage.setItem('patrickIosInstallHintDismissed','1');document.getElementById('iosInstallHint')?.remove()};
}

async function registerFreshServiceWorker(){
  if(!('serviceWorker'in navigator))return;
  try{
    const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    await reg.update();
  }catch(e){console.warn('Service worker update failed',e)}
}

if('serviceWorker'in navigator){
  window.addEventListener('load',registerFreshServiceWorker);
  window.addEventListener('pageshow',registerFreshServiceWorker);
}
window.addEventListener('load',()=>{removeInstallAction();syncVisibleVersion();maybeShowIosInstallHint()});
