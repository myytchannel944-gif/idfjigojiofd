require('dotenv').config();
const fs = require('fs');
const { 
    Client, GatewayIntentBits, Partials, SlashCommandBuilder,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, PermissionsBitField, REST, Routes, ActivityType, 
    StringSelectMenuBuilder 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message]
});

// ─── Constants ──────────────────────────────────────────────────
const BOT_COLOR = 2851052; // ASRP Blue
const SUPPORT_BANNER = "https://image2url.com/r2/default/images/1771467061096-fc09db59-fd9e-461f-ba30-c8b1ee42ff1f.jpg";
const DASHBOARD_ICON = "https://image2url.com/r2/default/images/1771563774401-5dd69719-a2a9-42d7-a76e-c9028c62fe2f.jpg";
const TICKET_ROLE_ID = "1474234032677060795"; 
const CONFIG_PATH = './config.json';

let config = (() => {
    try { return fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) : {}; }
    catch { return {}; }
})();

const saveConfig = () => fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
const ticketData = new Map();

// ─── Interaction Handler ─────────────────────────────────────────
client.on('interactionCreate', async (int) => {
    if (!int.guild || int.user.bot) return;

    try {
        // 1. DASHBOARD DEPLOY COMMAND
        if (int.isChatInputCommand() && int.commandName === 'dashboard') {
            if (!int.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return int.reply({ content: "🚫 Admin only.", ephemeral: true });
            }

            const dashboardEmbed = new EmbedBuilder()
                .setTitle("Dashboard")
                .setAuthor({ name: "Alaska State Roleplay", iconURL: DASHBOARD_ICON })
                .setDescription(
                    "**Welcome to Alaska State RolePlay!**\n\n" +
                    "Welcome to the best ER:LC roleplay community. Here you will find all of the information needed to get started.\n\n" +
                    "**In-Game Rules**\n" +
                    "┃ **Be Respectful**\nNo bullying, hate speech, or toxic behavior.\n" +
                    "┃ **Exploits or Hacks**\nUsing cheats or glitches is an instant ban.\n" +
                    "┃ **Serious RP Only**\nNo trolling or unrealistic scenarios.\n" +
                    "┃ **RDM/VDM**\nKilling or hitting players with cars without RP reason is prohibited."
                )
                .setColor(BOT_COLOR)
                .setImage(DASHBOARD_ICON)
                .setFooter({ text: `Last Updated: ${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString()}` });

            const menu = new StringSelectMenuBuilder().setCustomId('asrp_dashboard').setPlaceholder('Select an option...')
                .addOptions([
                    { label: 'Staff Applications', value: 'staff_apps', description: 'Join the team', emoji: '📝' },
                    { label: 'In-Game Rules', value: 'ig_rules', description: 'Server rules', emoji: '🎮' },
                    { label: 'Discord Rules', value: 'dc_rules', description: 'Community guidelines', emoji: '📜' }
                ]);

            await int.channel.send({ embeds: [dashboardEmbed], components: [new ActionRowBuilder().addComponents(menu)] });
            return int.reply({ content: "✅ Dashboard deployed.", ephemeral: true });
        }

        // 2. DASHBOARD HIDDEN RESPONSES
        if (int.isStringSelectMenu() && int.customId === 'asrp_dashboard') {
            const responses = {
                'staff_apps': "📝 **Staff Applications:** [Apply Here](https://your-link.com)\nMake sure you meet all requirements before applying!",
                'ig_rules': "🎮 **In-Game Rules:**\n1. No FRP.\n2. No Cop Baiting.\n3. FearRP must be followed.",
                'dc_rules': "📜 **Discord Rules:**\n1. Respect staff.\n2. No advertising.\n3. Follow Discord TOS."
            };
            return int.reply({ content: responses[int.values[0]], ephemeral: true });
        }

        // 3. TICKET CREATION
        if (int.isStringSelectMenu() && int.customId === 'ticket_type') {
            await int.deferReply({ ephemeral: true });
            if (!config.staffRole) return int.editReply("⚠️ Run `/setup` first.");

            const dept = int.values[0];
            let pingRole = config.staffRole; 
            if (dept === 'internal-affairs') pingRole = config.iaRole;
            if (dept === 'management') pingRole = config.mgmtRole;

            // Add Ticket Role
            await int.member.roles.add(TICKET_ROLE_ID).catch(() => console.log("Role hierarchy error."));

            const channel = await int.guild.channels.create({
                name: `${dept}-${int.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: int.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: int.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: pingRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            ticketData.set(channel.id, { openerId: int.user.id, startTime: Date.now(), claimedBy: null });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
            );
            
            await channel.send({
                content: `${int.user} | <@&${pingRole}>`,
                embeds: [new EmbedBuilder().setTitle(`🏛️ ${dept.toUpperCase()} Session`).setColor(BOT_COLOR).setImage(SUPPORT_BANNER)],
                components: [row]
            });

            return int.editReply(`✅ Created: ${channel}`);
        }

        // 4. CLAIM & CLOSE LOGIC
        if (int.isButton()) {
            if (int.customId === 'claim_ticket') {
                const data = ticketData.get(int.channel.id);
                if (data?.claimedBy) return int.reply({ content: "Already claimed.", ephemeral: true });
                data.claimedBy = int.user.id;
                await int.reply({ embeds: [new EmbedBuilder().setColor("#43b581").setDescription(`✅ Claimed by ${int.user}`)] });
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger));
                await int.message.edit({ components: [row] });
            }

            if (int.customId === 'close_ticket') {
                const data = ticketData.get(int.channel.id) || { openerId: int.user.id, startTime: Date.now() };
                await int.reply("📑 **Closing and logging...**");

                // Remove Role
                const member = await int.guild.members.fetch(data.openerId).catch(() => null);
                if (member) await member.roles.remove(TICKET_ROLE_ID).catch(() => {});

                // Logging
                const logCh = int.guild.channels.cache.get(config.logChannel);
                if (logCh) {
                    const duration = Math.floor((Date.now() - data.startTime) / 60000);
                    const logEmbed = new EmbedBuilder().setTitle("📁 Session Log").setColor("#ff4757")
                        .addFields(
                            { name: "Opener", value: `<@${data.openerId}>`, inline: true },
                            { name: "Closed By", value: `${int.user}`, inline: true },
                            { name: "Duration", value: `${duration}m`, inline: true }
                        );
                    await logCh.send({ embeds: [logEmbed] });
                }
                setTimeout(() => int.channel.delete().catch(() => {}), 5000);
            }
        }

        // 5. SETUP
        if (int.isChatInputCommand() && int.commandName === 'setup') {
            if (!int.member.permissions.has(PermissionsBitField.Flags.Administrator)) return int.reply({ content: "🚫 Admin only.", ephemeral: true });
            config = { logChannel: int.options.getChannel('logs').id, staffRole: int.options.getRole('staff').id, iaRole: int.options.getRole('ia_role').id, mgmtRole: int.options.getRole('management_role').id };
            saveConfig();
            const menu = new StringSelectMenuBuilder().setCustomId('ticket_type').setPlaceholder('Select Department...')
                .addOptions([
                    { label: 'General Support', value: 'general', emoji: '❓' },
                    { label: 'Internal Affairs', value: 'internal-affairs', emoji: '👮' },
                    { label: 'Management', value: 'management', emoji: '💎' }
                ]);
            await int.channel.send({ embeds: [new EmbedBuilder().setTitle('🏛️ Alaska Support').setColor(BOT_COLOR).setImage(SUPPORT_BANNER)], components: [new ActionRowBuilder().addComponents(menu)] });
            return int.reply({ content: "✅ Panel Deployed.", ephemeral: true });
        }
    } catch (e) { console.error(e); }
});

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('dashboard').setDescription('Deploy Dashboard'),
        new SlashCommandBuilder().setName('setup').setDescription('Setup tickets')
            .addChannelOption(o => o.setName('logs').setDescription('Logs').setRequired(true))
            .addRoleOption(o => o.setName('staff').setDescription('Staff').setRequired(true))
            .addRoleOption(o => o.setName('ia_role').setDescription('IA').setRequired(true))
            .addRoleOption(o => o.setName('management_role').setDescription('Mgmt').setRequired(true))
    ];
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ ${client.user.tag} is online.`);
});

client.login(process.env.TOKEN);
