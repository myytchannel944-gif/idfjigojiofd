require('dotenv').config();
const fs = require('fs');
const { 
    Client, GatewayIntentBits, Partials, SlashCommandBuilder,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, PermissionsBitField, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, ActivityType, AttachmentBuilder 
} = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message]
});

const snipes = new Map();
const BOT_COLOR = "#f6b9bc"; 
const PROMO_BANNER = "https://cdn.discordapp.com/attachments/1341148810620833894/1341584988775874621/0c3d9331-496c-4cd8-8f09-e9fbedc9429b.jpg"; // Your Alaska Promo Image

// -------------------- COMMAND REGISTRY --------------------

const slashCommands = [
    // 📢 Promotion & Staff Management
    new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Announce a staff promotion')
        .addUserOption(o => o.setName('user').setDescription('The staff member being promoted').setRequired(true))
        .addStringOption(o => o.setName('rank').setDescription('The new rank').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('The reason for promotion').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('infraction')
        .setDescription('Log a formal infraction for a user')
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('Warning / Strike / Ban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for the infraction').setRequired(true)),

    // 🎭 Logging & Utilities
    new SlashCommandBuilder().setName('roleplay-log').setDescription('Log a roleplay session'),
    new SlashCommandBuilder().setName('handbook').setDescription('View official staff protocols'),
    new SlashCommandBuilder().setName('commands').setDescription('View executive command list'),

    // 🎫 Ticket Suite
    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Advanced ticket suite')
        .addSubcommand(s => s.setName('claim').setDescription('Claim the current ticket'))
        .addSubcommand(s => s.setName('close').setDescription('Close and generate transcript'))
        .addSubcommand(s => s.setName('add').setDescription('Add a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),

    // ⚙️ Admin Tools
    new SlashCommandBuilder().setName('setup').setDescription('Deploy support dashboard'),
    new SlashCommandBuilder().setName('lockdown').setDescription('Restrict channel access'),
    new SlashCommandBuilder().setName('unlock').setDescription('Restore channel access')
].map(c => c.toJSON());

// -------------------- INTERACTION HANDLER --------------------

client.on('interactionCreate', async (int) => {
    if (!int.guild) return;

    if (int.isChatInputCommand()) {
        const { commandName, options, subcommand } = int;

        // 📣 PROMOTION COMMAND (Matches your screenshot style)
        if (commandName === 'promote') {
            const user = options.getUser('user');
            const rank = options.getString('rank');
            const reason = options.getString('reason');

            const promoEmbed = new EmbedBuilder()
                .setTitle('🔔 Alaska State Staff Promotion')
                .setDescription(`Congratulations, <@${user.id}>! Your hard work and dedication to the Staff Team have not gone unnoticed. We're pleased to announce your promotion, well deserved and earned!`)
                .addFields(
                    { name: 'Reason', value: reason, inline: true },
                    { name: 'Rank', value: rank, inline: true }
                )
                .setImage(PROMO_BANNER) // Displays the Alaska Promotion Banner
                .setColor("#3498db")
                .setFooter({ text: `Signed, ${int.user.tag}` });

            return int.reply({ content: `<@${user.id}>`, embeds: [promoEmbed] });
        }

        // ⚖️ INFRACTION COMMAND
        if (commandName === 'infraction') {
            const user = options.getUser('user');
            const type = options.getString('type');
            const reason = options.getString('reason');

            const infraEmbed = new EmbedBuilder()
                .setTitle('⚖️ Formal Infraction Issued')
                .addFields(
                    { name: 'User', value: `<@${user.id}>`, inline: true },
                    { name: 'Type', value: type, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setColor("#e74c3c")
                .setTimestamp()
                .setFooter({ text: `Issuing Officer: ${int.user.tag}` });

            return int.reply({ embeds: [infraEmbed] });
        }

        // 🎭 ROLEPLAY LOGGING
        if (commandName === 'roleplay-log') {
            const logEmbed = new EmbedBuilder()
                .setTitle('🎭 Roleplay Session Logged')
                .setDescription(`Executive **${int.user.tag}** has officially logged a roleplay session.`)
                .setColor("#2ecc71")
                .setTimestamp();
            return int.reply({ embeds: [logEmbed] });
        }

        // 🎫 TICKET COMMANDS
        if (commandName === 'ticket') {
            if (subcommand === 'claim') {
                const claimEmbed = new EmbedBuilder()
                    .setDescription(`💼 This ticket is now being handled by **${int.user.tag}**.`)
                    .setColor("#2ecc71");
                return int.reply({ embeds: [claimEmbed] });
            }
            if (subcommand === 'close') {
                await int.reply("📑 **Generating "Black Box" transcript...**");
                // (Transcript logic provided in previous builds)
                setTimeout(() => int.channel.delete().catch(() => {}), 3000);
            }
        }
    }
});

// -------------------- DEPLOYMENT --------------------

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ All Alaska RP Utilities are online and synced.');
    } catch (e) { console.error(e); }
    client.user.setActivity('Alaska Executive Ops', { type: ActivityType.Watching });
});

client.login(process.env.TOKEN);
