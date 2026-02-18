require('dotenv').config();
const fs = require('fs');
const { 
    Client, GatewayIntentBits, Partials, Collection, SlashCommandBuilder, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, PermissionsBitField, REST, Routes, StringSelectMenuBuilder
} = require('discord.js');
const express = require('express');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message]
});

client.commands = new Collection();
const BOT_COLOR = "#f6b9bc"; 

// --- Persistent Config ---
const loadData = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
let config = loadData('./config.json', { staffRole: null, mgmtRole: null, logChannel: null });

// Web server
const app = express();
app.get('/', (req, res) => res.send('Alaska Executive is Online.'));
app.listen(process.env.PORT || 3000);

// -------------------- EXECUTIVE SETUP --------------------

client.commands.set('setup', {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Deploy Professional Support Infrastructure')
        .addRoleOption(opt => opt.setName('staff_role').setDescription('Role for General/IA tickets').setRequired(true))
        .addRoleOption(opt => opt.setName('mgmt_role').setDescription('Role for Management tickets').setRequired(true))
        .addChannelOption(opt => opt.setName('log_channel').setDescription('Channel for system logs').setRequired(true)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) 
            return interaction.reply({ content: 'Restricted to Administrators.', ephemeral: true });

        config.staffRole = interaction.options.getRole('staff_role').id;
        config.mgmtRole = interaction.options.getRole('mgmt_role').id;
        config.logChannel = interaction.options.getChannel('log_channel').id;
        saveData('./config.json', config);

        const mainEmbed = new EmbedBuilder()
            .setTitle('🏛️ Alaska Support & Relations')
            .setDescription('Select the appropriate department below to open an inquiry.')
            .setImage('https://output.googleusercontent.com/static/s/8f8b8/image_generation_content/0.png')
            .setColor(BOT_COLOR)
            .setFooter({ text: 'Alaska Executive Management' });

        const generalMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('ticket_general').setPlaceholder('General Support').addOptions([
                { label: 'General Questions', value: 'General Questions', emoji: '❓' },
                { label: 'Member Reports', value: 'Member Reports', emoji: '👥' },
                { label: 'Server Bugs', value: 'Server Bugs', emoji: '🐛' },
                { label: 'Partnerships', value: 'Partnerships', emoji: '🤝' }
            ])
        );

        const iaMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('ticket_ia').setPlaceholder('Internal Affairs').addOptions([
                { label: 'Staff Reports', value: 'Staff Reports', emoji: '👮' },
                { label: 'Staff Appeals', value: 'Staff Appeals', emoji: '⚖️' },
                { label: 'Severe Matters', value: 'Severe Matters', emoji: '⚠️' },
                { label: 'Staff Misconduct', value: 'Staff Misconduct', emoji: '🛑' }
            ])
        );

        const mgmtMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('ticket_mgmt').setPlaceholder('Management').addOptions([
                { label: 'Claiming Perks', value: 'Claiming Perks', emoji: '💎' },
                { label: 'Appealing Punishments', value: 'Appealing Punishments', emoji: '🔨' }
            ])
        );

        await interaction.channel.send({ embeds: [mainEmbed], components: [generalMenu, iaMenu, mgmtMenu] });
        await interaction.reply({ content: '✅ Infrastructure Deployed with Role Routing.', ephemeral: true });
    }
});

// -------------------- INTERACTION ENGINE --------------------

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (cmd) await cmd.execute(interaction);
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_')) {
        const category = interaction.values[0];
        
        // Determine which role to ping
        const pingRole = interaction.customId === 'ticket_mgmt' ? config.mgmtRole : config.staffRole;

        const channel = await interaction.guild.channels.create({
            name: `${category.replace(/\s+/g, '-')}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: pingRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        // Audit Log
        const logChan = interaction.guild.channels.cache.get(config.logChannel);
        if (logChan) logChan.send(`📥 **New Inquiry:** ${interaction.user.tag} in **${category}**`);

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`Support Session: ${category}`)
            .setDescription(`Greetings <@${interaction.user.id}>. A member of <@&${pingRole}> will assist you shortly.`)
            .setColor(BOT_COLOR);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Resolve & Close').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@&${pingRole}>`, embeds: [ticketEmbed], components: [row] });
        await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Archiving channel...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 4000);
    }
});

client.on('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = Array.from(client.commands.values()).map(c => c.data.toJSON());
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ Alaska Executive Role-Routing Ready.`);
});

client.login(process.env.TOKEN);
