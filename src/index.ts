import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import 'dotenv/config';
import { prisma, disconnectPrisma } from './lib/prisma';
import { loadCommands, Command } from './lib/commandLoader';

// Commands will be loaded dynamically
let commands: Collection<string, Command>;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Vital para ver IDs de usuario
    ]
});

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Sistema IZANAGI en línea. Bot: ${c.user.tag}`);
    
    // Load commands on startup
    commands = await loadCommands();
    console.log(`📦 Loaded ${commands.size} commands`);
});

// 🧠 MANEJADOR DE COMANDOS (Dynamic)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
        console.warn(`⚠️  No command found for: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ Error executing command ${interaction.commandName}:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Error al ejecutar el comando', ephemeral: true });
        } else if (interaction.deferred) {
            await interaction.editReply({ content: '❌ Error al ejecutar el comando' });
        }
    }
});

// 🛑 GRACEFUL SHUTDOWN
process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received. Shutting down gracefully...');
    await disconnectPrisma();
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
    await disconnectPrisma();
    await client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);