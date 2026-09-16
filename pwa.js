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

const profileV46SystemTheme=window.matchMedia('(prefers-color-scheme: dark)');
const PROFILE_V46_MONTH_MS=30.4375*24*60*60*1000;

function profileV46CurrentAgeMonths(){
  const base=Number(dogProfile?.ageMonths||0);
  if(!Number.isFinite(base)||base<=0)return 0;
  const savedAt=Date.parse(dogProfile?.ageUpdatedAt||'');
  if(!Number.isFinite(savedAt))return Math.max(1,Math.round(base));
  const elapsed=Math.max(0,Math.floor((Date.now()-savedAt)/PROFILE_V46_MONTH_MS));
  return Math.max(1,Math.round(base)+elapsed);
}

function profileV46AgeLabel(){
  const months=profileV46CurrentAgeMonths();
  if(!months)return 'Edad sin configurar';
  if(months<12)return `${months} ${months===1?'mes':'meses'}`;
  const years=Math.round((months/12)*10)/10;
  const shown=Number.isInteger(years)?String(years):String(years).replace('.',',');
  return `${shown} ${years===1?'año':'años'}`;
}

function profileV46StageLabel(){
  const months=profileV46CurrentAgeMonths();
  if(!months)return '';
  return months<12?'Cachorro':'Adulto';
}

function profileV46ApplySystemTheme(){
  const dark=profileV46SystemTheme.matches;
  document.body.classList.toggle('dark',dark);
  document.documentElement.style.colorScheme=dark?'dark':'light';
  const themeMeta=document.querySelector('meta[name="theme-color"]');
  if(themeMeta)themeMeta.content=dark?'#0d111b':'#f6f7f9';
  const value=document.getElementById('systemThemeValue');
  if(value)value.textContent=`Sistema · ${dark?'Oscuro':'Claro'}`;
}

function profileV46EnsureAgeEditor(){
  const nameInput=document.getElementById('dogNameInput');
  const nameField=nameInput?.closest('.profileField');
  if(!nameField||document.getElementById('dogAgeInput'))return;
  nameField.insertAdjacentHTML('afterend',`
    <div class="profileAgeGrid">
      <label class="profileField"><span>Edad</span><input id="dogAgeInput" type="number" min="1" max="360" step="1" inputmode="decimal" placeholder="3"></label>
      <label class="profileField"><span>Unidad</span><select id="dogAgeUnit"><option value="months">Meses</option><option value="years">Años</option></select></label>
    </div>
    <div id="dogAgePreview" class="profileAgePreview">Edad sin configurar</div>`);
  const input=document.getElementById('dogAgeInput');
  const unit=document.getElementById('dogAgeUnit');
  unit.dataset.previous='months';
  unit.addEventListener('change',()=>{
    const previous=unit.dataset.previous||'months';
    const value=Number(input.value||0);
    if(value>0){
      const months=previous==='years'?value*12:value;
      input.value=unit.value==='years'?String(Math.round((months/12)*10)/10):String(Math.max(1,Math.round(months)));
    }
    unit.dataset.previous=unit.value;
    input.step=unit.value==='years'?'0.1':'1';
    profileV46UpdateAgePreview();
  });
  input.addEventListener('input',profileV46UpdateAgePreview);
}

function profileV46PopulateAgeEditor(){
  profileV46EnsureAgeEditor();
  const input=document.getElementById('dogAgeInput');
  const unit=document.getElementById('dogAgeUnit');
  if(!input||!unit)return;
  const months=profileV46CurrentAgeMonths();
  if(months>=12){
    unit.value='years';
    unit.dataset.previous='years';
    input.step='0.1';
    input.value=String(Math.round((months/12)*10)/10);
  }else{
    unit.value='months';
    unit.dataset.previous='months';
    input.step='1';
    input.value=months?String(months):'';
  }
  profileV46UpdateAgePreview();
}

function profileV46UpdateAgePreview(){
  const input=document.getElementById('dogAgeInput');
  const unit=document.getElementById('dogAgeUnit');
  const preview=document.getElementById('dogAgePreview');
  if(!input||!unit||!preview)return;
  const value=Number(input.value||0);
  if(!value){preview.textContent='Indica la edad de tu perro.';return}
  const months=Math.max(1,Math.round(unit.value==='years'?value*12:value));
  const stage=months<12?'Cachorro':'Adulto';
  if(months<12)preview.textContent=`${stage} · ${months} ${months===1?'mes':'meses'}`;
  else{
    const years=Math.round((months/12)*10)/10;
    const shown=Number.isInteger(years)?String(years):String(years).replace('.',',');
    preview.textContent=`${stage} · ${shown} ${years===1?'año':'años'}`;
  }
}

function profileV46SyncDrawer(){
  const drawer=document.getElementById('settingsDrawer');
  if(!drawer)return;
  const themeButton=document.getElementById('settingsThemeBtn');
  if(themeButton){
    const group=themeButton.closest('.settingsGroup');
    if(group)group.innerHTML='<div class="settingsGroupTitle">Apariencia</div><div class="settingsMeta"><strong>Tema</strong><span id="systemThemeValue" class="settingsValue">Sistema</span></div>';
  }
  document.getElementById('resetBtn')?.remove();
  const profileHelp=document.querySelector('#editDogBtn .settingsRowCopy small');
  if(profileHelp)profileHelp.textContent='Nombre y edad sin perder progreso.';
  const identityMeta=document.querySelector('.settingsDrawerIdentity span');
  if(identityMeta){
    const stage=profileV46StageLabel();
    const age=profileV46AgeLabel();
    identityMeta.textContent=`Pastor alemán${stage?` · ${stage}`:''} · ${age}`;
  }
  const version=document.querySelector('.settingsDrawerFoot span');
  if(version)version.textContent='v4.6';
  profileV46ApplySystemTheme();
}

function profileV46SaveDogProfile(){
  const nameInput=document.getElementById('dogNameInput');
  const ageInput=document.getElementById('dogAgeInput');
  const ageUnit=document.getElementById('dogAgeUnit');
  const name=nameInput?.value.trim().replace(/\s+/g,' ').slice(0,24)||'';
  if(!name){toast('Escribe el nombre de tu perro');nameInput?.focus();return}
  const ageValue=Number(ageInput?.value||0);
  if(!Number.isFinite(ageValue)||ageValue<=0){toast('Indica la edad de tu perro');ageInput?.focus();return}
  const ageMonths=Math.max(1,Math.round(ageUnit?.value==='years'?ageValue*12:ageValue));
  dogProfile={...dogProfile,name,breed:'Pastor Alemán',ageMonths,ageUpdatedAt:new Date().toISOString()};
  store.set('patrickDogProfile',dogProfile);
  document.getElementById('profileDialog')?.close();
  renderAll();
  renderCommands();
  profileV46SyncDrawer();
  toast(`Perfil de ${name} guardado`);
}

function profileV46Setup(){
  try{store.remove('patrickDark')}catch{}
  try{localStorage.removeItem('patrickDark')}catch{}
  profileV46ApplySystemTheme();
  if(profileV46SystemTheme.addEventListener)profileV46SystemTheme.addEventListener('change',profileV46ApplySystemTheme);
  else profileV46SystemTheme.addListener?.(profileV46ApplySystemTheme);

  profileV46EnsureAgeEditor();
  const dialog=document.getElementById('profileDialog');
  if(dialog){
    new MutationObserver(()=>{
      if(!dialog.open)return;
      const firstRun=dialog.dataset.firstRun==='1';
      document.getElementById('profileDialogTitle').textContent=firstRun?'Cuéntame sobre tu pastor alemán':`Perfil de ${dogName()}`;
      document.getElementById('profileDialogText').textContent=firstRun?'Configura su nombre y edad. Patrick Training seguirá siendo el nombre de la app y personalizará las sesiones para tu perro.':'Puedes cambiar el nombre y la edad sin perder niveles, sesiones ni estadísticas.';
      profileV46PopulateAgeEditor();
    }).observe(dialog,{attributes:true,attributeFilter:['open']});
    dialog.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        e.stopImmediatePropagation();
        profileV46SaveDogProfile();
      }
    },true);
  }
  const save=document.getElementById('saveProfileBtn');
  if(save)save.onclick=profileV46SaveDogProfile;

  if(typeof syncSettingsDrawer==='function'){
    const previousSync=syncSettingsDrawer;
    syncSettingsDrawer=function(){previousSync();profileV46SyncDrawer()};
  }
  profileV46SyncDrawer();
  if(dialog?.open)profileV46PopulateAgeEditor();
}

Promise.resolve(window.PATRICK_READY).then(()=>queueMicrotask(profileV46Setup)).catch(console.warn);
