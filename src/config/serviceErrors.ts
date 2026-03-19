/**
 * Centralized error messages for services.
 * Use these instead of hardcoded strings for consistency.
 */

/** Character not found (generic). */
export const ERROR_CHARACTER_NOT_FOUND = 'Personaje no encontrado.';

/** Action prohibited: character not found. */
export const ERROR_ACTION_PROHIBIDA_CHARACTER_NOT_FOUND = '⛔ ACCIÓN PROHIBIDA: Personaje no encontrado.';

/** Amount must be greater than zero. */
export const ERROR_AMOUNT_MUST_BE_POSITIVE = '⛔ La cantidad debe ser mayor a cero.';

/** Reason required for adjustment. */
export const ERROR_REASON_REQUIRED = '⛔ Debes proporcionar un motivo para el ajuste.';

/** Target user has no character. */
export const ERROR_TARGET_NO_CHARACTER = '⛔ El usuario objetivo no tiene un personaje registrado.';

/** Salary: cannot claim before character creation. */
export const ERROR_SALARY_BEFORE_CREATION = 'No puedes cobrar sueldos de fechas anteriores a la creación de tu personaje.';

/** Salary: already claimed this week. */
export const ERROR_SALARY_ALREADY_CLAIMED = '⛔ Ya cobraste el sueldo semanal. Intenta nuevamente más tarde.';

/** Salary: already claimed for specific week (formatted date). */
export const ERROR_SALARY_ALREADY_CLAIMED_WEEK = (fmt: string) =>
  `Ya has cobrado el sueldo correspondiente a la semana del ${fmt}.`;

/** Invalid rank. */
export const ERROR_INVALID_RANK = (target: string) => `Rango no válido: ${target}`;

/** Invalid level. */
export const ERROR_INVALID_LEVEL = (targetLevel: string) => `⛔ Nivel inválido: ${targetLevel}`;

/** Force ascenso: character already at same or higher level. */
export const ERROR_FORCE_ASCENSO_SAME_OR_LOWER = (level: string) =>
  `⛔ El personaje ya es ${level}. No puedes forzar un ascenso a un nivel igual o inferior.`;

/** Items not in catalog. */
export const ERROR_ITEMS_NOT_IN_CATALOG = 'Ninguno de los ítems existe en el catálogo.';

/** Item not found in catalog. */
export const ERROR_ITEM_NOT_FOUND = (name: string) => `El ítem '${name}' no existe en el catálogo.`;

/** Insufficient funds (generic template). */
export const ERROR_FUNDS_INSUFFICIENT = (resource: string, need: number, have: number) =>
  `⛔ FONDOS: Necesitas ${need} ${resource}, tienes ${have}.`;

/** Trait min balance rule (Tacaño). */
export const ERROR_TRAIT_MIN_BALANCE = (minBalanceRule: number) =>
  `⛔ RESTRICCIÓN DE RASGO: Debes mantener al menos ${minBalanceRule} Ryou intactos en tu ficha.`;

/** Trait blocks transfer. */
export const ERROR_TRAIT_BLOCKS_TRANSFER =
  '⛔ RESTRICCIÓN DE RASGO: Tienes prohibido ceder dinero voluntariamente a otros personajes.';

/** Insufficient Ryou for transfer. */
export const ERROR_INSUFFICIENT_RYOU_TRANSFER = '⛔ No tienes suficientes Ryou para transferir.';

/** Sender not found. */
export const ERROR_SENDER_NOT_FOUND = 'Remitente no encontrado.';

/** Item cannot be sold (wrong currency). */
export const ERROR_ITEM_NOT_SELLABLE = (name: string) =>
  `⛔ El ítem '${name}' no se puede vender (no es una moneda compatible).`;

/** Insufficient quantity to sell. */
export const ERROR_INSUFFICIENT_QUANTITY_SELL = (itemName: string) =>
  `⛔ No tienes suficiente cantidad de '${itemName}' para vender.`;

/** Insufficient quantity to transfer. */
export const ERROR_INSUFFICIENT_QUANTITY_TRANSFER = '⛔ No tienes suficiente cantidad del ítem para transferir.';

/** Item not in catalog (transfer). */
export const ERROR_ITEM_NOT_IN_CATALOG = (name: string) => `Ítem '${name}' no existe en el catálogo.`;

/** Approval message not in guild. */
export const ERROR_APPROVAL_MESSAGE_NO_GUILD = '⛔ El mensaje de aprobación no pertenece a un servidor.';

/** Approval message: could not extract Keko name. */
export const ERROR_APPROVAL_MESSAGE_NO_KEKO = '⛔ No se pudo extraer "Nombre del Keko" del mensaje aprobado.';

// --- NpcService ---

export const ERROR_NPC_NAME_REQUIRED = '⛔ Debes proporcionar un nombre de NPC válido.';
export const ERROR_NPC_ALREADY_EXISTS = (name: string) =>
  `⛔ Ya existe un personaje con el nombre '${name}'.`;
export const ERROR_NPC_RETIRE_REFERENCE_REQUIRED = '⛔ Debes indicar el NPC a retirar por ID o nombre.';
export const ERROR_NPC_RETIRE_REASON_REQUIRED = '⛔ Debes indicar el motivo del retiro.';
export const ERROR_NPC_NOT_FOUND = (reference: string) =>
  `⛔ No se encontró un NPC con referencia '${reference}'.`;
export const ERROR_NPC_ALREADY_RETIRED = (name: string) =>
  `⛔ El NPC '${name}' ya se encuentra retirado.`;

// --- RewardCalculatorService ---

/** Newbie bonus source label. */
export const BONUS_NEWBIE = 'Bono Novato';

export const ERROR_MISSION_NO_RANK = '⛔ La misión no tiene rango definido.';
export const ERROR_MISSION_RANK_INVALID = (rank: string) =>
  `⛔ El rango de misión '${rank}' no es válido para recompensas.`;
export const ERROR_COMBAT_NO_ENEMY_RANK = '⛔ El combate no tiene rango del oponente definido.';
export const ERROR_CHARACTER_LEVEL_INVALID = (level: string) =>
  `⛔ El rango actual del personaje ('${level}') no es válido.`;
export const ERROR_ENEMY_RANK_INVALID = (rank: string) =>
  `⛔ El rango del oponente ('${rank}') no es válido.`;
export const ERROR_CURACION_NO_SEVERITY = '⛔ La curación no tiene severidad de herida definida.';
export const ERROR_SEVERITY_INVALID = (severidad: string) =>
  `⛔ La severidad '${severidad}' no es válida.`;
export const ERROR_LEVEL_INVALID_DESARROLLO = (level: string) =>
  `⛔ El nivel '${level}' no es válido para Desarrollo Personal.`;
export const ERROR_LOGRO_GENERAL_NOT_FOUND = '⛔ El logro general seleccionado no existe en el catálogo.';
export const ERROR_LOGRO_REPUTACION_NOT_FOUND = '⛔ El logro de reputación seleccionado no existe en el catálogo.';

// --- CharacterService ---

export const ERROR_KEKO_OR_DISCORD_ALREADY_REGISTERED = (name: string) =>
  `⛔ ACCIÓN PROHIBIDA: El Keko '${name}' o el usuario de Discord ya posee una ficha registrada.`;
export const ERROR_TRAITS_NOT_IN_SYSTEM = '⛔ CONFLICTO: Uno o más rasgos proporcionados no existen en el sistema IZANAGI.';
export const ERROR_TRAIT_INCOMPATIBLE = (trait: string, other: string) =>
  `⛔ CONFLICTO: El rasgo ${trait} es incompatible con el rasgo ${other}. Elimina uno de los dos.`;
export const ERROR_RC_INVALID_AT_CREATION = (rc: number) =>
  `⛔ CONFLICTO: RC inválido al crear la ficha: ${rc}. Ajusta la selección de rasgos.`;
export const ERROR_TRAIT_NOT_FOUND = (name: string) =>
  `⛔ CONFLICTO: El rasgo '${name}' no existe en el sistema.`;
export const ERROR_CHARACTER_ALREADY_HAS_TRAIT = (name: string) =>
  `⛔ CONFLICTO: El personaje ya posee el rasgo '${name}'.`;

export const ERROR_CHARACTER_DOES_NOT_HAVE_TRAIT = (name: string) =>
  `⛔ CONFLICTO: El personaje no posee el rasgo '${name}'.`;
export const ERROR_TRAIT_INCOMPATIBLE_WITH = (name: string, other: string) =>
  `⛔ CONFLICTO: '${name}' es incompatible con '${other}'.`;
export const ERROR_RC_INSUFFICIENT = (need: number, have: number) =>
  `⛔ No hay suficientes RC. Necesitas ${need}, tienes ${have}.`;
