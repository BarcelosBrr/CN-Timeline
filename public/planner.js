/* Motor de grade, independente da interface. Projeto de fã; programação inspirada em registros,
   nunca representada como o histórico exato de um dia sem comprovação documental. */
(function(root){
'use strict';
const DAY=86400;
const YEARS=[2015,2016,2017,2018,2019,2020,2021];
const SHOWS=[
 ["O Incrível Mundo de Gumball","2015-01-01",["comedia", "principal"],2015,2021],
 ["Apenas um Show","2015-01-01",["comedia", "principal", "madrugada"],2015,2017],
 ["Hora de Aventura","2015-01-01",["aventura", "principal", "madrugada"],2015,2018],
 ["Steven Universo","2015-01-01",["comedia", "principal", "madrugada"],2015,2020],
 ["Irmão do Jorel","2015-01-01",["brasileiro", "comedia", "principal"],2015,2021],
 ["Clarêncio, o Otimista","2015-01-01",["comedia"],2015,2018],
 ["Jovens Titãs em Ação","2015-01-01",["comedia", "herois", "principal"],2015,2021],
 ["Titio Avô","2015-01-01",["comedia"],2015,2017],
 ["O Show de Tom e Jerry","2015-01-01",["classico", "manha"],2015,2018],
 ["Que Legal, Scooby-Doo!","2015-01-01",["classico", "manha"],2015,2018],
 ["Scooby-Doo","2015-01-01",["classico", "manha"],2015,2021],
 ["O Laboratório de Dexter","2015-01-01",["classico", "madrugada"],2015,2021],
 ["KND: A Turma do Bairro","2015-01-01",["classico", "madrugada"],2015,2021],
 ["As Terríveis Aventuras de Billy e Mandy","2015-01-01",["classico", "madrugada"],2015,2021],
 ["A Vaca e o Frango","2015-01-01",["classico", "madrugada"],2015,2017],
 ["Coragem, o Cão Covarde","2015-01-01",["classico", "madrugada", "halloween"],2015,2021],
 ["O Acampamento de Lazlo","2015-01-01",["classico", "madrugada"],2015,2019],
 ["Meu Amigo da Escola É um Macaco","2015-01-01",["classico", "madrugada"],2015,2018],
 ["Johnny Test","2015-01-01",["comedia", "manha"],2015,2017],
 ["Turma da Mônica","2015-01-01",["brasileiro", "manha"],2015,2021],
 ["Max Steel","2015-01-01",["herois"],2015,2017],
 ["Ben 10: Omniverse","2015-01-01",["herois"],2015,2017],
 ["Pokémon","2015-01-01",["anime", "herois"],2015,2021],
 ["Dragon Ball Z Kai","2015-01-01",["anime", "herois"],2015,2018],
 ["Historietas Assombradas","2015-01-01",["brasileiro", "comedia", "halloween"],2015,2017],
 ["Grojband","2015-01-01",["comedia"],2015,2016],
 ["Sonic Boom","2015-01-01",["comedia", "herois"],2015,2017],
 ["Tromba Trem","2015-01-01",["brasileiro", "comedia"],2015,2018],
 ["MAD","2015-01-01",["comedia", "madrugada"],2015,2016],
 ["Supernoobs","2015-01-01",["comedia", "herois"],2015,2017],
 ["Ursos sem Curso","2015-01-01",["comedia", "principal"],2015,2020],
 ["As Meninas Superpoderosas","2016-01-01",["comedia", "herois", "principal"],2016,2019],
 ["Poderosas Magiespadas","2016-01-01",["herois", "comedia"],2016,2019],
 ["Ben 10","2017-01-01",["herois", "principal"],2017,2021],
 ["Dragon Ball Super","2017-01-01",["anime", "herois"],2017,2020],
 ["OK K.O.! Vamos Ser Heróis","2017-01-01",["herois", "comedia"],2017,2019],
 ["Oswaldo","2017-01-01",["brasileiro", "comedia"],2017,2021],
 ["Bunnicula","2017-01-01",["comedia", "manha"],2017,2018],
 ["Tá Chovendo Hambúrguer: A Série","2017-01-01",["comedia"],2017,2018],
 ["Masha e o Urso","2017-01-01",["manha", "comedia"],2017,2019],
 ["Lego Nexo Knights","2016-01-01",["herois"],2017,2018],
 ["O Mundo de Greg","2018-01-01",["aventura", "principal"],2018,2021],
 ["Acampamento de Verão","2018-01-01",["aventura", "comedia"],2018,2021],
 ["Maçã e Cebola","2018-01-01",["comedia"],2018,2021],
 ["Unigata!","2018-01-01",["comedia"],2018,2020],
 ["DC Super Hero Girls","2019-01-01",["herois"],2019,2021],
 ["Victor e Valentino","2019-01-01",["aventura", "halloween"],2019,2021],
 ["Mao Mao: Heróis de Coração Puro","2019-01-01",["herois", "aventura"],2019,2020],
 ["Trem Infinito","2019-01-01",["aventura"],2019,2021],
 ["Steven Universo Futuro","2019-01-01",["aventura"],2019,2020],
 ["Scooby-Doo e Convidados","2019-01-01",["classico", "manha"],2019,2021],
 ["ThunderCats Roar","2020-01-01",["herois", "comedia"],2020,2021],
 ["Elliott, o Terráqueo","2021-01-01",["aventura"],2021,2021],
 ["Vilanesco","2021-01-01",["comedia"],2021,2021],
 ["Rick and Morty","2015-01-01",["adult","madrugada"],2015,2021],
 ["Robot Chicken","2015-01-01",["adult","madrugada"],2015,2021],
 ["Bob's Burgers","2015-01-01",["adult","madrugada"],2015,2021]
].map(([name,from,tags,peakFrom,peakTo])=>({name,from,tags,peakFrom,peakTo}));
const BLOCKS={
  adultswim:{name:'Adult Swim (EUA) — alternativo',icon:'🌃',from:2015,to:2021,desc:'Recriação americana opcional; não corresponde ao CN Brasil deste período'},
  madrugada:{name:'Madrugada Cartoon', icon:'🌙', from:2015,to:2021, desc:'Reprises e clássicos para quem ficava acordado'},
  classicos:{name:'Clássicos CN', icon:'📺',from:2015,to:2021,desc:'Manhã com desenhos conhecidos'},
  herois:{name:'Heróis',icon:'⚡',from:2015,to:2021,desc:'Faixa de ação e super-heróis'},
  hahaha:{name:'HAHAHA',icon:'😆',from:2015,to:2021,desc:'Comédia e muitas risadas'},
  cine:{name:'Cine Cartoon',icon:'🍿',from:2015,to:2021,desc:'Sessão de cinema do Cartoon'},
  votatoon:{name:'Votatoon',icon:'🗳️',from:2015,to:2016,desc:'Maratona baseada em votação (simulada)'},
  brazuca:{name:'Brazuca',icon:'🇧🇷',from:2015,to:2016,desc:'Produções brasileiras; faixa inspirada na época'},
  maratona:{name:'Maratona de fim de semana',icon:'🎉',from:2015,to:2021,desc:'Vários episódios da mesma série'},
  outra:{name:'Outra Semana no Cartoon',icon:'🎤',from:2015,to:2021,desc:'Quadro de humor e retrospectiva'},
  toontubers:{name:'Toontubers',icon:'🎮',from:2017,to:2018,desc:'Quadro de games com Mordecai e Rigby'},
  cartoonzaum:{name:'Cartoon Z@um',icon:'💥',from:2015,to:2021,desc:'Bloco de curtas e novidades'},
  clube:{name:'Clube Boomerang',icon:'📼',from:2015,to:2021,desc:'Séries e desenhos adquiridos'},
  girlpower:{name:'Girl Power',icon:'💖',from:2017,to:2021,desc:'Seleção de heroínas do canal'},
  copa:{name:'Copa Toon',icon:'⚽',from:2015,to:2018,desc:'Especial esportivo em períodos documentados'},
  toonami:{name:'Toonami',icon:'🌌',from:2020,to:2021,desc:'Bloco de anime noturno'},
  offair:{name:'Cartoon Off-Air',icon:'🌃',from:2018,to:2021,desc:'Programação tardia'},
  temporada:{name:'Especial de temporada',icon:'✨',from:2015,to:2021,desc:'Halloween, Natal, férias e especiais de fim de ano'},
  regular:{name:'Programação CN',icon:'⭐',from:2015,to:2021,desc:'Desenhos de cada ano'}
};
const PROFILE={
  // A distribuição de títulos e faixas é inspirada em registros; não é uma grade oficial reconstituída.
  2015:['classicos','classicos','hahaha','regular','brazuca','regular','regular','regular','herois','hahaha','regular','regular','regular','regular','regular','regular'],
  2016:['classicos','classicos','hahaha','regular','brazuca','regular','regular','regular','herois','hahaha','regular','regular','regular','regular','regular','regular'],
  2017:['clube','classicos','regular','regular','brazuca','herois','regular','regular','herois','hahaha','regular','regular','regular','regular','regular','regular'],
  2018:['clube','classicos','regular','regular','regular','herois','regular','regular','herois','hahaha','regular','regular','regular','regular','regular','regular'],
  2019:['clube','classicos','regular','regular','regular','herois','regular','regular','herois','hahaha','regular','regular','regular','regular','regular','regular'],
  2020:['clube','classicos','regular','regular','regular','herois','regular','regular','herois','hahaha','regular','regular','regular','regular','regular','regular'],
  2021:['clube','classicos','regular','regular','regular','herois','regular','regular','herois','hahaha','regular','regular','regular','regular','regular','regular']
};
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let b=a;b=Math.imul(b^(b>>>15),b|1);b^=b+Math.imul(b^(b>>>7),b|61);return ((b^(b>>>14))>>>0)/4294967296}}
function choose(a,r){return a.length?a[Math.floor(r()*a.length)]:null}
function pad(v){return String(v).padStart(2,'0')}
function normalize(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function easterMonth(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+70)%7,m=Math.floor((a+11*h+22*l)/451);return Math.floor((h+l-7*m+114)/31)}
function season(d){
 if(d.month===10)return 'halloween';
 if(d.month===12)return 'christmas';
 if(d.month===1)return d.day<=7?'newyear':'summer';
 if(d.month===7)return 'vacation';
 if(d.month===easterMonth(d.year))return 'easter';
 if(d.month===11&&d.day>=20)return 'thanksgiving';
 return 'normal';
}
function key(d){return `${d.year}-${pad(d.month)}-${pad(d.day)}`}
function eligible(media,d){
 if(!media || !media.path || media.enabled===false || !(media.duration>0))return false;
 // Falha recente de um addon é evidência temporária de reprodução, não motivo
 // para apagar um episódio real do catálogo ou deixar a grade sem desenhos.
 if(Array.isArray(media.years)&&media.years.length&&!media.years.includes(d.year))return false;
 const k=key(d);
 if(media.durationVerified===false&&media.durationSource==='unknown')return false;
 if(media.releaseDate && media.releaseDate>k)return false;
 if(media.kind==='movie'){const release=Number(media.releaseYear||String(media.releaseDate||'').slice(0,4));if(!release||d.year<Math.max(release,Number(media.firstCNAiredYear||release))||d.year>release+3)return false;
 if(media.firstCNAiredDate && media.firstCNAiredDate>k)return false;}
 if(media.originalAirdate && media.originalAirdate>k)return false;
 if(media.firstAiredBR && media.firstAiredBR>k)return false;
 if(media.validFrom && media.validFrom>k)return false;
 if(media.validUntil && media.validUntil<k)return false;
 if(['episode','movie','special'].includes(media.kind)&&!media.releaseDate&&!media.firstAiredBR)return false; // não inventar estreia de desenhos nem filmes
 if(['promo','call','bumper','ad'].includes(media.kind)&&!media.validFrom&&!media.years?.length)return false;
 if(media.kind==='special'&&(!media.event||media.event==='normal'||media.event!==season(d)))return false; // chamada sem época definida
 return true;
}
function showEligibility(name,catalog,year,date=new Date()){
 const d={year:Number(year),month:date.getMonth()+1,day:Math.min(date.getDate(),new Date(Number(year),date.getMonth()+1,0).getDate())};
 const meta=SHOWS.find(s=>normalize(s.name)===normalize(name));
 const episodes=(Array.isArray(catalog)?catalog:[]).filter(x=>x.kind==='episode'&&normalize(x.show)===normalize(name)&&eligible(x,d));
 if(!meta){
   const airedThisYear=episodes.some(x=>String(x.firstAiredBR||x.originalAirdate||x.releaseDate||'').startsWith(`${year}-`));
   return airedThisYear?{eligible:true,reason:'',episodes:episodes.length}:{eligible:false,reason:'historico'};
 }
 if(key(d)<meta.from)return {eligible:false,reason:'futuro'};
 return episodes.length?{eligible:true,reason:'',episodes:episodes.length}:{eligible:false,reason:'sem-episodios'};
}
function showEligibilityMap(catalog,year,date=new Date()){
 const d={year:Number(year),month:date.getMonth()+1,day:Math.min(date.getDate(),new Date(Number(year),date.getMonth()+1,0).getDate())};
 const counts=new Map(),airedThisYear=new Set(),names=new Map();
 for(const ep of Array.isArray(catalog)?catalog:[]){
   if(ep?.kind!=='episode'||!ep.show)continue;
   const id=normalize(ep.show);names.set(id,ep.show);
   if(!eligible(ep,d))continue;
   counts.set(id,(counts.get(id)||0)+1);
   if(String(ep.firstAiredBR||ep.originalAirdate||ep.releaseDate||'').startsWith(`${year}-`))airedThisYear.add(id);
 }
 const result=new Map(),k=key(d);
 for(const [id,name] of names){
   const meta=SHOWS.find(s=>normalize(s.name)===id),count=counts.get(id)||0;
   const allowed=meta? k>=meta.from&&count>0 : count>0&&airedThisYear.has(id);
   result.set(name,allowed?{eligible:true,reason:'',episodes:count}:
     {eligible:false,reason:meta&&k<meta.from?'futuro':meta?'sem-episodios':'historico',episodes:count});
 }
 return result;
}
function weighted(pool,r){if(!pool.length)return null;const weights=pool.map(x=>Math.max(.15,Math.min(5,Number(x.popularity)||1)) * (x.kind==='episode'?(x.streamAvailability==='played'?8:x.streamAvailability==='candidate'?5:1):1)),total=weights.reduce((a,b)=>a+b,0);let t=r()*total;for(let i=0;i<pool.length;i++){t-=weights[i];if(t<=0)return pool[i]}return pool.at(-1)}
function pickEpisode(show,catalog,d,r,seasonName){
 const candidates=catalog.filter(x=>eligible(x,d)&&x.kind==='episode'&&normalize(x.show)===normalize(show)&&(!x.event||x.event==='normal'||x.event===seasonName));
 if(!candidates.length)return {asset:null,age:'acervo pendente'};
 const now=Date.UTC(d.year,d.month-1,d.day);
 const recent=candidates.filter(x=>{const rel=x.firstAiredBR||x.releaseDate;const days=Math.floor((now-Date.parse(rel+'T00:00:00Z'))/86400000);return days>=0&&days<=365});
 const old=candidates.filter(x=>!recent.includes(x));
 let pool=(r()<.70?recent:old);if(!pool.length)pool=recent.length?recent:old;
 const asset=weighted(pool,r);
 return {asset,age:recent.includes(asset)?'novo':'clássico'};
}
function pickType(kind,catalog,d,r,seasonName,show,block){
 let pool=catalog.filter(x=>eligible(x,d)&&x.kind===kind&& (!x.event||x.event==='normal'||x.event===seasonName));
 if(block){const byBlock=pool.filter(x=>normalize(x.block)===normalize(block));if(byBlock.length&&r()<.7)pool=byBlock}
 if(show){const matched=pool.filter(x=>normalize(x.show)===normalize(show));
   if(matched.length && r()<.84)pool=matched;
   else pool=pool.filter(x=>!x.show||normalize(x.show)===normalize(show));
 }
 if(seasonName!=='normal'){const themed=pool.filter(x=>x.event===seasonName);if(themed.length&&r()<.75)pool=themed}
 return weighted(pool,r);
}
function selectShow(d,at,block,r,last,marathonShow,allowedShows,eligibleNames,strictFiltered=false){
 if(marathonShow && (!allowedShows || allowedShows.has(normalize(marathonShow))))return marathonShow;
 const k=key(d), hour=Math.floor(at/3600);
 let all=SHOWS.filter(s=>s.from<=k && (!allowedShows || allowedShows.has(normalize(s.name))));
 // If the local episode index has eligible titles outside the historical seed
 // list, use those real catalog names instead of claiming the archive is empty.
 if(!all.length&&block!=='adultswim'&&eligibleNames?.size){
   all=[...eligibleNames.values()].filter(name=>!allowedShows||allowedShows.has(normalize(name)))
     .map(name=>({name,from:k,tags:['principal','comedia','aventura'],peakFrom:d.year,peakTo:d.year}));
 }
 if(!all.length)return null;
 // Séries classificadas como exclusivas da manhã nunca migram para a tarde/noite.
 if(hour>=12)all=all.filter(s=>!s.tags.includes('manha'));
 if(!all.length)return null;
 if(block!=='adultswim')all=all.filter(s=>!s.tags.includes('adult'));
 if(!all.length)return null;
 if(d.month===7&&[2016,2017,2018].includes(d.year)&&['temporada','maratona'].includes(block)&&r()<.65&&(!allowedShows||allowedShows.has(normalize('Jovens Titãs em Ação'))))return 'Jovens Titãs em Ação';
 const filters={
  adultswim:['adult'],madrugada:['madrugada','classico','comedia'],classicos:['classico','manha'],clube:['classico','manha'],
  herois:['herois','anime'],hahaha:['comedia'],brazuca:['brasileiro'],
  girlpower:['herois'],toonami:['anime'],offair:['madrugada','classico'],
  maratona:['principal','comedia','aventura'],temporada:['comedia','aventura']};
 let pool=(filters[block]?all.filter(s=>s.tags.some(t=>filters[block].includes(t))):all);
 if(!pool.length && block==='adultswim')return null;
 if(!pool.length){if(strictFiltered)return null;pool=all;}
 const daypart = hour<6?['madrugada','classico']:
   hour<9?['manha','classico','comedia']:
   hour<12?['comedia','manha','brasileiro']:
   hour<15?['comedia','principal','brasileiro']:
   hour<18?['herois','anime','aventura']:
   hour<22?['principal','aventura','comedia','herois']:
   ['madrugada','aventura','anime','classico'];
 if(['regular','classicos','clube','madrugada'].includes(block)){
   const daytime=pool.filter(s=>s.tags.some(t=>daypart.includes(t)));
   if(daytime.length)pool=daytime;
   else if(strictFiltered)return null;
 }
 // Âncoras históricas brasileiras (horários aproximados da grade, não cópia exata).
 // Em 2017, alguns horários foram documentados em outubro.
 if(d.year===2017){
   const featured={6:'Que Legal, Scooby-Doo!',7:'O Show de Tom e Jerry',8:'Titio Avô',
      9:'Ursos sem Curso',10:'Turma da Mônica',11:'Irmão do Jorel',12:'Jovens Titãs em Ação',
      13:'Apenas um Show',14:'Ben 10',15:'Dragon Ball Super',16:'Pokémon',
      17:'Apenas um Show',18:'Irmão do Jorel',19:'Poderosas Magiespadas',
      20:'O Incrível Mundo de Gumball',21:'Jovens Titãs em Ação',22:'Hora de Aventura',23:'Dragon Ball Super'};
   const title=featured[hour];
   if(title && all.some(s=>s.name===title) && !last.slice(-2).includes(title) && r()<.42)
     return title;
 }
 // Horários variados com equilíbrio por popularidade e peso de cada fase.
 const unique=pool.filter(s=>!last.includes(s.name));
 const candidates=unique.length?unique:pool;
 const weights=candidates.map(s=>{
   const onEra=d.year>=s.peakFrom&&d.year<=s.peakTo;
   const veryOld=d.year>s.peakTo+1;
   let w=onEra?2.8:(veryOld?.45:1.15);
   if(s.tags.includes('principal'))w*=1.3;
   if(hour<6&&s.tags.includes('madrugada'))w*=1.4;
   if((hour>=6&&hour<=10)&&s.tags.includes('manha'))w*=1.65;
   if(hour>=15&&hour<18&&s.tags.includes('herois'))w*=1.85;
   if(hour>=18&&hour<22&&s.tags.includes('principal'))w*=1.75;
   if(last.slice(-8).includes(s.name))w*=.13;
   return w;
 });
 let roll=r()*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<candidates.length;i++){roll-=weights[i];if(roll<=0)return candidates[i].name}
 return candidates[candidates.length-1]?.name||'O Incrível Mundo de Gumball';
}
function blockAt(d,sec,weekend,adultMode=false){
 if(adultMode && (sec>=20*3600||sec<6*3600))return 'adultswim';
 const hour=Math.floor(sec/3600),day=new Date(d.year,d.month-1,d.day).getDay();
 if(hour>=0&&hour<5){return d.year>=2020&&hour===1?'toonami':d.year>=2018&&hour===3?'offair':'madrugada'}
 if(hour===5)return 'classicos';
 if(hour===6)return 'classicos';
 if(hour===7)return weekend?'classicos':'herois';
 if(hour===8)return 'clube';
 if(hour===10 && (d.year<=2018))return 'hahaha';
 if(hour===11 && d.year<=2016)return 'brazuca';
 if(hour===11 && d.year===2017)return 'regular';
 if(hour===12 && d.year>=2017 && d.year<=2021)return 'herois';
 if(d.year>=2017&&hour===16&&day===6)return 'girlpower';
 if(weekend&&hour>=14&&hour<17)return 'maratona';
 if(weekend&&hour===18&&d.year===2015)return 'votatoon';
 if(weekend&&hour===18&&d.year===2016&&d.month<=3)return 'votatoon';
 if(d.year===2020&&d.month===10&&d.day===22&&hour===18)return 'votatoon';
 if(d.year===2018&&d.month>=5&&d.month<=8&&hour===13&&weekend)return 'copa';
 if(d.year===2015&&d.month>=5&&d.month<=8&&hour===13&&weekend)return 'copa';
 if(hour===17)return 'hahaha';
 if(hour===19&&d.year===2017&&d.month===2&&d.day>=27)return 'toontubers';
 if(hour===19&&d.year===2017&&d.month===3&&d.day<=3)return 'toontubers';
 if(hour===19&&d.year>=2017&&d.year<=2018&&day===6&&key(d)>='2017-02-27')return 'toontubers';
 if(hour===19&&d.year>=2015&&day===0)return 'cartoonzaum';
 if(hour===20&&(day===0||day===2||day===5||day===6))return 'cine';
 if(hour===21&&day===3)return 'outra';
 if(hour===23&&d.year>=2020)return 'toonami';
 if(season(d)!=='normal'&&hour===18)return 'temporada';
 return 'regular';
}
/* Grade 100% inteira: todas as fronteiras de meia hora são sugestões de formato,
   NUNCA limites de corte de vídeos. Fim do dia: um cartão de espera pode preencher
   segundos residuais, mas nenhum arquivo é interrompido artificialmente. */
function generate(date,year,catalog,options={}){
 const d={year,month:date.getMonth()+1,day:Math.min(date.getDate(),new Date(year,date.getMonth()+1,0).getDate())};
 const dateString=key(d), seasonal=season(d), adultMode=options.adultSwimMode===true, r=rng(hash(`${dateString}|CN-TL-v101|${adultMode}`));
 const weekend=[0,6].includes(new Date(year,d.month-1,d.day).getDay());
 const dayOfWeek=new Date(year,d.month-1,d.day).getDay();
 const cineAnchor=[0,2,5,6].includes(dayOfWeek)?20*3600:null;
 // Pré-filtragem uma vez por dia: evita varrer milhares de episódios em cada slot.
 // Duracao contaminada por trailers, erro de stream ou cache antigo nunca
 // transforma um desenho regular em um slot de 60 segundos.
 // Episódios importados pela TVmaze/Cinemeta são PROGRAMÁVEIS, mesmo quando
 // a fonte ainda não pôde ser verificada. Na v1.01, a exigência de
 // streamVerifiedByShow=true excluía todos os ~5.000 episódios quando os addons
 // falhavam temporariamente, e a grade desaparecia por completo.
 // 'programável' NÃO é sinônimo de 'reproduzível': sinalizamos pendência no guia,
 // e a reprodução valida a URL no momento de sintonizar.
 let available=(Array.isArray(catalog)?catalog:[]).filter(x=>eligible(x,d)).map(x=>{
   if(x.kind==='episode' && x.source==='stremio' && x.duration<7*60)
     return {...x,duration:11*60,durationVerified:false,durationSource:'previsao saneada'};
   return x;
 });
 const byKind=new Map(), byShow=new Map();
 const selectedShows=new Set((Array.isArray(options.selectedShows)?options.selectedShows:[]).map(normalize));
 // Modo filtrado limita o catálogo, mas mantém a mesma elegibilidade histórica
 // e a distribuição 70/30 (recentes/clássicos) dentro das séries escolhidas.
 let filteredFallback=false;
 if(options.catalogMode==='filtered'&&selectedShows.size){
   const filtered=available.filter(x=>x.kind!=='episode'||selectedShows.has(normalize(x.show)));
   if(filtered.some(x=>x.kind==='episode'))available=filtered;
   else filteredFallback=true; // Nenhuma escolha compatível com a data: preserve o sinal normal.
 }
 const allowedShows=new Set(available.filter(x=>x.kind==='episode' && x.show).map(x=>normalize(x.show)));
 const eligibleNames=new Map(available.filter(x=>x.kind==='episode'&&x.show).map(x=>[normalize(x.show),x.show]));
 // After a cold start, metadata may be unavailable. Preserve the historical
 // grid (with honest non-playable slates) rather than a blank day.
 const catalogReady=true; // Títulos só entram se houver metadados de episódio válidos e compatíveis com o ano.
 let themedJustPlayed=false;
 for(const asset of available){
   if(!byKind.has(asset.kind))byKind.set(asset.kind,[]);
   byKind.get(asset.kind).push(asset);
   if(asset.kind==='episode'){
     const title=normalize(asset.show);
     if(!byShow.has(title))byShow.set(title,[]);
     byShow.get(title).push(asset);
   }
 }
 let at=0,serial=0,recent=[],entries=[],marathonShow='',moviePlayed=false,lastMainShow='',lastMainBlock='';
 const announcedEmptyShorts=new Set();
 function left(){return DAY-at}
 function add(kind,title,seconds,asset=null,extras={}){
   const duration=Number(seconds);
   if(!Number.isFinite(duration)||duration<=0||duration>left()+.0001)return null;
   const e={id:`${dateString}:${serial++}`,kind,title,asset,duration,start:at,end:at+duration,mediaOffset:0,...extras};
   entries.push(e);at=e.end;return e;
 }
 const fillerRecent=[];
 function slate(seconds,block,title='Cartoon Network • já voltamos'){
   // Falta de episódio: alguns clipes curtos no máximo. O antigo limite
   // de 110 clipes por slot criava mais de 3.400 faixas por dia, travando a UI.
   // O restante fica como bloco de contingência, nunca infinitos anúncios.
   const limit=Math.min(Math.max(0,seconds),left());let used=0, last=null,steps=0;
   while(limit-used>=3 && steps++<4 && entries.length<3400){
     const remain=limit-used;
     let pool=available.filter(a=>['bumper','promo','ad'].includes(a.kind) && a.source==='local' &&
       a.duration>=2 && a.duration<=remain && (!a.event||a.event==='normal'||a.event===seasonal) &&
       (!a.block||a.block==='regular'||a.block===block));
     const fresh=pool.filter(a=>!fillerRecent.includes(a.id));if(fresh.length)pool=fresh;
     const asset=weighted(pool,r);if(!asset)break;
     last=add(asset.kind,asset.name,asset.duration,asset,{block,isMain:false,show:asset.show||null});
     if(!last)break;
     fillerRecent.push(asset.id);if(fillerRecent.length>Math.max(8,Math.min(32,Math.ceil(available.length/3))))fillerRecent.shift();
     used+=asset.duration;
   }
   if(limit-used>.05)last=add('slate',title,limit-used,null,{block,isMain:false});
   return last;
 }
 function mediaOptions(kind,show,block,maxDuration){
   return (byKind.get(kind)||[]).filter(x=>x.duration<=maxDuration+0.0001&&
       (!x.event||x.event==='normal'||x.event===seasonal)&&
       (!x.block||!block||x.block===block||x.block==='regular')&&
       (!x.show||!show||normalize(x.show)===normalize(show)));
 }
 function interval(show,block,budget=100){
   // Não criar vinhetas/comerciais artificiais: somente mídias reais medidas.
   // Uma pausa sem arquivos originava telas pretas de 30 segundos.
   let room=Math.min(left(),budget,120);
   // Intervalo de TV: vinheta, anúncio, promo, vinheta e outra promo. Cada peça é uma mídia
   // real do acervo e só entra se couber inteira.
   const order=['bumper','ad','promo','bumper','promo'];
   const used=new Set();
   for(const kind of order){
     if(room<3)break;
     let pool=mediaOptions(kind,null,block,room).filter(a=>!used.has(a.id));
     if(kind==='promo'&&show){
       const related=pool.filter(a=>normalize(a.show)===normalize(show));
       // Promos não são chamadas de entrada; podem anunciar outros desenhos.
       if(related.length&&r()<.40)pool=related;
     }
     if(seasonal!=='normal'){
       const themed=pool.filter(a=>a.event===seasonal);
       if(themed.length&&r()<.58)pool=themed;
     }
     const asset=weighted(pool,r);
     if(!asset)continue;
     add(kind,asset.name,asset.duration,asset,{block,show:asset.show||null,isMain:false});
     used.add(asset.id);room-=asset.duration;
   }
 }
 // Chamadas são SOMENTE introduções antes de uma nova série ou quadro.
 // Nunca inserir chamada entre episódios consecutivos da mesma série.
 function intro(show,block,room){
   if(room < 7)return;
   const isNewBlock = block!==lastMainBlock;
   const isNewShow = normalize(show)!==normalize(lastMainShow);
   if(!isNewBlock && !isNewShow)return;
   const calls=(byKind.get('call')||[]).filter(x=>x.duration<=room&&
      (!x.event||x.event==='normal'||x.event===seasonal));
   let pool=[];
   if(isNewBlock)pool=calls.filter(x=>normalize(x.block)===normalize(block));
   if(!pool.length&&isNewShow)pool=calls.filter(x=>normalize(x.show)===normalize(show)&&!x.block);
   const asset=weighted(pool,r);
   if(asset)add('call',asset.name,asset.duration,asset,{block,show,isMain:false});
 }
 function markMain(show,block){lastMainShow=show;lastMainBlock=block;}
 function chooseEpisode(show,block,maxDuration){
   let candidates=(byShow.get(normalize(show))||[]).filter(x=>x.duration<=maxDuration&&(!x.event||x.event==='normal'||x.event===seasonal));
   if(!candidates.length)return {asset:null,age:'acervo pendente'};
   if(seasonal!=='normal'){
     const festive=candidates.filter(x=>x.event===seasonal||(x.seasonTags||[]).includes(seasonal));
     if(festive.length&&!themedJustPlayed){
       const eventWeight=seasonal==='halloween'?(d.day>=24?.54:.34):
         seasonal==='christmas'?(d.day>=15?.52:.30):
         seasonal==='easter'?.36:seasonal==='vacation'?.25:seasonal==='newyear'?.28:seasonal==='summer'?.23:.24;
       if(r()<eventWeight)candidates=festive;
     }
   }
   // Mantém a regra 70% / 30% entre episódios recentes e mais antigos.
   return pickEpisode(show,candidates,d,r,seasonal);
 }
 function film(){
   const block='cine', room=Math.max(0,left()-155);
    const candidates=(byKind.get('movie')||[]).filter(x=>x.duration>=1200 && x.duration<=Math.min(room,3*3600) && eligible(x,d));
   const themed=seasonal!=='normal'?candidates.filter(x=>(x.seasonTags||[]).includes(seasonal)):[];
   const asset=weighted(themed.length&&r()<.32?themed:candidates,r);
   const title='Cine Cartoon';
   if(asset){
     intro(title,'cine',Math.max(0,left()-asset.duration-50));
     // Filme inteiro, sem dividir o mesmo stream em duas mídias independentes.
     add('movie','Cine Cartoon · '+asset.name,asset.duration,asset,{isMain:true,show:title,block});
     markMain(title,block);moviePlayed=true;
     interval(null,block,Math.min(95,left()));
     return true;
   }
   // Sem filme validado, não criar uma falsa sessão de 90 minutos.
   // O guia informa indisponibilidade na biblioteca e mantém a faixa regular.
   moviePlayed=true;
   return false;
 }
 // Filmes, episódios, promoções e vinhetas só entram quando CABEM INTEIROS.
 while(left()>0.001&&entries.length<3500){
   let block=blockAt(d,at,weekend,adultMode && (byKind.get('episode')||[]).some(x=>x.audience==='adult'));const hour=Math.floor(at/3600);
   if(announcedEmptyShorts.has(block+':'+hour))block='regular';
   if(block==='cine' && moviePlayed)block='regular';
   if(!moviePlayed && cineAnchor!==null && at>=cineAnchor && at<cineAnchor+3*3600){
     if(film())continue;
     block='regular';
   }
   if(block==='maratona'&&!marathonShow)marathonShow=selectShow(d,at,'maratona',r,recent,catalogReady?allowedShows:null,eligibleNames,options.catalogMode==='filtered');
   if(block!=='maratona')marathonShow='';
   // Adult Swim is optional; if the chosen filter has no eligible adult shows,
   // keep the regular Cartoon Network schedule instead of filling the night with slates.
   if(block==='adultswim'&&!SHOWS.some(s=>s.tags.includes('adult')&&allowedShows.has(normalize(s.name))))block='madrugada';
   if(left()<65){slate(left(),block,'Cartoon Network · próxima programação');break}
   if(['outra','toontubers','cartoonzaum'].includes(block)){
     let pool=mediaOptions('short',null,block,left()-36).filter(x=>normalize(x.block)===normalize(block));
     const asset=weighted(pool,r);
     if(asset){intro(BLOCKS[block].name,block,Math.max(0,left()-asset.duration-120));add('short',asset.name,asset.duration,asset,{isMain:true,block,show:BLOCKS[block].name});markMain(BLOCKS[block].name,block);interval(null,block);continue}
     // Existe a chamada do quadro, mas não o vídeo do quadro: sinalizar sem atribuir episódio aleatório.
     const hasCall=(byKind.get('call')||[]).some(a=>normalize(a.block)===normalize(block));
     if(hasCall){announcedEmptyShorts.add(block+':'+hour);block='regular';}
   }
   let show=selectShow(d,at,block,r,recent,marathonShow,catalogReady?allowedShows:null,eligibleNames,options.catalogMode==='filtered');
   // A seleção utiliza todas as séries com episódios válidos para a data,
   // mesmo que o verificador de streams ainda esteja trabalhando.
   if(!show){const untilCine=(cineAnchor!==null&&!moviePlayed&&at<cineAnchor)?cineAnchor-at:left();
      const title=options.catalogMode==='filtered'?'Cartoon Network · faixa sem desenhos selecionados':'Cartoon Network · acervo em verificação';
      slate(Math.min(1320,left(),untilCine),block,title);continue}
   let ep=chooseEpisode(show,block,Math.max(0,left()-50));
   let asset=ep.asset;
   if(seasonal!=='normal'&&block==='temporada'&&!themedJustPlayed&&r()<.36){
     const themed=available.filter(x=>x.duration<=left()-50&&['episode','special'].includes(x.kind)&&(x.event===seasonal||(x.seasonTags||[]).includes(seasonal)));
     if(themed.length){asset=weighted(themed,r);ep={asset,age:'especial'}}
   }
   // Se a serie prevista nao tem episodio elegivel, selecionar outra serie do
   // mesmo horario. Nunca ocupar 11-22 minutos com trailers/comerciais como
   // consequencia de um catalogo que ainda nao foi sincronizado.
   if(!asset){
     const otherShows=[...byShow.keys()].filter(k=>{
       if(k===normalize(show))return false;
       const title=SHOWS.find(s=>normalize(s.name)===k);
       return !(Math.floor(at/3600)>=12&&title?.tags.includes('manha'));
     });
     const alternateShows=otherShows.map(k=>byShow.get(k)).filter(Boolean)
       .map(assets=>assets.filter(a=>a.duration<=left()-100));
     const candidates=alternateShows.flat();
     const recentFiltered=candidates.filter(a=>!recent.slice(-3).includes(a.show));
     const alternative=weighted(recentFiltered.length?recentFiltered:candidates,r);
     if(alternative){asset=alternative;show=asset.show;ep={asset,age:'reprise'};}
   }
   const duration=asset?.duration||Math.min(left()-30,660);
   if(duration<=0){slate(left(),block);break}
   if(!asset){
     // Não criar atração sem vídeo. Preencher somente com clipes locais reais.
     slate(Math.min(left(),Math.max(120,duration)),block,'CN · acervo temporariamente indisponível');
   }else{
     // A chamada eh emitida apenas se um episodio ou curta REAL foi agendado
     // imediatamente depois dela. Nunca anunciar um desenho so para tocar anuncios.
     intro(asset.show||show,block,Math.max(0,left()-duration-35));
     add(asset.kind==='special'?'special':'episode',asset.name,duration,asset,
       {isMain:true,show:asset.show||show,block,episodeAge:ep.age});
     themedJustPlayed=!!asset && (asset.event===seasonal || (asset.seasonTags||[]).includes(seasonal));
     markMain(asset.show||show,block);
     // Anúncio e promo acompanham os bumpers entre episódios, como no fluxo
     // de programação definido para o canal.
     interval(show,block,120);
   }
   recent.push(show);if(recent.length>5)recent.shift();
 }
 if(left()>0.0001)slate(left(),'regular','Cartoon Network · encerramento do dia');
 // O cálculo mantém ponto flutuante porque MP4 usa durações fracionárias.
 return {date:dateString,year,season:seasonal,entries,blocks:BLOCKS,filteredFallback,
   eligibleEpisodes:available.filter(x=>x.kind==='episode').length,eligibleShows:eligibleNames.size};
}
root.CnPlanner={generate,SHOWS,BLOCKS,YEARS,season,easterMonth,eligible,showEligibility,showEligibilityMap,pickEpisode,key};
})(typeof module==='object'&&module.exports?module.exports:window);
