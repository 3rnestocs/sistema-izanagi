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
import { WishApprovalHandler } from './services/WishApprovalHandler';
import { TraitApprovalHandler } from './services/TraitApprovalHandler';
import { CharacterService } from './services/CharacterService';
import { PlazaService } from './services/PlazaService';
import { ReactionApprovalRouter } from './services/ReactionApprovalRouter';
import { getRegistrarSucesoForumIds, getAllBotForumIds } from './utils/channelGuards';
import {
  ERROR_COMMAND_EXECUTION,
  ERROR_DELETE_MESSAGE_FAILED,
  ERROR_FICHA_DELETE_AUTH,
  ERROR_FICHA_DELETE_FAILED,
  ERROR_FICHA_IMAGE_OWNER_ONLY,
  ERROR_HISTORIAL_DELETE_AUTH,
  ERROR_INTERNAL,
  ERROR_URL_MUST_BE_IMAGE,
  ERROR_URL_MUST_START_HTTPS,
  MODAL_FICHA_IMAGE_LABEL,
  MODAL_FICHA_IMAGE_PLACEHOLDER,
  MODAL_FICHA_IMAGE_TITLE,
  SUCCESS_FICHA_IMAGE_UPDATED
} from './config/uiStrings';
import { LOG } from './config/logStrings';

// Commands will be loaded dynamically
let commands: Collection<string, Command>;
const buildApprovalService = new BuildApprovalService(prisma);
const activityApprovalService = new ActivityApprovalService(prisma);
const promotionApprovalService = new PromotionApprovalService(prisma);
const plazaService = new PlazaService(prisma);
const characterService = new CharacterService(prisma);
const wishApprovalHandler = new WishApprovalHandler(prisma, plazaService);
const traitApprovalHandler = new TraitApprovalHandler(characterService);
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
            console.log(LOG.APPROVAL_PROCESSED(reaction.message.id));
        }
    } catch (error) {
        console.error(LOG.ERROR_REACTION_APPROVAL, error);
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
        console.error(LOG.ERROR_REACTION_REMOVE, error);
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
        console.error(LOG.ERROR_DELETE_NON_OWNER, error);
    }
});

client.once(Events.ClientReady, async (c) => {
    console.log(LOG.BOT_READY(c.user.tag));
    
    // Register reaction approval handlers (specific embed title matches)
    reactionApprovalRouter.register(wishApprovalHandler);
    reactionApprovalRouter.register(traitApprovalHandler);

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
    console.log(LOG.COMMANDS_LOADED(commands.size));
});

// 🧠 MANEJADOR DE COMANDOS (Dynamic)
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('historial_delete:')) {
            const ownerId = interaction.customId.split(':')[1];
            const isCommandAuthor = interaction.user.id === ownerId;
            const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

            if (!isCommandAuthor && !isAdmin) {
                await interaction.reply({
                    content: ERROR_HISTORIAL_DELETE_AUTH,
                    ephemeral: true
                });
                return;
            }

            try {
                await interaction.message.delete();
            } catch (error) {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: ERROR_DELETE_MESSAGE_FAILED,
                        ephemeral: true
                    });
                }
            }
            return;
        }

        if (interaction.customId.startsWith('ficha_delete:')) {
            const ownerId = interaction.customId.split(':')[1];
            const isCommandAuthor = interaction.user.id === ownerId;
            const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
            const isThreadOwner = interaction.channel?.isThread?.() && interaction.channel.ownerId === interaction.user.id;

            if (!isCommandAuthor && !isAdmin && !isThreadOwner) {
                await interaction.reply({
                    content: ERROR_FICHA_DELETE_AUTH,
                    ephemeral: true
                });
                return;
            }

            try {
                await interaction.message.delete();
            } catch (error) {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: ERROR_FICHA_DELETE_FAILED,
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
                    content: ERROR_FICHA_IMAGE_OWNER_ONLY,
                    ephemeral: true
                });
                return;
            }
            const modal = new ModalBuilder()
                .setCustomId(`ficha_set_image:${characterId}`)
                .setTitle(MODAL_FICHA_IMAGE_TITLE)
                .addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId('image_url')
                            .setLabel(MODAL_FICHA_IMAGE_LABEL)
                            .setPlaceholder(MODAL_FICHA_IMAGE_PLACEHOLDER)
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
                await interaction.reply({ content: ERROR_INTERNAL, ephemeral: true });
                return;
            }
            const urlInput = interaction.fields.getTextInputValue('image_url').trim();
            const character = await prisma.character.findUnique({
                where: { id: characterId }
            });
            if (!character || character.discordId !== interaction.user.id) {
                await interaction.reply({
                    content: ERROR_FICHA_IMAGE_OWNER_ONLY,
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
                    content: ERROR_URL_MUST_START_HTTPS,
                    ephemeral: true
                });
                return;
            }
            if (!isExtension && !isKnownHost) {
                await interaction.reply({
                    content: ERROR_URL_MUST_BE_IMAGE,
                    ephemeral: true
                });
                return;
            }
            await prisma.character.update({
                where: { id: characterId as string },
                data: { imageUrl: urlInput }
            });
            await interaction.reply({
                content: SUCCESS_FICHA_IMAGE_UPDATED,
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
            console.error(LOG.ERROR_AUTOCOMPLETE(interaction.commandName), error);
            if (!interaction.responded) {
                await interaction.respond([]);
            }
        }

        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
        console.warn(LOG.WARN_NO_COMMAND(interaction.commandName));
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(LOG.ERROR_EXECUTE_COMMAND(interaction.commandName), error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: ERROR_COMMAND_EXECUTION, ephemeral: true });
        } else if (interaction.deferred) {
            await interaction.editReply({ content: ERROR_COMMAND_EXECUTION });
        }
    }
});

// 🛑 GRACEFUL SHUTDOWN
const gracefulShutdown = async (signal: string) => {
    console.log(LOG.SHUTDOWN_START(signal));

    try {
        // Set timeout: force shutdown after 10 seconds
        const shutdownTimeout = setTimeout(() => {
            console.error(LOG.SHUTDOWN_TIMEOUT);
            process.exit(1);
        }, 10000);

        // Disconnect Discord bot
        console.log(LOG.DISCONNECTING_DISCORD);
        await client.destroy();
        console.log(LOG.DISCORD_DISCONNECTED);

        // Disconnect database
        console.log(LOG.DISCONNECTING_DB);
        await disconnectPrisma();
        console.log(LOG.DB_DISCONNECTED);

        // Clear timeout if we got here successfully
        clearTimeout(shutdownTimeout);

        console.log(LOG.SHUTDOWN_COMPLETE);
        process.exit(0);
    } catch (error) {
        console.error(LOG.ERROR_SHUTDOWN, error);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

client.login(process.env.DISCORD_TOKEN);