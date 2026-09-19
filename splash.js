(()=>{'use strict';
  const splash=document.querySelector('.appSplash');if(!splash)return;
  const started=performance.now(),MIN=700,MAX=4500;let done=false;
  const finish=()=>{if(done)return;done=true;const wait=Math.max(0,MIN-(performance.now()-started));setTimeout(()=>{splash.classList.add('is-done');setTimeout(()=>splash.remove(),460)},wait)};
  document.addEventListener('patrick:ready',finish,{once:true});setTimeout(finish,MAX);
})();
