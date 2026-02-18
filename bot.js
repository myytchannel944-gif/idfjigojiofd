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

client.commands = new Collection();
const BOT_COLOR = "#f6b9bc"; 
const BANNER_URL = "https://cdn.discordapp.com/attachments/1472295068231532808/1473557629749039155/ocbvKoC.jpg?ex=6996a4fc&is=6995537c&hm=e38629356f5050e338cf33bed692c2caed54a6970a54da2ae1a0a75396cb932f&";

// Persistent Config
const loadData = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
let config = loadData('./config.json', { generalRole: null, staffRole: null, mgmtRole: null, logChannel: null });

const app = express();
app.get('/', (req, res) => res.send('System Online.'));
app.listen(process.env.PORT || 3000);

// -------------------- Slash Command Definitions --------------------

const slashCommands = [
    // Setup Command
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Deploy the support infrastructure')
        .addRoleOption(opt => opt.setName('general').setDescription('General Support Role').setRequired(true))
        .addRoleOption(opt => opt.setName('ia').setDescription('Internal Affairs Role').setRequired(true))
        .addRoleOption(opt => opt.setName('management').setDescription('Management Role').setRequired(true))
        .addChannelOption(opt => opt.setName('logs').setDescription('Log Channel').setRequired(true)),

    // Embed Builder Command (with your specific message)
    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Executive Embed Creator tool'),

    // Lockdown/Unlock
    new SlashCommandBuilder().setName('lockdown').setDescription('Restrict channel access'),
    new SlashCommandBuilder().setName('unlock').setDescription('Restore channel access'),
    
    // Help
    new SlashCommandBuilder().setName('help').setDescription('View available commands')
].map(command => command.toJSON());

// -------------------- Interaction Handling --------------------

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'help') {
            const help = new EmbedBuilder()
                .setTitle('🏛️ System Directory')
                .setDescription('Use `/` to access the following executive commands:')
                .addFields(
                    { name: '`/setup`', value: 'Deploy the inquiry panel with banner.' },
                    { name: '`/embed`', value: 'Create custom executive embeds.' },
                    { name: '`/lockdown` / `/unlock`', value: 'Manage channel permissions.' }
                )
                .setColor(BOT_COLOR);
            return interaction.reply({ embeds: [help] });
        }

        if (commandName === 'embed') {
            // Your requested "Maintenance" message
            const maintenance = new EmbedBuilder()
                .setTitle('⚠️ System Notice')
                .setDescription('Sorry, the bot did not respond. Please contact the owner.')
                .setColor('#f1c40f')
                .setFooter({ text: 'Alaska Executive Services' });
            
            return interaction.reply({ embeds: [maintenance] });
        }

        if (commandName === 'setup') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) 
                return interaction.reply({ content: "❌ Admin required.", ephemeral: true });

            config.generalRole = interaction.options.getRole('general').id;
            config.staffRole = interaction.options.getRole('ia').id;
            config.mgmtRole = interaction.options.getRole('management').id;
            config.logChannel = interaction.options.getChannel('logs').id;
            saveData('./config.json', config);

            const panel = new EmbedBuilder()
                .setTitle('🏛️ Support & Relations')
                .setDescription('Select a department below to begin an inquiry.')
                .setImage(BANNER_URL)
                .setColor(BOT_COLOR);

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('t_menu').setPlaceholder('Select Department').addOptions([
                    { label: 'General Support', value: 'gen', emoji: '❓' },
                    { label: 'Internal Affairs', value: 'ia', emoji: '👮' },
                    { label: 'Management', value: 'mgmt', emoji: '💎' }
                ])
            );

            await interaction.channel.send({ embeds: [panel], components: [row] });
            return interaction.reply({ content: "✅ System Deployed.", ephemeral: true });
        }

        if (commandName === 'lockdown') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
            return interaction.reply("🔒 **Channel locked.**");
        }

        if (commandName === 'unlock') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });
            return interaction.reply("🔓 **Channel unlocked.**");
        }
    }

    // Menu Selection Logic
    if (interaction.isStringSelectMenu() && interaction.customId === 't_menu') {
        const value = interaction.values[0];
        const roleId = value === 'gen' ? config.generalRole : (value === 'ia' ? config.staffRole : config.mgmtRole);

        const ch = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const closeBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_tkt').setLabel('Resolve').setStyle(ButtonStyle.Danger));
        await ch.send({ content: `<@&${roleId}>`, embeds: [new EmbedBuilder().setTitle("Support Requested").setDescription(`User: <@${interaction.user.id}>`).setColor(BOT_COLOR)], components: [closeBtn] });
        return interaction.reply({ content: `✅ Created: ${ch}`, ephemeral: true });
    }

    // Modal Closure Logic
    if (interaction.isButton() && interaction.customId === 'close_tkt') {
        const modal = new ModalBuilder().setCustomId('rsn_mdl').setTitle('Close Ticket');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rsn_in').setLabel("Reason").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'rsn_mdl') {
        const reason = interaction.fields.getTextInputValue('rsn_in');
        const log = interaction.guild.channels.cache.get(config.logChannel);
        if (log) log.send({ embeds: [new EmbedBuilder().setTitle("Resolved").addFields({ name: "Reason", value: reason }).setColor("#ff4757")] });
        await interaction.reply("Archiving...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
    }
});

// -------------------- Initialization --------------------

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('🔄 Registering Slash Commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ Commands Registered.');
    } catch (error) {
        console.error(error);
    }
    console.log(`✅ ${client.user.tag} Online.`);
});

client.login(process.env.TOKEN);
