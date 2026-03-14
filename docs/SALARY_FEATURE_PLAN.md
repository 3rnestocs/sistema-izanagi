
**Goal:** Refactor the weekly salary system, implement canonical origin/psychological trait multipliers, enforce timezone-aware Monday claims for players, and create a staff override command to retroactively apply salaries for missed weeks.

## Phase 1: Configuration Centralization
**Target File:** Create `src/config/salaryConfig.ts`
**Instructions for AI:**
1. Create and export the `BASE_SALARIES` object:
   `Genin: 0, Chuunin: 800, 'Tokubetsu Jounin': 1200, Jounin: 1800, ANBU: 2400, Buntaichoo: 3000, 'Jounin Hanchou': 3000, 'Go-Ikenban': 3500, Kage: 5000`
2. Export `WEEKLY_EXP_BONUS = 2`.
3. Export `SALARY_COOLDOWN_DAYS = 7`.

## Phase 2: Service Logic Rewrite
**Target File:** `src/services/SalaryService.ts`
**Instructions for AI:**
1. **Signature Update:** Update the method signature to accept an override flag: `claimWeeklySalary(userId: string, forceOverride: boolean = false)`.
2. **Validation:** - Convert current time to UTC-4 (America/Caracas) using `dateParser`.
   - If `!forceOverride`: check if `getDay() === 1` and if the 7-day cooldown has passed. If not, throw the respective user-facing errors.
   - If `forceOverride`: completely skip the Monday and cooldown checks.
3. **Canonical Math:** - `baseSalary = BASE_SALARIES[character.rank] || 0`
   - `traitFlatBonus` = sum of `trait.bonusRyou` from active traits.
   - `grossIncome = baseSalary + traitFlatBonus`
   - `newBalanceBeforeMultiplier = character.ryou + grossIncome`
   - `traitMultiplier`: Start at `1`. Multiply by `trait.multiplierGanancia` (if > 1). Multiply by `trait.mechanics?.mondayTotalMultiplier` (if it exists).
   - `finalRyouBalance = Math.floor(newBalanceBeforeMultiplier * traitMultiplier)`
   - `actualRyouEarnedOrLost = finalRyouBalance - character.ryou`
4. **Execution:** Run the Prisma `$transaction` to update `ryou`, add `WEEKLY_EXP_BONUS`, update `lastSalaryClaim` to the current date, and generate the `AuditLog`.

## Phase 3: Player Command Update
**Target File:** `src/commands/tienda/cobrar_sueldo.ts`
**Instructions for AI:**
1. Ensure the command passes `false` (or nothing) to `forceOverride`.
2. Catch validation errors and reply gracefully.
3. Update the success embed to show the breakdown: Sueldo Base, Bonos de Origen, Multiplicador de Balance, Balance Final, and +2 EXP.

## Phase 4: Staff Override Command
**Target File:** Create `src/commands/staff/forzar_sueldo.ts`
**Instructions for AI:**
1. Use `src/commands/staff/ajustar_recursos.ts` as a structural template.
2. **Permissions:** Restrict to `Administrator` or valid staff roles using `staffGuards.ts`.
3. **Options:** Require a target `usuario` (Discord User).
4. **Execution:** Call `SalaryService.claimWeeklySalary(targetUserId, true)`.
5. **Response:** Reply with a green embed confirming that the salary calculation was forcibly applied to the user, displaying the updated balances.