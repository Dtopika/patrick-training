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

  const SKILL_FAMILIES=Object.freeze({
    communication:{label:'Comunicación',timingMode:'response',dimension:'claridad de respuesta'},
    position:{label:'Posición',timingMode:'response',dimension:'distancia del guía'},
    hold:{label:'Duración / autocontrol',timingMode:'duration',dimension:'duración estable'},
    recall:{label:'Llamada',timingMode:'response',dimension:'distancia de llamada'},
    heel:{label:'Paseo / secuencia',timingMode:'neutral',dimension:'pasos y ritmo'},
    search:{label:'Búsqueda',timingMode:'neutral',dimension:'área y dificultad del escondite'},
    object:{label:'Objetos',timingMode:'response',dimension:'distancia y novedad del objeto'},
    control:{label:'Control',timingMode:'response',dimension:'dificultad del estímulo'},
    direction:{label:'Movimiento / distancia',timingMode:'response',dimension:'distancia y precisión'},
    household:{label:'Casa',timingMode:'response',dimension:'distancia y contexto'},
    alert:{label:'Alerta controlada',timingMode:'response',dimension:'control de activación'},
    default:{label:'Habilidad',timingMode:'neutral',dimension:'dificultad general'}
  });
  const COMMAND_FAMILY=Object.freeze({
    'Patrick':'communication','Ja!':'communication','Frei':'communication',
    Sitz:'position',Platz:'position',Steh:'position',Decke:'position',Mitte:'position',Hinter:'position',
    Bleib:'hold',Warte:'hold',
    Komm:'recall',Hier:'recall',
    'Fuß':'heel','Los!':'heel',Weiter:'heel',Langsam:'heel','Zurück':'heel',
    Such:'search',
    Bring:'object',Gib:'object',Nimm:'object',Hol:'object',
    Nein:'control',Aus:'control','Lass es':'control',Stopp:'control',Ruhe:'control',Schau:'control',
    Links:'direction',Rechts:'direction',Voraus:'direction',Hoch:'direction',Runter:'direction',Hopp:'direction',
    Rein:'household',Raus:'household',Box:'household','Lös dich':'household',
    Laut:'alert','Pass auf':'alert'
  });

  function skillFamily(command){
    const cmd=typeof command==='string'?command:command?.cmd,category=typeof command==='object'?command?.category:'';
    const key=COMMAND_FAMILY[cmd]||
      (category==='Posiciones'?'position':category==='Autocontrol'?'hold':category==='Llamada'?'recall':
      category==='Objetos'?'object':category==='Casa'?'household':category==='Dirección'||category==='Movimiento'||category==='Distancia'?'direction':
      category==='Paseo'||category==='Obediencia'?'heel':category==='Seguridad'||category==='Control'?'control':
      category==='Alerta'||category==='Control defensivo'?'alert':category==='Olfato'?'search':'default');
    return{key,...SKILL_FAMILIES[key]};
  }

  function stateLevel(state,stateScore={}){return Number(stateScore[state]||0)}

  function difficultyTarget(command,state,{stateScore={},context=null}={}){
    const family=skillFamily(command),level=stateLevel(state,stateScore),ctx=normalizeContext(context);
    const table={
      communication:['cerca y sin distracción','1–2 m y una distracción leve','varía habitación o postura','generaliza en exterior','repaso impredecible y breve'],
      position:['junto a ti','1 paso de distancia','2–3 m','3–5 m','distancia variable'],
      hold:['2 s estables','4 s estables','6–8 s','10–12 s','12–15 s con variación'],
      recall:['1–2 m','3–5 m','5–8 m','8–12 m','distancia variable con seguridad'],
      heel:['3–5 pasos','6–8 pasos','10–15 pasos','15–20 pasos','ritmo y giros variables'],
      search:['objeto visible / muy fácil','escondite sencillo','una habitación','área pequeña con variación','búsqueda variada'],
      object:['objeto familiar y cerca','1–2 m','3–5 m u objeto distinto','distancia y objeto variables','repaso variado'],
      control:['estímulo fácil y cercano','estímulo leve','distracción media','distracción alta controlada','situaciones variadas y seguras'],
      direction:['1 m y trayectoria simple','2–3 m','4–6 m','distancia y ángulo variables','generalización controlada'],
      household:['mismo lugar y cerca','otra posición o habitación','distancia moderada','contextos domésticos variados','repaso funcional'],
      alert:['1 repetición controlada','1–2 repeticiones con vuelta a calma','estímulo neutro distinto','generaliza sin subir confrontación','mantenimiento breve'],
      default:['muy fácil','fácil','moderado','variable','mantenimiento']
    };
    return{family,target:table[family.key]?.[Math.min(4,Math.max(0,level))]||table.default[0],context:ctx,label:family.label+' · '+(table[family.key]?.[Math.min(4,Math.max(0,level))]||table.default[0])};
  }

  function timingTarget(command,state,{stateScore={}}={}){
    const family=skillFamily(command),level=stateLevel(state,stateScore);
    if(family.timingMode==='duration'){
      const seconds=[2,4,7,11,14][Math.min(4,Math.max(0,level))];
      return{mode:'duration',seconds,label:'mantener ≈ '+seconds+' s'};
    }
    if(family.timingMode==='response'){
      const base=[4.5,3.5,2.8,2.3,2][Math.min(4,Math.max(0,level))];
      const seconds=family.key==='recall'?base+.7:base;
      return{mode:'response',seconds,label:'responder en ≲ '+seconds.toFixed(1)+' s'};
    }
    return{mode:'neutral',seconds:null,label:'tiempo informativo'};
  }

  function commandTimingEvidence(history,command,state,{stateScore={}}={}){
    const cmd=typeof command==='string'?command:command?.cmd,family=skillFamily(command),rows=[];
    for(const item of Array.isArray(history)?history:[]){
      if(item?.timingMode!=='cue-to-rating')continue;
      const result=item?.results?.[cmd],seconds=Number(result?.avgSeconds);
      const at=Date.parse(item?.at||'');if(!result||!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(at))continue;
      rows.push({at,seconds});
    }
    rows.sort((a,b)=>a.at-b.at);const recent=rows.slice(-6),values=recent.map(x=>x.seconds).sort((a,b)=>a-b);
    const median=values.length?(values.length%2?values[(values.length-1)/2]:(values[values.length/2-1]+values[values.length/2])/2):null;
    const target=timingTarget(command,state,{stateScore});
    return{mode:family.timingMode,count:rows.length,recentCount:recent.length,medianSeconds:median,targetSeconds:target.seconds,targetLabel:target.label};
  }

  function evidenceConfidence(history,trials,command){
    const cmd=typeof command==='string'?command:command?.cmd,sessions=[];
    for(const item of Array.isArray(history)?history:[]){if(item?.results?.[cmd])sessions.push(item)}
    const trialCount=Array.isArray(trials?.[cmd])?trials[cmd].length:0,evidence=commandContextEvidence(history,cmd);
    const times=sessions.map(x=>Date.parse(x.at||'')).filter(Number.isFinite).sort((a,b)=>a-b);
    const spanDays=times.length>1?(times.at(-1)-times[0])/DAY_MS:0;
    const score=Math.min(sessions.length/6,.35)+Math.min(trialCount/10,.25)+Math.min(evidence.contextCount/3,.2)+Math.min(spanDays/7,.2);
    const normalized=Math.max(0,Math.min(1,score)),level=normalized>=.72?'Alta':normalized>=.4?'Media':'Baja';
    return{score:normalized,level,sessions:sessions.length,trials:trialCount,contexts:evidence.contextCount,spanDays};
  }

  function recommendedAttempts(command,{trials={},history=[],progress={},stateScore={},profile=null,now=Date.now()}={}){
    const cmd=typeof command==='string'?command:command?.cmd,state=progress[cmd]||'No iniciado',level=stateLevel(state,stateScore),avg=recentAverage(trials,cmd),stage=ageStage(profile,now);
    let attempts=avg===null?4:avg<.55?3:avg<.8?5:level>=2?3:4;
    if(stage.key==='young-puppy')attempts=Math.min(attempts,4);
    if(stage.key==='puppy')attempts=Math.min(attempts,5);
    return Math.max(3,Math.min(5,attempts));
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
    const days=last?Math.max(0,(now-last)/DAY_MS):30,stateName=progress[command.cmd]||'No iniciado',state=Number(stateScore[stateName]||0);
    const evidence=commandContextEvidence(history,command.cmd),confidence=evidenceConfidence(history,trials,command);
    const timing=commandTimingEvidence(history,command,stateName,{stateScore}),difficulty=difficultyTarget(command,stateName,{stateScore,context:recommendedContext(command,{progress,history,stateScore})});
    const attempts=recommendedAttempts(command,{trials,history,progress,stateScore,profile,now});
    let score=command.level===currentLevel?110:38;
    score+=avg===null?34:(1-avg)*72;
    score+=Math.min(days,30)*1.7;
    if(state<2)score+=26;
    if(state===2&&evidence.contextCount<3)score+=30;
    if(state===3&&evidence.contextCount<3)score+=18;
    if(avg!==null&&avg<.7)score+=24;
    if(confidence.level==='Baja')score+=10;
    if(timing.mode==='response'&&timing.recentCount>=2&&timing.targetSeconds&&timing.medianSeconds>timing.targetSeconds*1.25)score+=14;
    if(timing.mode==='duration'&&timing.recentCount>=2&&timing.targetSeconds&&timing.medianSeconds<timing.targetSeconds*.8)score+=12;
    if(state>=2&&avg!==null&&avg>=.9&&days<5&&evidence.contextCount>=3&&confidence.level==='Alta')score-=34;

    const reasons=[];
    if(command.level===currentLevel)reasons.push('Es parte del nivel actual');
    if(avg===null)reasons.push('Aún necesita evidencia reciente');
    else if(avg<.7)reasons.push('El rendimiento reciente bajó a '+Math.round(avg*100)+'%');
    else if(state<2)reasons.push('Todavía está construyendo consistencia');
    else if(state===2&&evidence.contextCount<2)reasons.push('Falta probarlo en otro contexto');
    else if(state===2)reasons.push('Conviene seguir generalizándolo');
    else if(state===3)reasons.push('Necesita más evidencia para considerarlo dominado');
    if(timing.mode==='response'&&timing.recentCount>=2&&timing.targetSeconds&&timing.medianSeconds>timing.targetSeconds*1.25)reasons.push('La respuesta aún tarda ≈ '+timing.medianSeconds.toFixed(1)+' s');
    if(timing.mode==='duration'&&timing.recentCount>=2&&timing.targetSeconds&&timing.medianSeconds<timing.targetSeconds*.8)reasons.push('Conviene alargar la duración estable');
    if(confidence.level==='Baja'&&confidence.sessions>0)reasons.push('La confianza todavía es baja: falta más evidencia');
    if(days>=7)reasons.push('Lleva '+Math.floor(days)+' días sin practicarse');
    if(!reasons.length)reasons.push('Repaso espaciado para conservar la respuesta');

    const safety=safetyForCommand(command,profile,now);
    if(safety?.deferFromAdaptive)score-=1000;
    return{score,reasons,evidence,confidence,timing,difficulty,attempts,recommendation:recommendedContext(command,{progress,history,stateScore}),safety};
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
      rows.push({at,accuracy:Math.max(0,Math.min(1,score/total)),context:normalizeContext(item.context),avgSeconds:Number(result.avgSeconds)||0,timingMode:item.timingMode||null});
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
    const stage=ageStage(profile,now);
    const items=focus.map(command=>{
      const details=priorityDetails(command,currentLevel,{trials,history,progress,stateScore,profile,now});
      const state=progress[command.cmd]||'No iniciado',level=Number(stateScore[state]||0),minutes=stage.key==='young-puppy'?3:details.attempts>=5?5:4;
      const objective=level<2?'Construir una respuesta clara':level===2?'Generalizar sin perder precisión':level===3?'Consolidar bajo más dificultad':'Repaso para mantenerlo sólido';
      return{command,attempts:details.attempts,minutes,state,objective,reason:details.reasons[0],context:details.recommendation,confidence:details.confidence,timing:details.timing,difficulty:details.difficulty};
    });
    return{
      title:dayType==='Solo noche'?'Plan compacto de hoy':'Plan inteligente de hoy',
      totalMinutes:items.reduce((sum,item)=>sum+item.minutes,0),
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
    effectiveAgeMonths,ageStage,safetyForCommand,skillFamily,difficultyTarget,timingTarget,commandTimingEvidence,evidenceConfidence,recommendedAttempts,
    lastPracticeMs,recentAverage,commandContextEvidence,nextProgressState,recommendedContext,priorityDetails,adaptivePriority,focusForLevel,
    commandHistorySeries,commandTrend,evolutionSummary,dailyPlan,microPlan,ageGuidance
  });
})();
