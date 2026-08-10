window.NOC=window.NOC||{};
NOC.Dashboard=(()=>{
  let years=[];
  let lastResult=null;
  const MONTHS=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  const PROV_COMUNIDAD={
    "alava":"País Vasco","araba":"País Vasco","bizkaia":"País Vasco","vizcaya":"País Vasco","gipuzkoa":"País Vasco","guipuzcoa":"País Vasco",
    "a coruna":"Galicia","coruna":"Galicia","la coruna":"Galicia","lugo":"Galicia","ourense":"Galicia","orense":"Galicia","pontevedra":"Galicia",
    "asturias":"Asturias","cantabria":"Cantabria","navarra":"Navarra","la rioja":"La Rioja","rioja":"La Rioja",
    "huesca":"Aragón","teruel":"Aragón","zaragoza":"Aragón",
    "barcelona":"Cataluña","girona":"Cataluña","gerona":"Cataluña","lleida":"Cataluña","lerida":"Cataluña","tarragona":"Cataluña",
    "castellon":"Comunidad Valenciana","castello":"Comunidad Valenciana","valencia":"Comunidad Valenciana","alicante":"Comunidad Valenciana","alacant":"Comunidad Valenciana",
    "murcia":"Región de Murcia","albacete":"Castilla-La Mancha","ciudad real":"Castilla-La Mancha","cuenca":"Castilla-La Mancha","guadalajara":"Castilla-La Mancha","toledo":"Castilla-La Mancha",
    "avila":"Castilla y León","burgos":"Castilla y León","leon":"Castilla y León","palencia":"Castilla y León","salamanca":"Castilla y León","segovia":"Castilla y León","soria":"Castilla y León","valladolid":"Castilla y León","zamora":"Castilla y León",
    "madrid":"Comunidad de Madrid","badajoz":"Extremadura","caceres":"Extremadura",
    "almeria":"Andalucía","cadiz":"Andalucía","cordoba":"Andalucía","granada":"Andalucía","huelva":"Andalucía","jaen":"Andalucía","malaga":"Andalucía","sevilla":"Andalucía",
    "illes balears":"Islas Baleares","islas baleares":"Islas Baleares","baleares":"Islas Baleares",
    "las palmas":"Canarias","santa cruz de tenerife":"Canarias","ceuta":"Ceuta","melilla":"Melilla"
  };
  const cleanKey=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("es");
  const comunidadDe=prov=>PROV_COMUNIDAD[cleanKey(prov)]||String(prov||"Sin comunidad");
  function topBy(rows,keyFn,valueFn){
    const m=new Map();
    rows.forEach(r=>{
      const k=String(keyFn(r)||"").trim();
      if(!k)return;
      m.set(k,(m.get(k)||0)+Number(valueFn(r)||0));
    });
    return [...m.entries()].sort((a,b)=>b[1]-a[1])[0]||["—",0];
  }

  const norm=v=>String(v||"").trim().toLocaleLowerCase("es");
  const isParticular=f=>norm(f.clientes?.nombre_tienda)==="particular";
  const money=n=>NOC.App.money(Number(n||0));
  const pct=n=>{
    if(n===null||!Number.isFinite(n))return "—";
    const sign=n>0?"+":"";
    return `${sign}${n.toLocaleString("es-ES",{minimumFractionDigits:1,maximumFractionDigits:1})} %`;
  };

  async function renderReport(containerId="viewContainer"){
    // Solo fechas: sirven para ofrecer los años disponibles sin mostrar información económica.
    try{
      const {data,error}=await NOC.API.db().from("facturas").select("fecha").order("fecha",{ascending:false});
      if(error)throw error;
      years=[...new Set((data||[]).map(r=>Number(String(r.fecha||"").slice(0,4))).filter(Number.isFinite))].sort((a,b)=>b-a);
    }catch(e){
      years=[new Date().getFullYear()];
    }
    if(!years.length)years=[new Date().getFullYear()];

    const current=years[0]||new Date().getFullYear();
    document.getElementById(containerId).innerHTML=`
      <div class="dashboard-shell">
        <div class="card dashboard-filter-card">
          <div class="dashboard-heading">
            <div>
              <div class="dashboard-eyebrow">NOC THE BRAND</div>
              <h2>Dashboard de ventas</h2>
              <p class="muted">Los importes permanecen ocultos hasta que pulses <strong>Mostrar dashboard</strong>.</p>
            </div>
          </div>

          <div class="form-grid dashboard-filter-grid">
            <div class="field f3">
              <label>Periodo</label>
              <select id="dashPeriod" onchange="NOC.Dashboard.periodChanged()">
                <option value="year">Año completo</option>
                <option value="quarter">Trimestre</option>
                <option value="semester">Semestre</option>
                <option value="custom">Fechas personalizadas</option>
              </select>
            </div>

            <div class="field f3 dash-year-field">
              <label>Año principal</label>
              <select id="dashYear" onchange="NOC.Dashboard.yearChanged()">
                ${years.map(y=>`<option value="${y}" ${y===current?"selected":""}>${y}</option>`).join("")}
              </select>
            </div>

            <div class="field f3 dash-quarter-field" style="display:none">
              <label>Trimestre</label>
              <select id="dashQuarter">
                <option value="1">1.º trimestre</option><option value="2">2.º trimestre</option>
                <option value="3">3.º trimestre</option><option value="4">4.º trimestre</option>
              </select>
            </div>

            <div class="field f3 dash-semester-field" style="display:none">
              <label>Semestre</label>
              <select id="dashSemester">
                <option value="1">1.º semestre</option><option value="2">2.º semestre</option>
              </select>
            </div>

            <div class="field f3 dash-custom-field" style="display:none">
              <label>Fecha inicio</label><input id="dashFrom" type="date">
            </div>
            <div class="field f3 dash-custom-field" style="display:none">
              <label>Fecha fin</label><input id="dashTo" type="date">
            </div>

            <div class="field f3">
              <label>Categoría</label>
              <select id="dashCategory">
                <option value="all">Todas</option>
                <option value="pos">Puntos de venta</option>
                <option value="particular">Particulares</option>
              </select>
            </div>

            <div class="field f12">
              <label>Comparar con otros años</label>
              <div id="dashCompareYears" class="dash-year-checks"></div>
            </div>
          </div>

          <div class="dashboard-filter-actions">
            <button class="btn btn-primary" onclick="NOC.Dashboard.showDashboard()">Mostrar dashboard</button>
            <button class="btn" onclick="NOC.Dashboard.hideDashboard()">Ocultar datos</button>
          </div>
        </div>

        <div id="dashboardPrivacy" class="dashboard-privacy card">
          <div class="dashboard-lock">◉</div>
          <div>
            <strong>Datos económicos ocultos</strong>
            <div class="muted">Selecciona los filtros y pulsa “Mostrar dashboard”.</div>
          </div>
        </div>

        <div id="dashboardResults" style="display:none"></div>

      </div>`;
    yearChanged();
  }

  function periodChanged(){
    const p=document.getElementById("dashPeriod").value;
    document.querySelectorAll(".dash-year-field").forEach(e=>e.style.display=p==="custom"?"none":"");
    document.querySelectorAll(".dash-quarter-field").forEach(e=>e.style.display=p==="quarter"?"":"none");
    document.querySelectorAll(".dash-semester-field").forEach(e=>e.style.display=p==="semester"?"":"none");
    document.querySelectorAll(".dash-custom-field").forEach(e=>e.style.display=p==="custom"?"":"none");
    if(p==="custom"){
      const y=years[0]||new Date().getFullYear();
      document.getElementById("dashFrom").value=`${y}-01-01`;
      document.getElementById("dashTo").value=`${y}-12-31`;
    }
    yearChanged();
  }

  function yearChanged(){
    const yearEl=document.getElementById("dashYear");
    const main=Number(yearEl?.value||years[0]);
    const box=document.getElementById("dashCompareYears");
    if(!box)return;
    const candidates=years.filter(y=>y!==main);
    box.innerHTML=candidates.length
      ?candidates.map((y,i)=>`<label class="dash-year-pill"><input type="checkbox" value="${y}" ${i<2?"checked":""}> <span>${y}</span></label>`).join("")
      :`<span class="muted">Cuando cargues otros años aparecerán aquí para compararlos.</span>`;
  }

  function selectedComparisonYears(){
    return [...document.querySelectorAll("#dashCompareYears input:checked")].map(x=>Number(x.value));
  }

  function periodConfig(){
    const mode=document.getElementById("dashPeriod").value;
    if(mode==="custom"){
      const from=document.getElementById("dashFrom").value;
      const to=document.getElementById("dashTo").value;
      if(!from||!to)throw new Error("Selecciona fecha de inicio y fecha fin.");
      if(from>to)throw new Error("La fecha de inicio no puede ser posterior a la fecha fin.");
      const baseYear=Number(from.slice(0,4));
      return{mode,baseYear,from,to,startMonth:Number(from.slice(5,7)),endMonth:Number(to.slice(5,7)),label:`${dateEs(from)} – ${dateEs(to)}`};
    }

    const y=Number(document.getElementById("dashYear").value);
    if(mode==="year")return{mode,baseYear:y,from:`${y}-01-01`,to:`${y}-12-31`,startMonth:1,endMonth:12,label:`Año ${y}`};

    if(mode==="quarter"){
      const q=Number(document.getElementById("dashQuarter").value);
      const sm=(q-1)*3+1,em=sm+2;
      return{mode,baseYear:y,from:`${y}-${String(sm).padStart(2,"0")}-01`,to:lastDay(y,em),startMonth:sm,endMonth:em,label:`${q}.º trimestre ${y}`};
    }

    const s=Number(document.getElementById("dashSemester").value);
    const sm=s===1?1:7,em=s===1?6:12;
    return{mode,baseYear:y,from:`${y}-${String(sm).padStart(2,"0")}-01`,to:lastDay(y,em),startMonth:sm,endMonth:em,label:`${s}.º semestre ${y}`};
  }

  function lastDay(y,m){
    const d=new Date(y,m,0).getDate();
    return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  function dateEs(iso){const [y,m,d]=iso.split("-");return `${d}/${m}/${y}`}

  function equivalentRange(cfg,year){
    if(cfg.mode==="year")return{from:`${year}-01-01`,to:`${year}-12-31`};
    if(cfg.mode==="quarter"||cfg.mode==="semester"){
      return{from:`${year}-${cfg.from.slice(5)}`,to:`${year}-${cfg.to.slice(5)}`};
    }
    // Personalizado: mismo día/mes del año elegido. Ajuste sencillo para 29-feb.
    const safe=(mmdd)=>{
      let candidate=`${year}-${mmdd}`;
      const d=new Date(candidate+"T00:00:00");
      if(Number.isNaN(d.getTime()))candidate=`${year}-02-28`;
      return candidate;
    };
    return{from:safe(cfg.from.slice(5)),to:safe(cfg.to.slice(5))};
  }

  async function showDashboard(){
    let cfg;
    try{cfg=periodConfig()}catch(e){return NOC.App.alertMessage("Periodo incorrecto",e.message,"error")}
    const category=document.getElementById("dashCategory").value;
    let compare=selectedComparisonYears().filter(y=>y!==cfg.baseYear);
    const allYears=[cfg.baseYear,...compare];

    NOC.App.showProgress("Preparando dashboard…","Consultando facturación y comparativas");
    try{
      const ranges=allYears.map(y=>({year:y,...equivalentRange(cfg,y)}));
      const minFrom=ranges.map(r=>r.from).sort()[0];
      const maxTo=ranges.map(r=>r.to).sort().slice(-1)[0];

      const {data,error}=await NOC.API.db().from("facturas")
        .select("id,fecha,base_imponible,total,cliente_id,clientes(nombre_tienda,localidad_facturacion,provincia_facturacion)")
        .gte("fecha",minFrom).lte("fecha",maxTo)
        .order("fecha",{ascending:true});
      if(error)throw error;

      const raw=data||[];
      const filtered=raw.filter(r=>{
        if(category==="particular")return isParticular(r);
        if(category==="pos")return !isParticular(r);
        return true;
      });

      const yearly=ranges.map(range=>{
        const rows=filtered.filter(r=>r.fecha>=range.from&&r.fecha<=range.to);
        const allRows=raw.filter(r=>r.fecha>=range.from&&r.fecha<=range.to);
        const pos=allRows.filter(r=>!isParticular(r)).reduce((a,r)=>a+Number(r.total||0),0);
        const particular=allRows.filter(isParticular).reduce((a,r)=>a+Number(r.total||0),0);
        const months={};
        for(let m=1;m<=12;m++)months[m]=0;
        rows.forEach(r=>{months[Number(r.fecha.slice(5,7))]+=Number(r.total||0)});
        return{
          year:range.year,from:range.from,to:range.to,rows,
          total:rows.reduce((a,r)=>a+Number(r.total||0),0),
          count:rows.length,pos,particular,months
        };
      });

      // Insights directos únicamente para el periodo principal.
      const baseRange=ranges.find(r=>r.year===cfg.baseYear)||ranges[0];
      const baseFacturas=filtered.filter(r=>r.fecha>=baseRange.from&&r.fecha<=baseRange.to);
      const baseIds=baseFacturas.map(r=>r.id);
      let lineas=[];
      if(baseIds.length){
        const {data:ld,error:le}=await NOC.API.db().from("lineas_factura")
          .select("factura_id,articulo_id,descripcion,cantidad,precio_unitario,descuento,es_envio,articulos(nombre_producto,fabrica,precio_coste)")
          .in("factura_id",baseIds)
          .eq("es_envio",false);
        if(le)throw le;
        lineas=ld||[];
      }

      const artMap=new Map(),fabMap=new Map();
      lineas.forEach(l=>{
        const a=l.articulos||{};
        const name=a.nombre_producto||l.descripcion||"Sin artículo";
        const fab=a.fabrica||"Sin fábrica";
        const qty=Number(l.cantidad||0);
        const netUnit=Number(l.precio_unitario||0)*(1-Number(l.descuento||0)/100);
        const amount=netUnit*qty;
        const margin=(netUnit-Number(a.precio_coste||0))*qty;
        if(!artMap.has(name))artMap.set(name,{name,unidades:0,facturado:0,margen:0});
        const ar=artMap.get(name);ar.unidades+=qty;ar.facturado+=amount;ar.margen+=margin;
        if(!fabMap.has(fab))fabMap.set(fab,{name:fab,unidades:0,facturado:0,margen:0});
        const fr=fabMap.get(fab);fr.unidades+=qty;fr.facturado+=amount;fr.margen+=margin;
      });
      const arts=[...artMap.values()];
      const fabs=[...fabMap.values()];
      const topArticulo=[...arts].sort((a,b)=>b.unidades-a.unidades)[0]||null;
      const topRentable=[...arts].sort((a,b)=>b.margen-a.margen)[0]||null;
      const topFabrica=[...fabs].sort((a,b)=>b.facturado-a.facturado)[0]||null;
      const [topTienda,topTiendaBase]=topBy(baseFacturas,r=>r.clientes?.nombre_tienda,r=>r.base_imponible);
      const [topLocalidad,topLocalidadBase]=topBy(baseFacturas,r=>r.clientes?.localidad_facturacion,r=>r.base_imponible);
      const [topComunidad,topComunidadBase]=topBy(baseFacturas,r=>comunidadDe(r.clientes?.provincia_facturacion),r=>r.base_imponible);

      lastResult={cfg,category,yearly,insights:{topArticulo,topRentable,topFabrica,topTienda,topTiendaBase,topLocalidad,topLocalidadBase,topComunidad,topComunidadBase}};
      NOC.App.hideProgress();
      drawResults();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al cargar dashboard","No se han podido consultar los datos. "+(e.message||e),"error");
    }
  }

  function hideDashboard(){
    lastResult=null;
    const r=document.getElementById("dashboardResults"),p=document.getElementById("dashboardPrivacy");
    if(r){r.innerHTML="";r.style.display="none"}
    if(p)p.style.display="";
  }

  function drawResults(){
    if(!lastResult)return;
    const {cfg,category,yearly,insights}=lastResult;
    const base=yearly.find(y=>y.year===cfg.baseYear)||yearly[0];
    const comparisons=yearly.filter(y=>y.year!==base.year);
    const catLabel={all:"Todas las ventas",pos:"Puntos de venta",particular:"Particulares"}[category];

    const compHtml=comparisons.length?comparisons.map(c=>{
      const change=c.total===0?(base.total===0?0:null):((base.total-c.total)/Math.abs(c.total))*100;
      return `<span class="dash-compare-chip"><strong>${pct(change)}</strong> vs ${c.year}</span>`;
    }).join(""):`<span class="muted">Sin años de comparación seleccionados</span>`;

    const months=monthRange(cfg.startMonth,cfg.endMonth);
    const max=Math.max(1,...yearly.flatMap(y=>months.map(m=>y.months[m]||0)));

    const chartRows=yearly.map((y,yi)=>{
      const points=months.map((m,i)=>{
        const x=months.length===1?50:(i/(months.length-1))*100;
        const v=y.months[m]||0;
        const yy=88-(v/max)*76;
        return{x,yy,v,m};
      });
      const poly=points.map(p=>`${p.x},${p.yy}`).join(" ");
      return `<g class="dash-series dash-series-${yi}">
        <polyline points="${poly}" fill="none" vector-effect="non-scaling-stroke"></polyline>
        ${points.map(p=>`<circle cx="${p.x}" cy="${p.yy}" r="1.7"><title>${MONTHS[p.m-1]} ${y.year}: ${money(p.v)}</title></circle>`).join("")}
      </g>`;
    }).join("");

    const xLabels=months.map((m,i)=>{
      const x=months.length===1?50:(i/(months.length-1))*100;
      return `<text x="${x}" y="98" text-anchor="middle">${MONTHS[m-1]}</text>`;
    }).join("");

    const tableHead=months.map(m=>`<th class="num">${MONTHS[m-1]}</th>`).join("");
    const tableRows=yearly.map(y=>`<tr><td><strong>${y.year}</strong></td>${months.map(m=>`<td class="num">${money(y.months[m])}</td>`).join("")}<td class="num"><strong>${money(y.total)}</strong></td></tr>`).join("");

    const results=document.getElementById("dashboardResults");
    document.getElementById("dashboardPrivacy").style.display="none";
    results.style.display="";
    results.innerHTML=`
      <div class="dashboard-result-head">
        <div><div class="dashboard-eyebrow">RESULTADOS</div><h2>${cfg.label}</h2><div class="muted">${catLabel}</div></div>
        <button class="btn" onclick="NOC.Dashboard.hideDashboard()">Ocultar datos</button>
      </div>

      <div class="dashboard-metrics">
        <div class="dash-metric-card primary"><div class="dash-metric-label">Facturación</div><div class="dash-metric-value">${money(base.total)}</div><div class="dash-comparisons">${compHtml}</div></div>
        <div class="dash-metric-card"><div class="dash-metric-label">Puntos de venta</div><div class="dash-metric-value">${money(base.pos)}</div><div class="muted">${base.year}</div></div>
        <div class="dash-metric-card"><div class="dash-metric-label">Particulares</div><div class="dash-metric-value">${money(base.particular)}</div><div class="muted">${base.year}</div></div>
        <div class="dash-metric-card"><div class="dash-metric-label">N.º facturas</div><div class="dash-metric-value">${base.count}</div><div class="muted">${catLabel}</div></div>
      </div>

      <div class="card dash-insights-card">
        <div class="dashboard-card-head">
          <div><div class="dashboard-eyebrow">INSIGHTS</div><h2>Lo más destacado del periodo</h2><div class="muted">Consultas directas sobre ventas reales</div></div>
        </div>
        <div class="dash-insight-grid">
          <div class="dash-insight"><span>Artículo más vendido</span><strong>${NOC.App.esc(insights?.topArticulo?.name||"—")}</strong><em>${insights?.topArticulo?`${Number(insights.topArticulo.unidades).toLocaleString("es-ES")} uds.`:"Sin datos"}</em></div>
          <div class="dash-insight"><span>Artículo más rentable</span><strong>${NOC.App.esc(insights?.topRentable?.name||"—")}</strong><em>${insights?.topRentable?`${money(insights.topRentable.margen)} margen`:"Sin datos"}</em></div>
          <div class="dash-insight"><span>Fábrica nº1</span><strong>${NOC.App.esc(insights?.topFabrica?.name||"—")}</strong><em>${insights?.topFabrica?`${money(insights.topFabrica.facturado)} facturado`:"Sin datos"}</em></div>
          <div class="dash-insight"><span>Punto de venta nº1</span><strong>${NOC.App.esc(insights?.topTienda||"—")}</strong><em>${insights?.topTiendaBase?`${money(insights.topTiendaBase)} base`:"Sin datos"}</em></div>
          <div class="dash-insight"><span>Localidad nº1</span><strong>${NOC.App.esc(insights?.topLocalidad||"—")}</strong><em>${insights?.topLocalidadBase?`${money(insights.topLocalidadBase)} base`:"Sin datos"}</em></div>
          <div class="dash-insight"><span>Comunidad nº1</span><strong>${NOC.App.esc(insights?.topComunidad||"—")}</strong><em>${insights?.topComunidadBase?`${money(insights.topComunidadBase)} base`:"Sin datos"}</em></div>
        </div>
      </div>

      <div class="card dashboard-chart-card">
        <div class="dashboard-card-head">
          <div><h2>Evolución mensual</h2><div class="muted">Comparación del mismo periodo entre años</div></div>
          <div class="dash-legend">${yearly.map((y,i)=>`<span><i class="legend-dot legend-${i}"></i>${y.year}</span>`).join("")}</div>
        </div>
        <div class="dash-svg-wrap">
          <svg class="dash-chart" viewBox="-4 0 108 104" preserveAspectRatio="none" aria-label="Gráfica comparativa mensual">
            <line x1="0" y1="88" x2="100" y2="88" class="axis"></line>
            <line x1="0" y1="50" x2="100" y2="50" class="gridline"></line>
            <line x1="0" y1="12" x2="100" y2="12" class="gridline"></line>
            ${chartRows}
            <g class="xlabels">${xLabels}</g>
          </svg>
        </div>
      </div>

      <div class="card">
        <div class="dashboard-card-head"><div><h2>Detalle por mes</h2><div class="muted">Importes facturados</div></div></div>
        <div class="table-wrap">
          <table class="report-table dashboard-month-table">
            <thead><tr><th>Año</th>${tableHead}<th class="num">TOTAL</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function monthRange(start,end){
    if(start<=end)return Array.from({length:end-start+1},(_,i)=>start+i);
    return [...Array.from({length:13-start},(_,i)=>start+i),...Array.from({length:end},(_,i)=>i+1)];
  }

  async function render(){
    document.getElementById("viewContainer").innerHTML=`
      <div class="grid">
        <div class="card col-12 home-clean">
          <div class="dashboard-eyebrow">NOC THE BRAND</div>
          <h2>Inicio</h2>
          <p class="muted">Acceso rápido a las operaciones habituales.</p>
          <div class="home-actions">
            <button class="btn btn-primary" onclick="NOC.App.openNewProforma()">+ Nueva proforma</button>
            <button class="btn" onclick="NOC.App.show('clientes')">Clientes</button>
            <button class="btn" onclick="NOC.App.show('articulos')">Artículos</button>
            <button class="btn" onclick="NOC.App.show('informes')">Informes</button>
          </div>
        </div>
      </div>`;
  }

  return{render,renderReport,periodChanged,yearChanged,showDashboard,hideDashboard};
})();