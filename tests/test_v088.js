'use strict';
const assert=require('node:assert/strict');
const p=require('../public/planner.js').CnPlanner;
const asset=(title,year,firstCN)=>({id:'movie:'+title,source:'stremio',kind:'movie',show:'Cine Cartoon',name:title,path:'stremio:movie:tt12345',
 duration:5400,enabled:true,releaseDate:`${year}-01-01`,releaseYear:year,firstCNAiredYear:firstCN,block:'cine',streamCatalogChecked:true});
for(let year=2015;year<=2021;year++){
 const d={year,month:10,day:12};
 for(let rel=2012;rel<=2021;rel++){
  const a=asset('Film'+rel,rel,rel);
  assert.equal(p.eligible(a,d),year>=rel&&year<=rel+3,`film age ${rel} in ${year}`);
 }
}
assert(!p.eligible(asset('film2017',2017,2019),{year:2018,month:10,day:12}));
assert(p.eligible(asset('film2017',2017,2019),{year:2019,month:10,day:12}));
const dayFilm={...asset('Lego',2017,2019),firstCNAiredDate:'2019-10-14'};
assert(!p.eligible(dayFilm,{year:2019,month:10,day:13}),'ainda não exibido em CN');
assert(p.eligible(dayFilm,{year:2019,month:10,day:15}),'após primeira exibição CN');
const movies=[asset('Scooby',2015,2015),asset('Batman',2017,2019)];
// Tue/2020 Oct 13: movie 2015 expired, Batman eligible.
const date=new Date(2026,9,13,12);
const withFilm=p.generate(date,2020,movies);
assert(withFilm.entries.some(e=>e.kind==='movie' && e.asset?.name==='Batman'),'Cine needs film');
assert(!withFilm.entries.some(e=>e.kind==='movie' && e.asset?.name==='Scooby'),'expired film');
const without=p.generate(date,2020,[]);
assert(!without.entries.some(e=>e.kind==='movie'),'no confirmed movies: no movie');
assert(without.entries.some(e=>e.title.includes('Cine Cartoon') && e.kind==='slate'),'film program holds its slot');
// Halloween tags bias without saturating every episode; checker won't count empty streams.
const eps=[];
for(let n=1;n<=60;n++)eps.push({id:'ep'+n,kind:'episode',source:'local',show:'O Incrível Mundo de Gumball',name:'Episode'+n,path:'/media/ep'+n+'.mp4',
 duration:660,enabled:true,releaseDate:'2014-01-01',seasonTags:n<=10?['halloween']:[],popularity:1});
const seasonal=p.generate(new Date(2026,9,26),2017,eps);
const main=seasonal.entries.filter(e=>e.kind==='episode'&&e.asset);
const spooky=main.filter(e=>e.asset.seasonTags?.includes('halloween'));
assert(spooky.length>0,'should select some Halloween episodes');
assert(spooky.length<main.length,'not only Halloween episodes');
for(const e of seasonal.entries){
 assert(!e.asset || p.eligible(e.asset,{year:2017,month:10,day:26}));
}
console.log('OK v0.8.8: movie window + CN airing + Cine Cartoon with confirmed titles only + Halloween bias');
