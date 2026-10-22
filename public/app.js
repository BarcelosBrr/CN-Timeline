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
let adultMode=localStorage.getItem('cnAdultSwimUS')==='true';
let catalogMode=localStorage.getItem('cnCatalogMode')||'normal';
let selectedShows=new Set();
try{selectedShows=new Set(JSON.parse(localStorage.getItem('cnFavoriteShows')||'[]'))}catch{}
const confirmedPlayback=new Set();
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
let stremioRetryTimer=null;
let stremioPlaybackStarted=false;
let stremioAutoplayBlocked=false;
let streamRequest=null, nextWarmKey='', nextWarmAt=0;
let observedRequests=new Set(),lastSyncSnapshot='',syncPollingInFlight=false,stallTimer=null;
let previousVerifiedShows=0,availabilityRefreshRequested=false;
let lastRemoteProgressAt=0,catalogRefreshPending=false,unsupportedCandidateCount=0;
let pendingCatalog=null,stremioRequestedOffset=0,stremioRequestedAt=0,activeStallStart=0;
let guideBrowsingUntil=0, guideFollowId="", lastWatchdog=0;
const warmedStreams=new Map();
const stremioRetryCounts=new Map();
let localWarmElement=null,localWarmKey='',remoteWarmElement=null,remoteWarmHls=null,remoteWarmKey='',remoteWarmUrl='';
function episodeKey(a){return a?.source==='stremio'?`${a.kind}:${a.imdbId}:${a.season||0}:${a.episode||0}`:''}
function clearPendingRequest(){if(streamRequest){streamRequest.abort();streamRequest=null}}
function clearRemoteWarm(){
 if(remoteWarmHls){try{remoteWarmHls.destroy()}catch{}remoteWarmHls=null;}
 if(!remoteWarmElement){remoteWarmKey='';remoteWarmUrl='';return;}
 try{remoteWarmElement.pause();remoteWarmElement.removeAttribute('src');remoteWarmElement.load();remoteWarmElement.remove()}catch{}
 remoteWarmElement=null;remoteWarmKey='';remoteWarmUrl='';
}
function preloadRemoteCandidate(key,candidate){
 if(!candidate?.url)return;
 if(remoteWarmKey===key&&remoteWarmUrl===candidate.url)return;
 clearRemoteWarm();
 const video=document.createElement('video');
 video.preload='auto';video.muted=true;video.playsInline=true;video.tabIndex=-1;
 video.setAttribute('aria-hidden','true');
 Object.assign(video.style,{position:'fixed',left:'-2px',top:'0',width:'1px',height:'1px',opacity:'0',pointerEvents:'none'});
 document.body.append(video);remoteWarmElement=video;remoteWarmKey=key;remoteWarmUrl=candidate.url;
 if(candidate.format==='hls'&&!video.canPlayType('application/vnd.apple.mpegurl')){
   if(!window.Hls||!window.Hls.isSupported()){clearRemoteWarm();return;}
   remoteWarmHls=new window.Hls({enableWorker:true,maxBufferLength:20,maxMaxBufferLength:30,backBufferLength:0});
   remoteWarmHls.attachMedia(video);remoteWarmHls.loadSource(candidate.url);
 }else{video.src=candidate.url;video.load();}
}
async function warmNextEpisode(now){
  if(!started || !schedule.length)return;
  const pos=secs(now), next=schedule.find(x=>x.isMain && x.start>pos && x.asset?.source==='stremio');
  if(!next || next.start-pos>900)return;
  const a=next.asset,key=episodeKey(a),cached=warmedStreams.get(key);
  const untilStart=next.start-pos;
  if(cached&&Date.now()-cached.time<240000){
    if(untilStart<=300){
      const candidate=(cached.result.candidates||[]).find(c=>location.protocol!=='https:'||!c.url.startsWith('http://'));
    if(a.kind==='episode'&&candidate)preloadRemoteCandidate(key,candidate);
    }
    return;
  }
  if(!key || (nextWarmKey===key && Date.now()-nextWarmAt<120000))return;
  nextWarmKey=key;nextWarmAt=Date.now();
  try{
    const response=await fetch('/api/stremio/resolve',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imdbId:a.imdbId,season:a.season,episode:a.episode,absoluteEpisode:a.absoluteEpisode,kind:a.kind,expectedShow:a.show,selectedYear:year})});
    if(!response.ok)return;
    const result=await response.json();
    if(result.ok){
      warmedStreams.set(key,{time:Date.now(),result,confirmed:false});
      const secondsUntilNow=next.start-secs(new Date());
      if(a.kind==='episode'&&schedule.some(x=>x.id===next.id)&&secondsUntilNow>=0&&secondsUntilNow<=300){
        const candidate=(result.candidates||[{url:result.url,format:result.format}])
          .find(c=>c?.url&&(location.protocol!=='https:'||!c.url.startsWith('http://')));
        if(candidate)preloadRemoteCandidate(key,candidate);
      }
    }
    if(warmedStreams.size>24)warmedStreams.delete(warmedStreams.keys().next().value);
  }catch{} // Prefetch não pode interromper o programa atual.
}
function warmNextLocal(now){
  if(!started||!schedule.length)return;
  const pos=secs(now),next=schedule.find(x=>x.start>pos&&x.asset?.source==='local'&&x.asset?.path?.startsWith('/media/'));
  if(!next||next.start-pos>240)return;
  const key=next.asset.path;if(localWarmKey===key)return;
  if(localWarmElement){try{localWarmElement.pause();localWarmElement.removeAttribute('src');localWarmElement.load()}catch{}}
  localWarmKey=key;localWarmElement=document.createElement('video');
  localWarmElement.preload='auto';localWarmElement.muted=true;localWarmElement.playsInline=true;
  localWarmElement.src=key;localWarmElement.load();
}

function destroyHls(){if(hlsPlayer){try{hlsPlayer.destroy()}catch{}hlsPlayer=null}}
function setTuning(on,message){const box=$("tuningOverlay");if(!box)return;box.hidden=!on;if(message)$("tuningStatus").textContent=message;}
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
  $('volumeSlider').value=volume;$('volumeSlider').style.setProperty('--volume-pct',volume+'%');$('volumeValue').textContent=volume+'%';
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
async function markWrongEpisode(){
  const entry=schedule.find(x=>x.id===activeId);
  const asset=entry?.asset;
  const candidate=stremioCandidates[stremioCandidateIndex];
  if(!asset || asset.source!=='stremio' || !candidate?.url)return;
  const button=$('wrongSourceButton');button.disabled=true;
  try{
    const response=await fetch('/api/stremio/report-wrong',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imdbId:asset.imdbId,season:asset.season,episode:asset.episode,kind:asset.kind,
         provider:currentProvider,url:candidate.url})});
    if(!response.ok)throw Error('HTTP '+response.status);
    const key=episodeKey(asset);warmedStreams.delete(key);
    $('syncLabel').textContent='Fonte incorreta bloqueada; tentando outra opção…';
    nextStremioCandidate();
  }catch(e){$('syncLabel').textContent='Não foi possível registrar a fonte incorreta';}
  finally{button.disabled=false;}
}

let player = localPlayer; player.muted = true; volume=Number.isFinite(volume)?volume:65;
function selectVideo(remote){
  $('wrongSourceButton').hidden=!remote;
  const chosen=remote?remotePlayer:localPlayer;
  if(remote)chosen.preload='auto';
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
  const generated=CnPlanner.generate(now,year,catalog,{adultSwimMode:adultMode,catalogMode,selectedShows:[...selectedShows]});
  schedule=generated.entries;lastDateKey=generated.date;
  renderPage(now);activeId='';
  if(generated.filteredFallback){$('catalogFilterStatus').textContent=`Seus desenhos favoritos não têm episódios elegíveis em ${year}; mantendo a programação normal para a TV não parar.`;}
  if(schedule.some(x=>x.kind==='slate'&&x.title==='Cartoon Network · acervo em verificação')){
    $('notice').textContent=`Diagnóstico da grade ${year}: ${catalog.filter(x=>x.kind==='episode').length} episódios indexados · ${generated.eligibleEpisodes} elegíveis para esta data · ${generated.eligibleShows} séries elegíveis · modo ${catalogMode}${adultMode?' · Adult Swim ativo':''}.`;
  }
  if(started)syncPlayback(now,true);
}
function playingAt(now){if(!schedule.length)return null;const pos=secs(now);let lo=0,hi=schedule.length-1;
  while(lo<=hi){let mid=(lo+hi)>>1,entry=schedule[mid];if(pos<entry.start)hi=mid-1;else if(pos>=entry.end)lo=mid+1;else return {item:entry,index:mid,offset:pos-entry.start}}
  return {item:schedule.at(-1),index:schedule.length-1,offset:0};
}
function renderBlocks(){
  const available=Object.entries(CnPlanner.BLOCKS).filter(([id,b])=>(id!=='adultswim'||adultMode) && id!=='regular' && year>=b.from && year<=b.to && !(id==='brazuca'&&year>=2017));
  if(year===2020)available.push(['votatoon',CnPlanner.BLOCKS.votatoon]);
  $('blockList').innerHTML=available.map(([id,b])=>`<span class="block-chip" title="${escapeHTML(b.desc)}"><span>${b.icon}</span>${escapeHTML(b.name)}</span>`).join('');
}
function renderCatalogFilter(){
  const list=$('scheduleAvailableList'),selectedList=$('catalogShowList');if(!list||!selectedList)return;
  const search=($('catalogFilterSearch')?.value||'').trim().toLocaleLowerCase('pt-BR');
  const names=[...new Set(catalog.filter(x=>x.kind==='episode'&&x.show&&x.enabled!==false).map(x=>x.show))]
    .sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const filtered=names.filter(name=>!search||name.toLocaleLowerCase('pt-BR').includes(search));
  const aliases={'Apenas um Show':'apenas_um_show','O Incrível Mundo de Gumball':'o_incrivel_mundo_de_gumball','Clarêncio, o Otimista':'clarencio_o_otimista','Hora de Aventura':'hora_de_aventura','Jovens Titãs em Ação':'jovens_titas_em_acao','Irmão do Jorel':'irmao_do_jorel','Poderosas Magiespadas':'poderosas_magiespadas','Ben 10: Omniverse':'ben_10_omniverse'};
  const slug=name=>aliases[name]||name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const eligibility=CnPlanner.showEligibilityMap(catalog,year,new Date());
  const makeTile=(name,selected=false)=>{
    const state=eligibility.get(name)||{eligible:false,reason:'historico'};
    const tile=document.createElement('button');tile.type='button';tile.className='schedule-show-tile'+(selected?' selected':'')+(!state.eligible?' unavailable':'');tile.draggable=!selected&&state.eligible;tile.disabled=!selected&&!state.eligible;tile.dataset.show=name;
    const img=document.createElement('img');img.src=`/media/images/thumb_${slug(name)}.png`;img.alt='';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='/media/images/logo_cn.png';img.classList.add('show-thumb-fallback')};
    const title=document.createElement('span');title.textContent=name;tile.append(img,title);
    if(!state.eligible&&!selected){const badge=document.createElement('small');badge.className='show-year-badge';badge.textContent=state.reason==='futuro'?'ESTREIA FUTURA':'SEM EPISÓDIOS NESTE ANO';tile.append(badge);tile.title=`Não há episódios elegíveis de ${name} para ${year}.`;}
    if(selected){const remove=document.createElement('i');remove.className='tile-remove';remove.textContent='×';remove.setAttribute('aria-hidden','true');tile.append(remove);tile.title='Remover da programação';tile.addEventListener('click',()=>toggleFavorite(name,false));}
    else {tile.title=selectedShows.has(name)?'Já está na programação':'Arraste ou toque para adicionar';tile.addEventListener('click',()=>toggleFavorite(name,!selectedShows.has(name)));tile.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',name);e.dataTransfer.effectAllowed='copy'});}
    return tile;
  };
  list.replaceChildren(...filtered.slice(0,500).map(name=>makeTile(name,false)));
  const chosen=[...selectedShows].filter(name=>names.some(n=>n.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))&&eligibility.get(name)?.eligible);
  selectedList.replaceChildren(...chosen.map(name=>makeTile(name,true)));
  $('scheduleShowCount').textContent=eligibility.size?`${[...eligibility.values()].filter(x=>x.eligible).length}/${names.length}`:String(names.length);
  $('scheduleDropHint').hidden=chosen.length>0;
  updateCatalogFilterStatus(names.length,[...eligibility.values()].filter(x=>x.eligible).length);
}
function toggleFavorite(name,add){
  if(add)selectedShows.add(name);else selectedShows.delete(name);
  localStorage.setItem('cnFavoriteShows',JSON.stringify([...selectedShows]));
  renderCatalogFilter();if(started&&catalogMode==='filtered')buildSchedule(new Date());
}
function updateCatalogFilterStatus(total,eligibleCount){
  const status=$('catalogFilterStatus');if(!status)return;
  const count=selectedShows.size;
  status.textContent=catalogMode==='filtered'
    ?(count?`${count} escolhido(s) · ${eligibleCount??total??0} compatível(is) com ${year}`:'Escolha ao menos um desenho; sem seleção, vale o modo normal.')
    :`${eligibleCount??total??catalog.filter(x=>x.kind==='episode'&&x.show&&x.enabled!==false).length} desenhos disponíveis em ${year}. Os demais estão fora da época ou sem episódios datados para a seleção atual.`;
}
function renderGuide(now){
 const cur=playingAt(now);if(!cur)return;
 // TV program guide lists PROGRAMS only. Bumpers, promotions, calls and ads
 // keep playing in the actual timeline, invisible to the guide.
 const main=schedule.filter(x=>x.isMain && ['episode','movie','short','special'].includes(x.kind));
 if(!main.length){
   // Não mostrar uma guia silenciosamente vazia. Os blocos abaixo representam
   // apenas uma visão de faixas do canal; não são episódios fingidamente aptos.
   const phases=[['00:00','Madrugada Cartoon'],['06:00','Clássicos e desenhos da manhã'],
     ['09:00','Manhã Cartoon Network'],['12:00','Hora do almoço'],
     ['15:00','Tarde de aventura'],['18:00','Fim de tarde Cartoon'],
     ['20:00','Horário nobre'],['22:00','Programação noturna']];
   guideFollowId='';
   const indexed=catalog.filter(x=>x.kind==='episode').length;
   let eligibleCount=0;const eligibleNames=new Set();
   for(const x of catalog){
     if(x.kind==='episode'&&x.enabled!==false&&x.duration>0&&(x.releaseDate||x.firstAiredBR)&&
       (!x.releaseDate||x.releaseDate<=dateKey(now))&&(!x.originalAirdate||x.originalAirdate<=dateKey(now))&&
       (!x.firstAiredBR||x.firstAiredBR<=dateKey(now))){eligibleCount++;if(x.show)eligibleNames.add(x.show);}
   }
   const message=indexed?`${indexed} episódios cadastrados; ${eligibleCount} episódios e ${eligibleNames.size} séries elegíveis para ${dateKey(now)}. Modo: ${catalogMode}${adultMode?' · Adult Swim ativo':''}.`+
     (eligibleCount?' A grade deveria conter episódios; confira esses números em Diagnóstico da biblioteca se a tela persistir.':'Verifique as datas dos episódios e o ano selecionado.'):
     'O índice de episódios está sendo carregado do disco local.';
   $('guide').innerHTML='<div class="guide-pending" role="status"><strong>Preparando a programação de '+year+'…</strong><p>'+message+'</p></div>'+
      phases.map(([hour,title])=>'<div class="guide-row guide-preview"><span class="time">'+hour+'</span><div><div class="name">'+title+'</div><div class="detail">Aguardando metadados elegíveis · '+year+'</div></div></div>').join('');
   return;
 }
 const position=secs(now);
  const activeFromPlayer=activeId?main.find(x=>x.id===activeId):null;
  const current=activeFromPlayer || main.find(x=>x.start<=position&&x.end>position)
   || [...main].reverse().find(x=>x.start<=position) || main[0];
 activeGuideId=current?.id||'';
 const guide=$('guide');const previousScroll=guide.scrollTop;
  guide.innerHTML=main.map(x=>`<div class="guide-row ${x.id===activeGuideId?'is-active':x.start>position&&x.start<position+3600?'is-upcoming':''}" data-id="${escapeHTML(x.id)}"><span class="time">${timeStr(x.start)}</span><div><div class="name">${escapeHTML(x.title)}</div><div class="detail">${escapeHTML(CnPlanner.BLOCKS[x.block]?.name||x.block||'Programação CN')} · ${Math.max(1,Math.round(x.duration/60))} min${x.asset?.durationVerified===false?' (previsto)':''}${x.episodeAge==='novo'?' · ✨ NOVO':''}${x.episodeAge==='alternativa'?' · alternativa sintonizada':''}${x.availability==='fonte indisponível'?' · Fonte indisponível':x.asset?.source==='stremio'&&x.asset?.streamVerifiedByShow!==true?' · Fonte a verificar ao sintonizar':''}</div>${x.id===activeGuideId?'<span class="live-small">● NO AR / INTERVALO</span>':''}</div></div>`).join('');
 guide.scrollTop=previousScroll;
 const active=guide.querySelector('.is-active');
 if(active && guideFollowId!==active.dataset.id && Date.now()>guideBrowsingUntil){
   guideFollowId=active.dataset.id;
   guide.scrollTop=Math.max(0,active.offsetTop-guide.offsetTop-guide.clientHeight*.30);
 }
}
function decorate(d){const season=seasonFor(d);document.body.dataset.season=season;document.body.dataset.era=ERA[year][2];document.body.dataset.year=year;
  const messages={normal:['✦','Programação regular','A seleção diária acompanha a identidade de cada ano.'],halloween:['🎃','Outubro do Terror','Abóboras, esqueletos, sustos e especiais durante outubro.'],christmas:['🎄','Natal Cartoon','Luzes piscantes, presentes, árvores e programação natalina durante dezembro.'],easter:['🐣','Especial de Páscoa','Ovos, coelhos e episódios temáticos durante abril.'],vacation:['☀️','Férias Cartoon!','Julho com maratonas, Jovens Titãs e desenhos para as férias.'],thanksgiving:['🍁','Ação de Graças','Chamadas e especiais de fim de novembro, conforme disponibilidade no acervo.']};
  const [icon,title,description]=messages[season];$('seasonIcon').textContent=icon;$('seasonTitle').textContent=title;
  $('seasonDescription').textContent=description;$('seasonYear').textContent=year;
  $('eventOverlay').textContent='';
}
function renderPage(now){const d=dateFor(now);decorate(d);$('selectedYear').textContent=year;$('onAirYear').textContent=year;$('videoYear').textContent=year;
$('eraLabel').textContent=ERA[year][0];$('eraCaption').textContent=ERA[year][1];$('timelineEra').textContent=ERA[year][0];$('virtualDate').textContent=`${pad(d.day)}/${pad(d.month)}/${d.year}`;
  $('mediaCount').textContent=catalog.length;$('sourceCount').textContent=`${catalog.filter(x=>x.source==='local').length} locais · ${catalog.filter(x=>x.source==='external').length} URLs · ${catalog.filter(x=>x.source==='stremio'&&x.enabled!==false).length} episódios Stremio indexados`; 
  $('generationLabel').textContent='Grade: '+dateKey(now);
  $('programCount').textContent=schedule.filter(x=>x.isMain && ['episode','movie','short','special'].includes(x.kind)).length+' atrações';
  document.querySelectorAll('.year-markers button').forEach(b=>{const selected=Number(b.dataset.year)===year;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));b.setAttribute('aria-current',selected?'date':'false');});
  renderBlocks();renderGuide(now);renderLibrary();updateStatus(now);
}
function updateStatus(now){const c=playingAt(now);if(!c)return;const {item,index,offset}=c;
  $('clock').textContent=now.toLocaleTimeString('pt-BR');$('nowTitle').textContent=item.title;
  const next=schedule.slice(index+1).find(s=>s.isMain)||schedule.find(s=>s.isMain);
  $('nowMeta').textContent=(CnPlanner.BLOCKS[item.block]?.name||item.block||({ad:'PROPAGANDA COMERCIAL',bumper:'VINHETA DA ÉPOCA',call:'CHAMADA · VEM AÍ',promo:'PROMO DO CANAL',movie:'CINE CARTOON',special:'ESPECIAL',episode:'DESENHO ANIMADO'}[item.kind]||'CN TIMELINE')).toUpperCase();
  $('nextTitle').textContent=next?`${timeStr(next.start)} • ${next.title}`:'Voltamos em instantes';
  $('screen').dataset.block=item.block||'regular';
  updatePlayPosition(now);
  const seekTime=activeId===item.id && player.readyState>=1?player.currentTime:offset;
  $('progressBar').style.width=(Math.min(100,Math.max(0,(seekTime/Math.max(.01,item.asset?.duration||item.duration))*100)))+'%';
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
 const good=chosen.filter(a=>a.enabled!==false&&a.duration>0&&a.streamAvailability!=='unavailable');
 const pending=chosen.filter(a=>a.enabled===false||!a.duration||a.streamAvailability==='unavailable');
 const remoteCount=good.filter(a=>a.source==='stremio').length;
 $('mediaLibrarySummary').textContent=`${y} · ${good.length-remoteCount} mídias locais/URLs · ${remoteCount} episódios Stremio cadastrados e não bloqueados · ${pending.length} pendentes`; 
 const kinds={episode:'📺',movie:'🍿',call:'📢',promo:'📣',bumper:'✳️',ad:'🛍️',short:'🎬',special:'🎉'};
 $('mediaLibraryList').innerHTML=(chosen.slice(0,25).map(a=>`<div class="media-library-row"><span>${kinds[a.kind]||'▶'}</span><div><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.kind)} · ${a.duration?Math.ceil(a.duration)+'s':'sem duração'} · ${escapeHTML((a.years||[]).join(', ')||a.releaseDate?.slice(0,4)||'sem época')}</small></div><span class="media-state ${a.enabled===false||!a.duration?'pending':'ok'}">${a.enabled===false||!a.duration?'PENDENTE':a.source==='stremio'?(a.streamAvailability==='played'?'REPRODUZIDO':a.streamAvailability==='candidate'?'FONTE CANDIDATA':'A VERIFICAR'):'OK'}</span></div>`).join('')||'<div class="media-library-empty">Nenhum vídeo desta categoria nesse ano.</div>')+(chosen.length>25?`<div class="media-library-empty">+ ${chosen.length-25} outros arquivos</div>`:'');
}
function standby(){setTuning(false);clearStremioLoadTimer();destroyHls();localPlayer.pause();remotePlayer.pause();localPlayer.style.display='none';remotePlayer.style.display='none';$('screen').classList.remove('video-ready');activeSource='';}
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
  if(item.kind==='episode' && item.asset.source==='stremio' && realDuration<420)return;
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
  if(item.kind==='episode' && item.asset.source==='stremio' && raw<420)return;
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
    if((x.verifiedShows||0)>previousVerifiedShows && !availabilityRefreshRequested){
      availabilityRefreshRequested=true;refreshCatalog().then(()=>{
        const alreadyInGuide=new Set(schedule.filter(e=>e.isMain&&e.asset?.show).map(e=>e.asset.show));
        const discovered=[...new Set(catalog.filter(a=>a.kind==='episode'&&a.streamVerifiedByShow).map(a=>a.show))]
          .filter(name=>!alreadyInGuide.has(name));
        // Renovar a grade apenas quando não estamos assistindo. Evita corte de
        // episódio por uma atualização de metadados no meio da transmissão.
        if(!started || !schedule.some(e=>e.isMain&&e.asset))buildSchedule(new Date());
        else if(discovered.length) $('notice').textContent=`${discovered.length} séries adicionais verificadas. Use Gerar nova programação quando desejar incluí-las no guia; a transmissão atual não será cortada.`;
      }).finally(()=>{availabilityRefreshRequested=false;});
    }
    previousVerifiedShows=Math.max(previousVerifiedShows,x.verifiedShows||0);
    $('syncStremioStatus').textContent=`${x.phase} · ${x.catalogSeries||0}/${x.configuredSeries||0} séries catalogadas · ${x.verifiedShows||0} com fonte candidata · ${x.episodes||0} episódios indexados · vídeo verificado na hora de reproduzir${x.lastError?' · '+x.lastError:''}${!x.episodes?' · ainda sem metadados locais: verificando TVmaze/Cinemeta ou aguardando importação do cache':''}`;
    const snapshot=`${x.episodes}|${x.verifiedShows}|${x.verifiedMovies}`;
    if(snapshot!==lastSyncSnapshot){
      const prior=lastSyncSnapshot;lastSyncSnapshot=snapshot;
      if(prior && String(prior).split('|')[0]!==String(x.episodes)){
        await fetchEpisodeIndex(true); // Cadastra novos desenhos sem precisar F5
        if(!started)buildSchedule(new Date());
        else $('notice').textContent='Novos desenhos importados. Clique em Gerar nova programação para atualizá-la sem cortar o que está no ar.';
      }
      await refreshCatalog();
    }
  }catch{}finally{syncPollingInFlight=false}
}

function reportPlaybackFailure(a,reason='all_candidates_failed'){
 if(a?.source!=='stremio'||a.kind!=='episode')return;
 if(reason==='unsupported_codec')return;
 fetch('/api/stremio/report-failed',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({kind:'episode',reason,imdbId:a.imdbId,
      season:a.season,episode:a.episode})}).catch(()=>{});
}
function retireUnplayable(item,reason,confirmed=false){
 if(!item || item.id!==activeId)return;
 clearTimeout(stremioRetryTimer);stremioRetryTimer=null;
 // Erro antigo: reduzia um episódio de 11–22 min a ~1 min e movia
 // TODOS os próximos programas. Não alterar a grade por erro de rede.
 item.availability='fonte indisponível';
 $('syncLabel').textContent=reason;
 $('standbyTitle').textContent=item.title;
 $('standbyDesc').textContent=reason;
 // Mantém a duração agendada e mostra uma mensagem; a próxima tentativa
 // é gerenciada separadamente, sem repetir a chamada do desenho errado.
 setTuning(false);
 renderGuide(new Date());
}
function deferStremioRetry(item,reason){
 if(!item || item.id!==activeId)return;
 const key=episodeKey(item.asset),tries=(stremioRetryCounts.get(key)||0)+1;
 stremioRetryCounts.set(key,tries);
 // O cache negativo do servidor dura seis segundos; o primeiro retry precisa
 // ultrapassá-lo para disparar uma consulta nova em vez de repetir a mesma falha.
 const delay=Math.min(60000,7000*2**Math.min(tries-1,4));
 clearTimeout(stremioRetryTimer);stremioRetryTimer=null;
 failedAssetId=item.id;stremioResolving='';stremioExcluded=[];stremioAssetKey=item.id;
 stremioCandidates=[];stremioCandidateIndex=-1;warmedStreams.delete(key);
 if(remoteWarmKey===key)clearRemoteWarm();
 standby();activeId=item.id;
 const seconds=Math.ceil(delay/1000);
 $('syncLabel').textContent=`${reason} · nova tentativa automática em ${seconds}s`;
 $('standbyTitle').textContent=item.title;
 $('standbyDesc').textContent=`${reason} Vou tentar novamente em ${seconds}s; a atração continua no horário.`;
 stremioRetryTimer=setTimeout(()=>{
   stremioRetryTimer=null;
   if(!started||failedAssetId!==item.id)return;
   const current=playingAt(new Date());
   if(current?.item.id!==item.id)return;
   failedAssetId='';syncPlayback(new Date(),true);
 },delay);
}
function holdCurrentUntilPlayback(item,offset){
  const idx=schedule.findIndex(x=>x.id===item.id);
  if(idx<0 || !(Number.isFinite(player.duration)&&player.duration>0))return;
  const remaining=Math.max(0,player.duration-offset);
  const desiredEnd=secs(new Date())+remaining;
  const delta=desiredEnd-item.end;
  if(Math.abs(delta)<.3)return;
  item.end=desiredEnd;item.duration=item.end-item.start;
  for(let i=idx+1;i<schedule.length;i++){
    schedule[i].start+=delta;schedule[i].end+=delta;
  }
  while(schedule.length>1&&schedule.at(-1).start>=DAY)schedule.pop();
  if(schedule.length && schedule.at(-1).kind==='slate'&&schedule.at(-1).end>DAY){
    schedule.at(-1).end=DAY;schedule.at(-1).duration=DAY-schedule.at(-1).start;
  }
  renderGuide(new Date());
}
function playStremioCandidate(item,index,version){
  if(version!==stremioVersion || !started)return;
  const candidate=stremioCandidates[index];
  if(!candidate)return;
  if(remoteWarmKey===episodeKey(item.asset)&&remoteWarmUrl!==candidate.url)clearRemoteWarm();
  stremioCandidateIndex=index;
  stremioPlaybackStarted=false;
  stremioAutoplayBlocked=false;
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
    clearStremioLoadTimer();setTuning(false);
    // 'loadedmetadata' não prova que os primeiros frames chegarão: o antigo
    // player podia ficar indefinidamente esperando bytes depois dessa etapa.
    stremioLoadTimer=setTimeout(()=>{
      if(version===stremioVersion && activeId===item.id && activeSource===candidate.url && !stremioPlaybackStarted){
        if(stremioAutoplayBlocked){
          setTuning(false);$('watchButton').innerHTML='▶ <span>TOCAR VÍDEO</span>';
          $('syncLabel').textContent='O navegador aguardou um clique para iniciar esta fonte. Toque em “Tocar vídeo”.';
        }else{
          $('syncLabel').textContent=`${currentProvider} não entregou frames de vídeo (readyState ${player.readyState}, erro ${player.error?.code||'nenhum'}); tentando outra fonte…`;
          nextStremioCandidate();
        }
      }
    },9500);
    // A grade pode ter passado pelo horário previsto enquanto o addon carregava.
    // O vídeo selecionado continua sendo a referência; ajustamos seu fim antes do guia.
    if(item.kind==='episode' && item.asset?.source==='stremio' &&
       Number.isFinite(player.duration) && player.duration<Math.min(420,item.duration*.55)){
      $('syncLabel').textContent='Fonte retornou clipe curto em vez de episódio; tentando outra…';
      nextStremioCandidate();return;
    }
    observeDuration(item,player.duration);
    const position=Math.max(0,Math.min((player.duration||item.duration)-.5,stremioRequestedOffset));
    try{player.currentTime=position;}catch{}
    holdCurrentUntilPlayback(item,position);
    applyVolume();
    player.play().then(()=>{setTuning(false);
      $('syncLabel').textContent=`${currentProvider} · fonte ${index+1}/${stremioCandidates.length} · em transmissão`;
    }).catch(async error=>{
      if(version!==stremioVersion||activeSource!==candidate.url)return;
      player.muted=true;
      try{await player.play();muted=true;applyVolume();$('syncLabel').textContent='Áudio bloqueado pelo navegador; a reprodução começou sem som. Use o ícone de som para ativá-lo.';}
      catch(retryError){
        if(version!==stremioVersion||activeSource!==candidate.url)return;
        if(error?.name==='NotAllowedError'||retryError?.name==='NotAllowedError'){
          stremioAutoplayBlocked=true;
          setTuning(false);$('watchButton').innerHTML='▶ <span>TOCAR VÍDEO</span>';
          $('syncLabel').textContent='O navegador bloqueou a reprodução automática. Toque em “Tocar vídeo” para iniciar.';
        }else{
          $('syncLabel').textContent=`${currentProvider} · reprodução recusada (${retryError?.name||error?.name||'erro de mídia'}); tentando outra fonte…`;
          nextStremioCandidate();
        }
      }
    });
  };
  stremioLoadTimer=setTimeout(()=>{
    if(version===stremioVersion && activeId===item.id && activeSource===candidate.url && player.readyState<1){
      $('syncLabel').textContent=`${currentProvider} · fonte ${index+1} sem resposta; tentando outra…`;
      nextStremioCandidate();
    }
  },8500);
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
  setTuning(true,'Tentando outra fonte de vídeo…');
  const current=schedule.find(x=>x.id===activeId) || playingAt(new Date())?.item;
  if(!current||current.asset?.source!=='stremio'||current.id!==activeId)return;
  clearStremioLoadTimer();
  const cacheKey=episodeKey(current.asset), cached=warmedStreams.get(cacheKey);
  const failedCandidate=stremioCandidates[stremioCandidateIndex];
  if(cached&&failedCandidate?.url){
    cached.result.candidates=(cached.result.candidates||[]).filter(c=>c.url!==failedCandidate.url);
    if(!cached.result.candidates.length)warmedStreams.delete(cacheKey);
  }
  if(stremioCandidateIndex+1<stremioCandidates.length){
    playStremioCandidate(current,stremioCandidateIndex+1,stremioVersion);
    return;
  }
  warmedStreams.delete(cacheKey);
  const failed=currentProvider;
  if(failed && !stremioExcluded.includes(failed))stremioExcluded.push(failed);
  stremioCandidates=[];stremioCandidateIndex=-1;
  standby();activeId='';
  $('syncLabel').textContent=unsupportedCandidateCount?`${failed} esgotado; procurando outro addon compatível com o navegador…`:`${failed} esgotado; procurando outro addon…`;
  openStremio(current,0);
}
async function openStremio(item,offset,force=false){
  if(stremioResolving===item.id && !force)return;
  const asset=item.asset;
  if(stremioAssetKey!==item.id){clearTimeout(stremioRetryTimer);stremioRetryTimer=null;stremioExcluded=[];stremioAssetKey=item.id;unsupportedCandidateCount=0;}
  const version=++stremioVersion;
  stremioRequestedOffset=Math.max(0,Number(offset)||0);stremioRequestedAt=Date.now();
  const key=item.id;
  clearPendingRequest();
  // Libera o player imediatamente; não deixa o vídeo anterior tocando enquanto
  // o servidor procura a próxima fonte.
  if(activeId!==item.id){standby();activeId=item.id;}
  const requested=asset.kind==='movie'?asset.name:`${asset.show} · T${String(asset.season||0).padStart(2,'0')}E${String(asset.episode||0).padStart(2,'0')}`;
  setTuning(true,'Buscando '+requested);
  stremioResolving=key;
  const exclude=force?[]:stremioExcluded;
  $('syncLabel').textContent=`Procurando ${asset.kind==='movie'?'filme':'episódio'} nos addons Stremio…`;
  try{
    const cacheKey=episodeKey(asset), warm=warmedStreams.get(cacheKey);
    let result;
    if(!exclude.length && warm && (warm.confirmed || Date.now()-warm.time<240000)){
      result=warm.result;
    }else{
      const controller=new AbortController();streamRequest=controller;
      const response=await fetch('/api/stremio/resolve',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({imdbId:asset.imdbId,season:asset.season,episode:asset.episode,absoluteEpisode:asset.absoluteEpisode,kind:asset.kind,excludeProviders:exclude,expectedShow:asset.show,selectedYear:year})});
      result=await response.json();
      if(streamRequest===controller)streamRequest=null;
    }
    if(version!==stremioVersion || !started)return;
    stremioResolving='';
    const now=playingAt(new Date());
    if(!now || now.item.id!==key || year!==Number(asset.selectedYear||year))return;
    if(!result.ok){
      const requested=asset.kind==='movie'?asset.name:`${asset.show} · T${String(asset.season||0).padStart(2,'0')}E${String(asset.episode||0).padStart(2,'0')}`;
      const attempts=result.attempts||[];
      const transient=attempts.some(x=>/timeout|temporar|backoff|urlerror|connection|HTTP 5\d\d|408|429|timed out|sem resposta/i.test(String(x.status||'')));
      if(transient){
        const reason=`${requested}: os addons estão temporariamente sem resposta.`;
        $('notice').textContent=(result.reason||'Falha temporária nos addons')+' '+attempts.map(x=>x.addon+': '+x.status).join(' | ');
        deferStremioRetry(item,reason);return;
      }
      failedAssetId=item.id;standby();activeId=item.id;
      retireUnplayable(item,unsupportedCandidateCount?`${requested}: fontes encontradas, mas incompatíveis com o navegador.`:`${requested}: nenhum addon entregou uma fonte reproduzível. O item solicitado foi mantido; não o troquei por outro episódio.`,true);
      $('notice').textContent=(result.reason||'Fonte indisponível')+' '+attempts.map(x=>x.addon+': '+x.status).join(' | ');
      return;
    }
    currentProvider=result.provider;unsupportedCandidateCount=0;
    stremioCandidates=(Array.isArray(result.candidates)&&result.candidates.length?result.candidates:[{url:result.url,format:result.format}])
      .filter(c=>c&&typeof c.url==='string'&&
        (location.protocol!=='https:'||!c.url.startsWith('http://')));
    result={...result,candidates:stremioCandidates};
    if(stremioCandidates.length)warmedStreams.set(cacheKey,{time:Date.now(),result,confirmed:!!warm?.confirmed});
    stremioCandidateIndex=-1;
    if(!stremioCandidates.length){
      warmedStreams.delete(cacheKey);
      if(!stremioExcluded.includes(currentProvider))stremioExcluded.push(currentProvider);
      $('syncLabel').textContent='Fonte HTTP bloqueada em site HTTPS; tentando outro addon…';
      openStremio(item,offset);return;
    }
    playStremioCandidate(item,0,version);
  }catch(error){
    if(version!==stremioVersion)return;
    const requested=asset.kind==='movie'?asset.name:`${asset.show} T${asset.season}E${asset.episode}`;
    $('notice').textContent=`Consulta temporariamente indisponível para ${requested}: ${error?.name||'erro de conexão'}`;
    deferStremioRetry(item,`Não consegui consultar os addons para ${requested}.`);
  }
}

function syncPlayback(now,force=false){if(!started)return;const c=playingAt(now);if(!c)return;const {item,offset}=c;
  // MP4/HLS ainda tocando: se a fonte atrasou, NÃO cortar no horário antigo.
  // O guia passa a indicar o tempo de parede necessário para terminar o vídeo,
  // incorporando atrasos de buffering; os próximos programas se deslocam juntos.
  // O teste é antes da seleção de um novo addon ou de um vídeo local.
  if(!force && activeId && activeId!==item.id &&
     (stremioResolving===activeId || (stremioLoadTimer && stremioCandidateIndex>=0))){
    const pending=schedule.find(x=>x.id===activeId);
    if(pending){const delta=secs(now)+4-pending.end;
      if(delta>0){const idx=schedule.indexOf(pending);pending.end+=delta;pending.duration+=delta;
        for(let i=idx+1;i<schedule.length;i++){schedule[i].start+=delta;schedule[i].end+=delta}renderGuide(now)}
    }
    return;
  }
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
  player.pause();player.preload='auto';player.style.display='block';player.src=source;player.load();setTuning(true,'Abrindo vídeo local…');applyVolume();$('screen').classList.add('video-ready');
  let localReadyHandled=false;
  const play=()=>{if(localReadyHandled||localVersion!==retryVersion||activeId!==item.id)return;localReadyHandled=true;
    const target=Math.max(0,Math.min(mediaTime,Number.isFinite(player.duration)?Math.max(0,player.duration-.12):mediaTime));
    try{player.currentTime=target}catch{}
    setTuning(false);if(source.startsWith('/media/'))initAudioGraph();soundContext?.resume().catch(()=>{});
    player.play().catch(()=>{$('syncLabel').textContent='Clique em Assistir para liberar o vídeo';});
  };
  if(player.readyState>=2)play();else {player.addEventListener('loadeddata',play,{once:true});player.addEventListener('canplay',play,{once:true});}
}
let catalogRequestInFlight=null;
let fastEpisodeIndexLoaded=false;
async function fetchEpisodeIndex(force=false){
  // Endpoint leve: lê SOMENTE os metadados salvos, sem escanear MP4 nem chamar addons.
  // Assim 5.000 episódios podem gerar a grade imediatamente, antes do scan local.
  if(fastEpisodeIndexLoaded && !force)return;
  // A resposta pode ter vários megabytes; em celulares e Wi-Fi lento, 7s
  // abortava a transferência antes de o navegador conseguir montar o guia.
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),45000);
  try{
    const response=await fetch('/api/catalog/episodes',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    const result=await response.json();
    const episodes=Array.isArray(result.media)?result.media.filter(x=>x&&x.path&&x.kind==='episode'):[];
    if(episodes.length){
      const known=new Map(catalog.map(x=>[x.id,x]));
      episodes.forEach(x=>known.set(x.id,x));
      catalog=[...known.values()];
      // Populate the library before the CPU-heavy daily schedule is built;
      // this keeps the mobile UI informative even on slower devices.
      $('mediaCount').textContent=catalog.length;
      renderLibrary();
      renderCatalogFilter();
      if(!started || !schedule.some(e=>e.isMain&&e.asset))buildSchedule(new Date());
      $('notice').textContent=`Guia gerado com ${episodes.length} episódios catalogados. As fontes são verificadas ao sintonizar.`;
    }
    // Uma resposta vazia não significa que o índice esteja carregado. Não
    // marcar como concluído permite que a recuperação automática tente de novo.
    fastEpisodeIndexLoaded=episodes.length>0;
  }catch(error){
    // Compatível com versões antigas do servidor: cai para /api/catalog.
  }finally{clearTimeout(timer)}
}
async function refreshCatalog(){
  // Protege o primeiro carregamento contra scans de vídeos muito lentos e
  // vários cliques. O navegador nunca espera uma consulta externa para exibir a UI.
  if(catalogRequestInFlight)return catalogRequestInFlight;
  catalogRequestInFlight=(async()=>{
  await fetchEpisodeIndex();
  const controller=new AbortController();
  // Catálogo completo inclui milhares de clipes locais: o índice rápido
  // já mostra a grade, então essa consulta pode concluir em segundo plano.
  const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch('/api/catalog',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error(response.status);
    const body=await response.json();
    const fresh=Array.isArray(body.media)?body.media.filter(x=>x&&x.path):[];
    // Catálogo pode mudar a qualquer momento; a grade EM EXIBIÇÃO não.
    if(fresh.length){
      // Nunca perder os 5.000 episódios importados pela rota rápida apenas
      // porque um /api/catalog parcial retornou somente mídias locais.
      const merged=new Map(catalog.filter(x=>x.source==='stremio'&&x.kind==='episode').map(x=>[x.id,x]));
      fresh.forEach(x=>merged.set(x.id,x));
      catalog=[...merged.values()];
      renderCatalogFilter();
    }
    // Quando a grade é só uma estrutura de contingência, gere a programação
    // real assim que aparecer o primeiro episódio efetivamente verificado.
    if(fresh.some(x=>x.kind==='episode'&&x.enabled!==false&&x.duration>0&&
       (x.releaseDate||x.firstAiredBR)) &&
       !schedule.some(e=>e.isMain&&e.asset)){
      buildSchedule(new Date());
    }
    const promos=catalog.filter(x=>x.kind==='promo');
    $('promoSummary').textContent=`📣 ${promos.length} promos · 📢 ${catalog.filter(x=>x.kind==='call').length} chamadas`;
    $('notice').textContent=`${catalog.length} mídia(s) indexadas. A grade do dia permanece estável até meia-noite ou trocar de ano.`;
    if(!schedule.length)buildSchedule(new Date());
    else {renderLibrary();$('mediaCount').textContent=catalog.length;
      $('sourceCount').textContent=`${catalog.filter(x=>x.source==='local').length} locais · ${catalog.filter(x=>x.source==='stremio').length} remotos`;
    }
  }catch(e){$('notice').textContent='Catálogo temporariamente indisponível ou demorando. Mantendo a grade e tentando novamente mais tarde.';
    if(!schedule.length)buildSchedule(new Date());}
  finally{clearTimeout(timeout)}
  })();
  try{return await catalogRequestInFlight}
  finally{catalogRequestInFlight=null}
}
function setYear(value){stremioVersion++;stremioResolving='';clearTimeout(stremioRetryTimer);stremioRetryTimer=null;stremioRetryCounts.clear();failedAssetId='';stremioExcluded=[];stremioAssetKey='';stremioCandidates=[];stremioCandidateIndex=-1;clearStremioLoadTimer();clearRemoteWarm();destroyHls();freeMode=false;$('liveButton').hidden=true;const n=Math.max(MIN_YEAR,Math.min(MAX_YEAR,Number(value)));
  if(n===year)return;
  // Troca imediata: a requisição e o vídeo do ano anterior não devem segurar a UI.
  clearPendingRequest();standby();activeId='';activeSource='';nextWarmKey='';
  const curtain=$('eraCurtain');$('eraCurtainTitle').textContent=ERA[n][0];
  document.body.classList.remove('era-changing');void curtain.offsetWidth;
  document.body.classList.add('era-changing');
  clearTimeout(transitionTimeout);
  transitionTimeout=setTimeout(()=>document.body.classList.remove('era-changing'),1600);
  closeExternal(false);$('externalCTA').hidden=true;year=n;localStorage.setItem('cnTimelineYear',year);renderCatalogFilter();buildSchedule(new Date());
}
function init(){for(let y=MIN_YEAR;y<=MAX_YEAR;y++){const btn=document.createElement('button');btn.type='button';btn.textContent=y;btn.setAttribute('aria-label','Transmissão de '+y);btn.setAttribute('aria-pressed',String(year===y));btn.dataset.year=String(y);btn.addEventListener('click',()=>setYear(y));$('yearMarkers').append(btn)}
  const modal=$('scheduleModal');
  const closeSchedule=()=>{modal.hidden=true;$('openScheduleSettings').focus()};
  $('openScheduleSettings').addEventListener('click',()=>{modal.hidden=false;renderCatalogFilter();$('closeScheduleSettings').focus()});
  $('closeScheduleSettings').addEventListener('click',closeSchedule);
  modal.querySelectorAll('[data-close-schedule]').forEach(x=>x.addEventListener('click',closeSchedule));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeSchedule()});
  modal.querySelectorAll('[data-schedule-tab]').forEach(tab=>tab.addEventListener('click',()=>{
    modal.querySelectorAll('[data-schedule-tab]').forEach(x=>{const active=x===tab;x.classList.toggle('is-active',active);x.setAttribute('aria-selected',String(active))});
    const target=tab.dataset.scheduleTab==='program'?'scheduleProgramPanel':'scheduleShowsPanel';$(target).scrollIntoView({behavior:'smooth',block:'nearest'});
  }));
  const drop=$('scheduleDropzone');
  drop.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';drop.classList.add('drag-over')});
  drop.addEventListener('dragleave',e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('drag-over')});
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');const name=e.dataTransfer.getData('text/plain');if(name)toggleFavorite(name,true)});
  $('clearScheduleShows').addEventListener('click',()=>{selectedShows.clear();localStorage.setItem('cnFavoriteShows','[]');renderCatalogFilter();if(started&&catalogMode==='filtered')buildSchedule(new Date())});
  $('catalogMode').value=catalogMode;
  $('catalogMode').addEventListener('change',e=>{catalogMode=e.target.value;localStorage.setItem('cnCatalogMode',catalogMode);updateCatalogFilterStatus();buildSchedule(new Date())});
  $('catalogFilterSearch').addEventListener('input',renderCatalogFilter);
  renderCatalogFilter();
  const guide=$('guide');
  guide.setAttribute('tabindex','0');guide.setAttribute('role','region');guide.setAttribute('aria-label','Grade de programação rolável');
  guide.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','PageDown','PageUp'].includes(e.key))return;e.preventDefault();guideBrowsingUntil=Date.now()+20000;guide.scrollBy({top:(e.key==='ArrowDown'?110:e.key==='ArrowUp'?-110:e.key==='PageDown'?380:-380),behavior:'smooth'});});
  for(const type of ['touchstart','wheel','pointerdown','keydown'])guide.addEventListener(type,()=>{guideBrowsingUntil=Date.now()+18000;},{passive:type!=='keydown'});
  $('wrongSourceButton').addEventListener('click',markWrongEpisode);
  $('watchButton').addEventListener('click',()=>{
    clearTimeout(stremioRetryTimer);stremioRetryTimer=null;
    const current=playingAt(new Date())?.item;
    if(started&&current?.asset?.source==='stremio'&&current.id===activeId&&activeSource&&player.paused){
      muted=false;player.muted=false;applyVolume();
      player.play().then(()=>{$('watchButton').innerHTML='● <span>TRANSMITINDO</span>';setTuning(false);$('syncLabel').textContent=`${currentProvider} · iniciando reprodução`;})
        .catch(error=>{if(error?.name==='NotAllowedError'){$('syncLabel').textContent='O navegador ainda bloqueou esta reprodução. Pressione Tocar vídeo novamente.';return}$('syncLabel').textContent=`Não foi possível iniciar esta fonte (${error?.name||'erro do navegador'}). Tentando outra…`;nextStremioCandidate();});
      return;
    }
    started=true;muted=false;applyVolume();soundContext?.resume().catch(()=>{});$('watchButton').innerHTML='● <span>TRANSMITINDO</span>';$('syncLabel').textContent='Sincronizado em tempo real';failedAssetId='';syncPlayback(new Date(),true)
  });
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
  $('verifyMoviesButton').addEventListener('click',async()=>{
    const b=$('verifyMoviesButton');b.disabled=true;
    $('stremioStatus').textContent='Verificando títulos e fontes do Cine Cartoon em segundo plano…';
    try{const r=await fetch('/api/stremio/verify-movies',{method:'POST'});
      if(!r.ok)throw Error('HTTP '+r.status);
      $('stremioStatus').textContent='Verificação iniciada. Atualize o acervo após a conclusão. A grade atual será preservada.';
    }catch{$('stremioStatus').textContent='Não foi possível iniciar a verificação de filmes.'}
    finally{b.disabled=false}
  });
  $('probeStremioButton').addEventListener('click',async()=>{
    const btn=$('probeStremioButton');btn.disabled=true;$('stremioStatus').textContent='Verificando manifestos…';
    try{const r=await fetch('/api/stremio/status');const j=await r.json();
      $('stremioStatus').textContent=j.sources.map(s=>(s.online?'✓ ':'✗ ')+s.name+(s.online?' (manifesto OK)':' (indisponível)')).join(' · ');
    }catch{$('stremioStatus').textContent='Não foi possível consultar os addons.'}
    finally{btn.disabled=false}
  });
  $('fullButton').addEventListener('click',async()=>{
    const box=$('screen');
    if(document.fullscreenElement){try{screen.orientation?.unlock?.()}catch{}await document.exitFullscreen?.();return;}
    try{
      if(box.requestFullscreen)await box.requestFullscreen();
      else if(player.webkitEnterFullscreen)player.webkitEnterFullscreen();
      if(screen.orientation?.lock){try{await screen.orientation.lock('landscape')}catch{if(matchMedia('(orientation: portrait)').matches)box.classList.add('force-landscape')}}
      else if(matchMedia('(orientation: portrait)').matches)box.classList.add('force-landscape');
    }catch(error){
      // Nem Android, iOS e Smart TVs oferecem a mesma API de rotação.
      $('syncLabel').textContent='Tela cheia ativada quando disponível. Se não girar, habilite rotação automática no aparelho.';
    }
  });
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)$('screen').classList.remove('force-landscape')});
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
  $('regenerateButton').addEventListener('click',()=>{
    // Apenas ação explícita altera a programação vigente.
    stremioVersion++;stremioResolving='';clearPendingRequest();standby();
    activeId='';activeSource='';failedAssetId='';freeMode=false;
    buildSchedule(new Date());
    $('notice').textContent='Grade regenerada manualmente a partir do acervo atual.';
  });
  $('mediaYear').addEventListener('change',renderLibrary);
  $('mediaKind').addEventListener('change',renderLibrary);
  for(const videoEl of [localPlayer,remotePlayer]){
    videoEl.addEventListener('ended',()=>{
      if(videoEl!==player)return;
      if(freeMode){freeMode=false;$('liveButton').hidden=true;}

      const now=new Date(),c=playingAt(now);
      if(c&&c.item.id===activeId){
        if(dateKey(now)!==lastDateKey){activeId='';standby();buildSchedule(now);return;}
        skipEndedItem(now); failedAssetId=''; activeId=''; standby();syncPlayback(now,true);
      }else syncPlayback(now,true);
    });
    if(videoEl===remotePlayer){
      videoEl.addEventListener('timeupdate',()=>{
        if(videoEl===player && !videoEl.paused){
          lastRemoteProgressAt=Date.now();clearStremioLoadTimer();
          const active=schedule.find(x=>x.id===activeId),a=active?.asset;
          if(a?.source==='stremio' && a.kind==='episode' && videoEl.currentTime>=12 && videoEl.readyState>=2){
            const key=episodeKey(a);
            if(!confirmedPlayback.has(key)){
              confirmedPlayback.add(key);
              fetch('/api/stremio/confirm-playing',{method:'POST',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({imdbId:a.imdbId,season:a.season,episode:a.episode,
                  kind:'episode',watchedSeconds:videoEl.currentTime})}).catch(()=>{});
            }
          }
        }
      });
      videoEl.addEventListener('waiting',()=>{
        if(!activeStallStart)activeStallStart=Date.now();
        clearTimeout(stallTimer);
        const startedWaiting=Date.now();
        stallTimer=setTimeout(()=>{
          if(started&&player===remotePlayer&&!videoEl.paused && videoEl.readyState<3
             && Date.now()-Math.max(lastRemoteProgressAt,startedWaiting)>13000){
            $('syncLabel').textContent='Stream sem avanço; tentando outra fonte…';nextStremioCandidate();
          }
        },14000);
      });
      videoEl.addEventListener('playing',()=>{
        if(videoEl===remotePlayer){
          stremioPlaybackStarted=true;
          const current=schedule.find(x=>x.id===activeId),cacheKey=episodeKey(current?.asset),cached=warmedStreams.get(cacheKey);
          if(cached){cached.confirmed=true;cached.time=Date.now();}
          clearRemoteWarm();
          stremioRetryCounts.delete(cacheKey);clearTimeout(stremioRetryTimer);stremioRetryTimer=null;failedAssetId='';
        }
        if(activeStallStart && Date.now()-activeStallStart>450){
          const current=schedule.find(x=>x.id===activeId);
          if(current && Number.isFinite(videoEl.duration)&&videoEl.duration>0){
            holdCurrentUntilPlayback(current,Math.max(0,videoEl.currentTime));
          }
        }
        activeStallStart=0;lastRemoteProgressAt=Date.now();clearStremioLoadTimer();clearTimeout(stallTimer);stallTimer=null;
      });
    }
    videoEl.addEventListener('error',()=>{
      if(!started||videoEl!==player)return;
      setTuning(false);const current=schedule.find(x=>x.id===activeId) || playingAt(new Date())?.item;
      if(current?.id===activeId&&current.asset?.source==='stremio'){
        const unsupported=videoEl.error?.code===4;
        if(unsupported)unsupportedCandidateCount++;
        const errorNames={1:'carga cancelada',2:'falha de rede/conexão',3:'falha ao decodificar o vídeo',4:'formato não suportado'};
        $('syncLabel').textContent=`${currentProvider}: ${errorNames[videoEl.error?.code]||'erro de reprodução'} (código ${videoEl.error?.code||'?'}) · tentando outra fonte…`;
        nextStremioCandidate();return;
      }
      failedAssetId=activeId;standby();$('notice').textContent='Este vídeo não pôde ser reproduzido. Verifique codec, URL, Range e CORS.';
    });
  }
  document.body.dataset.theme=localStorage.getItem('cnTheme')||'dark';
  $('themeButton').textContent=document.body.dataset.theme==='dark'?'☀ Modo claro':'☾ Modo escuro';
  $('adultMode').checked=adultMode; $('adultMode').addEventListener('change',e=>{adultMode=e.target.checked;localStorage.setItem('cnAdultSwimUS',String(adultMode));buildSchedule(new Date());});
  initResearch();
  applyVolume();applyStableVolume();
  // Watchdog adicional: alguns navegadores de TV não disparam 'waiting' durante stalls.
  setInterval(()=>{
    if(!started||player!==remotePlayer||player.paused||player.ended||!activeSource||stremioResolving)return;
    if(Date.now()-lastRemoteProgressAt>17000 && Date.now()-lastWatchdog>16000){
      lastWatchdog=Date.now();$('syncLabel').textContent='Conexão instável: buscando fonte alternativa';nextStremioCandidate();
    }
  },4500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&started){const now=new Date();updateStatus(now);syncPlayback(now);}});
  $('externalFrame').addEventListener('load',()=>{if(externalOpen) $('syncLabel').textContent='Iframe Pomfy carregado (reprodução não verificável) · controles dentro do player'});
  // A interface e o guia inicial são mostrados imediatamente, mesmo se o
  // primeiro /api/catalog demorar ou estiver inacessível.
  buildSchedule(new Date());
  refreshCatalog();
  pollAutoSync();setInterval(pollAutoSync,20000);
  // Recuperação sem apertar botões após falha no catálogo inicial.
  // Promos e bumpers podem preencher catalog.length mesmo quando os episódios
  // ainda não chegaram. Recuperar com base na presença de episódios reais.
  setInterval(()=>{if(!catalog.some(x=>x.kind==='episode'&&x.path))refreshCatalog()},30000);
  setInterval(()=>{const now=new Date();if(dateKey(now)!==lastDateKey){
    if(started && activeSource && player.style.display!=='none' && !player.ended && player.readyState>=1 && Number.isFinite(player.duration) && player.currentTime<player.duration-.4){
      $('syncLabel').textContent='Terminando vídeo da noite anterior, sem cortar na virada';return;
    }
    buildSchedule(now);return;}if(started)warmNextEpisode(now);if(!document.hidden){updateStatus(now);if(started){syncPlayback(now);warmNextLocal(now)}}},1000);
}

// Pesquisador de referências: até cinco candidatos, sem inferir automaticamente
// o ano de transmissão a partir do ano da postagem.
function initResearch(){
  const q=$('researchQuery'),results=$('researchResults');
  $('researchYear').value=String(year);
  async function loadCompilations(){
    try{const r=await fetch('/api/research/compilations');const data=await r.json();
      const list=Array.isArray(data.items)?data.items:[];
      $('clipFile').replaceChildren(...list.map(f=>new Option(f.file+' ('+f.sizeMB+' MB)',f.file)));
      $('compilationList').textContent=list.length?list.length+' arquivo(s) prontos para recorte':'Nenhuma compilação local encontrada.';
    }catch{$('compilationList').textContent='Não foi possível consultar as compilações.'}
  }
  $('researchButton').addEventListener('click',async()=>{
    const button=$('researchButton');button.disabled=true;results.textContent='Consultando arquivos públicos…';
    try{
      const url='/api/research/search?'+new URLSearchParams({year:$('researchYear').value,
        kind:$('researchKind').value,q:q.value});
      const response=await fetch(url);const data=await response.json();
      results.replaceChildren();
      if(data.error){results.textContent=data.error}
      if(!data.items?.length)results.textContent='Nenhum vídeo verificável encontrado diretamente nesta fonte. Veja as pesquisas externas abaixo; os resultados precisam de revisão histórica.';
      if(Array.isArray(data.discoveryLinks)){
        const sources=document.createElement('div');sources.className='research-links';
        const lead=document.createElement('strong');lead.textContent='Pesquisar outras fontes (referências para revisão):';sources.append(lead);
        data.discoveryLinks.slice(0,3).forEach((link,i)=>{const a=document.createElement('a');a.href=link;
          a.target='_blank';a.rel='noopener noreferrer';a.textContent=['Internet Archive ↗','YouTube ↗','Pesquisa web ↗'][i];sources.append(a)});
        results.append(sources);
      }
      data.items?.slice(0,15).forEach(v=>{
        const card=document.createElement('article');card.className='research-item';
        const h=document.createElement('strong');h.textContent=v.title||v.id;
        const desc=document.createElement('p');desc.textContent=v.historicalStatus+' · '+(v.license||'licença não declarada');
        const link=document.createElement('a');link.href=v.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir referência ↗';
        card.append(h,desc,link);
        if(v.mayImport){
          const rights=document.createElement('label'),check=document.createElement('input');
          check.type='checkbox';rights.append(check,document.createTextNode(' Confirmo direitos de reutilização e exibição histórica'));
          const button=document.createElement('button');button.textContent='Importar para triagem';button.className='refresh-button';
          button.addEventListener('click',async()=>{
            if(!check.checked){desc.textContent='Confirme os direitos e a data de transmissão antes de importar.';return}
            button.disabled=true;desc.textContent='Baixando vídeo autorizado para a área de triagem…';
            try{const response=await fetch('/api/research/import',{method:'POST',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({identifier:v.id,rightsConfirmed:true,historicalVerified:true})});
              const reply=await response.json();desc.textContent=reply.ok?reply.status:reply.reason;
              if(reply.ok)loadCompilations();
            }catch{desc.textContent='Falha ao importar.'}finally{button.disabled=false}
          });card.append(rights,button);
        }
        results.append(card);
      });
      const links=document.createElement('p');links.textContent='Pesquisar também: ';
      for(const url of (data.discoveryLinks||[]).slice(0,2)){
        const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
        a.textContent=new URL(url).hostname+' ↗  ';links.append(a);
      }results.append(links);
    }catch(err){results.textContent='Não foi possível pesquisar. Verifique a internet do servidor.'}
    finally{button.disabled=false}
  });
  $('researchYear').addEventListener('change',()=>{results.replaceChildren()});
  $('suggestCuts').addEventListener('click',async()=>{
    const b=$('suggestCuts'),out=$('suggestedCuts');b.disabled=true;out.textContent='Analisando cortes visuais (até 15 minutos do arquivo)…';
    try{const r=await fetch('/api/research/scenes',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({file:$('clipFile').value})});const data=await r.json();out.replaceChildren();
      if(!data.items?.length){out.textContent=data.reason||'Nenhum corte seguro identificado automaticamente.';return}
      const p=document.createElement('p');p.textContent=data.note;out.append(p);
      for(const c of data.items.slice(0,5)){
        const b=document.createElement('button');b.type='button';b.className='scene-chip';
        b.textContent=fmtSec(c.start)+' — '+fmtSec(c.end)+' · usar trecho';
        b.addEventListener('click',()=>{$('clipStart').value=c.start;$('clipEnd').value=c.end});out.append(b);
      }
    }catch{out.textContent='Falha ao analisar arquivo.'}finally{b.disabled=false}
  });
  $('clipButton').addEventListener('click',async()=>{
    const button=$('clipButton');button.disabled=true;
    try{const data={file:$('clipFile').value,kind:$('researchKind').value,year:Number($('researchYear').value),
      title:$('clipTitle').value,start:Number($('clipStart').value),end:Number($('clipEnd').value),
      rightsConfirmed:$('clipRights').checked};
      const response=await fetch('/api/research/clip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const result=await response.json();$('clipResult').textContent=result.ok?'Recorte salvo: '+result.file:(result.reason||'Erro no recorte');
      if(result.ok)await refreshCatalog();
    }catch{$('clipResult').textContent='Erro no recorte; verifique FFmpeg.'}finally{button.disabled=false}
  });
  loadCompilations();
}

init();
