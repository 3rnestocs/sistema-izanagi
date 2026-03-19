/**
 * Audit log detail templates for LevelUpService.
 * Used when creating AuditLog entries for ascenso and salary.
 */

/** Ascenso applied: level and rank change. */
export const AUDIT_ASCENSO_DETAIL = (
  approvedBy: string,
  prevLevel: string,
  nextLevel: string,
  prevRank: string,
  nextRank: string,
  target: string
) =>
  `Ascenso aplicado por ${approvedBy}. Nivel: ${prevLevel} -> ${nextLevel}. Cargo: ${prevRank} -> ${nextRank}. Objetivo: ${target}`;

/** Salary claim with Monday multiplier. */
export const AUDIT_SALARY_WITH_MULTIPLIER = (
  grossSalary: number,
  mult: number,
  delta: number
) =>
  `Cobro semanal: +${grossSalary} Ryou. Multiplicador lunes aplicado (${mult.toFixed(2)}x): ${delta >= 0 ? '+' : ''}${delta} Ryou.`;

/** Salary claim without multiplier. */
export const AUDIT_SALARY_SIMPLE = (grossSalary: number) =>
  `Cobro semanal exitoso: +${grossSalary} Ryou.`;
