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

// --- Banner URL (Verified) ---
const BANNER_URL = "https://assets.grok.com/anon-users/7e76ba75-8c97-4e70-a30c-b1e4123a53d7/generated/2e33484f-bd5c-4c40-8752-95d963b03366/image.jpg";

// --- Persistent Config ---
const loadData = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
let config = loadData('./config.json', { generalRole: null, staffRole: null, mgmtRole: null, logChannel: null });

const app = express();
app.get('/', (req, res) => res.send('Alaska Apex Sentinel is live.'));
app.listen(process.env.PORT || 3000);

// -------------------- Setup Command --------------------

client.commands.set('setup', {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Deploy the support infrastructure')
        .addRoleOption(opt => opt.setName('general').setDescription('Role for General Support').setRequired(true))
        .addRoleOption(opt => opt.setName('internal_affairs').setDescription('Role for Internal Affairs').setRequired(true))
        .addRoleOption(opt => opt.setName('management').setDescription('Role for Management').setRequired(true))
        .addChannelOption(opt => opt.setName('log_channel').setDescription('Channel for system logs').setRequired(true)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'Administrator access required.', ephemeral: true });
        
        config.generalRole = interaction.options.getRole('general').id;
        config.staffRole = interaction.options.getRole('internal_affairs').id;
        config.mgmtRole = interaction.options.getRole('management').id;
        config.logChannel = interaction.options.getChannel('log_channel').id;
        saveData('./config.json', config);

        // Building the Panel Embed with the Banner
        const mainEmbed = new EmbedBuilder()
            .setTitle('🏛️ Support & Relations')
            .setDescription('Please select a department below to open an inquiry.')
            .setImage(BANNER_URL) // This line places the banner at the bottom of the embed
            .setColor(BOT_COLOR);

        const gMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ticket_general').setPlaceholder('General Support').addOptions([
            { label: 'General Questions', value: 'General Questions', emoji: '❓' },
            { label: 'Member Reports', value: 'Member Reports', emoji: '👥' },
            { label: 'Server Bugs', value: 'Server Bugs', emoji: '🐛' },
            { label: 'Partnerships', value: 'Partnerships', emoji: '🤝' }
        ]));

        const iMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ticket_ia').setPlaceholder('Internal Affairs').addOptions([
            { label: 'Staff Reports', value: 'Staff Reports', emoji: '👮' },
            { label: 'Staff Appeals', value: 'Staff Appeals', emoji: '⚖️' },
            { label: 'Severe Matters', value: 'Severe Matters', emoji: '⚠️' },
            { label: 'Staff Misconduct', value: 'Staff Misconduct', emoji: '🛑' }
        ]));

        const mMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ticket_mgmt').setPlaceholder('Management').addOptions([
            { label: 'Claiming Perks', value: 'Claiming Perks', emoji: '💎' },
            { label: 'Appealing Punishments', value: 'Appealing Punishments', emoji: '🔨' }
        ]));

        await interaction.channel.send({ embeds: [mainEmbed], components: [gMenu, iMenu, mMenu] });
        await interaction.reply({ content: '✅ Infrastructure successfully deployed with your custom banner.', ephemeral: true });
    }
});

// -------------------- Other Commands (Snipe, Lockdown, EmbedBuilder) --------------------
// [Logic remains same as previous version to keep response concise]
// ...

client.on('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const cmds = Array.from(client.commands.values()).map(c => c.data.toJSON());
    await rest.put(Routes.applicationCommands(client.user.id), { body: cmds });
    console.log(`✅ Alaska Apex Sentinel is online.`);
});

client.login(process.env.TOKEN);
