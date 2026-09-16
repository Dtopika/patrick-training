const VIDEO_LIBRARY=window.PATRICK_VIDEOS||{};

function demoSteps(c){return[
  ['1','Señal / gesto',c.signal],
  ['2','Qué debe hacer',c.action],
  ['3','Cómo enseñarlo',c.how],
  ['4','Dónde premiar',c.reward]
]}

function openDemo(c){
  if(!c)return;
  const meta=VIDEO_LIBRARY[c.cmd];
  $('#demoCommand').textContent=c.cmd;
  $('#demoPron').textContent=c.pron;
  $('#demoMeaning').textContent=c.meaning;
  $('#demoSteps').innerHTML=demoSteps(c).map(([n,t,x])=>`<article class="demoStep"><span>${n}</span><div><strong>${escapeHtml(t)}</strong><p>${escapeHtml(x)}</p></div></article>`).join('');
  const frame=$('#demoFrame'), empty=$('#demoEmpty'), external=$('#demoExternal');
  if(meta?.youtubeId){
    frame.hidden=false;
    empty.hidden=true;
    frame.src=`https://www.youtube-nocookie.com/embed/${meta.youtubeId}?playsinline=1&rel=0&modestbranding=1`;
    $('#demoVideoTitle').textContent=meta.title;
    $('#demoVideoSource').textContent=meta.source;
    external.hidden=false;
    external.href=`https://www.youtube.com/watch?v=${meta.youtubeId}`;
  }else{
    frame.hidden=true;
    frame.removeAttribute('src');
    empty.hidden=false;
    $('#demoVideoTitle').textContent='Guía visual';
    $('#demoVideoSource').textContent='El video de este comando todavía está en preparación.';
    external.hidden=false;
    external.href=`https://www.youtube.com/results?search_query=${encodeURIComponent('dog training '+c.meaning+' positive reinforcement')}`;
    external.textContent='Buscar tutorial en YouTube ↗';
  }
  $('#demoDialog').showModal();
}

function closeDemo(){
  const frame=$('#demoFrame');
  frame.removeAttribute('src');
  $('#demoExternal').textContent='Abrir tutorial completo ↗';
  $('#demoDialog').close();
}

function decorateDemoButtons(){
  $$('.commandCard').forEach(card=>{
    const actions=card.querySelector('.commandActions');
    if(!actions||actions.querySelector('.demoBtn'))return;
    const btn=document.createElement('button');
    btn.className='demoBtn';
    btn.dataset.demo=card.dataset.command;
    btn.setAttribute('aria-label',`Ver demostración de ${card.dataset.command}`);
    btn.title='Ver demostración';
    btn.textContent='🎥';
    const practice=actions.querySelector('.practiceBtn');
    practice?actions.insertBefore(btn,practice):actions.appendChild(btn);
  });
}

document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-demo]');
  if(btn)openDemo(commandBy(btn.dataset.demo));
});

$('#sessionDemoBtn')?.addEventListener('click',()=>openDemo(commandBy($('#sessionCommandTitle').textContent)));
$('#closeDemoBtn')?.addEventListener('click',closeDemo);
$('#demoDialog')?.addEventListener('click',e=>{if(e.target===$('#demoDialog'))closeDemo()});

const commandList=$('#commandList');
if(commandList){
  new MutationObserver(decorateDemoButtons).observe(commandList,{childList:true,subtree:true});
  queueMicrotask(decorateDemoButtons);
}
