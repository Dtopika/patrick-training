let deferredPrompt=null;
const installBtn=document.getElementById('installBtn');
const installHint=document.getElementById('installHint');

function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}
function setInstallState(){
  if(!installBtn)return;
  if(isStandalone()){
    installBtn.textContent='✓ Instalada';
    installBtn.disabled=true;
    installBtn.classList.add('installed');
    if(installHint)installHint.textContent='Patrick Training está instalada en este dispositivo.';
  }
}

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredPrompt=e;
  if(installBtn){installBtn.hidden=false;installBtn.disabled=false;installBtn.textContent='Instalar app';}
  if(installHint)installHint.textContent='Lista para instalar como app en tu celular.';
});

if(installBtn){
  installBtn.addEventListener('click',async()=>{
    if(isStandalone())return;
    if(deferredPrompt){
      deferredPrompt.prompt();
      const choice=await deferredPrompt.userChoice;
      if(choice.outcome==='accepted'){
        installBtn.textContent='Instalando…';
        installBtn.disabled=true;
      }
      deferredPrompt=null;
      return;
    }
    alert('Abre Patrick Training directamente en Chrome o Samsung Internet. Luego toca el menú ⋮ y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.');
  });
}

window.addEventListener('appinstalled',()=>{
  deferredPrompt=null;
  setInstallState();
});

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker:',err)));
}
setInstallState();
