# Architectural Risk Remediation Plan

**Date:** March 14, 2026
**Objective:** Harden system stability by introducing database-level enums, addressing brittle state management, removing hardcoded UI strings, and fixing timezone vulnerabilities.

---

## Phase 1: Robust State Management & Enum Integrity (Anti-Pattern Fix)

**Risk:** Storing database IDs (UserID, PlazaID) in Discord embed footers is fragile. Furthermore, storing statuses and types as raw strings invites typo-driven bugs and bypasses database-level validation.
**Solution:** Implement a `PendingWish` table and introduce strictly typed PostgreSQL Enums for both `PendingWish` and the existing `PendingPromotion` table.

### 1.1 Update Prisma Schema (`prisma/schema.prisma`)

**Action:** Define enums and update/create the relevant models.

```prisma
// 1. Define the Enums (Note: Prisma enums cannot contain spaces)
enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}

enum TipoOtorgamiento {
  DESARROLLO
  DESEO_NORMAL
  DESEO_ESPECIAL
}

// 2. Update existing PendingPromotion to use the new enum
model PendingPromotion {
  id                 String         @id @default(uuid())
  characterId        String
  // ... existing fields ...
  status             ApprovalStatus @default(PENDING) // CHANGED from String
  // ... existing fields ...
}

// 3. Create the new PendingWish model
model PendingWish {
  id                String           @id @default(uuid())
  characterId       String
  discordId         String
  plazaId           String
  tipoOtorgamiento  TipoOtorgamiento
  approvalMessageId String?          @unique
  channelId         String?
  status            ApprovalStatus   @default(PENDING)
  createdAt         DateTime         @default(now())

  character Character @relation(fields: [characterId], references: [id], onDelete: Cascade)

  @@index([characterId, status])
  @@index([approvalMessageId])
}

```

**⚠️ Complications & Conflicts (Agent Warning):**

- **Migration Conflict:** Converting `PendingPromotion.status` from a `String` to an `ApprovalStatus` enum will cause a migration conflict if there is existing data in the database. PostgreSQL cannot automatically cast a `text` column to a custom `enum` type without a specific `USING` clause.
- **Resolution:** If this is a dev environment, the agent can use `npx prisma db push --accept-data-loss` or reset the database. If this is production, the agent MUST write a custom SQL migration script to cast the existing `'PENDING'` string values to the new `ApprovalStatus.PENDING` enum before applying the Prisma schema changes. 

### 1.2 Command Refactor (`src/commands/gestion-fichas/otorgar_habilidad.ts`)

**Action:** Remove footer-ID injection, write to the DB, and translate enums for the UI.

1. Create the `PendingWish` record using `prisma.pendingWish.create(...)` with the appropriate `TipoOtorgamiento` enum.
2. **UI Translation:** Create a dictionary to map the Prisma enum to the human-readable string required for the embed.

```typescript
import { TipoOtorgamiento } from '@prisma/client';

const tipoOtorgamientoDisplay: Record<TipoOtorgamiento, string> = {
  [TipoOtorgamiento.DESARROLLO]: 'Desarrollo',
  [TipoOtorgamiento.DESEO_NORMAL]: 'Deseo Normal',
  [TipoOtorgamiento.DESEO_ESPECIAL]: 'Deseo Especial',
};

```

1. Publish the "Solicitud de Habilidad" embed using `tipoOtorgamientoDisplay[enumValue]` for the display fields.
2. Save the resulting message ID to `PendingWish.approvalMessageId`.
3. The footer should ONLY read: `"Reacciona con ✅ para aprobar | ID: <PendingWish.id>"`.

### 1.3 Handler Refactor (`src/services/WishApprovalHandler.ts`)

**Action:** Read from the database instead of the Discord Embed.

1. In `approve(ctx, staffIdentifier)`, query the database: `prisma.pendingWish.findUnique({ where: { approvalMessageId: ctx.messageId } })`.
2. Extract `userId`, `plazaId`, and `tipoOtorgamiento` from the returned database record.
3. Execute `PlazaService.assignPlaza()`.
4. Update the record: `prisma.pendingWish.update({ data: { status: ApprovalStatus.APPROVED } })`.

---

## Phase 2: Decoupling Level-Up Logic (The "Magic String" Fix)

**Risk:** `LevelUpService.ts` maps optional requirements directly to UI strings (e.g., `"Curar a N personajes"`). Any typo or UI copy change will break the system's ability to track state.

### 2.1 Define Constants (`src/config/requirements.ts`)

**Action:** Create a registry of optional requirement IDs.

```typescript
export const OPTIONAL_REQUIREMENTS = {
  NARRATIONS_3: 'REQ_NARRATIONS_3',
  HIGHLIGHTS_2: 'REQ_HIGHLIGHTS_2',
  COMBATS_C_PLUS_2: 'REQ_COMBATS_C_PLUS_2',
  CURE_5: 'REQ_CURE_5',
} as const;

```

### 2.2 Update Interface (`src/services/LevelUpService.ts`)

**Action:** Modify the `OptionalRequirement` interface to use the ID under the hood.

```typescript
interface OptionalRequirement {
  id: string;                    // e.g., OPTIONAL_REQUIREMENTS.CURE_5
  description: string;           // Display text: "Curar a 5 personajes"
  status: 'COMPLETADO' | 'PARCIAL' | 'SIN PROGRESO';
  current?: number;
  required?: number;
}

```

**⚠️ Complications & Conflicts (Agent Warning):**
Ensure that any downstream services or frontend embeds that iterate over `optionalRequirements` are updated to display the `description` field, while backend logic strictly evaluates the `id` field.

---

## Phase 3: Timezone-Safe Date Math (Salary Feature Fix)

**Risk:** Using native `new Date().getDay()` runs on UTC inside most cloud hosting environments. This causes date miscalculations for users in Venezuela (UTC-4).

### 3.1 Install Dependencies

**Action:** Ensure a robust date library is available.

```bash
npm install dayjs

```

### 3.2 Refactor Date Utility (`src/utils/dateParser.ts`)

**Action:** Implement `getMostRecentMonday` using strict timezone enforcement.

```typescript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const VZLA_TZ = 'America/Caracas';

export function getMostRecentMonday(fromDate: Date | string = new Date()): Date {
  let dateInVzla = dayjs(fromDate).tz(VZLA_TZ);
  const dayOfWeek = dateInVzla.day();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  return dateInVzla
    .subtract(daysToSubtract, 'day')
    .startOf('day')
    .toDate(); 
}

```

