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
    ChannelType,
    PermissionsBitField,
    REST,
    Routes,
    StringSelectMenuBuilder
} = require('discord.js');

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

const DEFAULT_CONFIG = {
    logChannel: null,
    staffRole: null,
    iaRole: null,
    mgmtRole: null,
};

let config = DEFAULT_CONFIG;

async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('Config load error:', err);
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

// ─── Constants ────────────────────────────────────────────
const BOT_COLOR = 0x2b6cb0;           // nicer hex → decimal
const SUPPORT_BANNER = "https://image2url.com/r2/default/images/1771467061096-fc09db59-fd9e-461f-ba30-c8b1ee42ff1f.jpg";
const DASHBOARD_ICON = "https://image2url.com/r2/default/images/1771563774401-5dd69719-a2a9-42d7-a76e-c9028c62fe2f.jpg";

const TICKET_ROLE_ID = "1474234032677060795";

// Store ticket metadata (channelId → data)
const ticketData = new Map();

// ─── Helpers ──────────────────────────────────────────────
function getPingRole(department) {
    if (department === 'internal-affairs') return config.iaRole;
    if (department === 'management') return config.mgmtRole;
    return config.staffRole;
}

// ─── Interaction Handler ──────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild || interaction.user.bot) return;

    try {
        // ── Slash Commands ───────────────────────────────
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'dashboard') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: "🚫 Admin only.", ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setAuthor({ name: "ALASKA STATE ROLEPLAY • OFFICIAL DIRECTORY", iconURL: DASHBOARD_ICON })
                    .setTitle("Dashboard")
                    .setDescription(
                        "**Welcome to Alaska State RolePlay!**\n\n" +
                        "Welcome to the best ER:LC roleplay community. Here you will find all of the information needed to get started.\n\n" +
                        "Before participating, make sure you've read and understand our rules and application process.\n" +
                        "Use the menu below to navigate."
                    )
                    .setColor(BOT_COLOR)
                    .setImage(DASHBOARD_ICON)
                    .setTimestamp();

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('asrp_dashboard')
                    .setPlaceholder('Select an option...')
                    .addOptions([
                        { label: 'Staff Applications', value: 'staff_apps', description: 'Apply to join the ASRP staff team', emoji: '📝' },
                        { label: 'In-Game Rules',       value: 'ig_rules',  description: 'View the ER:LC server rules',        emoji: '🎮' },
                        { label: 'Discord Rules',       value: 'dc_rules',  description: 'View community guidelines',           emoji: '📜' },
                    ]);

                await interaction.channel.send({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(menu)],
                });

                return interaction.reply({ content: "✅ Dashboard deployed.", ephemeral: true });
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
                        { label: 'General Support',   value: 'general',           emoji: '❓'  },
                        { label: 'Internal Affairs',  value: 'internal-affairs',  emoji: '👮'  },
                        { label: 'Management',        value: 'management',        emoji: '💎'  },
                    ]);

                const embed = new EmbedBuilder()
                    .setTitle('🏛️ Alaska Support')
                    .setColor(BOT_COLOR)
                    .setImage(SUPPORT_BANNER);

                await interaction.channel.send({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(menu)],
                });

                return interaction.reply({ content: "✅ Ticket panel deployed.", ephemeral: true });
            }
        }

        // ── Select Menus ─────────────────────────────────
        if (interaction.isStringSelectMenu()) {
            // Dashboard navigation (ephemeral rules/info)
            if (interaction.customId === 'asrp_dashboard') {
                const responses = {
                    staff_apps: {
                        title: "📝 Applications + Forms",
                        desc: "• **Application Information**\n┃ Our applications can be found by clicking the link below.\n• 📡 **Application Status**\n┃ 🔨 Staff Team > ` OPENED `\n\n🔗 **[ASRP Staff Application](https://your-link.com)**",
                    },
                    ig_rules: {
                        title: "🎮 In-Game Rules",
                        desc:
                            "**In-Game Rules**\n\n" +
                            "┃ **Be Respectful**\nNo bullying, hate speech, or toxic behavior.\n\n" +
                            "┃ **Exploits or Hacks**\nUsing cheats, glitches, or mods is an instant ban.\n\n" +
                            "┃ **Serious RP Only**\nNo trolling, clown RP, or unrealistic scenarios.\n\n" +
                            "┃ **Failed RP**\nDon’t do things that would be impossible in real life.\n\n" +
                            "┃ **RDM**\nKilling without valid roleplay reason is not allowed.\n\n" +
                            "┃ **VDM**\nDon’t run people over unless part of an approved RP.",
                    },
                    dc_rules: {
                        title: "📜 Discord Rules",
                        desc:
                            "### 📜 Conduct\n" +
                            "┃ **Respect**\nZero tolerance for toxicity.\n" +
                            "┃ **Advertising**\nNo DM advertising or external links.\n" +
                            "┃ **Pinging**\nDo not ping Staff without a valid reason.",
                    },
                };

                const selected = interaction.values[0];
                const res = responses[selected];

                if (!res) return interaction.reply({ content: "Invalid selection.", ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle(res.title)
                    .setDescription(res.desc)
                    .setColor(BOT_COLOR)
                    .setThumbnail(DASHBOARD_ICON);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Ticket creation
            if (interaction.customId === 'ticket_type') {
                await interaction.deferReply({ ephemeral: true });

                if (!config.staffRole) {
                    return interaction.editReply("⚠️ Bot not configured yet. Run `/setup` first.");
                }

                const department = interaction.values[0];
                const pingRoleId = getPingRole(department);

                if (!pingRoleId) {
                    return interaction.editReply("⚠️ Missing role configuration for this department.");
                }

                // Give user temporary ticket role (if needed for permissions elsewhere)
                await interaction.member.roles.add(TICKET_ROLE_ID).catch(() => {});

                const channel = await interaction.guild.channels.create({
                    name: `${department}-${interaction.user.username}`.slice(0, 100),
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: interaction.guild.id,          deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id,            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: pingRoleId,                     allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    ],
                });

                ticketData.set(channel.id, {
                    openerId: interaction.user.id,
                    startTime: Date.now(),
                    claimedBy: null,
                    department,
                });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger),
                );

                await channel.send({
                    content: `${interaction.user} | <@&${pingRoleId}>`,
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`🏛️ ${department.toUpperCase()} Session`)
                            .setColor(BOT_COLOR)
                            .setImage(SUPPORT_BANNER),
                    ],
                    components: [buttons],
                });

                return interaction.editReply(`✅ Ticket created: ${channel}`);
            }
        }

        // ── Buttons ──────────────────────────────────────
        if (interaction.isButton()) {
            const data = ticketData.get(interaction.channel.id);
            if (!data) return;

            if (interaction.customId === 'claim_ticket') {
                if (data.claimedBy) {
                    return interaction.reply({ content: "This ticket is already claimed.", ephemeral: true });
                }

                data.claimedBy = interaction.user.id;

                await interaction.reply({
                    embeds: [new EmbedBuilder().setColor(0x43b581).setDescription(`✅ Claimed by ${interaction.user}`)],
                });

                // Remove claim button, keep close
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
                );

                await interaction.message.edit({ components: [row] });
            }

            if (interaction.customId === 'close_ticket') {
                await interaction.reply("📑 **Closing ticket...**");

                // Remove ticket role from opener
                const member = await interaction.guild.members.fetch(data.openerId).catch(() => null);
                if (member) await member.roles.remove(TICKET_ROLE_ID).catch(() => {});

                // Send log
                if (config.logChannel) {
                    const logChannel = interaction.guild.channels.cache.get(config.logChannel);
                    if (logChannel) {
                        const durationMin = Math.floor((Date.now() - data.startTime) / 60000);
                        const logEmbed = new EmbedBuilder()
                            .setTitle("📁 Ticket Closed")
                            .setColor(0xff4757)
                            .addFields(
                                { name: "Opener",     value: `<@${data.openerId}>`, inline: true },
                                { name: "Closed By",  value: `${interaction.user}`,  inline: true },
                                { name: "Duration",   value: `${durationMin} min`,  inline: true },
                            )
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                    }
                }

                ticketData.delete(interaction.channel.id);
                setTimeout(() => interaction.channel.delete().catch(() => {}), 4000);
            }
        }
    } catch (err) {
        console.error('Interaction error:', err);
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({ content: "Something went wrong...", ephemeral: true }).catch(() => {});
        }
    }
});

// ─── Startup ──────────────────────────────────────────────
client.once('ready', async () => {
    await loadConfig();

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    const commands = [
        new SlashCommandBuilder()
            .setName('dashboard')
            .setDescription('Deploy the main dashboard panel'),

        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Setup ticket system (admin only)')
            .addChannelOption(opt =>
                opt.setName('logs')
                    .setDescription('Ticket log channel')
                    .setRequired(true)
            )
            .addRoleOption(opt =>
                opt.setName('staff')
                    .setDescription('General staff role')
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

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✅ ${client.user.tag} is online | ${commands.length} commands registered`);
    } catch (err) {
        console.error('Failed to register commands:', err);
    }
});

client.login(process.env.TOKEN).catch(err => {
    console.error('Login failed:', err);
    process.exit(1);
});
