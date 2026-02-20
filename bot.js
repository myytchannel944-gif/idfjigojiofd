// index.js
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const {
    Client,
    GatewayIntentBits,
    Partials,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionsBitField,
    REST,
    Routes,
} = require('discord.js');

/** @type {import('discord.js').Client<true>} */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
    ],
});

// ─── Configuration ────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');

/** @type {import('./types').BotConfig} */
const DEFAULT_CONFIG = {
    logChannel: null,
    staffRole: null,
    iaRole: null,
    mgmtRole: null,
};

/** @type {import('./types').BotConfig} */
let config = { ...DEFAULT_CONFIG };

async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        console.log('Config loaded');
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('Failed to load config:', err);
        }
        config = { ...DEFAULT_CONFIG };
    }
}

async function saveConfig() {
    try {
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
        console.error('Failed to save config:', err);
    }
}

// ─── Constants & Assets ───────────────────────────────────
const COLORS = {
    PRIMARY: 0x2b6cb0,
    SUCCESS: 0x43b581,
    DANGER:  0xff4757,
};

const ASSETS = {
    SUPPORT_BANNER: "https://image2url.com/r2/default/images/1771467061096-fc09db59-fd9e-461f-ba30-c8b1ee42ff1f.jpg",
    DASHBOARD_ICON: "https://image2url.com/r2/default/images/1771563774401-5dd69719-a2a9-42d7-a76e-c9028c62fe2f.jpg",
};

const TICKET_ROLE_ID = "1474234032677060795";

const ticketData = new Map(); // channelId → ticket metadata

// ─── Helpers ──────────────────────────────────────────────
/**
 * @param {string} department
 * @returns {string | null}
 */
function getPingRoleId(department) {
    if (department === 'internal-affairs') return config.iaRole;
    if (department === 'management')     return config.mgmtRole;
    return config.staffRole;
}

/**
 * @param {import('discord.js').TextChannel} channel
 * @param {string} department
 * @param {import('discord.js').GuildMember} opener
 */
async function createTicketChannel(channel, department, opener) {
    const pingRoleId = getPingRoleId(department);
    if (!pingRoleId) throw new Error(`No role configured for department: ${department}`);

    const name = `${department}-${opener.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100);

    return channel.guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: channel.parentId ?? undefined,
        permissionOverwrites: [
            { id: channel.guild.id,               deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: opener.id,                       allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: pingRoleId,                      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ],
    });
}

function createTicketEmbed(department) {
    return new EmbedBuilder()
        .setTitle(`🏛️ ${department.toUpperCase()} Support`)
        .setColor(COLORS.PRIMARY)
        .setImage(ASSETS.SUPPORT_BANNER);
}

function createControlButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
    );
}

// ─── Interaction Handler ──────────────────────────────────
client.on('interactionCreate', async interaction => {
    if (!interaction.isDiscord().guild || interaction.user.bot) return;

    try {
        // ── Slash Commands ────────────────────────────────
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'dashboard') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: "🚫 Admin only.", ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setAuthor({ name: "ALASKA STATE ROLEPLAY • OFFICIAL DIRECTORY", iconURL: ASSETS.DASHBOARD_ICON })
                    .setTitle("Dashboard")
                    .setDescription(
                        "**Welcome to Alaska State RolePlay!**\n\n" +
                        "The best ER:LC roleplay community.\n\n" +
                        "Make sure you've read the rules and understand the application process.\n" +
                        "Use the menu below to navigate."
                    )
                    .setColor(COLORS.PRIMARY)
                    .setImage(ASSETS.DASHBOARD_ICON)
                    .setTimestamp();

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('asrp_dashboard')
                    .setPlaceholder('Select an option...')
                    .addOptions([
                        { label: 'Staff Applications', value: 'staff_apps', emoji: '📝' },
                        { label: 'In-Game Rules',      value: 'ig_rules',   emoji: '🎮' },
                        { label: 'Discord Rules',      value: 'dc_rules',   emoji: '📜' },
                    ]);

                await interaction.channel.send({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(menu)],
                });

                return interaction.reply({ content: "✅ Dashboard panel deployed.", ephemeral: true });
            }

            if (interaction.commandName === 'setup') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: "🚫 Admin only.", ephemeral: true });
                }

                config.logChannel   = interaction.options.getChannel('logs')?.id ?? null;
                config.staffRole    = interaction.options.getRole('staff')?.id ?? null;
                config.iaRole       = interaction.options.getRole('ia_role')?.id ?? null;
                config.mgmtRole     = interaction.options.getRole('management_role')?.id ?? null;

                await saveConfig();

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('ticket_type')
                    .setPlaceholder('Select Department...')
                    .addOptions([
                        { label: 'General Support',   value: 'general',         emoji: '❓' },
                        { label: 'Internal Affairs',  value: 'internal-affairs', emoji: '👮' },
                        { label: 'Management',        value: 'management',      emoji: '💎' },
                    ]);

                const embed = new EmbedBuilder()
                    .setTitle('🏛️ Alaska Support')
                    .setColor(COLORS.PRIMARY)
                    .setImage(ASSETS.SUPPORT_BANNER);

                await interaction.channel.send({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(menu)],
                });

                return interaction.reply({ content: "✅ Ticket panel deployed.", ephemeral: true });
            }
        }

        // ── Select Menus ──────────────────────────────────
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'asrp_dashboard') {
                const pages = {
                    staff_apps: {
                        title: "📝 Applications + Forms",
                        content:
                            "• **Staff Application**\n" +
                            "Applications are currently **OPEN**\n\n" +
                            "🔗 [Apply here](https://your-link.com)\n\n" +
                            "Check your status in <#staff-announcements>",
                    },
                    ig_rules: {
                        title: "🎮 In-Game Rules",
                        content:
                            "**Serious Roleplay Only**\n\n" +
                            "• Be respectful — no hate speech / toxicity\n" +
                            "• No exploits, cheats, mods\n" +
                            "• No RDM / VDM\n" +
                            "• No failed RP or powergaming\n" +
                            "• No trolling or unrealistic scenarios",
                    },
                    dc_rules: {
                        title: "📜 Discord Rules",
                        content: "Same core rules as in-game:\nRespect, no toxicity, no spam, no advertising.",
                    },
                };

                const selected = interaction.values[0];
                const page = pages[selected];

                if (!page) {
                    return interaction.reply({ content: "Invalid option.", ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle(page.title)
                    .setDescription(page.content)
                    .setColor(COLORS.PRIMARY)
                    .setThumbnail(ASSETS.DASHBOARD_ICON);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === 'ticket_type') {
                await interaction.deferReply({ ephemeral: true });

                if (!config.staffRole) {
                    return interaction.editReply("⚠️ Bot not fully configured. Run `/setup` first.");
                }

                const department = interaction.values[0];
                const opener = interaction.member;

                const ticketChannel = await createTicketChannel(interaction.channel, department, opener);

                ticketData.set(ticketChannel.id, {
                    openerId: opener.id,
                    startTime: Date.now(),
                    claimedBy: null,
                    department,
                });

                await opener.roles.add(TICKET_ROLE_ID).catch(() => {});

                await ticketChannel.send({
                    content: `${opener} | <@&${getPingRoleId(department)}>`,
                    embeds: [createTicketEmbed(department)],
                    components: [createControlButtons()],
                });

                return interaction.editReply(`✅ Ticket created → ${ticketChannel}`);
            }
        }

        // ── Buttons ───────────────────────────────────────
        if (interaction.isButton()) {
            const data = ticketData.get(interaction.channel.id);
            if (!data) return;

            if (interaction.customId === 'claim_ticket') {
                if (data.claimedBy) {
                    return interaction.reply({ content: "Ticket already claimed.", ephemeral: true });
                }

                data.claimedBy = interaction.user.id;

                await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(COLORS.SUCCESS)
                        .setDescription(`✅ Ticket claimed by ${interaction.user}`)],
                });

                await interaction.message.edit({ components: [createControlButtons(true)] });
            }

            if (interaction.customId === 'close_ticket') {
                await interaction.reply("📑 Closing ticket in a few seconds...");

                const member = await interaction.guild.members.fetch(data.openerId).catch(() => null);
                if (member) await member.roles.remove(TICKET_ROLE_ID).catch(() => {});

                // Log ticket
                if (config.logChannel) {
                    const logChannel = interaction.guild.channels.cache.get(config.logChannel);
                    if (logChannel?.isTextBased()) {
                        const duration = Math.floor((Date.now() - data.startTime) / 60000);
                        const logEmbed = new EmbedBuilder()
                            .setTitle("📁 Ticket Closed")
                            .setColor(COLORS.DANGER)
                            .addFields(
                                { name: "Opener",     value: `<@${data.openerId}>`, inline: true },
                                { name: "Closed by",  value: `${interaction.user}`, inline: true },
                                { name: "Duration",   value: `${duration} min`,     inline: true },
                                { name: "Department", value: data.department,       inline: true },
                            )
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                    }
                }

                ticketData.delete(interaction.channel.id);
                setTimeout(() => interaction.channel.delete().catch(() => {}), 3500);
            }
        }
    } catch (err) {
        console.error('Interaction handler error:', err);
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({ content: "Something went wrong internally.", ephemeral: true }).catch(() => {});
        }
    }
});

// ─── Startup ──────────────────────────────────────────────
client.once('ready', async () => {
    await loadConfig();

    const commands = [
        new SlashCommandBuilder()
            .setName('dashboard')
            .setDescription('Deploy the main information dashboard'),

        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Configure ticket system & deploy panel')
            .addChannelOption(opt =>
                opt.setName('logs')
                    .setDescription('Ticket log channel')
                    .setRequired(true)
            )
            .addRoleOption(opt =>
                opt.setName('staff')
                    .setDescription('General staff/support role')
                    .setRequired(true)
            )
            .addRoleOption(opt =>
                opt.setName('ia_role')
                    .setDescription('Internal Affairs role')
                    .setRequired(true)
            )
            .addRoleOption(opt =>
                opt.setName('management_role')
                    .setDescription('Management role')
                    .setRequired(true)
            ),
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✅ ${client.user.tag} ready • ${commands.length} commands registered`);
    } catch (err) {
        console.error('Failed to register commands:', err);
    }
});

client.login(process.env.TOKEN);
