window.NOC=window.NOC||{};
NOC.Documentos=(()=>{
  const pct=n=>Number(n||0).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" %";
  const dmy=iso=>{
    if(!iso)return"";
    const d=new Date(iso+"T00:00:00");
    return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"2-digit"}).format(d);
  };
  const val=v=>NOC.App.esc(v||"");
  const lineTotal=l=>Number(l.precio_unitario||0)*Number(l.cantidad||0)*(1-Number(l.descuento||0)/100);

  async function getConfig(){
    const {data,error}=await NOC.API.db().from("configuracion").select("*").eq("id",1).maybeSingle();
    if(error)throw error;
    return data||{};
  }

  function taxRates(doc){
    const base=Number(doc.base_imponible||0);
    const iva=Number(doc.iva||0);
    const re=Number(doc.recargo||0);
    return{
      ivaPct:base>0?iva/base*100:0,
      rePct:base>0?re/base*100:0
    };
  }

  function clientBlock(title,c,shipping=false){
    const direccion=shipping?(c.direccion_entrega||c.direccion_facturacion):c.direccion_facturacion;
    const cp=shipping?(c.cp_entrega||c.cp_facturacion):c.cp_facturacion;
    const loc=shipping?(c.localidad_entrega||c.localidad_facturacion):c.localidad_facturacion;
    const prov=shipping?(c.provincia_entrega||c.provincia_facturacion):c.provincia_facturacion;
    return `<div class="doc-address">
      <div class="doc-address-title"><span class="doc-icon">${shipping?"🚚":"♙"}</span><span>${title}</span></div>
      <div class="doc-address-main">${val(c.nombre_tienda||[c.nombre,c.apellidos].filter(Boolean).join(" "))}</div>
      ${c.nombre_tienda&&c.nombre?`<p>${val([c.nombre,c.apellidos].filter(Boolean).join(" "))}</p>`:""}
      <p>${val(direccion)}</p>
      <p>${val([cp,loc].filter(Boolean).join(" "))}</p>
      <p>${val(prov)}</p>
      <div class="doc-contact-row">
        ${c.dni_cif?`<span><strong>CIF/NIF:</strong> ${val(c.dni_cif)}</span>`:""}
        ${c.telefono?`<span><strong>Tfno.:</strong> ${val(c.telefono)}</span>`:""}
      </div>
    </div>`;
  }

  function webCustomerFromInvoice(doc,cliente){
    const c={...(cliente||{})};
    if(String(doc?.numero||"").toUpperCase().startsWith("WEB")){
      const obs=String(doc?.observaciones||"");
      const nombre=(obs.match(/(?:^|·)\s*Cliente:\s*([^·]+)/i)||[])[1]?.trim()||"";
      const localidad=(obs.match(/(?:^|·)\s*Localidad:\s*([^·]+)/i)||[])[1]?.trim()||"";
      if(nombre){
        c.nombre_tienda=nombre;
        c.nombre="";
        c.apellidos="";
      }
      if(localidad){
        c.localidad_facturacion=localidad;
        c.localidad_entrega=localidad;
        c.cp_facturacion="";
        c.cp_entrega="";
        c.provincia_facturacion="";
        c.provincia_entrega="";
        c.direccion_facturacion="";
        c.direccion_entrega="";
      }
      c.dni_cif="";
      c.telefono="";
    }
    return c;
  }

  function render({tipo,doc,lineas,config}){
    const isPf=tipo==="PROFORMA";
    const rates=taxRates(doc);
    const logo=config.logo_url||"assets/logo-noc.png";
    const footerAddress=config.direccion_pie||config.direccion||"";
    const footerCp=config.cp_pie||config.codigo_postal||"";
    const footerLoc=config.localidad_pie||config.localidad||"";
    const empresa=config.empresa||"NOC ATELIER";
    const payment=doc.forma_pago||"Transferencia";
    const bank=config.cuenta_bancaria||"";
    const email=config.email||"";
    const c=webCustomerFromInvoice(doc,doc.clientes||{});

    return `<div class="doc-sheet noc-doc">
      <div class="doc-brand-row">
        <div class="doc-brand">
          <img class="doc-logo" src="${val(logo)}" alt="Logo NOC">
          <div><div class="doc-brand-name">NOC</div><div class="doc-brand-sub">THE BRAND</div></div>
        </div>
        <div class="doc-title-box">
          <div class="doc-title">${tipo}</div>
          <div class="doc-title-line"></div>
          <div class="doc-meta">
            <strong>FECHA:</strong><span>${dmy(doc.fecha)}</span>
            <strong>${isPf?"PROFORMA":"FACTURA"} Nº:</strong><span><strong>${val(doc.numero)}</strong></span>
          </div>
        </div>
      </div>

      <div class="doc-address-grid">
        ${clientBlock("FACTURAR A:",c,false)}
        ${clientBlock("DIRECCIÓN DE ENVÍO:",c,true)}
      </div>

      <table class="doc-items">
        <thead><tr>
          <th>DESCRIPCIÓN</th><th class="center">CÓDIGO / TALLA</th><th class="center">UD</th>
          <th class="num">PRECIO</th><th class="num">DESCUENTO</th><th class="num">IMPORTE</th>
        </tr></thead>
        <tbody>
          ${lineas.map(l=>`<tr>
            <td>${val(l.descripcion)}</td>
            <td class="center">${val(l.tallaje||"–")}</td>
            <td class="center">${Number(l.cantidad||1)}</td>
            <td class="num">${NOC.App.money(l.precio_unitario)}</td>
            <td class="num">${pct(l.descuento)}</td>
            <td class="num">${NOC.App.money(lineTotal(l))}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <div class="doc-items-spacer"></div>

      <div class="doc-bottom">
        <div class="doc-payment">
          <div class="doc-payment-line"><span class="doc-icon">€</span><div><div class="doc-payment-label">FORMA DE PAGO</div><div class="doc-payment-value">${val(payment)}</div></div></div>
          ${bank?`<div class="doc-payment-line"><span class="doc-icon">▣</span><div><div class="doc-payment-label">CCC</div><div class="doc-payment-value">${val(bank)}</div></div></div>`:""}
          ${email?`<div class="doc-payment-line"><span class="doc-icon">✉</span><div><div class="doc-payment-label">E-MAIL</div><div class="doc-payment-value">${val(email)}</div></div></div>`:""}
        </div>
        <div class="doc-total-box">
          <div class="doc-total-row"><strong>SUBTOTAL</strong><strong>${NOC.App.money(doc.base_imponible)}</strong></div>
          <div class="doc-total-row"><span>IVA <span class="tax-rate">${pct(rates.ivaPct)}</span></span><strong>${NOC.App.money(doc.iva)}</strong></div>
          <div class="doc-total-row"><span>RE <span class="tax-rate">${pct(rates.rePct)}</span></span><strong>${NOC.App.money(doc.recargo)}</strong></div>
          <div class="doc-grand-total"><span>TOTAL</span><span>${NOC.App.money(doc.total)}</span></div>
        </div>
      </div>

      <div class="doc-footer">
        <img class="doc-footer-logo" src="${val(logo)}" alt="">
        <div class="doc-footer-company">
          <strong>${val(empresa)}</strong>
          ${footerAddress?`<p>${val(footerAddress)}</p>`:""}
          ${(footerCp||footerLoc)?`<p>${val([footerCp,footerLoc].filter(Boolean).join(" "))}</p>`:""}
          ${config.cif?`<p>NIF/CIF: ${val(config.cif)}</p>`:""}
        </div>
        <div class="doc-thanks">${val(config.pie_documentos||"GRACIAS POR SU CONFIANZA")}</div>
      </div>
    </div>`;
  }
  return{render,getConfig,taxRates};
})();