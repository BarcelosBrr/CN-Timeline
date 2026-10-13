'use strict';
const assert=require('node:assert/strict');
const p=require('../public/planner.js').CnPlanner;
// Without any cached episodes (first launch, TVmaze unavailable), guide must still exist.
for(let y=2015;y<=2021;y++){
 for(let m of [1,4,7,10,12]){
  const day=new Date(2026,m-1,12);
  const s=p.generate(day,y,[]);
  assert(s.entries.length>20,`empty guide ${y}-${m}`);
  assert(s.entries.some(x=>x.isMain && x.title && x.title!=='Cartoon Network · acervo em verificação'),`no recognizable show ${y}-${m}`);
  assert(Math.abs(s.entries[0].start)<.01);
  assert(Math.abs(s.entries.at(-1).end-86400)<.01);
  for(let i=1;i<s.entries.length;i++)assert(Math.abs(s.entries[i-1].end-s.entries[i].start)<.01);
 }
}
const eps=[];
for(let n=1;n<=30;n++)eps.push({id:'ep'+n,kind:'episode',show:'O Incrível Mundo de Gumball',name:'Episode '+n,
  source:'local',path:'/media/ep'+n+'.mp4',duration:660,enabled:true,releaseDate:n<=20?'2015-01-01':'2020-01-01',
  seasonTags:n%3===0?['halloween']:[]});
const d=new Date(2026,9,12),s=p.generate(d,2017,eps);
assert(s.entries.every(x=>!x.asset || x.asset.releaseDate<='2017-10-12'));
assert(s.entries.some(x=>x.kind==='episode'));
assert(s.entries.some(x=>x.asset && (x.asset.seasonTags||[]).includes('halloween')));
console.log('OK 0.8.85: 35 grades sem catálogo, anos sem conteúdos futuros, episódios Halloween');
