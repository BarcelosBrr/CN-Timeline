'use strict';
const $ = (id) => document.getElementById(id);
const MIN_YEAR = 2015, MAX_YEAR = 2021, DAY = 24*60*60;
const ERA = {
  2015: ['CHECK it! 3.0','Formas planas, quadrados e cores CMYK','checkit3'],
  2016: ['CHECK it! 4.0','Geometria mais vibrante e movimento','checkit4'],
  2017: ['DIMENSIONAL','Transições e personagens em 3D','dimensional'],
  2018: ['DIMENSIONAL','A fase Dimensional continua','dimensional'],
  2019: ['DIMENSIONAL','Fase brasileira; Mashup era uma variação internacional','dimensional'],
  2020: ['DIMENSIONAL','Bumpers e transições variadas no Brasil','dimensional'],
  2021: ['DIMENSIONAL','O Brasil ainda utilizava Dimensional','dimensional']
};
let year = Number(localStorage.getItem('cnTimelineYear') || 2017);
if(year < MIN_YEAR || year > MAX_YEAR) year = 2017;
let catalog = [], schedule = [], lastDateKey = '', started = false, muted = false;
let transitionTimeout = null;
let activeId = '', activeSource = '', activeGuideId = '', retryVersion = 0, failedAssetId = '';
let externalOpen = false, externalItem = '', externalUrl = '', freeMode=false;
let volume=Number(localStorage.getItem('cnVolume')??65),stableVolume=localStorage.getItem('cnStableVolume')!=='false';
let soundContext=null, mediaNode=null, compressor=null, masterGain=null, analyser=null, audioConfigured=false;
let iframeLoadedAt=0;
let stremioVersion=0, stremioResolving='', currentProvider='', hlsPlayer=null, stremioExcluded=[], stremioAssetKey='';
let stremioCandidates=[], stremioCandidateIndex=-1, stremioLoadTimer=null;
let streamRequest=null, nextWarmKey='', nextWarmAt=0;
let observedRequests=new Set(),lastSyncSnapshot='',syncPollingInFlight=false,stallTimer=null;
let lastRemoteProgressAt=0,catalogRefreshPending=false;
const failedEpisodeByYear=new Set();
const warmedStreams=new Map();
function episodeKey(a){return a?.source==='stremio'?`${a.kind}:${a.imdbId}:${a.season||0}:${a.episode||0}`:''}
function clearPendingRequest(){if(streamRequest){streamRequest.abort();streamRequest=null}}
async function warmNextEpisode(now){
  if(!started || !schedule.length)return;
  const pos=secs(now), next=schedule.find(x=>x.isMain && x.start>pos && x.asset?.source==='stremio');
  if(!next || next.start-pos>240)return;
  const a=next.asset,key=episodeKey(a),cached=warmedStreams.get(key);
  if(!key || (cached&&Date.now()-cached.time<240000) || (nextWarmKey===key && Date.now()-nextWarmAt<120000))return;
  nextWarmKey=key;nextWarmAt=Date.now();
  try{
    const response=await fetch('/api/stremio/resolve',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imdbId:a.imdbId,season:a.season,episode:a.episode,kind:a.kind})});
    if(!response.ok)return;
    const result=await response.json();
    if(result.ok)warmedStreams.set(key,{time:Date.now(),result});
    if(warmedStreams.size>24)warmedStreams.delete(warmedStreams.keys().next().value);
  }catch{} // Prefetch não pode interromper o programa atual.
}

function destroyHls(){if(hlsPlayer){try{hlsPlayer.destroy()}catch{}hlsPlayer=null}}
function clearStremioLoadTimer(){if(stremioLoadTimer){clearTimeout(stremioLoadTimer);stremioLoadTimer=null;}}

function initAudioGraph(){
  if(audioConfigured)return;
  if(!player.src || !new URL(player.src,location.href).pathname.startsWith('/media/'))return;
  const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
  try{
    soundContext=new A();mediaNode=soundContext.createMediaElementSource(player);
    compressor=soundContext.createDynamicsCompressor();
    compressor.threshold.value=-25;compressor.knee.value=25;compressor.ratio.value=4;
    compressor.attack.value=.008;compressor.release.value=.24;
    masterGain=soundContext.createGain();analyser=soundContext.createAnalyser();analyser.fftSize=256;
    mediaNode.connect(compressor);compressor.connect(masterGain);masterGain.connect(analyser);analyser.connect(soundContext.destination);
    audioConfigured=true;applyStableVolume();applyVolume();updateMeter();
  }catch(e){$('syncLabel').textContent='Áudio: controle básico (sem compressor)';}
}
function applyStableVolume(){
  $('normalizeButton').setAttribute('aria-pressed',String(stableVolume));
  $('normalizeButton').textContent=stableVolume?'◉ Som estável':'◎ Som normal';
  if(!audioConfigured)return;
  try{mediaNode.disconnect();compressor.disconnect();
    if(stableVolume){mediaNode.connect(compressor);compressor.connect(masterGain)}
    else mediaNode.connect(masterGain);
  }catch(e){}
  $('normalizeButton').setAttribute('aria-pressed',String(stableVolume));
  $('normalizeButton').textContent=stableVolume?'◉ Som estável':'◎ Som normal';
}
function applyVolume(){
  volume=Math.max(0,Math.min(100,volume));
  $('volumeSlider').value=volume;$('volumeValue').textContent=volume+'%';
  player.volume=(audioConfigured && player===localPlayer)?1:volume/100;
  if(audioConfigured)masterGain.gain.value=volume/100;
  player.muted=muted||volume===0;
  $('soundButton').textContent=player.muted?'🔇':'🔊';
}
function updateMeter(){
  if(audioConfigured&&player===localPlayer&&analyser){let buf=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(buf);
    let avg=buf.reduce((a,b)=>a+b,0)/buf.length/255;
    $('vuFill').style.width=Math.min(100,avg*190)+'%';
  }else $('vuFill').style.width='0%';
  requestAnimationFrame(updateMeter);
}
function fmtSec(x){if(!Number.isFinite(x)||x<0)return '--:--';x=Math.floor(x);return pad(Math.floor(x/60))+':'+pad(x%60)}
function updatePlayPosition(now){
  const c=playingAt(now),current=c?.item;
  if(!current)return;
  let dur=current.duration,position=(activeId===current.id && activeSource && !current.asset?.embedProvider && started)?player.currentTime:c.offset;
  if(current.asset?.embedProvider==='pomfy'){
    $('timeReadout').textContent=`${fmtSec(c.offset)} / ${fmtSec(dur)} · estimado`;
    $('progressTrack').setAttribute('aria-disabled','true');
  }else{
    $('timeReadout').textContent=`${fmtSec(position)} / ${fmtSec(dur)}`;
    $('progressTrack').setAttribute('aria-disabled',String(!(started&&current.asset&&activeId===current.id&&activeSource)));
    $('progressTrack').setAttribute('aria-valuenow',String(Math.round(Math.max(0,Math.min(1,position/dur))*1000)));
  }
}
 
const localPlayer = $('player'), remotePlayer = $('stremioPlayer');
let player = localPlayer; player.muted = true; volume=Number.isFinite(volume)?volume:65;
function selectVideo(remote){
  const chosen=remote?remotePlayer:localPlayer;
  if(player!==chosen){player.pause();player.style.display='none';player=chosen;}
  $('normalizeButton').disabled=remote;
  $('normalizeButton').title=remote?'Som estável é exclusivo dos vídeos locais; não há áudio remoto processado pela Web Audio API.':'';
  applyVolume();
}

const pad = x => String(x).padStart(2,'0');
const escapeHTML = x => String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function dateFor(now){const m=now.getMonth()+1;return {year,month:m,day:Math.min(now.getDate(),new Date(year,m,0).getDate())}}
function dateKey(now){const d=dateFor(now);return `${d.year}-${pad(d.month)}-${pad(d.day)}`}
function secs(now){return now.getHours()*3600+now.getMinutes()*60+now.getSeconds()+now.getMilliseconds()/1000}
function timeStr(s){return `${pad(Math.floor(s/3600)%24)}:${pad(Math.floor(s/60)%60)}`}
function seasonFor(d){return CnPlanner.season(d)}
function buildSchedule(now){
  const generated=CnPlanner.generate(now,year,catalog);
  schedule=generated.entries;lastDateKey=generated.date;
  renderPage(now);activeId='';if(started)syncPlayback(now,true);
}
function playingAt(now){if(!schedule.length)return null;const pos=secs(now);let lo=0,hi=schedule.length-1;
  while(lo<=hi){let mid=(lo+hi)>>1,entry=schedule[mid];if(pos<entry.start)hi=mid-1;else if(pos>=entry.end)lo=mid+1;else return {item:entry,index:mid,offset:pos-entry.start}}
  return {item:schedule.at(-1),index:schedule.length-1,offset:0};
}
function renderBlocks(){
  const available=Object.entries(CnPlanner.BLOCKS).filter(([id,b])=>id!=='regular' && year>=b.from && year<=b.to && !(id==='brazuca'&&year>=2017));
  if(year===2020)available.push(['votatoon',CnPlanner.BLOCKS.votatoon]);
  $('blockList').innerHTML=available.map(([id,b])=>`<span class="block-chip" title="${escapeHTML(b.desc)}"><span>${b.icon}</span>${escapeHTML(b.name)}</span>`).join('');
}
function renderGuide(now){const cur=playingAt(now);if(!cur)return;
  const main=schedule.filter(s=>s.isMain);let anchor=main.find(x=>x.start<=secs(now)&&x.end>secs(now));
  if(!anchor)anchor=[...main].reverse().find(x=>x.start<=secs(now))||main[0];
  activeGuideId=anchor?.id||'';
  $('guide').innerHTML=main.map(x=>`<div class="guide-row ${x.id===activeGuideId?'is-active':x.start>secs(now)&&x.start<secs(now)+3600?'is-upcoming':''}" data-id="${escapeHTML(x.id)}"><span class="time">${timeStr(x.start)}</span><div><div class="name">${escapeHTML(x.title)}</div><div class="detail">${escapeHTML(CnPlanner.BLOCKS[x.block]?.name||x.block||'Programação')} · ${Math.max(1,Math.round(x.duration/60))} min${x.asset?.durationVerified===false?' (previsto)':''}${x.episodeAge==='novo'?' · ✨ NOVO':''}${!x.asset?' · Acervo pendente':''}</div>${x.id===activeGuideId?'<span class="live-small">● AGORA</span>':''}</div></div>`).join('');
  const active=$('guide').querySelector('.is-active');if(active)active.scrollIntoView({block:'center',behavior:'instant'});
}
function decorate(d){const season=seasonFor(d);document.body.dataset.season=season;document.body.dataset.era=ERA[year][2];document.body.dataset.year=year;
  const messages={normal:['✦','Programação regular','A seleção diária acompanha a identidade de cada ano.'],halloween:['🎃','Outubro do Terror','Abóboras, esqueletos, sustos e especiais durante outubro.'],christmas:['🎄','Natal Cartoon','Luzes piscantes, presentes, árvores e programação natalina durante dezembro.'],easter:['🐣','Especial de Páscoa','Ovos, coelhos e episódios temáticos durante abril.'],vacation:['☀️','Férias Cartoon!','Julho com maratonas, Jovens Titãs e desenhos para as férias.'],thanksgiving:['🍁','Ação de Graças','Chamadas e especiais de fim de novembro, conforme disponibilidade no acervo.']};
  const [icon,title,description]=messages[season];$('seasonIcon').textContent=icon;$('seasonTitle').textContent=title;
  $('seasonDescription').textContent=description;$('seasonYear').textContent=year;
  $('eventOverlay').textContent=season==='normal'?'':season==='halloween'?'🎃 OUTUBRO DO TERROR':season==='christmas'?'🎄 NATAL CARTOON':season==='vacation'?'☀️ FÉRIAS CARTOON':season==='thanksgiving'?'🍁 AÇÃO DE GRAÇAS':'🐣 PÁSCOA CARTOON';
}
function renderPage(now){const d=dateFor(now);decorate(d);$('selectedYear').textContent=year;$('onAirYear').textContent=year;$('videoYear').textContent=year;
  $('yearSlider').value=year;$('eraLabel').textContent=ERA[year][0];$('eraCaption').textContent=ERA[year][1];$('timelineEra').textContent=ERA[year][0];$('virtualDate').textContent=`${pad(d.day)}/${pad(d.month)}/${d.year}`;
  $('mediaCount').textContent=catalog.length;$('sourceCount').textContent=`${catalog.filter(x=>x.source==='local').length} locais · ${catalog.filter(x=>x.source==='external').length} URLs · ${catalog.filter(x=>x.source==='stremio'&&x.enabled!==false).length} episódios Stremio indexados`; 
  $('generationLabel').textContent='Grade: '+dateKey(now);
  $('programCount').textContent=schedule.filter(x=>x.isMain).length+' atrações';
  document.querySelectorAll('.year-markers button').forEach(b=>b.classList.toggle('active',Number(b.dataset.year)===year));
  renderBlocks();renderGuide(now);renderLibrary();updateStatus(now);
}
function updateStatus(now){const c=playingAt(now);if(!c)return;const {item,index,offset}=c;
  $('clock').textContent=now.toLocaleTimeString('pt-BR');$('nowTitle').textContent=item.title;
  const next=schedule.slice(index+1).find(s=>s.isMain)||schedule.find(s=>s.isMain);
  $('nowMeta').textContent=(CnPlanner.BLOCKS[item.block]?.name||item.block||({ad:'PROPAGANDA COMERCIAL',bumper:'VINHETA DA ÉPOCA',call:'CHAMADA · VEM AÍ',promo:'PROMO DO CANAL',movie:'CINE CARTOON',special:'ESPECIAL',episode:'DESENHO ANIMADO'}[item.kind]||'CN TIMELINE')).toUpperCase();
  $('nextTitle').textContent=next?`${timeStr(next.start)} • ${next.title}`:'Voltamos em instantes';
  $('screen').dataset.block=item.block||'regular';
  updatePlayPosition(now);
  $('progressBar').style.width=(Math.min(100,Math.max(0,((freeMode&&activeId===item.id)?player.currentTime:offset)/item.duration*100)))+'%';
  if(!item.asset){$('standbyTitle').textContent=item.title;$('standbyDesc').textContent=({'episode':'Este episódio ainda não está no acervo.','movie':'Adicione um filme à biblioteca para o Cine Cartoon.','ad':'Aguardando os comerciais brasileiros da coleção.','bumper':'Aguardando os bumpers desta época.','promo':'Aguardando chamadas e vinhetas do acervo.','special':'Adicione episódios especiais da temporada.'}[item.kind]||'O canal continua no horário previsto.')}
  // Recria o guia apenas quando o item muda, não a cada segundo.
  if(c.item.id!==updateStatus.lastId){updateStatus.lastId=c.item.id;renderGuide(now)}
}
// Explorador de mídia: separa claramente o acervo de cada ano e sinaliza pendências.
function mediaAppliesYear(a,y){
 if(Array.isArray(a.years)&&a.years.length&&!a.years.includes(y))return false;
 const start=`${y}-01-01`,end=`${y}-12-31`;
 if(a.releaseDate&&a.releaseDate>end)return false;
 if(a.firstAiredBR&&a.firstAiredBR>end)return false;
 if(a.validFrom&&a.validFrom>end)return false;
 if(a.validUntil&&a.validUntil<start)return false;
 if(a.kind==='episode'&&!a.releaseDate&&!a.firstAiredBR)return false;
 return true;
}
function renderLibrary(){
 const y=Number($('mediaYear').value==='auto'?year:$('mediaYear').value);
 const k=$('mediaKind').value;
 const chosen=catalog.filter(a=>mediaAppliesYear(a,y)&&(k==='all'||a.kind===k));
 const good=chosen.filter(a=>a.enabled!==false&&a.duration>0);
 const pending=chosen.filter(a=>a.enabled===false||!a.duration);
 const remoteCount=good.filter(a=>a.source==='stremio').length;
 $('mediaLibrarySummary').textContent=`${y} · ${good.length-remoteCount} mídias locais/URLs · ${remoteCount} itens Stremio aptos na grade · ${pending.length} pendentes`; 
 const kinds={episode:'📺',movie:'🍿',call:'📢',promo:'📣',bumper:'✳️',ad:'🛍️',short:'🎬',special:'🎉'};
 $('mediaLibraryList').innerHTML=(chosen.slice(0,25).map(a=>`<div class="media-library-row"><span>${kinds[a.kind]||'▶'}</span><div><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.kind)} · ${a.duration?Math.ceil(a.duration)+'s':'sem duração'} · ${escapeHTML((a.years||[]).join(', ')||a.releaseDate?.slice(0,4)||'sem época')}</small></div><span class="media-state ${a.enabled===false||!a.duration?'pending':'ok'}">${a.enabled===false||!a.duration?'PENDENTE':a.source==='stremio'?'CATALOGADO':'OK'}</span></div>`).join('')||'<div class="media-library-empty">Nenhum vídeo desta categoria nesse ano.</div>')+(chosen.length>25?`<div class="media-library-empty">+ ${chosen.length-25} outros arquivos</div>`:'');
}
function standby(){clearStremioLoadTimer();destroyHls();localPlayer.pause();remotePlayer.pause();localPlayer.style.display='none';remotePlayer.style.display='none';$('screen').classList.remove('video-ready');activeSource='';}
function closeExternal(resync=true){
  $('externalFrame').src='about:blank';$('externalFrame').hidden=true;$('providerTip').hidden=true;
  $('volumeSlider').disabled=false;$('normalizeButton').disabled=false;$('soundButton').disabled=false;
  $('closeExternal').hidden=true;externalOpen=false;externalItem='';externalUrl='';
  $('screen').classList.remove('embed-ready');
  if(resync && started)syncPlayback(new Date(),true);
}
function showExternal(item){
  // O usuário iniciou a TV com um clique. Carregamos o iframe na própria tela,
  // sem intersticial de confirmação. Reprodução automática não é garantida.
  standby();activeId=item.id;activeSource=item.asset.path;freeMode=false;
  try{
    const url=embedUrl(item.asset.path);
    $('externalFrame').src=url;
    $('externalFrame').hidden=false;
    $('externalCTA').hidden=true;
    $('closeExternal').hidden=false;
    $('providerTip').hidden=false;
    $('volumeSlider').disabled=true;$('normalizeButton').disabled=true;$('soundButton').disabled=true;
    $('screen').classList.add('embed-ready');
    externalOpen=true;externalItem=item.id;externalUrl=url;
    iframeLoadedAt=Date.now();
    $('syncLabel').textContent='Pomfy incorporado · posição estimada · use os controles do provedor';
  }catch(e){$('notice').textContent='Não foi possível incorporar Pomfy: '+e.message;}
}
function embedUrl(source){
  // A API documenta #cor:HEX para customizar cor visual do próprio player.
  const eraColors={2015:'FFE261',2016:'FFB95B',2017:'69D1FF',2018:'AC83FF',2019:'F69A71',2020:'55E8CB',2021:'B5F16D'};
  const url=new URL(source);
  if(url.protocol!=='https:'||url.hostname!=='api.pomfy.stream')throw Error('Origem de player não permitida');
  url.hash='cor:'+eraColors[year];
  return url.toString();
}

// Duração real do arquivo prevalece sobre a duração estimada da TVmaze/IMDb.
// Recalcula todo o restante do dia sem cortar nenhum ativo futuro na meia-noite.
function reconcileDuration(item,realDuration){
  if(!item?.asset || !Number.isFinite(realDuration) || realDuration<15 || realDuration>30000)return;
  if(item.filmPart)return; // Filmes desta versão são uma mídia contínua.
  const delta=realDuration-item.duration;
  if(Math.abs(delta)<.7)return;
  let idx=schedule.findIndex(x=>x.id===item.id);
  if(idx<0)return;
  const originalDate=lastDateKey;
  const priorEnd=item.end;
  item.duration=realDuration;item.end=item.start+realDuration;
  item.asset.duration=realDuration;item.asset.durationVerified=true;
  for(let i=idx+1;i<schedule.length;i++){
    schedule[i].start+=delta;schedule[i].end+=delta;
  }
  // Nunca truncar uma mídia para encaixar o dia: retirar itens futuros inteiros
  // no limite de meia-noite, mantendo um cartão de preenchimento até as 00:00.
  while(schedule.length && schedule.at(-1).start>=DAY-.001)schedule.pop();
  while(schedule.length && schedule.at(-1).end>DAY+.001){
    const last=schedule.at(-1);
    if(last.kind==='slate'){
      last.duration=DAY-last.start;last.end=DAY;break;
    }
    if(last.id===item.id){ // uma mídia já em andamento que passa da meia-noite
      break; // Não forçar corte do vídeo; a grade seguinte será atualizada.
    }
    schedule.pop();
  }
  if(schedule.length && schedule.at(-1).end<DAY-.001){
    let start=schedule.at(-1).end;
    schedule.push({id:originalDate+':ajuste:'+Date.now(),kind:'slate',title:'Cartoon Network · próxima programação',asset:null,
      start,end:DAY,duration:DAY-start,block:'regular',isMain:false});
  }
  renderGuide(new Date());updateStatus(new Date());
  $('syncLabel').textContent='Tempo real detectado: grade recalculada ('+(delta>0?'+':'')+Math.round(delta)+'s)';
}
function observeDuration(item,raw){
  if(!item?.asset || !Number.isFinite(raw) || raw<15)return;
  const measured=Number(raw.toFixed(3));
  const cacheId=item.asset.id;
  if(item.asset.source==='stremio' && cacheId && !observedRequests.has(cacheId)){
    observedRequests.add(cacheId);
    fetch('/api/duration/observe',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:cacheId,duration:measured})}).catch(()=>observedRequests.delete(cacheId));
  }
  reconcileDuration(item,measured);
}
function skipEndedItem(now){
  const index=schedule.findIndex(e=>e.id===activeId);
  if(index<0)return;
  const item=schedule[index], t=secs(now);
  if(t>=item.end-.5)return;
  const delta=t-item.end;
  item.duration=Math.max(.1,t-item.start);
  item.end=t;
  for(let i=index+1;i<schedule.length;i++){
    schedule[i].start+=delta;schedule[i].end+=delta;
  }
  if(schedule.at(-1).end<DAY){
    const end=schedule.at(-1).end;
    schedule.push({id:lastDateKey+':ended:'+index,kind:'slate',title:'Cartoon Network · em instantes',asset:null,start:end,end:DAY,duration:DAY-end,block:'regular',isMain:false});
  }
  renderGuide(now);
}
async function pollAutoSync(){
  if(syncPollingInFlight)return;
  syncPollingInFlight=true;
  try{
    const r=await fetch('/api/sync/status',{cache:'no-store'});if(!r.ok)return;
    const x=await r.json();
    $('syncStremioStatus').textContent=`${x.phase} · ${x.episodes||0} episódios indexados · vídeo verificado na hora de reproduzir${x.lastError?' · '+x.lastError:''}${!x.episodes?' · ainda sem metadados locais: verificando TVmaze/Cinemeta ou aguardando importação do cache':''}`;
    const snapshot=`${x.episodes}|${x.verifiedShows}|${x.verifiedMovies}`;
    if(snapshot!==lastSyncSnapshot){
      lastSyncSnapshot=snapshot;
      // Ao ligar o canal, jamais reconstruir a grade do nada e cortar o vídeo atual.
      const active=playingAt(new Date())?.item;
      if(!started || !active?.asset){
        await refreshCatalog(); // evita ficar o dia todo na tela 'acervo pendente' após a primeira sincronização
      }else {catalogRefreshPending=true;$('notice').textContent='Novos metadados recebidos: a biblioteca atualizará após o episódio, sem interromper o vídeo.';}
    }
  }catch{}finally{syncPollingInFlight=false}
}

function tryAlternativeEpisode(item){
  if(!item?.asset || item.asset.source!=='stremio'||item.asset.kind!=='episode')return false;
  if(!item.altTried)item.altTried=new Set([item.asset.id]);
  if(item.altTried.size>=4)return false;
  const now=new Date(),d=dateFor(now), virtual=`${d.year}-${pad(d.month)}-${pad(d.day)}`;
  const pool=catalog.filter(a=>a.source==='stremio' && a.kind==='episode' && a.enabled!==false &&
    a.show===item.asset.show && a.releaseDate && a.releaseDate<=virtual &&
    (!a.originalAirdate||a.originalAirdate<=virtual) && !item.altTried.has(a.id) &&
    !failedEpisodeByYear.has(`${year}:${a.id}`) && a.duration>0);
  if(!pool.length)return false;
  pool.sort((a,b)=>Math.abs(a.duration-item.duration)-Math.abs(b.duration-item.duration));
  const candidate=pool[0], old=item.asset;
  item.altTried.add(candidate.id);failedEpisodeByYear.add(`${year}:${old.id}`);
  stremioVersion++;stremioResolving='';stremioCandidates=[];stremioCandidateIndex=-1;
  stremioAssetKey='';stremioExcluded=[];clearPendingRequest();standby();activeId='';failedAssetId='';
  item.asset=candidate;item.title=candidate.name;item.episodeAge='alternativa';
  // Original slot duration is only a prediction. Adjust it when a new video's
  // metadata loads; this preserves the guide without cutting the movie/episode.
  reconcileDuration(item,Number(candidate.duration));
  candidate.durationVerified=false; // duração de catálogo não é duração efetivamente medida
  $('syncLabel').textContent='Fonte indisponível · tentando outro episódio compatível';
  renderGuide(now);syncPlayback(now,true);
  return true;
}
function playStremioCandidate(item,index,version){
  if(version!==stremioVersion || !started)return;
  const candidate=stremioCandidates[index];
  if(!candidate)return;
  stremioCandidateIndex=index;
  lastRemoteProgressAt=Date.now();
  clearStremioLoadTimer();destroyHls();
  selectVideo(true);
  // Inicia em um novo elemento <video>, sem o compressor configurado nos arquivos locais.
  player.pause();player.removeAttribute('src');player.load();
  activeId=item.id;activeSource=candidate.url;
  player.style.display='block';$('screen').classList.add('video-ready');
  $('syncLabel').textContent=`${currentProvider} · fonte ${index+1}/${stremioCandidates.length} · carregando…`;
  const load=()=>{
    if(version!==stremioVersion||activeId!==item.id||activeSource!==candidate.url)return;
    clearStremioLoadTimer();
    const now=playingAt(new Date());
    if(!now||now.item.id!==item.id)return;
    observeDuration(item,player.duration);
    const position=Math.max(0,Math.min((player.duration||item.duration)-.5,secs(new Date())-item.start));
    try{player.currentTime=position;}catch{}
    applyVolume();
    player.play().then(()=>{
      $('syncLabel').textContent=`${currentProvider} · fonte ${index+1}/${stremioCandidates.length} · em transmissão`;
    }).catch(async()=>{
      player.muted=true;
      try{await player.play();$('syncLabel').textContent='Iniciou sem áudio; clique no ícone 🔇 para ativar';}
      catch{$('syncLabel').textContent='Navegador exige clique em Assistir para iniciar';}
    });
  };
  stremioLoadTimer=setTimeout(()=>{
    if(version===stremioVersion && activeId===item.id && activeSource===candidate.url && player.readyState<1){
      $('syncLabel').textContent=`${currentProvider} · fonte ${index+1} sem resposta; tentando outra…`;
      nextStremioCandidate();
    }
  },9500);
  if(candidate.format==='hls'&&!player.canPlayType('application/vnd.apple.mpegurl')){
    if(window.Hls&&window.Hls.isSupported()){
      const hls=hlsPlayer=new window.Hls({enableWorker:true});
      hls.attachMedia(player);hls.loadSource(candidate.url);
      hls.once(window.Hls.Events.MANIFEST_PARSED,load);
      hls.on(window.Hls.Events.ERROR,(_event,data)=>{
        if(data?.fatal && hlsPlayer===hls)nextStremioCandidate();
      });
    }else{nextStremioCandidate();}
  }else{
    player.src=candidate.url;
    if(player.readyState>=1)load();
    else player.addEventListener('loadedmetadata',load,{once:true});
  }
}
function nextStremioCandidate(){
  if(!started)return;
  const current=playingAt(new Date())?.item;
  if(!current||current.asset?.source!=='stremio'||current.id!==activeId)return;
  clearStremioLoadTimer();
  if(stremioCandidateIndex+1<stremioCandidates.length){
    playStremioCandidate(current,stremioCandidateIndex+1,stremioVersion);
    return;
  }
  const failed=currentProvider;
  if(failed && !stremioExcluded.includes(failed))stremioExcluded.push(failed);
  stremioCandidates=[];stremioCandidateIndex=-1;
  standby();activeId='';
  $('syncLabel').textContent=`${failed} esgotado; procurando outro addon…`;
  openStremio(current,0);
}
async function openStremio(item,offset,force=false){
  if(stremioResolving===item.id && !force)return;
  const asset=item.asset;
  if(stremioAssetKey!==item.id){stremioExcluded=[];stremioAssetKey=item.id;}
  const version=++stremioVersion;
  const key=item.id;
  clearPendingRequest();
  // Libera o player imediatamente; não deixa o vídeo anterior tocando enquanto
  // o servidor procura a próxima fonte.
  if(activeId!==item.id){standby();activeId=item.id;}
  stremioResolving=key;
  const exclude=force?[]:stremioExcluded;
  $('syncLabel').textContent='Procurando episódio nos addons Stremio…';
  try{
    const cacheKey=episodeKey(asset), warm=warmedStreams.get(cacheKey);
    let result;
    if(!exclude.length && warm && Date.now()-warm.time<240000){
      result=warm.result;
    }else{
      const controller=new AbortController();streamRequest=controller;
      const response=await fetch('/api/stremio/resolve',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({imdbId:asset.imdbId,season:asset.season,episode:asset.episode,kind:asset.kind,excludeProviders:exclude})});
      result=await response.json();
      if(streamRequest===controller)streamRequest=null;
    }
    if(version!==stremioVersion || !started)return;
    stremioResolving='';
    const now=playingAt(new Date());
    if(!now || now.item.id!==key || year!==Number(asset.selectedYear||year))return;
    if(!result.ok){
      if(tryAlternativeEpisode(item))return;
      failedAssetId=item.id;standby();activeId=item.id;
      $('syncLabel').textContent='Episódio indisponível agora — verifique o status dos addons';
      $('notice').textContent=(result.reason||'Fonte indisponível')+' '+(result.attempts||[]).map(x=>x.addon+': '+x.status).join(' | ');
      return;
    }
    currentProvider=result.provider;
    stremioCandidates=(Array.isArray(result.candidates)&&result.candidates.length?result.candidates:[{url:result.url,format:result.format}])
      .filter(c=>c&&typeof c.url==='string'&&
        (location.protocol!=='https:'||!c.url.startsWith('http://')));
    stremioCandidateIndex=-1;
    if(!stremioCandidates.length){
      if(!stremioExcluded.includes(currentProvider))stremioExcluded.push(currentProvider);
      $('syncLabel').textContent='Fonte HTTP bloqueada em site HTTPS; tentando outro addon…';
      openStremio(item,offset);return;
    }
    playStremioCandidate(item,0,version);
  }catch(error){
    if(version!==stremioVersion)return;
    stremioResolving='';if(tryAlternativeEpisode(item))return;failedAssetId=item.id;standby();activeId=item.id;
    $('syncLabel').textContent='Erro ao consultar addons; os episódios já cadastrados foram preservados';
  }
}

function syncPlayback(now,force=false){if(!started)return;const c=playingAt(now);if(!c)return;const {item,offset}=c;
  // MP4/HLS ainda tocando: se a fonte atrasou, NÃO cortar no horário antigo.
  // O guia passa a indicar o tempo de parede necessário para terminar o vídeo,
  // incorporando atrasos de buffering; os próximos programas se deslocam juntos.
  // O teste é antes da seleção de um novo addon ou de um vídeo local.
  if(!force && activeId && activeId!==item.id && activeSource && player.style.display!=='none'
      && !player.ended && !player.paused && player.readyState>=1
      && Number.isFinite(player.duration) && player.duration>0
      && player.currentTime<player.duration-.65){
    const currentIndex=schedule.findIndex(x=>x.id===activeId);
    if(currentIndex>=0){
      const previous=schedule[currentIndex];
      const proposedEnd=Math.min(DAY,secs(now)+Math.max(0,player.duration-player.currentTime));
      const difference=proposedEnd-previous.end;
      if(difference>0.2){
        previous.duration+=difference;previous.end+=difference;
        for(let i=currentIndex+1;i<schedule.length;i++){
          schedule[i].start+=difference;schedule[i].end+=difference;
        }
        while(schedule.length&&schedule.at(-1).start>=DAY)schedule.pop();
        if(schedule.length && schedule.at(-1).kind==='slate' && schedule.at(-1).end>DAY){
          schedule.at(-1).duration=DAY-schedule.at(-1).start;schedule.at(-1).end=DAY;
        }
        renderGuide(now);updateStatus(now);
      }
    }
    $('syncLabel').textContent='Vídeo ainda em reprodução · próximo programa ajustado';
    return;
  }

  // Iframes de terceiros não expõem ended/seek. A TV continua calculando o horário,
  // mas NÃO corta um filme externo já aberto. O usuário fecha para reassumir a grade.
  if(externalOpen){
    if(item.id!==externalItem)$('syncLabel').textContent='Pomfy segue independente da grade; feche o iframe para voltar ao vivo';
    return;
  }
  if(item.asset?.source==='stremio'){
    if(activeId===item.id && activeSource && !force)return;
    if(item.id===failedAssetId&&!force)return;
    if(!force&&stremioResolving===item.id)return;
    openStremio(item,offset,force);
    return;
  }
  if(item.asset?.embedProvider==='pomfy'){
    if(force||activeId!==item.id){showExternal(item)}
    return;
  }
  $('externalCTA').hidden=true;$('providerTip').hidden=true;
  if(freeMode&&!force&&activeId===item.id)return;

  if(stremioResolving && stremioResolving!==item.id){stremioVersion++;stremioResolving='';clearPendingRequest()}
  if(item.id===failedAssetId&&!force)return;
  if(item.id!==failedAssetId)failedAssetId='';
  if(!item.asset){if(force||item.id!==activeId){activeId=item.id;standby()}return}
  const source=item.asset.path,mediaTime=(item.mediaOffset||0)+offset;
  if(!force&&activeId===item.id&&activeSource===source)return; // não salta trechos durante buffering
  selectVideo(false);activeId=item.id;activeSource=source;const localVersion=++retryVersion;
  player.pause();player.style.display='block';player.src=source;applyVolume();$('screen').classList.add('video-ready');
  const play=()=>{if(localVersion!==retryVersion||activeId!==item.id)return;
    const target=Math.max(0,Math.min(mediaTime,Number.isFinite(player.duration)?Math.max(0,player.duration-.12):mediaTime));
    try{player.currentTime=target}catch{}
    if(source.startsWith('/media/'))initAudioGraph();soundContext?.resume().catch(()=>{});
    player.play().catch(()=>{$('syncLabel').textContent='Clique em Assistir para liberar o vídeo';});
  };
  if(player.readyState>=1)play();else player.addEventListener('loadedmetadata',play,{once:true});
}
async function refreshCatalog(){try{const response=await fetch('/api/catalog',{cache:'no-store'});if(!response.ok)throw Error(response.status);const body=await response.json();
    catalog=Array.isArray(body.media)?body.media.filter(x=>x&&x.path):[];
    $('notice').textContent=catalog.length?`Pronto! ${catalog.length} mídia(s) catalogada(s). O canal usa apenas itens compatíveis com o ano.`:'A biblioteca está vazia. Coloque arquivos em media/ ou adicione fontes diretas autorizadas.';
    const promos=catalog.filter(x=>x.kind==='promo'),pending=promos.filter(x=>x.enabled===false);
    $('promoSummary').textContent=`📣 ${promos.length} promos · 📢 ${catalog.filter(x=>x.kind==='call').length} chamadas · ${pending.length} pendências`;
  }catch(e){$('notice').textContent='Não foi possível atualizar o catálogo; mantendo os dados carregados anteriormente.'}
  buildSchedule(new Date());
}
function setYear(value){stremioVersion++;stremioResolving='';stremioExcluded=[];stremioAssetKey='';stremioCandidates=[];stremioCandidateIndex=-1;clearStremioLoadTimer();destroyHls();freeMode=false;$('liveButton').hidden=true;const n=Math.max(MIN_YEAR,Math.min(MAX_YEAR,Number(value)));
  if(n===year)return;
  // Troca imediata: a requisição e o vídeo do ano anterior não devem segurar a UI.
  clearPendingRequest();standby();activeId='';activeSource='';nextWarmKey='';
  const curtain=$('eraCurtain');$('eraCurtainTitle').textContent=ERA[n][0];
  document.body.classList.remove('era-changing');void curtain.offsetWidth;
  document.body.classList.add('era-changing');
  clearTimeout(transitionTimeout);
  transitionTimeout=setTimeout(()=>document.body.classList.remove('era-changing'),1180);
  closeExternal(false);$('externalCTA').hidden=true;year=n;localStorage.setItem('cnTimelineYear',year);buildSchedule(new Date());
}
function init(){for(let y=MIN_YEAR;y<=MAX_YEAR;y++){const btn=document.createElement('button');btn.type='button';btn.textContent=y;btn.dataset.year=String(y);btn.addEventListener('click',()=>setYear(y));$('yearMarkers').append(btn)}
  $('timelineToggle').addEventListener('click',()=>{const open=$('timelinePanel').hidden;$('timelinePanel').hidden=!open;$('timelineToggle').setAttribute('aria-expanded',String(open));});
  $('yearSlider').addEventListener('input',e=>setYear(e.target.value));
  $('watchButton').addEventListener('click',()=>{started=true;muted=false;applyVolume();soundContext?.resume().catch(()=>{});$('watchButton').innerHTML='● <span>TRANSMITINDO</span>';$('syncLabel').textContent='Sincronizado em tempo real';failedAssetId='';syncPlayback(new Date(),true)});
  $('soundButton').addEventListener('click',()=>{muted=!muted;applyVolume();});
  $('volumeSlider').addEventListener('input',e=>{volume=Number(e.target.value);muted=false;localStorage.setItem('cnVolume',volume);applyVolume()});
  $('normalizeButton').addEventListener('click',()=>{stableVolume=!stableVolume;localStorage.setItem('cnStableVolume',stableVolume);applyStableVolume()});
  $('themeButton').addEventListener('click',()=>{
    const newTheme=document.body.dataset.theme==='light'?'dark':'light';
    document.body.dataset.theme=newTheme;localStorage.setItem('cnTheme',newTheme);
    $('themeButton').textContent=newTheme==='dark'?'☀ Modo claro':'☾ Modo escuro';
  });
  function jumpToFraction(fraction){
    const item=playingAt(new Date())?.item;
    if(!started||!item?.asset||activeId!==item.id||item.asset.embedProvider==='pomfy'||!activeSource)return;
    const range=Number.isFinite(player.duration)&&player.duration>0?player.duration:item.duration;
    freeMode=true;$('liveButton').hidden=false;
    player.currentTime=Math.max(0,Math.min(range-0.25,fraction*range));
    $('syncLabel').textContent='Modo livre: clique em Voltar ao vivo para sincronizar';
    updateStatus(new Date());
  }
  $('progressTrack').addEventListener('click',e=>{
    const rect=e.currentTarget.getBoundingClientRect();
    jumpToFraction(Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)));
  });
  $('progressTrack').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();const pos=Number($('progressTrack').getAttribute('aria-valuenow'))/1000;
    jumpToFraction(e.key==='Home'?0:e.key==='End'?1:pos+(e.key==='ArrowRight'?.025:-.025));
  });
  $('liveButton').addEventListener('click',()=>{freeMode=false;$('liveButton').hidden=true;syncPlayback(new Date(),true);});
  $('syncStremioButton').addEventListener('click',async()=>{
    const btn=$('syncStremioButton');btn.disabled=true;
    $('syncStremioStatus').textContent='Sincronização manual reiniciada em segundo plano…';
    try{const r=await fetch('/api/stremio/sync',{method:'POST'});const j=await r.json();
      $('syncStremioStatus').textContent=j.message+(j.errors?.length?' · '+j.errors.join(', '):'');
      if(r.ok)pollAutoSync();
    }catch{$('syncStremioStatus').textContent='Falha de conexão com TVmaze. Confira internet e servidor Python.'}
    finally{btn.disabled=false}
  });
  $('probeStremioButton').addEventListener('click',async()=>{
    const btn=$('probeStremioButton');btn.disabled=true;$('stremioStatus').textContent='Verificando manifestos…';
    try{const r=await fetch('/api/stremio/status');const j=await r.json();
      $('stremioStatus').textContent=j.sources.map(s=>(s.online?'✓ ':'✗ ')+s.name+(s.online?' (manifesto OK)':' (indisponível)')).join(' · ');
    }catch{$('stremioStatus').textContent='Não foi possível consultar os addons.'}
    finally{btn.disabled=false}
  });
  $('fullButton').addEventListener('click',()=>{const box=$('screen');if(document.fullscreenElement)document.exitFullscreen?.();else box.requestFullscreen?.()});
  $('openExternal').addEventListener('click',()=>{
    const current=playingAt(new Date())?.item;
    if(!started||!current?.asset||current.asset.embedProvider!=='pomfy')return;
    try{
      externalUrl=embedUrl(current.asset.path);
      $('externalFrame').src=externalUrl;
      $('externalFrame').hidden=false;
      $('externalCTA').hidden=true;
      $('closeExternal').hidden=false;
      $('screen').classList.add('embed-ready');
      externalOpen=true;externalItem=current.id;
      $('syncLabel').textContent='Player externo aberto: sem sincronização automática';
    }catch(error){$('notice').textContent='Origem externa inválida. '+error.message}
  });
  $('closeExternal').addEventListener('click',()=>closeExternal(true));
  $('refreshButton').addEventListener('click',refreshCatalog);
  $('mediaYear').addEventListener('change',renderLibrary);
  $('mediaKind').addEventListener('change',renderLibrary);
  for(const videoEl of [localPlayer,remotePlayer]){
    videoEl.addEventListener('ended',()=>{
      if(videoEl!==player)return;
      if(freeMode){freeMode=false;$('liveButton').hidden=true;}
      if(catalogRefreshPending){catalogRefreshPending=false;activeId='';standby();refreshCatalog();return;}
      const now=new Date(),c=playingAt(now);
      if(c&&c.item.id===activeId){
        if(dateKey(now)!==lastDateKey){activeId='';standby();buildSchedule(now);return;}
        skipEndedItem(now); failedAssetId=''; activeId=''; standby();syncPlayback(now,true);
      }else syncPlayback(now,true);
    });
    if(videoEl===remotePlayer){
      videoEl.addEventListener('timeupdate',()=>{
        if(videoEl===player && !videoEl.paused)lastRemoteProgressAt=Date.now();
      });
      videoEl.addEventListener('waiting',()=>{
        clearTimeout(stallTimer);
        const startedWaiting=Date.now();
        stallTimer=setTimeout(()=>{
          if(started&&player===remotePlayer&&!videoEl.paused && videoEl.readyState<3
             && Date.now()-Math.max(lastRemoteProgressAt,startedWaiting)>18000){
            $('syncLabel').textContent='Stream sem avanço por 18s; tentando outra fonte…';nextStremioCandidate();
          }
        },18500);
      });
      videoEl.addEventListener('playing',()=>{lastRemoteProgressAt=Date.now();clearTimeout(stallTimer);stallTimer=null;});
    }
    videoEl.addEventListener('error',()=>{
      if(!started||videoEl!==player)return;
      const current=playingAt(new Date())?.item;
      if(current?.id===activeId&&current.asset?.source==='stremio'){
        $('syncLabel').textContent='Fonte falhou no player; testando próxima…';
        nextStremioCandidate();return;
      }
      failedAssetId=activeId;standby();$('notice').textContent='Este vídeo não pôde ser reproduzido. Verifique codec, URL, Range e CORS.';
    });
  }
  document.body.dataset.theme=localStorage.getItem('cnTheme')||'dark';
  $('themeButton').textContent=document.body.dataset.theme==='dark'?'☀ Modo claro':'☾ Modo escuro';
  applyVolume();applyStableVolume();
  $('externalFrame').addEventListener('load',()=>{if(externalOpen) $('syncLabel').textContent='Iframe Pomfy carregado (reprodução não verificável) · controles dentro do player'});
  refreshCatalog();
  pollAutoSync();setInterval(pollAutoSync,12000);
  setInterval(()=>{const now=new Date();if(dateKey(now)!==lastDateKey){
    if(started && activeSource && player.style.display!=='none' && !player.ended && player.readyState>=1 && Number.isFinite(player.duration) && player.currentTime<player.duration-.4){
      $('syncLabel').textContent='Terminando vídeo da noite anterior, sem cortar na virada';return;
    }
    buildSchedule(now);return;}updateStatus(now);if(started){syncPlayback(now);warmNextEpisode(now)}},1000);
}
init();
