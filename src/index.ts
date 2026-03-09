import { Client, GatewayIntentBits, Events } from 'discord.js';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as registro from './commands/registro';
import * as invertirSp from './commands/invertir_sp';
import * as comprar from './commands/comprar';
import * as transferir from './commands/transferir';
import * as registrarActividad from './commands/registrar_actividad';
import * as aprobarRegistro from './commands/aprobar_registro';
import * as validarAscenso from './commands/validar_ascenso';
import * as ascender from './commands/ascender';
import * as otorgarHabilidad from './commands/otorgar_habilidad';
import * as listarTienda from './commands/listar_tienda';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter } as any);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Vital para ver IDs de usuario
    ]
});

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Sistema IZANAGI en línea. Bot: ${c.user.tag}`);
});

// 🧠 MANEJADOR DE COMANDOS
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
        case 'registro':
            await registro.execute(interaction);
            break;
        case 'invertir_sp':
            await invertirSp.execute(interaction);
            break;
        case 'comprar':
            await comprar.execute(interaction);
            break;
        case 'transferir':
            await transferir.execute(interaction);
            break;
        case 'registrar_actividad':
            await registrarActividad.execute(interaction);
            break;
        case 'aprobar_registro':
            await aprobarRegistro.execute(interaction);
            break;
        case 'validar_ascenso':
            await validarAscenso.execute(interaction);
            break;
        case 'ascender':
            await ascender.execute(interaction);
            break;
        case 'otorgar_habilidad':
            await otorgarHabilidad.execute(interaction);
            break;
        case 'listar_tienda':
            await listarTienda.execute(interaction);
            break;
        default:
            break;
    }
});

client.login(process.env.DISCORD_TOKEN);