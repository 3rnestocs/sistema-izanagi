// ==========================================
// 🕹️ MASTER ON EDIT (V17.2 - DINAMIC DROPDOWNS)
// ==========================================

function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const range = e.range;
  const a1 = range.getA1Notation();

  // ---------------------------------------------------------
  // 1. GESTOR DE TRANSACCIONES (V15)
  // ---------------------------------------------------------
  if (sheetName === CONFIG.HOJA_GTRANSAC) {
    if (a1 === CONFIG.COORD_GTRANS_INPUT_ACCION) {
      gestionarMenuDestino(e); 
      sheet.getRange(CONFIG.COORD_GTRANS_INPUT_ITEMS).clearContent().clearDataValidations();
      sheet.getRange(CONFIG.COORD_GTRANS_CLEAR_FULL).clearContent(); 
      actualizarVistaPrevia(sheet);
      return;
    }
    if (a1 === CONFIG.COORD_GTRANS_INPUT_DESTINO || a1 === CONFIG.COORD_GTRANS_INPUT_KEKO) {
      gestionarMenuItems(sheet);
      sheet.getRange(CONFIG.COORD_GTRANS_INPUT_ITEMS).clearContent();
      sheet.getRange(CONFIG.COORD_GTRANS_CLEAR_FULL).clearContent(); 
      actualizarVistaPrevia(sheet);
      actualizarRasgosRelevantes(e); 
      return;
    }
    if (a1 === CONFIG.COORD_GTRANS_INPUT_ITEMS) {
      sheet.getRange(CONFIG.COORD_GTRANS_CLEAR_PARCIAL).clearContent(); 
      actualizarVistaPrevia(sheet);
      return;
    }
    return;
  }

  // ---------------------------------------------------------
  // 2. GENERADOR DE REGISTROS (V17 - ACTIVO)
  // ---------------------------------------------------------
  if (sheetName === CONFIG.HOJA_GREGIS) {
    // Si cambia el Usuario (Keko) -> Limpieza parcial
    if (a1 === CONFIG.COORD_GTRANS_INPUT_KEKO) { // B2
      sheet.getRange(CONFIG.COORD_GREGISTROS_CLEAR_PARCIAL).clearContent();
      proteccionMenuDesplegable(e);
      return;
    }
    // Si cambia la Categoría (B3) -> Gestionar Dropdown en Detalle (B4)
    if (a1 === CONFIG.COORD_GTRANS_INPUT_ACCION) { // B3 (Usamos la misma coord relativa de Config)
      gestionarDetalleRegistro(e);
      return;
    }
  }

  // ---------------------------------------------------------
  // 3. GESTOR DE STATS (V17 - DISEÑO 4 COLUMNAS)
  // ---------------------------------------------------------
  if (sheetName === CONFIG.HOJA_GSTATS) {
    // Si cambia el usuario, cargamos sus datos en columnas B y C
    if (a1 === CONFIG.COORD_GSTATS_INPUT_KEKO) {
      actualizarDatosUsuarioStats(); 
      return;
    }
    return;
  }

  // ---------------------------------------------------------
  // 4. GESTOR DE HABILIDADES (V17 - CONFIRMADO)
  // ---------------------------------------------------------
  if (sheetName === CONFIG.HOJA_GHABS) {
    // Cambio Usuario -> Actualizar Cupos (B9) y limpiar
    if (a1 === CONFIG.COORD_GHABS_INPUT_KEKO) {
      actualizarCuposHabilidad(sheet); 
      sheet.getRange(CONFIG.COORD_GHABS_INPUT_SUBCATEGORIA).clearContent();
      sheet.getRange(CONFIG.COORD_GHABS_INPUT_HABILIDAD).clearContent();
      sheet.getRange(CONFIG.COORD_GHABS_INFO_COSTO_BASE).clearContent();
      return;
    }
    
    // Cambio Subcategoría -> Limpiar Habilidad
    if (a1 === CONFIG.COORD_GHABS_INPUT_SUBCATEGORIA) {
      sheet.getRange(CONFIG.COORD_GHABS_INPUT_HABILIDAD).clearContent();
      sheet.getRange(CONFIG.COORD_GHABS_INFO_COSTO_BASE).clearContent();
      return;
    }

    // Cambio Habilidad -> Actualizar Costo Base (B6)
    if (a1 === CONFIG.COORD_GHABS_INPUT_HABILIDAD) {
      actualizarPrecioHabilidad(sheet); 
      return;
    }
  }

  // ---------------------------------------------------------
  // 5. GESTOR DE RASGOS (V15)
  // ---------------------------------------------------------
  if (sheetName === CONFIG.HOJA_GRASGOS) {
    if (a1 === CONFIG.COORD_GRASGOS_INPUT_KEKO) {
      actualizarRCDisponible(sheet);
      sheet.getRange(CONFIG.COORD_GRASGOS_INPUT_RASGO).clearContent(); 
      sheet.getRange(CONFIG.COORD_GRASGOS_INFO_COSTO).clearContent();
      return;
    }
    if (a1 === CONFIG.COORD_GRASGOS_INPUT_RASGO) {
      actualizarCostoRasgo(sheet);
      return;
    }
  }

  if (sheetName === CONFIG.HOJA_GASCENSOS) {
    // Si cambia Usuario o Acción, traemos la info fresca de la ficha
    if (a1 === CONFIG.COORD_GASCENSOS_INPUT_KEKO || a1 === CONFIG.COORD_GASCENSOS_INPUT_ACCION) {
      actualizarInfoAscenso(sheet);
      return;
    }
  }
}

// =========================================================
// 🧠 FUNCIONES DE APOYO (HELPERS)
// =========================================================

// --- GESTOR DE REGISTROS V17.3 (UX INVERTIDA) ---
function gestionarDetalleRegistro(e) {
  const sheet = e.range.getSheet();
  const categoriaSeleccionada = String(e.range.getValue()).trim();
  
  // Coordenadas
  const celdaDetalle = sheet.getRange(CONFIG.COORD_GREGISTROS_INPUT_DETALLE); // B4
  const labelUsuarios = sheet.getRange(CONFIG.COORD_LABEL_USUARIOS); // A2
  const labelDetalle = sheet.getRange(CONFIG.COORD_LABEL_DETALLE);   // A4
  
  // Limpiamos contenido previo de B4 para evitar errores
  celdaDetalle.clearContent();
  celdaDetalle.clearDataValidations();

  // Obtenemos listas blanca y nombres especiales
  const coordsEspeciales = CONFIG.CATEGORIAS_DROPDOWN_USERS || [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaDatos = ss.getSheetByName(CONFIG.HOJA_DATOS);
  
  let categoriasEspejo = [];
  try {
    coordsEspeciales.forEach(coord => {
      const val = String(hojaDatos.getRange(coord).getValue()).trim();
      if (val) categoriasEspejo.push(val.toUpperCase());
    });
  } catch (err) {}

  // Lógica de UI Invertida
  if (categoriasEspejo.includes(categoriaSeleccionada.toUpperCase())) {
    // 1. CAMBIO DE LABELS (UX)
    labelUsuarios.setValue("👥 Afectados (Lista)");
    labelDetalle.setValue("👤 Beneficiario (Keko)"); // El Healer o Ganador va aquí

    // 2. ACTIVAR DROPDOWN EN B4
    const hojaUsuarios = ss.getSheetByName(CONFIG.HOJA_USUARIOS);
    const lastRow = hojaUsuarios.getLastRow();
    if (lastRow >= 4) {
      const rangoUsuarios = hojaUsuarios.getRange("A4:A" + lastRow);
      const regla = SpreadsheetApp.newDataValidation()
        .requireValueInRange(rangoUsuarios)
        .setAllowInvalid(false)
        .build();
      celdaDetalle.setDataValidation(regla);
    }
  } else {
    // 1. RESTAURAR LABELS (NORMAL)
    labelUsuarios.setValue("Usuarios (Kekos)");
    labelDetalle.setValue("Detalle");

    // 2. LIMPIEZA
    celdaDetalle.clearDataValidations();
  }
}

// --- GESTOR DE ASCENSOS (V17.1 - SEMÁFORO HÍBRIDO) ---
function actualizarInfoAscenso(sheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaDatos = ss.getSheetByName(CONFIG.HOJA_DATOS);
  
  // 1. Inputs
  const keko = sheet.getRange(CONFIG.COORD_GASCENSOS_INPUT_KEKO).getValue();
  const accion = String(sheet.getRange(CONFIG.COORD_GASCENSOS_INPUT_ACCION).getValue()).trim();

  // Limpieza inicial
  sheet.getRange(CONFIG.COORD_GASCENSOS_CLEAR_DATA).clearContent();
  sheet.getRange(CONFIG.COORD_GASCENSOS_INFO_ESTADO).setBackground(null); // Limpiar color
  
  if (!keko || !accion) return;

  const hojaPJ = ss.getSheetByName(keko);
  if (!hojaPJ) {
    sheet.getRange(CONFIG.COORD_GASCENSOS_INFO_ESTADO).setValue("⛔ NO EXISTE");
    return;
  }

  // 2. Determinar Objetivo (Rango vs Cargo)
  const ACCION_CARGO = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_SUBIR_CARGO).getValue()).trim(); // "Ascenso de Cargo"
  const ACCION_RANGO = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_SUBIR_RANGO).getValue()).trim(); // "Ascenso de Rango"

  let celdaNombreActual = "";
  let celdaObjetivoNombre = "";
  let celdaObjetivoStatus = "";

  if (accion === ACCION_RANGO) { // D1 -> D2
    celdaNombreActual = CONFIG.COORD_FICHA_NIVEL_EXACTO; // B6
    celdaObjetivoNombre = CONFIG.COORD_FICHA_NEXT_RANGO_NOMBRE; // J21
    celdaObjetivoStatus = CONFIG.COORD_FICHA_NEXT_RANGO_STATUS; // J22
  } 
  else if (accion === ACCION_CARGO) { // Genin -> Chuunin
    celdaNombreActual = CONFIG.COORD_FICHA_RANGO_LETRA; // B7
    celdaObjetivoNombre = CONFIG.COORD_FICHA_NEXT_CARGO_NOMBRE; // H21
    celdaObjetivoStatus = CONFIG.COORD_FICHA_NEXT_CARGO_STATUS; // H22
  } 
  else {
    sheet.getRange(CONFIG.COORD_GASCENSOS_INFO_ESTADO).setValue("❓ ACCIÓN DESCONOCIDA");
    return;
  }

  // 3. Lectura de Ficha
  const valorActual = hojaPJ.getRange(celdaNombreActual).getValue();
  const valorObjetivo = hojaPJ.getRange(celdaObjetivoNombre).getValue();
  const textoRequisitos = String(hojaPJ.getRange(celdaObjetivoStatus).getValue());

  // 4. Escritura en Gestor
  sheet.getRange(CONFIG.COORD_GASCENSOS_INFO_ACTUAL).setValue(valorActual);
  sheet.getRange(CONFIG.COORD_GASCENSOS_INPUT_OBJETIVO).setValue(valorObjetivo);
  sheet.getRange(CONFIG.COORD_GASCENSOS_INFO_REQUISITOS).setValue(textoRequisitos);

  // 5. Semáforo Inteligente V17
  const estadoUpper = textoRequisitos.toUpperCase();
  const celdaEstado = sheet.getRange(CONFIG.COORD_GASCENSOS_INFO_ESTADO);

  if (estadoUpper.includes("MÁXIMO")) {
    celdaEstado.setValue("🏁 MÁXIMO ALCANZADO");
    celdaEstado.setBackground(CONFIG.COLOR_UI_ALERTA); // Azul/Amarillo
  } 
  else if (estadoUpper.includes("FALTAN") || estadoUpper.includes("INSUFICIENTE")) {
    celdaEstado.setValue("⛔ BLOQUEADO");
    celdaEstado.setBackground(CONFIG.COLOR_UI_ERROR); // Rojo
  } 
  else if (estadoUpper.includes("VALIDAR") || estadoUpper.includes("PENDIENTES")) {
    celdaEstado.setValue("⚠️ REQUIERE VALIDACIÓN");
    celdaEstado.setBackground(CONFIG.COLOR_UI_ALERTA); // Amarillo (Check manual de logros)
  } 
  else if (estadoUpper.includes("LISTO") || estadoUpper.includes("ELEGIBLE") || estadoUpper.includes("APROBADO")) {
    celdaEstado.setValue("✅ APROBADO");
    celdaEstado.setBackground(CONFIG.COLOR_UI_EXITO); // Verde
  } 
  else {
    celdaEstado.setValue("ℹ️ VERIFICAR FÓRMULA");
  }
}

// --- GESTOR DE STATS (V17 - LÓGICA EXPANDIDA) ---
function actualizarDatosUsuarioStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaGestor = getSheet(CONFIG.HOJA_GSTATS);
  const hojaDatos = getSheet(CONFIG.HOJA_DATOS); // 🟢 AQUÍ ESTÁ LA CORRECCIÓN
  
  const keko = hojaGestor.getRange(CONFIG.COORD_GSTATS_INPUT_KEKO).getValue();
  
  if (!keko || keko === "") {
    hojaGestor.getRange(CONFIG.COORD_GSTATS_INFO_SP).setValue("");
    hojaGestor.getRange(CONFIG.COORD_GSTATS_INFO_INVERTIDOS).clearContent(); 
    hojaGestor.getRange(CONFIG.COORD_GSTATS_INFO_ESCALA).clearContent();     
    hojaGestor.getRange(CONFIG.COORD_GSTATS_INPUTS_VALORES).setValue(0);     
    return;
  }

  const hojaPersonaje = ss.getSheetByName(keko);
  if (!hojaPersonaje) {
    hojaGestor.getRange(CONFIG.COORD_GSTATS_INFO_SP).setValue("⛔ NO EXISTE");
    return;
  }

  hojaGestor.getRange(CONFIG.COORD_GSTATS_INFO_SP).setValue(hojaPersonaje.getRange(CONFIG.COORD_FICHA_DISP_SP).getValue());

  const labels = hojaGestor.getRange(CONFIG.COORD_GSTATS_LABELS_STATS).getValues();
  const bases = hojaPersonaje.getRange(CONFIG.COORD_FICHA_STATS_BASE).getValues();
  const repartidos = hojaPersonaje.getRange(CONFIG.COORD_FICHA_STATS_REPARTIDOS).getValues();
  const bonos = hojaPersonaje.getRange(CONFIG.COORD_FICHA_STATS_BONOS).getValues();
  
  let inversionUI = []; // Irá a Col B
  let bonosUI = [];     // Irá a Col C

  const NOM_CHAKRA = String(hojaDatos.getRange(CONFIG.COORD_DATOS_STAT_CHAKRA).getValue()).trim().toUpperCase();

  for(let i = 0; i < labels.length; i++) {
    let nombreActual = String(labels[i][0]).trim().toUpperCase();
    let base = Number(bases[i][0]) || 0;
    let rep = Number(repartidos[i][0]) || 0;
    let bono = Number(bonos[i][0]) || 0;
    
    if (nombreActual === NOM_CHAKRA) {
      // Para Chakra: Base (Puntos) + (Repartido (SP) * 2)
      inversionUI.push([base + (rep * 2)]); 
    } else {
      // Para el resto: Base (Índice) + Repartido (Índice)
      inversionUI.push([base + rep]); 
    }
    bonosUI.push([bono]);           
  }

  hojaGestor.getRange(CONFIG.COORD_GSTATS_INFO_INVERTIDOS).setValues(inversionUI);
  hojaGestor.getRange(CONFIG.COORD_GSTATS_INFO_ESCALA).setValues(bonosUI); // La columna C ahora muestra Bonos
  hojaGestor.getRange(CONFIG.COORD_GSTATS_INPUTS_VALORES).setValue(0);
}

// --- GESTOR DE HABILIDADES (V17 - CONFIRMADO B6/B9) ---
function actualizarPrecioHabilidad(sheet) {
  const nombreHabilidad = String(sheet.getRange(CONFIG.COORD_GHABS_INPUT_HABILIDAD).getValue()).trim();
  if (!nombreHabilidad) { sheet.getRange(CONFIG.COORD_GHABS_INFO_COSTO_BASE).clearContent(); return; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPlazas = ss.getSheetByName(CONFIG.HOJA_PLAZAS);
  const dataPlazas = hojaPlazas.getDataRange().getValues();
  const filaHab = dataPlazas.find(r => String(r[0]).trim().toUpperCase() === nombreHabilidad.toUpperCase());

  let costo = 0;
  if (filaHab) {
    const colCosto = CONFIG.INDICE_PLAZA_COSTO || 2; 
    costo = Number(filaHab[colCosto]) || 0;
  }
  // Escribe Costo Base en B6
  sheet.getRange(CONFIG.COORD_GHABS_INFO_COSTO_BASE).setValue(costo);
}

function actualizarCuposHabilidad(sheet) {
  const keko = sheet.getRange(CONFIG.COORD_GHABS_INPUT_KEKO).getValue();
  const celdaCupos = sheet.getRange(CONFIG.COORD_GHABS_INFO_CUPOS); // B9

  if (!keko || String(keko).trim() === "") { celdaCupos.setValue("-"); return; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPJ = ss.getSheetByName(keko);
  if (!hojaPJ) { celdaCupos.setValue("⛔ No existe"); return; }

  // Lectura V17: Cupos Disponibles en J7 de la Ficha
  const cuposDisponibles = hojaPJ.getRange(CONFIG.COORD_FICHA_DISP_CUPOS).getValue();
  celdaCupos.setValue(cuposDisponibles);
}

// --- GESTOR DE RASGOS ---
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

function actualizarCostoRasgo(sheet) {
  const rasgo = sheet.getRange(CONFIG.COORD_GRASGOS_INPUT_RASGO).getValue();
  const celdaCosto = sheet.getRange(CONFIG.COORD_GRASGOS_INFO_COSTO);
  if (!rasgo) { celdaCosto.setValue(0); return; }

  const hojaRasgos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJA_RASGOS);
  const data = hojaRasgos.getDataRange().getValues();
  const fila = data.find(r => String(r[0]).trim().toUpperCase() === String(rasgo).trim().toUpperCase());
  
  if (fila) {
    const idxCosto = CONFIG.INDICE_DB_RASGOS_COSTO || 2; 
    celdaCosto.setValue(Number(fila[idxCosto]) || 0);
  } else {
    celdaCosto.setValue(0);
  }
}

// --- GESTOR DE TRANSACCIONES (Helpers Mantenidos) ---
function gestionarMenuDestino(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.HOJA_GTRANSAC);
  const celdaDestino = sheet.getRange(CONFIG.COORD_GTRANS_INPUT_DESTINO);
  const accion = String(sheet.getRange(CONFIG.COORD_GTRANS_INPUT_ACCION).getValue()).trim();
  
  const hojaDatos = ss.getSheetByName(CONFIG.HOJA_DATOS);
  const nombreTransferir = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_TRANSFERIR).getValue()).trim();
  const nombreVender = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_VENDER).getValue()).trim();
  const nombreMercado = String(hojaDatos.getRange(CONFIG.COORD_TIENDA_MERCADO_REF).getValue()).trim();

  celdaDestino.clearContent();
  let regla = null;

  if (accion === nombreTransferir) {
    const hojaUsuarios = ss.getSheetByName(CONFIG.HOJA_USUARIOS);
    const lastRow = hojaUsuarios.getLastRow();
    if (lastRow >= 4) {
      regla = SpreadsheetApp.newDataValidation().requireValueInRange(hojaUsuarios.getRange("A4:A" + lastRow)).build();
    }
  } 
  else if (accion === nombreVender) {
    celdaDestino.setValue(nombreMercado);
    regla = SpreadsheetApp.newDataValidation().requireValueInRange(hojaDatos.getRange(CONFIG.COORD_TIENDA_MERCADO_REF)).build();
  } 
  else {
    regla = SpreadsheetApp.newDataValidation().requireValueInRange(hojaDatos.getRange(CONFIG.COORD_LISTA_TIENDAS_DISPONIBLES)).build();
  }

  if (regla) celdaDestino.setDataValidation(regla);
}

function gestionarMenuItems(sheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const celdaItems = sheet.getRange(CONFIG.COORD_GTRANS_INPUT_ITEMS); 
  
  const keko = sheet.getRange(CONFIG.COORD_GTRANS_INPUT_KEKO).getValue();
  const accion = String(sheet.getRange(CONFIG.COORD_GTRANS_INPUT_ACCION).getValue()).trim();
  const destino = String(sheet.getRange(CONFIG.COORD_GTRANS_INPUT_DESTINO).getValue()).trim();

  const hojaDatos = ss.getSheetByName(CONFIG.HOJA_DATOS);
  const nombreComprar = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_COMPRAR).getValue()).trim();
  
  const SHOP_MERCADO = hojaDatos.getRange(CONFIG.COORD_TIENDA_MERCADO_REF).getValue();
  const SHOP_EXP = hojaDatos.getRange(CONFIG.COORD_TIENDA_EXP_REF).getValue();
  const SHOP_PR = hojaDatos.getRange(CONFIG.COORD_TIENDA_PR_REF).getValue();

  let rangoFuente = null;

  if (accion === nombreComprar) {
    const hojaMercado = ss.getSheetByName(CONFIG.HOJA_MERCADO);
    const lastRow = hojaMercado.getLastRow();
    if (destino === SHOP_MERCADO) rangoFuente = hojaMercado.getRange(CONFIG.COORD_LECTURA_MERCADO_NINJA + lastRow);
    else if (destino === SHOP_EXP) rangoFuente = hojaMercado.getRange(CONFIG.COORD_LECTURA_TIENDA_EXP + lastRow);
    else if (destino === SHOP_PR) rangoFuente = hojaMercado.getRange(CONFIG.COORD_LECTURA_TIENDA_PR); 
  } 
  else {
    if (!keko) return; 
    const hojaPJ = ss.getSheetByName(keko);
    if (hojaPJ) {
      const lastRowInv = hojaPJ.getLastRow();
      rangoFuente = hojaPJ.getRange(CONFIG.COORD_FICHA_INVENTARIO_NOMBRES + lastRowInv);
    }
  }

  if (rangoFuente) {
    const regla = SpreadsheetApp.newDataValidation().requireValueInRange(rangoFuente).setAllowInvalid(true).build();
    celdaItems.setDataValidation(regla);
  } else {
    celdaItems.clearDataValidations();
  }
}

function actualizarVistaPrevia(sheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inputs = sheet.getRange(CONFIG.COORD_GTRANS_INPUTS_FULL).getValues();
  const keko = inputs[0][0];
  const accion = String(inputs[1][0]).trim();
  const destino = inputs[2][0];
  const rawItems = String(inputs[3][0]);

  const hojaDatos = ss.getSheetByName(CONFIG.HOJA_DATOS);
  const NOMBRE_VENDER = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_VENDER).getValue()).trim();
  const NOMBRE_TRANSFERIR = String(hojaDatos.getRange(CONFIG.VOCABULARIO_ACCION_TRANSFERIR).getValue()).trim();

  let labelCosto = "Costo Total";
  if (accion === NOMBRE_VENDER) labelCosto = "Ganancia Estimada";
  if (accion === NOMBRE_TRANSFERIR) labelCosto = "Costo de Envío";
  sheet.getRange(CONFIG.COORD_GTRANS_LABEL_COSTO).setValue(labelCosto);

  if (!keko || !accion || !destino) return;

  const SHOP_MERCADO = hojaDatos.getRange(CONFIG.COORD_TIENDA_MERCADO_REF).getValue();
  const SHOP_PR = hojaDatos.getRange(CONFIG.COORD_TIENDA_PR_REF).getValue();
  const SHOP_EXP = hojaDatos.getRange(CONFIG.COORD_TIENDA_EXP_REF).getValue();
  
  let moneda = hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_RYOU).getValue(); 
  if (destino === SHOP_PR) moneda = hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_PR).getValue();
  if (destino === SHOP_EXP) moneda = hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_EXP).getValue();

  const celdaSaldo = sheet.getRange(CONFIG.COORD_GTRANS_INFO_SALDO);
  if (String(celdaSaldo.getValue()) === "") {
    const hojaPJ = ss.getSheetByName(keko);
    if (!hojaPJ) { sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setValue("⛔ ERROR: Ficha no existe"); return; }
    
    let saldo = 0;
    if (destino === SHOP_MERCADO) saldo = hojaPJ.getRange(CONFIG.COORD_FICHA_DISP_RYOU).getValue();
    else if (destino === SHOP_PR) saldo = hojaPJ.getRange(CONFIG.COORD_FICHA_DISP_PR).getValue();
    else if (destino === SHOP_EXP) saldo = hojaPJ.getRange(CONFIG.COORD_FICHA_DISP_EXP).getValue();
    else saldo = hojaPJ.getRange(CONFIG.COORD_FICHA_DISP_RYOU).getValue();
    
    celdaSaldo.setValue(saldo + " " + moneda);
  }

  // ============================================================
  // 🧠 1. LECTURA DE RASGOS (Se mueve arriba para cubrir todo)
  // ============================================================
  let multiplicador = 1.0;
  let detallesEfectos = []; 
  let saldoMinimoRequerido = 0;
  let restringeTransferencia = false;
  let rasgoLimitante = "";
  
  if (accion === NOMBRE_VENDER) {
     multiplicador = CONFIG.CONST_CONST_PORCENTAJE_VENTA || 0.5;
     detallesEfectos.push(`Venta Base (${Math.round(multiplicador*100)}%)`);
  }

  const hojaPJ = ss.getSheetByName(keko);
  if (hojaPJ) {
     const rasgosUsuarioStr = String(hojaPJ.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA).getValue());
     const listaRasgosPJ = rasgosUsuarioStr.split(",").map(r => r.trim().toUpperCase());
     const hojaRasgos = ss.getSheetByName(CONFIG.HOJA_RASGOS);
     const dataRasgosBD = hojaRasgos.getDataRange().getValues();
     const WORD_GASTO = String(hojaDatos.getRange(CONFIG.VOCABULARIO_GASTO).getValue()).trim().toUpperCase();
     let monedaCheck = String(moneda).toUpperCase(); 
     
     dataRasgosBD.forEach(fila => {
         let nombreRasgoBD = String(fila[0]).trim();
         if (listaRasgosPJ.includes(nombreRasgoBD.toUpperCase())) {
           
           // A. Multiplicadores (Solo si NO es Venta)
           if (accion !== NOMBRE_VENDER) {
               const esMulti = (op) => op === "*" || String(op).toUpperCase() === "MULTIPLICA";
               const afecta1 = String(fila[3]).toUpperCase();
               const afecta2 = String(fila[6]).toUpperCase();
               let aplico = false;
               let valorAplicado = 1;
               
               if (afecta1.includes(WORD_GASTO) && afecta1.includes(monedaCheck) && esMulti(fila[4])) {
                   valorAplicado = Number(fila[5]);
                   multiplicador *= valorAplicado; aplico = true;
               }
               if (afecta2.includes(WORD_GASTO) && afecta2.includes(monedaCheck) && esMulti(fila[7])) {
                   valorAplicado = Number(fila[8]);
                   multiplicador *= valorAplicado; aplico = true;
               }
               if (aplico) {
                   let desc = (valorAplicado < 1) ? `Dto. ${Math.round((1-valorAplicado)*100)}%` : `x${valorAplicado}`;
                   detallesEfectos.push(`${nombreRasgoBD} (${desc})`);
               }
           }

           // B. Restricciones Tacaño (SSOT)
           const minBal = Number(fila[CONFIG.COL_RASGOS_SALDO_MINIMO]) || 0;
           if (minBal > saldoMinimoRequerido) {
               saldoMinimoRequerido = minBal;
               rasgoLimitante = nombreRasgoBD;
           }
           if (String(fila[CONFIG.COL_RASGOS_BLOQUEA_TRANSFER]).toUpperCase() === "SI") {
               restringeTransferencia = true;
           }
         }
     });
  }

  // ============================================================
  // 📤 2. LÓGICA DE TRANSFERENCIA (Con Return Seguro)
  // ============================================================
  if (accion === NOMBRE_TRANSFERIR) {
    sheet.getRange(CONFIG.COORD_GTRANS_INFO_COSTO).setValue("GRATIS");
    
    // Regla Tacaño: Prohibido ceder dinero voluntariamente
    const intentandoCederDinero = rawItems.toUpperCase().includes("RYOU");

    if (restringeTransferencia && intentandoCederDinero) {
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setValue(`⛔ ${rasgoLimitante}: PROHIBIDO CEDER DINERO`);
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setBackground(CONFIG.COLOR_UI_ERROR);
    } else {
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setValue("✅ LISTO");
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setBackground(CONFIG.COLOR_UI_EXITO);
    }
    return; // Ahora sí, el return es seguro
  }

  // ============================================================
  // 🛒 3. LÓGICA DE COMPRA / VENTA
  // ============================================================
  if (!rawItems || rawItems === "") {
    sheet.getRange(CONFIG.COORD_GTRANS_INFO_COSTO).setValue(0);
    sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setValue("Esperando items...");
    return;
  }

  const colNombre = (destino === SHOP_MERCADO) ? CONFIG.INDICE_MERCADO_NINJA_NOMBRE : CONFIG.INDICE_TIENDAS_EXTRA_NOMBRE; 
  const colPrecio = (destino === SHOP_MERCADO) ? CONFIG.INDICE_MERCADO_NINJA_PRECIO : CONFIG.INDICE_TIENDAS_EXTRA_PRECIO;
  
  const hojaMercado = ss.getSheetByName(CONFIG.HOJA_MERCADO);
  const dataMercado = hojaMercado.getDataRange().getValues();
  let costoTotalBase = 0;
  const itemsArr = rawItems.split(",").map(i => i.trim());
  let itemsInvalidos = false;

  itemsArr.forEach(item => {
    const prod = dataMercado.find(r => String(r[colNombre]).trim().toUpperCase() === item.toUpperCase());
    if (prod) costoTotalBase += Number(prod[colPrecio]);
    else itemsInvalidos = true;
  });

  let costoFinal = Math.ceil(costoTotalBase * multiplicador);
  sheet.getRange(CONFIG.COORD_GTRANS_INFO_COSTO).setValue(costoFinal);
  
  if (detallesEfectos.length > 0 && !itemsInvalidos) {
    const resumenRasgos = detallesEfectos.join(" + ");
    const info = `${resumenRasgos} | Base: ${costoTotalBase} ➔ Final: ${costoFinal}`;
    sheet.getRange(CONFIG.COORD_GTRANS_INFO_RASGOS).setValue(info);
  } else if (!itemsInvalidos) {
    sheet.getRange(CONFIG.COORD_GTRANS_INFO_RASGOS).setValue("Ningún rasgo afecta esta operación.");
  }

  // ============================================================
  // 🚦 4. SEMÁFORO FINAL DE COMPRA / VENTA
  // ============================================================
  if (itemsInvalidos) {
    sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setValue("⚠️ Item no encontrado");
    sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setBackground(CONFIG.COLOR_UI_ALERTA);
  } else {
    const saldoTxt = String(celdaSaldo.getValue());
    const saldoNum = Number(saldoTxt.split(" ")[0]) || 0; 
    
    const monedaEsRyou = (destino === SHOP_MERCADO || saldoTxt.toUpperCase().includes("RYOU"));

    if (accion !== NOMBRE_VENDER && monedaEsRyou && (saldoNum - costoFinal) < saldoMinimoRequerido) {
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setValue(`⛔ RESERVA INTOCABLE: ${saldoMinimoRequerido}¥`);
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setBackground(CONFIG.COLOR_UI_ERROR);
    } else if (accion !== NOMBRE_VENDER && saldoNum < costoFinal) {
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setValue("⛔ FONDOS INSUFICIENTES");
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setBackground(CONFIG.COLOR_UI_ERROR);
    } else {
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setValue("✅ APROBADO");
        sheet.getRange(CONFIG.COORD_GTRANS_INFO_ESTADO).setBackground(CONFIG.COLOR_UI_EXITO);
    }
  }
}

function actualizarRasgosRelevantes(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.HOJA_GTRANSAC);
  const hojaDatos = ss.getSheetByName(CONFIG.HOJA_DATOS);
  const keko = sheet.getRange(CONFIG.COORD_GTRANS_INPUT_KEKO).getValue();
  if (!keko) return;
  const hojaPJ = ss.getSheetByName(keko);
  if (!hojaPJ) return;

  const rasgosUsuarioRaw = String(hojaPJ.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA).getValue());
  if (!rasgosUsuarioRaw) { sheet.getRange(CONFIG.COORD_GTRANS_INFO_RASGOS).setValue("Ninguno"); return; }
  
  const misRasgos = rasgosUsuarioRaw.split(",").map(r => r.trim().toUpperCase());
  const hojaRasgos = ss.getSheetByName(CONFIG.HOJA_RASGOS);
  const dataRasgos = hojaRasgos.getDataRange().getValues(); 
  let rasgosRelevantes = [];
  dataRasgos.forEach(fila => {
    const nombreRasgo = String(fila[0]).trim();
    const afecta = String(fila[3]).trim().toUpperCase(); 
    const afecta2 = String(fila[6]).trim().toUpperCase(); 
    if (misRasgos.includes(nombreRasgo.toUpperCase())) {
      const palabrasClave = [
        hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_RYOU).getValue(), 
        hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_PR).getValue(), 
        hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_EXP).getValue(),
        hojaDatos.getRange(CONFIG.VOCABULARIO_GASTO).getValue()
      ];
      if (palabrasClave.some(clave => afecta.includes(clave) || afecta2.includes(clave))) {
        rasgosRelevantes.push(nombreRasgo);
      }
    }
  });
  const resultado = rasgosRelevantes.length > 0 ? rasgosRelevantes.join(", ") : "Ninguno";
  sheet.getRange(CONFIG.COORD_GTRANS_INFO_RASGOS).setValue(resultado);
}

function proteccionMenuDesplegable(e) {
  if (e.range.getDataValidation() == null) {
    const ui = SpreadsheetApp.getUi();
    const rangoFuente = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJA_USUARIOS).getRange(CONFIG.COORD_USUARIOS_TOTALES);
    const regla = SpreadsheetApp.newDataValidation().requireValueInRange(rangoFuente).setAllowInvalid(true).build();
    e.range.setDataValidation(regla).clearContent();
    ui.alert("⛔ ERROR", "Validación eliminada. Menú restaurado.", ui.ButtonSet.OK);
  }
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}