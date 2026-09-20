(()=>{'use strict';
const DATA=globalThis.PatrickI18nData;if(!DATA)throw new Error('Patrick i18n data unavailable');
const {LANGS,LOCALE,NAME,UI,COMMANDS,MEANING,LEVELS,CATEGORY,COPY,STATE_LABELS,ENGINE_TEXT,COMMAND_DETAIL_FIELDS,COMMAND_DETAIL,COPY_MORE,CATEGORY_EXTRA}=DATA;
function normalizeLanguage(value,fallback='es'){return LANGS.includes(value)?value:fallback}
function name(lang){return NAME[normalizeLanguage(lang)]}
function locale(lang){return LOCALE[normalizeLanguage(lang)]}
function t(lang,key,vars={}){const l=normalizeLanguage(lang);let value=UI[l]?.[key]??COPY[l]?.[key]??COPY_MORE[l]?.[key]??UI.es[key]??key;for(const [k,v] of Object.entries(vars))value=value.replaceAll('{'+k+'}',String(v));return value}
function copy(lang,value){const l=normalizeLanguage(lang);return l==='es'?String(value??''):(COPY[l]?.[String(value??'')]??COPY_MORE[l]?.[String(value??'')]??String(value??''))}
function state(lang,value){const l=normalizeLanguage(lang);return l==='es'?String(value??''):(STATE_LABELS[l]?.[String(value??'')]??String(value??''))}
function engineText(lang,value){
  const l=normalizeLanguage(lang);let s=String(value??'');if(l==='es'||!s)return s;
  const exact=ENGINE_TEXT[l]?.[s];if(exact)return exact;
  let m=s.match(/^(.+) · distracción (baja|media|alta)$/i);if(m){const level={baja:'Baja',media:'Media',alta:'Alta'}[m[2].toLowerCase()];return engineText(l,m[1])+' · '+(l==='en'?'distraction ':'Ablenkung ')+engineText(l,level).toLowerCase()}
  m=s.match(/^El rendimiento reciente bajó a (\d+)%$/);if(m)return l==='en'?`Recent performance dropped to ${m[1]}%`:`Die aktuelle Leistung sank auf ${m[1]}%`;
  m=s.match(/^La respuesta aún tarda ≈ ([\d.]+) s$/);if(m)return l==='en'?`Response still takes ≈ ${m[1]} s`:`Die Reaktion dauert noch ≈ ${m[1]} s`;
  m=s.match(/^Lleva (\d+) días sin practicarse$/);if(m)return l==='en'?`${m[1]} days since last practice`:`Seit ${m[1]} Tagen nicht trainiert`;
  m=s.match(/^mantener ≈ ([\d.]+) s$/);if(m)return l==='en'?`hold ≈ ${m[1]} s`:`halten ≈ ${m[1]} s`;
  m=s.match(/^responder en ≲ ([\d.]+) s$/);if(m)return l==='en'?`respond in ≲ ${m[1]} s`:`reagieren in ≲ ${m[1]} s`;
  if(s.includes(' · '))return s.split(' · ').map(part=>engineText(l,part)).join(' · ');
  return s;
}
function commandDetail(lang,canonical,field,fallback=''){const l=normalizeLanguage(lang);if(l==='es')return fallback;const idx=COMMAND_DETAIL_FIELDS[field],row=COMMAND_DETAIL[l]?.[canonical];return Number.isInteger(idx)&&row?.[idx]?row[idx]:fallback}
function commandLabel(lang,canonical,dogName='Patrick'){if(canonical==='Patrick')return dogName||'Patrick';const l=normalizeLanguage(lang,'de');if(l==='de')return canonical;return COMMANDS[l]?.[canonical]||canonical}
function commandMeaning(lang,canonical,fallback=''){const l=normalizeLanguage(lang);if(l==='es')return fallback;return MEANING[l]?.[canonical]||fallback}
function levelText(lang,n){return LEVELS[normalizeLanguage(lang)]?.[n]||LEVELS.es[n]||['','']}
function category(lang,value){const l=normalizeLanguage(lang);return CATEGORY[l]?.[value]||CATEGORY_EXTRA[l]?.[value]||value}
globalThis.PatrickI18n=Object.freeze({LANGS,NAME,normalizeLanguage,name,locale,t,copy,state,engineText,commandLabel,commandMeaning,commandDetail,levelText,category});
})();