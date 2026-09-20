const VIDEO_LIBRARY=window.PATRICK_VIDEOS||{};

function teachingFlow(c){
  const marker=displayCommand(commandBy('Ja!')),response=appLanguage==='en'?'Response':appLanguage==='de'?'Reaktion':'Respuesta',markText=appLanguage==='en'?`Mark the correct instant with ${marker}`:appLanguage==='de'?`Markiere den richtigen Moment mit ${marker}`:`Marca el instante correcto con ${marker}`;
  return[['signal',t('signal'),displayCommandDetail(c,'signal')],['target',response,displayCommandDetail(c,'action')],['check',marker,markText],['reward',t('reward'),displayCommandDetail(c,'reward')]]
}
function demoSteps(c){return[
  ['steps',t('howTeach'),displayCommandDetail(c,'how')],
  ['target',appLanguage==='en'?'Success criterion':appLanguage==='de'?'Erfolgskriterium':'Criterio de éxito',displayCommandDetail(c,'action')]
]}

function videoUrls(meta){
  if(meta?.youtubeId)return{embed:`https://www.youtube-nocookie.com/embed/${meta.youtubeId}?playsinline=1&rel=0&modestbranding=1`,external:`https://www.youtube.com/watch?v=${meta.youtubeId}`};
  if(meta?.vimeoId)return{embed:`https://player.vimeo.com/video/${meta.vimeoId}?autopause=0&badge=0&title=0&byline=0`,external:`https://vimeo.com/${meta.vimeoId}`};
  return null;
}

function openDemo(c){
  if(!c)return;const meta=VIDEO_LIBRARY[c.cmd],urls=videoUrls(meta);
  const kicker=$('#demoDialog .demoHeader .kicker');if(kicker)kicker.textContent=copyText('DEMOSTRACIÓN');const emptyTitle=$('#demoEmpty strong');if(emptyTitle)emptyTitle.textContent=copyText('Video en preparación');const emptyText=$('#demoEmpty p');if(emptyText)emptyText.textContent=copyText('Mientras tanto tienes abajo el paso a paso completo.');const listen=$('#demoAudioBtn span');if(listen)listen.textContent=copyText('Escuchar');$('#closeDemoBtn')?.setAttribute('aria-label',copyText('Cerrar demostración'));$('#demoFrame')?.setAttribute('title',copyText('Tutorial de entrenamiento'));$('#demoFlow')?.setAttribute('aria-label',copyText('Secuencia visual de enseñanza'));
  $('#demoCommand').textContent=displayCommand(c);$('#demoPron').textContent=displayPron(c);$('#demoMeaning').textContent=displayMeaning(c);
  $('#demoFlow').innerHTML=teachingFlow(c).map(([ico,t,x],i)=>`<article class="demoFlowStep"><span class="demoFlowNumber">${i+1}</span><span class="coachIcon">${icon(ico)}</span><div><strong>${escapeHtml(t)}</strong><p>${escapeHtml(x)}</p></div></article>`).join('');
  $('#demoSteps').innerHTML=demoSteps(c).map(([ico,t,x])=>`<article class="demoStep"><span class="coachIcon">${icon(ico)}</span><div><strong>${escapeHtml(t)}</strong><p>${escapeHtml(x)}</p></div></article>`).join('');
  $('#demoAudioBtn').onclick=()=>speak(c);
  const frame=$('#demoFrame'),empty=$('#demoEmpty'),external=$('#demoExternal');external.textContent=copyText('Abrir tutorial completo ↗');
  if(meta&&urls){frame.hidden=false;empty.hidden=true;frame.src=urls.embed;$('#demoVideoTitle').textContent=meta.title;$('#demoVideoSource').textContent=meta.source;external.hidden=false;external.href=urls.external}
  else{frame.hidden=true;frame.removeAttribute('src');empty.hidden=false;$('#demoVideoTitle').textContent=copyText('Guía visual');$('#demoVideoSource').textContent=copyText('Todavía no hay un tutorial curado para este comando.');external.hidden=false;external.href=`https://www.youtube.com/results?search_query=${encodeURIComponent('dog training '+displayMeaning(c)+' positive reinforcement')}`;external.textContent=copyText('Buscar tutorial en YouTube ↗')}
  $('#demoDialog').showModal();
}
function closeDemo(){const frame=$('#demoFrame');frame.removeAttribute('src');$('#demoExternal').textContent=copyText('Abrir tutorial completo ↗');$('#demoDialog').close()}
function decorateDemoButtons(){
  $$('.commandCard').forEach(card=>{const actions=card.querySelector('.commandActions');if(!actions||actions.querySelector('.demoBtn'))return;const c=commandBy(card.dataset.command),btn=document.createElement('button');btn.className='demoBtn';btn.dataset.demo=card.dataset.command;btn.setAttribute('aria-label',(appLanguage==='en'?'View demo for ':appLanguage==='de'?'Demo anzeigen für ':'Ver demostración de ')+displayCommand(c||card.dataset.command));btn.title=appLanguage==='en'?'View demo':appLanguage==='de'?'Demo anzeigen':'Ver demostración';btn.innerHTML=icon('video');const practice=actions.querySelector('.practiceBtn');practice?actions.insertBefore(btn,practice):actions.appendChild(btn)});
}
function validateVideoCoverage(){const missing=COMMANDS.filter(c=>!VIDEO_LIBRARY[c.cmd]||!videoUrls(VIDEO_LIBRARY[c.cmd]));if(missing.length)console.warn('Patrick Training: comandos sin video curado',missing.map(c=>c.cmd))}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-demo]');if(btn)openDemo(commandBy(btn.dataset.demo))});
$('#sessionDemoBtn')?.addEventListener('click',()=>{const c=session?.commands?.[session.index];if(c)openDemo(c)});
$('#closeDemoBtn')?.addEventListener('click',closeDemo);$('#demoDialog')?.addEventListener('click',e=>{if(e.target===$('#demoDialog'))closeDemo()});
const commandList=$('#commandList');if(commandList){new MutationObserver(decorateDemoButtons).observe(commandList,{childList:true,subtree:true});queueMicrotask(decorateDemoButtons)}validateVideoCoverage();
