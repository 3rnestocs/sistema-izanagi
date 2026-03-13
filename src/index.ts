import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  PermissionFlagsBits,
  Partials,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} from 'discord.js';
import 'dotenv/config';
import { prisma, disconnectPrisma } from './lib/prisma';
import { loadCommands, Command } from './lib/commandLoader';
import { BuildApprovalService } from './services/BuildApprovalService';
import { ActivityApprovalService } from './services/ActivityApprovalService';
import { PromotionApprovalService } from './services/PromotionApprovalService';
import { ReactionApprovalRouter, type ReactionApprovalContext } from './services/ReactionApprovalRouter';
import { getRegistrarSucesoForumIds, getAllBotForumIds } from './utils/channelGuards';

// Commands will be loaded dynamically
let commands: Collection<string, Command>;
const buildApprovalService = new BuildApprovalService(prisma);
const activityApprovalService = new ActivityApprovalService(prisma);
const promotionApprovalService = new PromotionApprovalService(prisma);
const reactionApprovalRouter = new ReactionApprovalRouter();
const BUILD_APPROVAL_FORUM_ID = process.env.BUILD_APPROVAL_FORUM_ID;
const GESTION_FORUM_ID = process.env.GESTION_FORUM_ID;

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

        const channel = reaction.message.channel;
        const fullMessage = await reaction.message.fetch();
        
        const approved = await reactionApprovalRouter.route({
            channelId: reaction.message.channelId,
            parentId: channel?.isThread?.() ? channel.parentId : null,
            messageId: reaction.message.id,
            message: fullMessage
        }, user.tag ?? user.username ?? user.id);

        if (approved) {
            console.log(`✅ Aprobación procesada desde reacción en mensaje ${reaction.message.id}`);
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

// 🔒 Restrict thread posts: only owner + staff (Administrator) can write in bot forum threads.
// Threads inherit parent permissions so we can't use overwrites; we delete messages from non-owners.
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.inGuild() || !message.channel.isThread()) return;

    const thread = message.channel;
    const parentId = thread.parentId ?? thread.parent?.id;
    if (!parentId) return;

    const botForumIds = getAllBotForumIds();
    if (botForumIds.length === 0 || !botForumIds.includes(parentId)) return;

    const isStaff = message.member?.permissions?.has(PermissionFlagsBits.Administrator) ?? false;
    const isOwner = thread.ownerId === message.author.id;
    if (isStaff || isOwner) return;

    try {
        await message.delete();
    } catch (error) {
        console.error('❌ Error eliminando mensaje de no-dueño en thread:', error);
    }
});

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Sistema IZANAGI en línea. Bot: ${c.user.tag}`);
    
    // Register reaction approval handlers
    reactionApprovalRouter.register({
        matches: (ctx) => {
            return !!(BUILD_APPROVAL_FORUM_ID &&
                (ctx.channelId === BUILD_APPROVAL_FORUM_ID ||
                    (ctx.parentId === BUILD_APPROVAL_FORUM_ID)));
        },
        approve: async (ctx, staff) => {
            await buildApprovalService.upsertApprovalFromMessage(ctx.message, staff);
            return true;
        }
    });

    reactionApprovalRouter.register({
        matches: (ctx) => {
            const activityForumIds = getRegistrarSucesoForumIds();
            return ctx.parentId ? activityForumIds.includes(ctx.parentId) : false;
        },
        approve: (ctx, staff) => activityApprovalService.approveActivityByMessageId(ctx.messageId, staff)
    });

    reactionApprovalRouter.register({
        matches: (ctx) => ctx.parentId === GESTION_FORUM_ID,
        approve: (ctx, staff) => promotionApprovalService.approveByMessageId(ctx.messageId, staff, ctx.message)
    });
    
    // Load commands on startup
    commands = await loadCommands();
    console.log(`📦 Loaded ${commands.size} commands`);
});

// 🧠 MANEJADOR DE COMANDOS (Dynamic)
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('ficha_delete:')) {
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

        if (interaction.customId.startsWith('ficha_change_image:')) {
            const characterId = interaction.customId.split(':')[1];
            if (!characterId) return;
            const character = await prisma.character.findUnique({
                where: { id: characterId }
            });
            if (!character || character.discordId !== interaction.user.id) {
                await interaction.reply({
                    content: '⛔ Solo puedes cambiar la imagen de tu propio personaje.',
                    ephemeral: true
                });
                return;
            }
            const modal = new ModalBuilder()
                .setCustomId(`ficha_set_image:${characterId}`)
                .setTitle('Cambiar imagen del personaje')
                .addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId('image_url')
                            .setLabel('URL de la imagen')
                            .setPlaceholder('https://ejemplo.com/imagen.png')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );
            await interaction.showModal(modal);
            return;
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('ficha_set_image:')) {
            const characterId = interaction.customId.split(':')[1];
            if (!characterId) {
                await interaction.reply({ content: '⛔ Error interno.', ephemeral: true });
                return;
            }
            const urlInput = interaction.fields.getTextInputValue('image_url').trim();
            const character = await prisma.character.findUnique({
                where: { id: characterId }
            });
            if (!character || character.discordId !== interaction.user.id) {
                await interaction.reply({
                    content: '⛔ Solo puedes cambiar la imagen de tu propio personaje.',
                    ephemeral: true
                });
                return;
            }
            const validExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i;
            const knownHosts = ['imgur.com', 'i.imgur.com', 'cdn.discordapp.com', 'discordapp.com', 'media.discordapp.net'];
            const isExtension = validExtensions.test(urlInput);
            const isKnownHost = knownHosts.some((h) => urlInput.includes(h));
            if (!urlInput.startsWith('https://') && !urlInput.startsWith('http://')) {
                await interaction.reply({
                    content: '⛔ La URL debe comenzar con https:// o http://',
                    ephemeral: true
                });
                return;
            }
            if (!isExtension && !isKnownHost) {
                await interaction.reply({
                    content: '⛔ La URL debe ser de una imagen (jpg, png, gif, webp) o de un host conocido (imgur, Discord CDN).',
                    ephemeral: true
                });
                return;
            }
            await prisma.character.update({
                where: { id: characterId as string },
                data: { imageUrl: urlInput }
            });
            await interaction.reply({
                content: '✅ Imagen del personaje actualizada. Usa `/ficha` para ver el cambio.',
                ephemeral: true
            });
            return;
        }
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