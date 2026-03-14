### 1. Updates for `ARCHITECTURE.md`

You'll need to update the directory tree, the domain models, and the service list to reflect the new asynchronous router pattern and command shifts.

**A. Update the Directory Structure**

* **Remove:** `validar_ascenso.ts` from the `gestion-fichas/` tree.
* **Move:** `otorgar_habilidad.ts` visually out of any "staff-only" implications (it's already in `gestion-fichas/`, but ensure its description notes it's now player-facing).
* **Add:** `forzar_sueldo.ts` under the `staff/` folder.
* **Add New Services:** Update the `services/` folder tree to include the new router and handlers.

*Copy/paste this updated section into your tree:*

```text
│   │       ├── npc.ts             # Staff: NPC management
│   │       ├── ajustar_recursos.ts    # Staff: adjust resources
│   │       ├── bienvenida.ts      # Staff: welcome flow
│   │       └── forzar_sueldo.ts   # Staff: retroactive salary override
...
│   ├── services/                  # Business logic
│   │   ├── ReactionApprovalRouter.ts    # Centralized reaction dispatcher
│   │   ├── PromotionApprovalService.ts  # Async promotion handling
│   │   ├── WishApprovalHandler.ts       # Async skill assignment handling
...

```

**B. Update the Domain Model (Section 5)**

* Update the "Key Models" count from **14 total** to **15 total**.
* Add the new table introduced in the ascender plan:

```markdown
| `PendingPromotion` | Async workflow: stores pending rank/level requests awaiting staff approval |

```

**C. Update Gaps & Technical Debt (Section 6)**

* Under **Missing or Incomplete Functionality**, you can now strike through or remove "Weekly salary" as it is fully implemented via `SalaryService` + `/cobrar_sueldo` + `/forzar_sueldo`.

---

### 2. Updates for `QUICK_REFERENCE.md`

This file needs its command lists and service map adjusted for the new router paradigm.

**A. Update Command Groups**

* Move `/otorgar_habilidad` from Staff to Player.
* Remove `/validar_ascenso`.
* Add `/forzar_sueldo`.

*Update the lists to look like this:*

```markdown
Player commands:
- `/registro`
- `/ficha`
- `/historial`
- `/registrar_suceso`
- `/comprar`
- `/vender`
- `/tienda`
- `/transferir`
- `/cobrar_sueldo`
- `/otorgar_habilidad` (Initiates request)

Staff/Admin commands:
- `/ascender`
- `/ajustar_recursos`
- `/rechazar_registro`
- `/otorgar_rasgo`
- `/retirar_habilidad`
- `/listar_tienda`
- `/catalogo`
- `/listar`
- `/npc`
- `/bienvenida`
- `/forzar_sueldo`

```

**B. Update the Service Map**

* Add a new sub-category for your centralized routing logic.

*Add this block to your Core Services list:*

```markdown
Routing & Approval Services:
- `ReactionApprovalRouter`: Centralized dispatcher for ✅ emoji workflows.
- `PromotionApprovalService`: Handles pending rank/level promotions.
- `WishApprovalHandler`: Handles pending /otorgar_habilidad requests.

```

---

### 3. Updates for `README.md`

Based on your `LEVEL-UP-IMPROVEMENT.md` plan, there is a specific cleanup required in your root README.

* **Locate:** Line ~120 (or wherever your command list is).
* **Action:** Delete the line: `- /validar_ascenso — Validate promotion (staff)`.
