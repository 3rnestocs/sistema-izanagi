// ==========================================
// 💸 GESTOR DE TRANSACCIONES (V17.6 - ATOMIC LOCK, TACAÑO & TIME TRAVEL)
// ==========================================

function procesarTransaccion() {
  const lock = LockService.getScriptLock();
  try {
    const success = lock.tryLock(10000);
    if (!success) {
      MasterUI.error("🚦 SISTEMA OCUPADO\nOtro administrador está ejecutando una transacción. Intenta en unos segundos.");
      return;
    }

  // 🔥 VALIDACIÓN DE SEGURIDAD (WHITELIST V17)
  const correoUsuario = Session.getActiveUser().getEmail();
  if (CONFIG.STAFF_EMAILS && CONFIG.STAFF_EMAILS.length > 0 && !CONFIG.STAFF_EMAILS.includes(correoUsuario)) {
      MasterUI.error(`⛔ ACCESO DENEGADO\n\nTu cuenta (${correoUsuario || "Anónima"}) no tiene privilegios de Administrador para ejecutar esta acción.`);
      return;
  }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. ⚙️ SETUP
    const hojaGestor = getSheet(CONFIG.HOJA_GTRANSAC);
    const hojaMercado = getSheet(CONFIG.HOJA_MERCADO);
    const hojaDatos = getSheet(CONFIG.HOJA_DATOS);
    const hojaRasgos = getSheet(CONFIG.HOJA_RASGOS);

    const ACCION_COMPRAR = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_COMPRAR).getValue()).trim();
    const ACCION_VENDER = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_VENDER).getValue()).trim();
    const ACCION_TRANSFERIR = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_TRANSFERIR).getValue()).trim();

    // 3. ⚡ LECTURA DE INPUTS (Incluyendo Fecha Custom)
    const inputs = hojaGestor.getRange(CONFIG.COORD_GTRANS_INPUTS_FULL).getValues();
    const kekoOrigen = String(inputs[0][0]).trim(); 
    const accion = String(inputs[1][0]).trim();     
    const destino = String(inputs[2][0]).trim();    
    const rawItems = String(inputs[3][0]).trim();   
    const fechaCustom = inputs[8] ? inputs[8][0] : null; // Índice 8 corresponde a B10

    // 🛡️ VALIDACIÓN UI
    if (!kekoOrigen || !accion || !destino || !rawItems) {
      MasterUI.alerta("⚠️ Faltan datos. Revisa Keko, Acción, Destino o Items.");
      return;
    }

    const hojaPJ_Origen = getSheet(kekoOrigen);
    const listaItems = rawItems.split(",").map(i => i.trim());

    // 4. 🧠 DERIVACIÓN DE LÓGICA ATÓMICA
    if (accion === ACCION_COMPRAR) {
      moduloCompraAtomic(ss, kekoOrigen, destino, listaItems, hojaPJ_Origen, hojaMercado, hojaDatos, hojaRasgos, fechaCustom);
    } 
    else if (accion === ACCION_VENDER) {
      moduloVentaAtomic(ss, kekoOrigen, destino, listaItems, hojaPJ_Origen, hojaMercado, fechaCustom);
    } 
    else if (accion === ACCION_TRANSFERIR) {
      moduloTransferenciaAtomic(ss, kekoOrigen, destino, listaItems, hojaPJ_Origen, hojaRasgos, fechaCustom);
    } 
    else {
      MasterUI.error(`Acción '${accion}' no reconocida.`);
      return;
    }

    // 🧹 LIMPIEZA FINAL Y ORDENAMIENTO
    hojaGestor.getRange(CONFIG.COORD_GTRANS_INPUT_ITEMS).clearContent();
    hojaGestor.getRange(CONFIG.COORD_GTRANS_INPUT_FECHA).clearContent(); // Limpia la fecha custom
    hojaGestor.getRange(CONFIG.COORD_GTRANS_INFO_SALDO).clearContent(); 
    hojaGestor.getRange(CONFIG.COORD_GTRANS_INFO_COSTO).clearContent(); 

    if (typeof actualizarVistaPrevia === 'function') {
      actualizarVistaPrevia(hojaGestor);
    }
    
    hojaGestor.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setValue("✅ OPERACIÓN OK");

  } catch (e) {
    MasterUI.error("❌ ERROR CRÍTICO: Rollback ejecutado.\n\nDetalle: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

// =========================================================
// 🛍️ MÓDULO DE COMPRA ATÓMICA
// =========================================================
function moduloCompraAtomic(ss, keko, tienda, items, hojaPJ, hojaMercado, hojaDatos, hojaRasgos, fechaCustom) {
  const SHOP_MERCADO = hojaDatos.getRange(CONFIG.COORD_TIENDA_MERCADO_REF).getValue(); 
  const SHOP_PR = hojaDatos.getRange(CONFIG.COORD_TIENDA_PR_REF).getValue();      

  const RES_RYOU = String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_RYOU).getValue()).trim();
  const RES_EXP  = String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_EXP).getValue()).trim();
  const RES_PR   = String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_PR).getValue()).trim();

  let monedaPago = RES_EXP; 
  let celdaSaldo = CONFIG.COORD_FICHA_DISP_EXP; 

  if (tienda === SHOP_MERCADO) { monedaPago = RES_RYOU; celdaSaldo = CONFIG.COORD_FICHA_DISP_RYOU; }
  if (tienda === SHOP_PR) { monedaPago = RES_PR; celdaSaldo = CONFIG.COORD_FICHA_DISP_PR; }

  const saldoDisponible = Number(hojaPJ.getRange(celdaSaldo).getValue()) || 0;

  // Lógica de Rasgos (Multiplicadores y Tacaño)
  let multiplicador = 1.0;
  let saldoMinimoRequerido = 0;
  const WORD_GASTO = String(hojaDatos.getRange(CONFIG.VOCABULARIO_GASTO).getValue()).trim().toUpperCase();
  let monedaCheck = monedaPago.toUpperCase();
  const dataRasgosBD = hojaRasgos.getDataRange().getValues();
  const rasgosUsuarioStr = String(hojaPJ.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA).getValue());
  const listaRasgosPJ = rasgosUsuarioStr.split(",").map(r => r.trim().toUpperCase());

  dataRasgosBD.forEach(fila => {
    if (listaRasgosPJ.includes(String(fila[0]).trim().toUpperCase())) {
      if (String(fila[3]).toUpperCase().includes(monedaCheck) && String(fila[3]).toUpperCase().includes(WORD_GASTO) && (fila[4] === "*" || String(fila[4]).toUpperCase() === "MULTIPLICA")) multiplicador *= Number(fila[5]);
      if (String(fila[6]).toUpperCase().includes(monedaCheck) && String(fila[6]).toUpperCase().includes(WORD_GASTO) && (fila[7] === "*" || String(fila[7]).toUpperCase() === "MULTIPLICA")) multiplicador *= Number(fila[8]);

      const minBal = Number(fila[CONFIG.COL_RASGOS_SALDO_MINIMO]) || 0;
      if (minBal > saldoMinimoRequerido) saldoMinimoRequerido = minBal;
    }
  });

  const colNombre = (tienda === SHOP_MERCADO) ? CONFIG.INDICE_MERCADO_NINJA_NOMBRE : CONFIG.INDICE_TIENDAS_EXTRA_NOMBRE; 
  const colPrecio = (tienda === SHOP_MERCADO) ? CONFIG.INDICE_MERCADO_NINJA_PRECIO : CONFIG.INDICE_TIENDAS_EXTRA_PRECIO;
  const todoMercado = hojaMercado.getDataRange().getValues();

  let costoTotalAcumulado = 0;
  let itemsParaInv = [];
  let itemsNombresLog = [];

  items.forEach(nombreItem => {
    const itemEncontrado = todoMercado.find(fila => String(fila[colNombre]).trim().toUpperCase() === nombreItem.toUpperCase());
    if (itemEncontrado) {
      costoTotalAcumulado += Math.ceil(Number(itemEncontrado[colPrecio]) * multiplicador);
      itemsNombresLog.push(nombreItem);
      
      let esObjetoFisico = true;
      if (esObjetoFisico) itemsParaInv.push({nombre: nombreItem, tipo: (tienda === SHOP_MERCADO ? itemEncontrado[0] : "Objeto")});
    } else {
        throw new Error(`Item no encontrado: ${nombreItem}`);
    }
  });

  if (saldoDisponible < costoTotalAcumulado) {
    throw new Error(`FONDOS INSUFICIENTES. Tienes ${saldoDisponible}, necesitas ${costoTotalAcumulado}.`);
  }

  if (monedaPago === RES_RYOU && (saldoDisponible - costoTotalAcumulado) < saldoMinimoRequerido) {
    throw new Error(`⛔ RESTRICCIÓN DE RASGO: Debes mantener al menos ${saldoMinimoRequerido} Ryou intactos en tu ficha.`);
  }

  if (MasterUI.confirmar(`¿Comprar ${items.length} items por ${costoTotalAcumulado} ${monedaPago}?`) !== SpreadsheetApp.getUi().Button.YES) return;

  // ATOMICIDAD
  let itemsAgregadosRealmente = [];

  try {
    if (itemsParaInv.length > 0) {
        itemsAgregadosRealmente = agregarAlInventarioAtomic(hojaPJ, itemsParaInv);
    }

    let recursosLog = {};
    const claveRecurso = monedaPago.toLowerCase(); 
    if (claveRecurso.includes("ryou")) recursosLog.ryou = -costoTotalAcumulado;
    else if (claveRecurso.includes("exp")) recursosLog.exp = -costoTotalAcumulado;
    else if (claveRecurso.includes("pr")) recursosLog.pr = -costoTotalAcumulado;

    systemLog({
        keko: keko,
        categoria: "Compra (" + tienda + ")",
        detalle: itemsNombresLog.join(", "),
        evidencia: "Gestor Transacción",
        recursos: recursosLog,
        fechaOverride: fechaCustom // 🔥 INYECCIÓN DE FECHA
    });

    MasterUI.exito(`Compra exitosa.`);

  } catch (error) {
    if (itemsAgregadosRealmente.length > 0) {
        itemsAgregadosRealmente.forEach(itemName => quitarDelInventario(hojaPJ, itemName));
    }
    throw error; 
  }
}

// =========================================================
// 💰 MÓDULO DE VENTA ATÓMICA
// =========================================================
function moduloVentaAtomic(ss, keko, tienda, items, hojaPJ, hojaMercado, fechaCustom) {
  const todoMercado = hojaMercado.getDataRange().getValues();
  const colNombre = CONFIG.INDICE_MERCADO_NINJA_NOMBRE; 
  const colPrecio = CONFIG.INDICE_MERCADO_NINJA_PRECIO;

  let totalReembolso = 0;
  let itemsRemovidos = [];
  let itemsFallidos = [];

  items.forEach(item => {
      const dato = todoMercado.find(r => String(r[colNombre]).trim().toUpperCase() === item.toUpperCase());
      if (dato) {
          totalReembolso += Math.ceil(Number(dato[colPrecio]) * CONFIG.CONST_CONST_PORCENTAJE_VENTA);
      }
  });

  try {
      items.forEach(item => {
        if (quitarDelInventario(hojaPJ, item)) {
          itemsRemovidos.push(item);
        } else {
          itemsFallidos.push(item);
        }
      });

      if (itemsRemovidos.length === 0) {
          throw new Error("No tienes ninguno de esos items.");
      }

      systemLog({
        keko: keko,
        categoria: "Venta",
        detalle: `Vendió a ${tienda}: ${itemsRemovidos.join(", ")}`,
        evidencia: "Gestor Transacción",
        recursos: { ryou: totalReembolso },
        fechaOverride: fechaCustom // 🔥 INYECCIÓN DE FECHA
      });
      
      let msg = `Venta procesada por ${totalReembolso} Ryou.`;
      if (itemsFallidos.length > 0) msg += `\n⚠️ No encontrados: ${itemsFallidos.join(", ")}`;
      MasterUI.exito(msg);

  } catch (error) {
      if (itemsRemovidos.length > 0) {
          agregarAlInventarioAtomic(hojaPJ, itemsRemovidos.map(i => ({nombre: i, tipo: "Objeto"})));
      }
      throw error;
  }
}

// =========================================================
// 🎁 MÓDULO DE TRANSFERENCIA ATÓMICA (V17.6)
// =========================================================
function moduloTransferenciaAtomic(ss, origen, destino, items, hojaPJ_Origen, hojaRasgos, fechaCustom) {
  const hojaPJ_Destino = getSheet(destino); 
  
  let restringeTransferencia = false;
  let rasgoLimitante = "";
  
  const rasgosUsuarioStr = String(hojaPJ_Origen.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA).getValue());
  const listaRasgosPJ = rasgosUsuarioStr.split(",").map(r => r.trim().toUpperCase());
  const dataRasgosBD = hojaRasgos.getDataRange().getValues();

  dataRasgosBD.forEach(fila => {
    if (listaRasgosPJ.includes(String(fila[0]).trim().toUpperCase())) {
      if (String(fila[CONFIG.COL_RASGOS_BLOQUEA_TRANSFER]).toUpperCase() === "SI") {
        restringeTransferencia = true;
        rasgoLimitante = String(fila[0]).trim();
      }
    }
  });

  const intentandoCederDinero = items.some(item => String(item).toUpperCase().includes("RYOU"));

  if (restringeTransferencia && intentandoCederDinero) {
     throw new Error(`⛔ RESTRICCIÓN DE RASGO: Debido a '${rasgoLimitante}', tienes prohibido ceder dinero a otros personajes.`);
  }

  let itemsTransferidos = [];
  let itemsFallidos = [];

  try {
      items.forEach(item => {
        if (quitarDelInventario(hojaPJ_Origen, item)) {
          itemsTransferidos.push(item);
        } else {
          itemsFallidos.push(item);
        }
      });

      if (itemsTransferidos.length === 0) {
          throw new Error("No tienes items para transferir.");
      }

      agregarAlInventarioAtomic(hojaPJ_Destino, itemsTransferidos.map(i => ({nombre: i, tipo: "Objeto"})));

      systemLog({
        keko: origen,
        categoria: "Intercambio",
        detalle: `Transfirió a ${destino}: ${itemsTransferidos.join(", ")}`,
        evidencia: "Gestor Transacción",
        recursos: { ryou: 0 },
        fechaOverride: fechaCustom // 🔥 INYECCIÓN DE FECHA
      });

      systemLog({
        keko: destino,
        categoria: "Intercambio",
        detalle: `Recibió de ${origen}: ${itemsTransferidos.join(", ")}`,
        evidencia: "Gestor Transacción",
        recursos: { ryou: 0 },
        fechaOverride: fechaCustom // 🔥 INYECCIÓN DE FECHA
      });

      let msg = `Transferencia de ${itemsTransferidos.join(", ")} al usuario ${destino}.`;
      if (itemsFallidos.length > 0) msg += `\n⚠️ No encontrados en tu inventario: ${itemsFallidos.join(", ")}`;
      MasterUI.exito(msg);

  } catch (error) {
      if (itemsTransferidos.length > 0) {
          agregarAlInventarioAtomic(hojaPJ_Origen, itemsTransferidos.map(i => ({nombre: i, tipo: "Objeto"})));
      }
      throw error;
  }
}

// =========================================================
// 🛠️ HELPERS (V16 CONFIG UPDATE)
// =========================================================

function quitarDelInventario(hoja, item) {
  const rango = hoja.getRange(CONFIG.COORD_FICHA_INVENTARIO_FULL);
  const data = rango.getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === String(item).trim().toUpperCase()) {
      data[i][0] = "-"; data[i][1] = "-"; 
      rango.setValues(data); 
      return true;
    }
  }
  return false;
}

function agregarAlInventarioAtomic(hoja, listaItems) {
  const rango = hoja.getRange(CONFIG.COORD_FICHA_INVENTARIO_FULL);
  const data = rango.getValues();
  let itemsParaAgregar = [...listaItems];
  let slotsDisponibles = 0;
  let indicesLibres = [];

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "" || data[i][0] === "-") {
        slotsDisponibles++;
        indicesLibres.push(i);
    }
  }

  if (slotsDisponibles < itemsParaAgregar.length) {
      throw new Error(`Inventario lleno. Necesitas ${itemsParaAgregar.length} espacios.`);
  }

  let agregadosNames = [];
  for (let k = 0; k < itemsParaAgregar.length; k++) {
      let idxReal = indicesLibres[k];
      data[idxReal][0] = itemsParaAgregar[k].nombre;
      data[idxReal][1] = itemsParaAgregar[k].tipo;
      agregadosNames.push(itemsParaAgregar[k].nombre);
  }

  rango.setValues(data);
  return agregadosNames;
}