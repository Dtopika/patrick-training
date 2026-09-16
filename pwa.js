let deferredPrompt=null;
const installBtn=document.getElementById('installBtn');
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

function syncInstallUI(){const canInstall=!!deferredPrompt&&!standalone();if(installBtn)installBtn.hidden=!canInstall}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;syncInstallUI()});
async function install(){if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;syncInstallUI()}
installBtn?.addEventListener('click',install);
window.addEventListener('appinstalled',()=>{deferredPrompt=null;syncInstallUI();document.getElementById('iosInstallHint')?.remove()});

function maybeShowIosInstallHint(){
  if(!isIos()||standalone()||sessionStorage.getItem('patrickIosInstallHintDismissed'))return;
  const main=document.querySelector('.appMain');if(!main)return;
  main.insertAdjacentHTML('beforebegin',`<aside id="iosInstallHint" class="installHint" aria-label="Instalar Patrick Training"><div><strong>Instala Patrick Training</strong><p>En iPhone o iPad: toca Compartir y luego “Añadir a pantalla de inicio”.</p></div><button id="iosInstallDismiss" type="button" aria-label="Cerrar aviso">${icon('x')}</button></aside>`);
  document.getElementById('iosInstallDismiss').onclick=()=>{sessionStorage.setItem('patrickIosInstallHintDismissed','1');document.getElementById('iosInstallHint')?.remove()};
}

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
window.addEventListener('load',maybeShowIosInstallHint);
syncInstallUI();
