---
name: E2E Discord Test Guide
overview: A step-by-step end-to-end guide to test Sistema IZANAGI V2 on Discord from scratch — creating a character, registering activities, buying/selling items, and reaching rank A1.
todos:
  - id: phase0
    content: "Discord server setup: create server, roles (Staff/Player), channels, invite bot"
    status: pending
  - id: phase1
    content: "Character creation: /registro with traits, verify with /ficha"
    status: pending
  - id: phase2
    content: "Activity loop: submit activities, approve/reject, verify rewards"
    status: pending
  - id: phase3
    content: "Level progression D1 → B3: bulk activities, /validar_ascenso, /ascender"
    status: pending
  - id: phase4
    content: "Rank promotion Genin → Chuunin: B-rank mission + /ascender"
    status: pending
  - id: phase5
    content: "Economy: /tienda, /comprar, /cobrar_sueldo, /vender, /transferir"
    status: pending
  - id: phase6
    content: "Staff management: /otorgar_rasgo, /otorgar_habilidad, /retirar_habilidad"
    status: pending
  - id: phase7
    content: "Final push to A1: bulk A/B missions + narrations + /ascender objetivo: A1"
    status: pending
isProject: false
---

# E2E Discord Testing Guide — Sistema IZANAGI V2

## Prerequisites

Before touching Discord, your local environment must be running:

```bash
npm run db:seed:plazas
npm run db:seed:rasgos
npm run db:seed:mercados
node dist/deploy/deploy-commands.js   # or ts-node src/deploy/deploy-commands.ts
npm run start                          # or ts-node src/index.ts
```

Verify the bot logs `Loaded X commands` and `Ready`.

---

## Phase 0 — Discord Server Setup

### Server Creation

1. Open Discord → click **+** (Add a Server) → **Create My Own** → **For me and my friends**.
2. Name it: `IZANAGI Test`.

### Roles Required

Create these roles (Server Settings → Roles):

- `Staff` — enable **Administrator** permission. Assign to yourself.
- `Player` — no special permissions. You will use a second Discord account (or a test account) as the player.

### Channels Required

Create the following text channels:


| Channel         | Purpose                       |
| --------------- | ----------------------------- |
| `#bot-commands` | General bot interaction       |
| `#registros`    | Activity submissions (public) |
| `#admin`        | Staff-only commands           |


### Bot Invitation

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → select your bot application.
2. OAuth2 → URL Generator → Scopes: `bot`, `applications.commands`.
3. Bot Permissions: **Administrator** (simplest for testing).
4. Copy the generated URL, open it in browser, invite the bot to `IZANAGI Test`.

### `.env` Configuration

```
DISCORD_TOKEN=<your bot token>
CLIENT_ID=<your bot application ID>
GUILD_ID=<ID of the IZANAGI Test server>
DATABASE_URL=postgresql://...
```

---

## Phase 1 — Character Creation

**Actor: Player account** (no Administrator role needed)

### Step 1.1 — Check available traits

Before registering, you need valid trait names. Use the Staff account to run:

```
/listar_tienda   (or check seed data for trait names)
```

From the seed data, known valid traits include:

- **Origen traits:** `Katon`, `Suiton`, `Fuuton`, `Raiton`, `Doton`
- **Nacimiento traits:** `Ambicioso`, `Presteza`, `Arrepentimiento`, `Leyenda`, `Presionado`

### Step 1.2 — Register the character

In `#bot-commands`, run as the **Player**:

```
/registro
  keko: TestPlayer
  nombre: Izanagi Taro
  rasgo_origen: Katon
  rasgo_nacimiento: Ambicioso
```

**Expected result:** Ephemeral embed showing:

- Character created with D1 rank
- Initial Ryou, RC (Relationship Credits), Cupos, SP values
- Traits assigned: Katon + Ambicioso

### Step 1.3 — View the character sheet

```
/ficha
```

**Expected result:** Public embed with all stats at D1 defaults, traits listed, empty inventory, no activities.

---

## Phase 2 — Activity Registration & Approval

This is the core loop. You need EXP and PR to level up. The path to A1 requires **500 EXP** and **1000 PR**.

### Activity Types Reference


| Type          | Requires `rango`? | Requires `resultado`? | Notes             |
| ------------- | ----------------- | --------------------- | ----------------- |
| Misión        | Yes               | Yes                   | Main EXP source   |
| Combate       | Yes               | Yes                   | PR source         |
| Crónica       | No                | No                    | Narration         |
| Escena        | No                | No                    | Narration         |
| Logro General | No                | No                    | Achievement       |
| Timeskip      | No                | No                    | Time passage      |
| Mesiversario  | No                | No                    | Monthly milestone |


### Step 2.1 — Submit a D-rank mission (Player)

In `#registros`:

```
/registrar_actividad
  tipo: Misión
  evidencia: https://example.com/mission-1
  rango: D
  resultado: Exitosa
```

**Expected result:** Public message showing the activity ID (e.g., `act_abc123`) and status `PENDING`.

### Step 2.2 — Approve the activity (Staff)

In `#admin`, with the **Staff account**:

```
/aprobar_registro
  registro_id: <ID from step 2.1>
```

**Expected result:** Ephemeral confirmation showing EXP, PR, and Ryou rewarded. The character's stats update immediately.

### Step 2.3 — Verify rewards

Back as **Player**:

```
/ficha
```

Check that EXP, PR, and Ryou increased. Also check that the activity appears in "Recent Activity".

### Step 2.4 — Reject an activity (optional test)

Submit another activity as Player, then as Staff:

```
/rechazar_registro
  actividad_id: <ID>
  razon: Evidencia insuficiente
```

**Expected result:** Activity status changes to `REJECTED`. No rewards granted.

---

## Phase 3 — Leveling Up (D1 → B3)

The progression to A1 requires passing through multiple levels. Each level-up is a two-step process: validate requirements, then apply the promotion.

### EXP Thresholds Summary

```
D1 → D2: 40 EXP
D2 → D3: 80 EXP
D3 → C1: 100 EXP
C1 → C2: 150 EXP
C2 → C3: 200 EXP
C3 → B1: 250 EXP + PR ≥ 500
B1 → B2: 350 EXP
B2 → B3: 450 EXP
B3 → A1: 500 EXP + PR ≥ 1000
```

### Step 3.1 — Bulk activity registration to accumulate EXP

Register and approve multiple activities. Suggested batch to reach D3 quickly:

```
# Player submits (repeat as needed):
/registrar_actividad tipo: Misión evidencia: https://... rango: D resultado: Exitosa
/registrar_actividad tipo: Crónica evidencia: https://...
/registrar_actividad tipo: Escena evidencia: https://...
/registrar_actividad tipo: Logro General evidencia: https://...

# Staff approves each one:
/aprobar_registro registro_id: <each ID>
```

### Step 3.2 — Check promotion eligibility (Player or Staff)

```
/validar_ascenso
  objetivo: D2
```

**Expected result:** Ephemeral report showing pass/fail for each requirement. If all green, proceed.

### Step 3.3 — Apply promotion (Staff only)

```
/ascender
  usuario: @TestPlayer
  objetivo: D2
```

**Expected result:** Confirmation showing previous level D1 → new level D2.

### Step 3.4 — Repeat for each level

Repeat steps 3.1–3.3 for each level: D2, D3, C1, C2, C3, B1, B2, B3.

**Important notes per level:**

- **C1:** Requires at least 1 narration (Crónica/Escena) OR 1 combat OR 2 D-rank missions. Also requires manual Staff validation of "5 days as Rank D" (just confirm it in Discord).
- **B1:** Requires PR ≥ 500. Submit Combate activities to accumulate PR.
- **B3 → A1:** Requires PR ≥ 1000 and 14 days as Rank B (manual Staff validation).

---

## Phase 4 — Rank Promotion (Genin → Chuunin)

Rank (cargo) is separate from level. Chuunin is the first rank promotion.

### Chuunin Requirements

- EXP ≥ 120
- PR ≥ 400
- At least 1 B/A/S-rank mission (any result)

### Step 4.1 — Submit a B-rank mission

```
/registrar_actividad
  tipo: Misión
  evidencia: https://...
  rango: B
  resultado: Exitosa
```

Approve it as Staff.

### Step 4.2 — Validate Chuunin promotion

```
/validar_ascenso
  objetivo: Chuunin
```

### Step 4.3 — Apply Chuunin promotion

```
/ascender
  usuario: @TestPlayer
  objetivo: Chuunin
```

**Expected result:** Character rank changes from Genin → Chuunin. Weekly salary now 800 Ryou.

---

## Phase 5 — Shop & Economy

### Step 5.1 — Browse the shop (Player)

```
/tienda
/tienda moneda: RYOU
/tienda categoria: arma
/tienda pagina: 2 tamano_pagina: 5
```

**Expected result:** Embed listing items with prices. Footer shows your current Ryou/EXP/PR balance.

### Step 5.2 — Buy items

```
/comprar
  items: Kunai
```

Or multiple:

```
/comprar
  items: Kunai, Shuriken, Kunai
```

**Expected result:** Ephemeral confirmation with cost breakdown. Ryou deducted. Items appear in `/ficha` inventory.

### Step 5.3 — Claim weekly salary (Player)

```
/cobrar_sueldo
```

**Expected result:** Public embed showing base salary (800 Ryou as Chuunin), any trait bonuses (Ambicioso gives Ryou multiplier), and final Ryou received. Attempting again within 7 days shows cooldown error.

### Step 5.4 — Sell items

```
/vender
  items: Kunai
```

**Expected result:** Public embed showing item sold at 50% of base price. Ryou credited.

### Step 5.5 — Transfer Ryou/items (optional)

Using a second account:

```
/transferir
  destinatario: @OtherPlayer
  ryou: 100
```

Or transfer an item:

```
/transferir
  destinatario: @OtherPlayer
  items: Shuriken
```

---

## Phase 6 — Trait & Plaza Management (Staff)

### Step 6.1 — Grant a trait post-creation

```
/otorgar_rasgo
  usuario: @TestPlayer
  operacion: ASIGNAR
  rasgo: Presteza
```

**Expected result:** Trait added, RC deducted, stats updated (Presteza gives EXP multiplier 1.5x).

### Step 6.2 — Grant a plaza/ability

```
/otorgar_habilidad
  usuario: @TestPlayer
  plaza: <plaza name from seed>
  tipo_otorgamiento: DESARROLLO
  evidencia: https://...
```

**Expected result:** Cupos decremented, plaza appears in `/ficha`.

### Step 6.3 — Remove a trait

```
/otorgar_rasgo
  usuario: @TestPlayer
  operacion: RETIRAR
  rasgo: Presteza
```

**Expected result:** RC refunded, stat bonus reversed.

### Step 6.4 — Remove a plaza

```
/retirar_habilidad
  usuario: @TestPlayer
  habilidad: <plaza name>
```

**Expected result:** Cupos refunded, inherited traits removed.

---

## Phase 7 — Reaching A1

### Requirements for A1

- EXP ≥ 500
- PR ≥ 1000
- Manual: 14 days as Rank B (Staff validates)
- At least 1 of: 6 narrations, 3 highlighted narrations, 5 B/A mission equivalents, 3 combat wins vs A+, or 8 achievements

### Recommended activity batch to reach A1 from B3

```
# Submit and approve these:
/registrar_actividad tipo: Misión rango: A resultado: Exitosa evidencia: https://...   (x3)
/registrar_actividad tipo: Misión rango: B resultado: Exitosa evidencia: https://...   (x3)
/registrar_actividad tipo: Crónica evidencia: https://...                               (x6)
/registrar_actividad tipo: Combate rango: A resultado: Exitosa evidencia: https://...  (x3)
/registrar_actividad tipo: Logro General evidencia: https://...                         (x8)
```

### Final promotion steps

```
# Validate
/validar_ascenso objetivo: A1

# Apply (Staff)
/ascender usuario: @TestPlayer objetivo: A1
```

### Verify final state

```
/ficha
```

**Expected final state:**

- Level: A1
- Rank: Chuunin (or higher if you also ran Tokubetsu Jounin/Jounin promotions)
- EXP ≥ 500, PR ≥ 1000
- Inventory with purchased items
- Traits: Katon, Ambicioso, any post-creation traits
- Recent activities showing the full history

---

## Troubleshooting Reference


| Problem                               | Likely Cause                  | Fix                                                                                              |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Bot doesn't respond to slash commands | Commands not deployed         | Run `deploy-commands.ts` and wait ~1 hour for global propagation (or use `GUILD_ID` for instant) |
| "No character found"                  | Wrong Discord account         | Make sure you're using the account that ran `/registro`                                          |
| "Insufficient permissions"            | Missing Administrator role    | Assign Staff role with Administrator permission                                                  |
| Activity ID not found                 | Copied wrong ID               | Use the exact ID from the `/registrar_actividad` response                                        |
| Salary cooldown                       | Already claimed within 7 days | Wait 7 days or manually reset `lastSalaryClaim` in DB                                            |
| `/tienda` shows no items              | Seed not run                  | Run `npm run db:seed:mercados`                                                                   |
| Traits not found in `/registro`       | Seed not run                  | Run `npm run db:seed:rasgos`                                                                     |
| Plaza not found                       | Seed not run                  | Run `npm run db:seed:plazas`                                                                     |


