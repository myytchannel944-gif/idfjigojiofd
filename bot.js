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
const BOT_OWNER_ID = '1205738144323080214';
const FOUNDERSHIP_ROLE_ID = '1472278188469125355';
const BOT_COLOR = 0x2b6cb0;
const DASHBOARD_ICON = "https://image2url.com/r2/default/images/1771563774401-5dd69719-a2a9-42d7-a76e-c9028c62fe2f.jpg";
const TOKEN = process.env.TOKEN;
const PORT = Number(process.env.PORT) || 3000;
const GUILD_ID = '1472277307002589216';

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
                },
                vehicle_livery: {
                    title: "ASRP | Vehicle Livery Status",
                    desc: "**Current Active Liveries – 2025 Deployment Overview**\n\n" +
                          "• **BKM Munich 2020**\n Assigned to: Ownership, FBI Police\n\n" +
                          "• **Bullhorn Prancer Pursuit 2011**\n Assigned to: State Trooper\n\n" +
                          "• **Falcon Interceptor Sedan 2017**\n Assigned to: FBI, Secret Service\n\n" +
                          "• **Stuttgart Runner Prisoner Transport 2020**\n Assigned to: FBI\n\n" +
                          "• **SWAT Armored Truck 2011**\n Assigned to: FBI, HSI (Department of Homeland Security), SWAT Team\n\n" +
                          "**Status:** All listed vehicles are **currently active and deployed**.\n" +
                          "Liveries may be updated or expanded as departments grow."
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

        // Departments dropdown
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
