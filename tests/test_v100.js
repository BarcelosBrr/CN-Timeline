const assert=require('node:assert/strict');
const p=require('../public/planner.js').CnPlanner;
const date=new Date(2017,9,10,15,30);
const make=(show,id,verified)=>({id,path:`stremio:${id}:1:1`,kind:'episode',source:'stremio',show,
    duration:660,releaseDate:'2015-01-01',imdbId:id,season:1,episode:1,enabled:true,streamVerifiedByShow:verified});
const local={id:'local:bumper',path:'/media/vinhetas/2017/vinheta.mp4',kind:'bumper',source:'local',duration:7,
  years:[2017],event:'normal',enabled:true};
const a=make('O Incrível Mundo de Gumball','tt1942683',false);
const b=make('Hora de Aventura','tt1305826',true);
const future={...make('Steven Universo','tt3061046',true),releaseDate:'2020-01-01'};
const data=[a,b,future,local];
assert.equal(p.eligible(future,{year:2017,month:10,day:10}),false);
const out=p.generate(date,2017,data);
assert.equal(out.entries.at(-1).end,86400);
assert.equal(out.entries[0].start,0);
for(let i=1;i<out.entries.length;i++)assert.ok(Math.abs(out.entries[i].start-out.entries[i-1].end)<1e-6);
assert.ok(out.entries.some(e=>e.asset?.show==='Hora de Aventura'));
assert.ok(out.entries.some(e=>e.asset?.id===a.id),'metadados válidos devem gerar guia, apesar de verificação pendente');
assert.ok(out.entries.every(e=>e.asset?.id!==future.id));
assert.equal(JSON.stringify(out.entries.map(e=>e.title)),JSON.stringify(p.generate(date,2017,data).entries.map(e=>e.title)));
const adult=p.generate(date,2017,[...data,{...make('Rick and Morty','tt2861424',true),audience:'adult'}],{adultSwimMode:true});
assert.equal(adult.entries.at(-1).end,86400);
assert.ok(adult.entries.some(e=>e.block==='adultswim'));
console.log('v1.0 planner OK:',out.entries.length,'entries, adult:',adult.entries.filter(e=>e.block==='adultswim').length);
