require('dotenv').config();
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

// ─── Constants ────────────────────────────────────────────
const FOUNDERSHIP_ROLE_ID = '1472278188469125355';
const BOT_COLOR = 0x2b6cb0;
const DASHBOARD_ICON = "https://image2url.com/r2/default/images/1771563774401-5dd69719-a2a9-42d7-a76e-c9028c62fe2f.jpg";
const TOKEN = process.env.TOKEN;
const PORT = Number(process.env.PORT) || 3000;
const GUILD_ID = '1472277307002589216'; // ← your server ID

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

// ─── Interaction Handler ──────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

    // Restrict slash commands to Foundership only
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
        }

        // ── Public Interactions ─────────────────────────────────────────────
        if (interaction.isStringSelectMenu() && interaction.customId === 'asrp_dashboard') {
            const responses = {
                staff_apps: { /* ... same as before ... */ },
                ig_rules: { /* ... same as before ... */ },
                dc_rules: { /* ... same as before ... */ },
                vehicle_livery: { /* ... same as before ... */ }
            };

            const res = responses[interaction.values[0]];
            if (!res) return interaction.reply({ content: "Invalid option selected.", ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle(res.title)
                .setDescription(res.desc)
                .setColor(BOT_COLOR)
                .setThumbnail(DASHBOARD_ICON)
                .setFooter({ text: "Alaska State RolePlay • Follow the rules!" });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_department') {
            const value = interaction.values[0];
            let replyText = 'Unknown department selected.';
            switch (value) {
                case 'ast': replyText = '✅ **Alaska State Troopers** is **OPEN**!\nJoin here: https://discord.gg/WhP5Xk85Yw'; break;
                case 'dot': replyText = '✅ **Alaska Department of Transportation** is **OPEN**!\nJoin here: https://discord.gg/JCPDApbKmH'; break;
                case 'apd': replyText = '🔴 **Alaska Police Department** is currently **CLOSED** / in development.'; break;
                case 'afd': replyText = '🔴 **Alaska Fire Department** is currently **CLOSED** / in development.'; break;
                case 'fbi': replyText = '✅ **FBI** is **OPEN**!\nJoin here: https://discord.gg/fQC227yJZT'; break;
            }
            return interaction.reply({ content: replyText, ephemeral: true });
        }

    } catch (err) {
        console.error('Interaction error:', err);
        if (!interaction.replied && !interaction.deferred) {
            interaction.reply({ content: "An error occurred.", ephemeral: true }).catch(() => {});
        }
    }
});

// ─── Ready Event – Refresh commands every startup ────────────────
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    const commands = [
        new SlashCommandBuilder()
            .setName('dashboard')
            .setDescription('Deploy the main community dashboard'),

        new SlashCommandBuilder()
            .setName('deptdashboard')
            .setDescription('Deploy the departments join dashboard'),
    ];

    try {
        console.log('Started refreshing application (guild) commands...');

        // This line forces Discord to update / replace all existing guild commands
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            { body: commands }
        );

        console.log(`Successfully reloaded ${commands.length} guild command(s).`);
    } catch (error) {
        console.error('Error while refreshing commands:', error);
    }
});

client.login(TOKEN);
app.listen(PORT, () => console.log(`Health check server running on port ${PORT}`));
