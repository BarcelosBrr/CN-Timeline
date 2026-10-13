const assert=require('node:assert/strict');
const planner=require('../public/planner.js').CnPlanner;
let catalog=[];
for(const s of planner.SHOWS){
  for(let ep=1;ep<=5;ep++)catalog.push({id:s.name+ep,name:s.name+ep,
    show:s.name,kind:'episode',path:'/media/ep.mp4',source:'local',
    duration:600+ep,releaseDate:s.from,years:[],enabled:true,popularity:1});
}
catalog.push({id:'future',name:'Episódio futuro',show:'O Incrível Mundo de Gumball',
 kind:'episode',path:'/media/f.mp4',duration:660,releaseDate:'2021-12-12',enabled:true,popularity:999});
let minTitles=999;
for(let year=2015;year<=2021;year++)for(let month of [1,4,7,10,12])for(let day of [1,11,21]){
 const data=planner.generate(new Date(2026,month-1,day,12),year,catalog);
 assert(Math.abs(data.entries.at(-1).end-86400)<.001);
 for(let i=0;i<data.entries.length;i++){
   const e=data.entries[i];
   assert(e.duration>0);
   if(i)assert(Math.abs(e.start-data.entries[i-1].end)<.001);
   if(e.asset)assert(planner.eligible(e.asset,{year,month,day}),`future item ${year}/${month}/${day}: ${e.asset.name}`);
 }
 const shows=new Set(data.entries.filter(x=>x.isMain).map(x=>x.show));
 minTitles=Math.min(minTitles,shows.size);assert(shows.size>=8);
}
const small=catalog.filter(a=>['O Incrível Mundo de Gumball','Ursos sem Curso','Apenas um Show'].includes(a.show));
for(let year=2015;year<=2021;year++){
 const schedule=planner.generate(new Date(2026,9,12),year,small);
 const actual=new Set(schedule.entries.filter(x=>x.kind==='episode'&&x.asset).map(x=>x.show));
 assert([...actual].every(x=>['O Incrível Mundo de Gumball','Ursos sem Curso','Apenas um Show'].includes(x)),
  'Uma série sem fonte confirmada não pode entrar como episódio');
}
console.log('OK: 105 grades de 24h, datas elegíveis e no mínimo',minTitles,'séries distintas por grade');
