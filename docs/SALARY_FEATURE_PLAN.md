**Goal:** Implement a weekly grace period for salaries anchored to the "Most Recent Monday", utilize canonical trait multipliers, and create a staff override command that accepts retroactive Monday dates (with built-in error-correction reminders).

## Phase 1: Date Utility Update
**Target File:** `src/utils/dateParser.ts` (or similar utility file)
**Instructions for AI:**
1. Create and export a helper function `getMostRecentMonday(fromDate?: Date): Date`.
2. This function MUST ensure the math is done using the UTC-4 (America/Caracas) timezone. 
3. If `fromDate` is a Monday, return that exact date (at 00:00:00). If it's a Wednesday, return the date of the Monday immediately preceding it.

## Phase 2: Service Logic Rewrite
**Target File:** `src/services/SalaryService.ts`
**Instructions for AI:**
1. **Signature Update:** Update to `claimWeeklySalary(userId: string, claimDate: Date)`.
2. **Date Normalization:** Ensure `claimDate` is stripped of time (set to 00:00:00) so exact date matching works.
3. **Validation:** - Check if `claimDate < character.createdAt`. If true, throw `"No puedes cobrar sueldos de fechas anteriores a la creación de tu personaje."`
   - Check if the character's `lastSalaryClaim` is exactly equal to `claimDate`. If true, throw `"Ya has cobrado el sueldo correspondiente a la semana del {claimDate}."`
4. **Canonical Math:** - `baseSalary = BASE_SALARIES[character.rank] || 0`
   - `traitFlatBonus` = sum of `trait.bonusRyou` from active traits.
   - `grossIncome = baseSalary + traitFlatBonus`
   - `newBalanceBeforeMultiplier = character.ryou + grossIncome`
   - `traitMultiplier`: Start at `1`. Multiply by `trait.multiplierGanancia` (if > 1). Multiply by `trait.mechanics?.mondayTotalMultiplier` (if it exists).
   - `finalRyouBalance = Math.floor(newBalanceBeforeMultiplier * traitMultiplier)`
5. **Execution:** Prisma `$transaction` updates `ryou`, adds `WEEKLY_EXP_BONUS`, sets `lastSalaryClaim` to `claimDate`, and generates the `AuditLog`.

## Phase 3: Player Command Update
**Target File:** `src/commands/tienda/cobrar_sueldo.ts`
**Instructions for AI:**
1. Use `getMostRecentMonday(new Date())` to get the target claim date.
2. Call `SalaryService.claimWeeklySalary(interaction.user.id, mostRecentMonday)`.
3. Update the success embed to clearly show the breakdown and explicitly state: *"Correspondiente a la semana del: [Most Recent Monday Date]"*.

## Phase 4: Staff Override Command
**Target File:** Create `src/commands/staff/forzar_sueldo.ts`
**Instructions for AI:**
1. Restrict to `Administrator` or valid staff roles.
2. **Options:** Require `usuario` (User) and `fecha` (String, format DD/MM/YYYY).
3. **Date Parsing & Validation:** - Parse the `fecha` string into a Date object. 
   - Check if `parsedDate.getDay() === 1`. If not, throw `"La fecha ingresada DEBE ser un día Lunes."`
4. **Execution:** Call `SalaryService.claimWeeklySalary(targetUserId, parsedDate)`.
5. **Response:** Reply with a green embed confirming the retroactive salary application. 
6. **Safety Warning:** Add a specific field or footer to the success embed that says: *"⚠️ Nota para Staff: Si la cantidad aplicada es incorrecta debido a multiplicadores acumulativos (ej. Ambicioso), utiliza `/ajustar_recursos retirar` para corregir el saldo."*