let deferredPrompt=null;
const installBtn=document.getElementById('installBtn');
const displayModeStandalone=()=>['standalone','fullscreen','minimal-ui'].some(mode=>window.matchMedia(`(display-mode: ${mode})`).matches);
const launchedFromAndroidApp=()=>document.referrer?.startsWith('android-app://');
const standalone=()=>displayModeStandalone()||window.navigator.standalone===true||launchedFromAndroidApp();
const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

function syncInstallUI(){
  const canInstall=!!deferredPrompt&&!standalone();
  if(!installBtn)return;
  installBtn.hidden=!canInstall;
  installBtn.style.display=canInstall?'grid':'none';
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
window.addEventListener('appinstalled',()=>{deferredPrompt=null;syncInstallUI();document.getElementById('iosInstallHint')?.remove()});
['standalone','fullscreen','minimal-ui'].forEach(mode=>window.matchMedia(`(display-mode: ${mode})`).addEventListener?.('change',syncInstallUI));
window.addEventListener('pageshow',syncInstallUI);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncInstallUI()});

function maybeShowIosInstallHint(){
  if(!isIos()||standalone()||sessionStorage.getItem('patrickIosInstallHintDismissed'))return;
  const main=document.querySelector('.appMain');if(!main)return;
  main.insertAdjacentHTML('beforebegin',`<aside id="iosInstallHint" class="installHint" aria-label="Instalar Patrick Training"><div><strong>Instala Patrick Training</strong><p>En iPhone o iPad: toca Compartir y luego “Añadir a pantalla de inicio”.</p></div><button id="iosInstallDismiss" type="button" aria-label="Cerrar aviso">${icon('x')}</button></aside>`);
  document.getElementById('iosInstallDismiss').onclick=()=>{sessionStorage.setItem('patrickIosInstallHintDismissed','1');document.getElementById('iosInstallHint')?.remove()};
}

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(syncInstallUI).catch(console.warn));
window.addEventListener('load',maybeShowIosInstallHint);
syncInstallUI();
