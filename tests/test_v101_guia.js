const assert=require('node:assert/strict');
const p=require('../public/planner.js').CnPlanner;
const day=new Date(2017,9,13);
const clips=Array.from({length:328},(_,i)=>{const kind=['bumper','promo','ad','call'][i%4];return {
 id:'c'+i,kind,source:'local',path:'/media/'+i+'.mp4',name:kind+i,years:[2017],
 duration:kind==='bumper'?10:kind==='ad'?22:32,enabled:true,event:'normal'};});
const empty=p.generate(day,2017,[]);
assert.equal(empty.entries.at(-1).end,86400);
const noShows=p.generate(day,2017,clips);
assert.equal(noShows.entries.at(-1).end,86400);
assert.ok(noShows.entries.length<600,'não recriar milhares de intervalos quando episódios estão indisponíveis');
assert.equal(noShows.entries.filter(x=>x.isMain).length,0,'não anunciar episódios sem fonte');
const names=['Apenas um Show','O Incrível Mundo de Gumball','Hora de Aventura','Steven Universo','Jovens Titãs em Ação','Ursos sem Curso'];
const episodes=Array.from({length:6000},(_,i)=>({id:'ep'+i,kind:'episode',source:'stremio',
 path:'stremio:tt1234567:1:'+(i+1),name:names[i%6]+' · T01E01',show:names[i%6],
 releaseDate:'2016-01-01',duration:660,enabled:true,streamVerifiedByShow:true,season:1,episode:1}));
const now=Date.now(),withShows=p.generate(day,2017,[...clips,...episodes]);
assert.equal(withShows.entries.at(-1).end,86400);
assert.ok(withShows.entries.filter(x=>x.isMain).length>30,'a grade real aparece quando há fontes confirmadas');
assert.ok(Date.now()-now<2500,'a grade não deve bloquear a página com milhares de episódios');
console.log('Guia v1.01: cold start, contingência limitada e grade com 6000 episódios OK.');
