require('dotenv').config();
const fs = require('fs');
const express = require('express');
const {
    Client,
    GatewayIntentBits,
    Partials,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    REST,
    Routes,
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

// ─── Load config from file (exported from website) ───────────────
let config = {
    departments: {},
    main_content: {},
    appearance: {},
    menu: { staff_apps: true, ig_rules: true, dc_rules: true }
};

try {
    const raw = fs.readFileSync('./config.json', 'utf-8');
    const loaded = JSON.parse(raw);
    config = {
        ...config,
        ...loaded,
        departments: loaded.departments || config.departments,
        main_content: loaded.main_content || config.main_content,
        appearance: loaded.appearance || config.appearance,
        menu: loaded.menu || config.menu
    };
    console.log('Loaded configuration from config.json');
} catch (err) {
    console.log('No valid config.json found → using fallback defaults');
}

// ─── Constants & Fallbacks ───────────────────────────────────────
const FOUNDERSHIP_ROLE_ID = '1472278188469125355';
const BOT_COLOR_FALLBACK = 0x2b6cb0;
const DASHBOARD_ICON_FALLBACK = "https://image2url.com/r2/default/images/1771563774401-5dd69719-a2a9-42d7-a76e-c9028c62fe2f.jpg";

const MAIN_DASHBOARD_TITLE = "Dashboard";
const DEPT_DASHBOARD_TITLE = "🏔️ Alaska State Roleplay";

const app = express();
app.get('/', (_, res) => res.status(200).send('ASRP bot is running'));
app.get('/health', (_, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        ready: client.isReady(),
    });
});

function isFoundership(member) {
    return member.roles.cache.has(FOUNDERSHIP_ROLE_ID);
}

// ─── Helper: Clean old dashboards ───────────────────────────────
async function cleanOldDashboards(channel, type) {
    try {
        const messages = await channel.messages.fetch({ limit: 50 });
        const toDelete = [];

        for (const msg of messages.values()) {
            if (msg.author.id !== client.user.id) continue;
            const embed = msg.embeds[0];
            if (!embed) continue;

            if (type === 'main' && embed.title === MAIN_DASHBOARD_TITLE) {
                toDelete.push(msg);
            } else if (type === 'departments' && embed.title === DEPT_DASHBOARD_TITLE) {
                toDelete.push(msg);
            }
        }

        if (toDelete.length > 0) {
            await channel.bulkDelete(toDelete, true).catch(() => {});
            return toDelete.length;
        }
        return 0;
    } catch (err) {
        console.error('Error cleaning old dashboards:', err);
        return 0;
    }
}

// ─── Send Main Dashboard ─────────────────────────────────────────
async function sendMainDashboard(channel) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: "ALASKA STATE ROLEPLAY • OFFICIAL DIRECTORY", iconURL: config.appearance?.dashboard_icon || DASHBOARD_ICON_FALLBACK })
        .setTitle(MAIN_DASHBOARD_TITLE)
        .setDescription(config.main_content?.welcome || "**Welcome to Alaska State RolePlay!**\n\nWelcome to the best ER:LC roleplay community...")
        .setColor(config.appearance?.embed_color || BOT_COLOR_FALLBACK)
        .setImage(config.appearance?.dashboard_icon || DASHBOARD_ICON_FALLBACK)
        .setTimestamp();

    const options = [];
    if (config.menu?.staff_apps !== false) {
        options.push({ label: 'Staff Applications', value: 'staff_apps', description: 'Join the ASRP team', emoji: '📝' });
    }
    if (config.menu?.ig_rules !== false) {
        options.push({ label: 'In-Game Rules', value: 'ig_rules', description: 'ER:LC Penal Code', emoji: '🎮' });
    }
    if (config.menu?.dc_rules !== false) {
        options.push({ label: 'Discord Rules', value: 'dc_rules', description: 'Community Guidelines', emoji: '📜' });
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId('asrp_dashboard')
        .setPlaceholder('Select an option...')
        .addOptions(options.length > 0 ? options : [{ label: 'No options available', value: 'none', disabled: true }]);

    const menuRow = new ActionRowBuilder().addComponents(menu);
    await channel.send({ embeds: [embed], components: [menuRow] });
}

// ─── Send Departments Dashboard ──────────────────────────────────
async function sendDepartmentsDashboard(channel) {
    const fields = [];
    const dropdownOptions = [];

    const depts = config.departments || {};

    for (const [key, dept] of Object.entries(depts)) {
        if (!dept || !dept.name) continue;

        fields.push({
            name: `${dept.emoji || '❔'} ${dept.name}`,
            value: dept.status === 'open'
                ? `🟢 **OPEN**\n${dept.description || 'No description'}`
                : `🔴 **CLOSED**\n${dept.description || 'Currently in development.'}`,
            inline: false
        });

        dropdownOptions.push({
            label: dept.name,
            value: key,
            description: dept.status === 'open' ? 'Join server' : 'In development',
            emoji: dept.emoji || '❔',
            disabled: dept.status !== 'open'
        });
    }

    const dashboardEmbed = new EmbedBuilder()
        .setTitle(DEPT_DASHBOARD_TITLE)
        .setDescription(
            '━━━━━━━━━━━━━━━━━━\n**Departments Dashboard**\n━━━━━━━━━━━━━━━━━━\n\n' +
            'Select a department from the dropdown to get your invite and instructions.\n\n' +
            '🚨 Professionalism is required\n📋 Follow all server rules\n⚠️ Abuse of roles will result in removal'
        )
        .setColor(config.appearance?.embed_color || 5793266)
        .addFields(fields.length > 0 ? fields : [{ name: 'No departments configured', value: 'Add departments in config.json' }])
        .setFooter({ text: 'Alaska State Roleplay • Departments System' })
        .setTimestamp();

    const departmentDropdown = new StringSelectMenuBuilder()
        .setCustomId('select_department')
        .setPlaceholder('Select a department...')
        .addOptions(dropdownOptions.length > 0 ? dropdownOptions : [{ label: 'No departments available', value: 'none', disabled: true }]);

    const dashboardRow = new ActionRowBuilder().addComponents(departmentDropdown);
    await channel.send({ embeds: [dashboardEmbed], components: [dashboardRow] });
}

// ─── Interaction Handler ─────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

    if (interaction.isChatInputCommand()) {
        if (!isFoundership(interaction.member)) {
            return interaction.reply({ content: "🚫 Restricted to Foundership only.", ephemeral: true });
        }
    }

    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'dashboard') {
                await sendMainDashboard(interaction.channel);
                return interaction.reply({ content: "✅ Main dashboard deployed.", ephemeral: true });
            }

            if (interaction.commandName === 'deptdashboard') {
                await sendDepartmentsDashboard(interaction.channel);
                return interaction.reply({ content: "✅ Departments dashboard deployed.", ephemeral: true });
            }

            if (interaction.commandName === 'refresh') {
                const select = new StringSelectMenuBuilder()
                    .setCustomId('refresh_select')
                    .setPlaceholder('Which dashboard to refresh?')
                    .addOptions([
                        { label: 'Main Dashboard', value: 'main', emoji: '📊' },
                        { label: 'Departments Dashboard', value: 'departments', emoji: '🏢' },
                    ]);

                const row = new ActionRowBuilder().addComponents(select);

                await interaction.reply({
                    content: "Select dashboard to refresh (old versions will be deleted):",
                    components: [row],
                    ephemeral: true
                });
                return;
            }
        }

        if (interaction.isStringSelectMenu()) {
            // Refresh selection
            if (interaction.customId === 'refresh_select') {
                await interaction.deferUpdate();
                const choice = interaction.values[0];

                let deleted = 0;
                if (choice === 'main') {
                    deleted = await cleanOldDashboards(interaction.channel, 'main');
                    await sendMainDashboard(interaction.channel);
                } else if (choice === 'departments') {
                    deleted = await cleanOldDashboards(interaction.channel, 'departments');
                    await sendDepartmentsDashboard(interaction.channel);
                }

                const msg = deleted > 0
                    ? `✅ Refreshed! Deleted **${deleted}** old message(s).`
                    : "✅ Refreshed! (No old messages found)";

                await interaction.editReply({ content: msg, components: [] });
                return;
            }

            // Main dashboard dropdown
            if (interaction.customId === 'asrp_dashboard') {
                const responses = {
                    staff_apps: {
                        title: "📝 Staff Applications",
                        desc: config.main_content?.staff_apps || "**Staff Team Applications**\n\n**🟢 Status: OPENED 🟢** ..."
                    },
                    ig_rules: {
                        title: "🎮 In-Game Rules (ER:LC RP Standards)",
                        desc: config.main_content?.ig_rules || "**Alaska State RolePlay • In-Game Rules**\n\n..."
                    },
                    dc_rules: {
                        title: "📜 Discord Server Rules",
                        desc: config.main_content?.dc_rules || "**Alaska State RolePlay • Discord Rules**\n\n..."
                    }
                };

                const res = responses[interaction.values[0]];
                if (!res) return interaction.reply({ content: "Invalid option.", ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle(res.title)
                    .setDescription(res.desc)
                    .setColor(config.appearance?.embed_color || BOT_COLOR_FALLBACK)
                    .setThumbnail(config.appearance?.dashboard_icon || DASHBOARD_ICON_FALLBACK)
                    .setFooter({ text: "Alaska State RolePlay • Follow the rules!" });

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Departments selection
            if (interaction.customId === 'select_department') {
                const value = interaction.values[0];
                const dept = config.departments?.[value];

                let replyText = 'Unknown department.';
                if (dept) {
                    replyText = dept.status === 'open'
                        ? `✅ **${dept.name}** is **OPEN**!\nJoin here: ${dept.link || 'No link set'}`
                        : `🔴 **${dept.name}** is currently **CLOSED** / in development.`;
                }

                return interaction.reply({ content: replyText, ephemeral: true });
            }
        }
    } catch (err) {
        console.error('Interaction error:', err);
        if (!interaction.replied && !interaction.deferred) {
            interaction.reply({ content: "An error occurred.", ephemeral: true }).catch(() => {});
        }
    }
});

// ─── Ready – Refresh commands every startup ────────────────
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    const commands = [
        new SlashCommandBuilder().setName('dashboard').setDescription('Deploy the main community dashboard'),
        new SlashCommandBuilder().setName('deptdashboard').setDescription('Deploy the departments join dashboard'),
        new SlashCommandBuilder().setName('refresh').setDescription('Refresh a dashboard (cleans old versions)'),
    ];

    try {
        console.log('Refreshing guild commands...');
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, '1472277307002589216'),
            { body: commands }
        );
        console.log(`Reloaded ${commands.length} commands.`);
    } catch (error) {
        console.error('Command refresh failed:', error);
    }
});

client.login(process.env.TOKEN);
app.listen(Number(process.env.PORT) || 3000, () => {
    console.log(`Health check running on port ${process.env.PORT || 3000}`);
});
