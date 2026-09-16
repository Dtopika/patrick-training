let deferredPrompt=null;
const installBtn=document.getElementById('installBtn');
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;

function syncInstallUI(){
  const canInstall=!!deferredPrompt&&!standalone();
  if(installBtn) installBtn.hidden=!canInstall;
}

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredPrompt=e;
  syncInstallUI();
});

async function install(){
  if(!deferredPrompt)return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  syncInstallUI();
}

installBtn?.addEventListener('click',install);
window.addEventListener('appinstalled',()=>{
  deferredPrompt=null;
  syncInstallUI();
});

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
}

syncInstallUI();
