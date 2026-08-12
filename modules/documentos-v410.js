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

  function resolveLogo(config){
    const raw=String(config?.logo_url||"").trim();
    // En la instalación actual el recurso garantizado es logo-noc-skull.png.
    // También sustituimos la antigua ruta logo-noc.png, que no existe en producción.
    if(!raw || /(?:^|\/)logo-noc\.png(?:[?#].*)?$/i.test(raw)) return "assets/logo-noc-skull.png?v=4.0.8";
    return raw;
  }

  function render({tipo,doc,lineas,config}){
    const isPf=tipo==="PROFORMA";
    const rates=taxRates(doc);
    const logo=resolveLogo(config);
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
          <img class="doc-logo" src="${val(logo)}" alt="Logo NOC" onerror="this.onerror=null;this.src='assets/logo-noc-skull.png?v=4.0.8'">
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
        <img class="doc-footer-logo" src="${val(logo)}" alt="" onerror="this.onerror=null;this.src='assets/logo-noc-skull.png?v=4.0.8'">
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

  function ensurePrintStyle(){
    let style=document.getElementById("nocUnifiedPrintStyle");
    if(style)return style;
    style=document.createElement("style");
    style.id="nocUnifiedPrintStyle";
    style.textContent=`
      @media print{
        @page{size:A4 portrait;margin:0}

        /* La hoja antigua usa visibility:hidden, que conserva el espacio y
           provoca decenas de páginas en Safari. Aquí quitamos físicamente
           todo lo que no sea el modal del documento. */
        body.noc-document-printing{
          margin:0!important;
          padding:0!important;
          background:#fff!important;
          overflow:visible!important;
        }
        body.noc-document-printing > *{
          display:none!important;
        }
        body.noc-document-printing > #modalRoot{
          display:block!important;
          visibility:visible!important;
          position:static!important;
          inset:auto!important;
          left:auto!important;
          top:auto!important;
          width:100%!important;
          height:auto!important;
          min-height:0!important;
          margin:0!important;
          padding:0!important;
          overflow:visible!important;
          background:#fff!important;
        }
        body.noc-document-printing #modalRoot,
        body.noc-document-printing #modalRoot *{
          visibility:visible!important;
          -webkit-print-color-adjust:exact!important;
          print-color-adjust:exact!important;
        }
        body.noc-document-printing #modalRoot .modal-backdrop{
          display:block!important;
          position:static!important;
          inset:auto!important;
          width:100%!important;
          height:auto!important;
          min-height:0!important;
          margin:0!important;
          padding:0!important;
          background:#fff!important;
          overflow:visible!important;
        }
        body.noc-document-printing #modalRoot .modal.document-modal{
          display:block!important;
          position:static!important;
          width:100%!important;
          max-width:none!important;
          height:auto!important;
          min-height:0!important;
          max-height:none!important;
          margin:0!important;
          padding:0!important;
          overflow:visible!important;
          box-shadow:none!important;
          border:0!important;
          border-radius:0!important;
          transform:none!important;
        }
        body.noc-document-printing #modalRoot .modal-head,
        body.noc-document-printing #modalRoot .modal-foot,
        body.noc-document-printing #modalRoot .document-relation{
          display:none!important;
        }
        body.noc-document-printing #modalRoot .modal-body{
          display:block!important;
          position:static!important;
          width:100%!important;
          height:auto!important;
          min-height:0!important;
          margin:0!important;
          padding:0!important;
          overflow:visible!important;
        }
        body.noc-document-printing #modalRoot .doc-sheet.noc-doc{
          display:block!important;
          position:static!important;
          width:210mm!important;
          max-width:210mm!important;
          min-width:0!important;
          min-height:0!important;
          height:auto!important;
          margin:0 auto!important;
          padding:10mm 10mm 8mm!important;
          box-sizing:border-box!important;
          box-shadow:none!important;
          overflow:visible!important;
          transform:none!important;
          break-inside:auto!important;
          page-break-inside:auto!important;
        }
        body.noc-document-printing #modalRoot .doc-items-spacer{
          height:58mm!important;
        }
        body.noc-document-printing #modalRoot .doc-footer{
          break-inside:avoid!important;
          page-break-inside:avoid!important;
        }
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  function imprimirActual(){
    const sheet=document.querySelector("#modalRoot .doc-sheet.noc-doc");
    if(!sheet){
      NOC.App.alertMessage?.("Documento no disponible","Abre primero la proforma o factura que quieres imprimir.","info");
      return;
    }
    ensurePrintStyle();
    document.body.classList.add("noc-document-printing");
    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;
      cleaned=true;
      document.body.classList.remove("noc-document-printing");
      window.removeEventListener("afterprint",cleanup);
    };
    window.addEventListener("afterprint",cleanup);

    // Las imágenes ya pertenecen al DOM visible. Esperamos únicamente si
    // alguna sigue cargando antes de abrir el diálogo de Safari.
    const imgs=Array.from(sheet.querySelectorAll("img"));
    Promise.all(imgs.map(img=>{
      if(img.complete)return Promise.resolve();
      return new Promise(resolve=>{
        const done=()=>resolve();
        img.addEventListener("load",done,{once:true});
        img.addEventListener("error",done,{once:true});
        setTimeout(done,1200);
      });
    })).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>window.print())))
      .catch(()=>requestAnimationFrame(()=>window.print()));

    // Salvaguarda por si un navegador no dispara afterprint al cancelar.
    setTimeout(()=>{
      if(!document.body.classList.contains("noc-document-printing"))return;
      // No limpiamos mientras el diálogo pueda estar abierto; esta ruta solo
      // evita dejar la clase pegada tras un fallo excepcional.
    },4000);
  }

  return{render,getConfig,taxRates,imprimirActual};
})();