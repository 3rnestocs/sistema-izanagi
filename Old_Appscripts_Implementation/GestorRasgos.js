// ==========================================
// 🧬 GESTOR DE RASGOS (V16.5 - LOGICA DIRECTA & REEMBOLSO)
// ==========================================

function ejecutarCambioRasgo() {
  // 🔥 VALIDACIÓN DE SEGURIDAD (WHITELIST V17)
  const correoUsuario = Session.getActiveUser().getEmail();
  if (CONFIG.STAFF_EMAILS && CONFIG.STAFF_EMAILS.length > 0 && !CONFIG.STAFF_EMAILS.includes(correoUsuario)) {
      MasterUI.error(`⛔ ACCESO DENEGADO\n\nTu cuenta (${correoUsuario || "Anónima"}) no tiene privilegios de Administrador para ejecutar esta acción.`);
      return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. ⚙️ SETUP
  const hojaGestor = getSheet(CONFIG.HOJA_GRASGOS);
  const hojaRasgos = getSheet(CONFIG.HOJA_RASGOS);
  const hojaDatos = getSheet(CONFIG.HOJA_DATOS);

  // 2. ⚡ LECTURA DE INPUTS
  const keko = hojaGestor.getRange(CONFIG.COORD_GRASGOS_INPUT_KEKO).getValue();
  const accion = hojaGestor.getRange(CONFIG.COORD_GRASGOS_INPUT_ACCION).getValue();
  const nombreRasgo = hojaGestor.getRange(CONFIG.COORD_GRASGOS_INPUT_RASGO).getValue();
  const fechaCustom = hojaGestor.getRange(CONFIG.COORD_GRASGOS_INPUT_FECHA).getValue();
  
  // Leemos el costo directo de la DB (Sin invertir signos aquí)
  const costoBaseDB = Number(hojaGestor.getRange(CONFIG.COORD_GRASGOS_INFO_COSTO).getValue()) || 0;

  // 🛡️ VALIDACIÓN UI
  if (!keko || !accion || !nombreRasgo) {
    MasterUI.alerta("⚠️ Faltan datos obligatorios. Por favor revisa el formulario.");
    return;
  }

  const hojaPJ = ss.getSheetByName(keko);
  if (!hojaPJ) { 
    MasterUI.error(`La ficha de '${keko}' no existe en el sistema.`); 
    return; 
  }

  // 3. 🔍 OBTENER DATOS DEL RASGO (DB)
  const dataRasgos = hojaRasgos.getDataRange().getValues();
  const rasgoData = dataRasgos.find(r => String(r[0]).trim().toUpperCase() === String(nombreRasgo).trim().toUpperCase());
  
  if (!rasgoData) { 
    MasterUI.error(`El rasgo '${nombreRasgo}' no existe en la Base de Datos.`); 
    return; 
  }

  // 4. ⚡ DEFINIR ACCIÓN
  let rawAsignar = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_ASIGNAR).getValue()).trim() || "Asignar";
  let rawRetirar = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_RETIRAR).getValue()).trim() || "Retirar";

  const isAsignar = String(accion).toUpperCase() === rawAsignar.toUpperCase();
  const isRetirar = String(accion).toUpperCase() === rawRetirar.toUpperCase();

  // 5. 📜 LECTURA LISTA ACTUAL
  const celdaLista = hojaPJ.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA); 
  let textoActual = String(celdaLista.getValue());
  if (textoActual.startsWith("=") || textoActual === "-") textoActual = "";

  let listaRasgosPJ = textoActual.split(",").map(r => r.trim()).filter(r => r !== "");

  // ======================================================
  // 🟢 LÓGICA: ASIGNAR (COMPRA DIRECTA)
  // ======================================================
  if (isAsignar) {
    if (listaRasgosPJ.some(r => r.toUpperCase() === String(nombreRasgo).toUpperCase())) {
      MasterUI.error(`${keko} ya tiene asignado el rasgo '${nombreRasgo}'.`);
      return;
    }

    // B.0 VALIDACIÓN DE CATEGORÍA ÚNICA
    // Leemos la lista de categorías prohibidas de repetir desde Datos
    let categoriasUnicas = [];
    try {
        const rangoCats = SpreadsheetApp.getActiveSpreadsheet().getRange(CONFIG.COORD_DATOS_CATS_RESTRICTIVAS);
        const vals = rangoCats.getValues();
        // Aplanamos, limpiamos y convertimos a mayúsculas
        categoriasUnicas = vals.flat()
            .map(c => String(c).trim().toUpperCase())
            .filter(c => c !== "");
    } catch(e) {
        // Fail-Safe: Si falla la lectura, al menos protegemos Origen por defecto
        categoriasUnicas = ["ORIGEN", "NACIMIENTO"];
    }

    const categoriaNuevo = String(rasgoData[1]).trim().toUpperCase(); // Columna B en DB Rasgos

    if (categoriasUnicas.includes(categoriaNuevo)) {
      for (let rasgoUsuario of listaRasgosPJ) {
        const infoRasgoUsuario = dataRasgos.find(r => String(r[0]).trim().toUpperCase() === rasgoUsuario.toUpperCase());
        if (infoRasgoUsuario) {
          const catUsuario = String(infoRasgoUsuario[1]).trim().toUpperCase();
          if (catUsuario === categoriaNuevo) {
            MasterUI.error(`⛔ BLOQUEO DE CATEGORÍA\n\nEl usuario ya posee un rasgo de tipo '${categoriaNuevo}' (${rasgoUsuario}) y esta categoría es única.`);
            return;
          }
        }
      }
    }

    // B.1 VALIDACIÓN DE INCOMPATIBILIDAD
    const idxIncomp = CONFIG.INDICE_DB_RASGOS_INCOMPATIBLES || 9;
    const rawIncomp = String(rasgoData[idxIncomp]).trim();
    if (rawIncomp && rawIncomp !== "-" && rawIncomp !== "") {
       const listaIncompatibles = rawIncomp.split(",").map(i => i.trim().toUpperCase());
       const misRasgosUpper = listaRasgosPJ.map(r => r.toUpperCase());
       for (let enemigo of listaIncompatibles) {
         if (misRasgosUpper.includes(enemigo)) {
           MasterUI.error(`⛔ CONFLICTO DE RASGOS\n\nEl rasgo '${nombreRasgo}' es incompatible con '${enemigo}'.`);
           return;
         }
       }
    }

    // B.2 LÓGICA DE FONDOS (DIRECTA)
    // Usamos el valor directo de la DB (igual que en GenerarFicha V16.4)
    // Asumimos: DB Negativo = Gasto (Va a Gastado). DB Positivo = Ingreso (Va a Total).
    const impactoEnBolsillo = costoBaseDB; 
    
    // Validación de fondos: Solo si es negativo (Gasto) verificamos si hay disponible
    const rcDisponibles = Number(hojaPJ.getRange(CONFIG.COORD_FICHA_DISP_RC).getValue()) || 0;
    
    if (impactoEnBolsillo < 0 && rcDisponibles < Math.abs(impactoEnBolsillo)) {
        const resp = MasterUI.solicitarAutorizacion(`El usuario no tiene fondos suficientes (${rcDisponibles} RC). ¿Asignar GRATIS?`);
        if (resp !== SpreadsheetApp.getUi().Button.YES) return; 
        // Si admin autoriza, dejamos el impacto tal cual (o podríamos ponerlo en 0 si fuera un regalo real)
        // Mantendremos el costo para el log para que cuadre la contabilidad.
    }

    // C. EJECUTAR
    listaRasgosPJ.push(nombreRasgo);
    celdaLista.setValue(listaRasgosPJ.join(", "));
    modificarStats(hojaPJ, rasgoData, 1); 
    
    // 🖋️ LOG DIRECTO
    const LOG_CAT = hojaDatos.getRange(CONFIG.COORD_DATOS_CAT_RASGO).getValue() || "Rasgo";
    
    systemLog({
      keko: keko,
      categoria: LOG_CAT,
      detalle: nombreRasgo,
      evidencia: "Gestor Rasgos",
      recursos: { rc: impactoEnBolsillo } ,
      fechaOverride: fechaCustom
    });

    let msg = `Se asignó '${nombreRasgo}'.`;
    if (impactoEnBolsillo > 0) msg += `\n(+) Total aumentado en ${impactoEnBolsillo} RC.`;
    else if (impactoEnBolsillo < 0) msg += `\n(-) Gastaste ${Math.abs(impactoEnBolsillo)} RC.`;
    
    MasterUI.exito(msg);
  }

  // ======================================================
  // 🔴 LÓGICA: RETIRAR (REEMBOLSO INVERSO)
  // ======================================================
  else if (isRetirar) {
    const index = listaRasgosPJ.findIndex(r => r.toUpperCase() === String(nombreRasgo).toUpperCase());
    
    if (index === -1) {
      MasterUI.error(`El usuario ${keko} no tiene el rasgo '${nombreRasgo}'.`);
      return;
    }
    
    listaRasgosPJ.splice(index, 1);
    celdaLista.setValue(listaRasgosPJ.length > 0 ? listaRasgosPJ.join(", ") : "-");
    modificarStats(hojaPJ, rasgoData, -1); 
    
    // CÁLCULO DE REEMBOLSO
    // Aquí SÍ invertimos el signo para cancelar la operación original.
    // Si costó -2 (Gasto), devolvemos +2 (Ingreso).
    // Si dio +2 (Total), restamos -2 (Corrección).
    const reembolso = costoBaseDB * -1;

    systemLog({
      keko: keko,
      categoria: "Rasgo (Retiro)",
      detalle: nombreRasgo + " [REMOVIDO]",
      evidencia: "Gestor Rasgos",
      recursos: { rc: reembolso },
      fechaOverride: fechaCustom
    });

    MasterUI.exito(`Rasgo '${nombreRasgo}' retirado.\nAjuste RC: ${reembolso}`);
  }

  // LIMPIEZA
  hojaGestor.getRange(CONFIG.COORD_GRASGOS_CLEAR_INPUTS).clearContent();
  hojaGestor.getRange(CONFIG.COORD_GRASGOS_INPUT_FECHA).clearContent();
  try { actualizarRCDisponible(hojaGestor); } catch(e) {}
}

// ==========================================
// 🛠️ HELPERS
// ==========================================

function modificarStats(hojaPJ, dataRasgo, multiplicador) {
  const aplicar = (stat, op, val) => {
    if (!stat || stat === "-" || (op !== "+" && String(op).toUpperCase() !== "SUMA")) return;
    
    const rangoNombres = hojaPJ.getRange(CONFIG.COORD_FICHA_STATS_NOMBRES).getValues();
    
    for (let i = 0; i < rangoNombres.length; i++) {
      if (String(rangoNombres[i][0]).trim() === stat) {
        // Usamos la coordenada BASE (H) definida en Config
        const celdaBase = hojaPJ.getRange(CONFIG.COORD_FICHA_STATS_BASE).getCell(i+1, 1); 
        const valorActual = Number(celdaBase.getValue()) || 0;
        celdaBase.setValue(valorActual + (val * multiplicador));
        break;
      }
    }
  };
  aplicar(dataRasgo[3], dataRasgo[4], Number(dataRasgo[5]));
  aplicar(dataRasgo[6], dataRasgo[7], Number(dataRasgo[8]));
}

function actualizarRCDisponible(sheet) {
  const keko = sheet.getRange(CONFIG.COORD_GRASGOS_INPUT_KEKO).getValue();
  const celdaDisp = sheet.getRange(CONFIG.COORD_GRASGOS_INFO_RC);
  if (!keko) { celdaDisp.setValue("-"); return; }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPJ = ss.getSheetByName(keko);
  
  if (!hojaPJ) { celdaDisp.setValue("⛔ No existe"); return; }
  
  const rc = hojaPJ.getRange(CONFIG.COORD_FICHA_DISP_RC).getValue();
  celdaDisp.setValue(rc);
}