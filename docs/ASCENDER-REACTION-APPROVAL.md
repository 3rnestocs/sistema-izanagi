# `/ascender` — Reaction-Based Staff Approval & `usuario` Removal

## Status: PLAN (not implemented)

---

## 1. Problem Statement

1. The `usuario` option is unnecessary: `/ascender` should only apply to the invoking user's own character.
2. When a promotion reaches `PENDING_STAFF`, there's no mechanism for staff to approve it — the original design assumed staff would re-run the command targeting another user, which conflicts with removing `usuario`.
3. The reaction-based approval pattern already exists in two places (`ActivityApprovalService` for `registrar_suceso`, `BuildApprovalService` for build approvals) with duplicated routing logic in `index.ts`. A third instance (promotion approval) will compound the duplication.

---

## 2. Goals

- Remove `usuario` from `/ascender`. The command always targets `interaction.user`.
- Constrain `/ascender` to run only inside the user's own thread in `GESTION_FORUM_ID` (same pattern as `registro.ts` and `invertir_sp.ts`).
- Support `PENDING_STAFF` promotion approval via ✅ reaction (same UX as `registrar_suceso`).
- On approval, edit the existing pending embed in-place (color → green, title → ✅ Aprobado) instead of posting a new message.
- Centralize the reaction-approval dispatch so `index.ts` doesn't grow a new `if` branch for every approval type.

---

## 3. Current Architecture (Reaction Approval)

### 3.1 Flow for `registrar_suceso`

1. Command creates an `ActivityRecord` with `status: PENDIENTE`.
2. The embed is published as a visible message; its `message.id` is saved to `ActivityRecord.approvalMessageId`.
3. Staff reacts with ✅ on the message.
4. `index.ts` → `MessageReactionAdd` handler checks:
   - Emoji is ✅, user is admin, channel is inside a `registrar_suceso` forum.
   - Calls `ActivityApprovalService.approveActivityByMessageId(messageId, staffTag)`.
5. The service finds the `ActivityRecord` by `approvalMessageId`, applies rewards in a transaction, sets `status: APROBADO`.

### 3.2 Flow for Build Approval

1. A user posts their build in the build-approval forum.
2. Staff reacts with ✅.
3. `index.ts` → `MessageReactionAdd` checks if channel matches `BUILD_APPROVAL_FORUM_ID`.
4. Calls `BuildApprovalService.upsertApprovalFromMessage(message, staffUserId)`.

### 3.3 Duplication in `index.ts`

The `MessageReactionAdd` handler currently has two hardcoded branches:
- Build approval channel check → `buildApprovalService`
- Activity forum check → `activityApprovalService`

Adding promotion approval would require a third branch with its own channel logic.

---

## 4. Proposed Design

### 4.1 New Model: `PendingPromotion`

```prisma
model PendingPromotion {
  id               String   @id @default(uuid())
  characterId      String
  discordId        String
  targetType       String   // 'level' | 'rank'
  target           String   // 'C1', 'Jounin', etc.
  approvalMessageId String? @unique
  channelId        String?
  status           String   @default("PENDING") // PENDING, APPROVED, EXPIRED
  snapshot         Json?    // Frozen RequirementCheck.snapshot at request time
  manualRequirements String[]
  createdAt        DateTime @default(now())

  character Character @relation(fields: [characterId], references: [id], onDelete: Cascade)

  @@index([characterId, status])
  @@index([approvalMessageId])
}
```

**Why a dedicated model?** Promotions aren't activities — they have no rewards to calculate, no rank/result fields. Overloading `ActivityRecord` would require nullable columns that have no semantic meaning for promotions.

### 4.2 `/ascender` Command Changes

#### Options (final shape)

| Option | Type   | Required | Notes |
|--------|--------|----------|-------|
| `fecha`  | string | yes      | Unchanged |
| `cargo`  | string choice | no | Only charge names (Chuunin…Kage). Omit for level promotion. |

`usuario` is removed entirely.

#### Channel constraint

`/ascender` must be run inside the user's own thread in `GESTION_FORUM_ID`. Use `assertForumPostContext` with `enforceThreadOwnership: true` and the forum ID check pointing to `GESTION_FORUM_ID`. This means:
- The pending embed is always posted in the user's gestion thread — no ambiguity about where it lands.
- The reaction handler can identify promotion approvals by checking `parentId === GESTION_FORUM_ID`.

#### Execution flow

```
User runs /ascender [fecha] [cargo?]  (must be inside their GESTION_FORUM_ID thread)
  ├─ assertForumPostContext({ enforceThreadOwnership: true, GESTION_FORUM_ID })
  ├─ Resolve character from interaction.user.id
  ├─ Guard: if existing PendingPromotion with status=PENDING for this characterId → error
  ├─ Determine objective:
  │   ├─ cargo provided → targetType='rank', objective=cargo
  │   └─ cargo absent   → targetType='level', objective=getNextLevel(character.level)
  │                        (error if already S2)
  ├─ Run check (checkLevelRequirements or checkRankRequirements)
  │
  ├─ APPROVED → apply promotion immediately (existing flow)
  │
  ├─ BLOCKED → show red embed with missing requirements (existing flow)
  │
  └─ PENDING_STAFF →
      ├─ Create PendingPromotion record (status=PENDING, channelId=thread.id)
      ├─ Publish staff-review embed (yellow) as NON-EPHEMERAL reply in the gestion thread
      │   └─ Include: character info, objective, manual requirements, metrics snapshot
      │   └─ Footer: "Staff puede aprobar este ascenso reaccionando con ✅ — ID: <pendingPromotion.id>"
      ├─ Save message.id → PendingPromotion.approvalMessageId
      └─ (no separate ephemeral reply needed — the embed itself is the confirmation)
```

### 4.3 `PromotionApprovalService`

New service at `src/services/PromotionApprovalService.ts`:

```typescript
class PromotionApprovalService {
  constructor(private prisma: PrismaClient) {}

  async approveByMessageId(
    messageId: string,
    staffTag: string,
    discordMessage: Message  // passed from index.ts reaction handler
  ): Promise<boolean> {
    // 1. Find PendingPromotion by approvalMessageId where status=PENDING
    // 2. If not found → return false (not a promotion message)
    // 3. Re-validate requirements (checkLevelRequirements or checkRankRequirements)
    //    - If no longer valid:
    //        a. Update PendingPromotion.status = EXPIRED
    //        b. Edit discordMessage embed: color → red, title → "❌ Ascenso expirado"
    //        c. Return false
    // 4. Apply promotion via PromotionService.applyPromotion(characterId, targetType, target)
    // 5. Update PendingPromotion.status = APPROVED
    // 6. Edit discordMessage embed: color → green (0x57f287), title → "✅ Ascenso aprobado"
    //    Add field: "Aprobado por" → staffTag, "Fecha de aprobación" → now
    // 7. Return true
  }
}
```

**Key design decisions:**

- **Re-validate at approval time.** The character's state may have changed since the request. If requirements are no longer met, the approval fails gracefully and the embed is updated to reflect expiry.
- **`Message` is passed in, not fetched.** The reaction handler in `index.ts` already fetches the full message (`reaction.message.fetch()`). Passing it directly avoids a redundant API call inside the service and keeps the service free of Discord client coupling.
- **No TTL / automatic expiry.** Records do not expire by time. `EXPIRED` is only set when re-validation fails at approval time.
- **Record is kept after approval.** `PendingPromotion` is marked `APPROVED` (not deleted) to preserve the audit trail alongside `AuditLog`.

### 4.4 Centralized Reaction Dispatch

Instead of growing `if/else` branches in `index.ts`, introduce a registry pattern.

#### Option A: `ReactionApprovalRouter` (Recommended)

New file: `src/services/ReactionApprovalRouter.ts`

The `Message` object is now part of the handler contract because `PromotionApprovalService` needs it to edit the embed in-place.

```typescript
interface ReactionApprovalContext {
  channelId: string;
  parentId: string | null;
  messageId: string;
  message: Message;  // full fetched message, passed from reaction handler
}

interface ReactionHandler {
  matches(context: ReactionApprovalContext): boolean;
  approve(context: ReactionApprovalContext, staffIdentifier: string): Promise<boolean>;
}

class ReactionApprovalRouter {
  private handlers: ReactionHandler[] = [];

  register(handler: ReactionHandler): void {
    this.handlers.push(handler);
  }

  async route(context: ReactionApprovalContext, staffIdentifier: string): Promise<boolean> {
    for (const handler of this.handlers) {
      if (handler.matches(context)) {
        return handler.approve(context, staffIdentifier);
      }
    }
    return false;
  }
}
```

Then in `index.ts` startup:

```typescript
const router = new ReactionApprovalRouter();

router.register({
  matches: (ctx) => /* build approval channel check (BUILD_APPROVAL_FORUM_ID) */,
  approve: (ctx, staff) => buildApprovalService.upsertApprovalFromMessage(ctx.message, staff)
});

router.register({
  matches: (ctx) => /* activity forum check (REGISTRO_SUCESOS forum IDs) */,
  approve: (ctx, staff) => activityApprovalService.approveActivityByMessageId(ctx.messageId, staff)
});

router.register({
  matches: (ctx) => ctx.parentId === process.env.GESTION_FORUM_ID,
  approve: (ctx, staff) => promotionApprovalService.approveByMessageId(ctx.messageId, staff, ctx.message)
});
```

The `MessageReactionAdd` handler collapses to:

```typescript
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot || reaction.emoji.name !== '✅') return;
  // ... fetch partials, check admin ...
  const fullMessage = await reaction.message.fetch();
  const channel = reaction.message.channel;
  await router.route({
    channelId: reaction.message.channelId,
    parentId: channel?.isThread?.() ? channel.parentId : null,
    messageId: reaction.message.id,
    message: fullMessage
  }, member.user.tag);
});
```

#### Option B: DB-Only Lookup (Simpler, Less Centralized)

Skip the router. In the `MessageReactionAdd` handler, after existing build/activity checks, add a third `if` for `parentId === GESTION_FORUM_ID` that calls `promotionApprovalService.approveByMessageId(messageId, staffTag, fullMessage)`.

**Pros:** Minimal change, no new abstraction.
**Cons:** `index.ts` keeps growing. Doesn't solve the duplication for existing handlers.

---

## 5. Implementation Tasks

| #  | Task | Files | Depends On |
|----|------|-------|------------|
| 1  | Add `PendingPromotion` model to Prisma schema | `prisma/schema.prisma` | — |
| 2  | Run migration | — | 1 |
| 3  | Create `PromotionApprovalService` | `src/services/PromotionApprovalService.ts` | 1, 2 |
| 4  | Refactor `ascender.ts`: remove `usuario`, add `assertForumPostContext` for `GESTION_FORUM_ID`, add duplicate-PENDING guard, add PENDING_STAFF → publish embed + save `PendingPromotion` | `src/commands/gestion-fichas/ascender.ts` | 3 |
| 5  | Create `ReactionApprovalRouter` | `src/services/ReactionApprovalRouter.ts` | — |
| 6  | Refactor `index.ts`: replace inline `if/else` branches with router registrations; pass `Message` through context | `src/index.ts` | 5, 3 |
| 7  | Re-deploy slash commands (option shape changed) | deploy script | 4 |

Tasks 1–4 deliver the core feature. Tasks 5–6 centralize the router (can be deferred — Option B is a valid interim).

---

## 6. Edge Cases

| Case | Handling |
|------|----------|
| Staff reacts ✅ but character no longer qualifies | Re-validation fails → `PendingPromotion.status = EXPIRED`, embed edited to red "❌ Ascenso expirado". |
| User runs `/ascender` again while a PENDING exists | Guard at command start: query for existing `status=PENDING` for `characterId`. If found, throw error: "Ya tienes un ascenso pendiente de validación." |
| User levels up via other means before staff approves | Re-validation at approval time catches that `character.level` already matches or exceeds target → EXPIRED. |
| Multiple ✅ reactions from different staff | First reaction applies the promotion; subsequent calls find `status != PENDING` → no-op (returns false). |
| Staff removes ✅ reaction | Promotion approval is irreversible once applied. `ReactionRemove` is a no-op for promotions (no handler registered). |
| `PendingPromotion` table grows | No TTL. Records are only marked EXPIRED on failed re-validation. PENDING records that are never reacted to stay in the table indefinitely — acceptable given the low volume of promotions. |
| Embed posted outside gestion thread | Prevented by `assertForumPostContext` at command start. If the user is not in a `GESTION_FORUM_ID` thread, the command fails before any DB writes. |

---

## 7. Comparison: Option A vs B

| Criteria | A (Router) | B (Add `if` branch) |
|----------|-----------|---------------|
| Complexity | Medium — new abstraction, but clean | Low — just add an `if` |
| Scalability | Easy to add future approval types | Each new type = new branch |
| Refactor scope | Touches `index.ts` handler + new file | Minimal: ~5 lines in `index.ts` |
| Testability | Handlers are independently testable | Service is testable, routing isn't |
| `Message` passing | Clean via context object | Passed as argument — still works |

**Recommendation:** Implement **Option A** (router) now. The `Message` object is already part of the contract due to embed editing, so the context object is necessary regardless. The router adds minimal overhead and prevents a 4th `if` block later.
