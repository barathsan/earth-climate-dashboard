/* Earth Climate Dashboard – NASA POWER monthly data + simple trend estimate */
const $ = id => document.getElementById(id);
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const charts = {};
let D = null; // {labels, years, months, T2M, RAIN, RH2M, WS2M}

Chart.defaults.color = '#93a9b0';
Chart.defaults.borderColor = '#27404c';

const mean = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((s,x)=>s+x,0)/v.length : null; };
const daysIn = (y,m) => new Date(y, m, 0).getDate();
const fmt = (x,d=1) => x == null ? '–' : x.toFixed(d);
const sign = (x,d=1) => x == null ? '–' : (x>0?'+':'') + x.toFixed(d);

function mk(id, cfg){
  if (charts[id]) charts[id].destroy();
  cfg.options = Object.assign({responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}}, cfg.options||{});
  charts[id] = new Chart($(id), cfg);
}

function setStatus(msg, err){ const s=$('status'); s.textContent=msg; s.className = err ? 'err' : ''; }

async function load(lat, lon){
  setStatus('Fetching NASA POWER data…');
  const end = new Date().getFullYear(), start = end - 30;
  const url = 'https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR,RH2M,WS2M'
    + `&community=RE&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error('NASA POWER returned status ' + r.status);
    const j = await r.json();
    const p = j.properties.parameter;
    const keys = Object.keys(p.T2M).filter(k => +k.slice(4) >= 1 && +k.slice(4) <= 12).sort();
    const clean = v => (v == null || v <= -990) ? null : v;
    const d = {labels:[], years:[], months:[], T2M:[], RAIN:[], RH2M:[], WS2M:[]};
    keys.forEach(k => {
      const y = +k.slice(0,4), m = +k.slice(4);
      d.labels.push(`${y}-${String(m).padStart(2,'0')}`); d.years.push(y); d.months.push(m);
      d.T2M.push(clean(p.T2M[k]));
      const pr = clean(p.PRECTOTCORR[k]); d.RAIN.push(pr == null ? null : pr * daysIn(y,m));
      d.RH2M.push(clean(p.RH2M[k])); d.WS2M.push(clean(p.WS2M[k]));
    });
    let last = d.T2M.length - 1;
    while(last >= 0 && d.T2M[last] == null) last--;
    if(last < 24) throw new Error('Not enough data returned for this location.');
    Object.keys(d).forEach(k => d[k] = d[k].slice(0, last+1));
    D = d;
    setStatus(`Loaded ${d.labels[0]} to ${d.labels[last]} for ${(+lat).toFixed(2)}°, ${(+lon).toFixed(2)}°.`);
    render();
  }catch(e){
    setStatus('Could not load data: ' + e.message + ' Check the coordinates and your connection, then try again.', true);
  }
}

function rolling(a, n=12){
  return a.map((_,i) => i < n-1 ? null : mean(a.slice(i-n+1, i+1)));
}

function render(){
  kpis(); tempChart(); rainChart(); atmChart(); compare(); projection();
}

function kpis(){
  const n = D.labels.length, ly = D.years[n-1];
  const lastYear = D.years.map((y,i)=>y===ly?i:-1).filter(i=>i>=0);
  const t = mean(lastYear.map(i=>D.T2M[i]));
  const rain = D.RAIN.slice(n-12).reduce((s,x)=>s+(x||0),0);
  const items = [
    [fmt(D.T2M[n-1])+' °C', 'Temperature, '+D.labels[n-1]],
    [fmt(t)+' °C', 'Average so far in '+ly],
    [fmt(rain,0)+' mm', 'Rainfall, last 12 months'],
    [fmt(D.RH2M[n-1],0)+' %  ·  '+fmt(D.WS2M[n-1])+' m/s', 'Humidity and wind, '+D.labels[n-1]]
  ];
  $('kpis').innerHTML = items.map(([a,b]) => `<div class="kpi"><b>${a}</b><span>${b}</span></div>`).join('');
}

function tempChart(){
  mk('cTemp', {type:'line', data:{labels:D.labels, datasets:[
    {label:'Monthly °C', data:D.T2M, borderColor:'#f2b84b', borderWidth:1.2, pointRadius:0, tension:.25},
    {label:'12-month average', data:rolling(D.T2M), borderColor:'#ff6f59', borderWidth:2.5, pointRadius:0, tension:.25}
  ]}, options:{scales:{x:{ticks:{maxTicksLimit:10}}, y:{title:{display:true,text:'°C'}}}}});
}

function rainChart(){
  mk('cRain', {type:'bar', data:{labels:D.labels, datasets:[
    {label:'Rainfall (mm)', data:D.RAIN, backgroundColor:'#4aa3df'}
  ]}, options:{scales:{x:{ticks:{maxTicksLimit:10}}, y:{title:{display:true,text:'mm per month'}}}}});
}

function atmChart(){
  mk('cAtm', {type:'line', data:{labels:D.labels, datasets:[
    {label:'Humidity (%)', data:D.RH2M, borderColor:'#7fd1c7', borderWidth:1.5, pointRadius:0, yAxisID:'y'},
    {label:'Wind (m/s)', data:D.WS2M, borderColor:'#c9a0ff', borderWidth:1.5, pointRadius:0, yAxisID:'y2'}
  ]}, options:{scales:{x:{ticks:{maxTicksLimit:10}},
    y:{position:'left', title:{display:true,text:'%'}},
    y2:{position:'right', grid:{drawOnChartArea:false}, title:{display:true,text:'m/s'}}}}});
}

function climatology(arr, y0, y1){
  return MN.map((_,mi) => mean(arr.filter((_,i)=>D.months[i]===mi+1 && D.years[i]>=y0 && D.years[i]<=y1)));
}

function slopePerDecade(arr){
  // regression on annual means of complete years
  const ys = [...new Set(D.years)], pts = [];
  ys.forEach(y => {
    const v = arr.filter((_,i)=>D.years[i]===y);
    if(v.length===12 && v.every(x=>x!=null)) pts.push([y, mean(v)]);
  });
  if(pts.length < 8) return null;
  const mx = mean(pts.map(p=>p[0])), my = mean(pts.map(p=>p[1]));
  const num = pts.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0), den = pts.reduce((s,p)=>s+(p[0]-mx)**2,0);
  return num/den*10;
}

function compare(){
  const ly = D.years[D.years.length-1], fy = D.years[0];
  const b0=fy, b1=fy+9, r0=ly-9, r1=ly;
  $('cmpSub').textContent = `Average of ${b0}–${b1} compared with ${r0}–${r1}.`;
  const base = {}, rec = {};
  ['T2M','RAIN','RH2M','WS2M'].forEach(k => { base[k]=climatology(D[k],b0,b1); rec[k]=climatology(D[k],r0,r1); });
  const ann = (c,k) => k==='RAIN' ? c[k].reduce((s,x)=>s+(x||0),0) : mean(c[k]);
  const dT = ann(rec,'T2M') - ann(base,'T2M');
  const rb = ann(base,'RAIN'), rr = ann(rec,'RAIN');
  const stats = [
    [sign(dT,2)+' °C', 'Temperature change'],
    [sign(slopePerDecade(D.T2M),2)+' °C', 'Temperature trend per decade'],
    [rb ? sign((rr-rb)/rb*100,0)+' %' : '–', 'Annual rainfall change'],
    [sign(ann(rec,'RH2M')-ann(base,'RH2M'),1)+' pts', 'Humidity change'],
    [sign(ann(rec,'WS2M')-ann(base,'WS2M'),2)+' m/s', 'Wind speed change']
  ];
  $('cmpStats').innerHTML = stats.map(([a,b])=>`<div><b>${a}</b><span>${b}</span></div>`).join('');
  mk('cCmp', {type:'line', data:{labels:MN, datasets:[
    {label:`Temperature ${b0}–${b1}`, data:base.T2M, borderColor:'#7fd1c7', borderWidth:2.5, tension:.3},
    {label:`Temperature ${r0}–${r1}`, data:rec.T2M, borderColor:'#ff6f59', borderWidth:2.5, tension:.3}
  ]}, options:{scales:{y:{title:{display:true,text:'°C'}}}}});
}

/* Seasonal average + linear trend on deseasonalised values; band = ±1.96 × residual std */
function estimate(arr, horizon=24){
  const clim = climatology(arr, 0, 9999);
  const idx = [], anom = [];
  arr.forEach((v,i) => { if(v!=null){ idx.push(i); anom.push(v - clim[D.months[i]-1]); } });
  const mx = mean(idx), my = mean(anom);
  const slope = idx.reduce((s,x,k)=>s+(x-mx)*(anom[k]-my),0) / idx.reduce((s,x)=>s+(x-mx)**2,0);
  const icpt = my - slope*mx;
  const res = anom.map((a,k)=>a-(icpt+slope*idx[k]));
  const sd = Math.sqrt(res.reduce((s,r)=>s+r*r,0)/(res.length-1));
  const n = arr.length, out = [];
  let y = D.years[n-1], m = D.months[n-1];
  for(let h=1; h<=horizon; h++){
    m++; if(m>12){ m=1; y++; }
    const mid = clim[m-1] + icpt + slope*(n-1+h);
    out.push({label:`${y}-${String(m).padStart(2,'0')}`, mid, lo:mid-1.96*sd, hi:mid+1.96*sd});
  }
  return out;
}

function projection(){
  const k = $('projVar').value, nHist = 60;
  const unit = {T2M:'°C', RAIN:'mm/month', RH2M:'%', WS2M:'m/s'}[k];
  const est = estimate(D[k]);
  const clampLo = k==='T2M' ? x=>x : x=>Math.max(0,x);
  const hist = D[k].slice(-nHist), hl = D.labels.slice(-nHist);
  const pad = Array(nHist-1).fill(null);
  const labels = hl.concat(est.map(e=>e.label));
  const lastV = hist[hist.length-1];
  mk('cProj', {type:'line', data:{labels, datasets:[
    {label:'Observed', data:hist.concat(Array(est.length).fill(null)), borderColor:'#f2b84b', borderWidth:2, pointRadius:0, tension:.25},
    {label:'Estimate', data:pad.concat([lastV]).concat(est.map(e=>clampLo(e.mid))), borderColor:'#ff6f59', borderDash:[6,4], borderWidth:2.5, pointRadius:0, tension:.25},
    {label:'Upper range', data:pad.concat([lastV]).concat(est.map(e=>e.hi)), borderColor:'transparent', backgroundColor:'rgba(255,111,89,.15)', pointRadius:0, fill:'+1'},
    {label:'Lower range', data:pad.concat([lastV]).concat(est.map(e=>clampLo(e.lo))), borderColor:'transparent', pointRadius:0, fill:false}
  ]}, options:{scales:{x:{ticks:{maxTicksLimit:10}}, y:{title:{display:true,text:unit}}}}});
}

$('preset').addEventListener('change', e => {
  if(e.target.value !== 'custom'){
    const [a,b] = e.target.value.split(',');
    $('lat').value = a; $('lon').value = b;
  }
});
['lat','lon'].forEach(id => $(id).addEventListener('input', () => $('preset').value='custom'));
$('locForm').addEventListener('submit', e => {
  e.preventDefault();
  const lat = parseFloat($('lat').value), lon = parseFloat($('lon').value);
  if(isNaN(lat) || isNaN(lon) || Math.abs(lat)>90 || Math.abs(lon)>180){ setStatus('Enter a latitude from -90 to 90 and a longitude from -180 to 180.', true); return; }
  load(lat, lon);
});
$('projVar').addEventListener('change', () => D && projection());

load(13.0827, 80.2707);
