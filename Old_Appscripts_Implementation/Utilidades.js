// ==========================================
// 🛠️ UTILIDADES GLOBALES (V16.0 - SSOT & LOGS)
// ==========================================

function obtenerSiguienteFilaVacia(hoja) {
  const valoresA = hoja.getRange("A1:A").getValues();
  for (let i = valoresA.length - 1; i >= 0; i--) {
    if (valoresA[i][0] !== "" && valoresA[i][0] != null) return i + 2; 
  }
  return 3;
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(`⛔ ERROR CRÍTICO`, `No se encuentra la hoja "${name}".\nVerifica el nombre en la pestaña inferior.`, ui.ButtonSet.OK);
    throw new Error(`Hoja no encontrada: ${name}`);
  }
  return sheet;
}

// ==========================================
// 🎨 MASTER UI WRAPPER
// ==========================================
const MasterUI = {
  exito: (mensaje) => SpreadsheetApp.getUi().alert(CONFIG.UI_TITULOS.EXITO, mensaje, SpreadsheetApp.getUi().ButtonSet.OK),
  error: (mensaje) => SpreadsheetApp.getUi().alert(CONFIG.UI_TITULOS.ERROR, mensaje, SpreadsheetApp.getUi().ButtonSet.OK),
  alerta: (mensaje) => SpreadsheetApp.getUi().alert(CONFIG.UI_TITULOS.ALERTA, mensaje, SpreadsheetApp.getUi().ButtonSet.OK),
  confirmar: (mensaje) => SpreadsheetApp.getUi().alert(CONFIG.UI_TITULOS.CONFIRMAR, mensaje, SpreadsheetApp.getUi().ButtonSet.YES_NO),
  solicitarAutorizacion: (mensaje) => SpreadsheetApp.getUi().alert(CONFIG.UI_TITULOS.ADMIN, mensaje, SpreadsheetApp.getUi().ButtonSet.YES_NO)
};

// ==========================================
// 🖋️ SYSTEM LOG (V17.6 - FECHAS CUSTOM)
// ==========================================
function systemLog({ keko, categoria, detalle, evidencia = "Sistema", recursos = {}, fechaOverride = null }) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaLogs = ss.getSheetByName(CONFIG.HOJA_LOGS);
  if (!hojaLogs) throw new Error("No se encontró la hoja de Logs.");

  // Lógica de Fecha Dinámica
  let fecha = new Date();
  if (fechaOverride && String(fechaOverride).trim() !== "") {
    let parsedDate = new Date(fechaOverride);
    // Verificar si la fecha custom es válida
    if (!isNaN(parsedDate.getTime())) {
      fecha = parsedDate;
    }
  }

  const filaData = [
    fecha,                          // A: Fecha
    keko,                           // B: Jugador
    categoria,                      // C: Categoría
    detalle,                        // D: Detalle
    evidencia,                      // E: Evidencia
    Number(recursos.ryou) || 0,     // F
    Number(recursos.exp) || 0,      // G
    Number(recursos.pr) || 0,       // H
    Number(recursos.sp) || 0,       // I
    Number(recursos.cupos) || 0,    // J
    Number(recursos.rc) || 0        // K
  ];

  const siguienteFila = obtenerSiguienteFilaVacia(hojaLogs);
  const rango = hojaLogs.getRange(siguienteFila, 1, 1, 11);
  
  rango.setValues([filaData]);
  rango.setFontFamily("Roboto Mono");
  rango.getCell(1, 1).setNumberFormat("dd/MM/yyyy"); 
  
  return true;
}

// ==========================================
// 📂 ACTUALIZAR DIRECTORIO (V16 - LECTURA CORREGIDA)
// ==========================================
function actualizarDirectorio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaDirectorio = ss.getSheetByName(CONFIG.HOJA_USUARIOS);
  const hojas = ss.getSheets();
  
  if (!hojaDirectorio) return; 

  // Lista negra de hojas de sistema
  const hojasSistema = Object.values(CONFIG).filter(val => 
    typeof val === 'string' && !val.includes(":") && !val.match(/^[A-Z]+\d+$/)
  );

  let datos = [];
  hojasSistema.push("Template", "Prototipo", "Modelo"); // Extras por seguridad

  hojas.forEach(hoja => {
    const nombre = hoja.getName();
    if (hojasSistema.includes(nombre)) return;

    try {
      // Validación: Si tiene celda "Keko" (B2)
      const keko = hoja.getRange(CONFIG.COORD_GENFICHA_INPUT_KEKO).getValue();
      if (!keko || String(keko).trim() === "" || keko === "Keko") return;

      // Lectura V16: Usamos COORD_FICHA_TOTAL_... (Columna H)
      const pj = hoja.getRange(CONFIG.COORD_GENFICHA_INPUT_NOMBRE).getValue(); 
      const nivel = hoja.getRange(CONFIG.COORD_GENFICHA_INPUT_NIVEL).getValue();
      const rango = hoja.getRange(CONFIG.COORD_GENFICHA_INPUT_RANGO).getValue();
      
      const ryou = hoja.getRange(CONFIG.COORD_FICHA_TOTAL_RYOU).getValue(); // H3
      const exp  = hoja.getRange(CONFIG.COORD_FICHA_TOTAL_EXP).getValue();  // H4
      const pr   = hoja.getRange(CONFIG.COORD_FICHA_TOTAL_PR).getValue();   // H5
      
      datos.push([keko, pj, nivel, rango, exp, pr, ryou]);
    } catch (e) {
      // Si falla leyendo una hoja (ej. no es ficha), la ignora
    }
  });
  
  // Ordenar alfabéticamente
  datos.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const ultimaFila = hojaDirectorio.getLastRow();
  if (ultimaFila > 3) hojaDirectorio.getRange(4, 1, ultimaFila - 3, 7).clearContent();
  if (datos.length > 0) hojaDirectorio.getRange(4, 1, datos.length, 7).setValues(datos);
}

function FACTORY_RESET_TOTAL() {
  // 🔥 VALIDACIÓN DE SEGURIDAD (WHITELIST V17)
  const correoUsuario = Session.getActiveUser().getEmail();
  if (CONFIG.STAFF_EMAILS && CONFIG.STAFF_EMAILS.length > 0 && !CONFIG.STAFF_EMAILS.includes(correoUsuario)) {
      MasterUI.error(`⛔ ACCESO DENEGADO\n\nTu cuenta (${correoUsuario || "Anónima"}) no tiene privilegios de Administrador para ejecutar esta acción.`);
      return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 🛡️ CONFIRMACIÓN AMIGABLE (MasterUI)
  const mensajeConfirmacion = 
    "Estás a punto de reiniciar el sistema completo.\n\n" +
    "• Se eliminarán todas las fichas de personajes.\n" +
    "• Se borrará todo el historial de Logs y Transacciones.\n" +
    "• Se vaciarán las Plazas y el Directorio.\n\n" +
    "Solo quedarán las hojas de configuración y bases de datos.\n" +
    "¿Estás seguro de que deseas proceder?";

  // Usamos confirmar (YES/NO)
  if (MasterUI.confirmar(mensajeConfirmacion) !== SpreadsheetApp.getUi().Button.YES) return;

  // 2. 🕵️ DETECCIÓN DE HOJAS DEL SISTEMA (Protección)
  // Filtramos valores de CONFIG que sean nombres de hojas (excluyendo coordenadas tipo "A1" o "B2:B")
  const hojasSistema = Object.values(CONFIG).filter(val => 
    typeof val === 'string' && 
    !val.includes(":") && 
    !val.match(/^[A-Z]+\d+$/)
  );
  
  // Agregamos protecciones extra manuales por seguridad
  hojasSistema.push("Template", "Prototipo", "Modelo"); 

  // 3. 🧹 BORRADO DE FICHAS
  const todasLasHojas = ss.getSheets();
  let contadorBorradas = 0;

  todasLasHojas.forEach(hoja => {
    const nombre = hoja.getName();
    // Si la hoja NO está en la lista blanca del sistema, se borra
    if (!hojasSistema.includes(nombre)) {
      try { ss.deleteSheet(hoja); contadorBorradas++; } catch (e) {}
    }
  });

  // 4. 🧼 LIMPIEZA DE REGISTROS E INPUTS
  const limpiar = (nombreHoja, rango) => { 
    const s = ss.getSheetByName(nombreHoja); 
    if (s) {
      try { s.getRange(rango).clearContent(); } catch(e) {}
    }
  };

  // A. Bases de datos principales
  limpiar(CONFIG.HOJA_LOGS, "A3:K");       // Borrar historial
  limpiar(CONFIG.HOJA_USUARIOS, "A4:G");   // Borrar directorio
  
  // B. Plazas (Mantener habilidades, borrar dueños)
  // Asumiendo que la lista de dueños está en la columna G (índice 6 + 1 = 7) hacia abajo
  const colPlazas = (CONFIG.INDICE_PLAZA_LISTA || 6) + 1; 
  const letraCol = String.fromCharCode(64 + colPlazas); // Convierte número a letra (7=G)
  limpiar(CONFIG.HOJA_PLAZAS, `${letraCol}2:${letraCol}`);

  // C. Limpieza de Formularios (Para dejar los gestores listos para usar)
  limpiar(CONFIG.HOJA_GFICHA, CONFIG.COORD_GENFICHA_INPUTS_FULL);
  limpiar(CONFIG.HOJA_GTRANSAC, CONFIG.COORD_GTRANS_INPUTS_FULL);
  limpiar(CONFIG.HOJA_GREGIS, CONFIG.COORD_GREGISTROS_INPUTS_FULL);
  limpiar(CONFIG.HOJA_GASCENSOS, CONFIG.COORD_GASCENSOS_INPUTS_FULL);
  limpiar(CONFIG.HOJA_GRASGOS, CONFIG.COORD_GRASGOS_INPUTS_FULL);
  
  // Limpiezas específicas de Habilidades y Stats
  if (ss.getSheetByName(CONFIG.HOJA_GHABS)) {
      ss.getSheetByName(CONFIG.HOJA_GHABS).getRange(CONFIG.COORD_GHABS_CLEAR_INPUTS).clearContent();
  }
  if (ss.getSheetByName(CONFIG.HOJA_GSTATS)) {
      ss.getSheetByName(CONFIG.HOJA_GSTATS).getRange(CONFIG.COORD_GSTATS_INPUT_KEKO).clearContent();
      ss.getSheetByName(CONFIG.HOJA_GSTATS).getRange(CONFIG.COORD_GSTATS_INPUTS_VALORES).setValue(0);
  }

  // 5. ✅ FINALIZACIÓN
  MasterUI.exito(`♻️ SISTEMA REINICIADO\n\nFichas eliminadas: ${contadorBorradas}\nLogs y formularios limpiados.`);
}

// 🔥 MENÚ STAFF ACTUALIZADO (V17.7)
function menuStaff() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🛡️ Menú Staff')
    .addItem('💸 Ejecutar Pago Semanal', 'iniciarProcesoSueldos')
    .addSeparator()
    .addItem('🧹 Mantenimiento: Ordenar Logs', 'MANTENIMIENTO_ORDENAR_LOGS')
    .addItem('📂 Mantenimiento: Actualizar Directorio', 'actualizarDirectorio') // NUEVO
    .addToUi();
}

function onOpen() {
  menuStaff(); // Carga el menú al abrir el documento
}

function iniciarProcesoSueldos() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) {
      MasterUI.error("🚦 SISTEMA OCUPADO. Intenta en unos segundos.");
      return;
    }

    // 🔥 NUEVO: VALIDACIÓN DE SEGURIDAD (WHITELIST)
    const correoUsuario = Session.getActiveUser().getEmail();
    // Validamos solo si hay correos configurados y si el usuario actual no está en la lista
    if (CONFIG.STAFF_EMAILS && CONFIG.STAFF_EMAILS.length > 0 && !CONFIG.STAFF_EMAILS.includes(correoUsuario)) {
        MasterUI.error(`⛔ ACCESO DENEGADO\n\nTu cuenta (${correoUsuario || "Desconocida"}) no tiene privilegios de Staff para dar los sueldos.`);
        return;
    }

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaDatos = ss.getSheetByName(CONFIG.HOJA_DATOS);
    
    // 1. VALIDACIÓN ANTI-DUPLICADOS (Semáforo)
    const celdaSemaforo = hojaDatos.getRange(CONFIG.COORD_SEMAFORO_SUELDOS);
    const ultimaFechaCobro = String(celdaSemaforo.getValue()).trim();
    
    // 2. PROMPT DE FECHA (Para tu migración)
    const prompt = ui.prompt(
      "🛡️ EJECUCIÓN DE SUELDOS",
      `Último cobro registrado: ${ultimaFechaCobro || "Ninguno"}\n\nDejar en blanco para usar la fecha de HOY.\nPara pagos atrasados, ingresa la fecha (Ej: 2026-02-16):`,
      ui.ButtonSet.OK_CANCEL
    );

    if (prompt.getSelectedButton() !== ui.Button.OK) return;

    let fechaProceso = new Date();
    const inputFecha = prompt.getResponseText().trim();
    
    if (inputFecha) {
      fechaProceso = new Date(inputFecha + "T12:00:00"); // Se fuerza mediodía para evitar saltos de zona horaria
      if (isNaN(fechaProceso.getTime())) {
        MasterUI.error("⛔ Formato de fecha inválido. Usa YYYY-MM-DD.");
        return;
      }
    }

    if (MasterUI.confirmar(`¿Confirmas el pago masivo con fecha: ${fechaProceso.toLocaleDateString()}?`) !== ui.Button.YES) return;

    // --- 🧠 INICIO DEL MOTOR DE CÁLCULO ---
    const hojaUsuarios = ss.getSheetByName(CONFIG.HOJA_USUARIOS);
    const hojaRasgos = ss.getSheetByName(CONFIG.HOJA_RASGOS);
    
    // Lectura SSOT
    const expUniversal = Number(hojaDatos.getRange(CONFIG.COORD_DATOS_SUELDO_EXP).getValue());
    if (isNaN(expUniversal)) throw new Error("EXP Universal no definido en Config (Datos).");

    const tablaCargos = hojaDatos.getRange(CONFIG.COORD_TABLA_CARGOS).getValues(); // M3:S11
    const tablaRasgos = hojaRasgos.getDataRange().getValues();
    
    // Obtener lista de usuarios activos desde el Directorio (Fila 4 hacia abajo)
    const lastUserRow = hojaUsuarios.getLastRow();
    if (lastUserRow < 4) { MasterUI.alerta("No hay usuarios en el directorio."); return; }
    const listaUsuarios = hojaUsuarios.getRange(4, 1, lastUserRow - 3, 1).getValues().flat().filter(u => u);

    let logsBatch = [];
    let contadorExitos = 0;

    // Iterar por cada personaje vivo
    listaUsuarios.forEach(keko => {
      const hojaPJ = ss.getSheetByName(keko);
      if (!hojaPJ) return; // Si la ficha no existe, se salta (Fail-Safe)

      let ryouTotalGanado = 0;
      let expTotalGanado = expUniversal;
      let desgloseMensaje = [`+${expUniversal} EXP`];

      // A. CÁLCULO DE CARGO
      const cargoPJ = String(hojaPJ.getRange(CONFIG.COORD_GENFICHA_INPUT_RANGO).getValue()).trim(); // Asumiendo B7 / Cargo Social
      const datosCargo = tablaCargos.find(r => String(r[0]).trim().toUpperCase() === cargoPJ.toUpperCase());
      
      if (datosCargo) {
        const sueldoCargo = Number(datosCargo[1]) || 0; // Columna N (Índice 1 de M3:S11)
        if (sueldoCargo > 0) {
          ryouTotalGanado += sueldoCargo;
          desgloseMensaje.push(`+${sueldoCargo} Ryou (${cargoPJ})`);
        }
      }

      // B. CÁLCULO DE RASGOS Y MULTIPLICADORES
      const rasgosStr = String(hojaPJ.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA).getValue()).toUpperCase();
      const misRasgos = rasgosStr.split(",").map(r => r.trim());

      let multiplicadorSaldo = 1; // Base 1
      let nombreRasgoMulti = "";

      misRasgos.forEach(miRasgo => {
        const filaRasgo = tablaRasgos.find(r => String(r[0]).trim().toUpperCase() === miRasgo);
        if (filaRasgo) {
          // B.1 Sueldos Planos (Noble, Rico, Acomodado...)
          const bonoRyou = Number(filaRasgo[CONFIG.COL_RASGOS_SUELDO_RYOU]) || 0;
          if (bonoRyou > 0) {
            ryouTotalGanado += bonoRyou;
            desgloseMensaje.push(`+${bonoRyou}¥ (${filaRasgo[0]})`);
          }
          
          // B.2 Multiplicadores de Saldo Total (Ambicioso, Derrochador)
          const multiLunes = Number(filaRasgo[CONFIG.COL_RASGOS_MULTI_LUNES]);
          if (multiLunes && multiLunes > 0) { 
            multiplicadorSaldo = multiLunes;
            nombreRasgoMulti = String(filaRasgo[0]).trim();
          }
        }
      });

      // C. APLICAR MULTIPLICADOR SOBRE EL TOTAL
      if (multiplicadorSaldo !== 1) {
          // 1. Leemos el saldo actual que el personaje ya tiene en la ficha
          const saldoActual = Number(hojaPJ.getRange(CONFIG.COORD_FICHA_DISP_RYOU).getValue()) || 0;
          
          // 2. Proyectamos cuánto tendrá después de cobrar su sueldo base
          const saldoProyectado = saldoActual + ryouTotalGanado;
          
          // 3. Calculamos la diferencia neta que genera el rasgo
          const diferenciaMultiplicador = (saldoProyectado * multiplicadorSaldo) - saldoProyectado;
          const difRedondeada = Math.round(diferenciaMultiplicador);
          
          // 4. Lo sumamos a la ganancia de este log (puede ser negativo si es Derrochador)
          ryouTotalGanado += difRedondeada;
          
          // 5. Agregamos al detalle visual
          if (difRedondeada > 0) desgloseMensaje.push(`+${difRedondeada}¥ (${nombreRasgoMulti})`);
          else if (difRedondeada < 0) desgloseMensaje.push(`${difRedondeada}¥ (${nombreRasgoMulti})`);
      }

      // C. PREPARAR LOG ATÓMICO (BATCH)
      // Array con estructura exacta de systemLog: [Fecha, Keko, Cat, Detalle, Evid, Ryou, EXP, PR, SP, Cupos, RC]
      logsBatch.push([
        fechaProceso, 
        keko, 
        "Sueldo Semanal", 
        desgloseMensaje.join(" | "), 
        "Sistema Automático", 
        ryouTotalGanado, 
        expTotalGanado, 
        0, 0, 0, 0
      ]);
      
      contadorExitos++;
    });

    // 4. ESCRITURA MASIVA (PERFORMANCE V17)
    if (logsBatch.length > 0) {
      const hojaLogs = ss.getSheetByName(CONFIG.HOJA_LOGS);
      const siguienteFila = obtenerSiguienteFilaVacia(hojaLogs);
      const rangoDestino = hojaLogs.getRange(siguienteFila, 1, logsBatch.length, 11);
      
      rangoDestino.setValues(logsBatch);
      rangoDestino.setFontFamily("Roboto Mono");
      hojaLogs.getRange(siguienteFila, 1, logsBatch.length, 1).setNumberFormat("dd/MM/yyyy");
      
      // Actualizar Semáforo
      celdaSemaforo.setValue(fechaProceso.toLocaleDateString());
    }

    MasterUI.exito(`✅ SUELDOS PROCESADOS\n\nSe ha emitido el pago para ${contadorExitos} personajes correctamente.`);

  } catch (e) {
    MasterUI.error("❌ ERROR CRÍTICO: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 🧹 MANTENIMIENTO: ORDENAR LOGS (MANUAL)
// ==========================================
function MANTENIMIENTO_ORDENAR_LOGS() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaLogs = ss.getSheetByName(CONFIG.HOJA_LOGS);
  
  ui.toast("⏳ Ordenando historial cronológicamente...");
  
  const ultimaFila = hojaLogs.getLastRow();
  if (ultimaFila >= 3) {
    // Asumiendo encabezados en filas 1 y 2
    const rangoCompleto = hojaLogs.getRange(3, 1, ultimaFila - 2, 11);
    rangoCompleto.sort({column: 1, ascending: true});
    ui.toast("✅ Logs ordenados correctamente.");
  } else {
    ui.toast("ℹ️ No hay logs para ordenar.");
  }
}