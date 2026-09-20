import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../videos.js',import.meta.url),'utf8');
const ctx={window:{}};vm.runInNewContext(source,ctx,{filename:'videos.js'});
const catalog=ctx.window.PATRICK_VIDEOS||{};
const entries=Object.entries(catalog);
if(entries.length!==47)throw new Error('Expected 47 curated videos, got '+entries.length);

async function check([command,meta]){
  const endpoint=meta.youtubeId
    ? 'https://www.youtube.com/oembed?format=json&url='+encodeURIComponent('https://www.youtube.com/watch?v='+meta.youtubeId)
    : meta.vimeoId
      ? 'https://vimeo.com/api/oembed.json?url='+encodeURIComponent('https://vimeo.com/'+meta.vimeoId)
      : null;
  if(!endpoint)return{command,ok:false,status:0,reason:'missing provider id'};
  try{
    const response=await fetch(endpoint,{headers:{'user-agent':'Patrick-Training-Link-Health/1.0'},signal:AbortSignal.timeout(12000)});
    return{command,ok:response.ok,status:response.status,reason:response.ok?'ok':'HTTP '+response.status};
  }catch(error){return{command,ok:false,status:0,reason:error?.message||String(error)}}
}

const results=[];
for(const entry of entries)results.push(await check(entry));
for(const result of results)console.log((result.ok?'OK  ':'FAIL')+' '+result.command+' · '+result.reason);
const failed=results.filter(x=>!x.ok);
console.log('\nChecked '+results.length+' curated videos; failures: '+failed.length);
if(failed.length)process.exitCode=1;
