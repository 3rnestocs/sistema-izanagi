# Sistema IZANAGI V2

Discord bot + PostgreSQL backend for Naruto RP character, economy, progression, and activity management.

## Current Canonical Docs

- `ARCHITECTURE.md` - System architecture, domain model, migration context.
- `planning_logs/QUICK_REFERENCE.md` - Operational command/service cheat sheet.
- `planning_logs/CHAKRA_NACIMIENTO_RULES_UPDATE.md` - Chakra/Nacimiento rules specification.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env` in the project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/izanagi"
DISCORD_TOKEN="your-bot-token"
CLIENT_ID="your-discord-app-id"
GUILD_ID="your-test-server-id"
```

**Forum IDs** (use actual Discord channel IDs, not names):

```env
# Where /registro, /ficha, /invertir_sp, etc. run (gestion-de-fichas)
GESTION_FORUM_ID="1234567890123456789"

# Where users upload character builds for staff approval (e.g. #🛠️-registro-builds). Staff reacts with ✅ to approve.
BUILD_APPROVAL_FORUM_ID="1234567890123456790"

# Where /registrar_suceso runs (registro-de-sucesos)
REGISTRO_SUCESOS_FORUM_ID="1234567890123456791"

# Where /comprar, /vender, /transferir, /cobrar_sueldo run (tienda)
TIENDA_FORUM_ID="1234567890123456792"
```

**Note:** `GESTION_FORUM_ID` and `BUILD_APPROVAL_FORUM_ID` are different: the first is for running ficha commands; the second is where players post their builds for approval before using `/registro`.

Optional advanced channel routing:

```env
# Comma-separated forum IDs used as fallback for player commands
PLAYER_FORUM_CHANNEL_IDS="1234567890123456789,1234567890123456791"

# Command-specific forum map: commandName:forumId|forumId;otherCommand:forumId
# Use actual numeric IDs (same as GESTION_FORUM_ID, REGISTRO_SUCESOS_FORUM_ID, TIENDA_FORUM_ID)
PLAYER_COMMAND_FORUM_MAP="registro:1234567890123456789;ficha:1234567890123456789;..."
```

### 3. Prepare database

```bash
npm run db:seed:rasgos
npm run db:seed:plazas
npm run db:audit:plaza-traits
npm run db:seed:mercados
```

If you change `prisma/seed-data/traits.json` or `prisma/seed-data/plazas.json`, re-run the two seed commands above and then the audit command to verify that all `Plaza -> Rasgo` inheritances were persisted in DB.

### 4. Deploy slash commands

```bash
npx ts-node src/deploy/deploy-commands.ts
```

### 5. Build and run

```bash
npm run build
npm run start
```

For development:

```bash
npm run dev
```

## Main Command Groups

### Gestion de Fichas (#gestion-de-fichas)
- `/registro` — Create character
- `/ficha` — View character
- `/invertir_sp` — Spend SP
- `/otorgar_habilidad` — Grant ability (staff)
- `/retirar_habilidad` — Revoke ability (staff)
- `/otorgar_rasgo` — Grant trait (staff)
- `/ascender` — Promote (staff)
- `/validar_ascenso` — Validate promotion (staff)
- `/rechazar_registro` — Reject registration (staff)
- `/catalogo` — Browse catalog
- `/listar` — List characters (staff)

### Registro de Sucesos (#registro-de-sucesos)
- `/registrar_suceso` — Register activity/event

### Tienda (#tienda)
- `/comprar` — Buy items
- `/vender` — Sell items
- `/transferir` — Transfer items/ryou
- `/cobrar_sueldo` — Claim weekly salary
- `/tienda` — View store inventory
- `/listar_tienda` — List store (staff)

### Staff Commands
- `/bienvenida` — Send the welcome embed message to the current channel
- `/npc` — NPC management
- `/ajustar_recursos` — Adjust character resources

## Notes

- `src/events/` is currently empty; command flow is handled by interaction routing in `src/index.ts`.
- Seed data is JSON-based under `prisma/seed-data/`.
- High-risk player commands include in-memory anti-spam cooldowns: `/registrar_suceso`, `/comprar`, `/vender`, `/transferir`, `/cobrar_sueldo`.
- Commands are organized in subfolders under `src/commands/`: `gestion-fichas/`, `registro-sucesos/`, `tienda/`, `staff/`.
