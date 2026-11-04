window.NOC=window.NOC||{};
NOC.DashboardInteractivo=(()=>{
 const metrics=[['facturado','Facturado'],['proformas','Proformas'],['gastos','Gastos'],['modelos','Artículos lanzados'],['unidades','Unidades vendidas']];
 const state={years:new Set(),quarters:new Set([1,2,3,4]),metrics:new Set(),loaded:false};
 let data={facturas:[],proformas:[],gastos:[],articulos:[],lineas:[]},token=0;
 const esc=v=>NOC.App.esc(String(v??''));
 const money=n=>Number(n||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
 const fmt=n=>Number(n||0).toLocaleString('es-ES',{maximumFractionDigits:0});
 const quarter=d=>{const m=Number(String(d||'').slice(5,7));return m>=1&&m<=12?Math.ceil(m/3):0};
 const year=d=>Number(String(d||'').slice(0,4));
 const yq=(y,q)=>`${y}-${q}`;
 async function all(table,fields='*'){
  const output=[];for(let start=0;start<100000;start+=1000){const {data:part,error}=await NOC.API.db().from(table).select(fields).range(start,start+999);if(error)throw error;output.push(...(part||[]));if(!part||part.length<1000)break;}return output;
 }
 async function render(){
  const t=++token,root=document.getElementById('viewContainer');
  document.getElementById('pageTitle').textContent='Gestión NOC · v4.1.0';
  document.getElementById('pageSubtitle').textContent='Panel de análisis interactivo';
  root.innerHTML='<div class="card"><p class="muted">Preparando panel interactivo…</p></div>';
  try{
   const results=await Promise.allSettled([all('facturas','id,fecha,total'),all('proformas','id,fecha,total'),all('gastos','id,fecha,cantidad'),all('articulos','id,anio,mes,nombre_producto'),all('lineas_factura','factura_id,cantidad,es_envio')]);
   if(t!==token)return;
   const names=['facturas','proformas','gastos','articulos','lineas'];const errors=[];
   results.forEach((r,i)=>{data[names[i]]=r.status==='fulfilled'?r.value:[];if(r.status==='rejected')errors.push(names[i]+': '+String(r.reason?.message||r.reason));});
   state.loaded=true;
   const ys=new Set([new Date().getFullYear()]);
   ['facturas','proformas','gastos'].forEach(k=>data[k].forEach(r=>{if(year(r.fecha)>2000)ys.add(year(r.fecha))}));
   data.articulos.forEach(r=>{if(Number(r.anio)>2000)ys.add(Number(r.anio))});
   const years=[...ys].sort((a,b)=>b-a);
   if(!state.years.size)state.years.add(new Date().getFullYear());
   root.innerHTML=`<section id="nocInteractive" class="noc-interactive"><div class="noc-hero" id="nocHero"><div class="noc-kicker">NOC THE BRAND</div><h1>Gestión NOC</h1><p>Selecciona periodos e indicadores para comparar resultados.</p></div>
    ${errors.length?`<div class="noc-warning">Algunos datos no se han podido consultar: ${esc(errors.join(' · '))}. Los indicadores correspondientes pueden estar incompletos.</div>`:''}
    <div class="noc-controls"><div><strong>Años</strong><div class="noc-pills" id="nocYears">${years.map(y=>pill('year',y,y,state.years.has(y))).join('')}</div></div>
    <div><strong>Trimestres</strong><div class="noc-pills" id="nocQuarters">${[1,2,3,4].map(q=>pill('quarter',q,'T'+q,state.quarters.has(q))).join('')}</div></div>
    <div><strong>Indicadores</strong><div class="noc-pills" id="nocMetrics">${metrics.map(([id,label])=>pill('metric',id,label,state.metrics.has(id))).join('')}</div></div></div>
    <div id="nocResults" aria-live="polite"></div></section>`;
   root.querySelectorAll('[data-kind]').forEach(btn=>btn.addEventListener('click',()=>{
    const kind=btn.dataset.kind,val=kind==='metric'?btn.dataset.value:Number(btn.dataset.value);
    const set=kind==='year'?state.years:kind==='quarter'?state.quarters:state.metrics;
    if(set.has(val))set.delete(val);else set.add(val);
    btn.classList.toggle('active',set.has(val));btn.setAttribute('aria-pressed',String(set.has(val)));
    draw();
   }));draw();
  }catch(e){if(t===token)root.innerHTML=`<div class="card">Error al cargar el dashboard: ${esc(e.message||e)}</div>`;}
 }
 function pill(kind,value,label,active){return `<button type="button" class="noc-pill ${active?'active':''}" data-kind="${kind}" data-value="${esc(value)}" aria-pressed="${active}">${esc(label)}</button>`}
 function draw(){
  const result=document.getElementById('nocResults');if(!result)return;
  const active=state.years.size&&state.quarters.size&&state.metrics.size;
  document.getElementById('nocHero').classList.toggle('compact',!!active);
  if(!active){result.innerHTML='<div class="noc-empty">Elige al menos un año, un trimestre y un indicador para empezar.</div>';return;}
  const ys=[...state.years].sort((a,b)=>a-b),qs=[...state.quarters].sort((a,b)=>a-b),ms=[...state.metrics];
  const group=new Map();ys.forEach(y=>qs.forEach(q=>group.set(yq(y,q),{y,q,facturado:0,proformas:0,gastos:0,modelos:0,unidades:0})));
  for(const r of data.facturas){const g=group.get(yq(year(r.fecha),quarter(r.fecha)));if(g)g.facturado+=Number(r.total||0)}
  for(const r of data.proformas){const g=group.get(yq(year(r.fecha),quarter(r.fecha)));if(g)g.proformas+=Number(r.total||0)}
  for(const r of data.gastos){const g=group.get(yq(year(r.fecha),quarter(r.fecha)));if(g)g.gastos+=Number(r.cantidad||0)}
  for(const r of data.articulos){const y=Number(r.anio),m=Number(r.mes),q=m>=1&&m<=12?Math.ceil(m/3):0;const g=group.get(yq(y,q));if(g)g.modelos++}
  const invoiceDate=new Map(data.facturas.map(f=>[String(f.id),f.fecha]));
  for(const r of data.lineas){if(r.es_envio===true||r.es_envio==='true')continue;const d=invoiceDate.get(String(r.factura_id));if(!d)continue;const g=group.get(yq(year(d),quarter(d)));if(g)g.unidades+=Number(r.cantidad||0)}
  const records=[...group.values()];
  const sums=Object.fromEntries(ms.map(m=>[m,records.reduce((s,r)=>s+r[m],0)]));
  const financial=m=>['facturado','proformas','gastos'].includes(m);
  const display=(m,v)=>financial(m)?money(v):fmt(v);
  const showDiff=ms.includes('facturado')&&ms.includes('gastos');
  const labels=Object.fromEntries(metrics);
  const totals=ms.map(m=>`<div class="noc-total"><span>${esc(labels[m])}</span><strong>${display(m,sums[m])}</strong></div>`).join('')+(showDiff?`<div class="noc-total noc-net"><span>Facturado − gastos registrados</span><strong>${money(sums.facturado-sums.gastos)}</strong></div>`:'');
  const head=ms.map(m=>`<th>${esc(labels[m])}</th>`).join('')+(showDiff?'<th>Facturado − gastos</th>':'');
  const body=records.map(r=>`<tr><th>${r.y} · T${r.q}</th>${ms.map(m=>`<td>${display(m,r[m])}</td>`).join('')}${showDiff?`<td><strong>${money(r.facturado-r.gastos)}</strong></td>`:''}</tr>`).join('');
  result.innerHTML=`<div class="noc-summary">${totals}</div><div class="noc-table-card"><h3>Comparativa por año y trimestre</h3><div class="table-wrap"><table><thead><tr><th>Periodo</th>${head}</tr></thead><tbody>${body}</tbody></table></div><p class="muted noc-note">Los importes se calculan con los registros existentes. «Facturado − gastos» no equivale al beneficio contable. Los artículos lanzados se agrupan por año y mes de catálogo; las unidades vendidas proceden de las líneas de factura, excluyendo envíos.</p></div>`;
 }
 return{render};
})();
