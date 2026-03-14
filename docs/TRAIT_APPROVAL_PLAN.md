# Trait Approval Plan

**Date:** March 14, 2026
**Objective:** Convert `/otorgar_rasgo` from a direct-execution Staff command into a player-facing async request command, utilizing the `ReactionApprovalRouter` and a database-backed state model.

---

## Phase 1: Database Schema Updates

**Target File:** `prisma/schema.prisma`

**Action:** Define the operational enum and the new pending state table.

1.  **Add Enum:** (Ensure this is at the top of the file, alongside `ApprovalStatus`).
    ```prisma
    enum TraitOperation {
      ASIGNAR
      RETIRAR
    }
    ```
2.  **Add Model:**
    ```prisma
    model PendingTraitRequest {
      id                String         @id @default(uuid())
      characterId       String
      discordId         String
      traitName         String
      operation         TraitOperation
      approvalMessageId String?        @unique
      channelId         String?
      status            ApprovalStatus @default(PENDING)
      createdAt         DateTime       @default(now())

      character Character @relation(fields: [characterId], references: [id], onDelete: Cascade)

      @@index([characterId, status])
      @@index([approvalMessageId])
    }
    ```

*Note for Agent: Generate and apply the Prisma migration (`npx prisma migrate dev --name add_pending_trait_request`) before proceeding to the code.*

---

## Phase 2: Refactor `/otorgar_rasgo.ts`

**Target File:** `src/commands/gestion-fichas/otorgar_rasgo.ts`

**Action:** Convert the command to player-facing, implement basic pre-flight checks, save to DB, and publish the pending embed.

1.  **Remove Staff Constraints:**
    * Remove `.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)`.
    * Remove the `usuario` option from the SlashCommandBuilder. The command should automatically target the invoking user (`interaction.user.id`).
    * Remove the staff permission check inside the `execute` block.
2.  **Pre-flight Validations:**
    * Fetch the character by `interaction.user.id`. If not found, throw an error.
    * Fetch the requested trait from the DB. If not found, throw an error.
3.  **Database Persistence:**
    * Create a record in `PendingTraitRequest` using the character's ID, the user's Discord ID, the exact trait name, and the mapped `TraitOperation` enum.
4.  **Embed Generation:**
    * Create a yellow embed (`0xFEE75C`).
    * **Title:** MUST be exactly `"Solicitud de Rasgo"`.
    * **Fields:** * `Personaje`: Character Name
        * `Operación`: Asignar o Remover
        * `Rasgo`: Name of the trait
        * `Costo/Reembolso RC`: Show the RC impact (calculate based on `trait.costRC` and the operation).
    * **Footer:** `"Reacciona con ✅ para aprobar | ID: <PendingTraitRequest.id>"`
5.  **Response:** Reply (non-ephemeral) with the embed so staff can see it in the channel. Save the resulting message ID to `approvalMessageId`.

---

## Phase 3: Create `TraitApprovalHandler`

**Target File:** `src/services/TraitApprovalHandler.ts` (New File)

**Action:** Implement the `ReactionHandler` interface to process the staff approval.

1.  **Class Structure:**
    ```typescript
    import { ReactionHandler, ReactionApprovalContext } from './ReactionApprovalRouter';
    import { CharacterService } from './CharacterService';
    import { prisma } from '../lib/prisma';
    import { EmbedBuilder } from 'discord.js';
    import { ApprovalStatus, TraitOperation } from '@prisma/client';

    export class TraitApprovalHandler implements ReactionHandler {
      constructor(private characterService: CharacterService) {}
      // ...
    }
    ```
2.  **Implement `matches(ctx)`:**
    * Return `true` ONLY IF `ctx.message.embeds.length > 0` AND `ctx.message.embeds[0].title === 'Solicitud de Rasgo'`.
3.  **Implement `approve(ctx, staffIdentifier)`:**
    * Query `PendingTraitRequest` where `approvalMessageId === ctx.messageId` and `status === PENDING`. If not found, return `false`.
    * **Execution Block (Try/Catch is critical here):**
        * Inside a `try` block, check the operation.
        * If `ASIGNAR`: await `this.characterService.addTrait(record.characterId, record.traitName)`.
        * If `RETIRAR`: await `this.characterService.removeTrait(record.characterId, record.traitName)`.
        * Update the database record status to `APPROVED`.
        * Edit the Discord message: Change color to Green (`0x57F287`), update Title to `"Rasgo Procesado"`, and append a field `"Aprobado por": staffIdentifier`.
        * Return `true`.
        * **Catch Block:** If the service throws an error (e.g., user spent their RC while the request was pending, or gained an incompatible trait), catch it.
        * Update the database record status to `REJECTED`.
        * Edit the Discord message: Change color to Red (`0xED4245`), update Title to `"Solicitud Rechazada"`, and append a field `"Motivo": error.message`.
        * Return `false`.

---

## Phase 4: Register the Handler

**Target File:** `src/index.ts`

**Action:** Hook the new handler into the global router.

1.  Import `TraitApprovalHandler`.
2.  Instantiate it, passing your existing `characterService` instance to its constructor.
3.  Register it: `reactionApprovalRouter.register(new TraitApprovalHandler(characterService));`.

---

## ⚠️ Complications & Conflicts (Agent Warning)

* **Service Layer Validation Reliance:** We are intentionally skipping deep validations (like category overlaps or strict RC checks) inside the command pre-flight. We rely entirely on `CharacterService.addTrait` and `removeTrait` to perform these checks during the exact moment of approval in Phase 3. The `try/catch` in the handler is mandatory to ensure state integrity.
* **RC Values Context:** In IZANAGI, a negative `costRC` means the trait *costs* RC to equip, while a positive `costRC` means it grants/refunds RC. Ensure the embed generation logic in Phase 2 formats this gracefully so users aren't confused by double-negatives (e.g., "Costo: 2 RC" instead of "Costo: -2 RC").