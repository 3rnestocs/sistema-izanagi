// ==========================================
// 🧠 GESTOR DE HABILIDADES (V17.5 - ATOMIC LOCK)
// ==========================================

function ejecutarCambioHabilidad() {
  // 🔒 BLOQUEO ATÓMICO
  const lock = LockService.getScriptLock();
  try {
    const success = lock.tryLock(5000); 
    if (!success) {
      MasterUI.error("🚦 SISTEMA OCUPADO\nIntenta en unos segundos.");
      return;
    }

    // VALIDACIÓN DE SEGURIDAD
    const correoUsuario = Session.getActiveUser().getEmail();
    if (CONFIG.STAFF_EMAILS && CONFIG.STAFF_EMAILS.length > 0 && !CONFIG.STAFF_EMAILS.includes(correoUsuario)) {
        MasterUI.error("⛔ ACCESO DENEGADO");
        return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. SETUP
    const hojaGestor = getSheet(CONFIG.HOJA_GHABS);
    const hojaPlazas = getSheet(CONFIG.HOJA_PLAZAS);
    const hojaDatos = getSheet(CONFIG.HOJA_DATOS);
    const hojaRasgosDB = getSheet(CONFIG.HOJA_RASGOS);
    const dataRasgos = hojaRasgosDB.getDataRange().getValues();
    const fechaCustom = hojaGestor.getRange(CONFIG.COORD_GHABS_INPUT_FECHA).getValue();

    const keko = String(hojaGestor.getRange(CONFIG.COORD_GHABS_INPUT_KEKO).getValue()).trim();
    const accion = String(hojaGestor.getRange(CONFIG.COORD_GHABS_INPUT_ACCION).getValue()).trim();
    const subcategoria = String(hojaGestor.getRange(CONFIG.COORD_GHABS_INPUT_SUBCATEGORIA).getValue()).trim();
    const habilidad = String(hojaGestor.getRange(CONFIG.COORD_GHABS_INPUT_HABILIDAD).getValue()).trim();
    const costoFinal = Number(hojaGestor.getRange(CONFIG.COORD_GHABS_INFO_COSTO_FINAL).getValue());

    if (!keko || !accion || !habilidad) {
      MasterUI.alerta("⚠️ Faltan datos obligatorios.");
      return;
    }

    const hojaPersonaje = ss.getSheetByName(keko);
    if (!hojaPersonaje) { MasterUI.error(`La ficha de '${keko}' no existe.`); return; }

    // 2. LÓGICA DE PLAZAS
    let rawAsignar = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_ASIGNAR).getValue()).trim() || "Asignar";
    const isAsignar = accion.toUpperCase() === rawAsignar.toUpperCase();

    const dataPlazas = hojaPlazas.getDataRange().getValues(); 
    const filaIndex = dataPlazas.findIndex(r => String(r[0]).trim() === habilidad);
    
    if (filaIndex === -1) { MasterUI.error(`Habilidad '${habilidad}' no encontrada en Plazas.`); return; }

    const filaRealPlazas = filaIndex + 1;
    const INDICE_LECTURA = CONFIG.INDICE_PLAZA_LISTA || 6; 
    const COL_ESCRITURA = INDICE_LECTURA + 1; 
    
    let rawLista = String(dataPlazas[filaIndex][INDICE_LECTURA]);
    let usuariosArray = rawLista.split(",").map(u => u.trim()).filter(u => u !== "");

    // 🟢 ASIGNAR
    if (isAsignar) {
      const cuposReales = Number(hojaPersonaje.getRange(CONFIG.COORD_FICHA_DISP_CUPOS).getValue());
      if (costoFinal > 0 && costoFinal > cuposReales) { 
          MasterUI.error(`⛔ CUPOS INSUFICIENTES.\nFicha: ${cuposReales} | Costo: ${costoFinal}`); 
          return; 
      }
      if (usuariosArray.some(u => u.toUpperCase() === keko.toUpperCase())) { 
        MasterUI.alerta(`El usuario ${keko} ya tiene '${habilidad}'.`); return; 
      }

      escribirHabilidadEnFicha(hojaPersonaje, habilidad, subcategoria, costoFinal);
      
      const IDX_BONO_STAT = CONFIG.INDICE_PLAZA_BONO_STAT || 8; 
      const IDX_BONO_VALOR = CONFIG.INDICE_PLAZA_BONO_VALOR || 9;
      const bonoStat = dataPlazas[filaIndex][IDX_BONO_STAT];
      const bonoValor = dataPlazas[filaIndex][IDX_BONO_VALOR];
      if (bonoStat && bonoValor) aplicarBonoHabilidadV17(hojaPersonaje, bonoStat, bonoValor, 1);

      let reporteHerencia = { habilidades: [], rasgos: [] };
      const IDX_RASGOS_EXTRA = CONFIG.INDICE_PLAZA_RASGOS_EXTRA || 10;
      const rawRasgos = String(dataPlazas[filaIndex][IDX_RASGOS_EXTRA] || "");
      if (rawRasgos && rawRasgos !== "-" && rawRasgos !== "") {
          const listaRasgos = rawRasgos.split(",").map(r => r.trim());
          listaRasgos.forEach(r => {
              gestionarRasgoVinculado(hojaPersonaje, r, dataRasgos, 1);
              reporteHerencia.rasgos.push(r); 
          });
      }

      usuariosArray.push(keko);
      hojaPlazas.getRange(filaRealPlazas, COL_ESCRITURA).setValue(usuariosArray.join(", "));

      const INDICE_EXTRAS = CONFIG.INDICE_PLAZA_EXTRAS || 7; 
      const rawExtras = String(dataPlazas[filaIndex][INDICE_EXTRAS]).trim();
      if (rawExtras && rawExtras !== "-" && rawExtras !== "") {
        const listaExtras = rawExtras.split(",").map(e => e.trim());
        listaExtras.forEach(extraNombre => {
          asignarExtraV17(ss, hojaPersonaje, hojaPlazas, dataPlazas, dataRasgos, keko, extraNombre, reporteHerencia);
        });
      }

      let detalleFinal = habilidad;
      if (bonoStat && bonoValor) detalleFinal += ` [+${bonoValor} ${bonoStat}]`; 
      if (reporteHerencia.habilidades.length > 0) detalleFinal += ` (+ Guías: ${reporteHerencia.habilidades.join(", ")})`;
      if (reporteHerencia.rasgos.length > 0) detalleFinal += ` (+ Rasgos: ${reporteHerencia.rasgos.join(", ")})`;

      const catLog = hojaDatos.getRange(CONFIG.COORD_DATOS_LOG_ADQ_GUIA).getValue() || "Adquisición de Guía";

      systemLog({
        keko: keko,
        categoria: catLog, 
        detalle: detalleFinal,
        evidencia: "Gestor Habilidades",
        recursos: { cupos: 0 },
        fechaOverride: fechaCustom
      });

      let msjUI = `✅ ASIGNADA: ${habilidad}`;
      if (reporteHerencia.habilidades.length > 0 || reporteHerencia.rasgos.length > 0) {
          msjUI += `\n\n🎁 HERENCIA:`;
          if (reporteHerencia.habilidades.length > 0) msjUI += `\n• Guías: ${reporteHerencia.habilidades.join(", ")}`;
          if (reporteHerencia.rasgos.length > 0) msjUI += `\n• Rasgos: ${reporteHerencia.rasgos.join(", ")}`;
      }
      MasterUI.exito(msjUI);

    } else {
      // 🔴 RETIRAR
      const exitoBorrado = borrarHabilidadDeFicha(hojaPersonaje, habilidad);
      if (!exitoBorrado) SpreadsheetApp.getActive().toast("No estaba en ficha, limpiando plazas...");

      const IDX_BONO_STAT = CONFIG.INDICE_PLAZA_BONO_STAT || 8; 
      const IDX_BONO_VALOR = CONFIG.INDICE_PLAZA_BONO_VALOR || 9;
      const bonoStat = dataPlazas[filaIndex][IDX_BONO_STAT];
      const bonoValor = dataPlazas[filaIndex][IDX_BONO_VALOR];
      if (bonoStat && bonoValor) aplicarBonoHabilidadV17(hojaPersonaje, bonoStat, bonoValor, -1); 

      const IDX_RASGOS_EXTRA = CONFIG.INDICE_PLAZA_RASGOS_EXTRA || 10;
      const rawRasgos = String(dataPlazas[filaIndex][IDX_RASGOS_EXTRA] || "");
      if (rawRasgos && rawRasgos !== "-" && rawRasgos !== "") {
          const listaRasgos = rawRasgos.split(",").map(r => r.trim());
          listaRasgos.forEach(r => gestionarRasgoVinculado(hojaPersonaje, r, dataRasgos, -1));
      }

      const nuevoArray = usuariosArray.filter(u => u.toUpperCase() !== keko.toUpperCase());
      hojaPlazas.getRange(filaRealPlazas, COL_ESCRITURA).setValue(nuevoArray.join(", "));

      const catRetiro = hojaDatos.getRange(CONFIG.COORD_DATOS_LOG_RETIRO_GUIA).getValue() || "Retiro de Guía";

      systemLog({
        keko: keko,
        categoria: catRetiro,
        detalle: habilidad + " [RETIRADA]",
        evidencia: "Gestor Habilidades",
        recursos: { cupos: 0 },
        fechaOverride: fechaCustom
      });

      MasterUI.exito(`🗑️ Retirada: ${habilidad}`);
    }

    // LIMPIEZA
    hojaGestor.getRange(CONFIG.COORD_GHABS_CLEAR_PARCIAL).clearContent();
    hojaGestor.getRange(CONFIG.COORD_GHABS_INPUT_FECHA).clearContent();
    SpreadsheetApp.flush(); 
    try {
        const cuposActualizados = hojaPersonaje.getRange(CONFIG.COORD_FICHA_DISP_CUPOS).getValue();
        hojaGestor.getRange(CONFIG.COORD_GHABS_INFO_CUPOS).setValue(cuposActualizados);
    } catch(e) {}
    
    // ⚡ RENDIMIENTO: SIN SORT

  } catch (error) {
    MasterUI.error("❌ ERROR: " + error.message);
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 🔥 HELPER STATS V17 (COLUMNA J - BONOS)
// ==========================================
function aplicarBonoHabilidadV17(hojaPJ, statNombre, valor, multiplicador) {
  const rangoNombres = hojaPJ.getRange(CONFIG.COORD_FICHA_STATS_NOMBRES).getValues();
  const statBuscado = String(statNombre).trim().toUpperCase();
  const valorNum = Number(valor) || 0;
  
  // Obtenemos la columna J (Bonos) usando la coordenada configurada
  // Si COORD_FICHA_STATS_BONOS es "J12:J18", getRange funciona directo
  const rangoBonos = hojaPJ.getRange(CONFIG.COORD_FICHA_STATS_BONOS);

  for (let i = 0; i < rangoNombres.length; i++) {
    const nombreFicha = String(rangoNombres[i][0]).trim().toUpperCase();
    if (nombreFicha === statBuscado || nombreFicha.startsWith(statBuscado)) {
       // Encontramos la fila relativa (i)
       // Escribimos en la celda de la columna J correspondiente a esa fila
       const celdaBono = rangoBonos.getCell(i + 1, 1);
       const valorActual = Number(celdaBono.getValue()) || 0;
       
       // Sumamos o restamos el bono
       celdaBono.setValue(valorActual + (valorNum * multiplicador));
       return;
    }
  }
}

// ==========================================
// 🧬 HELPER RASGOS (MANTENIDO)
// ==========================================
function gestionarRasgoVinculado(hojaPJ, nombreRasgo, dataRasgosDB, modo) {
  const rasgoLimpio = String(nombreRasgo).trim();
  const celdaLista = hojaPJ.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA); // D2
  let textoActual = String(celdaLista.getValue());
  if (textoActual.startsWith("=") || textoActual === "-") textoActual = "";
  
  let lista = textoActual.split(",").map(r => r.trim()).filter(r => r !== "");
  let index = lista.findIndex(r => r.toUpperCase() === rasgoLimpio.toUpperCase());

  // Si asignamos
  if (modo === 1) {
    if (index === -1) {
      lista.push(rasgoLimpio);
      celdaLista.setValue(lista.join(", "));
      // NOTA: No aplicamos efectos numéricos del rasgo aquí porque...
      // 1. Si es Stat, la fórmula de la ficha V17 ya lee D2 y suma sola.
      // 2. Si es Recurso (RC/Ryou), no se suma retroactivamente salvo en creación.
    }
  } 
  // Si retiramos
  else {
    if (index !== -1) {
      lista.splice(index, 1);
      celdaLista.setValue(lista.length > 0 ? lista.join(", ") : "-");
    }
  }
}

// ==========================================
// 🎁 HELPER EXTRAS (RECURSIVO V17)
// ==========================================
function asignarExtraV17(ss, hojaPersonaje, hojaPlazas, dataPlazas, dataRasgosDB, keko, nombreExtra, reporteHerencia) {
  const idx = dataPlazas.findIndex(r => String(r[0]).trim().toUpperCase() === nombreExtra.toUpperCase());
  if (idx === -1 || nombreExtra === "-" || nombreExtra === "") return;

  const INDICE_LECTURA = CONFIG.INDICE_PLAZA_LISTA || 6;
  let rawLista = String(dataPlazas[idx][INDICE_LECTURA]);
  let usuarios = rawLista.split(",").map(u => u.trim()).filter(u => u !== "");
  
  if (usuarios.some(u => u.toUpperCase() === keko.toUpperCase())) return;

  const categoriaExtra = String(dataPlazas[idx][1]) || "Extra"; 
  escribirHabilidadEnFicha(hojaPersonaje, nombreExtra, categoriaExtra, 0);
  
  // 📝 Anotamos la guía en el reporte visual
  reporteHerencia.habilidades.push(nombreExtra);
  
  // BONO STATS EXTRA
  const IDX_BONO_STAT = CONFIG.INDICE_PLAZA_BONO_STAT || 8; 
  const IDX_BONO_VALOR = CONFIG.INDICE_PLAZA_BONO_VALOR || 9;
  const bonoStat = dataPlazas[idx][IDX_BONO_STAT];
  const bonoValor = dataPlazas[idx][IDX_BONO_VALOR];
  if (bonoStat && bonoValor) {
     aplicarBonoHabilidadV17(hojaPersonaje, bonoStat, bonoValor, 1);
  }

  // RASGOS EXTRA (DEL HIJO/NIETO)
  const IDX_RASGOS_EXTRA = CONFIG.INDICE_PLAZA_RASGOS_EXTRA || 10;
  const rawRasgos = String(dataPlazas[idx][IDX_RASGOS_EXTRA] || "");
  if (rawRasgos && rawRasgos !== "-") {
      const listaRasgos = rawRasgos.split(",").map(r => r.trim());
      listaRasgos.forEach(r => {
          gestionarRasgoVinculado(hojaPersonaje, r, dataRasgosDB, 1);
          reporteHerencia.rasgos.push(r); // 📝 Anotamos el rasgo en el reporte visual
      });
  }

  usuarios.push(keko);
  hojaPlazas.getRange(idx + 1, INDICE_LECTURA + 1).setValue(usuarios.join(", "));

  // Recursividad: Buscamos si este extra tiene MÁS extras (Nietos)
  const INDICE_EXTRAS_DB = CONFIG.INDICE_PLAZA_EXTRAS || 7;
  const susExtras = String(dataPlazas[idx][INDICE_EXTRAS_DB]).trim();
  if (susExtras && susExtras !== "-" && susExtras !== "") {
      const nietos = susExtras.split(",").map(e => e.trim());
      nietos.forEach(nieto => asignarExtraV17(ss, hojaPersonaje, hojaPlazas, dataPlazas, dataRasgosDB, keko, nieto, reporteHerencia));
  }
}

// ==========================================
// 🛠️ ESCRITURA EN FICHA (OPTIMIZADO V17.1)
// ==========================================
function escribirHabilidadEnFicha(hoja, nombre, categoria, costo) {
  const rangoInicio = hoja.getRange(CONFIG.COORD_FICHA_INICIO_HABILIDADES);
  const filaInicio = rangoInicio.getRow();
  
  // Leemos específicamente la Columna G (Nombre de habilidad) desde la fila de inicio
  // Escaneamos un bloque de 50 filas (capacidad máxima de guías razonable)
  const rangoNombres = hoja.getRange(filaInicio, CONFIG.COL_FICHA_HABILIDAD_NOMBRE, 50, 1);
  const valores = rangoNombres.getValues();
  
  let targetRow = filaInicio;
  
  // Buscamos la primera celda vacía exactamente en esa columna
  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][0]).trim() === "") {
      targetRow = filaInicio + i;
      break;
    }
  }
  
  // Escribimos (Columna G, H, J usando las variables dinámicas de Config)
  hoja.getRange(targetRow, CONFIG.COL_FICHA_HABILIDAD_NOMBRE).setValue(nombre);
  hoja.getRange(targetRow, CONFIG.COL_FICHA_HABILIDAD_CATEGORIA).setValue(categoria);
  hoja.getRange(targetRow, CONFIG.COL_FICHA_HABILIDAD_COSTO).setValue(costo);
}

function borrarHabilidadDeFicha(hoja, nombre) {
  const rangoInicio = hoja.getRange(CONFIG.COORD_FICHA_INICIO_HABILIDADES);
  const filaInicio = rangoInicio.getRow();
  const lastRow = hoja.getLastRow();
  
  if (lastRow < filaInicio) return false;

  // Escaneamos solo la columna G (Nombres)
  const numFilas = lastRow - filaInicio + 1;
  const rangoNombres = hoja.getRange(filaInicio, CONFIG.COL_FICHA_HABILIDAD_NOMBRE, numFilas, 1);
  const valores = rangoNombres.getValues();
  
  let filaEliminar = -1;
  
  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toUpperCase() === String(nombre).trim().toUpperCase()) {
      filaEliminar = filaInicio + i;
      break;
    }
  }

  if (filaEliminar !== -1) {
    // Borramos el contenido de las columnas G, H, I, J, K de esa fila
    // (Aseguramos borrar todo el ancho de la tabla de habilidades)
    hoja.getRange(filaEliminar, CONFIG.COL_FICHA_HABILIDAD_NOMBRE, 1, 5).clearContent();
    
    // Opcional: Ordenar para quitar huecos (Si quieres, te paso el sort, sino dejar hueco es más seguro)
    // Por ahora, dejamos el hueco o hacemos deleteRow (deleteRow mueve celdas de abajo, cuidado con formatos)
    // Recomendación V17: deleteRow si no hay nada a la derecha. 
    hoja.deleteRow(filaEliminar); 
    return true;
  }
  return false;
}
