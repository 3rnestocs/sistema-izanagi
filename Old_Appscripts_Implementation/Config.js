// ==========================================
// ⚙️ CONFIGURACIÓN GLOBAL (SSOT - ARQUITECTURA V17)
// ==========================================

const CONFIG = {
  // =========================================================
  // 📂 1. NOMBRES DE HOJAS DEL SISTEMA
  // =========================================================
  HOJA_DATOS: "Datos",            
  HOJA_RASGOS: "Rasgos",          
  HOJA_USUARIOS: "Usuarios",      
  HOJA_LOGS: "Logs",              
  HOJA_PLAZAS: "Plazas",          
  HOJA_MERCADO: "Mercado",        
  HOJA_TEST_USERS: "Usuarios de prueba",
  HOJA_FICHA_TEMPLATE: "Prototipo_Ficha", 
  
  // 📝 Generadores y Gestores
  HOJA_GRASGOS: "Gestor_Rasgos",          
  HOJA_GFICHA: "Generador_Ficha",         
  HOJA_GTRANSAC: "Gestor_Transacciones",  
  HOJA_GREGIS: "Generador_Registros",     
  HOJA_GHABS: "Gestor_Habilidades",       
  HOJA_GASCENSOS: "Gestor_Ascensos",      
  HOJA_GSTATS: "Gestor_Stats",    

  // 🛡️ SEGURIDAD Y PERMISOS
  STAFF_EMAILS: [
    "3rnestocs@gmail.com",
    "neilybarberan@gmail.com"
  ],        

  // =========================================================
  // 📍 2. GENERADOR DE FICHA (Inputs y Configuración)
  // =========================================================
  COORD_GENFICHA_INPUTS_FULL: "B2:B11",  
  
  COORD_GENFICHA_INPUT_KEKO: "B2",        
  COORD_GENFICHA_INPUT_DISCORD: "B3",     
  COORD_GENFICHA_INPUT_NOMBRE: "B4",      
  COORD_GENFICHA_INPUT_EDAD: "B5",        
  COORD_GENFICHA_INPUT_NIVEL: "B6",       
  COORD_GENFICHA_INPUT_RANGO: "B7",       
  COORD_GENFICHA_INPUT_MORAL: "B8",       
  COORD_GENFICHA_INFO_BALANCE_RC: "B12",
  COORD_GENFICHA_INPUT_FECHA: "B13",

  // =========================================================
  // 💪 3. ESTRUCTURA DE LA FICHA (Coordenadas Críticas)
  // =========================================================
  
  // A. RECURSOS TOTALES (Columna H - Fórmulas)
  COORD_FICHA_TOTAL_RYOU: "H3",           
  COORD_FICHA_TOTAL_EXP: "H4",            
  COORD_FICHA_TOTAL_PR: "H5",             
  COORD_FICHA_TOTAL_SP: "H6",             
  COORD_FICHA_TOTAL_CUPOS: "H7",          
  COORD_FICHA_TOTAL_RC: "H8",             

  // B. RECURSOS DISPONIBLES (Columna J - Validaciones)
  COORD_FICHA_DISP_RYOU: "J3",
  COORD_FICHA_DISP_EXP: "J4",
  COORD_FICHA_DISP_PR: "J5",
  COORD_FICHA_DISP_SP: "J6",
  COORD_FICHA_DISP_CUPOS: "J7",
  COORD_FICHA_DISP_RC: "J8",

  // C. ASCENSOS V17 (Cargos y Rangos)
  COORD_FICHA_NEXT_CARGO_NOMBRE: "H21",    // Cargo Social (Genin...)
  COORD_FICHA_NEXT_CARGO_STATUS: "H22",    
  COORD_FICHA_NEXT_RANGO_NOMBRE: "J21",    // Rango Numérico (D1, D2...)
  COORD_FICHA_NEXT_RANGO_STATUS: "J22",    
  
  COORD_FICHA_GASTADO_SP: "I6",
  COORD_FICHA_RASGOS_LISTA: "D2",           

  // D. DESTREZAS / STATS (Tabla G12:K18)
  COORD_FICHA_STATS_NOMBRES: "G12:G18",     
  COORD_FICHA_STATS_BASE: "H12:H18",        
  COORD_FICHA_STATS_REPARTIDOS: "I12:I18",  
  COORD_FICHA_STATS_BONOS: "J12:J18",       
  COORD_FICHA_STATS_TOTAL: "K12:K18",       

  // E. HABILIDADES E INVENTARIO
  COORD_FICHA_INICIO_HABILIDADES: "G26",    
  COL_FICHA_HABILIDAD_NOMBRE: 7,   // G
  COL_FICHA_HABILIDAD_CATEGORIA: 8,// H
  COL_FICHA_HABILIDAD_COSTO: 10,    // J 

  COORD_FICHA_INVENTARIO_FULL: "A20:B100",  
  COORD_FICHA_INVENTARIO_NOMBRES: "A20:A100", 
  
  // F. CONTADORES OCULTOS (V17 - Cálculos)
  COORD_FICHA_CONTADOR_COMBATES: "E35",
  COORD_FICHA_CONTADOR_PACIENTES: "E36",
  COORD_FICHA_NIVEL_EXACTO: "B6",

  // =========================================================
  // 💸 4. GESTOR DE TRANSACCIONES
  // =========================================================
  COORD_GTRANS_INPUTS_FULL: "B2:B9",           
  COORD_GTRANS_INPUT_KEKO: "B2",               
  COORD_GTRANS_INPUT_ACCION: "B3",             
  COORD_GTRANS_INPUT_DESTINO: "B4",            
  COORD_GTRANS_INPUT_ITEMS: "B5",              
  COORD_GTRANS_INFO_SALDO: "B6",               
  COORD_GTRANS_INFO_COSTO: "B7",               
  COORD_GTRANS_INFO_ESTADO: "B8",              
  COORD_GTRANS_INFO_RASGOS: "B9",   
  COORD_GTRANS_INPUT_FECHA: "B10",           
  COORD_GTRANS_LABEL_COSTO: "A7",              
  COORD_GTRANS_CLEAR_FULL: "B6:B8",            
  COORD_GTRANS_CLEAR_PARCIAL: "B7:B8",         

  // =========================================================
  // 🧬 5. GESTOR DE RASGOS
  // =========================================================
  COORD_GRASGOS_INPUTS_FULL: "B2:B4",          
  COORD_GRASGOS_INPUT_KEKO: "B2",              
  COORD_GRASGOS_INPUT_ACCION: "B3",            
  COORD_GRASGOS_INPUT_RASGO: "B4",             
  COORD_GRASGOS_INFO_COSTO: "B5",              
  COORD_GRASGOS_INFO_RC: "B6",        
  COORD_GRASGOS_INPUT_FECHA: "B7",         
  COORD_GRASGOS_CLEAR_INPUTS: "B4:B5",         
  INDICE_DB_RASGOS_COSTO: 2,                   
  INDICE_DB_RASGOS_INCOMPATIBLES: 9,           

  // =========================================================
  // 🧠 6. GESTOR DE HABILIDADES
  // =========================================================
  COORD_GHABS_LECTURA_FULL: "B2:B11",          
  COORD_GHABS_INPUTS_FULL: "B2:B8",            
  COORD_GHABS_INPUT_KEKO: "B2",                
  COORD_GHABS_INPUT_ACCION: "B3",              
  COORD_GHABS_INPUT_SUBCATEGORIA: "B4",        
  COORD_GHABS_INPUT_HABILIDAD: "B5",           
  COORD_GHABS_INFO_COSTO_BASE: "B6",           
  COORD_GHABS_CHECKBOX_GRATIS: "B7",           
  COORD_GHABS_INFO_COSTO_FINAL: "B8",          
  COORD_GHABS_INFO_CUPOS: "B9",       
  COORD_GHABS_INPUT_FECHA: "B11",         
  COORD_GHABS_CLEAR_INPUTS: "B2:B7",      
  COORD_GHABS_CLEAR_PARCIAL: "B4:B7",     

  // =========================================================
  // 📊 7. GESTOR DE STATS
  // =========================================================
  COORD_GSTATS_INPUT_KEKO: "B2",               
  COORD_GSTATS_INFO_SP: "B3",                 
  COORD_GSTATS_INFO_RESTANTE: "B4", 
  COORD_GSTATS_INPUT_FECHA: "B5",
  COORD_GSTATS_LABELS_STATS: "A7:A13",         
  COORD_GSTATS_INFO_INVERTIDOS: "B7:B13",      
  COORD_GSTATS_INFO_ESCALA: "C7:C13",          
  COORD_GSTATS_INPUTS_VALORES: "D7:D13",       
  COORD_GSTATS_INFO_TOTAL: "E7:E13",

// ⚙️ VARIABLES ESPECIALES DE RASGOS (Apunta a tu hoja Rasgos)
  COORD_RASGO_LENTO: "A22",     
  COORD_RASGO_TORPEZA: "A25",
  COL_RASGOS_SUELDO_RYOU: 11,           // Índice 11 = Columna L en hoja Rasgos
  COL_RASGOS_MULTI_LUNES: 13,           // Columna N (Multiplicador Ambicioso/Derrochador)
  COL_RASGOS_SALDO_MINIMO: 14,          // Columna O en Rasgos
  COL_RASGOS_BLOQUEA_TRANSFER: 15,      // Columna P en Rasgos

  // ⚙️ VARIABLES ESPECIALES (Nuevas)
  COORD_DATOS_STAT_VELOCIDAD: "F21",
  COORD_DATOS_STAT_CHAKRA: "F23",
  COORD_DATOS_STAT_ARMAS: "F25",
  
  STAT_EXCEPCION_NOMBRE: "Chakra",      // Nombre exacto del stat que rompe las reglas
  STAT_EXCEPCION_MULTIPLICADOR: 2,      // Cada SP invertido suma esto al valor real
  STAT_EXCEPCION_LIMITE_PLANO: 20,      // Límite máximo absoluto para este stat  

  // =========================================================
  // 📈 8. GESTOR DE ASCENSOS
  // =========================================================
  COORD_GASCENSOS_INPUTS_FULL: "B2:B7",  
  COORD_GASCENSOS_INPUT_KEKO: "B2",
  COORD_GASCENSOS_INPUT_ACCION: "B3",          
  COORD_GASCENSOS_INFO_ACTUAL: "B4",      
  COORD_GASCENSOS_INPUT_OBJETIVO: "B5",        
  COORD_GASCENSOS_INFO_REQUISITOS: "B6",       
  COORD_GASCENSOS_INFO_ESTADO: "B7",  
  COORD_GASCENSOS_INPUT_FECHA: "B8",         
  COORD_GASCENSOS_CLEAR_DATA: "B4:B7",

  // =========================================================
  // 💾 9. GENERADOR DE REGISTROS
  // =========================================================
  COORD_GREGISTROS_INPUTS_FULL: "B2:B12",      
  
  COORD_LABEL_USUARIOS: "A2",  // Etiqueta de la lista principal
  COORD_LABEL_DETALLE: "A4",   // Etiqueta del campo detalle

  COORD_GREGISTROS_INPUT_KEKO: "B2",
  COORD_GREGISTROS_INPUT_CATEGORIA: "B3",
  COORD_GREGISTROS_INPUT_DETALLE: "B4",
  COORD_GREGISTROS_INPUT_EVIDENCIA: "B5",
  COORD_GREGISTROS_INPUT_FECHA: "B12",
  COORD_GREGISTROS_INPUT_RECURSOS: "B6:B11",

  COORD_GREGISTROS_CLEAR_PARCIAL: "B6:B11",    
  COORD_LOGS_CATS_ADMIN: "K2:K6",              
  COORD_USUARIOS_KEY_ALL: "A3",                
  
  // Enfrentamiento = I20 | Curación = I21 (Según tu captura de hoja Datos)
  CATEGORIAS_DROPDOWN_USERS: ["I20", "I21"], 
  COORD_DATOS_CAT_CURACION_TXT: "I21",

  // =========================================================
  // 📚 10. HOJA DATOS & VOCABULARIO (V17 - REORGANIZADA)
  // =========================================================
  
  // A. RECURSOS (Tabla D19:D24)
  COORD_DATOS_DEF_RYOU: "D19",
  COORD_DATOS_DEF_EXP: "D20",
  COORD_DATOS_DEF_PR: "D21",
  COORD_DATOS_DEF_SP: "D22",
  COORD_DATOS_DEF_CUPOS: "D23",
  COORD_DATOS_DEF_RC: "D24",       
  COORD_DATOS_CATS_RESTRICTIVAS: "K27:K28",
  RANGO_LIMITE_ASIMETRICO: "B",

  // B. CONSTANTES (Tabla B19:C23)
  COORD_DATOS_SP_EXTRA: "C19",         
  COORD_DATOS_SP_RASGO: "C20",
  COORD_DATOS_CUPOS_BASE: "C21",       
  COORD_DATOS_RC_BASE: "C22",          
  COORD_DATOS_NIVEL_DEFAULT: "C23",    
  COORD_DATOS_RYOU_BASE: "C24",

  // C. TABLAS MAESTRAS (J en adelante - EDITAR MANUALMENTE)
  COORD_TABLA_RANGOS: "A3:F16",         // Tabla nueva de Rangos, contempla D1, D2, ... , S1, S2.
  COORD_TABLA_CARGOS: "M3:S11",         // 
  COORD_TABLA_GRADACIONES: "M15:S21",   // 
  COORD_TABLA_BASES_RANGO: "M25:T29",   // 
  COORD_TABLA_LIMITES_CAPS: "T3:V7",  // 

  // D. FILTROS / VOCABULARIO (Tabla B25:B28)
  VOCABULARIO_GASTO: "B27",            
  VOCABULARIO_GANANCIA: "B28",         
  VOCABULARIO_MERCADO: "B29",          
  VOCABULARIO_TIENDA: "B30",           

  // E. ACCIONES DE COMPRA (Tabla D26:D28)
  VOCABULARIO_ACCION_COMPRAR: "D26",           
  VOCABULARIO_ACCION_VENDER: "D27",            
  VOCABULARIO_ACCION_TRANSFERIR: "D28",        

  // F. ACCIONES DE GUÍAS (Tabla G19:G20)
  VOCABULARIO_ACCION_ASIGNAR: "G19",           
  VOCABULARIO_ACCION_RETIRAR: "G20",           

  // G. TIPOS DE ASCENSO (Tabla G22:G23)
  VOCABULARIO_ACCION_SUBIR_CARGO: "G22",  // Cargo Social
  VOCABULARIO_ACCION_SUBIR_RANGO: "G23",  // Rango Numérico

  // H. CATEGORIAS GENERACIÓN (Tabla G25:G27)
  COORD_DATOS_CAT_CREACION: "G25",              
  COORD_DATOS_CAT_RASGO: "G26",                 
  COORD_DATOS_CAT_MORAL: "G27",                 
  
  // I. CATEGORIAS HABILIDAD (Tabla F27:F28)
  COORD_DATOS_LOG_RETIRO_GUIA: "F27",
  COORD_DATOS_LOG_ADQ_GUIA: "F28",          

  // 💰 NUEVAS CONSTANTES PARA SUELDOS
  COORD_DATOS_SUELDO_EXP: "C25",        // Celda donde pondrás el "2" (EXP base semanal)
  COORD_SEMAFORO_SUELDOS: "Z1",         // Una celda oculta en Datos para guardar la última fecha   
  
  // =========================================================
  // 🛒 12. CONFIGURACIÓN DE MERCADO Y TIENDAS
  // =========================================================
  // Categorías de Compras (Tabla K14:K16)
  COORD_TIENDA_MERCADO_REF: "K14",              
  COORD_TIENDA_EXP_REF: "K15",                  
  COORD_TIENDA_PR_REF: "K16",                   
  COORD_LISTA_TIENDAS_DISPONIBLES: "K14:K16",    

  // Lecturas de BD Mercado (Esto depende de la hoja Mercado, no Datos)
  COORD_LECTURA_MERCADO_NINJA: "B3:B",         
  COORD_LECTURA_TIENDA_EXP: "F23:F",           
  COORD_LECTURA_TIENDA_PR: "F3:F19",           
  COORD_USUARIOS_TOTALES: "A4:A",              

  INDICE_MERCADO_NINJA_NOMBRE: 1,              
  INDICE_MERCADO_NINJA_PRECIO: 2,              
  INDICE_TIENDAS_EXTRA_NOMBRE: 5,              
  INDICE_TIENDAS_EXTRA_PRECIO: 6,              

  // =========================================================
  // 🏙️ 13. PLAZAS Y ESTRUCTURAS
  // =========================================================
  INDICE_PLAZA_COSTO: 2,                       
  INDICE_PLAZA_TOTAL: 3,                       
  INDICE_PLAZA_OCUPADAS: 4,                    
  INDICE_PLAZA_LISTA: 6,                       
  INDICE_PLAZA_EXTRAS: 7,                    
  INDICE_PLAZA_BONO_STAT: 8,   
  INDICE_PLAZA_BONO_VALOR: 9,  
  INDICE_PLAZA_RASGOS_EXTRA: 10,

  // =========================================================
  // 🎨 14. UI, COLORES Y CONSTANTES VISUALES
  // =========================================================
  COLOR_UI_EXITO: "#d9ead3",                   
  COLOR_UI_ERROR: "#f4cccc",                   
  COLOR_UI_ALERTA: "#fff2cc",                  
  
  CONST_CONST_PORCENTAJE_VENTA: 0.5,                 

  UI_TITULOS: {
    EXITO: "✅ OPERACIÓN EXITOSA",
    ERROR: "⛔ ACCIÓN PROHIBIDA",       
    ALERTA: "⚠️ ATENCIÓN REQUERIDA",    
    CONFIRMAR: "🛡️ CONFIRMAR ACCIÓN",   
    ADMIN: "⚠️ AUTORIZACIÓN REQUERIDA", 
    INFO: "ℹ️ INFORMACIÓN DEL SISTEMA"
  },
};