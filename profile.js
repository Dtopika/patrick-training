const SYSTEM_THEME=window.matchMedia('(prefers-color-scheme: dark)');
const DOG_MONTH_MS=30.4375*24*60*60*1000;
let profileUiInitialized=false;

function currentDogAgeMonths(){
  const base=Number(dogProfile?.ageMonths||0);
  if(!Number.isFinite(base)||base<=0)return 0;
  const savedAt=Date.parse(dogProfile?.ageUpdatedAt||'');
  if(!Number.isFinite(savedAt))return Math.max(1,Math.round(base));
  const elapsed=Math.max(0,Math.floor((Date.now()-savedAt)/DOG_MONTH_MS));
  return Math.max(1,Math.round(base)+elapsed);
}
function dogAgeLabel(){
  const months=currentDogAgeMonths();
  if(!months)return 'Edad sin configurar';
  if(months<12)return `${months} ${months===1?'mes':'meses'}`;
  const years=Math.round((months/12)*10)/10;
  const shown=Number.isInteger(years)?String(years):String(years).replace('.',',');
  return `${shown} ${years===1?'año':'años'}`;
}
function dogStageLabel(){const months=currentDogAgeMonths();return !months?'':months<12?'Cachorro':'Adulto'}

function applySystemTheme(){
  const dark=SYSTEM_THEME.matches;
  document.body.classList.toggle('dark',dark);
  document.documentElement.style.colorScheme=dark?'dark':'light';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=dark?'#0d111b':'#f6f7f9';
  const value=$('#systemThemeValue');
  if(value)value.textContent=`Sistema · ${dark?'Oscuro':'Claro'}`;
}

function populateDogProfileEditor(){
  const months=currentDogAgeMonths();
  $('#dogNameInput').value=dogProfile?.name||'';
  if(months>=12){
    $('#dogAgeUnit').value='years';
    $('#dogAgeInput').step='0.1';
    $('#dogAgeInput').value=String(Math.round((months/12)*10)/10);
  }else{
    $('#dogAgeUnit').value='months';
    $('#dogAgeInput').step='1';
    $('#dogAgeInput').value=months?String(months):'';
  }
  $('#dogAgeUnit').dataset.previous=$('#dogAgeUnit').value;
  updateDogAgePreview();
}
function updateDogAgePreview(){
  const value=Number($('#dogAgeInput')?.value||0),unit=$('#dogAgeUnit')?.value;
  const preview=$('#dogAgePreview');if(!preview)return;
  if(!value){preview.textContent='Indica la edad de tu perro.';return}
  const months=Math.max(1,Math.round(unit==='years'?value*12:value));
  if(months<12){preview.textContent=`Cachorro · ${months} ${months===1?'mes':'meses'}`;return}
  const years=Math.round((months/12)*10)/10;
  const shown=Number.isInteger(years)?String(years):String(years).replace('.',',');
  preview.textContent=`Adulto · ${shown} ${years===1?'año':'años'}`;
}
function openDogProfileEditor(firstRun=false,ageOnly=false){
  const dialog=$('#profileDialog');
  dialog.dataset.firstRun=firstRun?'1':'0';
  $('#profileDialogTitle').textContent=firstRun?'Cuéntame sobre tu pastor alemán':ageOnly?`Completa el perfil de ${dogName()}`:`Perfil de ${dogName()}`;
  $('#profileDialogText').textContent=firstRun?'Configura su nombre y edad. Patrick Training seguirá siendo el nombre de la app y personalizará las sesiones para tu perro.':ageOnly?'Añade su edad para que la app pueda mostrar su etapa de vida sin tocar tu progreso.':'Puedes cambiar el nombre y la edad sin perder niveles, sesiones ni estadísticas.';
  $('#profileCancelBtn').hidden=firstRun;
  $('#saveProfileBtn').textContent=firstRun?'Guardar y empezar':'Guardar cambios';
  populateDogProfileEditor();
  if(!dialog.open)dialog.showModal();
  setTimeout(()=>$(firstRun?'#dogNameInput':ageOnly?'#dogAgeInput':'#dogNameInput')?.focus(),80);
}
function saveDogProfile(){
  const name=$('#dogNameInput').value.trim().replace(/\s+/g,' ').slice(0,24);
  if(!name){toast('Escribe el nombre de tu perro');$('#dogNameInput').focus();return}
  const ageValue=Number($('#dogAgeInput').value||0),unit=$('#dogAgeUnit').value;
  if(!Number.isFinite(ageValue)||ageValue<=0){toast('Indica la edad de tu perro');$('#dogAgeInput').focus();return}
  const ageMonths=Math.max(1,Math.round(unit==='years'?ageValue*12:ageValue));
  dogProfile={...dogProfile,name,breed:'Pastor Alemán',ageMonths,ageUpdatedAt:new Date().toISOString()};
  store.set('patrickDogProfile',dogProfile);
  $('#profileDialog').close();
  renderAll();renderCommands();syncSettingsDrawer();
  toast(`Perfil de ${name} guardado`);
}

function exportProgress(){
  const payload={version:5,exportedAt:new Date().toISOString(),profile:dogProfile,storage:storageMode,progress,trials,history,currentLevel,dayType};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`patrick-training-${dogName().toLowerCase().replace(/[^a-z0-9]+/gi,'-')||'backup'}.json`;a.click();URL.revokeObjectURL(a.href);toast('Respaldo descargado');
}

function ensureSettingsDrawer(){
  if($('#settingsDrawer'))return;
  document.body.insertAdjacentHTML('beforeend',`
    <div id="settingsBackdrop" class="settingsBackdrop" hidden></div>
    <aside id="settingsDrawer" class="settingsDrawer" aria-hidden="true" aria-label="Configuración de Patrick Training">
      <header class="settingsDrawerHead">
        <img src="icons/icon-192.webp" alt="">
        <div class="settingsDrawerIdentity"><small>PERFIL ACTIVO</small><strong id="dogProfileName">${escapeHtml(dogName())}</strong><span id="dogProfileMeta">Pastor alemán</span></div>
        <button id="settingsCloseBtn" class="settingsCloseBtn iconButton" type="button" aria-label="Cerrar configuración">${icon('x')}</button>
      </header>
      <div class="settingsDrawerBody">
        <section class="settingsGroup">
          <div class="settingsGroupTitle">Perro</div>
          <button id="editDogBtn" class="settingsRow" type="button">
            <span class="settingsRowIcon">${icon('dog')}</span><span class="settingsRowCopy"><strong>Perfil del perro</strong><small>Nombre y edad sin perder progreso.</small></span><span class="settingsChevron">${icon('chevron')}</span>
          </button>
        </section>
        <section class="settingsGroup">
          <div class="settingsGroupTitle">Entrenamiento</div>
          <div class="settingsField"><label><span class="settingsRowIcon">${icon('clock')}</span><span class="settingsRowCopy"><strong>Disponibilidad</strong><small>Define cuántas micro-sesiones te proponemos.</small></span></label><select id="settingsDayType" aria-label="Disponibilidad de entrenamiento"><option value="Todo el día">Durante el día</option><option value="Solo noche">Solo noche</option></select></div>
        </section>
        <section class="settingsGroup">
          <div class="settingsGroupTitle">Apariencia</div>
          <div class="settingsMeta"><strong>Tema</strong><span id="systemThemeValue" class="settingsValue">Sistema</span></div>
        </section>
        <section class="settingsGroup">
          <div class="settingsGroupTitle">Datos</div>
          <div class="settingsMeta"><strong>Almacenamiento</strong><span id="storageModeLabel" class="storageBadge">IndexedDB</span></div>
          <button id="exportBtn" class="settingsRow" type="button">
            <span class="settingsRowIcon">${icon('download')}</span><span class="settingsRowCopy"><strong>Exportar respaldo</strong><small>Descarga perfil, progreso y sesiones.</small></span><span class="settingsChevron">${icon('chevron')}</span>
          </button>
        </section>
      </div>
      <footer class="settingsDrawerFoot"><strong>Patrick Training</strong><span>v5.0</span></footer>
    </aside>`);
}
function syncSettingsDrawer(){
  if(!$('#settingsDrawer'))return;
  renderDogIdentity();
  $('#settingsDayType').value=dayType;
  const stage=dogStageLabel(),age=dogAgeLabel();
  $('#dogProfileMeta').textContent=`Pastor alemán${stage?` · ${stage}`:''} · ${age}`;
  applySystemTheme();
}
function openSettingsDrawer(){
  ensureSettingsDrawer();syncSettingsDrawer();
  const drawer=$('#settingsDrawer'),backdrop=$('#settingsBackdrop');backdrop.hidden=false;
  drawer.setAttribute('aria-hidden','false');document.body.classList.add('settingsOpen');
  requestAnimationFrame(()=>{drawer.classList.add('open');backdrop.classList.add('open')});
  setTimeout(()=>$('#settingsCloseBtn')?.focus(),120);
}
function closeSettingsDrawer(){
  const drawer=$('#settingsDrawer'),backdrop=$('#settingsBackdrop');if(!drawer)return;
  drawer.classList.remove('open');backdrop.classList.remove('open');drawer.setAttribute('aria-hidden','true');document.body.classList.remove('settingsOpen');
  setTimeout(()=>{if(!backdrop.classList.contains('open'))backdrop.hidden=true},280);
}
function bindProfileUI(){
  $('#settingsAvatarBtn').onclick=openSettingsDrawer;
  $('#settingsCloseBtn').onclick=closeSettingsDrawer;
  $('#settingsBackdrop').onclick=closeSettingsDrawer;
  $('#editDogBtn').onclick=()=>{closeSettingsDrawer();setTimeout(()=>openDogProfileEditor(false),180)};
  $('#settingsDayType').onchange=e=>{dayType=e.target.value;store.set('patrickDayType',dayType);$('#dayType').value=dayType;renderToday();syncSettingsDrawer()};
  $('#exportBtn').onclick=exportProgress;
  $('#saveProfileBtn').onclick=saveDogProfile;
  $('#profileCancelBtn').onclick=()=>$('#profileDialog').close();
  $('#dogNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveDogProfile()}});
  $('#dogAgeInput').addEventListener('input',updateDogAgePreview);
  $('#dogAgeUnit').addEventListener('change',()=>{
    const input=$('#dogAgeInput'),unit=$('#dogAgeUnit'),previous=unit.dataset.previous||'months',value=Number(input.value||0);
    if(value>0){const months=previous==='years'?value*12:value;input.value=unit.value==='years'?String(Math.round((months/12)*10)/10):String(Math.max(1,Math.round(months)))}
    unit.dataset.previous=unit.value;input.step=unit.value==='years'?'0.1':'1';updateDogAgePreview();
  });
  $('#profileDialog').addEventListener('cancel',e=>{if($('#profileDialog').dataset.firstRun==='1')e.preventDefault()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#settingsDrawer')?.classList.contains('open'))closeSettingsDrawer()});
}
function initProfileUI(){
  if(profileUiInitialized)return;profileUiInitialized=true;
  try{store.remove('patrickDark');localStorage.removeItem('patrickDark')}catch{}
  applySystemTheme();
  SYSTEM_THEME.addEventListener?.('change',applySystemTheme);
  ensureSettingsDrawer();bindProfileUI();syncSettingsDrawer();
  const hasName=String(dogProfile?.name||'').trim(),hasAge=currentDogAgeMonths()>0;
  if(!hasName)setTimeout(()=>openDogProfileEditor(true),80);
  else if(!hasAge)setTimeout(()=>openDogProfileEditor(false,true),300);
}
