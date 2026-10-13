const assert = require('node:assert/strict');
const Planner = require('../public/planner.js').CnPlanner;
const names=['Apenas um Show','O Incrível Mundo de Gumball','Hora de Aventura','Steven Universo','Jovens Titãs em Ação','Ursos sem Curso','Irmão do Jorel','Pokémon','O Show de Tom e Jerry','Que Legal, Scooby-Doo!'];
const index=Array.from({length:5000},(_,i)=>({
 id:'s'+i,kind:'episode',source:'stremio',path:`stremio:tt${String(1000000+i).slice(0,7)}:1:${i+1}`,
 name:`${names[i%names.length]} · T01E${i+1}`,show:names[i%names.length],
 releaseDate:'2016-01-01',duration:i%33===0?60:660,enabled:true,
 streamVerifiedByShow:false,availabilityPending:true,season:1,episode:i+1
}));
const start=performance.now();
const result=Planner.generate(new Date(2017,9,13),2017,index);
const mains=result.entries.filter(e=>e.isMain && e.kind==='episode');
const unique=new Set(mains.map(x=>x.asset.show));
assert.ok(mains.length>=40,'5000 metadados NÃO verificados devem criar um guia com desenhos');
assert.ok(unique.size>=5,`esperava grade variada, mas vieram ${unique.size} séries`);
assert.ok(result.entries.at(-1).end>=86399.99,'24 horas completas');
assert.ok(mains.every(e=>e.duration>=420),'nenhum episódio não verificado pode virar 1 minuto');
assert.ok(mains.every(e=>e.asset.releaseDate<='2017-10-13'),'sem episódios futuros');
const future=index.slice(0,200).map(x=>({...x,releaseDate:'2025-01-01'}));
const resultF=Planner.generate(new Date(2017,9,13),2017,future);
assert.equal(resultF.entries.filter(e=>e.kind==='episode').length,0,'bloqueio de 2025 na grade de 2017');
console.log(`PASSOU: ${index.length} episódios, ${mains.length} atrações, ${unique.size} séries, ${Math.round(performance.now()-start)} ms`);
