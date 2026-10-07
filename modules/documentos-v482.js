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
      ${(c.dni_cif||c.telefono)?`<p class="doc-contact-inline">${c.dni_cif?`<strong>CIF/NIF:</strong> ${val(c.dni_cif)}`:""}${c.dni_cif&&c.telefono?` &nbsp;&nbsp; `:""}${c.telefono?`<strong>Tfno.:</strong> ${val(c.telefono)}`:""}</p>`:""}
    </div>`;
  }

  function normalizarDireccion(v){
    return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();
  }

  function direccionEnvioIgualFiscal(c){
    const fiscal=[
      c.direccion_facturacion||"",
      c.cp_facturacion||"",
      c.localidad_facturacion||"",
      c.provincia_facturacion||""
    ].map(normalizarDireccion);
    const envio=[
      c.direccion_entrega||c.direccion_facturacion||"",
      c.cp_entrega||c.cp_facturacion||"",
      c.localidad_entrega||c.localidad_facturacion||"",
      c.provincia_entrega||c.provincia_facturacion||""
    ].map(normalizarDireccion);
    return fiscal.every((v,i)=>v===envio[i]);
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

      <div class="doc-address-grid ${direccionEnvioIgualFiscal(c)?"doc-address-grid-single":""}">
        ${clientBlock("FACTURAR A:",c,false)}
        ${direccionEnvioIgualFiscal(c)?"":clientBlock("DIRECCIÓN DE ENVÍO:",c,true)}
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
    style.id="nocUnifiedPrintStyleV418";
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
          padding:20mm 10mm 20mm!important;
          box-sizing:border-box!important;
          box-shadow:none!important;
          overflow:visible!important;
          transform:none!important;
          break-inside:auto!important;
          page-break-inside:auto!important;
        }
        body.noc-document-printing #modalRoot .doc-items-spacer{
          height:var(--noc-doc-spacer,0px)!important;
          min-height:0!important;
          border:0!important;
          background:transparent!important;
        }
        body.noc-document-printing #modalRoot .doc-address-grid.doc-address-grid-single{
          grid-template-columns:1fr!important;
        }
        body.noc-document-printing #modalRoot .doc-contact-inline{
          margin-top:3px!important;
          padding-top:0!important;
          border:0!important;
        }
        body.noc-document-printing #modalRoot .doc-bottom{
          margin-top:10px!important;
          align-items:end!important;
        }
        body.noc-document-printing #modalRoot .doc-payment{
          gap:6px!important;
          padding-bottom:0!important;
        }
        body.noc-document-printing #modalRoot .doc-payment-line{
          gap:7px!important;
          line-height:1.1!important;
        }
        body.noc-document-printing #modalRoot .doc-payment-value{
          margin-top:0!important;
        }
        body.noc-document-printing #modalRoot .doc-total-box{
          border:0!important;
        }
        body.noc-document-printing #modalRoot .doc-total-row{
          padding:5px 8px!important;
          border:0!important;
          line-height:1.1!important;
        }
        body.noc-document-printing #modalRoot .doc-total-row strong{
          font-size:12px!important;
        }
        body.noc-document-printing #modalRoot .doc-grand-total{
          padding:8px 10px!important;
          font-size:16px!important;
        }
        body.noc-document-printing #modalRoot .doc-footer{
          margin-top:14px!important;
          padding-top:10px!important;
        }
        body.noc-document-printing #modalRoot .doc-items tr{
          break-inside:avoid!important;
          page-break-inside:avoid!important;
        }
        body.noc-document-printing #modalRoot .doc-items thead{
          display:table-header-group!important;
        }
        body.noc-document-printing #modalRoot .doc-items{
          border-collapse:collapse!important;
          border:0!important;
        }
        body.noc-document-printing #modalRoot .doc-items th{
          padding-top:5px!important;
          padding-bottom:5px!important;
          border-left:0!important;
          border-right:0!important;
          border-top:0!important;
          border-bottom:1px solid rgba(0,0,0,.16)!important;
        }
        body.noc-document-printing #modalRoot .doc-items td{
          padding-top:4px!important;
          padding-bottom:4px!important;
          line-height:1.15!important;
          border-left:0!important;
          border-right:0!important;
          border-top:0!important;
          border-bottom:1px solid rgba(0,0,0,.045)!important;
        }
        body.noc-document-printing #modalRoot .doc-items tbody tr:last-child td{
          border-bottom:1px solid rgba(0,0,0,.08)!important;
        }
        body.noc-document-printing #modalRoot,
        body.noc-document-printing #modalRoot .modal-backdrop,
        body.noc-document-printing #modalRoot .modal,
        body.noc-document-printing #modalRoot .doc-viewer{
          margin:0!important;
          padding:0!important;
          border:0!important;
          box-shadow:none!important;
        }
        body.noc-document-printing #modalRoot .doc-sheet.noc-doc{
          width:210mm!important;
          max-width:210mm!important;
          min-height:0!important;
          height:auto!important;
          margin:0 auto!important;
          box-sizing:border-box!important;
          overflow:visible!important;
        }
        body.noc-document-printing #modalRoot .doc-sheet.noc-doc::after{
          content:none!important;
          display:none!important;
        }
        body.noc-document-printing #modalRoot .doc-footer{
          break-inside:avoid!important;
          page-break-inside:avoid!important;
        }
      }
      #modalRoot .doc-sheet.noc-doc .doc-items{
        border-collapse:collapse!important;
        border:0!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-items-spacer{
        border:0!important;
        background:transparent!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-address-grid.doc-address-grid-single{
        grid-template-columns:1fr!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-contact-inline{
        margin-top:3px!important;
        padding-top:0!important;
        border:0!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-bottom{
        margin-top:10px!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-payment{
        gap:6px!important;
        padding-bottom:0!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-payment-line{
        gap:7px!important;
        line-height:1.1!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-payment-value{
        margin-top:0!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-total-box{
        border:0!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-total-row{
        padding:5px 8px!important;
        border:0!important;
        line-height:1.1!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-total-row strong{
        font-size:12px!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-grand-total{
        padding:8px 10px!important;
        font-size:16px!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-footer{
        margin-top:14px!important;
        padding-top:10px!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-items th{
        padding-top:5px!important;
        padding-bottom:5px!important;
        border-left:0!important;
        border-right:0!important;
        border-top:0!important;
        border-bottom:1px solid rgba(0,0,0,.16)!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-items td{
        padding-top:4px!important;
        padding-bottom:4px!important;
        line-height:1.15!important;
        border-left:0!important;
        border-right:0!important;
        border-top:0!important;
        border-bottom:1px solid rgba(0,0,0,.045)!important;
      }
      #modalRoot .doc-sheet.noc-doc .doc-items tbody tr:last-child td{
        border-bottom:1px solid rgba(0,0,0,.08)!important;
      }
    `;
    document.head.appendChild(style);
    return style;
  }


  function pxA4DesdeAncho(sheet){
    const w=sheet.getBoundingClientRect().width||794;
    return w*(297/210);
  }

  async function ajustarDocumentoAPaginas(sheet){
    if(!sheet)return()=>{};
    const spacer=sheet.querySelector(".doc-items-spacer");
    if(!spacer)return()=>{};

    const oldSpacer=spacer.style.height;
    const oldVar=sheet.style.getPropertyValue("--noc-doc-spacer");
    spacer.style.height="0px";
    sheet.style.setProperty("--noc-doc-spacer","0px");

    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const pageH=pxA4DesdeAncho(sheet);
    const naturalH=sheet.scrollHeight;
    const cabeEnUna=naturalH <= (pageH-12);
    const pages=cabeEnUna?1:Math.max(1,Math.ceil((naturalH+1)/pageH));
    // Margen de seguridad mayor para Safari: evita una segunda hoja fantasma
    // cuando el documento cabe realmente en una sola A4.
    // V4.0.53: recuperamos la paginación visual de V4.0.44, que era la
    // última versión validada como correcta. Sólo ampliamos 8 px el margen
    // técnico anti-redondeo para evitar la hoja vacía ocasional.
    const PRINT_EDGE_SAFETY=56;
    const target=Math.max(0,pages*pageH-naturalH-PRINT_EDGE_SAFETY);
    spacer.style.height=`${target}px`;
    sheet.style.setProperty("--noc-doc-spacer",`${target}px`);

    return()=>{
      spacer.style.height=oldSpacer;
      if(oldVar)sheet.style.setProperty("--noc-doc-spacer",oldVar);
      else sheet.style.removeProperty("--noc-doc-spacer");
    };
  }

  async function medirSpacerA4DesdeClon(sheet){
    ensurePdfExportStyle();
    const host=document.createElement("div");
    host.className="noc-pdf-export-host noc-layout-measure-host";
    host.style.cssText="position:absolute!important;left:-20000px!important;top:0!important;visibility:hidden!important;pointer-events:none!important;";
    host.innerHTML=sheet.outerHTML;
    document.body.appendChild(host);
    try{
      const clone=host.querySelector(".doc-sheet.noc-doc");
      await esperarImagenes(clone);
      const cleanup=await ajustarDocumentoAPaginas(clone);
      const h=clone.querySelector(".doc-items-spacer")?.style.height||"0px";
      cleanup();
      return h;
    }finally{
      host.remove();
    }
  }

  function aplicarLayoutFinalDocumento(sheet){
    // V82: ÚNICA maquetación final para individual y masivo.
    // Se aplica inline con !important para no depender del contexto DOM,
    // media queries ni CSS alternativos.
    const touched=[];
    const set=(el,prop,value)=>{
      if(!el)return;
      touched.push([el,prop,el.style.getPropertyValue(prop),el.style.getPropertyPriority(prop)]);
      el.style.setProperty(prop,value,"important");
    };
    const all=(sel,fn)=>sheet.querySelectorAll(sel).forEach(fn);

    set(sheet,"width","210mm"); set(sheet,"max-width","210mm"); set(sheet,"min-width","210mm");
    set(sheet,"height","auto"); set(sheet,"min-height","0"); set(sheet,"max-height","none");
    set(sheet,"margin","0 auto"); set(sheet,"padding","20mm 10mm 20mm");
    set(sheet,"box-sizing","border-box"); set(sheet,"box-shadow","none");
    set(sheet,"overflow","visible"); set(sheet,"transform","none"); set(sheet,"background","#fff");

    const single=sheet.querySelector(".doc-address-grid.doc-address-grid-single");
    set(single,"grid-template-columns","1fr");
    const contact=sheet.querySelector(".doc-contact-inline");
    set(contact,"margin-top","3px"); set(contact,"padding-top","0"); set(contact,"border","0");

    const table=sheet.querySelector(".doc-items");
    set(table,"border-collapse","collapse"); set(table,"border","0");
    all(".doc-items th",el=>{
      set(el,"padding-top","5px"); set(el,"padding-bottom","5px");
      set(el,"border-left","0"); set(el,"border-right","0"); set(el,"border-top","0");
      set(el,"border-bottom","1px solid rgba(0,0,0,.16)");
    });
    all(".doc-items td",el=>{
      set(el,"padding-top","4px"); set(el,"padding-bottom","4px"); set(el,"line-height","1.15");
      set(el,"border-left","0"); set(el,"border-right","0"); set(el,"border-top","0");
      set(el,"border-bottom","1px solid rgba(0,0,0,.045)");
    });
    all(".doc-items tbody tr:last-child td",el=>set(el,"border-bottom","1px solid rgba(0,0,0,.08)"));

    const spacer=sheet.querySelector(".doc-items-spacer");
    set(spacer,"border","0"); set(spacer,"border-left","0"); set(spacer,"border-right","0");
    set(spacer,"border-top","0"); set(spacer,"border-bottom","0"); set(spacer,"background","transparent");
    set(spacer,"min-height","0");

    const bottom=sheet.querySelector(".doc-bottom");
    set(bottom,"grid-template-columns","1fr 340px"); set(bottom,"gap","44px");
    set(bottom,"margin-top","10px"); set(bottom,"align-items","end");

    const payment=sheet.querySelector(".doc-payment");
    set(payment,"gap","6px"); set(payment,"padding-bottom","0");
    all(".doc-payment-line",el=>{set(el,"gap","7px");set(el,"line-height","1.1")});
    all(".doc-payment-value",el=>set(el,"margin-top","0"));

    const totalBox=sheet.querySelector(".doc-total-box");
    set(totalBox,"border","0");
    all(".doc-total-row",el=>{
      set(el,"padding","5px 8px"); set(el,"border","0"); set(el,"line-height","1.1");
    });
    all(".doc-total-row strong",el=>set(el,"font-size","12px"));
    const grand=sheet.querySelector(".doc-grand-total");
    set(grand,"padding","8px 10px"); set(grand,"font-size","16px");

    const footer=sheet.querySelector(".doc-footer");
    set(footer,"grid-template-columns","auto 1fr 1.25fr"); set(footer,"gap","18px");
    set(footer,"margin-top","14px"); set(footer,"padding-top","10px");

    return()=>{
      for(let i=touched.length-1;i>=0;i--){
        const [el,prop,value,priority]=touched[i];
        if(value)el.style.setProperty(prop,value,priority||"");
        else el.style.removeProperty(prop);
      }
    };
  }

  async function imprimirActual(){
    const sheet=document.querySelector("#modalRoot .doc-sheet.noc-doc");
    if(!sheet){
      NOC.App.alertMessage?.("Documento no disponible","Abre primero la proforma o factura que quieres imprimir.","info");
      return;
    }
    ensurePrintStyle();

    const restoreLayout=aplicarLayoutFinalDocumento(sheet);
    let restorePages=()=>{};
    try{
      restorePages=await ajustarDocumentoAPaginas(sheet);
    }catch(e){
      console.warn("No se pudo ajustar la paginación A4",e);
    }

    document.body.classList.add("noc-document-printing");
    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;
      cleaned=true;
      document.body.classList.remove("noc-document-printing");
      try{restorePages?.()}catch(_){}
      try{restoreLayout?.()}catch(_){}
      window.removeEventListener("afterprint",cleanup);
    };
    window.addEventListener("afterprint",cleanup);

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
  }


  function webMeta(doc){
    const obs=String(doc?.observaciones||"");
    return{
      nombre:(obs.match(/(?:^|·)\s*Cliente:\s*([^·]+)/i)||[])[1]?.trim()||"",
      localidad:(obs.match(/(?:^|·)\s*Localidad:\s*([^·]+)/i)||[])[1]?.trim()||""
    };
  }

  function nombreArchivoCliente(doc){
    if(String(doc?.numero||"").toUpperCase().startsWith("WEB")){
      const nombre=webMeta(doc).nombre;
      if(nombre)return nombre;
    }
    const c=doc?.clientes||{};
    return c.nombre_tienda||[c.nombre,c.apellidos].filter(Boolean).join(" ")||"Sin cliente";
  }

  function limpiarNombreArchivo(v){
    return String(v||"")
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g,"-")
      .replace(/\s+/g," ")
      .replace(/[. ]+$/g,"")
      .trim()||"Documento";
  }

  function ensurePdfExportStyle(){
    let style=document.getElementById("nocPdfExportStyleV411");
    if(style)return style;
    style=document.createElement("style");
    style.id="nocPdfExportStyleV418";
    style.textContent=`
      .noc-pdf-export-host{width:210mm!important;background:#fff!important;margin:0!important;padding:0!important;box-sizing:border-box!important;}
      .noc-pdf-export-host .doc-sheet.noc-doc{width:210mm!important;max-width:210mm!important;min-width:210mm!important;min-height:0!important;height:auto!important;margin:0!important;padding:20mm 10mm 20mm!important;box-sizing:border-box!important;box-shadow:none!important;font-size:12px!important;background:#fff!important;color:#171717!important;overflow:visible!important;}
      .noc-pdf-export-host .noc-doc .doc-brand-row{grid-template-columns:1fr .9fr!important;gap:30px!important;margin-bottom:28px!important;}
      .noc-pdf-export-host .noc-doc .doc-title-box{text-align:right!important;}
      .noc-pdf-export-host .noc-doc .doc-meta{justify-content:end!important;}
      .noc-pdf-export-host .noc-doc .doc-address-grid{grid-template-columns:1fr 1fr!important;gap:34px!important;}
      .noc-pdf-export-host .noc-doc .doc-bottom{grid-template-columns:1fr 340px!important;gap:44px!important;}
      .noc-pdf-export-host .noc-doc .doc-footer{grid-template-columns:auto 1fr 1.25fr!important;gap:18px!important;}
      .noc-pdf-export-host .noc-doc .doc-thanks{grid-column:auto!important;}
      .noc-pdf-export-host .noc-doc .doc-items-spacer{height:var(--noc-doc-spacer,0px)!important;min-height:0!important;border:0!important;background:transparent!important;}
      .noc-pdf-export-host .noc-doc .doc-address-grid.doc-address-grid-single{grid-template-columns:1fr!important;}
      .noc-pdf-export-host .noc-doc .doc-contact-inline{margin-top:3px!important;padding-top:0!important;border:0!important;}
      .noc-pdf-export-host .noc-doc .doc-bottom{margin-top:10px!important;}
      .noc-pdf-export-host .noc-doc .doc-payment{gap:6px!important;padding-bottom:0!important;}
      .noc-pdf-export-host .noc-doc .doc-payment-line{gap:7px!important;line-height:1.1!important;}
      .noc-pdf-export-host .noc-doc .doc-payment-value{margin-top:0!important;}
      .noc-pdf-export-host .noc-doc .doc-total-box{border:0!important;}
      .noc-pdf-export-host .noc-doc .doc-total-row{padding:5px 8px!important;border:0!important;line-height:1.1!important;}
      .noc-pdf-export-host .noc-doc .doc-total-row strong{font-size:12px!important;}
      .noc-pdf-export-host .noc-doc .doc-grand-total{padding:8px 10px!important;font-size:16px!important;}
      .noc-pdf-export-host .noc-doc .doc-footer{margin-top:14px!important;padding-top:10px!important;}
      .noc-pdf-export-host .noc-doc .doc-bottom,.noc-pdf-export-host .noc-doc .doc-footer,.noc-pdf-export-host .noc-doc .doc-items tr{break-inside:avoid!important;page-break-inside:avoid!important;}.noc-pdf-export-host .noc-doc .doc-items thead{display:table-header-group!important;}
      .noc-pdf-export-host .noc-doc .doc-items{border-collapse:collapse!important;border:0!important;}
      .noc-pdf-export-host .noc-doc .doc-items th{padding-top:5px!important;padding-bottom:5px!important;border-left:0!important;border-right:0!important;border-top:0!important;border-bottom:1px solid rgba(0,0,0,.16)!important;}
      .noc-pdf-export-host .noc-doc .doc-items td{padding-top:4px!important;padding-bottom:4px!important;line-height:1.15!important;border-left:0!important;border-right:0!important;border-top:0!important;border-bottom:1px solid rgba(0,0,0,.045)!important;}
      .noc-pdf-export-host .noc-doc .doc-items tbody tr:last-child td{border-bottom:1px solid rgba(0,0,0,.08)!important;}
    `;
    document.head.appendChild(style);
    return style;
  }

  async function esperarImagenes(root){
    const imgs=Array.from(root.querySelectorAll("img"));
    await Promise.all(imgs.map(img=>{
      if(img.complete)return Promise.resolve();
      return new Promise(resolve=>{
        let done=false;
        const finish=()=>{if(done)return;done=true;resolve()};
        img.addEventListener("load",finish,{once:true});
        img.addEventListener("error",finish,{once:true});
        setTimeout(finish,1800);
      });
    }));
    if(document.fonts?.ready){try{await document.fonts.ready}catch(_){}}
  }

  async function pdfBlob({tipo,doc,lineas,config}){
    // V82: MISMO generador visual que el individual.
    if(typeof window.html2pdf!=="function" && typeof window.html2canvas!=="function")
      throw new Error("No se ha podido cargar el motor PDF.");
    const JsPDF=window.jspdf?.jsPDF || window.jsPDF;

    const host=document.createElement("div");
    host.setAttribute("aria-hidden","true");
    host.style.cssText="position:absolute;left:-30000px;top:0;width:210mm;background:#fff;pointer-events:none;";
    host.innerHTML=render({tipo,doc,lineas,config});
    document.body.appendChild(host);

    try{
      const sheet=host.querySelector(".doc-sheet.noc-doc");
      if(!sheet)throw new Error("No se ha podido preparar el documento para PDF.");
      await esperarImagenes(sheet);

      // EXACTAMENTE las mismas dos funciones que usa imprimirActual().
      const restoreLayout=aplicarLayoutFinalDocumento(sheet);
      let restorePages=()=>{};
      try{
        restorePages=await ajustarDocumentoAPaginas(sheet);
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

        const canvasOptions={
          scale:2,useCORS:true,logging:false,backgroundColor:"#ffffff",
          scrollX:0,scrollY:0,
          windowWidth:Math.max(document.documentElement.clientWidth,sheet.scrollWidth+40),
          windowHeight:Math.max(document.documentElement.clientHeight,sheet.scrollHeight+40)
        };

        let canvas;
        if(typeof window.html2canvas==="function"){
          canvas=await window.html2canvas(sheet,canvasOptions);
        }else{
          const worker=window.html2pdf().set({
            margin:0,html2canvas:canvasOptions,
            jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true}
          }).from(sheet).toCanvas();
          canvas=await worker.get("canvas");
        }

        let pdf;
        if(typeof JsPDF==="function"){
          pdf=new JsPDF({unit:"mm",format:"a4",orientation:"portrait",compress:true});
        }else{
          const w=window.html2pdf().set({
            margin:0,jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true}
          }).from(document.createElement("div")).toPdf();
          pdf=await w.get("pdf");
        }

        const pageW=210,pageH=297,mmPerPx=pageW/canvas.width;
        const naturalHmm=canvas.height*mmPerPx;

        if(naturalHmm<=pageH+0.75){
          const usablePx=Math.min(canvas.height,Math.floor(pageH/mmPerPx));
          if(usablePx<canvas.height){
            const one=document.createElement("canvas");
            one.width=canvas.width;one.height=usablePx;
            const ctx=one.getContext("2d");
            ctx.fillStyle="#fff";ctx.fillRect(0,0,one.width,one.height);
            ctx.drawImage(canvas,0,0,canvas.width,usablePx,0,0,canvas.width,usablePx);
            pdf.addImage(one.toDataURL("image/jpeg",0.98),"JPEG",0,0,pageW,pageH,undefined,"FAST");
          }else{
            pdf.addImage(canvas.toDataURL("image/jpeg",0.98),"JPEG",0,0,pageW,naturalHmm,undefined,"FAST");
          }
          return pdf.output("blob");
        }

        const cutPx=Math.floor(pageH/mmPerPx);
        let y=0,pageIndex=0;
        while(y<canvas.height){
          const h=Math.min(cutPx,canvas.height-y);
          const part=document.createElement("canvas");
          part.width=canvas.width;part.height=h;
          const ctx=part.getContext("2d");
          ctx.fillStyle="#fff";ctx.fillRect(0,0,part.width,part.height);
          ctx.drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);
          if(pageIndex>0)pdf.addPage("a4","portrait");
          pdf.addImage(part.toDataURL("image/jpeg",0.98),"JPEG",0,0,pageW,h*mmPerPx,undefined,"FAST");
          y+=h;pageIndex++;
        }
        return pdf.output("blob");
      }finally{
        try{restorePages?.()}catch(_){}
        try{restoreLayout?.()}catch(_){}
      }
    }finally{
      host.remove();
    }
  }
  function chunks(arr,size=50){
    const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out;
  }

  async function cargarLote(tipo,ids){
    const isPf=tipo==="PROFORMA";
    const table=isPf?"proformas":"facturas";
    const lineTable=isPf?"lineas_proforma":"lineas_factura";
    const fk=isPf?"proforma_id":"factura_id";
    const docs=[],lineas=[];
    for(const part of chunks(ids)){
      const [{data:d,error:de},{data:l,error:le}]=await Promise.all([
        NOC.API.db().from(table).select("*, clientes(*)").in("id",part),
        NOC.API.db().from(lineTable).select("*").in(fk,part).order("orden",{ascending:true})
      ]);
      if(de)throw de;if(le)throw le;
      docs.push(...(d||[]));lineas.push(...(l||[]));
    }
    const docMap=new Map(docs.map(d=>[d.id,d]));
    const lineasMap=new Map();
    lineas.forEach(l=>{const id=l[fk];if(!lineasMap.has(id))lineasMap.set(id,[]);lineasMap.get(id).push(l)});
    return{docs:ids.map(id=>docMap.get(id)).filter(Boolean),lineasMap};
  }

  function descargarBlob(blob,nombre){
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=nombre;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
  }

  async function generarZip({tipo,ids,zipName}){
    ids=[...new Set((ids||[]).filter(Boolean))];
    if(!ids.length)throw new Error("No hay documentos seleccionados.");
    if(typeof window.JSZip!=="function")throw new Error("No se ha podido cargar el motor ZIP. Comprueba la conexión a Internet y recarga la aplicación.");
    const label=tipo==="PROFORMA"?"proformas":"facturas";
    NOC.App.showProgress(`Preparando ${label}…`,`Cargando ${ids.length} documento(s)`);
    try{
      const [config,lote]=await Promise.all([getConfig(),cargarLote(tipo,ids)]);
      if(lote.docs.length!==ids.length)throw new Error(`Se han localizado ${lote.docs.length} de ${ids.length} documentos.`);
      const zip=new window.JSZip();
      for(let i=0;i<lote.docs.length;i++){
        const doc=lote.docs[i];
        NOC.App.updateProgress(`Generando PDF…`,`${i+1} de ${lote.docs.length} · ${doc.numero||""}`);
        const blob=await pdfBlob({tipo,doc,lineas:lote.lineasMap.get(doc.id)||[],config});
        const cliente=nombreArchivoCliente(doc);
        const nombre=limpiarNombreArchivo(`${doc.numero} - ${cliente}`)+".pdf";
        zip.file(nombre,blob);
      }
      NOC.App.updateProgress("Creando ZIP…",`${lote.docs.length} PDF preparados`);
      const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
      descargarBlob(blob,limpiarNombreArchivo(zipName||`${tipo==="PROFORMA"?"Proformas":"Facturas"}`)+".zip");
      NOC.App.hideProgress();
      NOC.App.alertMessage("ZIP preparado",`${lote.docs.length} PDF se han guardado dentro del ZIP.`,"success");
      return true;
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("No se ha podido generar el ZIP",String(e?.message||e||"Error desconocido"),"error");
      return false;
    }
  }

  return{render,getConfig,taxRates,imprimirActual,pdfBlob,generarZip,nombreArchivoCliente,limpiarNombreArchivo};
})();