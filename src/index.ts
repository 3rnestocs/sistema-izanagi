import { Client, GatewayIntentBits, Events, Collection, PermissionFlagsBits, Partials } from 'discord.js';
import 'dotenv/config';
import { prisma, disconnectPrisma } from './lib/prisma';
import { loadCommands, Command } from './lib/commandLoader';
import { BuildApprovalService } from './services/BuildApprovalService';
import { ActivityApprovalService } from './services/ActivityApprovalService';
import { getRegistrarSucesoForumIds } from './utils/channelGuards';

// Commands will be loaded dynamically
let commands: Collection<string, Command>;
const buildApprovalService = new BuildApprovalService(prisma);
const activityApprovalService = new ActivityApprovalService(prisma);
const BUILD_APPROVAL_FORUM_ID = process.env.BUILD_APPROVAL_FORUM_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Vital para ver IDs de usuario
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        if (reaction.emoji.name !== '✅') return;
        if (!reaction.message.guild) return;

        const member = await reaction.message.guild.members.fetch(user.id);
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) return;

        // Build approval: forum where users upload character builds (threads) or standalone channel
        const channel = reaction.message.channel;
        const isBuildApprovalChannel =
            BUILD_APPROVAL_FORUM_ID &&
            (reaction.message.channelId === BUILD_APPROVAL_FORUM_ID ||
                (channel?.isThread?.() && channel.parentId === BUILD_APPROVAL_FORUM_ID));
        if (isBuildApprovalChannel) {
            const fullMessage = await reaction.message.fetch();
            await buildApprovalService.upsertApprovalFromMessage(fullMessage, user.id);
            console.log(`✅ Build aprobado desde reacción en mensaje ${reaction.message.id}`);
            return;
        }

        // Activity approval: forum threads for registrar_suceso
        if (channel?.isThread?.() && channel.parentId) {
            const activityForumIds = getRegistrarSucesoForumIds();
            if (activityForumIds.includes(channel.parentId)) {
                const approved = await activityApprovalService.approveActivityByMessageId(
                    reaction.message.id,
                    user.tag ?? user.username ?? user.id
                );
                if (approved) {
                    console.log(`✅ Actividad aprobada desde reacción en mensaje ${reaction.message.id}`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error procesando aprobación por reacción:', error);
    }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        if (reaction.emoji.name !== '✅') return;
        if (!BUILD_APPROVAL_FORUM_ID) return;

        const ch = reaction.message.channel;
        const isBuildApproval =
            reaction.message.channelId === BUILD_APPROVAL_FORUM_ID ||
            (ch?.isThread?.() && ch.parentId === BUILD_APPROVAL_FORUM_ID);
        if (!isBuildApproval) return;
        if (!reaction.message.guild) return;

        const users = await reaction.users.fetch();
        const adminCheckResults = await Promise.all(
            users
                .filter((u) => !u.bot)
                .map(async (u) => {
                    const member = await reaction.message.guild!.members.fetch(u.id);
                    return member.permissions.has(PermissionFlagsBits.Administrator);
                })
        );

        const hasAdminApprover = adminCheckResults.some(Boolean);
        await buildApprovalService.setApprovalActiveStateByMessageId(reaction.message.id, hasAdminApprover);
    } catch (error) {
        console.error('❌ Error procesando remoción de aprobación por reacción:', error);
    }
});

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Sistema IZANAGI en línea. Bot: ${c.user.tag}`);
    
    // Load commands on startup
    commands = await loadCommands();
    console.log(`📦 Loaded ${commands.size} commands`);
});

// 🧠 MANEJADOR DE COMANDOS (Dynamic)
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        if (!interaction.customId.startsWith('ficha_delete:')) {
            return;
        }

        const ownerId = interaction.customId.split(':')[1];
        const isCommandAuthor = interaction.user.id === ownerId;
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
        const isThreadOwner = interaction.channel?.isThread?.() && interaction.channel.ownerId === interaction.user.id;

        if (!isCommandAuthor && !isAdmin && !isThreadOwner) {
            await interaction.reply({
                content: '⛔ Solo el autor de la ficha, el dueño del post o staff puede eliminar este mensaje.',
                ephemeral: true
            });
            return;
        }

        try {
            await interaction.message.delete();
        } catch (error) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ No se pudo eliminar el mensaje de ficha.',
                    ephemeral: true
                });
            }
        }
        return;
    }

    if (interaction.isAutocomplete()) {
        const command = commands.get(interaction.commandName);
        if (!command?.autocomplete) {
            await interaction.respond([]);
            return;
        }

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(`❌ Error handling autocomplete for ${interaction.commandName}:`, error);
            if (!interaction.responded) {
                await interaction.respond([]);
            }
        }

        return;
    }

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