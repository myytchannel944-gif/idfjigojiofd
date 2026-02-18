require('dotenv').config();
const fs = require('fs');
const { 
    Client, GatewayIntentBits, Partials, Collection, SlashCommandBuilder, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, PermissionsBitField, REST, Routes, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');
const express = require('express');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message]
});

client.commands = new Collection();
const snipes = new Map(); 
const BOT_COLOR = "#f6b9bc"; 

// --- Persistent Config ---
const loadData = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
let config = loadData('./config.json', { generalRole: null, staffRole: null, mgmtRole: null, logChannel: null });

const app = express();
app.get('/', (req, res) => res.send('Alaska Apex is Online.'));
app.listen(process.env.PORT || 3000);

// -------------------- MODERATION & UTILITY --------------------

client.commands.set('snipe', {
    data: new SlashCommandBuilder().setName('snipe').setDescription('Recover the last deleted message'),
    async execute(interaction) {
        const msg = snipes.get(interaction.channel.id);
        if (!msg) return interaction.reply({ content: 'Nothing to snipe!', ephemeral: true });
        const embed = new EmbedBuilder()
            .setAuthor({ name: msg.author, iconURL: msg.avatar })
            .setDescription(msg.content || "[No text content]").setColor(BOT_COLOR).setFooter({ text: `Deleted at: ${msg.time}` });
        await interaction.reply({ embeds: [embed] });
    }
});

client.commands.set('mute', {
    data: new SlashCommandBuilder().setName('mute').setDescription('Timeout a member')
        .addUserOption(opt => opt.setName('target').setDescription('The user to mute').setRequired(true))
        .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason')),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: 'No permission.', ephemeral: true });
        const user = interaction.options.getMember('target');
        const mins = interaction.options.getInteger('minutes');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        if (!user.manageable) return interaction.reply({ content: 'I cannot mute this user.', ephemeral: true });
        await user.timeout(mins * 60 * 1000, reason);
        await interaction.reply(`🔇 **${user.user.tag}** has been muted for ${mins}m.`);
    }
});

// -------------------- APEX SETUP --------------------

client.commands.set('setup', {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Deploy Infrastructure')
        .addRoleOption(opt => opt.setName('general_role').setDescription('General Support Role').setRequired(true))
        .addRoleOption(opt => opt.setName('staff_role').setDescription('Internal Affairs Role').setRequired(true))
        .addRoleOption(opt => opt.setName('mgmt_role').setDescription('Management Role').setRequired(true))
        .addChannelOption(opt => opt.setName('log_channel').setDescription('Log Channel').setRequired(true)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
        config.generalRole = interaction.options.getRole('general_role').id;
        config.staffRole = interaction.options.getRole('staff_role').id;
        config.mgmtRole = interaction.options.getRole('mgmt_role').id;
        config.logChannel = interaction.options.getChannel('log_channel').id;
        saveData('./config.json', config);

        const mainEmbed = new EmbedBuilder()
            .setTitle('🏛️ Alaska Support & Relations')
            .setDescription('Select a department below. Each selection notifies a specific executive team.')
            .setImage('https://output.googleusercontent.com/static/s/8f8b8/image_generation_content/0.png')
            .setColor(BOT_COLOR);

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
        await interaction.reply({ content: '✅ Infrastructure Deployed.', ephemeral: true });
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
        let pingRole;
        let departmentName;

        if (interaction.customId === 'ticket_general') {
            pingRole = config.generalRole;
            departmentName = "General Support";
        } else if (interaction.customId === 'ticket_ia') {
            pingRole = config.staffRole;
            departmentName = "Internal Affairs"; // Custom Label Updated
        } else {
            pingRole = config.mgmtRole;
            departmentName = "Management";
        }

        const channel = await interaction.guild.channels.create({
            name: `${category.replace(/\s+/g, '-')}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: pingRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`Support Session: ${category}`)
            .setDescription(`Greetings <@${interaction.user.id}>. A member of **${departmentName}** (<@&${pingRole}>) will assist you shortly.`)
            .setColor(BOT_COLOR);

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_modal').setLabel('Resolve & Close').setStyle(ButtonStyle.Danger));
        
        await channel.send({ content: `**Department:** ${departmentName} | <@&${pingRole}>`, embeds: [ticketEmbed], components: [row] });
        await interaction.reply({ content: `✅ Inquiry created: ${channel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'close_modal') {
        const modal = new ModalBuilder().setCustomId('close_reason_modal').setTitle('Close Ticket');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('close_reason').setLabel("Resolution Reason").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'close_reason_modal') {
        const reason = interaction.fields.getTextInputValue('close_reason');
        const logChan = interaction.guild.channels.cache.get(config.logChannel);
        if (logChan) {
            logChan.send({ embeds: [new EmbedBuilder().setTitle('🔒 Ticket Resolved').addFields({ name: 'Channel', value: interaction.channel.name }, { name: 'Closed By', value: interaction.user.tag }, { name: 'Reason', value: reason }).setColor('#ff4757').setTimestamp()] });
        }
        await interaction.reply('🔒 Archiving...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 4000);
    }
});

client.on('messageDelete', m => {
    if (m.partial || m.author?.bot) return;
    snipes.set(m.channel.id, { content: m.content, author: m.author.tag, avatar: m.author.displayAvatarURL(), time: m.createdAt.toLocaleString() });
});

client.on('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = Array.from(client.commands.values()).map(c => c.data.toJSON());
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ ALASKA APEX READY.`);
});

client.login(process.env.TOKEN);
