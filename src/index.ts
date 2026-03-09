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
const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
    
    try {
        // Set timeout: force shutdown after 10 seconds
        const shutdownTimeout = setTimeout(() => {
            console.error('❌ Graceful shutdown timeout. Force exiting...');
            process.exit(1);
        }, 10000);

        // Disconnect Discord bot
        console.log('📡 Disconnecting from Discord...');
        await client.destroy();
        console.log('✅ Discord bot disconnected');

        // Disconnect database
        console.log('💾 Disconnecting from database...');
        await disconnectPrisma();
        console.log('✅ Database disconnected');

        // Clear timeout if we got here successfully
        clearTimeout(shutdownTimeout);
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

client.login(process.env.DISCORD_TOKEN);