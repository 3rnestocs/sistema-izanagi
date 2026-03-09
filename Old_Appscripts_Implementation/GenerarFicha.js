// ==========================================
// 🧙 GENERADOR DE FICHA (V17.5 - CLEAN & FAST)
// ==========================================

function crearPersonaje() {
  // 🔥 VALIDACIÓN DE SEGURIDAD
  const correoUsuario = Session.getActiveUser().getEmail();
  if (CONFIG.STAFF_EMAILS && CONFIG.STAFF_EMAILS.length > 0 && !CONFIG.STAFF_EMAILS.includes(correoUsuario)) {
      MasterUI.error(`⛔ ACCESO DENEGADO\n\nTu cuenta (${correoUsuario || "Anónima"}) no tiene privilegios.`);
      return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. ⚙️ SETUP
  const hojaGen = getSheet(CONFIG.HOJA_GFICHA);
  const hojaTemplate = getSheet(CONFIG.HOJA_FICHA_TEMPLATE);
  const hojaDatos = getSheet(CONFIG.HOJA_DATOS);
  const hojaRasgos = getSheet(CONFIG.HOJA_RASGOS);

  // 2. ⚡ LECTURA FORMULARIO
  const dataForm = hojaGen.getRange(CONFIG.COORD_GENFICHA_INPUTS_FULL).getValues();
  
  const keko          = String(dataForm[0][0]).trim();
  const pj            = dataForm[1][0];
  const discordUser   = String(dataForm[2][0]).trim();
  const edad          = dataForm[3][0];
  const nacimiento    = dataForm[4][0];
  const origen        = dataForm[5][0];
  const rasgo1        = dataForm[6][0];
  const rasgo2        = dataForm[7][0];
  const rasgo3        = dataForm[8][0];
  const moral         = dataForm[9][0];
  const fechaCustom = hojaGen.getRange(CONFIG.COORD_GENFICHA_INPUT_FECHA).getValue();

  if (!keko || !pj) { MasterUI.error("Faltan datos obligatorios."); return; }
  if (ss.getSheetByName(keko)) { MasterUI.error(`Ya existe la ficha '${keko}'.`); return; }

  const balanceVisual = hojaGen.getRange(CONFIG.COORD_GENFICHA_INFO_BALANCE_RC).getValue();
  if (balanceVisual < 0) {
    MasterUI.error(`⛔ BALANCE NEGATIVO (${balanceVisual} RC).`); return;
  }

  // 3. 🧬 PROCESAR LISTAS
  function procesarLista(valor) {
    return (valor && String(valor).trim() !== "") ? String(valor).split(",").map(r => r.trim()) : [];
  }
  
  let rasgosElegidos = [];
  if (nacimiento) rasgosElegidos.push(nacimiento);
  if (origen) rasgosElegidos.push(origen);
  rasgosElegidos.push(...procesarLista(rasgo1));
  rasgosElegidos.push(...procesarLista(rasgo2));
  rasgosElegidos.push(...procesarLista(rasgo3));
  rasgosElegidos = rasgosElegidos.filter(r => r && r !== "-" && r !== "");
  
  const textoRasgosFinal = rasgosElegidos.join(", ");

  // 4. 🧠 CONFLICTOS Y RECURSOS
  const dataRasgosDB = hojaRasgos.getDataRange().getValues();
  
  const MAP_RECURSOS = {
    [String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_RYOU).getValue()).trim().toUpperCase()]: 'ryou',
    [String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_EXP).getValue()).trim().toUpperCase()]: 'exp',
    [String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_PR).getValue()).trim().toUpperCase()]: 'pr',
    [String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_RC).getValue()).trim().toUpperCase()]: 'rc',
    [String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_CUPOS).getValue()).trim().toUpperCase()]: 'cupos'
  };

  const CONST_SP_TXT = String(hojaDatos.getRange(CONFIG.COORD_DATOS_DEF_SP).getValue()).trim().toUpperCase();

  let seleccionadosUpper = rasgosElegidos.map(r => r.toUpperCase());
  let mapaConflictos = {};
  let logsGranulares = []; 

  dataRasgosDB.forEach(r => {
    let nombreDB = String(r[0]).trim().toUpperCase();
    if (!nombreDB) return;

    let incompatibles = String(r[CONFIG.INDICE_DB_RASGOS_INCOMPATIBLES] || "").trim();
    if (incompatibles) mapaConflictos[nombreDB] = incompatibles.split(",").map(i=>i.trim().toUpperCase());

    if (seleccionadosUpper.includes(nombreDB)) {
      let recursosRasgo = { ryou: 0, exp: 0, pr: 0, sp: 0, cupos: 0, rc: 0 };
      let tieneImpacto = false;
      
      let costoRC = Number(r[CONFIG.INDICE_DB_RASGOS_COSTO]) || 0;
      if (costoRC !== 0) {
        recursosRasgo.rc = costoRC; 
        tieneImpacto = true;
      }

      const sumarEfecto = (tipo, op, val) => {
        let nombreEfecto = String(tipo).trim().toUpperCase();
        let key = MAP_RECURSOS[nombreEfecto];
        let valor = Number(val) || 0;
        
        if (key) {
           if (String(op).trim() === "+") { recursosRasgo[key] += valor; tieneImpacto = true; }
           if (String(op).trim() === "-") { recursosRasgo[key] -= valor; tieneImpacto = true; }
        } else if (nombreEfecto === CONST_SP_TXT) {
           if (String(op).trim() === "+") { recursosRasgo.sp += valor; tieneImpacto = true; }
           if (String(op).trim() === "-") { recursosRasgo.sp -= valor; tieneImpacto = true; }
        }
      };
      
      sumarEfecto(r[3], r[4], r[5]);
      sumarEfecto(r[6], r[7], r[8]);

      if (tieneImpacto) {
        // 🔥 V17.5: SSOT PURO. Usamos la categoría de la DB.
        let categoriaDB = String(r[1]).trim(); 
        // Fallback: Si la DB no tiene categoría, usamos el default del Config
        let categoriaLog = categoriaDB || hojaDatos.getRange(CONFIG.COORD_DATOS_CAT_RASGO).getValue();

        logsGranulares.push({
          keko: keko,
          categoria: categoriaLog,
          detalle: String(r[0]).trim(),
          evidencia: "Generador de Ficha",
          recursos: recursosRasgo,
          fechaOverride: fechaCustom
        });
      }
    }
  });

  // CONFLICTOS
  for (let rasgo of rasgosElegidos) {
    let enemigos = mapaConflictos[rasgo.toUpperCase()];
    if (enemigos) {
      for (let enemigo of enemigos) {
        if (seleccionadosUpper.includes(enemigo)) {
          MasterUI.error(`⛔ CONFLICTO DETECTADO:\n'${rasgo}' es incompatible con '${enemigo}'.`);
          return; 
        }
      }
    }
  }

  // 5. 🏗️ CREACIÓN DE LA FICHA
  const nuevaFicha = hojaTemplate.copyTo(ss).setName(keko);
  nuevaFicha.setTabColor(null); 

  nuevaFicha.getRange(CONFIG.COORD_GENFICHA_INPUT_KEKO).setValue(keko);
  nuevaFicha.getRange(CONFIG.COORD_GENFICHA_INPUT_NOMBRE).setValue(pj);
  nuevaFicha.getRange(CONFIG.COORD_GENFICHA_INPUT_MORAL).setValue(moral);
  if (discordUser) nuevaFicha.getRange(CONFIG.COORD_GENFICHA_INPUT_DISCORD).setValue(discordUser);
  if (edad) nuevaFicha.getRange(CONFIG.COORD_GENFICHA_INPUT_EDAD).setValue(edad);
  
  nuevaFicha.getRange(CONFIG.COORD_FICHA_RASGOS_LISTA).setValue(textoRasgosFinal);
  
  const nivelInicial = hojaDatos.getRange(CONFIG.COORD_DATOS_NIVEL_DEFAULT).getValue();
  nuevaFicha.getRange(CONFIG.COORD_FICHA_NIVEL_EXACTO).setValue(nivelInicial);
  
  nuevaFicha.getRange(CONFIG.COORD_FICHA_STATS_REPARTIDOS).setValue(0);
  nuevaFicha.getRange(CONFIG.COORD_FICHA_STATS_BONOS).clearContent();

  // 6. LOGS
  const catCreacion = hojaDatos.getRange(CONFIG.COORD_DATOS_CAT_CREACION).getValue()
  systemLog({
    keko: keko,
    categoria: catCreacion,
    detalle: `Ficha de ${keko} creada en nivel ${nivelInicial}. Rasgos asignados.`,
    evidencia: "Generador de Ficha",
    recursos: { ryou: 0, exp: 0, pr: 0, sp: 0, cupos: 0, rc: 0 } 
  });
  logsGranulares.forEach(log => systemLog(log));

  if (moral) {
    const catMoral = hojaDatos.getRange(CONFIG.COORD_DATOS_CAT_MORAL).getValue();
    systemLog({ keko: keko, categoria: catMoral, detalle: moral, evidencia: catCreacion });
  }

  // 7. FINALIZAR
  hojaGen.getRange(CONFIG.COORD_GENFICHA_INPUTS_FULL).clearContent();
  hojaGen.getRange(CONFIG.COORD_GENFICHA_INPUT_FECHA).clearContent();
  try { actualizarDirectorio(); } catch(e) {}
  
  MasterUI.exito(`✅ Personaje ${keko} creado.`);
}