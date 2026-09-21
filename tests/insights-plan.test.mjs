import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

function engine(){
  const ctx=vm.createContext({console});
  vm.runInContext(read('training-engine.js'),ctx,{filename:'training-engine.js'});
  return ctx.PatrickTrainingEngine;
}

function session(at,cmd='Sitz',score=5,total=5,context={environment:'Casa',distraction:'Baja'}){
  return{version:7,at,level:1,dogName:'Patrick',context,results:{[cmd]:{achieved:Math.round(score),assisted:0,missed:Math.max(0,total-Math.round(score)),total,score,avgSeconds:1}},timings:{}};
}

test('v6.2 daily plan uses adaptive focus and puppy-safe short sessions',()=>{
  const e=engine();
  const commands=[
    {level:0,cmd:'Patrick',category:'Fundamentos'},
    {level:1,cmd:'Sitz',category:'Posiciones'},
    {level:1,cmd:'Nein',category:'Control'}
  ];
  const stateScore={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4};
  const now=Date.parse('2026-09-19T12:00:00Z');
  const plan=e.dailyPlan(commands,1,{
    dayType:'Solo noche',trials:{Sitz:[1,.5,0],Nein:[1,1]},
    history:[],progress:{Sitz:'En práctica',Nein:'En práctica'},stateScore,
    profile:{ageMonths:4,ageUpdatedAt:'2026-09-19T00:00:00Z'},now
  });
  assert.equal(plan.title,'Plan compacto de hoy');
  assert.equal(plan.items.length,2);
  assert.equal(plan.totalMinutes,6);
  assert.ok(plan.items.every(x=>x.minutes===3&&x.attempts>=3&&x.attempts<=4));
  assert.ok(plan.items.every(x=>x.context&&x.reason&&x.objective));
});


test('v7.7 weekly plan spans seven adaptive days and respects puppy safety',()=>{
  const e=engine(),stateScore={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4};
  const commands=[
    {level:9,cmd:'Hinter',category:'Control defensivo'},
    {level:9,cmd:'Stopp',category:'Control'},
    {level:10,cmd:'Hopp',category:'Avanzado'}
  ];
  const now=Date.parse('2026-09-21T12:00:00Z');
  const plan=e.weeklyPlan(commands,10,{
    dayType:'Todo el día',trials:{Hinter:[1,.5],Stopp:[1,1]},history:[],
    progress:{Hinter:'En práctica',Stopp:'Consistente'},stateScore,
    profile:{ageMonths:4,ageUpdatedAt:'2026-09-21T00:00:00Z'},now
  });
  assert.equal(plan.days.length,7);
  assert.equal(plan.days[0].isToday,true);
  assert.equal(new Set(plan.days.map(day=>day.date)).size,7);
  assert.equal(plan.days[2].load,'light');
  assert.equal(plan.days[5].load,'light');
  assert.ok(plan.days.every(day=>day.items.length<=2));
  assert.equal(plan.days.flatMap(day=>day.items).some(item=>item.command.cmd==='Hopp'),false);
  assert.ok(plan.days.flatMap(day=>day.items).some(item=>item.command.cmd==='Hinter'));
});

test('adaptive v3 differentiates response timing, duration and evidence confidence',()=>{
  const e=engine(),stateScore={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4};
  assert.equal(e.skillFamily({cmd:'Sitz',category:'Posiciones'}).key,'position');
  assert.equal(e.skillFamily({cmd:'Bleib',category:'Autocontrol'}).timingMode,'duration');
  assert.equal(e.skillFamily({cmd:'Hier',category:'Seguridad'}).key,'recall');
  assert.match(e.difficultyTarget({cmd:'Bleib'},'Consistente',{stateScore}).target,/6–8 s/);
  assert.equal(e.timingTarget({cmd:'Sitz'},'Consistente',{stateScore}).mode,'response');

  const history=[
    {...session('2026-09-19T10:00:00Z','Sitz',5,5),timingMode:'cue-to-rating',results:{Sitz:{achieved:5,assisted:0,missed:0,total:5,score:5,avgSeconds:3.4}}},
    {...session('2026-09-18T10:00:00Z','Sitz',5,5),timingMode:'cue-to-rating',results:{Sitz:{achieved:5,assisted:0,missed:0,total:5,score:5,avgSeconds:3.0}}},
    {...session('2026-09-17T10:00:00Z','Sitz',5,5),results:{Sitz:{achieved:5,assisted:0,missed:0,total:5,score:5,avgSeconds:99}}}
  ];
  const timing=e.commandTimingEvidence(history,{cmd:'Sitz'},'Consistente',{stateScore});
  assert.equal(timing.count,2);
  assert.equal(timing.medianSeconds,3.2);
  const confidence=e.evidenceConfidence(history,{Sitz:[1,1,1,1,1,1,1,1,1,1]},{cmd:'Sitz'});
  assert.ok(['Media','Alta'].includes(confidence.level));
});

test('evolution summary compares recent performance and finds signals',()=>{
  const e=engine(),now=Date.parse('2026-09-19T12:00:00Z');
  const commands=[{cmd:'Sitz'},{cmd:'Nein'}];
  const history=[
    session('2026-09-19T10:00:00Z','Sitz',5,5,{environment:'Parque',distraction:'Media'}),
    session('2026-09-18T10:00:00Z','Sitz',5,5,{environment:'Casa',distraction:'Media'}),
    session('2026-09-17T10:00:00Z','Nein',3,5,{environment:'Casa',distraction:'Baja'}),
    session('2026-09-16T10:00:00Z','Nein',2,5,{environment:'Exterior tranquilo',distraction:'Baja'}),
    session('2026-09-15T10:00:00Z','Nein',2,5,{environment:'Casa',distraction:'Media'}),
    session('2026-09-14T10:00:00Z','Nein',2,5,{environment:'Calle',distraction:'Baja'}),
    session('2026-09-12T10:00:00Z','Sitz',3,5,{environment:'Casa',distraction:'Baja'}),
    session('2026-09-11T10:00:00Z','Sitz',2,5,{environment:'Casa',distraction:'Baja'})
  ];
  const stateScore={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4};
  const summary=e.evolutionSummary(commands,{history,progress:{Sitz:'Consistente',Nein:'En práctica'},stateScore,now});
  assert.equal(summary.sessions7,6);
  assert.equal(summary.sessions30,8);
  assert.equal(summary.activeCommands30,2);
  assert.ok(summary.contexts30>=3);
  assert.ok(summary.accuracy7>summary.previousAccuracy7);
  assert.equal(summary.improving.command.cmd,'Sitz');
  assert.equal(summary.attention.command.cmd,'Nein');
});

test('command history series and trend use completed session evidence',()=>{
  const e=engine();
  const history=[
    session('2026-09-10T10:00:00Z','Sitz',2,5),
    session('2026-09-11T10:00:00Z','Sitz',3,5),
    session('2026-09-12T10:00:00Z','Sitz',4,5),
    session('2026-09-13T10:00:00Z','Sitz',5,5)
  ];
  const series=e.commandHistorySeries(history,'Sitz',3);
  assert.equal(series.length,3);
  assert.ok(series[0].at<series[2].at);
  const trend=e.commandTrend(history,'Sitz');
  assert.ok(trend.delta>0);
});

test('level zero is clearly named Bases de comunicación',()=>{
  const levels=read('levels.js');
  assert.match(levels,/"title": "Bases de comunicación"/);
  assert.match(levels,/"goal": "Atención → marcador → liberación"/);
  assert.doesNotMatch(levels,/Idioma común/);
});

test('v6.4 UI exposes smart plan, evolution dashboard and command insight dialog',()=>{
  const index=read('index.html'),insights=read('app-insights.js'),sessionSource=read('app-session.js'),profile=['profile.js','profile-setup.js','profile-data.js','profile-reminders.js','profile-settings.js'].map(read).join('\n');
  assert.match(index,/id="smartDailyPlan"/);
  assert.match(index,/id="evolutionDashboard"/);
  assert.match(index,/id="commandInsightDialog"/);
  assert.match(insights,/ENGINE\.dailyPlan/);
  assert.match(insights,/ENGINE\.evolutionSummary/);
  assert.match(insights,/data-smart-practice/);
  assert.match(insights,/data-command-insight/);
  assert.match(sessionSource,/function startSession\(cmds=focusForLevel\(currentLevel\),options=\{\}\)/);
  assert.match(sessionSource,/ENGINE\.normalizeContext\(options\.context\|\|trainingContext\)/);
  assert.match(profile,/ENGINE\.ageStage/);
  const styles=read('styles-insights.css');
  assert.match(insights,/icon\('chart'\)/);
  assert.match(insights,/commandSeriesRail/);
  assert.match(insights,/Más antiguo ← desliza → más reciente/);
  assert.match(styles,/commandSeriesRail\{[^}]*overflow-x:auto/);
});


test('v7.7 UI exposes adaptive week and live practical coaching',()=>{
  const index=read('index.html'),engineSource=read('training-engine.js'),insightsSource=read('app-insights.js'),sessionSource=read('app-session.js'),sessionStyles=read('styles-session.css'),insightStyles=read('styles-insights.css');
  assert.match(index,/id="weeklyCoach"/);
  assert.match(index,/id="sessionElapsed"/);
  assert.match(index,/id="sessionPracticalCoach"/);
  assert.match(engineSource,/function weeklyPlan/);
  assert.match(engineSource,/weeklyPlan,microPlan/);
  assert.match(insightsSource,/ENGINE\.weeklyPlan/);
  assert.match(insightsSource,/data-week-start/);
  assert.match(sessionSource,/function startSessionClock/);
  assert.match(sessionSource,/function renderPracticalCoach/);
  assert.match(sessionSource,/durationSeconds/);
  assert.match(sessionStyles,/sessionPracticalCoach/);
  assert.match(insightStyles,/weeklyCoachRail/);
});
