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

test('backup schema 7 preserves context while legacy sessions remain compatible',()=>{
  const ctx=vm.createContext({console});
  vm.runInContext(read('backup-schema.js'),ctx,{filename:'backup-schema.js'});
  const schema=ctx.PatrickBackupSchema;
  const commands=[{cmd:'Sitz'}],states=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
  const current=schema.normalize({
    schemaVersion:7,currentLevel:1,dayType:'Todo el día',
    trainingContext:{environment:'Parque',distraction:'Media'},
    history:[successful('2026-09-19T12:00:00Z',{environment:'Calle',distraction:'Alta'})]
  },{commands,states,currentProfile:{name:'Patrick'},maxSchemaVersion:7});
  assert.deepEqual({...current.trainingContext},{environment:'Parque',distraction:'Media'});
  assert.deepEqual({...current.history[0].context},{environment:'Calle',distraction:'Alta'});

  const legacy=schema.normalize({
    schemaVersion:6,currentLevel:1,dayType:'Todo el día',
    history:[{...successful('2026-09-18T12:00:00Z',{environment:'Casa',distraction:'Baja'}),context:undefined}]
  },{commands,states,currentProfile:{name:'Patrick'},currentTrainingContext:{environment:'Exterior tranquilo',distraction:'Baja'},maxSchemaVersion:7});
  assert.deepEqual({...legacy.trainingContext},{environment:'Exterior tranquilo',distraction:'Baja'});
  assert.deepEqual({...legacy.history[0].context},{environment:'Casa',distraction:'Baja'});
});
