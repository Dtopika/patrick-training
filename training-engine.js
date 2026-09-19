(()=>{'use strict';
  const DAY_MS=86400000;
  const MONTH_MS=30.4375*DAY_MS;
  const CONTEXT_ENVIRONMENTS=Object.freeze(['Casa','Exterior tranquilo','Calle','Parque']);
  const CONTEXT_DISTRACTIONS=Object.freeze(['Baja','Media','Alta']);
  const ENVIRONMENT_WEIGHT=Object.freeze({'Casa':0,'Exterior tranquilo':1,'Calle':2,'Parque':2});
  const DISTRACTION_WEIGHT=Object.freeze({'Baja':0,'Media':1,'Alta':2});

  /** @param {object|null|undefined} profile */
  function effectiveAgeMonths(profile,now=Date.now()){
    const base=Number(profile?.ageMonths||0);
    if(!Number.isFinite(base)||base<=0)return 0;
    const savedAt=Date.parse(profile?.ageUpdatedAt||'');
    if(!Number.isFinite(savedAt))return Math.max(1,Math.round(base));
    const elapsed=Math.max(0,Math.floor((now-savedAt)/MONTH_MS));
    return Math.max(1,Math.round(base)+elapsed);
  }

  function ageStage(profile,now=Date.now()){
    const months=effectiveAgeMonths(profile,now);
    if(!months)return{key:'unknown',label:'Edad sin configurar',months:0};
    if(months<6)return{key:'young-puppy',label:'Cachorro joven',months};
    if(months<12)return{key:'puppy',label:'Cachorro',months};
    if(months<18)return{key:'adolescent',label:'Adolescente',months};
    return{key:'adult',label:'Adulto',months};
  }

  const SAFETY=Object.freeze({
    Hopp:{
      deferBeforeMonths:12,
      cautionBeforeMonths:18,
      label:'Impacto físico',
      message:'Mientras sigue creciendo, evita saltos altos o repetidos. Prioriza superficies bajas, control y técnica; aumenta impacto de forma gradual.'
    },
    Laut:{
      label:'Excitación controlada',
      message:'Practica uno o pocos ladridos y vuelve a calma. No uses confrontación para provocar la conducta.'
    },
    'Pass auf':{
      label:'Control defensivo seguro',
      message:'Debe significar observar y volver a ti, no perseguir, amenazar ni atacar. Trabaja con distancia y estímulos neutros.'
    },
    Hinter:{
      label:'Posición segura',
      message:'Úsalo como posición de refugio detrás de ti. Practica primero en ambientes tranquilos y sin confrontación.'
    }
  });

  function safetyForCommand(command,profile,now=Date.now()){
    const cmd=typeof command==='string'?command:command?.cmd;
    const policy=SAFETY[cmd];if(!policy)return null;
    const months=effectiveAgeMonths(profile,now);
    const defer=!!policy.deferBeforeMonths&&!!months&&months<policy.deferBeforeMonths;
    const caution=!!policy.cautionBeforeMonths&&!!months&&months<policy.cautionBeforeMonths;
    return{...policy,cmd,months,deferFromAdaptive:defer,caution};
  }

  function normalizeContext(value){
    const environment=CONTEXT_ENVIRONMENTS.includes(value?.environment)?value.environment:'Casa';
    const distraction=CONTEXT_DISTRACTIONS.includes(value?.distraction)?value.distraction:'Baja';
    return{environment,distraction};
  }

  function contextSignature(value){
    const context=normalizeContext(value);
    return context.environment+'|'+context.distraction;
  }

  function contextDifficulty(value){
    const context=normalizeContext(value);
    return (ENVIRONMENT_WEIGHT[context.environment]||0)+(DISTRACTION_WEIGHT[context.distraction]||0);
  }

  function contextLabel(value){
    const context=normalizeContext(value);
    return context.environment+' · distracción '+context.distraction.toLowerCase();
  }

  function lastPracticeMs(history,cmd){
    let latest=0;
    for(const item of Array.isArray(history)?history:[]){
      if(!item?.results?.[cmd])continue;
      const t=Date.parse(item.at||'');if(Number.isFinite(t)&&t>latest)latest=t;
    }
    return latest;
  }

  function recentAverage(trials,cmd){
    const arr=Array.isArray(trials?.[cmd])?trials[cmd].map(Number).filter(Number.isFinite):[];
    return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
  }

  function commandContextEvidence(history,cmd){
    const successful=[];
    for(const item of Array.isArray(history)?history:[]){
      const result=item?.results?.[cmd];if(!result)continue;
      const total=Number(result.total)||0,score=Number(result.score)||0;
      if(total<=0||score/total<.8)continue;
      const at=Date.parse(item.at||'');
      const context=normalizeContext(item.context);
      successful.push({at:Number.isFinite(at)?at:0,context,difficulty:contextDifficulty(context),accuracy:score/total});
    }
    const signatures=new Set(successful.map(x=>contextSignature(x.context)));
    const environments=new Set(successful.map(x=>x.context.environment));
    const distractions=new Set(successful.map(x=>x.context.distraction));
    const challenging=successful.filter(x=>x.difficulty>=2).length;
    const mediumPlus=successful.filter(x=>x.context.distraction!=='Baja').length;
    const times=successful.map(x=>x.at).filter(Boolean).sort((a,b)=>a-b);
    const spanDays=times.length>1?(times.at(-1)-times[0])/DAY_MS:0;
    return{
      successfulSessions:successful.length,
      contextCount:signatures.size,
      environmentCount:environments.size,
      distractionCount:distractions.size,
      challengingSessions:challenging,
      mediumPlusSessions:mediumPlus,
      maxDifficulty:successful.reduce((m,x)=>Math.max(m,x.difficulty),0),
      spanDays,
      signatures:[...signatures]
    };
  }

  function nextProgressState(cmd,currentState,{trials={},history=[],stateScore={}}={}){
    const scoreOf=state=>Number(stateScore[state]||0);
    let state=currentState||'No iniciado';
    const arr=Array.isArray(trials?.[cmd])?trials[cmd].map(Number).filter(Number.isFinite):[];
    if(arr.length&&scoreOf(state)<1)state='En práctica';
    const points=arr.reduce((a,b)=>a+b,0);
    if(arr.length>=10&&points>=8&&scoreOf(state)<2)state='Consistente';

    const recent=recentAverage(trials,cmd),evidence=commandContextEvidence(history,cmd);
    if(scoreOf(state)>=2&&scoreOf(state)<3&&recent!==null&&recent>=.8&&
      evidence.successfulSessions>=3&&evidence.contextCount>=2&&evidence.challengingSessions>=1){
      state='Generalizando';
    }
    if(scoreOf(state)>=3&&scoreOf(state)<4&&recent!==null&&recent>=.9&&
      evidence.successfulSessions>=6&&evidence.contextCount>=3&&evidence.challengingSessions>=3&&
      evidence.mediumPlusSessions>=2&&evidence.spanDays>=7){
      state='Dominado';
    }
    return state;
  }

  function recommendedContext(command,{progress={},history=[],stateScore={}}={}){
    const cmd=typeof command==='string'?command:command?.cmd;
    const state=progress[cmd]||'No iniciado',level=Number(stateScore[state]||0);
    const evidence=commandContextEvidence(history,cmd);
    const tried=new Set(evidence.signatures);
    const candidates=level<2
      ?[{environment:'Casa',distraction:'Baja'}]
      :level===2
        ?[{environment:'Casa',distraction:'Media'},{environment:'Exterior tranquilo',distraction:'Baja'},{environment:'Calle',distraction:'Media'}]
        :level===3
          ?[{environment:'Exterior tranquilo',distraction:'Media'},{environment:'Parque',distraction:'Media'},{environment:'Calle',distraction:'Alta'}]
          :[{environment:'Casa',distraction:'Media'},{environment:'Exterior tranquilo',distraction:'Media'},{environment:'Parque',distraction:'Media'}];
    const choice=candidates.find(x=>!tried.has(contextSignature(x)))||candidates[0];
    return{...choice,label:contextLabel(choice)};
  }

  function priorityDetails(command,currentLevel,{trials={},history=[],progress={},stateScore={},profile=null,now=Date.now()}={}){
    const avg=recentAverage(trials,command.cmd),last=lastPracticeMs(history,command.cmd);
    const days=last?Math.max(0,(now-last)/DAY_MS):30,state=Number(stateScore[progress[command.cmd]||'No iniciado']||0);
    const evidence=commandContextEvidence(history,command.cmd);
    let score=command.level===currentLevel?110:38;
    score+=avg===null?34:(1-avg)*72;
    score+=Math.min(days,30)*1.7;
    if(state<2)score+=26;
    if(state===2&&evidence.contextCount<3)score+=30;
    if(state===3&&evidence.contextCount<3)score+=18;
    if(avg!==null&&avg<.7)score+=24;
    if(state>=2&&avg!==null&&avg>=.9&&days<5&&evidence.contextCount>=3)score-=34;

    const reasons=[];
    if(command.level===currentLevel)reasons.push('Es parte del nivel actual');
    if(avg===null)reasons.push('Aún necesita evidencia reciente');
    else if(avg<.7)reasons.push('El rendimiento reciente bajó a '+Math.round(avg*100)+'%');
    else if(state<2)reasons.push('Todavía está construyendo consistencia');
    else if(state===2&&evidence.contextCount<2)reasons.push('Falta probarlo en otro contexto');
    else if(state===2)reasons.push('Conviene seguir generalizándolo');
    else if(state===3)reasons.push('Necesita más evidencia para considerarlo dominado');
    if(days>=7)reasons.push('Lleva '+Math.floor(days)+' días sin practicarse');
    if(!reasons.length)reasons.push('Repaso espaciado para conservar la respuesta');

    const safety=safetyForCommand(command,profile,now);
    if(safety?.deferFromAdaptive)score-=1000;
    return{score,reasons,evidence,recommendation:recommendedContext(command,{progress,history,stateScore}),safety};
  }

  function adaptivePriority(command,currentLevel,options={}){
    return priorityDetails(command,currentLevel,options).score;
  }

  function focusForLevel(commands,currentLevel,{dayType='Todo el día',trials={},history=[],progress={},stateScore={},profile=null,now=Date.now()}={}){
    const count=dayType==='Solo noche'?2:3;
    const ranked=commands.filter(c=>c.level<=currentLevel).map(c=>{
      const details=priorityDetails(c,currentLevel,{trials,history,progress,stateScore,profile,now});
      return{c,...details};
    }).sort((a,b)=>b.score-a.score||b.c.level-a.c.level);
    const safe=ranked.filter(x=>!x.safety?.deferFromAdaptive),pool=safe.length?safe:ranked;
    const current=pool.filter(x=>x.c.level===currentLevel),review=pool.filter(x=>x.c.level<currentLevel);
    const chosen=[];
    if(current.length)chosen.push(current[0].c);
    else if(pool.length)chosen.push(pool[0].c);
    const rest=[...current.filter(x=>!chosen.some(c=>c.cmd===x.c.cmd)),...review].sort((a,b)=>b.score-a.score);
    for(const item of rest){if(chosen.length>=count)break;if(!chosen.some(c=>c.cmd===item.c.cmd))chosen.push(item.c)}
    return chosen.slice(0,count);
  }

  function commandHistorySeries(history,cmd,limit=8){
    const rows=[];
    for(const item of Array.isArray(history)?history:[]){
      const result=item?.results?.[cmd];if(!result)continue;
      const total=Number(result.total)||0,score=Number(result.score)||0,at=Date.parse(item.at||'');
      if(total<=0||!Number.isFinite(at))continue;
      rows.push({at,accuracy:Math.max(0,Math.min(1,score/total)),context:normalizeContext(item.context)});
    }
    rows.sort((a,b)=>a.at-b.at);
    return rows.slice(-Math.max(1,Number(limit)||8));
  }

  function commandTrend(history,cmd){
    const series=commandHistorySeries(history,cmd,6);
    if(!series.length)return{recent:null,previous:null,delta:null,count:0};
    const split=Math.max(1,Math.ceil(series.length/2)),previousRows=series.slice(0,series.length-split),recentRows=series.slice(-split);
    const avg=rows=>rows.length?rows.reduce((sum,x)=>sum+x.accuracy,0)/rows.length:null;
    const recent=avg(recentRows),previous=avg(previousRows);
    return{recent,previous,delta:previous===null?null:recent-previous,count:series.length};
  }

  function sessionAccuracy(item){
    let score=0,total=0;
    for(const result of Object.values(item?.results||{})){score+=Number(result?.score)||0;total+=Number(result?.total)||0}
    return total?score/total:null;
  }

  function evolutionSummary(commands,{history=[],progress={},stateScore={},now=Date.now()}={}){
    const recentSessions=days=>history.filter(item=>{const t=Date.parse(item?.at||'');return Number.isFinite(t)&&t<=now&&now-t<days*DAY_MS});
    const last7=recentSessions(7),last30=recentSessions(30),prev7=history.filter(item=>{const t=Date.parse(item?.at||'');return Number.isFinite(t)&&t<=now-7*DAY_MS&&t>now-14*DAY_MS});
    const accuracy=sessions=>{
      let score=0,total=0;
      for(const item of sessions)for(const result of Object.values(item?.results||{})){score+=Number(result?.score)||0;total+=Number(result?.total)||0}
      return total?score/total:null;
    };
    const active=new Set(),contexts=new Set();
    for(const item of last30){
      Object.keys(item?.results||{}).forEach(cmd=>active.add(cmd));
      if(item?.context)contexts.add(contextSignature(item.context));
    }
    const trends=(commands||[]).map(command=>({command,trend:commandTrend(history,command.cmd)})).filter(x=>x.trend.recent!==null);
    const improving=trends.filter(x=>x.trend.count>=4&&x.trend.delta!==null&&x.trend.delta>=.1).sort((a,b)=>b.trend.delta-a.trend.delta)[0]||null;
    const attention=trends.filter(x=>x.trend.count>=4&&x.trend.recent<.8).sort((a,b)=>a.trend.recent-b.trend.recent)[0]||null;
    const states={};
    for(const state of Object.keys(stateScore||{}))states[state]=0;
    for(const command of commands||[]){const state=progress[command.cmd]||'No iniciado';states[state]=(states[state]||0)+1}
    return{
      sessions7:last7.length,sessions30:last30.length,accuracy7:accuracy(last7),previousAccuracy7:accuracy(prev7),
      activeCommands30:active.size,contexts30:contexts.size,improving,attention,states
    };
  }

  function dailyPlan(commands,currentLevel,{dayType='Todo el día',trials={},history=[],progress={},stateScore={},profile=null,now=Date.now()}={}){
    const focus=focusForLevel(commands,currentLevel,{dayType,trials,history,progress,stateScore,profile,now});
    const stage=ageStage(profile,now),minutesPerCommand=stage.key==='young-puppy'?3:4;
    const items=focus.map(command=>{
      const details=priorityDetails(command,currentLevel,{trials,history,progress,stateScore,profile,now});
      const state=progress[command.cmd]||'No iniciado',level=Number(stateScore[state]||0);
      const objective=level<2?'Construir una respuesta clara':level===2?'Generalizar sin perder precisión':level===3?'Consolidar bajo más dificultad':'Repaso para mantenerlo sólido';
      return{command,attempts:5,minutes:minutesPerCommand,state,objective,reason:details.reasons[0],context:details.recommendation};
    });
    return{
      title:dayType==='Solo noche'?'Plan compacto de hoy':'Plan inteligente de hoy',
      totalMinutes:items.length*minutesPerCommand,
      stage:stage.label,
      items
    };
  }

  function microPlan(commands,currentLevel,{dayType='Todo el día',progress={},stateScore={},focus=[]}={}){
    const known=commands.filter(c=>c.level<currentLevel&&(stateScore[progress[c.cmd]||'No iniciado']||0)>=2).slice(-2);
    if(dayType==='Solo noche')return[
      ['Al llegar','4–5 min','Nuevo + fácil',[focus[0],known.at(-1)].filter(Boolean)],
      ['Más tarde','4–5 min','Segundo foco + repaso',[focus[1]||focus[0],known.at(-2)].filter(Boolean)],
      ['Antes de dormir','1–2 min','Una victoria fácil',[known.at(-1)||focus[0]].filter(Boolean)]
    ];
    return[
      ['Mañana','3–5 min','Foco principal',[focus[0],known.at(-1)].filter(Boolean)],
      ['Mediodía','3–5 min','Control / calma',[focus.find(c=>['Control','Autocontrol','Casa'].includes(c.category))||focus[1]||focus[0]].filter(Boolean)],
      ['Tarde','3–5 min','Segundo foco',[focus[1]||focus[0]].filter(Boolean)],
      ['Noche','2–4 min','Repaso fácil + juego',[known.at(-1)||focus.at(-1)].filter(Boolean)]
    ];
  }

  function ageGuidance(profile,now=Date.now()){
    const stage=ageStage(profile,now);
    if(stage.key==='unknown')return null;
    if(stage.key==='young-puppy')return{stage,...stage,message:'Prioriza vínculo, nombre, llamada, manejo, autocontrol y sesiones muy cortas. Evita impacto físico innecesario.'};
    if(stage.key==='puppy')return{stage,...stage,message:'Mantén sesiones breves y progresivas. Consolida obediencia y autocontrol antes de añadir dificultad física.'};
    if(stage.key==='adolescent')return{stage,...stage,message:'Sube distracciones y duración poco a poco; el trabajo físico sigue siendo progresivo mientras termina de desarrollarse.'};
    return{stage,...stage,message:'Puedes progresar dificultad según técnica, estado físico y respuesta del perro, manteniendo sesiones claras y positivas.'};
  }

  globalThis.PatrickTrainingEngine=Object.freeze({
    CONTEXT_ENVIRONMENTS,CONTEXT_DISTRACTIONS,normalizeContext,contextSignature,contextDifficulty,contextLabel,
    effectiveAgeMonths,ageStage,safetyForCommand,lastPracticeMs,recentAverage,commandContextEvidence,nextProgressState,
    recommendedContext,priorityDetails,adaptivePriority,focusForLevel,commandHistorySeries,commandTrend,evolutionSummary,dailyPlan,microPlan,ageGuidance
  });
})();
