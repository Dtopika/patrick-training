const COMMANDS=[
[0,'Patrick','Atención / nombre','Gira hacia ti y te presta atención.','Di su nombre una vez; al mirarte: Ja + premio.','Junto a tu cuerpo/cara.','Fundamentos'],
[0,'Ja!','Marcador: correcto','Marca el instante exacto correcto.','Di Ja exactamente cuando acierta y premia enseguida.','Premio inmediato y pequeño.','Fundamentos'],
[0,'Frei','Libre / fin','Puede abandonar la posición.','Tras una posición corta di Frei y anímalo a moverse.','La libertad puede ser el premio.','Fundamentos'],
[1,'Komm','Ven / acércate','Se acerca sin posición formal.','Retrocede 1–2 pasos, di Patrick, Komm y marca al llegar.','Comida, juego o acceso.','Llamada'],
[1,'Sitz','Siéntate','Trasero al suelo.','Premio en nariz → arriba y ligeramente atrás. Marca al tocar piso.','A su boca mientras sigue sentado.','Posiciones'],
[1,'Platz','Échate','Codos y pecho al suelo.','Premio en nariz → suelo → ligeramente delante.','Entre sus patas.','Posiciones'],
[1,'Aus','Suelta','Libera lo que ya tiene.','Intercambio al inicio; marca cuando abre la boca.','Premio y a veces devuelve el juguete.','Control'],
[1,'Lass es','Déjalo / no lo cojas','Ignora algo que aún no tiene.','Comida en puño; marca cuando aparte el hocico; añade señal después.','Premio de la otra mano.','Control'],
[1,'Nein','No / interrupción','Interrumpe una conducta.','Di Nein una vez, corta acceso y muestra una alternativa válida.','Premia la alternativa.','Control'],
[1,'Warte','Espera','No avanza aunque pueda cambiar postura.','Puerta entreabierta: si avanza se cierra; si espera se abre.','Acceso al oír Frei.','Autocontrol'],
[1,'Decke','A tu sitio','Va a cama/alfombra y permanece.','Marca cuatro patas dentro y aumenta duración poco a poco.','Sobre el tapete.','Casa'],
[1,'Box','Al guacal','Entra voluntariamente al crate.','Premios dentro; nunca empujarlo.','Dentro del crate.','Casa'],
[1,'Rein','Entra','Entra al espacio indicado.','Señala entrada y marca al cruzar.','Una vez dentro.','Casa'],
[1,'Raus','Sal','Sale del espacio indicado.','Señala salida y marca al cruzar.','Una vez fuera.','Casa'],
[2,'Schau','Mírame','Mantiene contacto visual.','Premio cerca de ojos al inicio; retira el señuelo pronto.','Junto a tu cara/cuerpo.','Atención'],
[2,'Bleib','Quédate','Mantiene exactamente la posición.','Empieza 1 s y aumenta una sola D: duración, distancia o distracción.','Vuelve a él y premia en posición.','Autocontrol'],
[2,'Steh','De pie','Permanece sobre cuatro patas.','Desde sentado atrae ligeramente hacia delante.','A su boca sin romper postura.','Posiciones'],
[2,'Ruhe','Tranquilo','Baja activación y se relaja.','Captura momentos espontáneos de calma y añade la señal.','Premios tranquilos.','Autocontrol'],
[2,'Lös dich','Haz tus necesidades','Hace pipí/caca en lugar apropiado.','Di la señal cuando ya esté por hacerlo; marca al terminar.','Premio + paseo/juego.','Casa'],
[3,'Los!','Vamos','Camina contigo normalmente.','Di Los al iniciar y refuerza correa floja.','Movimiento y olfato.','Paseo'],
[3,'Fuß','Junto formal','Trabaja junto a tu pierna izquierda.','1 paso → Ja → premio a la costura izquierda; sube 2,3,5 pasos.','Junto a pierna izquierda.','Obediencia'],
[3,'Weiter','Continúa','Sigue avanzando.','Tras una pausa di Weiter y avanza.','Continuar paseo.','Paseo'],
[3,'Langsam','Despacio','Reduce velocidad sin detenerse.','Reduce tú el paso y marca cuando acompasa.','Al lado, sin acelerar.','Paseo'],
[3,'Zurück','Atrás','Retrocede controladamente.','Provoca un paso atrás y marca; aumenta luego.','Al frente y bajo.','Movimiento'],
[4,'Links','Izquierda','Gira/desplaza a la izquierda.','Guía corporal y añade señal cuando anticipe el giro.','Después del giro.','Dirección'],
[4,'Rechts','Derecha','Gira/desplaza a la derecha.','Guía corporal y añade señal cuando anticipe el giro.','Después del giro.','Dirección'],
[4,'Nimm','Toma','Tiene permiso para coger.','Presenta objeto y marca cuando lo tome suavemente.','Juego o premio.','Objetos'],
[4,'Hol','Ve por eso','Va al objeto y lo recoge.','Objeto cerca; envía y aumenta distancia gradualmente.','Juego al recoger.','Objetos'],
[4,'Bring','Tráelo','Regresa contigo con el objeto.','Cuando lo recoja retrocede y marca al llegar cerca.','Intercambio o relanzamiento.','Objetos'],
[4,'Gib','Dámelo','Entrega el objeto en tu mano.','Pon mano debajo y marca al soltar en tu mano.','Premio o devolución del juguete.','Objetos'],
[5,'Such','Busca','Usa olfato para localizar.','Visible → semiescondido → escondido → objeto/persona.','Encuentro + juego/premio.','Olfato'],
[6,'Stopp','Detente','Frena el desplazamiento.','Primero con línea larga en zona segura; marca el frenado.','Tú vas hacia él.','Seguridad'],
[6,'Hier','Llamada formal / urgente','Abandona lo que hace y viene directo.','Distancia corta, retrocede, jackpot al llegar y sujeta collar suave.','2–3 premios de alto valor al inicio.','Seguridad'],
[7,'Voraus','Adelante','Se aleja en la dirección indicada bajo control.','Construye envío a objetivo visible y retíralo gradualmente.','En destino o regreso.','Distancia'],
[7,'Mitte','Centro','Se coloca entre tus piernas.','Guíalo desde atrás hacia el centro y marca posición estable.','Entre tus piernas.','Posición segura'],
[7,'Hoch','Sube','Sube a superficie segura.','Superficie baja y antideslizante; marca cuatro patas.','Sobre la superficie.','Movimiento'],
[7,'Runter','Baja','Baja de una superficie.','Guía al suelo y marca cuatro patas abajo.','En el suelo.','Movimiento'],
[8,'Laut','Ladra bajo orden','Ladra brevemente y vuelve al control.','Captura un ladrido natural, añade señal y refuerza también la calma.','Tras uno o pocos ladridos.','Alerta'],
[9,'Pass auf','Atento / observa','Orienta atención sin perseguir ni atacar.','Señala estímulo neutro; observa breve → Schau → Ja.','Premia retorno al control.','Control defensivo'],
[9,'Hinter','Detrás de mí','Se coloca detrás de tus piernas.','Guíalo alrededor de una pierna hacia atrás y marca al centrar.','Detrás de tus piernas.','Control defensivo'],
[10,'Hopp','Salta / supera obstáculo','Supera obstáculo indicado.','Solo con desarrollo físico apropiado y superficies seguras.','Tras superar controladamente.','Avanzado']
].map(([level,cmd,meaning,action,how,reward,category])=>({level,cmd,meaning,action,how,reward,category}));

const LEVELS=[
[0,'Idioma común','Marcador, nombre y liberación','Patrick · Ja · Frei'],
[1,'Cachorro funcional','Casa, llamada casual, posiciones y control básico','Komm · Sitz · Platz · Aus · Lass es · Nein · Warte · Decke · Box · Rein · Raus'],
[2,'Autocontrol','Atención, permanencia, calma y baño','Schau · Bleib · Steh · Ruhe · Lös dich'],
[3,'Paseo y obediencia','Caminar normal y Fuß formal','Los · Fuß · Weiter · Langsam · Zurück'],
[4,'Dirección y objetos','Giros, recoger y entregar','Links · Rechts · Nimm · Hol · Bring · Gib'],
[5,'Olfato','Búsqueda y juegos de nariz','Such'],
[6,'Seguridad','Parada y llamada formal','Stopp · Hier'],
[7,'Distancia y posiciones','Envíos y posiciones remotas','Voraus · Mitte · Hoch · Runter'],
[8,'Alerta controlada','Ladrido bajo señal y retorno a calma','Laut'],
[9,'Control defensivo seguro','Observar y colocarse en posición segura','Pass auf · Hinter'],
[10,'Avanzado','Generalización y habilidades físicas apropiadas','Hopp + combinación de señales']
];
const states=['No iniciado','En práctica','Consistente','Generalizando','Dominado'];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};
let progress=store.get('patrickProgress',{}), currentFilter='all';

function speak(text){if(!('speechSynthesis'in window))return alert('Tu navegador no tiene síntesis de voz.');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text.replace('!',''));u.lang='de-DE';u.rate=.78;speechSynthesis.speak(u)}
function commandCard(c,withState=false){const st=progress[c.cmd]||'No iniciado';return `<article class="command"><div class="commandTop"><div><span class="pill">Nivel ${c.level} · ${c.category}</span><div class="commandName">${c.cmd}</div><div class="meaning">${c.meaning}</div></div><div class="actions"><button onclick='speak(${JSON.stringify(c.cmd)})'>🔊</button></div></div><details><summary>Cómo enseñarlo</summary><div class="detailGrid"><div class="detail"><b>Conducta</b>${c.action}</div><div class="detail"><b>Paso a paso</b>${c.how}</div><div class="detail"><b>Premio</b>${c.reward}</div><div class="detail"><b>Criterio</b>8/10 correctas sin mostrar comida antes de la señal.</div></div></details>${withState?`<div class="stateRow">${states.map(x=>`<button class="stateBtn ${st===x?'active':''}" onclick='setState(${JSON.stringify(c.cmd)},${JSON.stringify(x)})'>${x}</button>`).join('')}</div>`:''}</article>`}
function renderCommands(){const q=$('#search').value.toLowerCase().trim();const arr=COMMANDS.filter(c=>(currentFilter==='all'||c.category===currentFilter)&&(c.cmd+' '+c.meaning+' '+c.action+' '+c.category).toLowerCase().includes(q));$('#commandList').innerHTML=arr.map(c=>commandCard(c)).join('')||'<p>No encontré comandos.</p>'}
function setState(cmd,state){progress[cmd]=state;store.set('patrickProgress',progress);renderProgress()}
function renderProgress(){ $('#progressList').innerHTML=COMMANDS.map(c=>commandCard(c,true)).join('');const w={'No iniciado':0,'En práctica':.25,'Consistente':.5,'Generalizando':.75,'Dominado':1};const score=COMMANDS.reduce((a,c)=>a+w[progress[c.cmd]||'No iniciado'],0)/COMMANDS.length;const pct=Math.round(score*100);$('#progressPct').textContent=pct+'%';$('#progressBar').style.width=pct+'%';const dom=COMMANDS.filter(c=>(progress[c.cmd]||'No iniciado')==='Dominado').length;$('#progressText').textContent=`${dom} de ${COMMANDS.length} comandos dominados.`}
function renderLevels(){ $('#levelCards').innerHTML=LEVELS.map(([n,t,goal,cmds])=>`<article class="card"><span class="pill">Nivel ${n}</span><h3>${t}</h3><p>${goal}</p><p><b>${cmds}</b></p></article>`).join('')}
function renderToday(){const level=+$('#currentLevel').value,day=$('#dayType').value;store.set('patrickCurrentLevel',level);store.set('patrickDayType',day);const lev=LEVELS.find(x=>x[0]===level);$('#todayTitle').textContent=`Nivel ${level} · ${lev[1]}`;$('#todaySubtitle').textContent=lev[2];let cs=COMMANDS.filter(c=>c.level===level);if(level===0)cs=COMMANDS.filter(c=>c.level===0);const known=COMMANDS.filter(c=>c.level<level).slice(-3);let plans=day==='Todo el día'?[['Mañana','3–5 min','1 comando del nivel + 1 conocido',[cs[0],known.at(-1)].filter(Boolean)],['Mediodía','3–5 min','Control / calma',cs.filter(c=>['Control','Autocontrol','Casa'].includes(c.category)).slice(0,2)],['Tarde','3–5 min','Generalización',[cs[1]||cs[0]].filter(Boolean)],['Noche','2–4 min','Repaso fácil + juego',[known.at(-2),cs.at(-1)].filter(Boolean)]]:[['Al llegar','4–5 min','Fundamento + comando actual',[known.at(-1),cs[0]].filter(Boolean)],['Más tarde','4–5 min','Control + repaso',[cs[1]||cs[0],known.at(-2)].filter(Boolean)],['Antes de dormir','1–2 min','Una victoria fácil',[COMMANDS.find(c=>c.cmd==='Sitz')||cs[0]].filter(Boolean)]];$('#todayPlan').innerHTML=plans.map(([title,dur,goal,list])=>`<article class="card"><span class="pill">${dur}</span><h3>${title}</h3><p>${goal}</p><p><b>${[...new Set(list.map(x=>x?.cmd).filter(Boolean))].join(' · ')||'Juego y vínculo'}</b></p></article>`).join('')}
function init(){LEVELS.forEach(x=>$('#currentLevel').insertAdjacentHTML('beforeend',`<option value="${x[0]}">${x[0]} · ${x[1]}</option>`));$('#currentLevel').value=store.get('patrickCurrentLevel',0);$('#dayType').value=store.get('patrickDayType','Todo el día');renderLevels();renderCommands();renderProgress();renderToday();$$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(v=>v.classList.remove('active'));$('#'+b.dataset.view).classList.add('active')});$('#search').oninput=renderCommands;$$('.chip').forEach(b=>b.onclick=()=>{$$('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentFilter=b.dataset.filter;renderCommands()});$('#currentLevel').onchange=renderToday;$('#dayType').onchange=renderToday;$('#themeBtn').onclick=()=>{document.body.classList.toggle('dark');store.set('patrickDark',document.body.classList.contains('dark'))};if(store.get('patrickDark',false))document.body.classList.add('dark')}
init();
