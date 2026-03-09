// ==========================================
// 📈 GESTOR DE ASCENSOS (V17.3 - SSOT BLINDADO)
// ==========================================

function registrarAscenso() {
  const lock = LockService.getScriptLock();
  try {
    const success = lock.tryLock(10000); 
    if (!success) {
      MasterUI.error("🚦 SISTEMA OCUPADO. Intenta de nuevo.");
      return;
    }

  // 🔥 VALIDACIÓN DE SEGURIDAD (WHITELIST V17)
  const correoUsuario = Session.getActiveUser().getEmail();
  if (CONFIG.STAFF_EMAILS && CONFIG.STAFF_EMAILS.length > 0 && !CONFIG.STAFF_EMAILS.includes(correoUsuario)) {
      MasterUI.error(`⛔ ACCESO DENEGADO\n\nTu cuenta (${correoUsuario || "Anónima"}) no tiene privilegios de Administrador para ejecutar esta acción.`);
      return;
  }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaGestor = getSheet(CONFIG.HOJA_GASCENSOS);
    const hojaDatos = getSheet(CONFIG.HOJA_DATOS);

    // 1. LECTURA DE TEXTOS SSOT (Hoja Datos)
    // Leemos los nombres exactos de las acciones para usarlos en Inputs y Logs
    const ACCION_CARGO = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_SUBIR_CARGO).getValue()).trim();
    const ACCION_RANGO = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_SUBIR_RANGO).getValue()).trim();

    // 2. LECTURA DE INPUTS
    const keko = hojaGestor.getRange(CONFIG.COORD_GASCENSOS_INPUT_KEKO).getValue();
    const accionSeleccionada = String(hojaGestor.getRange(CONFIG.COORD_GASCENSOS_INPUT_ACCION).getValue()).trim();
    
    const objetivo = String(hojaGestor.getRange(CONFIG.COORD_GASCENSOS_INPUT_OBJETIVO).getValue()).trim();
    const estadoSemaforo = String(hojaGestor.getRange(CONFIG.COORD_GASCENSOS_INFO_ESTADO).getValue()).toUpperCase();
    const fechaCustom = hojaGestor.getRange(CONFIG.COORD_GASCENSOS_INPUT_FECHA).getValue();

    // 3. VALIDACIONES
    if (!keko || !accionSeleccionada || !objetivo) {
      MasterUI.alerta("⚠️ Faltan datos. Asegúrate de seleccionar usuario y acción.");
      return;
    }
    
    if (estadoSemaforo.includes("BLOQUEADO") || estadoSemaforo.includes("MÁXIMO")) {
      MasterUI.error("⛔ NO SE PUEDE ASCENDER.\nEl estado actual no permite la operación.");
      return;
    }

    if (estadoSemaforo.includes("VALIDAR") || estadoSemaforo.includes("REQUIERE")) {
      const confirm = MasterUI.confirmar(`⚠️ ALERTA DE REQUISITOS\n\nEl sistema indica que hay logros pendientes de validación manual.\n¿Confirmas que el usuario ha cumplido todo?`);
      if (confirm !== SpreadsheetApp.getUi().Button.YES) return;
    } else {
      if (MasterUI.confirmar(`¿Ascender a ${keko} a '${objetivo}'?`) !== SpreadsheetApp.getUi().Button.YES) return;
    }

    const hojaPJ = ss.getSheetByName(keko);
    if (!hojaPJ) { MasterUI.error("Ficha no encontrada."); return; }

    // 4. LÓGICA DE PROCESAMIENTO
    let celdaDestinoFicha = "";
    let recompensaSP = 0;
    let tipoLog = ""; // Variable para el Log SSOT

    // --- CASO A: SUBIDA DE RANGO (Numérico: D1->D2) ---
    if (accionSeleccionada === ACCION_RANGO) {
      celdaDestinoFicha = CONFIG.COORD_FICHA_NIVEL_EXACTO; // B6
      tipoLog = ACCION_RANGO; // Usamos el texto real de Datos (G23)

      // Buscar Recompensa SP en Tabla Rangos
      const tablaRangos = hojaDatos.getRange(CONFIG.COORD_TABLA_RANGOS).getValues();
      const datosNivel = tablaRangos.find(r => String(r[0]).trim().toUpperCase() === objetivo.toUpperCase());
      
      if (datosNivel) {
        recompensaSP = Number(datosNivel[2]) || 0; // Columna 3 (Índice 2) es SP
      }
    } 
    // --- CASO B: ASCENSO DE CARGO (Social: Genin->Chuunin) ---
    else if (accionSeleccionada === ACCION_CARGO) {
      celdaDestinoFicha = CONFIG.COORD_FICHA_RANGO_LETRA; // B7
      tipoLog = ACCION_CARGO; // Usamos el texto real de Datos (G22)
      recompensaSP = 0; 
    }
    else {
      MasterUI.error(`La acción '${accionSeleccionada}' no coincide con G22/G23 en Datos.`);
      return;
    }

    // 5. EJECUCIÓN
    // A. Actualizar Ficha
    hojaPJ.getRange(celdaDestinoFicha).setValue(objetivo);

    // B. Generar Log
    let detalleLog = `Ascenso a ${objetivo}`;
    let recursosLog = { sp: 0 };

    if (recompensaSP > 0) {
      recursosLog.sp = recompensaSP;
      detalleLog += ` (+${recompensaSP} SP)`;
    }

    systemLog({
      keko: keko,
      categoria: tipoLog, // Pasamos el valor dinámico
      detalle: detalleLog,
      evidencia: "Gestor Ascensos",
      recursos: recursosLog,
      fechaOverride: fechaCustom
    });

    // 6. LIMPIEZA
    hojaGestor.getRange(CONFIG.COORD_GASCENSOS_CLEAR_DATA).clearContent();
    hojaGestor.getRange(CONFIG.COORD_GASCENSOS_INFO_ESTADO).setBackground(null);
    hojaGestor.getRange(CONFIG.COORD_GASCENSOS_INPUT_FECHA).clearContent();
    
    // Refresco UI
    if (typeof actualizarInfoAscenso === 'function') {
      actualizarInfoAscenso(hojaGestor);
    }
    MasterUI.exito(`✅ ¡Felicidades! ${keko} es ahora ${objetivo}.`);
  } catch (e) {
    MasterUI.error("Error al procesar ascenso: " + e.message);
  } finally {
    lock.releaseLock();
  }
}