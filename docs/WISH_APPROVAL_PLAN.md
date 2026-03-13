# WISH_APPROVAL_PLAN.md
**Goal:** Convert `/otorgar_habilidad` from a staff-only immediate execution command into a player-facing request command, utilizing the existing `ReactionApprovalRouter` pattern.

## Phase 1: Modify `/otorgar_habilidad.ts`
**Target File:** `src/commands/gestion-fichas/otorgar_habilidad.ts`

**Instructions for AI:**
1. **Remove Staff Guards:** Remove any `Administrator` permission requirements or staff-only utility checks so players can execute it.
2. **Remove Direct Execution:** Delete the direct call to `PlazaService.assignPlaza()`. We are no longer mutating the database in the command.
3. **Embed Generation:** Create a new Discord Embed with the following strict requirements:
   - **Title:** MUST be exactly `"Solicitud de Habilidad"` (this is the routing key).
   - **Color:** Yellow/Pending color.
   - **Fields:** Display the Plaza Name, Tipo de Otorgamiento (Desarrollo, Deseo Normal, Deseo Especial), and any BTS/BES costs clearly.
   - **Footer:** You MUST inject the raw IDs into the footer so the approval handler can extract them later. Format the footer text exactly like this: `UserID: {userId} | PlazaID: {plazaId} | Tipo: {tipo_otorgamiento}`.
4. **Response:** `interaction.reply()` with this embed. Do not add reactions in the command; the Staff will manually react with ✅ when they see it.

## Phase 2: Create the Reaction Handler
**Target File:** Create a new file `src/services/WishApprovalHandler.ts`

**Instructions for AI:**
1. **Class Definition:** Create `export class WishApprovalHandler implements ReactionHandler` (import the interface from your router types).
2. **Implement `matches(ctx)`:**
   - Check if `ctx.message.embeds.length > 0`.
   - Return `true` ONLY IF `ctx.message.embeds[0].title === 'Solicitud de Habilidad'`.
3. **Implement `approve(ctx, staffIdentifier)`:**
   - Extract the `userId`, `plazaId`, and `tipo_otorgamiento` from `ctx.message.embeds[0].footer.text` using regex or string splitting.
   - Call `PlazaService.assignPlaza(userId, plazaId, tipo_otorgamiento)`. (Ensure you await this).
   - If successful, create a modified version of the original embed: Change color to Green, change Title to `"Habilidad Otorgada"`, and add a field `"Aprobado por": staffIdentifier`.
   - Call `ctx.message.edit({ embeds: [updatedEmbed] })`.
   - Return `true`.
   - Wrap in a try/catch. If it fails (e.g., user doesn't have enough cupos), throw an error or edit the embed to show the failure reason, and return `false`.

## Phase 3: Register the Handler
**Target File:** `src/index.ts` (or wherever `ClientReady` is handled)

**Instructions for AI:**
1. Import `WishApprovalHandler` from `src/services/WishApprovalHandler.ts`.
2. Locate the section where `reactionApprovalRouter.register()` is being called for Builds, Activities, and Promotions.
3. Instantiate the new handler: `const wishApprovalHandler = new WishApprovalHandler(plazaService);` (inject the service if your architecture requires it).
4. Register it: `reactionApprovalRouter.register(wishApprovalHandler);`.