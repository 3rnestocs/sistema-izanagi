// ==========================================
// 📊 GESTOR DE STATS (V17.5 - CONFIG REFERENCE)
// ==========================================

function procesarDistribucionStats() {
  const lock = LockService.getScriptLock();
  try {
    const success = lock.tryLock(5000); 
    if (!success) {
      MasterUI.error("🚦 SISTEMA OCUPADO\nOtro proceso está editando stats.");
      return;
    }

    // VALIDACIÓN DE SEGURIDAD
    const correoUsuario = Session.getActiveUser().getEmail();
    if (CONFIG.STAFF_EMAILS && CONFIG.STAFF_EMAILS.length > 0 && !CONFIG.STAFF_EMAILS.includes(correoUsuario)) {
        MasterUI.error("⛔ ACCESO DENEGADO");
        return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaGestor = getSheet(CONFIG.HOJA_GSTATS);
    const hojaDatos = getSheet(CONFIG.HOJA_DATOS);
    const hojaRasgos = getSheet(CONFIG.HOJA_RASGOS);
    
    // 1. OBTENER INPUTS
    const keko = hojaGestor.getRange(CONFIG.COORD_GSTATS_INPUT_KEKO).getValue();
    const inputs = hojaGestor.getRange(CONFIG.COORD_GSTATS_INPUTS_VALORES).getValues(); 
    const labels = hojaGestor.getRange(CONFIG.COORD_GSTATS_LABELS_STATS).getValues();
    const fechaCustom = hojaGestor.getRange(CONFIG.COORD_GSTATS_INPUT_FECHA).getValue();

    if (!keko) { MasterUI.alerta("⚠️ Selecciona un usuario."); return; }
    const hojaPersonaje = ss.getSheetByName(keko);
    if (!hojaPersonaje) { MasterUI.error("Ficha no encontrada."); return; }

    // 2. LEER DATOS MAESTROS
    const nivelPJ = String(hojaPersonaje.getRange(CONFIG.COORD_FICHA_NIVEL_EXACTO).getValue()).trim(); // Ej: "B" o "D1"
    const letraNivel = nivelPJ.charAt(0).toUpperCase();

    // A. Leer Caps Numéricos
    const dataCaps = hojaDatos.getRange(CONFIG.COORD_TABLA_LIMITES_CAPS).getValues();
    let capIndexNormal = 2; 
    const filaCap = dataCaps.find(r => String(r[0]).trim() === letraNivel);
    if (filaCap) capIndexNormal = Number(filaCap[1]);

    // B. 🔥 Leer Regla Asimétrica desde CONFIG (No DB)
    // Comparamos si el Nivel actual (o su letra) coincide con lo definido en Config.
    // Soporta que nivelPJ sea "B" o "B1" si configuramos "B".
    const rangoConfig = String(CONFIG.RANGO_LIMITE_ASIMETRICO || "").trim().toUpperCase();
    const esRangoAsimetrico = (nivelPJ.toUpperCase() === rangoConfig || letraNivel === rangoConfig);

    // CONSTANTES
    const NOM_CHAKRA = String(hojaDatos.getRange(CONFIG.COORD_DATOS_STAT_CHAKRA).getValue()).trim().toUpperCase();
    const NOM_ARMAS = String(hojaDatos.getRange(CONFIG.COORD_DATOS_STAT_ARMAS).getValue()).trim().toUpperCase();
    const NOM_VELOCIDAD = String(hojaDatos.getRange(CONFIG.COORD_DATOS_STAT_VELOCIDAD).getValue()).trim().toUpperCase();
    const RASGO_LENTO = String(hojaRasgos.getRange(CONFIG.COORD_RASGO_LENTO).getValue()).trim().toUpperCase();
    const RASGO_TORPEZA = String(hojaRasgos.getRange(CONFIG.COORD_RASGO_TORPEZA).getValue()).trim().toUpperCase();

    // 3. ESTADO ACTUAL
    const rangoBase = hojaPersonaje.getRange(CONFIG.COORD_FICHA_STATS_BASE).getValues();
    const rangoRepartidos = hojaPersonaje.getRange(CONFIG.COORD_FICHA_STATS_REPARTIDOS);
    const valoresRepartidos = rangoRepartidos.getValues();
    const rangoBonos = hojaPersonaje.getRange(CONFIG.COORD_FICHA_STATS_BONOS).getValues();

    // 4. VALIDAR BLOQUEOS
    const rasgosPJ = String(hojaPersonaje.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA).getValue()).toUpperCase();
    const tieneTorpeza = rasgosPJ.includes(RASGO_TORPEZA);
    const tieneLento = rasgosPJ.includes(RASGO_LENTO);

    let totalGastoSP = 0;
    let nuevosRepartidos = [...valoresRepartidos];
    let cambiosLog = [];
    let statsEnMaximo = 0;
    
    // PRE-SCAN
    if (esRangoAsimetrico) {
        for (let i = 0; i < valoresRepartidos.length; i++) {
            const nombre = String(labels[i][0]).trim().toUpperCase();
            if (nombre === NOM_CHAKRA) continue; 
            
            const totalStat = Number(rangoBase[i][0]) + Number(valoresRepartidos[i][0]) + Number(rangoBonos[i][0]);
            if (totalStat >= 5) statsEnMaximo++;
        }
    }

    // 5. BUCLE DE PROCESAMIENTO
    for (let i = 0; i < inputs.length; i++) {
      const spInvertir = Number(inputs[i][0]) || 0;
      if (spInvertir === 0) continue;

      const nombreStat = String(labels[i][0]).trim().toUpperCase();
      const esChakra = (nombreStat === NOM_CHAKRA);
      
      if (nombreStat === NOM_ARMAS && tieneTorpeza && spInvertir > 0) throw new Error(`⛔ TORPEZA: No puedes invertir en ${nombreStat}.`);
      if (nombreStat === NOM_VELOCIDAD && tieneLento && spInvertir > 0) throw new Error(`⛔ LENTO: No puedes invertir en ${nombreStat}.`);

      const spActuales = Number(valoresRepartidos[i][0]);
      const baseIndex = Number(rangoBase[i][0]);
      const bonoIndex = Number(rangoBonos[i][0]);
      
      const nuevoSPTotal = spActuales + spInvertir;
      const indiceTotalProyectado = baseIndex + nuevoSPTotal + bonoIndex;

      if (esChakra) {
          const inversionProyectada = Number(rangoBase[i][0]) + ((spActuales + spInvertir) * CONFIG.STAT_EXCEPCION_MULTIPLICADOR);
          if (inversionProyectada > CONFIG.STAT_EXCEPCION_LIMITE_PLANO) {
            throw new Error(`⛔ LÍMITE CHAKRA: Máximo ${CONFIG.STAT_EXCEPCION_LIMITE_PLANO} puntos.`);
          }
      } else {
          if (esRangoAsimetrico) {
              if (indiceTotalProyectado > 5) throw new Error(`⛔ LÍMITE ABSOLUTO: Máximo escala 5.`);
              
              if (indiceTotalProyectado === 5) {
                  const yaEstabaMax = (baseIndex + spActuales + bonoIndex) >= 5;
                  if (!yaEstabaMax && statsEnMaximo >= 1) {
                      throw new Error(`⛔ REGLA DE RANGO (${nivelPJ}): Solo un stat puede llegar a escala 5.`);
                  }
                  if (!yaEstabaMax) statsEnMaximo++; 
              }
          } else {
              if (indiceTotalProyectado > capIndexNormal) {
                  throw new Error(`⛔ LÍMITE RANGO ${nivelPJ}: Tu tope es índice ${capIndexNormal}.`);
              }
          }
      }

      totalGastoSP += spInvertir;
      nuevosRepartidos[i][0] = nuevoSPTotal;
      cambiosLog.push(`${nombreStat.substr(0,3)}: +${spInvertir} SP`);
    }

    // 6. FINALIZAR
    if (totalGastoSP === 0) { MasterUI.alerta("No hay cambios."); return; }
    
    const spDisponibles = Number(hojaPersonaje.getRange(CONFIG.COORD_FICHA_DISP_SP).getValue()) || 0;
    if (totalGastoSP > spDisponibles) throw new Error(`⛔ FONDOS: Requieres ${totalGastoSP} SP, tienes ${spDisponibles}.`);

    rangoRepartidos.setValues(nuevosRepartidos);

    systemLog({
      keko: keko,
      categoria: "Distribución Stats",
      detalle: cambiosLog.join(", "),
      evidencia: "Gestor Stats",
      recursos: { sp: 0 },
      fechaOverride: fechaCustom
    });

    hojaGestor.getRange(CONFIG.COORD_GSTATS_INPUT_KEKO).clearContent();
    hojaGestor.getRange(CONFIG.COORD_GSTATS_INPUT_FECHA).clearContent();
    if (typeof actualizarDatosUsuarioStats === 'function') actualizarDatosUsuarioStats(); 
    MasterUI.exito(`✅ Stats actualizados.`);

  } catch (e) {
    MasterUI.error(e.message);
  } finally {
    lock.releaseLock();
  }
}