import fs from 'node:fs';

const [version,tag]=process.argv.slice(2);
if(!/^\d+\.\d+\.\d+$/.test(version||''))throw new Error('Usage: npm run release:prepare -- <semver> <asset-tag>');
if(!/^v\d+-r\d+$/.test(tag||''))throw new Error('Asset tag must look like v640-r1');

const read=path=>fs.readFileSync(path,'utf8');
const write=(path,value)=>fs.writeFileSync(path,value);
const core=read('app-core.js');
const oldTag=core.match(/V6_ASSET_TAG='([^']+)'/)?.[1];
const config=read('config.js');
const oldVersion=config.match(/APP_VERSION:'([^']+)'/)?.[1];
if(!oldTag||!oldVersion)throw new Error('Could not detect current release metadata');

for(const path of ['app-core.js','index.html','styles.css','pwa.js','sw.js','tests/hardening.test.mjs','tests/insights-plan.test.mjs','tests/intelligent-progression.test.mjs']){
  let content=read(path);
  content=content.replaceAll(oldTag,tag).replaceAll(oldVersion,version);
  write(path,content);
}

const revision=tag.match(/-(r\d+)$/)?.[1]||'r1';
let cfg=read('config.js');
cfg=cfg.replace(/APP_VERSION:'[^']+'/,`APP_VERSION:'${version}'`);
cfg=cfg.replace(/CACHE_NAME:'patrick-training-v[^']+'/,`CACHE_NAME:'patrick-training-v${version}-${revision}'`);
write('config.js',cfg);

const pkg=JSON.parse(read('package.json'));pkg.version=version;write('package.json',JSON.stringify(pkg,null,2)+'\n');
const lock=JSON.parse(read('package-lock.json'));lock.version=version;if(lock.packages?.[''])lock.packages[''].version=version;write('package-lock.json',JSON.stringify(lock,null,2)+'\n');

let readme=read('README.md');
readme=readme.replace(/Release estable publicada: v[^.]+\.[^.]+\.[^.]+\./,`Release estable publicada: v${version}.`);
write('README.md',readme);

console.log(`Prepared Patrick Training v${version} with asset tag ${tag} (from v${oldVersion} / ${oldTag}).`);
