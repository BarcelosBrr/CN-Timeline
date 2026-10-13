const assert=require('assert');
const P=require('../public/planner.js').CnPlanner;
const day=86400;
const d=(y,m=10,date=12)=>new Date(y,m-1,date,12,0,0);
const episode=(show,num,year,duration=660)=>({id:'e-'+show+'-'+num,kind:'episode',show,name:show+' '+num,path:'/media/'+num+'.mp4',duration,releaseDate:year+'-01-01',popularity:1});
const call=(show,year,num=1)=>({id:'c-'+show+num,kind:'call',show,name:'Vem aí '+show,path:'/media/c'+num+'.mp4',duration:10,years:[year]});
const blockCall=(block,year)=>({id:'b-'+block+year,kind:'call',block,name:'Vem aí quadro '+block,path:'/media/b'+year+'.mp4',duration:8,years:[year]});
const bump={id:'vinheta2017',kind:'bumper',name:'Vinheta CN',path:'/media/v.mp4',duration:7,years:[2017]};
const assets=[episode('O Incrível Mundo de Gumball',1,2014),episode('O Incrível Mundo de Gumball',2,2017),episode('O Incrível Mundo de Gumball',3,2018),episode('Apenas um Show',4,2014),episode('Ursos sem Curso',5,2016),call('O Incrível Mundo de Gumball',2017),call('Apenas um Show',2017),blockCall('hahaha',2017),blockCall('cine',2017),bump];
let totalCalls=0, wrongCalls=0, seasons={};
for(let y=2015;y<=2021;y++)for(let m=1;m<=12;m++)for(let dayOfMonth of [1,10,20]){
 const g=P.generate(d(y,m,dayOfMonth),y,assets);seasons[g.season]=(seasons[g.season]||0)+1;
 assert(g.entries.length>0);
 for(let i=0;i<g.entries.length;i++){
  const e=g.entries[i];const prev=g.entries[i-1];
  assert(e.duration>0,`zero duration ${y}-${m}`);
  assert(!prev||Math.abs(prev.end-e.start)<1e-5,`gap ${y}-${m}`);
  assert(e.end<=86400.01,`day overflow ${y}-${m}`);
  if(e.asset){assert(P.eligible(e.asset,{year:y,month:m,day:dayOfMonth}),`future or invalid ${e.asset.name} at ${y}-${m}`);assert(e.duration<=e.asset.duration+1e-5||e.kind==='movie',`clipped asset ${e.title}`);}
  if(e.kind==='call'){
    totalCalls++;
    const next=g.entries[i+1];
    if(!next||!['episode','special','movie','short'].includes(next.kind))wrongCalls++;
    if(prev&&e.show===prev.show&&prev.isMain)wrongCalls++;
  }
 }
 assert(Math.abs(g.entries.at(-1).end-86400)<1e-4);
}
assert.strictEqual(wrongCalls,0,`${wrongCalls} misplaced calls`);
assert(totalCalls>0,'no intro calls');
console.log('OK:',7*12*3,'grades; chamadas',totalCalls,'; events',seasons);
