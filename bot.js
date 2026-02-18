require('dotenv').config();
const fs = require('fs');
const { 
    Client, GatewayIntentBits, Partials, Collection, SlashCommandBuilder,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, PermissionsBitField, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes 
} = require('discord.js');
const express = require('express');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message]
});

const BOT_COLOR = "#f6b9bc"; 
const BANNER_URL = "https://cdn.discordapp.com/attachments/1472295068231532808/1473557629749039155/ocbvKoC.jpg?ex=6996a4fc&is=6995537c&hm=e38629356f5050e338cf33bed692c2caed54a6970a54da2ae1a0a75396cb932f&";

// Persistent Config
const loadData = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
let config = loadData('./config.json', { generalRole: null, staffRole: null, mgmtRole: null, logChannel: null });

// Health Check for Railway
const app = express();
app.get('/', (req, res) => res.send('System Online.'));
app.listen(process.env.PORT || 3000);

// -------------------- Slash Command Registration --------------------

const slashCommands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Deploy the support infrastructure')
        .addRoleOption(opt => opt.setName('general').setDescription('General Support Role').setRequired(true))
        .addRoleOption(opt => opt.setName('ia').setDescription('Internal Affairs Role').setRequired(true))
        .addRoleOption(opt => opt.setName('management').setDescription('Management Role').setRequired(true))
        .addChannelOption(opt => opt.setName('logs').setDescription('Log Channel').setRequired(true)),

    new SlashCommandBuilder().setName('embed').setDescription('Executive Embed Creator tool'),
    new SlashCommandBuilder().setName('lockdown').setDescription('Restrict channel access'),
    new SlashCommandBuilder().setName('unlock').setDescription('Restore channel access'),
    new SlashCommandBuilder().setName('help').setDescription('View available commands')
].map(command => command.toJSON());

// -------------------- Interaction Logic --------------------

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'embed') {
            const maintenance = new EmbedBuilder()
                .setTitle('⚠️ System Notice')
                .setDescription('Sorry, the bot did not respond. Please contact the owner.')
                .setColor('#f1c40f')
                .setFooter({ text: 'Alaska Executive Services' });
            return interaction.reply({ embeds: [maintenance] });
        }

        if (commandName === 'setup') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) 
                return interaction.reply({ content: "❌ Admin access required.", ephemeral: true });

            config.generalRole = interaction.options.getRole('general').id;
            config.staffRole = interaction.options.getRole('ia').id;
            config.mgmtRole = interaction.options.getRole('management').id;
            config.logChannel = interaction.options.getChannel('logs').id;
            saveData('./config.json', config);

            const panel = new EmbedBuilder()
                .setTitle('🏛️ Alaska Executive | Support Portal')
                .setDescription('Please select the department that best suits your inquiry from the menu below.')
                .addFields(
                    { name: '❓ General Support', value: 'Assistance with server navigation, general questions, and partnership inquiries.', inline: false },
                    { name: '👮 Internal Affairs', value: 'Handling staff misconduct reports, departmental complaints, and policy disputes.', inline: false },
                    { name: '💎 Management', value: 'Perk claims, punishment appeals, and critical server-wide matters.', inline: false }
                )
                .setImage(BANNER_URL)
                .setColor(BOT_COLOR)
                .setFooter({ text: 'Alaska Apex Sentinel' });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('t_menu').setPlaceholder('Choose a Department').addOptions([
                    { label: 'General Support', description: 'Server help & general questions', value: 'gen', emoji: '❓' },
                    { label: 'Internal Affairs', description: 'Staff reports & misconduct', value: 'ia', emoji: '👮' },
                    { label: 'Management', description: 'Appeals & executive matters', value: 'mgmt', emoji: '💎' }
                ])
            );

            await interaction.channel.send({ embeds: [panel], components: [row] });
            return interaction.reply({ content: "✅ System Deployed.", ephemeral: true });
        }

        // Help, Lockdown, Unlock logic
        if (commandName === 'help') {
            const help = new EmbedBuilder()
                .setTitle('🏛️ System Directory')
                .setDescription('Available Slash Commands:')
                .addFields(
                    { name: '`/setup`', value: 'Configure and deploy the support desk.' },
                    { name: '`/embed`', value: 'Custom Embed Tool (Maintenance Mode).' },
                    { name: '`/lockdown`', value: 'Disable sending messages for @everyone.' }
                )
                .setColor(BOT_COLOR);
            return interaction.reply({ embeds: [help] });
        }
    }

    // -------------------- Ticket Logic --------------------

    if (interaction.isStringSelectMenu() && interaction.customId === 't_menu') {
        const value = interaction.values[0];
        let roleId, deptName, deptColor;

        if (value === 'gen') { roleId = config.generalRole; deptName = "General Support"; deptColor = "#3498db"; }
        else if (value === 'ia') { roleId = config.staffRole; deptName = "Internal Affairs"; deptColor = "#e67e22"; }
        else { roleId = config.mgmtRole; deptName = "Management"; deptColor = "#9b59b6"; }

        const channel = await interaction.guild.channels.create({
            name: `${deptName.toLowerCase()}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${deptName} | Inquiry Session`)
            .setDescription(`Greetings <@${interaction.user.id}>. You have contacted the **${deptName}** department. Please describe your situation in detail while you wait for a representative.`)
            .setColor(deptColor)
            .setTimestamp();

        const closeBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_tkt').setLabel('Resolve Inquiry').setStyle(ButtonStyle.Danger));
        
        await channel.send({ content: `**Alert:** <@&${roleId}>`, embeds: [ticketEmbed], components: [closeBtn] });
        return interaction.reply({ content: `✅ Inquiry created: ${channel}`, ephemeral: true });
    }

    // Ticket Closure (Modal)
    if (interaction.isButton() && interaction.customId === 'close_tkt') {
        const modal = new ModalBuilder().setCustomId('rsn_mdl').setTitle('Finalize Resolution');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rsn_in').setLabel("Resolution Reason").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'rsn_mdl') {
        const reason = interaction.fields.getTextInputValue('rsn_in');
        const log = interaction.guild.channels.cache.get(config.logChannel);
        if (log) log.send({ embeds: [new EmbedBuilder().setTitle("Inquiry Resolved").addFields({ name: "Resolved By", value: interaction.user.tag }, { name: "Outcome", value: reason }).setColor("#2ecc71").setTimestamp()] });
        await interaction.reply("🔒 Session finalized. Archiving...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
});

// -------------------- Launch --------------------

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ Commands Registered.');
    } catch (e) { console.error(e); }
    console.log(`✅ ${client.user.tag} Online.`);
});

client.login(process.env.TOKEN);
