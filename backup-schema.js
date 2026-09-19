(()=>{'use strict';
  const CONTEXT_ENVIRONMENTS=['Casa','Exterior tranquilo','Calle','Parque'];
  const CONTEXT_DISTRACTIONS=['Baja','Media','Alta'];

  function plainObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value)}
  function fail(message){throw new Error(message)}
  function commandSet(commands){return new Set((commands||[]).map(c=>c.cmd))}
  function normalizeTrainingContext(value,fallback={environment:'Casa',distraction:'Baja'}){
    const source=value==null?fallback:value;
    if(!plainObject(source))fail('Contexto de entrenamiento inválido');
    const environment=String(source.environment||'Casa'),distraction=String(source.distraction||'Baja');
    if(!CONTEXT_ENVIRONMENTS.includes(environment)||!CONTEXT_DISTRACTIONS.includes(distraction))fail('Contexto de entrenamiento inválido');
    return{environment,distraction};
  }
  function normalizeProfile(value,currentProfile){
    if(value==null)return currentProfile;
    if(!plainObject(value))fail('Perfil inválido');
    const rawName=String(value.name??'').trim().replace(/\s+/g,' ');
    if(rawName.length>24)fail('Nombre demasiado largo');
    const age=value.ageMonths==null?null:Number(value.ageMonths);
    if(age!==null&&(!Number.isInteger(age)||age<1||age>240))fail('Edad inválida');
    const ageUpdatedAt=value.ageUpdatedAt==null?null:String(value.ageUpdatedAt);
    if(ageUpdatedAt&&Number.isNaN(Date.parse(ageUpdatedAt)))fail('Fecha de edad inválida');
    return{name:rawName,breed:'Pastor Alemán',...(age!==null?{ageMonths:age}:{}),...(ageUpdatedAt?{ageUpdatedAt}:{})};
  }
  function normalizeProgress(value,commands,states){
    if(value==null)return{};if(!plainObject(value))fail('Progreso inválido');
    const known=commandSet(commands),out={};
    for(const [cmd,state] of Object.entries(value)){if(!known.has(cmd)||!states.includes(state))fail('Estado de comando inválido');out[cmd]=state}
    return out;
  }
  function normalizeTrials(value,commands){
    if(value==null)return{};if(!plainObject(value))fail('Pruebas inválidas');
    const known=commandSet(commands),out={};
    for(const [cmd,list] of Object.entries(value)){
      if(!known.has(cmd)||!Array.isArray(list)||list.length>10)fail('Historial de ejecuciones inválido');
      const scores=list.map(Number);if(scores.some(n=>![0,.5,1].includes(n)))fail('Puntuación de ejecución inválida');out[cmd]=scores;
    }
    return out;
  }
  function normalizeHistory(value,commands){
    if(value==null)return[];if(!Array.isArray(value)||value.length>200)fail('Historial de sesiones inválido');
    const known=commandSet(commands);
    return value.map(item=>{
      if(!plainObject(item)||Number.isNaN(Date.parse(item.at||'')))fail('Sesión inválida');
      const level=Number(item.level);if(!Number.isInteger(level)||level<0||level>10||!plainObject(item.results||{}))fail('Nivel o resultados de sesión inválidos');
      const results={},timings={};
      for(const [cmd,r] of Object.entries(item.results)){
        if(!known.has(cmd)||!plainObject(r))fail('Comando de sesión inválido');
        const achieved=Number(r.achieved),assisted=Number(r.assisted),missed=Number(r.missed),total=Number(r.total),score=Number(r.score),avgSeconds=Number(r.avgSeconds||0);
        if([achieved,assisted,missed,total].some(n=>!Number.isInteger(n)||n<0||n>5)||achieved+assisted+missed!==total||total>5||!Number.isFinite(score)||score<0||score>5||!Number.isFinite(avgSeconds)||avgSeconds<0||avgSeconds>3600)fail('Resultado de sesión inválido');
        const outcomes=r.outcomes===undefined?undefined:Array.isArray(r.outcomes)?r.outcomes.map(String):null;
        if(outcomes!==undefined&&(outcomes===null||outcomes.length!==total||outcomes.some(x=>!['achieved','assisted','missed'].includes(x))))fail('Detalle de resultados inválido');
        results[cmd]={achieved,assisted,missed,total,score,avgSeconds,...(outcomes?{outcomes}:{})};
      }
      if(item.timings!==undefined){
        if(!plainObject(item.timings))fail('Tiempos de sesión inválidos');
        for(const [cmd,list] of Object.entries(item.timings)){
          if(!known.has(cmd)||!Array.isArray(list)||list.length>5)fail('Tiempos de comando inválidos');
          const safe=list.map(Number);if(safe.some(n=>!Number.isFinite(n)||n<0||n>3600000))fail('Tiempo de ejecución inválido');timings[cmd]=safe;
        }
      }
      const context=normalizeTrainingContext(item.context),timingMode=item.timingMode===undefined?undefined:String(item.timingMode);
      if(timingMode!==undefined&&timingMode!=='cue-to-rating')fail('Modo de tiempo de sesión inválido');
      return{version:Number(item.version)||5,at:new Date(item.at).toISOString(),level,dogName:String(item.dogName||'Patrick').trim().slice(0,24)||'Patrick',results,timings,context,...(timingMode?{timingMode}:{})};
    });
  }
  function normalizeNotifications(value){
    if(value==null)return null;if(!plainObject(value))fail('Recordatorios inválidos');
    const time=String(value.time||'19:00');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail('Hora de recordatorio inválida');
    return{enabled:!!value.enabled,time,lastNotifiedDate:null};
  }
  function normalizeTheme(value,current='system'){
    const theme=String(value??current??'system');return['system','light','dark'].includes(theme)?theme:'system';
  }
  function normalizeGermanVoice(value,current='auto'){
    const voice=String(value??current??'auto').trim();return voice&&voice.length<=256?voice:'auto';
  }
  function normalizeHistoryArchive(value,commands){
    if(value==null)return{version:1,totalSessions:0,months:{}};
    if(!plainObject(value))fail('Archivo histórico inválido');
    const known=commandSet(commands),months={};let totalSessions=0;
    for(const [key,month] of Object.entries(value.months||{})){
      if(!/^\d{4}-\d{2}$/.test(key)||!plainObject(month))fail('Mes de archivo inválido');
      const sessions=Number(month.sessions),score=Number(month.score||0),total=Number(month.total||0);
      if(!Number.isInteger(sessions)||sessions<0||sessions>100000||!Number.isFinite(score)||score<0||!Number.isFinite(total)||total<0)fail('Resumen mensual inválido');
      const contexts={};for(const [label,count] of Object.entries(month.contexts||{})){const n=Number(count);if(!Number.isInteger(n)||n<0)fail('Contexto archivado inválido');contexts[String(label).slice(0,80)]=n}
      const archivedCommands={};
      for(const [cmd,data] of Object.entries(month.commands||{})){
        if(!known.has(cmd)||!plainObject(data))fail('Comando archivado inválido');
        const item={sessions:Number(data.sessions),score:Number(data.score||0),total:Number(data.total||0),timedSessions:Number(data.timedSessions||0),seconds:Number(data.seconds||0)};
        if(!Number.isInteger(item.sessions)||item.sessions<0||!Number.isFinite(item.score)||item.score<0||!Number.isFinite(item.total)||item.total<0||!Number.isInteger(item.timedSessions)||item.timedSessions<0||!Number.isFinite(item.seconds)||item.seconds<0)fail('Resumen de comando archivado inválido');
        archivedCommands[cmd]=item;
      }
      months[key]={sessions,score,total,contexts,commands:archivedCommands};totalSessions+=sessions;
    }
    return{version:1,totalSessions,months};
  }
  function normalize(data,{commands=[],states=[],currentProfile=null,currentTrainingContext={environment:'Casa',distraction:'Baja'},currentTheme='system',currentGermanVoice='auto',maxSchemaVersion=11}={}){
    if(!plainObject(data))fail('Formato de respaldo inválido');
    const schema=Number(data.schemaVersion??data.version??5);
    if(!Number.isFinite(schema)||schema<5||schema>maxSchemaVersion)fail('Versión de respaldo no compatible');
    const currentLevel=Number(data.currentLevel??0);if(!Number.isInteger(currentLevel)||currentLevel<0||currentLevel>10)fail('Nivel actual inválido');
    const dayType=data.dayType??'Todo el día';if(!['Todo el día','Solo noche'].includes(dayType))fail('Disponibilidad inválida');
    return{
      progress:normalizeProgress(data.progress,commands,states),
      trials:normalizeTrials(data.trials,commands),
      history:normalizeHistory(data.history,commands),
      currentLevel,dayType,
      profile:normalizeProfile(data.profile,currentProfile),
      trainingContext:normalizeTrainingContext(data.trainingContext,currentTrainingContext),
      theme:normalizeTheme(data.theme,currentTheme),
      germanVoice:normalizeGermanVoice(data.germanVoice,currentGermanVoice),
      historyArchive:normalizeHistoryArchive(data.historyArchive,commands),
      teachingGuideVersion:Math.max(0,Math.min(100,Number.isInteger(Number(data.teachingGuideVersion))?Number(data.teachingGuideVersion):0)),
      notifications:normalizeNotifications(data.notifications)
    };
  }
  globalThis.PatrickBackupSchema=Object.freeze({normalize});
})();
