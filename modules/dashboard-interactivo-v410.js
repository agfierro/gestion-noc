window.NOC=window.NOC||{};
NOC.DashboardInteractivo=(()=>{
 const metrics=[['facturado','Facturado'],['proformas','Proformas'],['gastos','Gastos'],['modelos','Artículos lanzados'],['unidades','Unidades vendidas'],['resultado','Facturado − gastos']];
 const state={years:new Set(),quarters:new Set([1,2,3,4]),metrics:new Set(),channel:"todos",types:new Set(["ropa","complementos"]),loaded:false};
 let data={facturas:[],proformas:[],gastos:[],articulos:[],lineas:[],clientes:[]},token=0;
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const esc=v=>NOC.App.esc(String(v??''));
 const money=n=>Number(n||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
 const fmt=n=>Number(n||0).toLocaleString('es-ES',{maximumFractionDigits:0});
 const quarter=d=>{const m=Number(String(d||'').slice(5,7));return m>=1&&m<=12?Math.ceil(m/3):0};
 const year=d=>Number(String(d||'').slice(0,4));
 const yq=(y,q)=>`${y}-${q}`;
 const fechaFactura=r=>r.fecha_operacion||r.fecha;
 async function all(table,fields='*'){
  const output=[];for(let start=0;start<100000;start+=1000){const {data:part,error}=await NOC.API.db().from(table).select(fields).range(start,start+999);if(error)throw error;output.push(...(part||[]));if(!part||part.length<1000)break;}return output;
 }
 async function render(){
  const t=++token,root=document.getElementById('viewContainer');
  document.getElementById('pageTitle').textContent='Gestión NOC';
  document.getElementById('pageSubtitle').textContent='Panel de análisis interactivo';
  root.innerHTML='<div class="card"><p class="muted">Preparando panel interactivo…</p></div>';
  try{
   const results=await Promise.allSettled([all('facturas','id,fecha,fecha_operacion,total,cliente_id,numero'),all('proformas','id,fecha,total,cliente_id'),all('gastos','id,fecha,cantidad'),all('articulos','id,anio,mes,nombre_producto,tipo_articulo'),all('lineas_factura','factura_id,articulo_id,descripcion,cantidad,precio_unitario,descuento,es_envio,tipo_articulo_web'),all('clientes','id,nombre_tienda')]);
   if(t!==token)return;
   const names=['facturas','proformas','gastos','articulos','lineas','clientes'];const errors=[];
   results.forEach((r,i)=>{data[names[i]]=r.status==='fulfilled'?r.value:[];if(r.status==='rejected')errors.push(names[i]+': '+String(r.reason?.message||r.reason));});
   state.loaded=true;
   const ys=new Set([new Date().getFullYear()]);
   ['facturas','proformas','gastos'].forEach(k=>data[k].forEach(r=>{const fecha=k==='facturas'?fechaFactura(r):r.fecha;if(year(fecha)>2000)ys.add(year(fecha))}));
   data.articulos.forEach(r=>{if(Number(r.anio)>2000)ys.add(Number(r.anio))});
   const years=[...ys].sort((a,b)=>b-a);
   if(!state.years.size)state.years.add(new Date().getFullYear());
   root.innerHTML=`<section id="nocInteractive" class="noc-interactive"><div class="noc-hero" id="nocHero"><div class="noc-kicker">NOC THE BRAND</div><h1>Gestión NOC</h1><p>Selecciona periodos e indicadores para comparar resultados.</p></div>
    ${errors.length?`<div class="noc-warning">Algunos datos no se han podido consultar: ${esc(errors.join(' · '))}. Los indicadores correspondientes pueden estar incompletos.</div>`:''}
    <div class="noc-controls"><div class="noc-period-row"><div><strong>Años</strong><div class="noc-pills" id="nocYears">${years.map(y=>pill('year',y,y,state.years.has(y))).join('')}</div></div>
    <div><strong>Trimestres</strong><div class="noc-pills" id="nocQuarters">${[1,2,3,4].map(q=>pill('quarter',q,'T'+q,state.quarters.has(q))).join('')}</div></div>
    <div class="noc-channel-inline"><strong>Canal de venta</strong><div class="noc-pills" id="nocChannels">${[['todos','Todos'],['mayoristas','Mayoristas'],['particulares','Particulares']].map(([v,l])=>pill('channel',v,l,state.channel===v)).join('')}</div></div>
    <div class="noc-type-inline"><strong>Tipo de artículo (selección acumulable)</strong><div class="noc-pills" id="nocTypes">${[['ropa','Ropa'],['complementos','Complementos']].map(([v,l])=>pill('type',v,l,state.types.has(v))).join('')}</div></div></div>
    <div><strong>Indicadores</strong><div class="noc-pills" id="nocMetrics">${metrics.map(([id,label])=>pill('metric',id,label,state.metrics.has(id))).join('')}</div></div></div>
    <div id="nocResults" aria-live="polite"></div></section>`;
   root.querySelectorAll('[data-kind]').forEach(btn=>btn.addEventListener('click',()=>{
    const kind=btn.dataset.kind,val=['metric','channel','type'].includes(kind)?btn.dataset.value:Number(btn.dataset.value);
    if(kind==='channel'){state.channel=val;root.querySelectorAll('[data-kind=channel]').forEach(b=>{b.classList.toggle('active',b.dataset.value===val);b.setAttribute('aria-pressed',String(b.dataset.value===val))});draw();return;}
    const set=kind==='year'?state.years:kind==='quarter'?state.quarters:kind==='type'?state.types:state.metrics;
    if(set.has(val))set.delete(val);else set.add(val);
    btn.classList.toggle('active',set.has(val));btn.setAttribute('aria-pressed',String(set.has(val)));
    draw();
   }));draw();
  }catch(e){if(t===token)root.innerHTML=`<div class="card">Error al cargar el dashboard: ${esc(e.message||e)}</div>`;}
 }
 function lineChart(m,ys,qs,group,labels,financial){
  const w=560,h=300,left=58,right=20,top=36,bottom=58,plotW=w-left-right,plotH=h-top-bottom;
  const vals=ys.flatMap(y=>qs.map(q=>Number(group.get(yq(y,q))?.[m]||0)));
  const minV=Math.min(0,...vals),maxV=Math.max(0,...vals);
  const roughStep=Math.max(1,(maxV-minV)/5);
  const pow=Math.pow(10,Math.floor(Math.log10(roughStep)));
  const step=[1,2,5,10].map(k=>k*pow).find(n=>n>=roughStep)||10*pow;
  const lo=Math.floor(minV/step)*step,hi=Math.max(lo+step,Math.ceil(maxV/step)*step);
  const xx=q=>left+(q-1)*plotW/3;
  const yy=v=>top+(hi-v)/(hi-lo)*plotH;
  const numberLabel=v=>{const a=Math.abs(v);if(a>=1000000)return (v/1000000).toLocaleString('es-ES',{maximumFractionDigits:1})+' M';if(a>=1000)return (v/1000).toLocaleString('es-ES',{maximumFractionDigits:1})+' mil';return Math.round(v).toLocaleString('es-ES',{maximumFractionDigits:0});};
  const colors=['#20628a','#e56b2e','#529268','#8b5da9','#b07b2c'];
  const lines=[];
  for(let tick=lo;tick<=hi+step/10;tick+=step){const y=yy(tick);lines.push(`<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="#dce2e8" stroke-width="1"/><text x="${left-8}" y="${y+4}" text-anchor="end" class="noc-line-tick">${esc(numberLabel(tick))}</text>`);}
  for(let q=1;q<=4;q++)lines.push(`<text x="${xx(q)}" y="${h-39}" text-anchor="middle" class="noc-line-tick">T${q}</text>`);
  ys.forEach((yearValue,i)=>{
    const color=colors[i%colors.length],points=qs.map(q=>({q,v:Number(group.get(yq(yearValue,q))?.[m]||0)}));
    if(points.length>1)lines.push(`<polyline points="${points.map(p=>`${xx(p.q)},${yy(p.v)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
    points.forEach((p,j)=>{const x=xx(p.q),y=yy(p.v),exact=financial?money(p.v):fmt(p.v);const offset=(i%2===0?-12:18);const label=numberLabel(p.v)+(financial?' €':'');lines.push(`<g><title>${esc(yearValue+' · T'+p.q+' · '+labels[m]+': '+exact)}</title><circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="#fff" stroke-width="1.5"/><text x="${x}" y="${Math.max(15,Math.min(h-bottom-5,y+offset))}" text-anchor="middle" class="noc-line-value" fill="${color}">${esc(label)}</text></g>`)});
    const legendX=w/2-(ys.length*75)/2+i*75;lines.push(`<line x1="${legendX}" y1="${h-13}" x2="${legendX+18}" y2="${h-13}" stroke="${color}" stroke-width="3"/><text x="${legendX+23}" y="${h-9}" class="noc-line-legend">${yearValue}</text>`);
  });
  return `<div class="noc-chart noc-line-chart" aria-label="Gráfico de líneas comparativo de ${esc(labels[m])}"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(labels[m])}: comparación por año y trimestre" preserveAspectRatio="xMidYMid meet">${lines.join('')}</svg><div class="noc-chart-hint">Pasa el cursor por un punto para ver el valor exacto.</div></div>`;
 }
 function pill(kind,value,label,active){return `<button type="button" class="noc-pill ${active?'active':''}" data-kind="${kind}" data-value="${esc(value)}" aria-pressed="${active}">${esc(label)}</button>`}
 function draw(){
  const result=document.getElementById('nocResults');if(!result)return;
  const active=state.years.size&&state.quarters.size&&state.metrics.size;
  document.getElementById('nocHero').classList.toggle('compact',!!active);
  if(!active){result.innerHTML='<div class="noc-empty">Elige al menos un año, un trimestre y un indicador para empezar.</div>';return;}
  const ys=[...state.years].sort((a,b)=>b-a),qs=[...state.quarters].sort((a,b)=>a-b),ms=[...state.metrics];
  const group=new Map();ys.forEach(y=>qs.forEach(q=>group.set(yq(y,q),{y,q,facturado:0,proformas:0,gastos:0,modelos:0,unidades:0})));
  // El canal se infiere del tipo fiscal del cliente; no se alteran datos en Supabase.
  const clients=new Map(data.clientes.map(c=>[String(c.id),norm(c.nombre_tienda)]));
  const invoiceAllowed=r=>state.channel==='todos'||(state.channel==='particulares'?clients.get(String(r.cliente_id))==='particular':clients.has(String(r.cliente_id))&&clients.get(String(r.cliente_id))!=='particular');
  const articleById=new Map(data.articulos.map(a=>[String(a.id),a]));
  // Clasificación por catálogo o por descripción histórica, sin alterar registros.
  const classify=r=>{
   const explicit=norm(r.tipo_articulo_web);
   if(explicit==='ropa'||explicit==='complementos')return explicit;
   const type=norm(articleById.get(String(r.articulo_id))?.tipo_articulo);
   if(type==='ropa')return 'ropa';
   if(type==='complementos'||type==='complemento')return 'complementos';
   const d=norm(r.descripcion);
   if(/(?:^|\b)(calc(?:etin|\.)|calcetines|panuelo|panuelos|collar|collares|pulsera|bolso|gorra|pendiente|accesorio|bufanda|cinturon)(?:\b|\.)/.test(d))return 'complementos';
   if(/^(cami(?:seta|sa|\.)?\b|sud(?:adera|\.)?\b|vest(?:ido|\.)?\b|blazer\b|short\b|pantalon\b|jersey\b|falda\b|chaqueta\b|abrigo\b|top\b|camisa\b)/.test(d))return 'ropa';
   return null;
  };
  const typeAllowed=id=>{const type=norm(articleById.get(String(id))?.tipo_articulo);return state.types.has(type==='complemento'?'complementos':type)};
  const lineAllowed=r=>state.types.has(classify(r));
  const isShipping=r=>r.es_envio===true||r.es_envio==='true';
  const lineNet=r=>{const price=Number(r.precio_unitario||0),qty=Number(r.cantidad||0),disc=Number(r.descuento||0);return price*qty*(1-disc/100)};
  const invoices=new Map(data.facturas.filter(invoiceAllowed).map(r=>[String(r.id),r]));
  // Reparto proporcional del total de factura según importe neto de sus líneas.
  // Incluye IVA/descuentos globales proporcionalmente; envío y líneas sin categoría
  // quedan fuera de las categorías, sin adjudicarles importes inventados.
  const byInvoice=new Map();
  for(const r of data.lineas){const key=String(r.factura_id);if(!invoices.has(key))continue;if(!byInvoice.has(key))byInvoice.set(key,[]);byInvoice.get(key).push(r)}
  let unclassifiedAmount=0,missingLines=0;
  for(const [id,r] of invoices){
   const g=group.get(yq(year(fechaFactura(r)),quarter(fechaFactura(r))));if(!g)continue;
   // Con ambas categorías activas, Facturado representa el total real de las
   // facturas del canal y periodo, incluidas ventas WEB históricas sin artículo.
   // El desglose por una sola categoría mantiene el reparto por líneas.
   if(state.types.has('ropa')&&state.types.has('complementos')){
    g.facturado+=Number(r.total||0);
    continue;
   }
   const lines=byInvoice.get(id)||[];
   if(!lines.length){missingLines++;continue}
   const totalNet=lines.reduce((sum,l)=>sum+lineNet(l),0);
   const selectedNet=lines.filter(l=>!isShipping(l)&&lineAllowed(l)).reduce((sum,l)=>sum+lineNet(l),0);
   if(Math.abs(totalNet)>0.00001)g.facturado+=Number(r.total||0)*selectedNet/totalNet;
   else unclassifiedAmount+=Number(r.total||0);
  }
  for(const r of data.proformas){if(!invoiceAllowed(r))continue;const g=group.get(yq(year(r.fecha),quarter(r.fecha)));if(g)g.proformas+=Number(r.total||0)}
  for(const r of data.gastos){const g=group.get(yq(year(r.fecha),quarter(r.fecha)));if(g)g.gastos+=Number(r.cantidad||0)}
  for(const r of data.articulos){const y=Number(r.anio),m=Number(r.mes),q=m>=1&&m<=12?Math.ceil(m/3):0;const g=group.get(yq(y,q));if(g&&typeAllowed(r.id))g.modelos++}
  const invoiceDate=new Map([...invoices.values()].map(f=>[String(f.id),fechaFactura(f)]));
  for(const r of data.lineas){if(isShipping(r)||!lineAllowed(r))continue;const d=invoiceDate.get(String(r.factura_id));if(!d)continue;const g=group.get(yq(year(d),quarter(d)));if(g)g.unidades+=Number(r.cantidad||0)}
  for(const g of group.values())g.resultado=g.facturado-g.gastos;
  const records=[...group.values()];
  const sums=Object.fromEntries(ms.map(m=>[m,records.reduce((s,r)=>s+r[m],0)]));
  const financial=m=>['facturado','proformas','gastos','resultado'].includes(m);
  const display=(m,v)=>financial(m)?money(v):fmt(v);
  const showDiff=false;
  const labels=Object.fromEntries(metrics);
  const totals=ms.map(m=>`<div class="noc-total"><span>${esc(labels[m])}</span><strong>${display(m,sums[m])}</strong></div>`).join('')+(showDiff?`<div class="noc-total noc-net"><span>Facturado − gastos registrados</span><strong>${money(sums.facturado-sums.gastos)}</strong></div>`:'');
  const tableSections=ms.map(m=>{
   const header=`<tr><th>Año</th>${qs.map(q=>`<th>T${q}</th>`).join('')}<th>Total</th></tr>`;
   const rows=ys.map(y=>{
    const cells=qs.map(q=>group.get(yq(y,q))?.[m]||0);
    const sum=cells.reduce((a,b)=>a+b,0);
    return `<tr><th>${y}</th>${cells.map(v=>`<td>${display(m,v)}</td>`).join('')}<td><strong>${display(m,sum)}</strong></td></tr>`;
   }).join('');
   const chart=lineChart(m,ys,qs,group,labels,financial(m));
   return `<div class="noc-table-card"><h3>${esc(labels[m])} · comparativa trimestral</h3><div class="noc-compare-layout"><div class="noc-table-scroll" tabindex="0" aria-label="Tabla trimestral desplazable"><table class="noc-quarter-table"><thead>${header}</thead><tbody>${rows}</tbody></table></div>${chart}</div></div>`;
  }).join('');
  const netTable=showDiff?`<div class="noc-table-card"><h3>Facturado − gastos registrados</h3><div class="table-wrap"><table><thead><tr><th>Año</th>${qs.map(q=>`<th>T${q}</th>`).join('')}<th>Total</th></tr></thead><tbody>${ys.map(y=>{const values=qs.map(q=>{const r=group.get(yq(y,q));return (r?.facturado||0)-(r?.gastos||0)});return `<tr><th>${y}</th>${values.map(v=>`<td>${money(v)}</td>`).join('')}<td><strong>${money(values.reduce((a,b)=>a+b,0))}</strong></td></tr>`}).join('')}</tbody></table></div></div>`:'';
  result.innerHTML=`<div class="noc-summary">${totals}</div>${tableSections}${netTable}<p class="muted noc-note">Con Ropa y Complementos seleccionados, Facturado incluye el total real de las facturas, también ventas WEB históricas sin artículo. Al seleccionar solo una categoría, el importe se distribuye proporcionalmente por líneas clasificables; los conceptos sin categoría no se asignan a ninguna. Proformas y gastos no se filtran por categoría. El filtro de canal se aplica a facturas y proformas; gastos y lanzamientos son globales. Las facturas se agrupan por fecha de operación; si no existe, se utiliza la fecha original. «Facturado − gastos» no equivale al beneficio contable.</p>`;
 }
 return{render};
})();
