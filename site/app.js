/* Model Verification Bench · bench.wall.cloud */
"use strict";
{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tip=$('#tip');
const ST={al:'Alabama',ak:'Alaska',az:'Arizona',ar:'Arkansas',ca:'California',co:'Colorado',ct:'Connecticut',de:'Delaware',dc:'District of Columbia',fl:'Florida',ga:'Georgia',hi:'Hawaii',id:'Idaho',il:'Illinois',in:'Indiana',ia:'Iowa',ks:'Kansas',ky:'Kentucky',la:'Louisiana',me:'Maine',md:'Maryland',ma:'Massachusetts',mi:'Michigan',mn:'Minnesota',ms:'Mississippi',mo:'Missouri',mt:'Montana',ne:'Nebraska',nv:'Nevada',nh:'New Hampshire',nj:'New Jersey',nm:'New Mexico',ny:'New York',nc:'North Carolina',nd:'North Dakota',oh:'Ohio',ok:'Oklahoma',or:'Oregon',pa:'Pennsylvania',pr:'Puerto Rico',ri:'Rhode Island',sc:'South Carolina',sd:'South Dakota',tn:'Tennessee',tx:'Texas',ut:'Utah',vt:'Vermont',va:'Virginia',wa:'Washington',wv:'West Virginia',wi:'Wisconsin',wy:'Wyoming'};
const REG={};for(const[k,n]of Object.entries(ST))REG[k]={id:k,name:n,abbr:k.toUpperCase()};
REG.us={id:'us',name:'the U.S.',label:'United States (state averages)',conus:1};
const AB2FIPS={AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56',PR:'72'};
const FIPS2AB=Object.fromEntries(Object.entries(AB2FIPS).map(([a,f])=>[f,a]));
// dynamical.org: HRDPS only covers these states whole
const HRDPS_STATES=new Set(['CT','DC','DE','IA','ID','IN','MA','MD','ME','MI','MN','MT','ND','NH','NJ','NY','OH','OR','PA','RI','SD','VA','VT','WA','WI','WV']);
const MS=[['NOAA GFS','GFS','--c1',''],['NOAA GEFS','GEFS (mean)','--c1','6 4'],['NOAA HRRR','HRRR','--c2',''],['NOAA RRFS, virtual','RRFS','--c3',''],['NOAA RRFS ENS, virtual','RRFS ENS (mean)','--c3','6 4'],['NOAA REFS, virtual','REFS (mean)','--c3','2 3'],['ECMWF IFS ENS','IFS ENS (mean)','--c4','6 4'],['ECMWF AIFS Single','AIFS Single','--c5',''],['ECMWF AIFS ENS','AIFS ENS (mean)','--c5','6 4'],['Google WeatherNext 2, virtual','WeatherNext 2','--c7',''],['ECCC HRDPS','HRDPS','--c8',''],['Climatology','Climatology','--mute','2 4',1],['Persistence','Persistence','--mute','9 4',1]].map(([id,s,c,d,base])=>({id,s,c,d,base:!!base,ens:/ENS|GEFS|REFS/.test(id)}));
const MSI=Object.fromEntries(MS.map(m=>[m.id,m]));
// forecast length (hours) of short-range models; dynamical.org scores only lead days a model covers completely
const HOURS={'NOAA HRRR':48,'NOAA RRFS, virtual':84,'NOAA RRFS ENS, virtual':60,'NOAA REFS, virtual':60,'ECCC HRDPS':48};
const naWhy=(m,i)=>HOURS[m.id]&&(i+1)*24>HOURS[m.id]?`${m.s} runs to ${HOURS[m.id]} h, so day ${i} (hours ${i*24}–${i*24+23}) isn't fully covered. dynamical.org only scores complete lead days.`:'No score for this lead day.';
const MET={RMSE:{l:'RMSE',b:'lower',r:0,u:1},RMSE_bc:{l:'RMSE, bias-corrected',b:'lower',r:0,u:1},MAE:{l:'MAE',b:'lower',r:0,u:1},MAE_bc:{l:'MAE, bias-corrected',b:'lower',r:0,u:1},Bias:{l:'Bias',b:'target',r:0,u:1},CRPS:{l:'CRPS',b:'lower',r:0,u:1},CRPS_bc:{l:'CRPS, bias-corrected',b:'lower',r:0,u:1},
 ETS:{l:'ETS',b:'higher',r:0,u:0},HSS:{l:'HSS',b:'higher',r:0,u:0},FSS:{l:'FSS',b:'higher',r:0,u:0},FrequencyBias:{l:'Frequency bias',b:'target',r:1,u:0}};
/* metric guide: rec 1 = recommended starting point, 2 = for specific questions */
const GUIDE={temperature_2m:[
 ['RMSE',1,'Overall error','Typical size of the miss, with big misses counting extra (square root of the mean squared forecast − observed difference).','0 is perfect; lower is better.','Start here. The headline accuracy number, and the one most scorecards lead with.'],
 ['Bias',1,'Too warm or too cold','Average of forecast − observed. Positive means forecasts run warm; negative, cold.','0 is perfect; closer to 0 is better.','Read it next to RMSE. If bias is a big share of RMSE, the error is a steady offset a forecaster can correct for.'],
 ['RMSE_bc',1,'Error after fixing the offset','RMSE after removing each station\'s 180-day average error for that model.','0 is perfect; lower is better.','The fairest model comparison: it shows the skill left after a simple local calibration, so one model\'s station quirks don\'t decide the ranking.'],
 ['CRPS',2,'Ensemble accuracy','Scores the whole spread of ensemble members against what happened, in °C/°F. For single-run models it equals MAE.','0 is perfect; lower is better.','Use when comparing ensembles (GEFS, IFS ENS, AIFS ENS) as probability forecasts, since it rewards a spread that is the right width.'],
 ['MAE',2,'Typical miss','Average size of the miss, every miss counted equally.','0 is perfect; lower is better.','Less swayed by a few big busts than RMSE. Use it when you care about ordinary days more than outliers.'],
 ['MAE_bc',2,'Typical miss after fixing the offset','MAE after removing each station\'s 180-day average error.','0 is perfect; lower is better.','Same idea as RMSE bias-corrected, with every miss weighted equally.'],
 ['CRPS_bc',2,'Ensemble accuracy after fixing the offset','CRPS after removing each station\'s 180-day average error.','0 is perfect; lower is better.','Compares ensembles once their steady warm or cold offsets are removed.']],
precipitation_surface:[
 ['ETS',1,'Rain/no-rain skill','Equitable threat score: how well wet 6-hour periods (0.1 mm/h or more) were forecast, after removing the hits a random forecast would get.','−1/3 to 1. 0 is no skill, 1 is perfect; higher is better.','Start here. The standard skill score for whether it rains.'],
 ['FrequencyBias',1,'Rains too often or too rarely','Number of forecast wet periods ÷ number of observed wet periods.','1 is perfect. Above 1 forecasts rain too often; below 1, too rarely.','Read it next to ETS. A model can lift ETS by forecasting rain too often, and this shows it.'],
 ['FSS',2,'Near-miss credit','Fractions skill score: compares how much of a surrounding area is wet, so rain forecast slightly in the wrong place still earns partial credit.','0 to 1; higher is better.','Fairer to high-resolution models (HRRR, RRFS, REFS), whose sharp storms get punished twice by point scores when slightly misplaced.'],
 ['HSS',2,'Wet and dry skill','Heidke skill score: credit for correct wet and correct dry forecasts, beyond chance.','−1 to 1. 0 is no skill; higher is better.','Like ETS but also rewards correctly calling dry periods. Useful in dry seasons or climates.'],
 ['Bias',2,'Too wet or too dry','Average forecast − observed rain rate, per day. Positive means too wet overall.','0 is perfect; closer to 0 is better.','Checks whether a model\'s totals run wet or dry over the window.'],
 ['MAE',2,'Rain amount error','Average size of the rain-rate miss, per day.','0 is perfect; lower is better.','Use with care: most 6-hour periods are dry, so smooth forecasts that drizzle a little everywhere can score well here while missing the real storms.'],
 ['CRPS',2,'Ensemble rain accuracy','Scores the spread of ensemble rain forecasts against what fell. For single-run models it equals MAE.','0 is perfect; lower is better.','Use when comparing ensembles as probability forecasts of rain amount.']]};
const gfor=(v,m)=>(GUIDE[v]||[]).find(g=>g[0]===m);
const VARL={temperature_2m:'2-m temperature',precipitation_surface:'precipitation'};
const S={lmode:'abs',region:'us',_st:null,v:'temperature_2m',m:'RMSE',w:90,lead:1,units:'si',ref:'NOAA GFS',mapModel:'NOAA GFS',station:null,shown:new Set(['NOAA GFS','NOAA GEFS','NOAA HRRR','NOAA RRFS, virtual','ECMWF IFS ENS','ECMWF AIFS Single','ECMWF AIFS ENS','Google WeatherNext 2, virtual','Climatology','Persistence']),hover:null,group:'all',scmode:'score'};
let META,STATES,NC={},R=null,VM,W,L;const STC={};const hasSt=()=>!!(R&&!R.conus&&Object.keys(NC).length);

/* ---------- data access ---------- */
const vmIndex=()=>VM.findIndex(([v,m])=>v===S.v&&m===S.m);
function seriesX(obj,model,v,met,w,conv){const a=obj&&obj[model];if(!a)return null;const lay=obj.__f;const vm=lay?lay.vm:VM,ws=lay?lay.windows:W;const i=vm.findIndex(([x,m])=>x===v&&m===met),j=ws.indexOf(w);if(i<0||j<0)return null;const o=(i*ws.length+j)*L.length;
 const out=[];for(let k=0;k<L.length;k++){const x=a[o+k];out.push(x==null||Number.isNaN(x)?NaN:conv?cv(x):x)}return out.some(Number.isFinite)?out:null}
const series=(obj,model)=>seriesX(obj,model,S.v,S.m,S.w,1);
// average of several station objects (a terrain group), same layout
const AVC={};function avgObj(key,objs){if(AVC[key])return AVC[key];const lay=objs[0]&&objs[0].__f,o={__f:lay};const ms=new Set();objs.forEach(x=>Object.keys(x).forEach(k=>k!=='__f'&&ms.add(k)));
 for(const m of ms){let n=0,arr=null,cnt=null;for(const x of objs){const a=x[m];if(!a)continue;if(!arr){arr=new Float64Array(a.length);cnt=new Float64Array(a.length)}for(let i=0;i<a.length;i++)if(!Number.isNaN(a[i])){arr[i]+=a[i];cnt[i]++}}
  if(arr){for(let i=0;i<arr.length;i++)arr[i]=cnt[i]?arr[i]/cnt[i]:NaN;o[m]=arr}}return AVC[key]=o}
// terrain groups: NC physiographic regions by elevation; elsewhere elevation thirds
function groupsFor(){if(!R||R.conus)return[];const sts=META.stations.filter(s=>s.state===R.abbr&&NC[s.id]);if(sts.length<9)return[];
 const elev=s=>(STI[s.id]&&STI[s.id].elev)??NaN;
 if(R.abbr==='NC')return[['mtn','Mountains (above 450 m)',s=>elev(s)>=450],['pied','Piedmont (90–450 m)',s=>elev(s)>=90&&elev(s)<450],['coast','Coastal Plain (below 90 m)',s=>elev(s)<90]].map(([k,l,f])=>({k,l,ids:sts.filter(f).map(s=>s.id)})).filter(g=>g.ids.length>=3);
 const e=sts.map(elev).filter(Number.isFinite).sort((a,b)=>a-b);if(e.length<9)return[];const t1=e[Math.floor(e.length/3)],t2=e[Math.floor(2*e.length/3)];const r=x=>Math.round(x);
 return[['low',`Lowest third (below ${r(t1)} m)`,s=>elev(s)<t1],['mid',`Middle third (${r(t1)}–${r(t2)} m)`,s=>elev(s)>=t1&&elev(s)<t2],['high',`Highest third (above ${r(t2)} m)`,s=>elev(s)>=t2]].map(([k,l,f])=>({k,l,ids:sts.filter(f).map(s=>s.id)})).filter(g=>g.ids.length>=3)}
const curGroup=()=>S.group==='all'?null:groupsFor().find(g=>g.k===S.group)||null;
const unitObjs=()=>{const g=curGroup();return Object.entries(NC).filter(([id])=>!g||g.ids.includes(id)).map(([,o])=>o)};
async function loadStations(abbr){if(STC[abbr])return STC[abbr];const d=await fetch(`data/st/${abbr}.json`).then(r=>{if(!r.ok)throw new Error(abbr);return r.json()});
 const lay={vm:d.vm,windows:d.windows},per=d.windows.length*d.leads.length,out={};
 for(const[sid,ms]of Object.entries(d.s)){const o={__f:lay};for(const[m,str]of Object.entries(ms)){const parts=str.split(','),arr=new Float64Array(parts.length);for(let i=0;i<parts.length;i++){const sc=d.scale[Math.floor(i/per)];arr[i]=parts[i]===''?NaN:+parts[i]/sc}o[m]=arr}out[sid]=o}
 return STC[abbr]=out}
function cv(x){if(S.units!=='us'||!MET[S.m].u)return x;return S.v==='temperature_2m'?x*1.8:x/25.4}
function unit(){if(!MET[S.m].u)return'';return S.v==='temperature_2m'?(S.units==='us'?' °F':' °C'):(S.units==='us'?' in/day':' mm/day')}
const dec=()=>!MET[S.m].u?2:S.v==='temperature_2m'?2:S.units==='us'?3:2;
const fmt=v=>Number.isFinite(v)?(S.m==='Bias'&&v>0?'+':'')+v.toFixed(dec()):'—';
function covers(model,scope){if(model!=='ECCC HRDPS')return true;if(!scope)return false;return scope.kind==='station'||(scope.kind==='state'&&HRDPS_STATES.has(scope.abbr))}
function scope(){if(S.station&&NC[S.station])return{kind:'station',obj:NC[S.station],name:stName(S.station)};if(R&&R.conus)return{kind:'us',obj:STATES.US,name:'the U.S.'};const a=REG[S.region].abbr,g=curGroup();
 if(g)return{kind:'state',abbr:a,obj:avgObj(a+'|'+g.k,g.ids.map(id=>NC[id])),name:`${REG[S.region].name}'s ${g.l.replace(/ \(.*\)/,'').toLowerCase()}`,group:g};return{kind:'state',abbr:a,obj:STATES[a],name:REG[S.region].name}}
const models=sc=>MS.filter(m=>S.shown.has(m.id)&&covers(m.id,sc)&&series(sc.obj,m.id));
const dist=v=>{const c=MET[S.m];if(!Number.isFinite(v))return Infinity;return c.b==='lower'?v:c.b==='higher'?-v:Math.abs(v-c.r)};
const STI={};const stName=id=>STI[id]?`${STI[id].name} (${id})`:id;

/* ---------- geometry: U.S. Census boundaries (us-atlas, ISC) drawn with d3-geo ---------- */
let TOPO=null;
async function loadTopo(){if(!TOPO)TOPO=await fetch('geo/us-counties-10m.json').then(r=>{if(!r.ok)throw new Error('geo');return r.json()});return TOPO}
function prep(reg){const T=TOPO;
 if(reg.conus){const feats=topojson.feature(T,T.objects.states).features.filter(f=>FIPS2AB[f.id]&&STATES[FIPS2AB[f.id]]);
  return{...reg,feats,inner:topojson.mesh(T,T.objects.states,(a,b)=>a!==b&&FIPS2AB[a.id]&&FIPS2AB[b.id]),outline:{type:'FeatureCollection',features:feats},stations:[]}}
 const fips=AB2FIPS[reg.abbr],gs=T.objects.counties.geometries.filter(g=>g.id.slice(0,2)===fips),col={type:'GeometryCollection',geometries:gs};
 const sg=T.objects.states.geometries.find(g=>g.id===fips);if(!sg||!gs.length)return{...reg,feats:[],stations:[]};
 return{...reg,feats:topojson.feature(T,col).features,outline:topojson.feature(T,sg),inner:topojson.mesh(T,col,(a,b)=>a!==b),stations:META.stations.filter(s=>s.state===reg.abbr)}}
// Albers (with Alaska and Hawaii insets) for the U.S.; for a state, a conformal conic on its own latitudes.
// Fitted to the width; the height follows the state's shape, capped for tall states.
function fitProj(R,W0,pad){let p;
 if(R.conus)p=d3.geoAlbersUsa();
 else{const b=d3.geoBounds(R.outline);let x0=b[0][0],x1=b[1][0];const y0=b[0][1],y1=b[1][1];if(x1<x0)x1+=360;const lon0=((x0+x1)/2+540)%360-180,dy=y1-y0;
  p=d3.geoConicConformal().parallels([y0+dy/6,y1-dy/6]).rotate([-lon0,0])}
 const w=Math.max(50,W0-2*pad);p.fitWidth(w,R.outline);let bb=d3.geoPath(p).bounds(R.outline),H=Math.ceil(bb[1][1]-bb[0][1]);
 const maxH=Math.round(W0*1.05);if(H>maxH){p.fitSize([w,maxH],R.outline);H=maxH;bb=d3.geoPath(p).bounds(R.outline)}
 const t=p.translate();p.translate([t[0]+pad+(w-(bb[1][0]-bb[0][0]))/2-bb[0][0],t[1]+pad+(H-(bb[1][1]-bb[0][1]))/2-bb[0][1]]);
 return{proj:p,path:d3.geoPath(p),W:W0,H:H+2*pad}}
const countyName=(f,ab)=>{const n=f.properties.name;if(ab==='LA')return n+' Parish';if(ab==='AK')return n;if(ab==='VA'&&+f.id.slice(2)>=500)return n+' (city)';return n+' County'};

/* ---------- colour scales ---------- */
const SEQ=['#cce3fd','#9dc8f7','#6aabf1','#338ced','#2370cd','#1757ac','#0e3d7e'];
const DIVT=['#1757ac','#519ced','#b6d5f8','MID','#f8c1c1','#ec4647','#a3191a'];
const DIVP=['#8c510a','#d8b365','#f1e2bd','MID','#bde6df','#35978f','#01665e'];
function scaleFor(vals){const f=vals.filter(Number.isFinite).sort((a,b)=>a-b);if(!f.length)return null;const q=p=>f[Math.min(f.length-1,Math.floor(p*(f.length-1)))];const mid=getComputedStyle(probe).color;
 if(MET[S.m].b==='target'){const r=MET[S.m].r,span=Math.max(Math.abs(q(.05)-r),Math.abs(q(.95)-r))||1,cols=(S.v==='temperature_2m'?DIVT:DIVP).map(c=>c==='MID'?midColor():c),edges=[-1,-.6,-.2,.2,.6,1].map(t=>r+t*span);
  return{cols,edges,col:v=>{if(!Number.isFinite(v))return null;let i=0;while(i<edges.length&&v>=edges[i])i++;return cols[i]},lo:r-span,hi:r+span,div:1}}
 let lo=q(.05),hi=q(.95);if(hi-lo<1e-9){lo-=.5;hi+=.5}const n=SEQ.length,edges=[...Array(n-1)].map((_,i)=>lo+(i+1)*(hi-lo)/n),cols=isDark()?[...SEQ].reverse():SEQ;
 return{cols,edges,col:v=>{if(!Number.isFinite(v))return null;let i=0;while(i<edges.length&&v>=edges[i])i++;return cols[i]},lo,hi}}
function isDark(){probe.style.color='var(--bg)';const m=getComputedStyle(probe).color.match(/[\d.]+/g)||[255];return(+m[0]+ +m[1]+ +m[2])<300}
const probe=document.createElement('i');probe.style.display='none';document.body.appendChild(probe);
const midColor=()=>{probe.style.color='var(--mid)';return getComputedStyle(probe).color};

/* ---------- map ---------- */
function drawMap(){const el=$('#map');if(!R)return;if(!R.feats||!R.feats.length){el.innerHTML='<p class="msg">The map could not load. The scores below still work.</p>';return}
 const W0=el.clientWidth||800,G=fitProj(R,W0,6),path=G.path,proj=G.proj,H0=G.H;
 const mm=S.mapModel,BEST=mm==='__best';const fills=new Map(),bestOf=new Map();let vals=[];
 if(R.conus){for(const f of R.feats){const a=FIPS2AB[f.id];if(BEST){bestOf.set(f.id,a&&STATES[a]?bestAt(STATES[a],{kind:'state',abbr:a}):null);continue}const se=a&&series(STATES[a],mm);const v=se?se[S.lead]:NaN;fills.set(f.id,v);vals.push(v)}}
 else if(hasSt()){for(const st of R.stations){if(BEST){st.best=NC[st.id]&&bestAt(NC[st.id],{kind:'station'});continue}const se=series(NC[st.id],mm);st.v=se?se[S.lead]:NaN;vals.push(st.v)}}
 const scl=BEST?null:scaleFor(allVals())||scaleFor(vals),grp=curGroup();
 let h=`<svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="Map of ${esc(R.label||R.name)}">`;
 R.feats.forEach((f,i)=>{const v=fills.get(f.id),bm=bestOf.get(f.id),c=R.conus&&scl?scl.col(v):bm?`var(${bm.c})`:null;h+=`<path class="f" data-i="${i}" d="${path(f)}"${c?` style="fill:${c}${bm&&bm.ens?';fill-opacity:.45':''}"`:''}/>`});
 h+=`<path class="mesh" d="${path(R.inner)||''}"/>`+(R.conus?'':`<path class="outline" d="${path(R.outline)||''}"/>`);
 if(!R.conus){for(const st of R.stations){const xy=proj([st.lon,st.lat]);if(!xy)continue;const[x,y]=xy,c=hasSt()&&scl?scl.col(st.v):null;
  const bm=BEST&&st.best,dim=grp&&!grp.ids.includes(st.id)?';opacity:.25':'',on=S.station===st.id||S.hover===st.id;
  h+=bm?`<circle class="st${on?' on':''}" data-id="${esc(st.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${S.station===st.id?8:6}" style="fill:${bm.ens?'var(--bg)':`var(${bm.c})`};stroke:var(${bm.c});stroke-width:${bm.ens?3:2}${dim}"/>`
   :`<circle class="st${on?' on':''}" data-id="${esc(st.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${S.station===st.id?8:6}" style="fill:${c||'var(--mute)'}${dim}"/>`}}
 el.innerHTML=h+'</svg>';
 el.querySelectorAll('circle').forEach(c=>{c.onpointermove=e=>stationTip(c.dataset.id,e);c.onpointerleave=hideTip;c.onclick=()=>{if(NC[c.dataset.id]){S.station=S.station===c.dataset.id?null:c.dataset.id;renderAll()}}});
 el.querySelectorAll('path.f').forEach(p=>{const f=R.feats[+p.dataset.i];p.onpointermove=e=>{if(R.conus){const a=FIPS2AB[f.id];const rows=a&&STATES[a]?models({kind:'state',abbr:a,obj:STATES[a]}).map(m=>[m,series(STATES[a],m.id)[S.lead]]).filter(r=>Number.isFinite(r[1])).sort((x,y)=>dist(x[1])-dist(y[1])):[];
   showTip(`<b>${esc(f.properties.name)}</b>`+(rows.length?`<div style="margin-top:4px">${esc(MET[S.m].l)}, day ${S.lead}, best first</div>`:'')+rows.map(([m,v])=>`<div class="k"><span>${esc(m.s)}</span><span>${fmt(v)}</span></div>`).join(''),e.clientX,e.clientY)}else showTip(`<b>${esc(countyName(f,R.abbr))}</b>`,e.clientX,e.clientY)};p.onpointerleave=hideTip;
  if(R.conus)p.onclick=()=>{const a=FIPS2AB[f.id];if(a&&REG[a.toLowerCase()])setRegion(a.toLowerCase())}});
 // legend
 if(BEST){const cnt={};const list=R.conus?[...bestOf.values()]:R.stations.map(s=>s.best);list.forEach(b=>{if(b)cnt[b.id]=(cnt[b.id]||0)+1});const tot=Object.values(cnt).reduce((a,b)=>a+b,0);
  $('#maplegend').innerHTML=tot?`<div class="note">Best ${esc(MET[S.m].l)} at day ${S.lead}, among the models shown${R.conus?' (state averages)':''}</div>`+MS.filter(m=>cnt[m.id]).sort((a,b)=>cnt[b.id]-cnt[a.id]).map(m=>`<div class="lrow"><svg width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="${m.ens?'var(--bg)':`var(${m.c})`}" stroke="var(${m.c})" stroke-width="${m.ens?3:2}"/></svg><span>${esc(m.s)}</span><b>${cnt[m.id]} of ${tot}</b></div>`).join('')+`<p class="note">Rings are ensemble means; solid dots are single runs.${R.conus?' Lighter fills are ensemble means.':''} Hide models with the buttons above to compare a smaller set.</p>`:'<p class="note">No scores at this lead day.</p>';
  $('#maptitle').textContent=R.conus?'Best model by state':'Best model at each station';$('#mapnote').textContent=R.conus?'Click a state to open it.':`${R.stations.length} scored stations. Hover for every model's score; click one to score that station alone.`;return}
 const mn=MSI[mm]?MSI[mm].s:mm,shown=R.conus?'state averages':hasSt()?'each station':'';
 $('#maplegend').innerHTML=scl&&shown?`<div class="note">${esc(mn)} · ${esc(MET[S.m].l)}${esc(unit())} · day ${S.lead} · ${esc(shown)}</div><div class="ramp">${scl.cols.map(c=>`<i style="background:${c}"></i>`).join('')}</div><div class="rlab"><span>${fmt(scl.lo)}</span><span>${scl.div?(MET[S.m].r===0?'0':'1'):''}</span><span>${fmt(scl.hi)}</span></div><p class="note">${legendWords()}</p>`:`<p class="note">${R.conus||hasSt()?'No scores for this model at this lead day. Try another model, lead day or window.':'Station scores for this state did not load. The scorecard below shows the state average.'}</p>`;
 $('#maptitle').textContent=R.conus?'State averages':'ASOS stations';
 $('#mapnote').textContent=R.conus?'Click a state to open it.':`${R.stations.length} scored stations. Hover for every model's score; click one to score that station alone.`}
function allVals(){const out=[];const mods=MS.filter(m=>(S.shown.has(m.id)&&!m.base)||m.id===S.mapModel);
 if(R.conus){for(const a of Object.keys(STATES))if(a!=='US')for(const m of mods){const se=series(STATES[a],m.id);if(se)out.push(se[S.lead])}}
 else if(hasSt()){for(const id of Object.keys(NC))for(const m of mods){const se=series(NC[id],m.id);if(se)out.push(se[S.lead])}}
 return out}
function legendWords(){const c=MET[S.m];if(c.b==='target'){if(S.m==='Bias')return S.v==='temperature_2m'?'Blue: forecasts too cold. Red: too warm. Grey: close to unbiased.':'Brown: forecasts too dry. Teal: too wet. Grey: close to unbiased.';return'Brown: forecasts rain too rarely. Teal: too often. Grey: about right (1).'}
 const w=isDark()?'Paler':'Darker';return c.b==='lower'?w+' is a larger error. The scale is shared by every model, so switching models compares like with like.':w+' is more skill. The scale is shared by every model.'}
function stationTip(id,e){const sc={kind:'station',obj:NC[id]};const st=STI[id];
 const rows=NC[id]?models(sc).map(m=>[m,series(NC[id],m.id)[S.lead]]).filter(r=>Number.isFinite(r[1])).sort((a,b)=>dist(a[1])-dist(b[1])):[];
 showTip(`<b>${esc(stName(id))}</b><div>${esc(st&&st.county?st.county+(st.state==='LA'?' Parish':st.state==='AK'?'':' County'):'')}</div>`+(rows.length?`<div style="margin-top:4px">${esc(MET[S.m].l)}, day ${S.lead}, best first</div>`+rows.map(([m,v])=>`<div class="k"><span>${esc(m.s)}</span><span>${fmt(v)}</span></div>`).join(''):''),e.clientX,e.clientY)}
function showTip(h,x,y){tip.innerHTML=h;tip.style.display='block';const r=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x+14))+'px';tip.style.top=Math.max(8,y-r.height-12)+'px'}
function hideTip(){tip.style.display='none'}

/* ---------- scorecard, charts ---------- */
const BLUE=['#1757ac','#519ced','#9dc8f7','#cce3fd'],RED=['#a3191a','#ec4647','#f59a9a','#fcd3d3'];
function rel(v,r){const a=dist(v),b=dist(r);if(!isFinite(a)||!isFinite(b))return NaN;const c=MET[S.m];const base=c.b==='lower'?Math.max(Math.abs(r),1e-9):c.b==='higher'?Math.max(Math.abs(r),.02):Math.max(Math.abs(r-c.r),.05*(c.r||Math.abs(r)||1));return(a-b)/base}
// paired test across stations (or states, for CONUS): is model better/worse than ref consistently?
function sigUnits(sc){if(sc.kind==='state'&&hasSt())return unitObjs();if(sc.kind==='us')return Object.keys(STATES).filter(a=>a!=='US').map(a=>STATES[a]);return null}
function sigTest(units,m,r,i){if(!units)return null;const d=[];for(const u of units){const a=series(u,m),b=series(u,r);if(a&&b&&Number.isFinite(a[i])&&Number.isFinite(b[i]))d.push(dist(a[i])-dist(b[i]))}
 if(d.length<5)return{n:d.length,sig:false};const mu=d.reduce((x,y)=>x+y,0)/d.length,sd=Math.sqrt(d.reduce((x,y)=>x+(y-mu)**2,0)/(d.length-1));return{n:d.length,sig:Math.abs(mu)>2*sd/Math.sqrt(d.length)}}
function winRate(units,m,r,i){if(!units)return null;let w=0,n=0;for(const u of units){const a=series(u,m),b=series(u,r);if(a&&b&&Number.isFinite(a[i])&&Number.isFinite(b[i])){n++;if(dist(a[i])<dist(b[i]))w++}}return n>=3?{w,n,p:w/n}:null}
function relColor(p){if(!Number.isFinite(p))return[null,null];const a=Math.abs(p),i=a>=.5?0:a>=.25?1:a>=.1?2:a>=.03?3:-1;if(i<0)return['var(--mid)',null];return[(p<0?BLUE:RED)[i],i<2?'#fff':'#111']}
const swatch=m=>`<svg width="22" height="10" aria-hidden="true"><line x1="1" x2="21" y1="5" y2="5" stroke="var(${m.c})" stroke-width="3" stroke-dasharray="${m.d}" stroke-linecap="${m.d?'butt':'round'}"/></svg>`;
function renderScores(){const sc=scope(),ms=models(sc),ref=ms.find(m=>m.id===S.ref)||ms[0];
 $('#ref').innerHTML=ms.map(m=>`<option value="${esc(m.id)}"${ref&&m.id===ref.id?' selected':''}>${esc(m.s)}</option>`).join('');
 const su=sigUnits(sc),unitW=sc.kind==='us'?'states':'stations';
 $('#scnote').textContent=`${MET[S.m].l}${unit()} for ${sc.name}, by lead day. Blue cells beat ${ref?ref.s:'the reference'}, red cells trail it; darker means a bigger gap.`+(S.scmode==='win'&&su?` Win rate: the share of ${unitW} where each model beat ${ref?ref.s:'the reference'}. Above 50% (blue) means it won more often than not.`:su?` Cells are shaded only where the gap holds up across ${unitW} (paired test, about 95% confidence); grey means the difference could be noise.`:sc.kind==='station'?' A single station has no significance test, so treat small gaps with care.':' No significance test for this window.');
 const rv=ref?series(sc.obj,ref.id):[];
 $('#sc').innerHTML=`<thead><tr><th>Model</th>${L.map(d=>`<th>Day ${d}</th>`).join('')}</tr></thead><tbody>${ms.map(m=>{const vs=series(sc.obj,m.id);
  return`<tr${m.base?' class="baserow"':''}><td>${swatch(m)} ${esc(m.s)}</td>${vs.map((v,i)=>{if(!Number.isFinite(v))return`<td class="v na${i===S.lead?' cur':''}" data-i="${i}" tabindex="0" title="${esc(naWhy(m,i))}">—</td>`;const p=m===ref?NaN:rel(v,rv[i]),tst=m===ref||!Number.isFinite(p)?null:sigTest(su,m.id,ref.id,i),ns=tst&&!tst.sig,[bg,fg]=ns?['var(--mid)',null]:relColor(p);
   const t=Number.isFinite(p)?`${Math.abs(p*100).toFixed(0)}% ${p<0?'better':'worse'} than ${ref.s}`+(tst?(tst.sig?`, consistent across ${tst.n} ${unitW}`:`, not consistent across ${tst.n} ${unitW}`):''):m===ref?'reference':'';
   if(S.scmode==='win'){if(m===ref)return`<td class="v${i===S.lead?' cur':''}" tabindex="0" data-i="${i}" title="reference">ref</td>`;const wr=winRate(su,m.id,ref.id,i);if(!wr)return`<td class="v na${i===S.lead?' cur':''}" data-i="${i}" tabindex="0">—</td>`;
    const q=wr.p-.5,[b2,f2]=Math.abs(q)<.05?['var(--mid)',null]:relColor(-2*q);
    return`<td class="v${i===S.lead?' cur':''}" tabindex="0" data-i="${i}" title="${esc(`Better than ${ref.s} at ${wr.w} of ${wr.n} ${unitW}`)}" style="background:${b2};${f2?'color:'+f2:''}">${Math.round(wr.p*100)}%</td>`}
   return`<td class="v${i===S.lead?' cur':''}${m.base?' base':''}" tabindex="0" data-i="${i}" title="${esc(t)}" style="${bg?'background:'+bg+';':''}${fg?'color:'+fg:''}">${fmt(v)}</td>`}).join('')}</tr>`}).join('')}</tbody>`;
 if(S.scmode==='win'&&!su)$('#scnote').textContent+=' Win rate needs station-level scores, which aren\'t available for this view.';
 $('#sclegend').innerHTML='<span>Better ←</span>'+['50%+','25%','10%','3%','±3%','3%','10%','25%','50%+'].map((t,i)=>`<span><span class="sw" style="--c:${i<4?BLUE[i]:i===4?'var(--mid)':RED[8-i]}"></span>${t}</span>`).join('')+'<span>→ Worse</span>';
 $('#leg1').innerHTML=ms.map(m=>`<span>${swatch(m)}${esc(m.s)}</span>`).join('');
 $('#ltitle').textContent=`${MET[S.m].l} by lead day`;
 const c=MET[S.m],relv=S.lmode==='rel'&&ref;
 if(S.lmode==='skill'){const cl=series(sc.obj,'Climatology');$('#lnote').textContent=!skillable()?`${MET[S.m].l} is ${S.m==='Bias'||S.m==='FrequencyBias'?'a bias, not an error':'already a skill score (0 = no better than chance)'}, so a skill-vs-climatology view doesn't apply. Switch to RMSE, MAE or CRPS.`:!cl?'No climatology scores for this view.':`Skill vs climatology: 1 − ${/RMSE/.test(S.m)?'MSE ÷ climatology MSE':MET[S.m].l+' ÷ climatology '+MET[S.m].l}, as a percent. 0% is no better than forecasting the normal; 100% is perfect. Click a point to jump to that lead day.`;
  lineChart($('#leadfig'),{x:L.map(d=>'Day '+d),series:skillable()&&cl?ms.filter(m=>m.id!=='Climatology').map(m=>({name:m.s,c:m.c,d:m.d,vals:skillSeries(sc.obj,m.id)})):[],cur:S.lead,pick:i=>setLead(i),ref:0,lo0:false,fmt:v=>Number.isFinite(v)?Math.round(v)+'%':'—',asc:0,desc:1});return}
 $('#lnote').textContent=relv?`Percent difference in ${MET[S.m].l} from ${ref.s} at each lead day. Below 0 is better, above 0 is worse. Click a point to jump to that lead day.`:'Click a point to jump to that lead day.';
 lineChart($('#leadfig'),relv?{x:L.map(d=>'Day '+d),series:ms.map(m=>({name:m.s,c:m.c,d:m.d,vals:series(sc.obj,m.id).map((v,i)=>100*rel(v,rv[i]))})),cur:S.lead,pick:i=>setLead(i),ref:0,lo0:false,fmt:v=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(1)+'%':'—',asc:1}
  :{x:L.map(d=>'Day '+d),series:ms.map(m=>({name:m.s,c:m.c,d:m.d,vals:series(sc.obj,m.id)})),cur:S.lead,pick:i=>setLead(i),ref:c.b==='target'||c.b==='higher'?c.r:null,lo0:c.b!=='target'})}
const skillable=()=>['RMSE','RMSE_bc','MAE','MAE_bc','CRPS','CRPS_bc'].includes(S.m);
function skillSeries(obj,model){const a=series(obj,model),c=series(obj,'Climatology');if(!a||!c)return L.map(()=>NaN);const sq=/RMSE/.test(S.m);return a.map((v,i)=>Number.isFinite(v)&&Number.isFinite(c[i])&&c[i]>0?100*(1-(sq?(v/c[i])**2:v/c[i])):NaN)}
function horizon(obj,model){const k=skillSeries(obj,model);if(!k.some(Number.isFinite))return null;let d=-1;for(let i=0;i<k.length;i++){if(!Number.isFinite(k[i]))break;if(k[i]>0)d=i;else break}const last=k.reduce((a,v,i)=>Number.isFinite(v)?i:a,-1);return{d,beyond:d===last&&last===L.length-1,last}}
function renderHead(){const sc=scope(),ms=models(sc).filter(m=>!m.base),ev=ms.map(m=>[m,series(sc.obj,m.id)[S.lead]]).filter(r=>Number.isFinite(r[1])).sort((a,b)=>dist(a[1])-dist(b[1]));
 const per=`the last ${S.w} days through ${new Date(META.period_end+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
 $('#subtitle').textContent=`Day-${S.lead} ${VARL[S.v]} forecasts for ${sc.name}, scored by ${MET[S.m].l} against ASOS observations over ${per}.`;
 if(!ev.length){$('#title').textContent=`No ${MET[S.m].l} scores at day ${S.lead} for the models shown`;$('#figs').innerHTML='';return}
 const[best,bv]=ev[0],gfs=ev.find(r=>r[0].id==='NOAA GFS'),worst=ev[ev.length-1];
 $('#title').textContent=`${best.s} had the best ${VARL[S.v]} ${MET[S.m].l} ${sc.kind==='station'?'at '+stName(S.station):'in '+sc.name} at day ${S.lead}`;
 const nst=sc.kind==='station'?1:sc.kind==='us'?META.stations.length:META.stations.filter(s=>s.state===sc.abbr).length;
 const figs=[[fmt(bv)+unit(),`Best: ${best.s}`],gfs&&gfs[0]!==best?[fmt(gfs[1])+unit(),`GFS (${Math.abs(rel(gfs[1],bv)*100).toFixed(0)}% behind)`]:null,(()=>{const d2=S.lead<=2?Math.min(5,L.length-1):0,e2=ms.map(m=>[m,series(sc.obj,m.id)[d2]]).filter(r=>Number.isFinite(r[1])).sort((a,b)=>dist(a[1])-dist(b[1]));return e2.length?[fmt(e2[0][1])+unit(),`Best at day ${d2}: ${e2[0][0].s}`]:[fmt(worst[1])+unit(),`Last of ${ev.length}: ${worst[0].s}`]})(),(()=>{const cl=series(sc.obj,'Climatology');if(skillable()&&cl&&Number.isFinite(cl[S.lead])){const k=skillSeries(sc.obj,best.id)[S.lead];return[Math.round(k)+'%',`${best.s}'s skill vs climatology`]}
   if(cl&&Number.isFinite(cl[S.lead])){const beat=ev.filter(r=>dist(r[1])<dist(cl[S.lead])).length;return[`${beat} of ${ev.length}`,`models beat climatology (${fmt(cl[S.lead])}${unit()})`]}return[String(nst),nst===1?'ASOS station':'ASOS stations averaged']})()].filter(Boolean);
 $('#figs').innerHTML=figs.map(([a,b])=>`<div class="fig1"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}
function fillGroups(){const gs=groupsFor();$('#groupwrap').style.display=gs.length?'':'none';if(!gs.find(g=>g.k===S.group))S.group='all';
 $('#group').innerHTML=`<option value="all">All stations</option>`+gs.map(g=>`<option value="${g.k}"${g.k===S.group?' selected':''}>${esc(g.l)} · ${g.ids.length}</option>`).join('')}
function renderDeep(){if(!META||!R)return;const sc=scope(),ms=models(sc).filter(m=>!m.base);
 $('#deepnote').textContent=`For ${sc.name}, ${VARL[S.v]}, last ${S.w} days.`;
 // skill horizon
 const ok=skillable()&&series(sc.obj,'Climatology');
 $('#hznote').textContent=ok?`The last lead day at which ${MET[S.m].l} still beats climatology (skill above 0). Longer bars mean useful further ahead. Regional models stop at their forecast length.`:`Needs an error score with a climatology baseline. Pick RMSE, MAE or CRPS${S.v==='precipitation_surface'?' (precipitation MAE or CRPS)':''}.`;
 const hz=ok?ms.map(m=>[m,horizon(sc.obj,m.id)]).filter(r=>r[1]):[];hz.sort((a,b)=>(b[1].d+(b[1].beyond?1:0))-(a[1].d+(a[1].beyond?1:0)));
 const pers=ok?horizon(sc.obj,'Persistence'):null;
 $('#hz').innerHTML=hz.map(([m,h])=>`<div class="r"><span>${esc(m.s)}</span><div class="t" style="--c:var(${m.c})"><i style="width:${Math.max(2,(h.d+1)/L.length*100)}%"></i></div><b>${h.d<0?'never':h.beyond?'day 9+':h.d===h.last&&h.last<L.length-1?'day '+h.d+' (end)':'day '+h.d}</b></div>`).join('')+(pers?`<p class="note">Persistence ("same as yesterday") ${pers.d<0?'never beats climatology':'beats climatology through day '+pers.d}.</p>`:'');
 // recent vs long-term
 const w1=30,w2=180;const rcRows=ms.map(m=>{const a=seriesX(sc.obj,m.id,S.v,S.m,w1,1),b=seriesX(sc.obj,m.id,S.v,S.m,w2,1);return[m,a&&a[S.lead],b&&b[S.lead]]}).filter(r=>Number.isFinite(r[1])&&Number.isFinite(r[2]));
 $('#rcnote').textContent=rcRows.length?`${MET[S.m].l} at day ${S.lead} over the last 30 days against the last 180. ▲ means better recently, ▼ worse, ≈ within 3%. A big change can mean a model upgrade, or just a different season.`:'Needs both 30- and 180-day scores for this view.';
 $('#rc').innerHTML=rcRows.length?`<thead><tr><th>Model</th><th>30 days</th><th>180 days</th><th>Change</th></tr></thead><tbody>${rcRows.map(([m,a,b])=>{const d=dist(a)-dist(b),pc=Math.abs(b)>1e-9?d/Math.max(Math.abs(dist(b)),1e-9)*100:0,better=d<0;
  return`<tr><td>${swatch(m)} ${esc(m.s)}</td><td>${fmt(a)}</td><td>${fmt(b)}</td><td class="${Math.abs(pc)<3?'':better?'up':'down'}">${Math.abs(pc)<3?'≈':(better?'▲ ':'▼ ')+Math.abs(pc).toFixed(0)+'%'}</td></tr>`}).join('')}</tbody>`:'';
 // ensemble value: 1 - CRPS / MAE of ensemble mean (same variable, window)
 const ens=MS.filter(m=>m.ens&&covers(m.id,sc)).map(m=>{const c=seriesX(sc.obj,m.id,S.v,'CRPS',S.w,0),a=seriesX(sc.obj,m.id,S.v,'MAE',S.w,0);return[m,c&&c[S.lead],a&&a[S.lead]]}).filter(r=>Number.isFinite(r[1])&&Number.isFinite(r[2])&&r[2]>0);
 $('#ennote').textContent=ens.length?`For ensembles at day ${S.lead}: how much lower the ensemble's CRPS is than the mean's MAE. That gap is what the spread of members adds over a single best guess.`:'No ensemble CRPS for this view.';
 $('#en').innerHTML=ens.map(([m,c,a])=>{const g=100*(1-c/a);return`<div class="r"><span>${esc(m.s)}</span><div class="t" style="--c:var(${m.c})"><i style="width:${Math.max(1,Math.min(100,g*2))}%"></i></div><b>${g.toFixed(0)}%</b></div>`}).join('')}
/* ---------- storm case study (gridded MRMS vs models) ---------- */
const PB=[0.01,0.03,0.05,0.1,0.15,0.2,0.25,0.4,0.5,0.6,0.75,0.9,1,1.25,1.5,1.75,2,2.5,3,3.5,4,5,6,8];
const PC=['#d6d6d6','#b5b5b5','#8f8f8f','#c3f7bd','#97ec8f','#62d95c','#2fbd3a','#14a020','#1263d1','#2b84ee','#56a8f5','#93cdf9','#fffcc8','#fff09a','#ffd966','#ffbd3d','#ff9a00','#ff5a00','#ff2a00','#d40b00','#a80000','#7a0000','#6b3a2e','#9c6b5e'];
const DB=[-2,-1,-.5,-.25,-.1,.1,.25,.5,1,2],DC=['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3',null,'#c7eae5','#80cdc1','#35978f','#01665e','#003c30'];
let CASES=null,CASE=null,caseMode='total';const CASEC={};
async function loadCase(id){if(CASEC[id])return CASEC[id];const d=await fetch(`data/case/${id}.json`).then(r=>{if(!r.ok)throw 0;return r.json()});
 const dec=g=>g&&({...g,a:Float32Array.from(g.v.split(','),x=>+x<0?NaN:+x/10)});d.fields.forEach(f=>{f.grid=dec(f.grid);f.fine=dec(f.fine);f.p1in=dec(f.p1in)});return CASEC[id]=d}
const inch=mm=>mm/25.4,pcol=mm=>{const x=inch(mm);if(!(x>=PB[0]))return null;let b=0;while(b<PB.length-1&&x>=PB[b+1])b++;return PC[b]};
const dcol=mm=>{if(!Number.isFinite(mm))return null;const x=inch(mm);let b=0;while(b<DB.length&&x>=DB[b])b++;return DC[b]||midColor()};
function corners(g,proj){const c=new Float32Array((g.nlat+1)*(g.nlon+1)*2);let k=0;for(let i=0;i<=g.nlat;i++)for(let j=0;j<=g.nlon;j++){const p=proj([g.lon_w+(j-.5)*g.d,g.lat_n-(i-.5)*g.d])||[NaN,NaN];c[k++]=p[0];c[k++]=p[1]}return c}
function caseMask(g){if(g._mask)return g._mask;const m=new Uint8Array(g.nlat*g.nlon);for(let i=0;i<g.nlat;i++)for(let j=0;j<g.nlon;j++)m[i*g.nlon+j]=d3.geoContains(R.outline,[g.lon_w+j*g.d,g.lat_n-i*g.d])?1:0;return g._mask=m}
async function renderCase(){const sec=$('#case');if(!R||R.conus||!R.outline){sec.hidden=true;return}
 try{if(!CASES)CASES=await fetch('data/case/index.json').then(r=>r.ok?r.json():[])}catch(e){CASES=[]}
 const list=CASES.filter(c=>c.state===R.abbr);if(!list.length){sec.hidden=true;return}
 const pick=$('#casepick');pick.innerHTML=list.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');pick.parentElement.style.display=list.length>1?'':'none';
 const want=list.find(c=>CASE&&c.id===CASE.id)||list[0];pick.value=want.id;
 try{CASE=await loadCase(want.id)}catch(e){sec.hidden=true;return}sec.hidden=false;
 $('#casetitle').textContent=`Storm case study: ${CASE.window_local}`;
 $('#casenote').textContent=`Total precipitation for the ${CASE.name.split(' · ')[0]} storm, from NOAA MRMS radar-and-gauge analysis and each model's run issued before it began (${CASE.fields.slice(1).map(f=>f.label+' '+f.init).join(', ')}). Ensembles show the mean of their ${CASE.fields.filter(f=>f.members>1).map(f=>f.members).join(' and ')} members. Models are on their 0.25° grids; MRMS is shown at 0.05°.`;
 const wall=$('#casewall');if(wall.dataset.id!==CASE.id){wall.dataset.id=CASE.id;wall.innerHTML=CASE.fields.map((f,i)=>`<div class="pan"><h3>${esc(f.label)} <small>${f.kind==='obs'?'· analysis':'· '+esc(f.init)}</small></h3><canvas data-k="${i}"></canvas></div>`).join('');
  wall.querySelectorAll('canvas').forEach(c=>{c.onpointermove=caseHover;c.onpointerleave=hideTip})}
 drawCase();caseTable()}
function drawCase(){if(!CASE||$('#case').hidden||!R||!R.outline)return;const dpr=Math.min(2,devicePixelRatio||1),mr=CASE.fields[0].grid;
 const land=(probe.style.color='var(--land)',getComputedStyle(probe).color),bord=(probe.style.color='var(--border)',getComputedStyle(probe).color),ink=(probe.style.color='var(--ink)',getComputedStyle(probe).color);
 $$('#casewall canvas').forEach(c=>{const f=CASE.fields[+c.dataset.k],W0=c.clientWidth;if(!W0)return;const G=fitProj(R,W0,6);c.style.height=G.H+'px';c.width=W0*dpr;c.height=G.H*dpr;c._G=G;
  const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W0,G.H);
  const outline=new Path2D(G.path(R.outline)),inner=new Path2D(G.path(R.inner)||'');
  ctx.save();ctx.fillStyle=land;ctx.fill(outline);ctx.clip(outline);
  const diff=caseMode==='diff'&&f.kind==='model',g=f.kind==='obs'&&f.fine?f.fine:f.grid,key='c'+W0+R.abbr;if(!g[key])g[key]=corners(g,G.proj);const cc=g[key],nc=g.nlon+1;
  for(let i=0;i<g.nlat;i++)for(let j=0;j<g.nlon;j++){const v=g.a[i*g.nlon+j],col=diff?dcol(v-mr.a[i*g.nlon+j]):pcol(v);if(!col)continue;
   const p=(a,b)=>2*(a*nc+b);ctx.beginPath();ctx.moveTo(cc[p(i,j)],cc[p(i,j)+1]);ctx.lineTo(cc[p(i,j+1)],cc[p(i,j+1)+1]);ctx.lineTo(cc[p(i+1,j+1)],cc[p(i+1,j+1)+1]);ctx.lineTo(cc[p(i+1,j)],cc[p(i+1,j)+1]);ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=.6;ctx.stroke()}
  ctx.restore();ctx.lineWidth=.5;ctx.strokeStyle=bord;ctx.globalAlpha=.7;ctx.stroke(inner);ctx.globalAlpha=.6;ctx.lineWidth=1;ctx.strokeStyle=ink;ctx.stroke(outline);ctx.globalAlpha=1});
 const us=S.units==='us',d=caseMode==='diff';
 const labs=d?DB.map((b,i)=>[i+1,us?(b>0?'+':'')+b:(b>0?'+':'')+Math.round(b*25.4)]):[[0,us?'0.01':'0.25'],[3,us?'0.1':'2.5'],[6,us?'0.25':'6'],[8,us?'0.5':'13'],[12,us?'1':'25'],[16,us?'2':'51'],[20,us?'4':'102'],[22,us?'6':'152'],[23,us?'8':'203']];
 const cols=d?DC.map(c=>c||midColor()):PC;
 $('#casebar').innerHTML=`<div class="sw2">${cols.map(c=>`<i style="background:${c}"></i>`).join('')}</div><div class="lb">${labs.map(([i,t])=>`<span style="left:${i/cols.length*100}%">${t}</span>`).join('')}</div><p class="note" style="margin:6px 0 0">${d?`Forecast minus MRMS on the 0.25° grid, ${us?'inches':'mm'}. Brown: forecast too dry. Teal: too wet. The MRMS panel still shows observed totals.`:`Total precipitation, ${us?'inches':'mm'}.`}</p>`}
function caseHover(e){const c=e.currentTarget,G=c._G;if(!G)return;const g=CASE.fields[0].grid;let best=-1,bd=1e9;
 const key='cent'+c.clientWidth;if(!g[key]){g[key]=[];for(let i=0;i<g.nlat;i++)for(let j=0;j<g.nlon;j++)g[key].push(G.proj([g.lon_w+j*g.d,g.lat_n-i*g.d])||[NaN,NaN])}
 g[key].forEach(([x,y],k)=>{const dd=(x-e.offsetX)**2+(y-e.offsetY)**2;if(dd<bd){bd=dd;best=k}});if(best<0||bd>900)return hideTip();
 if(!caseMask(g)[best])return hideTip();const i=Math.floor(best/g.nlon),j=best%g.nlon,us=S.units==='us',F=v=>Number.isFinite(v)?(us?inch(v).toFixed(2)+' in':v.toFixed(0)+' mm'):'—';
 showTip(`<b>${(g.lat_n-i*g.d).toFixed(2)}°, ${(g.lon_w+j*g.d).toFixed(2)}° (0.25° cell)</b>`+CASE.fields.map(f=>`<div class="k"><span>${esc(f.label.replace(' · NOAA',''))}</span><span>${F(f.grid.a[best])}${f.p1in&&Number.isFinite(f.p1in.a[best])?' · '+Math.round(f.p1in.a[best])+'% ≥1 in':''}</span></div>`).join(''),e.clientX,e.clientY)}
function caseTable(){const o=CASE.fields[0].grid,m=caseMask(o),us=S.units==='us',U=v=>us?inch(v):v,u=us?' in':' mm',dp=us?2:1;
 const idx=[];for(let k=0;k<m.length;k++)if(m[k]&&Number.isFinite(o.a[k]))idx.push(k);
 const stats=f=>{const a=idx.map(k=>f.grid.a[k]),b=idx.map(k=>o.a[k]),ok=a.map((x,i)=>Number.isFinite(x)&&Number.isFinite(b[i]));const A=a.filter((_,i)=>ok[i]),B=b.filter((_,i)=>ok[i]),n=A.length;
  const mean=x=>x.reduce((p,q)=>p+q,0)/x.length,ma=mean(A),mb=mean(B);let cov=0,va=0,vb=0,se=0;for(let i=0;i<n;i++){cov+=(A[i]-ma)*(B[i]-mb);va+=(A[i]-ma)**2;vb+=(B[i]-mb)**2;se+=(A[i]-B[i])**2}
  const csi=t=>{let h=0,mi=0,fa=0;for(let i=0;i<n;i++){const x=A[i]>=t,y=B[i]>=t;if(x&&y)h++;else if(y)mi++;else if(x)fa++}return h+mi+fa?h/(h+mi+fa):NaN};
  return{mean:ma,max:Math.max(...A),bias:ma-mb,rmse:Math.sqrt(se/n),r:va&&vb?cov/Math.sqrt(va*vb):NaN,c1:csi(25.4),c2:csi(50.8)}};
 const rows=CASE.fields.slice(1).map(f=>[f,stats(f)]),ob=stats(CASE.fields[0]);
 const cols=[['mean','Area mean',v=>U(v).toFixed(dp)+u,null],['max','Peak cell',v=>U(v).toFixed(dp)+u,null],['bias','Bias',v=>(v>0?'+':'')+U(v).toFixed(dp)+u,v=>Math.abs(v)],['rmse','RMSE',v=>U(v).toFixed(dp)+u,v=>v],['r','Pattern corr.',v=>Number.isFinite(v)?v.toFixed(2):'—',v=>Number.isFinite(v)?-v:1e9],['c1','CSI ≥ 1 in',v=>Number.isFinite(v)?v.toFixed(2):'—',v=>Number.isFinite(v)?-v:1e9],['c2','CSI ≥ 2 in',v=>Number.isFinite(v)?v.toFixed(2):'—',v=>Number.isFinite(v)?-v:1e9]];
 const bestOf=k=>{const c=cols.find(x=>x[0]===k);if(!c[3])return null;return rows.reduce((a,r)=>c[3](r[1][k])<c[3](a[1][k])?r:a)[0]};
 $('#casetnote').textContent=`Scored on the 0.25° grid over the ${idx.length} cells whose centres fall inside ${R.name}, against MRMS averaged to the same cells. Bold marks the best model in each column. CSI counts cells where the forecast and MRMS agree on totals of at least 1 or 2 inches.`;
 $('#casetbl').innerHTML=`<thead><tr><th></th>${cols.map(c=>`<th>${c[1]}</th>`).join('')}</tr></thead><tbody><tr class="baserow"><td>MRMS (observed)</td><td>${cols[0][2](ob.mean)}</td><td>${cols[1][2](ob.max)}</td><td colspan="5"></td></tr>${rows.map(([f,st])=>`<tr><td>${esc(f.label)}</td>${cols.map(c=>`<td class="${bestOf(c[0])===f?'best':''}">${c[2](st[c[0]])}</td>`).join('')}</tr>`).join('')}</tbody>`;
 const gc=CASE.gauge_check;$('#casegauge').textContent=gc?`Check on MRMS: at ${gc.n} ${R.name} ASOS stations, its storm totals correlate ${gc.r} with the airport rain gauges (station average ${us?inch(gc.mean_gauge).toFixed(2)+' in':gc.mean_gauge+' mm'} gauged vs ${us?inch(gc.mean_mrms).toFixed(2)+' in':gc.mean_mrms+' mm'} MRMS).`:''}
function renderFocus(){const f=$('#focus');if(S.station){const st=STI[S.station];f.innerHTML=`<b>${esc(stName(S.station))}</b><div class="note">${esc(st?st.county+' County · '+st.lat.toFixed(2)+'°, '+st.lon.toFixed(2)+'°':'')}</div><div class="note">The scorecard and charts below show this station only.</div><button id="unfocus">Back to the ${esc(REG[S.region].name)} average</button>`;$('#unfocus').onclick=()=>{S.station=null;renderAll()}}
 else f.innerHTML=`<div class="note">${R&&R.conus?'Scores are averages over every scored ASOS station in each state.':hasSt()?`The scorecard shows the average over all ${esc(REG[S.region].name)} stations. Click a station to see it alone.`:'Scores are averages over this state\'s scored ASOS stations.'}</div>`}
function renderStrip(){const host=$('#stripfig');let units=[],label;
 if(R&&R.conus){units=Object.keys(STATES).filter(a=>a!=='US').map(a=>({id:a,name:a,obj:STATES[a],kind:'state',abbr:a}));label='state'}
 else if(hasSt()){const g=curGroup();units=Object.keys(NC).filter(id=>!g||g.ids.includes(id)).map(id=>({id,name:stName(id),obj:NC[id],kind:'station'}));label='station'}
 $('#striptitle').textContent=label==='state'?'State by state':'Station by station';
 if(!units.length){host.style.display='none';$('#stripnote').textContent=hasSt()?'Station scores outside North Carolina cover the last 30, 90 and 180 days. Pick one of those windows to see every station.':'Station scores for this state did not load.';$('#tbl').innerHTML='';$('#tblsum').style.display='none';return}
 host.style.display='';$('#tblsum').style.display='';
 const ms=MS.filter(m=>S.shown.has(m.id));const rows=ms.map(m=>({m,pts:units.map(u=>({u,v:covers(m.id,u)&&series(u.obj,m.id)?series(u.obj,m.id)[S.lead]:NaN})).filter(p=>Number.isFinite(p.v))})).filter(r=>r.pts.length);
 $('#stripnote').textContent=`Each dot is one ${label}'s ${MET[S.m].l}${unit()} at day ${S.lead}. A tight row means the model is consistent across the ${label==='state'?'country':'state'}. Hover a dot to find that ${label} in every row.`;
 if(!rows.length){host.style.display='none';$('#tblsum').style.display='none';$('#stripnote').textContent=label==='station'&&!S.station?'Station scores outside North Carolina cover the last 30, 90 and 180 days. Pick one of those windows to see every station.':'No scores for the models shown at this lead day.';return}
 host._rows=rows;host._label=label;drawStrip(host);
 $('#tblsum').textContent=`Table view: every ${label} at day ${S.lead}`;
 $('#tbl').innerHTML=`<thead><tr><th>${label==='state'?'State':'Station'}</th>${rows.map(r=>`<th>${esc(r.m.s)}</th>`).join('')}</tr></thead><tbody>${units.map(u=>`<tr><td>${esc(u.name)}</td>${rows.map(r=>{const p=r.pts.find(q=>q.u===u);return`<td>${p?fmt(p.v):'—'}</td>`}).join('')}</tr>`).join('')}</tbody>`}
function drawStrip(host){const rows=host._rows||[],svg=host.querySelector('svg'),W0=host.clientWidth;if(!W0)return;const sm=W0<560,lw=sm?92:150,m={l:lw,r:16,t:8,b:30},rh=Math.max(26,Math.min(34,(Math.max(300,rows.length*30))/Math.max(1,rows.length)));
 const H0=m.t+m.b+rows.length*rh;host.style.minHeight=H0+'px';const all=rows.flatMap(r=>r.pts.map(p=>p.v));if(!all.length){svg.innerHTML='';return}
 let lo=Math.min(...all),hi=Math.max(...all);const c=MET[S.m];if(c.b!=='target'&&lo>0)lo=0;const tk=nice(lo,hi,sm?3:6);lo=tk[0];hi=tk[tk.length-1];
 const X=v=>m.l+(v-lo)/(hi-lo)*(W0-m.l-m.r);let h=tk.map(t=>`<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${H0-m.b}" stroke="var(--line)"/><text x="${X(t)}" y="${H0-10}" text-anchor="middle" font-size="12" fill="var(--mute)">${+t.toFixed(3)}</text>`).join('');
 if(c.b==='target')h+=`<line x1="${X(c.r)}" x2="${X(c.r)}" y1="${m.t}" y2="${H0-m.b}" stroke="var(--mute)" stroke-width="1.5"/>`;
 rows.forEach((r,i)=>{const y=m.t+i*rh+rh/2;h+=`<text x="${m.l-10}" y="${y+4}" text-anchor="end" font-size="13" fill="var(--ink)">${esc(sm?r.m.s.replace(' (mean)',''):r.m.s)}</text>`;
  const sorted=[...r.pts].sort((a,b)=>a.v-b.v);const med=sorted[Math.floor(sorted.length/2)].v;
  h+=`<line x1="${X(sorted[0].v)}" x2="${X(sorted[sorted.length-1].v)}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="2"/>`;
  h+=r.pts.map(p=>`<circle data-u="${esc(p.u.id)}" cx="${X(p.v).toFixed(1)}" cy="${y}" r="${S.hover===p.u.id||S.station===p.u.id?6:4}" fill="var(${r.m.c})" stroke="${S.hover===p.u.id||S.station===p.u.id?'var(--ink)':'var(--bg)'}" stroke-width="${S.hover===p.u.id||S.station===p.u.id?2.5:1.5}" opacity="${S.hover&&S.hover!==p.u.id?.35:.9}"/>`).join('');
  h+=`<line x1="${X(med)}" x2="${X(med)}" y1="${y-rh*.36}" y2="${y+rh*.36}" stroke="var(--ink)" stroke-width="2"/>`});
 svg.setAttribute('viewBox',`0 0 ${W0} ${H0}`);svg.innerHTML=h;
 svg.querySelectorAll('circle').forEach(el=>{el.onpointermove=e=>{const id=el.dataset.u;if(S.hover!==id){S.hover=id;drawStrip(host);markMap()}
   const rowsAt=rows.map(r=>[r.m,(r.pts.find(p=>p.u.id===id)||{}).v]).filter(q=>Number.isFinite(q[1])).sort((a,b)=>dist(a[1])-dist(b[1]));
   showTip(`<b>${esc(host._label==='state'?id:stName(id))}</b>`+rowsAt.map(([mm,v])=>`<div class="k"><span>${esc(mm.s)}</span><span>${fmt(v)}</span></div>`).join(''),e.clientX,e.clientY)};
  el.onpointerleave=()=>{S.hover=null;hideTip();drawStrip(host);markMap()};
  el.onclick=()=>{const id=el.dataset.u;if(host._label==='state'){if(REG[id.toLowerCase()])setRegion(id.toLowerCase())}else{S.station=S.station===id?null:id;renderAll()}}})}
function markMap(){$$('#map circle').forEach(c=>{const on=c.dataset.id===S.hover||c.dataset.id===S.station;c.classList.toggle('on',on);c.setAttribute('r',on?8:6)})}
function nice(lo,hi,n){const span=hi-lo||1,raw=span/n,p=10**Math.floor(Math.log10(raw)),st=[1,2,2.5,5,10].map(x=>x*p).find(x=>x>=raw);const t=[];for(let v=Math.floor(lo/st)*st;v<=hi+st*1e-6;v+=st)t.push(+v.toFixed(6));if(t[t.length-1]<hi)t.push(t[t.length-1]+st);return t}
function lineChart(host,cfg){host._c=cfg;if(!host._ro){host._ro=new ResizeObserver(()=>drawLine(host));host._ro.observe(host)}drawLine(host)}
function drawLine(host){const c=host._c,svg=host.querySelector('svg');if(!c)return;const W0=host.clientWidth,H0=host.clientHeight;if(!W0)return;
 const sm=W0<520,m={l:sm?40:52,r:14,t:12,b:30},pw=W0-m.l-m.r,ph=H0-m.t-m.b,all=c.series.flatMap(s=>s.vals).filter(Number.isFinite);if(c.ref!=null)all.push(c.ref);
 if(!all.length){svg.innerHTML='';return}let lo=Math.min(...all),hi=Math.max(...all);if(c.lo0&&lo>0)lo=0;const tk=nice(lo,hi,sm?3:5);lo=tk[0];hi=tk[tk.length-1];
 const n=c.x.length,X=i=>m.l+i*pw/(n-1),Y=v=>m.t+ph-(v-lo)/(hi-lo)*ph;
 let h=c.cur!=null?`<rect x="${X(c.cur)-10}" y="${m.t}" width="20" height="${ph}" fill="var(--panel)"/>`:'';
 h+=tk.map(t=>`<line x1="${m.l}" x2="${W0-m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${m.l-6}" y="${Y(t)+4}" text-anchor="end" font-size="12" fill="var(--mute)">${+t.toFixed(3)}</text>`).join('');
 if(c.ref!=null)h+=`<line x1="${m.l}" x2="${W0-m.r}" y1="${Y(c.ref)}" y2="${Y(c.ref)}" stroke="var(--mute)" stroke-width="1.5"/>`;
 h+=c.x.map((x,i)=>(sm&&i%2)?'':`<text x="${X(i)}" y="${H0-8}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}" font-size="12" fill="var(--mute)">${esc(sm?x.replace('Day ',''):x)}</text>`).join('');
 for(const s of c.series){let d='',on=false;s.vals.forEach((v,i)=>{if(Number.isFinite(v)){d+=(on?'L':'M')+X(i)+' '+Y(v);on=true}else on=false});
  const solo=s.vals.filter(Number.isFinite).length===1,i1=s.vals.findIndex(Number.isFinite);
  h+=solo?`<circle cx="${X(i1)}" cy="${Y(s.vals[i1])}" r="4" fill="var(${s.c})"/>`:`<path d="${d}" fill="none" stroke="var(${s.c})" stroke-width="2" stroke-dasharray="${s.d}" stroke-linejoin="round" stroke-linecap="${s.d?'butt':'round'}"/>`}
 h+=`<line class="xh" y1="${m.t}" y2="${m.t+ph}" stroke="var(--ink)" opacity="0"/><g class="dots"></g><rect class="hit" x="${m.l-12}" y="0" width="${pw+24}" height="${H0}" fill="transparent" style="cursor:pointer"/>`;
 svg.setAttribute('viewBox',`0 0 ${W0} ${H0}`);svg.innerHTML=h;
 const hit=svg.querySelector('.hit'),xh=svg.querySelector('.xh'),dots=svg.querySelector('.dots');
 const idx=e=>{const r=svg.getBoundingClientRect();return Math.max(0,Math.min(n-1,Math.round((e.clientX-r.left-m.l)/pw*(n-1))))};
 hit.onpointermove=e=>{const i=idx(e);xh.setAttribute('x1',X(i));xh.setAttribute('x2',X(i));xh.setAttribute('opacity',.4);
  dots.innerHTML=c.series.map(s=>Number.isFinite(s.vals[i])?`<circle cx="${X(i)}" cy="${Y(s.vals[i])}" r="4.5" fill="var(${s.c})" stroke="var(--bg)" stroke-width="2"/>`:'').join('');
  const F=c.fmt||fmt,Dd=c.asc?(v=>v):c.desc?(v=>-v):dist,rows=c.series.map(s=>[s.name,s.vals[i]]).filter(r=>Number.isFinite(r[1])).sort((a,b)=>Dd(a[1])-Dd(b[1]));
  showTip(`<b>${esc(c.x[i])}, best first</b>`+(rows.length?rows.map(([a,v])=>`<div class="k"><span>${esc(a)}</span><span>${esc(F(v))}</span></div>`).join(''):'<div>No scores</div>'),e.clientX,e.clientY)};
 hit.onpointerleave=()=>{xh.setAttribute('opacity',0);dots.innerHTML='';hideTip()};hit.onclick=e=>c.pick&&c.pick(idx(e))}

/* ---------- share links and downloads ---------- */
function readURL(){const q=new URLSearchParams(location.search),h=location.hash.slice(1);let d=(q.get('d')||h||'').toLowerCase();if(d==='conus')d='us';
 if(REG[d])S.region=d;const v=q.get('v');if(v)S.v=v==='p'?'precipitation_surface':'temperature_2m';
 const m=q.get('m');if(m&&VM.some(([x,y])=>x===S.v&&y===m))S.m=m;else if(!VM.some(([x,y])=>x===S.v&&y===S.m))S.m=S.v==='temperature_2m'?'RMSE':'ETS';
 const w=+q.get('w');if(W.includes(w))S.w=w;const l=q.get('l');if(l!==null&&L.includes(+l))S.lead=+l;if(q.get('u')==='us')S.units='us';
 const mm=q.get('mm');if(mm&&(mm==='__best'||MSI[mm]))S.mapModel=mm;const ref=q.get('ref');if(ref&&MSI[ref])S.ref=ref;if(q.get('g'))S.group=q.get('g');S._st=q.get('st')}
function writeURL(){try{const q=new URLSearchParams();q.set('d',S.region);q.set('v',S.v==='precipitation_surface'?'p':'t');q.set('m',S.m);q.set('w',S.w);q.set('l',S.lead);
 if(S.units!=='si')q.set('u',S.units);if(S.mapModel!=='NOAA GFS')q.set('mm',S.mapModel);if(S.ref!=='NOAA GFS')q.set('ref',S.ref);if(S.group!=='all')q.set('g',S.group);if(S.station)q.set('st',S.station);
 const u='?'+q.toString();if(location.search!==u)history.replaceState(null,'',u)}catch(e){}}
function scorecardCSV(){const sc=scope(),ms=models(sc),rows=[['model',...L.map(d=>'day '+d)]];for(const m of ms){rows.push([m.s,...series(sc.obj,m.id).map(v=>Number.isFinite(v)?+v.toFixed(4):'')])}
 const head=`# ${MET[S.m].l}${unit()} · ${VARL[S.v]} · ${sc.name} · last ${S.w} days through ${META.period_end} · source: dynamical.org scorecard (CC BY-NC-SA 4.0) and bench.wall.cloud baselines\n`;
 return head+rows.map(r=>r.map(x=>/[",\n]/.test(String(x))?`"${String(x).replace(/"/g,'""')}"`:x).join(',')).join('\n')}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

function viewSummary(){const r=REG[S.region];$('#viewsum').textContent=[r?(r.conus?'United States':r.name):'',S.v==='temperature_2m'?'temperature':'precipitation',MET[S.m].l,`last ${S.w} days`,`day ${S.lead}`].join(', ')}
/* ---------- controls ---------- */
function renderAll(){if(!META)return;fillGroups();renderGuide();renderHead();drawMap();renderFocus();renderScores();renderStrip();renderDeep();renderCase();writeURL();viewSummary()}
function setLead(i){S.lead=i;$$('#lead button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.i===i));renderAll()}
function fillMetric(){const have=new Set(VM.filter(([v])=>v===S.v).map(([,m])=>m)),g=GUIDE[S.v].filter(x=>have.has(x[0]));if(!have.has(S.m))S.m=g[0][0];
 const opt=x=>`<option value="${x[0]}"${x[0]===S.m?' selected':''}>${esc(MET[x[0]].l)} · ${esc(x[2])}</option>`;
 $('#metric').innerHTML=`<optgroup label="Recommended">${g.filter(x=>x[1]===1).map(opt).join('')}</optgroup><optgroup label="For specific questions">${g.filter(x=>x[1]===2).map(opt).join('')}</optgroup>`}
function renderGuide(){const g=gfor(S.v,S.m);$('#mhelp').innerHTML=g?`<b>${esc(MET[S.m].l)}:</b> ${esc(g[3])} ${esc(g[4])} <button class="lnk" id="tog">How to choose a score</button>`:'';
 const t=$('#tog');if(t)t.onclick=()=>$('#scores').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 $('#guidetitle').textContent=`Choosing a ${VARL[S.v]} score`;
 const card=x=>`<button class="gc${x[0]===S.m?' on':''}" data-m="${x[0]}" aria-pressed="${x[0]===S.m}"><b>${esc(MET[x[0]].l)}</b><span class="tag">${x[1]===1?'Recommended':'Situational'}</span><span class="q">${esc(x[2])}</span><span>${esc(x[3])}</span><span class="r">${esc(x[4])}</span><span class="u">${esc(x[5])}</span></button>`;
 $('#guide').innerHTML=GUIDE[S.v].map(card).join('');
 $('#guide').onclick=e=>{const b=e.target.closest('button.gc');if(!b)return;S.m=b.dataset.m;fillMetric();renderAll()}}
function fillMapModel(){$('#mapmodel').innerHTML=`<option value="__best"${S.mapModel==='__best'?' selected':''}>Best model at each ${'location'}</option><optgroup label="One model">`+MS.map(m=>`<option value="${esc(m.id)}"${m.id===S.mapModel?' selected':''}>${esc(m.s)}</option>`).join('')+'</optgroup>'}
function bestAt(obj,scp){let b=null,bv=Infinity;for(const m of MS){if(m.base||!S.shown.has(m.id)||!covers(m.id,scp))continue;const se=series(obj,m.id);const v=se?dist(se[S.lead]):Infinity;if(v<bv){bv=v;b=m}}return b}
async function setRegion(id,keepStation){const reg=REG[id]||REG.us;S.region=reg.id;if(!keepStation)S.station=null;$('#region').value=reg.id;
 $('#map').innerHTML='<p class="msg">Loading the map…</p>';
 NC={};const stp=reg.conus?Promise.resolve({}):loadStations(reg.abbr).catch(()=>({}));
 try{await loadTopo();const st=await stp;if(S.region!==reg.id)return;NC=st;R=prep(reg)}catch(err){NC=await stp;R={...reg,feats:[],stations:[]}}
 if(S.station&&!NC[S.station])S.station=null;
 renderAll()}
function wire(){
 for(const k of Object.keys(REG))if(!REG[k].conus&&!STATES[REG[k].abbr])delete REG[k];
 $('#region').innerHTML=`<option value="us">United States (state averages)</option><optgroup label="States (station detail)">${Object.values(REG).filter(r=>!r.conus).sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</optgroup>`;
 $$('#var button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===S.v));$$('#units button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.u===S.units));
 $('#win').innerHTML=W.map(w=>`<button data-w="${w}" aria-pressed="${w===S.w}">${w}d</button>`).join('');
 $('#lead').innerHTML=L.map(d=>`<button data-i="${d}" aria-pressed="${d===S.lead}">${d}</button>`).join('');
 $('#chips').innerHTML=MS.map(m=>`<button class="chip" data-id="${esc(m.id)}" aria-pressed="${S.shown.has(m.id)}">${swatch(m)}${esc(m.s)}</button>`).join('');
 fillMetric();fillMapModel();
 $('#var').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.v=b.dataset.v;$$('#var button').forEach(x=>x.setAttribute('aria-pressed',x===b));if(S.v==='precipitation_surface'&&S.m==='RMSE')S.m='ETS';fillMetric();renderAll()};
 $('#metric').onchange=e=>{S.m=e.target.value;renderAll()};
 $('#win').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.w=+b.dataset.w;$$('#win button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderAll()};
 $('#lead').onclick=e=>{const b=e.target.closest('button');if(b)setLead(+b.dataset.i)};
 $('#units').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.units=b.dataset.u;$$('#units button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderAll()};
 $('#chips').onclick=e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.id;S.shown.has(id)?S.shown.delete(id):S.shown.add(id);b.setAttribute('aria-pressed',S.shown.has(id));renderAll()};
 $('#mapmodel').onchange=e=>{S.mapModel=e.target.value;drawMap();writeURL()};
 $('#casepick').onchange=async e=>{CASE=await loadCase(e.target.value);$('#casewall').dataset.id='';renderCase()};
 $('#share').onclick=async()=>{writeURL();const b=$('#share');try{await navigator.clipboard.writeText(location.href);b.textContent='Link copied'}catch(e){b.textContent='Copy the address bar'}setTimeout(()=>b.textContent='Copy link',2000)};
 $('#csv').onclick=()=>download(`bench-${S.region}-${S.v==='temperature_2m'?'t2m':'precip'}-${S.m}-${S.w}d.csv`,scorecardCSV());
 $('#ref').onchange=e=>{S.ref=e.target.value;renderScores();renderDeep();writeURL()};
 $('#viewbtn').onclick=()=>{const b=$('#bar'),o=!b.classList.contains('open');b.classList.toggle('open',o);$('#viewbtn').setAttribute('aria-expanded',o);$('.vb2').textContent=o?'Done':'Change'};
 $('#casemode').onclick=e=>{const b=e.target.closest('button');if(!b)return;caseMode=b.dataset.c;$$('#casemode button').forEach(x=>x.setAttribute('aria-pressed',x===b));drawCase()};
 $('#scmode').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.scmode=b.dataset.s;$$('#scmode button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderScores()};
 $('#group').onchange=e=>{S.group=e.target.value;S.station=null;renderAll()};
 $('#lmode').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.lmode=b.dataset.l;$$('#lmode button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderScores()};
 $('#region').onchange=e=>setRegion(e.target.value);
 $('#sc').onclick=e=>{const t=e.target.closest('td.v');if(t)setLead(+t.dataset.i)};
 $('#sc').onkeydown=e=>{const t=e.target.closest('td.v');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setLead(+t.dataset.i)}};
 const fmtD=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
 $('#notes').innerHTML=[
  `Model scores come from the <a href="https://dynamical.org/scorecard/">dynamical.org forecast scorecard</a>, rebuilt ${esc(fmtD(META.period_end))}. They cover forecasts verified through that date; the longest window starts ${esc(fmtD(META.period_start_max||META.period_start_180||META.period_end))}. dynamical.org publishes them under CC BY-NC-SA 4.0, and the derived scores on this site carry the same license.`,
  'Truth is hourly ASOS airport observations from the Iowa Environmental Mesonet. Each station is matched to the nearest forecast grid point. Lead day 0 covers hours 0–23 after the forecast run, day 1 hours 24–47, and so on.',
  'For precipitation, forecasts and observations are first averaged to 6-hour rates, shown here per day. A "wet" period is a 6-hour mean rate of 0.1 mm/h or more; ETS, HSS, frequency bias and FSS count wet and dry periods.',
  'Ensembles (GEFS, IFS ENS, AIFS ENS, RRFS ENS, REFS) are scored on their ensemble mean, except CRPS, which uses every member. Bias-corrected variants remove each station\'s 180-day mean error for that model.',
  'Short-range models stop early because dynamical.org only scores lead days a model covers completely: HRRR and HRDPS (48 h) through day 1, RRFS ENS and REFS (60 h) through day 1, RRFS (84 h) through day 2.',
  'State and U.S. numbers are plain averages over stations, as on dynamical.org. HRDPS is hidden from state averages outside the states its domain fully covers.',
  'Scorecard shading uses a paired test: for each station (or each state, for the U.S.) it takes the model\'s score minus the reference model\'s, and shades the cell only if the average gap is more than twice its standard error. Nearby stations share weather, so treat this as a guide rather than a strict 95% test.',
  'Climatology and persistence are reference forecasts this site scores itself from the same ASOS observations (dynamical.org\'s archive on Source Cooperative), with the same hourly binning, 6-hour precipitation averages and windows. Climatology is the average of the last 10 complete years at that hour within 15 days of the date, given only where at least 10 such observations exist (CRPS uses them all as an ensemble). Persistence repeats the observation from the same hour on the last full day before the forecast was issued.',
  'Skill vs climatology is 1 − MSE ÷ climatology MSE for RMSE, and 1 − score ÷ climatology score for MAE and CRPS. ETS and HSS are already skill scores against chance.',
  'Terrain groups split a state\'s stations by elevation: North Carolina by its physiographic regions (Coastal Plain below 90 m, Piedmont 90–450 m, Mountains above 450 m), other states into thirds.',
  'Storm case studies read gridded MRMS, GFS, GEFS, IFS ENS and AIFS Single precipitation directly from dynamical.org\'s Zarr stores on Source Cooperative. Ensemble panels are member means; scores use 0.25° cells inside the state. ECMWF data are CC BY 4.0; NOAA data are public domain.',
  'Everything is rebuilt every morning after dynamical.org\'s daily update. Boundaries are U.S. Census cartographic files via us-atlas (ISC); maps are drawn with d3-geo and topojson-client (ISC).'].map(t=>`<li>${t}</li>`).join('')}
let raf=0;const ro=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{drawMap();const h=$('#stripfig');if(h._rows)drawStrip(h)})});ro.observe($('#map'));ro.observe($('#stripfig'));const ro2=new ResizeObserver(()=>requestAnimationFrame(drawCase));ro2.observe($('#casewall'));
const redraw=()=>renderAll();new MutationObserver(redraw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',redraw);
addEventListener('hashchange',()=>{const h=location.hash.slice(1).toLowerCase();if(REG[h]&&h!==S.region)setRegion(h)});
Promise.all(['meta','states'].map(n=>fetch(`data/${n}.json`).then(r=>{if(!r.ok)throw new Error(n);return r.json()}))).then(([m,s])=>{META=m;STATES=s;VM=m.vm;W=m.windows;L=m.leads;for(const st of m.stations)STI[st.id]=st;
 readURL();wire();const fd=new Date(m.period_end+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
 $('#fresh').textContent=`Verified through ${fd}`;
 if(S._st)S.station=S._st;setRegion(S.region,!!S._st)}).catch(()=>{$('#title').textContent='The score files did not load';$('#subtitle').textContent='Reload the page to try again.'});
}
