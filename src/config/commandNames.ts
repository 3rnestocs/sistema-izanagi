/**
 * Centralized command name constants.
 * Use these everywhere instead of raw strings to avoid typos and simplify renames.
 */
export const COMMAND_NAMES = {
  ajustar_recursos: 'ajustar_recursos',
  ascender: 'ascender',
  catalogo: 'catalogo',
  cobrar_sueldo: 'cobrar_sueldo',
  comprar: 'comprar',
  ficha: 'ficha',
  historial: 'historial',
  invertir_sp: 'invertir_sp',
  listar: 'listar',
  listar_tienda: 'listar_tienda',
  npc: 'npc',
  otorgar_habilidad: 'otorgar_habilidad',
  otorgar_rasgo: 'otorgar_rasgo',
  rechazar_registro: 'rechazar_registro',
  registrar_suceso: 'registrar_suceso',
  registro: 'registro',
  retirar_habilidad: 'retirar_habilidad',
  tienda: 'tienda',
  transferir: 'transferir',
  vender: 'vender'
} as const;

export type CommandName = (typeof COMMAND_NAMES)[keyof typeof COMMAND_NAMES];
