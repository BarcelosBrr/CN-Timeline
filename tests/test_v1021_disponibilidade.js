const assert=require('node:assert/strict'),P=require('../public/planner.js').CnPlanner;
const d={year:2019,month:4,day:12};
function ep(show,n,status){return {id:show+':'+n,show,kind:'episode',source:'stremio',path:'stremio:tt'+n,season:1,episode:n,imdbId:'tt1710308',name:show+' episódio '+n,releaseDate:'2017-01-01',duration:660,streamAvailability:status,enabled:true}}
const no=ep('Maçã e Cebola',7,'unavailable'), yes=ep('Apenas um Show',1,'played'), maybe=ep('Hora de Aventura',3,'unknown');
assert.equal(P.eligible(no,d),false);
assert.equal(P.eligible(yes,d),true);
assert.equal(P.eligible(maybe,d),true);
const a=P.generate(new Date(2026,3,12),2019,[no,yes,maybe],{});
const shows=new Set(a.entries.filter(x=>x.isMain&&x.kind==='episode').map(x=>x.asset.show));
assert(!shows.has('Maçã e Cebola'));
assert(shows.has('Apenas um Show')||shows.has('Hora de Aventura'));
assert(Math.abs(a.entries.at(-1).end-86400)<.01);
console.log('OK: episódio sem fonte excluído, catálogo histórico válido e 24h');
