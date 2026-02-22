require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
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
    StringSelectMenuBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
});

// ─── Configuration ────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');
const TICKET_STATE_PATH = path.join(__dirname, 'ticket-state.json');

const DEFAULT_CONFIG = {
    logChannel: null,
    staffRole: null,
    iaRole: null,
    mgmtRole: null,
};

let config = { ...DEFAULT_CONFIG };

async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('Config load error:', err);
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
const BOT_OWNER_ID = '1205738144323080214';
const FOUNDERSHIP_ROLE_ID = '1472278188469125355';
const BLOCKED_ROLE_IDS = ['1472280032574570616', '1472280229794943282'];
const BOT_COLOR = 0x2b6cb0;
const SUPPORT_BANNER = "https://image2url.com/r2/default/images/1771467061096-fc09db59-fd9e-461f-ba30-c8b1ee42ff1f.jpg";
const DASHBOARD_ICON = "https://image2url.com/r2/default/images/1771563774401-5dd69719-a2a9-42d7-a76e-c9028c62fe2f.jpg";
const TICKET_ROLE_ID = "1474234032677060795";
const TICKET_COOLDOWN_MS = 2 * 60 * 1000;
const TOKEN = process.env.TOKEN;
const PORT = Number(process.env.PORT) || 3000;
const GUILD_ID = '1472277307002589216'; // ← your guild ID

const ticketData = new Map();
const userLastTicketOpen = new Map();

const app = express();
app.get('/', (_, res) => res.status(200).send('ASRP bot is running'));
app.get('/health', (_, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        ready: client.isReady(),
    });
});

// ─── Priority Utilities ───────────────────────────────────
const PRIORITY_EMOJIS = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' };
const PRIORITY_COLORS = { low: 0x00FF00, medium: 0xFFFF00, high: 0xFFA500, urgent: 0xFF0000 };

// ─── Helpers ──────────────────────────────────────────────
function isFoundership(member) {
    return member.roles.cache.has(FOUNDERSHIP_ROLE_ID);
}

function getPingRole(department) {
    if (department === 'internal-affairs') return config.iaRole;
    if (department === 'management' || department === 'partnership') return config.mgmtRole;
    return config.staffRole;
}

function findExistingTicket(guild, openerId) {
    for (const [channelId, data] of ticketData.entries()) {
        if (data.openerId !== openerId) continue;
        if (!guild.channels.cache.has(channelId)) {
            ticketData.delete(channelId);
            saveTicketState().catch(console.error);
            continue;
        }
        return channelId;
    }
    return null;
}

async function loadTicketState() {
    try {
        const raw = await fs.readFile(TICKET_STATE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        ticketData.clear();
        userLastTicketOpen.clear();

        for (const [channelId, data] of Object.entries(parsed.openTickets || {})) {
            if (data?.openerId && data?.startTime) ticketData.set(channelId, data);
        }
        for (const [userId, lastOpenedAt] of Object.entries(parsed.userLastTicketOpen || {})) {
            if (lastOpenedAt) userLastTicketOpen.set(userId, Number(lastOpenedAt));
        }
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('Ticket state load error:', err);
    }
}

async function saveTicketState() {
    try {
        const payload = {
            openTickets: Object.fromEntries(ticketData.entries()),
            userLastTicketOpen: Object.fromEntries(userLastTicketOpen.entries()),
        };
        await fs.writeFile(TICKET_STATE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
        console.error('Ticket state save error:', err);
    }
}

async function pruneMissingTicketChannels() {
    let mutated = false;
    for (const channelId of ticketData.keys()) {
        if (!client.guilds.cache.some(g => g.channels.cache.has(channelId))) {
            ticketData.delete(channelId);
            mutated = true;
        }
    }
    if (mutated) await saveTicketState();
}

async function saveTranscript(channel) {
    try {
        const allMessages = [];
        let before;

        while (true) {
            const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => new Map());
            if (batch.size === 0) break;
            allMessages.push(...batch.values());
            before = batch.last()?.id;
        }

        const sorted = allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        const limited = sorted.slice(-5000);

        const lines = limited.map(m => {
            const time = m.createdAt.toISOString().slice(0, 19).replace('T', ' ');
            const author = `${m.author.tag} (${m.author.id})`;
            let line = `[${time}] ${author}: ${m.content || '[No text]'}`;
            if (m.embeds.length) line += ` | Embeds: ${m.embeds.map(e => e.type || 'rich').join(', ')}`;
            if (m.attachments.size) line += ` | Attachments: ${[...m.attachments.values()].map(a => a.url).join(', ')}`;
            return line;
        });

        const safeName = channel.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        const filename = `transcript-${safeName}-${Date.now()}.txt`;
        const filepath = path.join(__dirname, 'transcripts', filename);

        await fs.mkdir(path.join(__dirname, 'transcripts'), { recursive: true });
        await fs.writeFile(filepath, lines.join('\n') + '\n', 'utf-8');

        return { filename, filepath };
    } catch (err) {
        console.error('Transcript error:', err);
        return null;
    }
}

async function logTicketClose(interaction, data, transcriptInfo, closeReason = 'No reason provided') {
    if (!config.logChannel) return;
    const logChannel = interaction.guild.channels.cache.get(config.logChannel);
    if (!logChannel) return;

    const opener = await interaction.guild.members.fetch(data.openerId).catch(() => null);
    const claimedBy = data.claimedBy ? `<@${data.claimedBy}>` : 'Not claimed';
    const closer = interaction.user;

    const embed = new EmbedBuilder()
        .setTitle(`Ticket Closed: ${interaction.channel.name}`)
        .setColor(0xff5555)
        .addFields(
            { name: 'Opener', value: opener ? `${opener.user.tag} (${opener.id})` : data.openerId, inline: true },
            { name: 'Claimed by', value: claimedBy, inline: true },
            { name: 'Closed by', value: `${closer.tag} (${closer.id})`, inline: true },
            { name: 'Reason', value: closeReason, inline: false },
            { name: 'Department', value: data.department || '—', inline: true },
            { name: 'Created', value: `<t:${Math.floor(data.startTime / 1000)}:f>`, inline: true },
        )
        .setTimestamp();

    const files = transcriptInfo ? [{ attachment: transcriptInfo.filepath, name: transcriptInfo.filename }] : [];

    await logChannel.send({ embeds: [embed], files }).catch(console.error);
}

// ─── Interaction Handler ──────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    // Restrict ONLY slash commands to Foundership
    if (interaction.isChatInputCommand()) {
        if (!interaction.member.roles.cache.has(FOUNDERSHIP_ROLE_ID)) {
            return interaction.reply({
                content: "🚫 This bot is restricted to Foundership members only.",
                ephemeral: true
            });
        }
    }

    try {
        // ── Slash Commands (Foundership only) ──────────────────────────────

        if (interaction.isChatInputCommand()) {
            // /dashboard
            if (interaction.commandName === 'dashboard') {
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
                        { label: 'Staff Applications', value: 'staff_apps', description: 'Join the ASRP team', emoji: '📝' },
                        { label: 'In-Game Rules', value: 'ig_rules', description: 'ER:LC Penal Code', emoji: '🎮' },
                        { label: 'Discord Rules', value: 'dc_rules', description: 'Community Guidelines', emoji: '📜' },
                        { label: 'Vehicle Livery Dashboard', value: 'vehicle_livery', description: 'View current ASRP fleet status', emoji: '🚓' },
                    ]);

                const menuRow = new ActionRowBuilder().addComponents(menu);

                await interaction.channel.send({ embeds: [embed], components: [menuRow] });

                return interaction.reply({ content: "✅ Dashboard deployed.", ephemeral: true });
            }

            // /deptdashboard
            if (interaction.commandName === 'deptdashboard') {
                const dashboardEmbed = new EmbedBuilder()
                    .setTitle('🏔️ Alaska State Roleplay')
                    .setDescription(
                        '━━━━━━━━━━━━━━━━━━\n**Departments Dashboard**\n━━━━━━━━━━━━━━━━━━\n\n' +
                        'Select a department from the dropdown to get your invite and instructions.\n\n' +
                        '🚨 Professionalism is required\n📋 Follow all server rules\n⚠️ Abuse of roles will result in removal'
                    )
                    .setColor(5793266)
                    .addFields(
                        { name: '🚓 Alaska State Troopers', value: '🟢 **OPEN**\nStatewide law enforcement. Handles highways, rural patrol, and major incidents.', inline: false },
                        { name: '🚧 Alaska Department of Transportation', value: '🟢 **OPEN**\nHandles traffic control, road work, and scene support.', inline: false },
                        { name: '🚔 Alaska Police Department', value: '🔴 **CLOSED**\nCurrently in development.', inline: false },
                        { name: '🚒 Alaska Fire Department', value: '🔴 **CLOSED**\nCurrently in development.', inline: false },
                        { name: '🕵️‍♂️ FBI', value: '🟢 **OPEN**\nFederal investigations, special operations, high-priority cases.', inline: false }
                    )
                    .setFooter({ text: 'Alaska State Roleplay • Departments System' })
                    .setTimestamp();

                const departmentDropdown = new StringSelectMenuBuilder()
                    .setCustomId('select_department')
                    .setPlaceholder('Select a department...')
                    .addOptions(
                        { label: 'Alaska State Troopers', value: 'ast', description: 'Join AST server', emoji: '🚓' },
                        { label: 'Alaska Department of Transportation', value: 'dot', description: 'Join DOT server', emoji: '🚧' },
                        { label: 'Alaska Police Department', value: 'apd', description: 'Currently in development', emoji: '🚔', disabled: true },
                        { label: 'Alaska Fire Department', value: 'afd', description: 'Currently in development', emoji: '🚒', disabled: true },
                        { label: 'FBI', value: 'fbi', description: 'Join FBI server', emoji: '🕵️‍♂️' }
                    );

                const dashboardRow = new ActionRowBuilder().addComponents(departmentDropdown);

                await interaction.channel.send({ embeds: [dashboardEmbed], components: [dashboardRow] });

                return interaction.reply({ content: "✅ Departments dashboard deployed.", ephemeral: true });
            }

            // /ticketstats
            if (interaction.commandName === 'ticketstats') {
                const openTickets = Array.from(ticketData.values());
                const total = openTickets.length;
                const claimed = openTickets.filter(t => t.claimedBy).length;
                const unclaimed = total - claimed;

                const byPriority = openTickets.reduce((acc, t) => {
                    const p = t.priority ? t.priority.toUpperCase() : 'UNKNOWN';
                    acc[p] = (acc[p] || 0) + 1;
                    return acc;
                }, {});

                const priorityFields = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']
                    .filter(p => byPriority[p] > 0)
                    .map(p => ({
                        name: `${PRIORITY_EMOJIS[p.toLowerCase()] || '❓'} ${p}`,
                        value: `**${byPriority[p]}**`,
                        inline: true
                    }));

                const embed = new EmbedBuilder()
                    .setColor(0x1E90FF)
                    .setTitle('Alaska State Roleplay • Ticket Overview')
                    .setDescription('Current support ticket system status')
                    .setThumbnail(DASHBOARD_ICON)
                    .addFields(
                        { name: 'Total Open', value: `**${total}**`, inline: true },
                        { name: 'Claimed', value: `**${claimed}**`, inline: true },
                        { name: 'Unclaimed', value: `**${unclaimed}**`, inline: true },
                        ...priorityFields
                    )
                    .setFooter({ text: `Updated ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST` })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // /ticketclose
            if (interaction.commandName === 'ticketclose') {
                const ticketId = interaction.options.getString('ticket_id', true);
                const data = ticketData.get(ticketId);

                if (!data || !interaction.guild.channels.cache.has(ticketId)) {
                    return interaction.reply({ content: "Invalid or closed ticket.", ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`close_by_id_${ticketId}`)
                    .setTitle('Close Ticket - Reason Required');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('reason')
                            .setLabel('Reason')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );

                await interaction.showModal(modal);
                return;
            }

            // /ticketpriority
            if (interaction.commandName === 'ticketpriority') {
                const ticketId = interaction.options.getString('ticket_id', true);
                const priority = interaction.options.getString('priority', true).toLowerCase();

                if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
                    return interaction.reply({ content: "Invalid priority. Use: low, medium, high, urgent", ephemeral: true });
                }

                const data = ticketData.get(ticketId);
                if (!data) return interaction.reply({ content: "Ticket not found.", ephemeral: true });

                const channel = interaction.guild.channels.cache.get(ticketId);
                if (!channel) return interaction.reply({ content: "Channel not found.", ephemeral: true });

                const isClaimer = data.claimedBy && data.claimedBy === interaction.user.id;
                if (!isClaimer && !isFoundership(interaction.member)) {
                    return interaction.reply({ content: "Only claimer or Foundership can change priority.", ephemeral: true });
                }

                data.priority = priority;
                ticketData.set(ticketId, data);
                await saveTicketState();

                // Update channel name if possible
                const nameParts = channel.name.split('-');
                const newName = `${nameParts[0]}-${priority}-${nameParts.slice(-1)}`.slice(0, 100);
                await channel.setName(newName).catch(() => {});

                // Send confirmation
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor(PRIORITY_COLORS[priority])
                        .setDescription(`**Priority changed to ${priority.toUpperCase()}** ${PRIORITY_EMOJIS[priority]} by ${interaction.user}`)]
                });

                return interaction.reply({ content: `Priority updated to **${priority.toUpperCase()}**`, ephemeral: true });
            }

            // /setup
            if (interaction.commandName === 'setup') {
                const logs = interaction.options.getChannel('logs');
                const staff = interaction.options.getRole('staff');
                const ia = interaction.options.getRole('ia_role');
                const mgmt = interaction.options.getRole('management_role');

                if (logs) config.logChannel = logs.id;
                if (staff) config.staffRole = staff.id;
                if (ia) config.iaRole = ia.id;
                if (mgmt) config.mgmtRole = mgmt.id;

                await saveConfig();

                const setupEmbed = new EmbedBuilder()
                    .setColor(BOT_COLOR)
                    .setTitle('Setup Updated')
                    .addFields(
                        { name: 'Logs Channel', value: formatSetupValue(config.logChannel, 'channel'), inline: true },
                        { name: 'Staff Role', value: formatSetupValue(config.staffRole, 'role'), inline: true },
                        { name: 'IA Role', value: formatSetupValue(config.iaRole, 'role'), inline: true },
                        { name: 'Management Role', value: formatSetupValue(config.mgmtRole, 'role'), inline: true },
                    )
                    .setFooter({ text: `Ticket cooldown: ${Math.round(TICKET_COOLDOWN_MS / 1000)}s` });

                return interaction.reply({ embeds: [setupEmbed], ephemeral: true });
            }

            // /ticketpersonadd
            if (interaction.commandName === 'ticketpersonadd') {
                const user = interaction.options.getUser('user', true);
                const channel = interaction.channel;
                const data = ticketData.get(channel.id);

                if (!data) return interaction.reply({ content: "Not a ticket channel.", ephemeral: true });

                const isClaimer = data.claimedBy === interaction.user.id;
                if (!isClaimer && !isFoundership(interaction.member)) {
                    return interaction.reply({ content: "Only claimer or Foundership can add users.", ephemeral: true });
                }

                await channel.permissionOverwrites.edit(user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                return interaction.reply({ content: `Added ${user} to ticket.`, ephemeral: true });
            }

            // /ticketpersonremove
            if (interaction.commandName === 'ticketpersonremove') {
                const user = interaction.options.getUser('user', true);
                const channel = interaction.channel;
                const data = ticketData.get(channel.id);

                if (!data) return interaction.reply({ content: "Not a ticket channel.", ephemeral: true });

                const isClaimer = data.claimedBy === interaction.user.id;
                if (!isClaimer && !isFoundership(interaction.member)) {
                    return interaction.reply({ content: "Only claimer or Foundership can remove users.", ephemeral: true });
                }

                await channel.permissionOverwrites.delete(user.id);
                return interaction.reply({ content: `Removed ${user} from ticket.`, ephemeral: true });
            }
        }

        // ── Public Interactions ─────────────────────────────────────────────

        // Dashboard dropdown (everyone)
        if (interaction.isStringSelectMenu() && interaction.customId === 'asrp_dashboard') {
            const responses = {
                staff_apps: {
                    title: "📝 Staff Applications",
                    desc: "**Staff Team Applications**\n\n" +
                          "**🟢 Status: OPENED 🟢**\n\n" +
                          "We are currently accepting applications for:\n" +
                          "• Staff Team (Moderators, Helpers, Administrators)\n\n" +
                          "All applications are reviewed by management. Make sure you meet the requirements listed in #「🌸」·applications before applying.\n\n" +
                          "🔗 **Apply here:** https://your-application-link.com" // ← replace with real link
                },
                ig_rules: {
                    title: "🎮 In-Game Rules (ER:LC RP Standards)",
                    desc: "**Alaska State RolePlay • In-Game Rules**\n\n" +
                          "These rules are in place to maintain serious, high-quality roleplay...\n\n" +
                          "1. Serious Roleplay Only\n • No trolling, meme RP...\n" +
                          // ... add the full text you had originally ...
                },
                dc_rules: {
                    title: "📜 Discord Server Rules",
                    desc: "**Alaska State RolePlay • Discord Rules**\n\n" +
                          "Breaking any rule may result in warnings...\n\n" +
                          "1. Respect & No Toxicity\n • No harassment...\n" +
                          // ... full text ...
                },
                vehicle_livery: {
                    title: "ASRP | Vehicle Livery Dashboard",
                    desc: "All vehicles are currently **active** and deployed."
                }
            };

            const res = responses[interaction.values[0]];
            if (!res) return interaction.reply({ content: "Invalid option.", ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle(res.title)
                .setDescription(res.desc)
                .setColor(BOT_COLOR)
                .setThumbnail(DASHBOARD_ICON)
                .setFooter({ text: "Alaska State RolePlay • Follow the rules!" });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Departments dropdown (everyone)
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_department') {
            const value = interaction.values[0];

            let replyText = 'Unknown department selected.';

            switch (value) {
                case 'ast':
                    replyText = '✅ **Alaska State Troopers** is **OPEN**!\nJoin here: https://discord.gg/WhP5Xk85Yw';
                    break;
                case 'dot':
                    replyText = '✅ **Alaska Department of Transportation** is **OPEN**!\nJoin here: https://discord.gg/JCPDApbKmH';
                    break;
                case 'apd':
                    replyText = '🔴 **Alaska Police Department** is currently **CLOSED** / in development.';
                    break;
                case 'afd':
                    replyText = '🔴 **Alaska Fire Department** is currently **CLOSED** / in development.';
                    break;
                case 'fbi':
                    replyText = '✅ **FBI** is **OPEN**!\nJoin here: https://discord.gg/fQC227yJZT';
                    break;
            }

            return interaction.reply({ content: replyText, ephemeral: true });
        }

        // Ticket creation flow - department selection
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type') {
            await interaction.deferReply({ ephemeral: true });

            const dept = interaction.values[0];
            const pingRoleId = getPingRole(dept);
            if (!pingRoleId) return interaction.editReply({ content: "Department role not set.", ephemeral: true });

            const existing = findExistingTicket(interaction.guild, interaction.user.id);
            if (existing) return interaction.editReply({ content: `You already have a ticket: <#${existing}>`, ephemeral: true });

            const lastOpen = userLastTicketOpen.get(interaction.user.id) || 0;
            const cooldownLeft = TICKET_COOLDOWN_MS - (Date.now() - lastOpen);
            if (cooldownLeft > 0) {
                return interaction.editReply({ content: `⏳ Wait ${Math.ceil(cooldownLeft / 1000)}s.`, ephemeral: true });
            }

            const priorityMenu = new StringSelectMenuBuilder()
                .setCustomId(`ticket_priority_${dept}`)
                .setPlaceholder('Select ticket priority...')
                .addOptions([
                    { label: 'Low', value: 'low', emoji: '🟢', description: 'General inquiry' },
                    { label: 'Medium', value: 'medium', emoji: '🟡', description: 'Standard request' },
                    { label: 'High', value: 'high', emoji: '🟠', description: 'Time-sensitive' },
                    { label: 'Urgent', value: 'urgent', emoji: '🔴', description: 'Critical / emergency' },
                ]);

            await interaction.editReply({
                content: `Ticket for **${dept.toUpperCase()}** – select priority:`,
                components: [new ActionRowBuilder().addComponents(priorityMenu)],
                ephemeral: true
            });
        }

        // Ticket creation - priority selection
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_priority_')) {
            await interaction.deferUpdate();

            const dept = interaction.customId.split('_')[2];
            const priority = interaction.values[0];
            const pingRoleId = getPingRole(dept);

            await interaction.member.roles.add(TICKET_ROLE_ID).catch(() => {});

            const safeUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || interaction.user.id;

            let channel;
            try {
                const overwrites = [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: pingRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: FOUNDERSHIP_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
                ];

                BLOCKED_ROLE_IDS.forEach(roleId => {
                    overwrites.push({ id: roleId, deny: [PermissionsBitField.Flags.ViewChannel] });
                });

                channel = await interaction.guild.channels.create({
                    name: `ticket-${dept}-${priority}-${safeUsername}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: overwrites,
                });
            } catch (err) {
                console.error('Channel creation failed:', err);
                return interaction.editReply({ content: "Failed to create ticket channel.", ephemeral: true });
            }

            ticketData.set(channel.id, {
                openerId: interaction.user.id,
                startTime: Date.now(),
                claimedBy: null,
                department: dept,
                priority: priority
            });

            userLastTicketOpen.set(interaction.user.id, Date.now());
            await saveTicketState();

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger),
            );

            await channel.send({
                content: `${interaction.user} | <@&${pingRoleId}>`,
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`${PRIORITY_EMOJIS[priority] || '❓'} ${dept.toUpperCase()} Ticket – Priority: ${priority.toUpperCase()}`)
                        .setColor(PRIORITY_COLORS[priority] || BOT_COLOR)
                        .setImage(SUPPORT_BANNER)
                        .setDescription(
                            `**Priority:** ${PRIORITY_EMOJIS[priority] || ''} **${priority.toUpperCase()}**\n\n` +
                            "Please describe your issue clearly. A staff member will assist you soon.\n" +
                            "Higher priority tickets are handled first."
                        )
                ],
                components: [buttons],
            });

            await interaction.editReply({ content: `✅ Ticket created → ${channel} (Priority: ${priority.toUpperCase()})`, ephemeral: true });
        }

        // Ticket buttons - Claim
        if (interaction.isButton() && interaction.customId === 'claim_ticket') {
            const channel = interaction.channel;
            const data = ticketData.get(channel.id);
            if (!data) return interaction.reply({ content: "Ticket no longer exists.", ephemeral: true });

            if (data.claimedBy) {
                return interaction.reply({ content: `Already claimed by <@${data.claimedBy}>.`, ephemeral: true });
            }

            data.claimedBy = interaction.user.id;
            ticketData.set(channel.id, data);
            await saveTicketState();

            await channel.permissionOverwrites.edit(interaction.user.id, {
                SendMessages: true,
                ViewChannel: true,
                ReadMessageHistory: true
            });

            await interaction.message.edit({
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
                )]
            });

            await channel.send({ content: `✅ Ticket claimed by ${interaction.user}` });
            return interaction.deferUpdate();
        }

        // Ticket buttons - Close
        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            const channel = interaction.channel;
            const data = ticketData.get(channel.id);
            if (!data) return interaction.reply({ content: "Ticket no longer exists.", ephemeral: true });

            const isClaimer = data.claimedBy === interaction.user.id;
            if (!isClaimer && !isFoundership(interaction.member)) {
                return interaction.reply({ content: "Only the claimer or Foundership can close this ticket.", ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('close_ticket_modal')
                .setTitle('Close Ticket - Reason Required');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel('Why are you closing this ticket?')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );

            await interaction.showModal(modal);
            return;
        }

        // Close modal handler
        if (interaction.isModalSubmit() && interaction.customId === 'close_ticket_modal') {
            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.channel;
            const data = ticketData.get(channel.id);
            if (!data) return interaction.editReply({ content: "Ticket no longer exists.", ephemeral: true });

            const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';

            await channel.send({ content: `Ticket closing - Reason: ${reason}` });

            // Clean up
            ticketData.delete(channel.id);
            await saveTicketState();
            await channel.delete().catch(console.error);

            return interaction.editReply({ content: "Ticket closed.", ephemeral: true });
        }

        // Close by ID modal
        if (interaction.isModalSubmit() && interaction.customId.startsWith('close_by_id_')) {
            const ticketId = interaction.customId.replace('close_by_id_', '');
            const data = ticketData.get(ticketId);

            if (!data) return interaction.reply({ content: "Ticket not found.", ephemeral: true });

            const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
            const channel = interaction.guild.channels.cache.get(ticketId);

            if (channel) {
                await channel.send({ content: `Ticket closed by ${interaction.user} (admin) - Reason: ${reason}` });
                await channel.delete().catch(console.error);
            }

            ticketData.delete(ticketId);
            await saveTicketState();

            return interaction.reply({ content: "Ticket closed successfully.", ephemeral: true });
        }

    } catch (err) {
        console.error('Interaction error:', err);
        if (!interaction.replied && !interaction.deferred) {
            interaction.reply({ content: "An error occurred.", ephemeral: true }).catch(() => {});
        }
    }
});

// ─── Ready Event ──────────────────────────────────────────
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    const commands = [
        new SlashCommandBuilder().setName('dashboard').setDescription('Deploy main dashboard'),
        new SlashCommandBuilder().setName('deptdashboard').setDescription('Deploy departments dashboard'),
        new SlashCommandBuilder().setName('ticketstats').setDescription('View ticket statistics'),
        new SlashCommandBuilder()
            .setName('ticketclose')
            .setDescription('Close any ticket by ID (Foundership only)')
            .addStringOption(o => o.setName('ticket_id').setDescription('Ticket channel ID').setRequired(true)),
        new SlashCommandBuilder()
            .setName('ticketpriority')
            .setDescription('Change ticket priority')
            .addStringOption(o => o.setName('ticket_id').setDescription('Ticket ID').setRequired(true))
            .addStringOption(o => o.setName('priority').setDescription('New priority').setRequired(true)
                .addChoices(
                    { name: 'Low', value: 'low' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'High', value: 'high' },
                    { name: 'Urgent', value: 'urgent' }
                )),
        new SlashCommandBuilder()
            .setName('ticketpersonadd')
            .setDescription('Add user to current ticket')
            .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)),
        new SlashCommandBuilder()
            .setName('ticketpersonremove')
            .setDescription('Remove user from current ticket')
            .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)),
        new SlashCommandBuilder().setName('setup').setDescription('Configure bot settings'),
    ];

    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            { body: commands }
        );
        console.log(`Slash commands registered successfully to guild ${GUILD_ID}`);
    } catch (err) {
        console.error('Failed to register commands:', err);
    }
});

client.login(TOKEN);
app.listen(PORT, () => console.log(`Health check running on port ${PORT}`));
