'use strict';
const P=require('../public/planner.js').CnPlanner;
const eq=(a,b,e=0.01)=>Math.abs(a-b)<e;
let count=0;
for(let y=2015;y<=2021;y++)for(let m=1;m<=12;m++)for(let d of [1,12,28]){
 const entries=P.generate(new Date(2026,m-1,d),y,[]).entries;
 if(!eq(entries.at(-1).end,86400))throw Error('O dia nao termina a meia-noite '+y+'/'+m+'/'+d);
 for(let i=1;i<entries.length;i++)if(!eq(entries[i-1].end,entries[i].start))throw Error('Buraco ou sobreposicao');
 count++;
}
const media=[
{id:'ep',path:'/ep.mp4',name:'Gumball sample',kind:'episode',show:'O Incrível Mundo de Gumball',duration:1441.55,releaseDate:'2014-01-01',years:[]},
{id:'future',path:'/future.mp4',name:'Future',kind:'episode',show:'O Incrível Mundo de Gumball',duration:667.22,releaseDate:'2019-06-01',years:[]},
{id:'promo',path:'/promo.mp4',name:'Promo 2017',kind:'promo',show:'O Incrível Mundo de Gumball',duration:30.581,years:[2017]},
{id:'bumper',path:'/b.mp4',name:'bumper',kind:'bumper',duration:7.31,years:[2017]},
{id:'movie',path:'/m.mp4',name:'movie',kind:'movie',releaseDate:'2013-01-01',duration:5351.23,years:[2017]}];
const s=P.generate(new Date(2026,9,12),2017,media).entries;
for(let a of media){let rows=s.filter(x=>x.asset?.id===a.id);
 if(a.id==='future'&&rows.length)throw Error('Futuro entrou na grade');
 if(a.id==='movie'&&rows.length){
  if(!eq(rows.reduce((v,x)=>v+x.duration,0),a.duration))throw Error('Filme truncado');
 }else if(rows.some(x=>!eq(x.duration,a.duration)))throw Error('Corte de '+a.id);
}
console.log('OK: '+count+' grades, todos os arquivos completos, sem vazamento futuro');
