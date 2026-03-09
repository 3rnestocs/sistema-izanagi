// ==========================================
// 💾 GENERADOR DE REGISTROS (V17.6 - FAIL-FAST SENTINEL)
// ==========================================

function registrarAccion() {

  // 🔥 VALIDACIÓN DE SEGURIDAD
  const correoUsuario = Session.getActiveUser().getEmail();
  if (CONFIG.STAFF_EMAILS && CONFIG.STAFF_EMAILS.length > 0 && !CONFIG.STAFF_EMAILS.includes(correoUsuario)) {
      MasterUI.error(`⛔ ACCESO DENEGADO\n\nTu cuenta (${correoUsuario || "Anónima"}) no tiene privilegios.`);
      return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaForm = getSheet(CONFIG.HOJA_GREGIS);
  const hojaUsuarios = getSheet(CONFIG.HOJA_USUARIOS);
  const hojaDatos = getSheet(CONFIG.HOJA_DATOS);
  const hojaRasgos = getSheet(CONFIG.HOJA_RASGOS); 

  // 1. INPUTS BÁSICOS
  const dataForm = hojaForm.getRange(CONFIG.COORD_GREGISTROS_INPUTS_FULL).getValues();
  const rawB2   = String(dataForm[0][0]).trim(); 
  const categoria = String(dataForm[1][0]).trim();    
  const rawB4   = String(dataForm[2][0]).trim(); 
  const evidencia = String(dataForm[3][0]).trim();    
  const fechaCustomInput = dataForm[10] ? dataForm[10][0] : null;

  const recursosInput = {
    ryou:  Number(dataForm[4][0]) || 0, 
    exp:   Number(dataForm[5][0]) || 0, 
    pr:    Number(dataForm[6][0]) || 0, 
    sp:    Number(dataForm[7][0]) || 0, 
    cupos: Number(dataForm[8][0]) || 0, 
    rc:    Number(dataForm[9][0]) || 0 
  };

  // 2. 🛡️ DETECCIÓN DE MODO ESPEJO (FAIL-FAST)
  // Ya no usamos try-catch silencioso. Si la config está mal, el sistema debe avisar.
  const coordsEspeciales = CONFIG.CATEGORIAS_DROPDOWN_USERS || [];
  let categoriasEspejo = [];
  
  if (coordsEspeciales.length > 0) {
      coordsEspeciales.forEach(coord => {
        // Validación: Si la celda está vacía en Datos, podría ser un error de config.
        const val = String(hojaDatos.getRange(coord).getValue()).trim();
        if (val) categoriasEspejo.push(val.toUpperCase());
      });
  }

  const esModoEspejo = categoriasEspejo.includes(categoria.toUpperCase());

  // 3. DEFINICIÓN DE ROLES
  const KEY_ALL_USERS = String(hojaUsuarios.getRange(CONFIG.COORD_USUARIOS_KEY_ALL).getValue()).trim();
  let protagonistas = []; 
  let secundarios = [];   
  let detalleBase = "";

  // Helper para leer usuarios reales
  const getUsuariosReales = () => {
     const lastRowUsers = hojaUsuarios.getLastRow();
     if (lastRowUsers <= 3) return [];
     return hojaUsuarios.getRange(CONFIG.COORD_USUARIOS_TOTALES).getValues()
            .flat().filter(u => u && String(u).trim() !== "" && u !== KEY_ALL_USERS && u !== "-");
  };

  if (esModoEspejo) {
    // MODO ESPEJO (Curación/Combate)
    if (!rawB4) { MasterUI.alerta("⛔ ERROR UX: En modo espejo, el Beneficiario (Ganador/Médico) va en B4."); return; }
    
    protagonistas = [rawB4]; 
    secundarios = (rawB2 === KEY_ALL_USERS) ? getUsuariosReales() : rawB2.split(",").map(u => u.trim()).filter(u => u !== "");

    if (secundarios.length === 0) { MasterUI.alerta("⛔ ERROR DE DATOS: Lista de afectados (B2) vacía."); return; }
    if (!ss.getSheetByName(rawB4)) { MasterUI.error(`⛔ ERROR CRÍTICO: El beneficiario '${rawB4}' no tiene ficha.`); return; }

  } else {
    // MODO NORMAL
    detalleBase = rawB4;
    protagonistas = (rawB2 === KEY_ALL_USERS) ? getUsuariosReales() : rawB2.split(",").map(u => u.trim()).filter(u => u !== "");

    if (protagonistas.length === 0) { MasterUI.alerta("⚠️ ALERTA: No hay usuarios seleccionados en B2."); return; }
  }

  // 4. VALIDACIONES DE RECURSOS
  const rawAdminCats = hojaDatos.getRange(CONFIG.COORD_LOGS_CATS_ADMIN).getValues();
  const categoriasAdmin = rawAdminCats.flat().map(c => String(c).trim());
  const esAdmin = categoriasAdmin.includes(categoria);
  const hayRecursos = Object.values(recursosInput).some(v => v !== 0);

  if (!hayRecursos && !esAdmin) { 
      MasterUI.alerta("⚠️ REGISTRO VACÍO: Faltan recursos o no es categoría administrativa."); return; 
  }
  
  if (!rawB2 || !categoria || !rawB4) { MasterUI.alerta("⚠️ DATOS INCOMPLETOS."); return; }

  // Confirmación de Alto Impacto
  const totalOperaciones = protagonistas.length + secundarios.length;
  if (totalOperaciones > 5) { // Bajé el umbral para ser más seguro
    if (MasterUI.confirmar(`🛡️ CONFIRMACIÓN MASIVA\nVas a impactar a ${totalOperaciones} usuarios.\n¿Proceder?`) !== SpreadsheetApp.getUi().Button.YES) return;
  }

  // ============================================================
  // 🧠 MOTOR DE PROCESAMIENTO
  // ============================================================
  const dataRasgosDB = hojaRasgos.getDataRange().getValues();
  const VOCAB_GANANCIA = String(hojaDatos.getRange(CONFIG.VOCABULARIO_GANANCIA).getValue()).trim(); 
  const VOCAB_GASTO = String(hojaDatos.getRange(CONFIG.VOCABULARIO_GASTO).getValue()).trim(); 
  
  // Mapeo DB para Bonos
  const MAP_RECURSOS_DB = {
    ryou: String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_RYOU).getValue()).trim(),
    exp:  String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_EXP).getValue()).trim(),
    pr:   String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_PR).getValue()).trim(),
    sp:   String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_SP).getValue()).trim(),
    cupos: String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_CUPOS).getValue()).trim(),
    rc:   String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_RC).getValue()).trim()
  };

  let agrupadorBonos = {}; 

  // A. PROTAGONISTAS
  protagonistas.forEach(usuario => {
    let recursosFinales = { ...recursosInput }; 
    let textoDetalle = detalleBase;

    if (esModoEspejo) {
        const NOMBRE_CAT_CURACION = String(hojaDatos.getRange(CONFIG.COORD_DATOS_CAT_CURACION_TXT).getValue()).trim().toUpperCase();
        const esCuracion = categoria.toUpperCase() === NOMBRE_CAT_CURACION;
        const listaNombres = secundarios.join(", ");
        const listaVisual = listaNombres.length > 50 ? listaNombres.substring(0, 47) + "..." : listaNombres;
        
        textoDetalle = esCuracion ? `Paciente(s): ${listaVisual}` : `Victoria vs: ${listaVisual}`;
    }

    // CÁLCULO DE BONOS (RASGOS)
    const hojaPJ = ss.getSheetByName(usuario);
    if (hojaPJ) {
      const rasgosStr = String(hojaPJ.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA).getValue());
      const misRasgos = rasgosStr.split(",").map(r => r.trim().toUpperCase());

      for (const [key, valorBase] of Object.entries(recursosFinales)) {
        if (valorBase === 0) continue; 
        const contexto = valorBase > 0 ? VOCAB_GANANCIA : VOCAB_GASTO;
        const nombreRecursoDB = MAP_RECURSOS_DB[key]; 
        
        dataRasgosDB.forEach(filaRasgo => {
            const nombreRasgoBD = String(filaRasgo[0]).trim();
            if (misRasgos.includes(nombreRasgoBD.toUpperCase())) {
                const valorAnterior = recursosFinales[key]; 
                let modificacionAplicada = false;
                
                const aplicarBono = (colAfecta, colOp, colVal) => {
                    const afecta = String(colAfecta).trim();
                    if (afecta.includes(nombreRecursoDB) && afecta.includes(contexto)) {
                        const factor = Number(colVal);
                        if (!isNaN(factor)) {
                            const op = String(colOp).trim().toUpperCase();
                            if (op === "*" || op === "MULTIPLICA") recursosFinales[key] *= factor;
                            else if (op === "+" || op === "SUMA") recursosFinales[key] += factor;
                            else if (op === "-" || op === "RESTA") recursosFinales[key] -= factor;
                            else if (op === "/" || op === "DIVIDE") recursosFinales[key] /= factor;
                            modificacionAplicada = true;
                        }
                    }
                };
                aplicarBono(filaRasgo[3], filaRasgo[4], filaRasgo[5]);
                aplicarBono(filaRasgo[6], filaRasgo[7], filaRasgo[8]);

                if (modificacionAplicada && valorAnterior !== recursosFinales[key]) {
                   const firmaEvento = `${key.toUpperCase()} (${Math.round(valorAnterior)} ➔ ${Math.round(recursosFinales[key])}) [${nombreRasgoBD}]`;
                   if (!agrupadorBonos[firmaEvento]) agrupadorBonos[firmaEvento] = [];
                   agrupadorBonos[firmaEvento].push(usuario);
                }
            }
        });
        recursosFinales[key] = Math.round(recursosFinales[key]);
      }
    }

    systemLog({
      keko: usuario,
      categoria: categoria,
      detalle: textoDetalle,
      evidencia: evidencia || "Generador Registros",
      recursos: recursosFinales,
      fechaOverride: fechaCustomInput 
    });
  });

  // B. SECUNDARIOS (Modo Espejo)
  if (esModoEspejo && secundarios.length > 0) {
    const NOMBRE_CAT_CURACION = String(hojaDatos.getRange(CONFIG.COORD_DATOS_CAT_CURACION_TXT).getValue()).trim().toUpperCase();
    const esCuracion = categoria.toUpperCase() === NOMBRE_CAT_CURACION;
    const textoDetalleSecundario = esCuracion ? `Atendido por: ${rawB4}` : `Derrota vs: ${rawB4}`;

    secundarios.forEach(usuarioSec => {
        systemLog({
            keko: usuarioSec,
            categoria: categoria,
            detalle: textoDetalleSecundario,
            evidencia: evidencia || "Generador Registros (Espejo)",
            recursos: { exp: 0, ryou: 0, pr: 0, sp: 0, rc: 0, cupos: 0 },
            fechaOverride: fechaCustomInput
        });
    });
  }

  // 5. LIMPIEZA & UI RESTORE
  hojaForm.getRange(CONFIG.COORD_GREGISTROS_INPUT_KEKO).clearContent(); 
  hojaForm.getRange(CONFIG.COORD_GREGISTROS_INPUT_EVIDENCIA).clearContent(); 
  hojaForm.getRange(CONFIG.COORD_GREGISTROS_INPUT_RECURSOS).clearContent(); 
  hojaForm.getRange(CONFIG.COORD_GREGISTROS_INPUT_DETALLE).clearContent().clearDataValidations(); 
  hojaForm.getRange(CONFIG.COORD_GREGISTROS_INPUT_FECHA).clearContent();
  
  // Restaurar labels
  hojaForm.getRange(CONFIG.COORD_LABEL_USUARIOS).setValue("Usuarios (Kekos)");
  hojaForm.getRange(CONFIG.COORD_LABEL_DETALLE).setValue("Detalle");

  // 6. REPORTE FINAL
  let msg = `✅ REGISTRO COMPLETADO`;
  if (esModoEspejo) msg += `\n👤 Beneficiario: ${rawB4}\n👥 Afectados: ${secundarios.length} usuarios.`;
  else msg += `\n👥 Usuarios procesados: ${protagonistas.length}`;

  const llavesBonos = Object.keys(agrupadorBonos);
  if (llavesBonos.length > 0) {
      msg += `\n\n🔍 BONIFICACIONES:\n`;
      let lineasReporte = [];
      llavesBonos.forEach(firma => {
          const usuariosAfectados = agrupadorBonos[firma];
          lineasReporte.push(`• ${usuariosAfectados.join(", ")}: ${firma}`);
      });
      if (lineasReporte.length > 6) {
          msg += lineasReporte.slice(0, 5).join("\n") + `\n... y ${lineasReporte.length - 5} más.`;
      } else {
          msg += lineasReporte.join("\n");
      }
  }

  MasterUI.exito(msg);
}