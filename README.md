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
REGISTRO_SUCESOS_FORUM_ID="#🎯-registro-actividades"
```

Optional advanced channel routing:

```env
# Comma-separated forum IDs used as fallback for player commands
PLAYER_FORUM_CHANNEL_IDS="123456789012345678,234567890123456789"

# Command-specific forum map: commandName:forumId|forumId;otherCommand:forumId
# Forums: gestion-de-fichas, registro-de-sucesos, tienda
PLAYER_COMMAND_FORUM_MAP="registro:GESTION_FORUM_ID;ficha:GESTION_FORUM_ID;invertir_sp:GESTION_FORUM_ID;otorgar_habilidad:GESTION_FORUM_ID;retirar_habilidad:GESTION_FORUM_ID;otorgar_rasgo:GESTION_FORUM_ID;ascender:GESTION_FORUM_ID;validar_ascenso:GESTION_FORUM_ID;rechazar_registro:GESTION_FORUM_ID;catalogo:GESTION_FORUM_ID;listar:GESTION_FORUM_ID;registrar_suceso:REGISTRO_SUCESOS_FORUM_ID;comprar:TIENDA_FORUM_ID;vender:TIENDA_FORUM_ID;transferir:TIENDA_FORUM_ID;cobrar_sueldo:TIENDA_FORUM_ID;tienda:TIENDA_FORUM_ID;listar_tienda:TIENDA_FORUM_ID;npc:GESTION_FORUM_ID;ajustar_recursos:GESTION_FORUM_ID"
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
- `/npc` — NPC management
- `/ajustar_recursos` — Adjust character resources

## Notes

- `src/events/` is currently empty; command flow is handled by interaction routing in `src/index.ts`.
- Seed data is JSON-based under `prisma/seed-data/`.
- High-risk player commands include in-memory anti-spam cooldowns: `/registrar_suceso`, `/comprar`, `/vender`, `/transferir`, `/cobrar_sueldo`.
- Commands are organized in subfolders under `src/commands/`: `gestion-fichas/`, `registro-sucesos/`, `tienda/`, `staff/`.
