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

function successful(at,context,cmd='Sitz',score=5,total=5){
  return{version:7,at,level:1,dogName:'Patrick',context,results:{[cmd]:{achieved:5,assisted:0,missed:0,total,score,avgSeconds:1}},timings:{}};
}

test('context model normalizes values and derives comparable difficulty',()=>{
  const e=engine();
  assert.deepEqual({...e.normalizeContext(null)},{environment:'Casa',distraction:'Baja'});
  assert.equal(e.contextDifficulty({environment:'Casa',distraction:'Baja'}),0);
  assert.equal(e.contextDifficulty({environment:'Calle',distraction:'Media'}),3);
  assert.equal(e.contextLabel({environment:'Parque',distraction:'Alta'}),'Parque · distracción alta');
});

test('consistent commands advance to generalizing only with varied successful context evidence',()=>{
  const e=engine(),stateScore={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4};
  const trials={Sitz:[1,1,1,1,1,1,1,1,.5,.5]};
  const history=[
    successful('2026-09-19T12:00:00Z',{environment:'Calle',distraction:'Baja'}),
    successful('2026-09-18T12:00:00Z',{environment:'Casa',distraction:'Media'}),
    successful('2026-09-17T12:00:00Z',{environment:'Casa',distraction:'Baja'})
  ];
  assert.equal(e.nextProgressState('Sitz','Consistente',{trials,history,stateScore}),'Generalizando');
  const sameContext=history.map((x,i)=>successful(new Date(Date.parse('2026-09-17T12:00:00Z')+i*86400000).toISOString(),{environment:'Casa',distraction:'Baja'}));
  assert.equal(e.nextProgressState('Sitz','Consistente',{trials,history:sameContext,stateScore}),'Consistente');
});

test('generalizing commands require durable varied evidence before becoming dominated',()=>{
  const e=engine(),stateScore={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4};
  const trials={Sitz:[1,1,1,1,1,1,1,1,1,.5]};
  const history=[
    successful('2026-09-19T12:00:00Z',{environment:'Parque',distraction:'Media'}),
    successful('2026-09-17T12:00:00Z',{environment:'Calle',distraction:'Media'}),
    successful('2026-09-15T12:00:00Z',{environment:'Exterior tranquilo',distraction:'Media'}),
    successful('2026-09-13T12:00:00Z',{environment:'Calle',distraction:'Baja'}),
    successful('2026-09-11T12:00:00Z',{environment:'Casa',distraction:'Media'}),
    successful('2026-09-09T12:00:00Z',{environment:'Casa',distraction:'Baja'})
  ];
  assert.equal(e.nextProgressState('Sitz','Generalizando',{trials,history,stateScore}),'Dominado');
  const shortWindow=history.map((x,i)=>({...x,at:new Date(Date.parse('2026-09-19T12:00:00Z')-i*6*60*60*1000).toISOString()}));
  assert.equal(e.nextProgressState('Sitz','Generalizando',{trials,history:shortWindow,stateScore}),'Generalizando');
});

test('adaptive policy is explicit and preserves v3 behavior',()=>{
  const e=engine(),p=e.POLICY,stateScore={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4},command={level:1,cmd:'Sitz',category:'Posiciones'};
  assert.equal(p.progress.consistentTrials,10);
  assert.equal(p.progress.consistentPoints,8);
  assert.equal(p.progress.masteredSpanDays,7);
  assert.equal(p.confidence.high,.72);
  assert.equal(e.recommendedAttempts(command,{trials:{},history:[],progress:{Sitz:'No iniciado'},stateScore,profile:{ageMonths:24}}),4);
  assert.equal(e.recommendedAttempts(command,{trials:{Sitz:[0,0,.5]},history:[],progress:{Sitz:'En práctica'},stateScore,profile:{ageMonths:24}}),3);
  assert.equal(e.recommendedAttempts(command,{trials:{Sitz:[1,.5,.5]},history:[],progress:{Sitz:'En práctica'},stateScore,profile:{ageMonths:24}}),5);
  assert.equal(e.nextProgressState('Sitz','En práctica',{trials:{Sitz:[1,1,1,1,1,1,1,1,0,0]},history:[],stateScore}),'Consistente');
});

test('adaptive v2 explains why a command is selected and recommends the next context',()=>{
  const e=engine(),stateScore={'No iniciado':0,'En práctica':1,'Consistente':2,'Generalizando':3,'Dominado':4};
  const command={level:1,cmd:'Sitz',category:'Posiciones'};
  const history=[
    successful('2026-09-18T12:00:00Z',{environment:'Casa',distraction:'Baja'}),
    successful('2026-09-17T12:00:00Z',{environment:'Casa',distraction:'Baja'})
  ];
  const details=e.priorityDetails(command,1,{trials:{Sitz:[1,1,1,1,1,1,1,1,1,1]},history,progress:{Sitz:'Consistente'},stateScore});
  assert.ok(details.reasons.some(x=>x.includes('otro contexto')));
  assert.equal(details.recommendation.environment,'Casa');
  assert.equal(details.recommendation.distraction,'Media');
  assert.equal(details.evidence.contextCount,1);
});

test('backup schema 9 preserves precise timing context theme and legacy compatibility',()=>{
  const ctx=vm.createContext({console});
  vm.runInContext(read('backup-schema.js'),ctx,{filename:'backup-schema.js'});
  const schema=ctx.PatrickBackupSchema;
  const commands=[{cmd:'Sitz'}],states=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
  const current=schema.normalize({
    schemaVersion:9,currentLevel:1,dayType:'Todo el día',
    theme:'dark',
    trainingContext:{environment:'Parque',distraction:'Media'},
    history:[successful('2026-09-19T12:00:00Z',{environment:'Calle',distraction:'Alta'})]
  },{commands,states,currentProfile:{name:'Patrick'},currentTheme:'system',maxSchemaVersion:9});
  assert.deepEqual({...current.trainingContext},{environment:'Parque',distraction:'Media'});
  assert.deepEqual({...current.history[0].context},{environment:'Calle',distraction:'Alta'});
  assert.equal(current.theme,'dark');

  const legacy=schema.normalize({
    schemaVersion:6,currentLevel:1,dayType:'Todo el día',
    history:[{...successful('2026-09-18T12:00:00Z',{environment:'Casa',distraction:'Baja'}),context:undefined}]
  },{commands,states,currentProfile:{name:'Patrick'},currentTrainingContext:{environment:'Exterior tranquilo',distraction:'Baja'},currentTheme:'light',maxSchemaVersion:8});
  assert.deepEqual({...legacy.trainingContext},{environment:'Exterior tranquilo',distraction:'Baja'});
  assert.deepEqual({...legacy.history[0].context},{environment:'Casa',distraction:'Baja'});
  assert.equal(legacy.theme,'light');
});


test('schema 8 accepts detailed outcomes but does not require them from legacy sessions',()=>{
  const ctx=vm.createContext({console});vm.runInContext(read('backup-schema.js'),ctx,{filename:'backup-schema.js'});
  const schema=ctx.PatrickBackupSchema,commands=[{cmd:'Sitz'}],states=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
  const normalized=schema.normalize({
    schemaVersion:8,currentLevel:1,dayType:'Todo el día',
    history:[{version:8,at:'2026-09-19T12:00:00Z',level:1,dogName:'Patrick',context:{environment:'Casa',distraction:'Baja'},results:{Sitz:{achieved:4,assisted:1,missed:0,total:5,score:4.5,avgSeconds:1,outcomes:['achieved','achieved','achieved','achieved','assisted']}},timings:{Sitz:[1,1,1,1,1]}}]
  },{commands,states,currentProfile:{name:'Patrick'},maxSchemaVersion:8});
  assert.deepEqual(Array.from(normalized.history[0].results.Sitz.outcomes),['achieved','achieved','achieved','achieved','assisted']);
  assert.equal(normalized.history[0].timingMode,undefined);
  assert.throws(()=>schema.normalize({
    schemaVersion:8,currentLevel:1,dayType:'Todo el día',
    history:[{version:8,at:'2026-09-19T12:00:00Z',level:1,dogName:'Patrick',results:{Sitz:{achieved:5,assisted:0,missed:0,total:5,score:5,avgSeconds:1,outcomes:['achieved']}}}]
  },{commands,states,currentProfile:{name:'Patrick'},maxSchemaVersion:8}));
});

test('schema 9 preserves cue-to-rating timing metadata and rejects unknown timing modes',()=>{
  const ctx=vm.createContext({console});vm.runInContext(read('backup-schema.js'),ctx,{filename:'backup-schema.js'});
  const schema=ctx.PatrickBackupSchema,commands=[{cmd:'Sitz'}],states=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
  const base={schemaVersion:9,currentLevel:1,dayType:'Todo el día',history:[{version:9,at:'2026-09-19T12:00:00Z',level:1,dogName:'Patrick',timingMode:'cue-to-rating',results:{Sitz:{achieved:4,assisted:0,missed:0,total:4,score:4,avgSeconds:1.8,outcomes:['achieved','achieved','achieved','achieved']}},timings:{Sitz:[1800,1700,1900,1800]}}]};
  const normalized=schema.normalize(base,{commands,states,currentProfile:{name:'Patrick'},maxSchemaVersion:9});
  assert.equal(normalized.history[0].timingMode,'cue-to-rating');
  assert.throws(()=>schema.normalize({...base,history:[{...base.history[0],timingMode:'legacy-auto'}]},{commands,states,currentProfile:{name:'Patrick'},maxSchemaVersion:9}));
});

test('schema 11 preserves archive, teaching state and German voice preference',()=>{
  const ctx=vm.createContext({console});vm.runInContext(read('backup-schema.js'),ctx,{filename:'backup-schema.js'});
  const schema=ctx.PatrickBackupSchema,commands=[{cmd:'Sitz'}],states=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
  const archive={version:1,totalSessions:3,months:{'2026-08':{sessions:3,score:10,total:12,contexts:{'Casa · distracción baja':3},commands:{Sitz:{sessions:3,score:10,total:12,timedSessions:2,seconds:4.2}}}}};
  const normalized=schema.normalize({
    schemaVersion:11,currentLevel:1,dayType:'Todo el día',historyArchive:archive,teachingGuideVersion:1,germanVoice:'Google Deutsch'
  },{commands,states,currentProfile:{name:'Patrick'},currentGermanVoice:'auto',maxSchemaVersion:11});
  assert.equal(normalized.historyArchive.totalSessions,3);
  assert.equal(normalized.historyArchive.months['2026-08'].commands.Sitz.timedSessions,2);
  assert.equal(normalized.teachingGuideVersion,1);
  assert.equal(normalized.germanVoice,'Google Deutsch');
});

test('schema 13 preserves first-run wizard and language preferences',()=>{
  const ctx=vm.createContext({console});vm.runInContext(read('backup-schema.js'),ctx,{filename:'backup-schema.js'});
  const schema=ctx.PatrickBackupSchema,commands=[{cmd:'Sitz'}],states=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
  const normalized=schema.normalize({
    schemaVersion:13,currentLevel:0,dayType:'Todo el día',setupWizardVersion:1,teachingGuideVersion:1,appLanguage:'en',commandLanguage:'de'
  },{commands,states,currentProfile:{name:'Patrick'},maxSchemaVersion:13});
  assert.equal(normalized.setupWizardVersion,1);
  assert.equal(normalized.teachingGuideVersion,1);
  assert.equal(normalized.appLanguage,'en');
  assert.equal(normalized.commandLanguage,'de');
});

test('backup schema accepts level 11 when the command catalog exposes that route',()=>{
  const ctx=vm.createContext({console});vm.runInContext(read('backup-schema.js'),ctx,{filename:'backup-schema.js'});
  const schema=ctx.PatrickBackupSchema,commands=[{cmd:'Sitz',level:1},{cmd:'Bei mir',level:11}],states=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
  const normalized=schema.normalize({
    schemaVersion:13,currentLevel:11,dayType:'Todo el día',history:[{version:9,at:'2026-09-19T12:00:00Z',level:11,dogName:'Patrick',results:{'Bei mir':{achieved:4,assisted:0,missed:0,total:4,score:4,avgSeconds:1.5,outcomes:['achieved','achieved','achieved','achieved']}},timings:{'Bei mir':[1500,1500,1500,1500]}}]
  },{commands,states,currentProfile:{name:'Patrick'},maxSchemaVersion:13});
  assert.equal(normalized.currentLevel,11);
  assert.equal(normalized.history[0].level,11);
  assert.throws(()=>schema.normalize({schemaVersion:13,currentLevel:12,dayType:'Todo el día'},{commands,states,currentProfile:{name:'Patrick'},maxSchemaVersion:13}));
});
test('session flow persists context only with the completed transaction',()=>{
  const session=read('app-session.js'),core=read('app-core.js'),profile=['profile.js','profile-setup.js','profile-data.js','profile-reminders.js','profile-settings.js'].map(read).join('\n');
  assert.match(core,/patrickTrainingContext:\{environment:'Casa',distraction:'Baja'\}/);
  assert.match(session,/context:ENGINE\.normalizeContext\(activeSession\.context\)/);
  assert.match(session,/patrickTrainingContext:nextTrainingContext/);
  assert.match(session,/ENGINE\.nextProgressState/);
  assert.doesNotMatch(session.match(/function rateExecution\(outcome\)\{([\s\S]*?)\n\}/)?.[1]||'',/store\.set/);
  assert.match(profile,/trainingContext/);
});
