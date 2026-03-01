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
const GUILD_ID = '1472277307002589216';

// Used to identify dashboard messages for deletion
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
            }
            else if (type === 'departments' && embed.title === DEPT_DASHBOARD_TITLE) {
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

// ─── Send functions ──────────────────────────────────────────────
async function sendMainDashboard(channel) {
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
        ]);

    const menuRow = new ActionRowBuilder().addComponents(menu);
    await channel.send({ embeds: [embed], components: [menuRow] });
}

async function sendDepartmentsDashboard(channel) {
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
            { name: '🚔 Fairbanks Police Department', value: '🔴 **CLOSED**\nCurrently in development.', inline: false },
            { name: '🚒 Fairbanks Fire Department', value: '🟢 **OPEN**\nEmergency medical response, fire suppression, and rescue operations.', inline: false },
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
            { label: 'Fairbanks Police Department', value: 'apd', description: 'Currently in development', emoji: '🚔', disabled: true },
            { label: 'Fairbanks Fire Department', value: 'afd', description: 'Join FFD server', emoji: '🚒' },
            { label: 'FBI', value: 'fbi', description: 'Join FBI server', emoji: '🕵️‍♂️' }
        );

    const dashboardRow = new ActionRowBuilder().addComponents(departmentDropdown);
    await channel.send({ embeds: [dashboardEmbed], components: [dashboardRow] });
}

// ─── Interaction Handler ────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

    if (interaction.isChatInputCommand()) {
        if (!isFoundership(interaction.member)) {
            return interaction.reply({
                content: "🚫 This bot is restricted to Foundership members only.",
                ephemeral: true
            });
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
                    content: "Select which dashboard you want to refresh (old one will be deleted if found):",
                    components: [row],
                    ephemeral: true
                });
                return;
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'refresh_select') {
                await interaction.deferUpdate();
                const choice = interaction.values[0];

                let deletedCount = 0;
                let sendFn;

                if (choice === 'main') {
                    deletedCount = await cleanOldDashboards(interaction.channel, 'main');
                    sendFn = sendMainDashboard;
                } else if (choice === 'departments') {
                    deletedCount = await cleanOldDashboards(interaction.channel, 'departments');
                    sendFn = sendDepartmentsDashboard;
                }

                await sendFn(interaction.channel);

                const msg = deletedCount > 0
                    ? `✅ Refreshed! Deleted **${deletedCount}** old dashboard message(s).`
                    : "✅ Refreshed! (No old dashboard messages found to delete)";

                await interaction.editReply({ content: msg, components: [] });
                return;
            }

            if (interaction.customId === 'asrp_dashboard') {
                const responses = {
                    staff_apps: {
                        title: "📝 Staff Applications",
                        desc: "**Staff Team Applications**\n\n" +
                              "**🟢 Status: OPENED 🟢**\n\n" +
                              "We are currently accepting applications for:\n" +
                              "• Staff Team (Moderators, Helpers, Administrators)\n\n" +
                              "All applications are reviewed by management. Make sure you meet the requirements listed in #「🌸」·applications before applying.\n\n" +
                              "🔗 **Apply here:** https://melonly.xyz/forms/7429303261795979264\n\n" +
                              "We look forward to potentially welcoming you to the team!"
                    },
                    ig_rules: {
                        title: "🎮 In-Game Rules (ER:LC RP Standards)",
                        desc: "**Alaska State RolePlay • In-Game Rules**\n\n" +
                              "These rules are in place to maintain serious, high-quality roleplay in Emergency Response: Liberty County.\n\n" +
                              "1. **Serious Roleplay Only**\n • No trolling, meme RP, fail RP, or unrealistic behavior.\n • All actions must be believable in a real-world emergency/civilian context.\n\n" +
                              "2. **Fear & New Life Rule (NLR)**\n • Value your life realistically — do not act fearless when weapons are drawn.\n • After death, you forget previous events for **15 minutes** and cannot return to the scene or seek revenge.\n\n" +
                              "3. **No RDM / VDM**\n • Random Deathmatch (killing without valid RP reason) = severe punishment.\n • Vehicle Deathmatch (running people over without RP) = same.\n\n" +
                              "4. **No Powergaming / Metagaming**\n • No forcing actions on others without consent.\n • No using out-of-character (OOC) information in-character.\n\n" +
                              "5. **No Exploits, Hacks, or Glitches**\n • Any form of cheating, bug abuse, or unfair advantage = permanent ban.\n\n" +
                              "6. **Realistic Interactions & Pursuits**\n • Proper use of radios, handcuffs, sirens, etc.\n • No cop baiting, excessive reckless driving without RP reason.\n • Criminals must commit crimes with buildup — no random mass chaos.\n\n" +
                              "7. **Department & Job Guidelines**\n • Follow chain of command and department protocols.\n • EMS must prioritize life-saving over arrests.\n • Police must have probable cause before searches/arrests.\n\n" +
                              "Violations → Warning → Kick → Temporary Ban → Permanent Ban (depending on severity).\nStaff decisions are final."
                    },
                    dc_rules: {
                        title: "📜 Discord Server Rules",
                        desc: "**Alaska State RolePlay • Discord Rules**\n\n" +
                              "Breaking any rule may result in warnings, mutes, kicks, or bans depending on severity.\n\n" +
                              "1. **Respect & No Toxicity**\n • No harassment, slurs, hate speech, bullying, or targeted attacks.\n • Zero tolerance for discrimination (race, gender, sexuality, religion, etc.).\n\n" +
                              "2. **No NSFW / Explicit Content**\n • No pornography, gore, suggestive images/text, or links.\n • Keep the server family-friendly (Roblox community).\n\n" +
                              "3. **No Spam / Flooding**\n • No excessive emojis, copypasta, caps spam, mention spam, or zalgo.\n • Use channels for their intended purpose.\n\n" +
                              "4. **No Advertising / Self-Promotion**\n • No unsolicited server invites, YouTube/TikTok/Instagram promo, or DM advertising.\n • Partnerships only through official management.\n\n" +
                              "5. **No Unnecessary Pings / Staff Abuse**\n • Do not ping @Staff, @here, @everyone without valid emergency.\n • False ticket opens or pings = punishment.\n\n" +
                              "6. **No Drama / Public Callouts**\n • Keep personal conflicts private — no public stirring or callouts.\n • Report issues to staff privately via tickets.\n\n" +
                              "7. **No Impersonation**\n • Do not pretend to be staff, fake ranks, or use misleading nicknames.\n\n" +
                              "8. **Follow Roblox & Discord ToS**\n • No ban evasion, doxxing, threats, illegal content, or sharing personal information.\n\n" +
                              "9. **English in Public Channels**\n • Main language is English — other languages allowed in appropriate or private channels.\n\n" +
                              "10. **Staff Instructions**\n • Follow directions from staff members.\n • Arguing with staff punishments may lead to further action.\n\n" +
                              "Use #appeals or open a ticket if you believe a punishment was unfair."
                    }
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

            if (interaction.customId === 'select_department') {
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
                        replyText = '🔴 **Fairbanks Police Department** is currently **CLOSED** / in development.';
                        break;
                    case 'afd':
                        replyText = '✅ **Fairbanks Fire Department** is **OPEN**!\nJoin here: https://discord.gg/98vSGcf4XF';
                        break;
                    case 'fbi':
                        replyText = '✅ **FBI** is **OPEN**!\nJoin here: https://discord.gg/fQC227yJZT';
                        break;
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

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    const commands = [
        new SlashCommandBuilder()
            .setName('dashboard')
            .setDescription('Deploy the main community dashboard'),

        new SlashCommandBuilder()
            .setName('deptdashboard')
            .setDescription('Deploy the departments join dashboard'),

        new SlashCommandBuilder()
            .setName('refresh')
            .setDescription('Refresh a dashboard (cleans old versions)'),
    ];

    try {
        console.log('Started refreshing application (guild) commands...');
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
