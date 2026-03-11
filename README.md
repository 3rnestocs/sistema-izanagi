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
ACTIVITY_FORUM_MENTION="#🎯-registro-actividades"
```

Optional advanced channel routing:

```env
# Comma-separated forum IDs used as fallback for player commands
PLAYER_FORUM_CHANNEL_IDS="123456789012345678,234567890123456789"

# Command-specific forum map: commandName:forumId|forumId;otherCommand:forumId
PLAYER_COMMAND_FORUM_MAP="registrar_actividad:123456789012345678;registro:234567890123456789"
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

- Player: `/registro`, `/ficha`, `/registrar_actividad`, `/comprar`, `/vender`, `/tienda`, `/transferir`, `/cobrar_sueldo`.
- Staff/Admin: `/ascender`, `/validar_ascenso`, `/rechazar_registro`, `/ajustar_recursos`, `/otorgar_rasgo`, `/otorgar_habilidad`, `/retirar_habilidad`, `/listar_tienda`, `/npc`.

## Notes

- `src/events/` is currently empty; command flow is handled by interaction routing in `src/index.ts`.
- Seed data is JSON-based under `prisma/seed-data/`.
- High-risk player commands include in-memory anti-spam cooldowns: `/registrar_actividad`, `/comprar`, `/vender`, `/transferir`, `/cobrar_sueldo`.
