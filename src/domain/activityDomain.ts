export const ActivityType = {
  MISION: 'Misión',
  COMBATE: 'Combate',
  CRONICA: 'Crónica',
  EVENTO: 'Evento',
  ESCENA: 'Escena',
  EXPERIMENTO: 'Experimento',
  CURACION: 'Curación',
  LOGRO_GENERAL: 'Logro General',
  LOGRO_SAGA: 'Logro de Saga',
  LOGRO_REPUTACION: 'Logro de Reputación',
  DESARROLLO_PERSONAL: 'Desarrollo Personal',
  TIMESKIP: 'Timeskip'
} as const;

export type ActivityTypeValue = (typeof ActivityType)[keyof typeof ActivityType];

export const ActivityStatus = {
  PENDIENTE: 'PENDIENTE',
  APROBADO: 'APROBADO',
  AUTO_APROBADO: 'AUTO_APROBADO',
  RECHAZADO: 'RECHAZADO',
  REJECTED_LEGACY: 'REJECTED'
} as const;

export type ActivityStatusValue = Exclude<
  (typeof ActivityStatus)[keyof typeof ActivityStatus],
  typeof ActivityStatus.REJECTED_LEGACY
>;

export const ActivityResult = {
  EXITOSA: 'EXITOSA',
  FALLIDA: 'FALLIDA',
  VICTORIA: 'VICTORIA',
  DERROTA: 'DERROTA',
  DESTACADO: 'DESTACADO',
  PARTICIPACION: 'PARTICIPACION',
  EMPATE: 'EMPATE'
} as const;

export type ActivityResultValue = (typeof ActivityResult)[keyof typeof ActivityResult];

const ACTIVITY_TYPE_NORMALIZED_MAP: Readonly<Record<string, ActivityTypeValue>> = {
  MISION: ActivityType.MISION,
  COMBATE: ActivityType.COMBATE,
  CRONICA: ActivityType.CRONICA,
  EVENTO: ActivityType.EVENTO,
  ESCENA: ActivityType.ESCENA,
  EXPERIMENTO: ActivityType.EXPERIMENTO,
  CURACION: ActivityType.CURACION,
  'LOGRO GENERAL': ActivityType.LOGRO_GENERAL,
  'LOGRO DE SAGA': ActivityType.LOGRO_SAGA,
  'LOGRO DE REPUTACION': ActivityType.LOGRO_REPUTACION,
  'LOGROS DE REPUTACION': ActivityType.LOGRO_REPUTACION,
  'DESARROLLO PERSONAL': ActivityType.DESARROLLO_PERSONAL,
  TIMESKIP: ActivityType.TIMESKIP
};

const ACTIVITY_STATUS_NORMALIZED_MAP: Readonly<Record<string, ActivityStatusValue>> = {
  PENDIENTE: ActivityStatus.PENDIENTE,
  APROBADO: ActivityStatus.APROBADO,
  APROBADA: ActivityStatus.APROBADO,
  AUTO_APROBADO: ActivityStatus.AUTO_APROBADO,
  RECHAZADO: ActivityStatus.RECHAZADO,
  REJECTED: ActivityStatus.RECHAZADO
};

const ACTIVITY_RESULT_NORMALIZED_MAP: Readonly<Record<string, ActivityResultValue>> = {
  EXITOSA: ActivityResult.EXITOSA,
  FALLIDA: ActivityResult.FALLIDA,
  VICTORIA: ActivityResult.VICTORIA,
  DERROTA: ActivityResult.DERROTA,
  DESTACADO: ActivityResult.DESTACADO,
  PARTICIPACION: ActivityResult.PARTICIPACION,
  EMPATE: ActivityResult.EMPATE
};

const AUTO_APPROVABLE_TYPES = new Set<ActivityTypeValue>([
  ActivityType.MISION,
  ActivityType.COMBATE,
  ActivityType.CURACION,
  ActivityType.DESARROLLO_PERSONAL,
  ActivityType.CRONICA,
  ActivityType.EVENTO,
  ActivityType.LOGRO_GENERAL,
  ActivityType.LOGRO_REPUTACION
]);

const NARRATION_TYPES = new Set<ActivityTypeValue>([ActivityType.CRONICA, ActivityType.EVENTO]);

function toAsciiComparable(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function canonicalizeActivityType(value: string | null | undefined): ActivityTypeValue | null {
  if (!value) return null;
  return ACTIVITY_TYPE_NORMALIZED_MAP[toAsciiComparable(value)] ?? null;
}

export function canonicalizeActivityStatus(value: string | null | undefined): ActivityStatusValue | null {
  if (!value) return null;
  return ACTIVITY_STATUS_NORMALIZED_MAP[toAsciiComparable(value)] ?? null;
}

export function canonicalizeActivityResult(value: string | null | undefined): ActivityResultValue | null {
  if (!value) return null;
  return ACTIVITY_RESULT_NORMALIZED_MAP[toAsciiComparable(value)] ?? null;
}

export function isAutoApprovableType(type: string | null | undefined): boolean {
  const canonical = canonicalizeActivityType(type);
  return canonical ? AUTO_APPROVABLE_TYPES.has(canonical) : false;
}

export function isNarrationType(type: string | null | undefined): boolean {
  const canonical = canonicalizeActivityType(type);
  return canonical ? NARRATION_TYPES.has(canonical) : false;
}

export function isNarrationDestacadoResult(result: string | null | undefined): boolean {
  return canonicalizeActivityResult(result) === ActivityResult.DESTACADO;
}

export function isSuccessResult(result: string | null | undefined): boolean {
  const canonical = canonicalizeActivityResult(result);
  return canonical === ActivityResult.EXITOSA || canonical === ActivityResult.VICTORIA;
}

export function isFailureResult(result: string | null | undefined): boolean {
  const canonical = canonicalizeActivityResult(result);
  return canonical === ActivityResult.FALLIDA || canonical === ActivityResult.DERROTA;
}

export function isDestacadoResult(result: string | null | undefined): boolean {
  return canonicalizeActivityResult(result) === ActivityResult.DESTACADO;
}
