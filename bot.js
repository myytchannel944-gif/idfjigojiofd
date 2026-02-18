require('dotenv').config();
const fs = require('fs');
const { 
    Client, GatewayIntentBits, Partials, Collection, SlashCommandBuilder, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, PermissionsBitField, REST, Routes, StringSelectMenuBuilder
} = require('discord.js');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message]
});

client.commands = new Collection();
const snipes = new Map(); 
const BOT_COLOR = "#f6b9bc";

// --- Persistent Databases ---
const loadData = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

let config = loadData('./config.json', { ticketRole: null, staffStats: {} });
let economy = loadData('./economy.json', {});

// Web server for Railway
const app = express();
app.get('/', (req, res) => res.send('Alaska Infinite (No Levels) is Online.'));
app.listen(process.env.PORT || 3000);

// -------------------- NEW ADVANCED COMMANDS --------------------

// 1. GIVEAWAY
client.commands.set('giveaway', {
    data: new SlashCommandBuilder().setName('giveaway').setDescription('Start a quick giveaway')
        .addStringOption(o => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(true)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) return interaction.reply({ content: "No perms.", ephemeral: true });
        
        const prize = interaction.options.getString('prize');
        const winnersCount = interaction.options.getInteger('winners');
        
        const embed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY STARTED!')
            .setDescription(`Prize: **${prize}**\nWinners: **${winnersCount}**\n\nReact with 🎉 to enter!`)
            .setColor(BOT_COLOR)
            .setFooter({ text: 'Giveaway ends manually or via timer logic' });

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        await msg.react('🎉');
    }
});

// 2. POLL
client.commands.set('poll', {
    data: new SlashCommandBuilder().setName('poll').setDescription('Create a yes/no poll')
        .addStringOption(o => o.setName('question').setDescription('The question to ask').setRequired(true)),
    async execute(interaction) {
        const question = interaction.options.getString('question');
        const embed = new EmbedBuilder().setTitle('📊 Community Poll').setDescription(question).setColor(BOT_COLOR).setFooter({ text: `Asked by ${interaction.user.tag}` });
        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        await msg.react('👍');
        await msg.react('👎');
    }
});

// 3. STORE (Economy Interaction)
client.commands.set('store', {
    data: new SlashCommandBuilder().setName('store').setDescription('Buy items with your Alaska Coins'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🏪 Alaska Global Store')
            .addFields(
                { name: 'VIP Role', value: 'Cost: $5,000 | `/buy item:vip`', inline: true },
                { name: 'Custom Color', value: 'Cost: $2,000 | `/buy item:color`', inline: true }
            ).setColor(BOT_COLOR);
        await interaction.reply({ embeds: [embed] });
    }
});

// 4. ADVANCED MOD: LOCK/UNLOCK
client.commands.set('lockdown', {
    data: new SlashCommandBuilder().setName('lockdown').setDescription('Lock or Unlock the current channel')
        .addBooleanOption(o => o.setName('status').setDescription('True to lock, False to unlock').setRequired(true)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: 'No perms.', ephemeral: true });
        const status = interaction.options.getBoolean('status');
        await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: !status });
        await interaction.reply(`🔒 Channel lockdown status: **${status ? 'Locked' : 'Unlocked'}**`);
    }
});

// -------------------- EVENT ENGINE --------------------

client.on('messageDelete', m => {
    if (m.partial || m.author.bot) return;
    snipes.set(m.channel.id, { content: m.content, author: m.author.tag, time: m.createdAt });
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (cmd) await cmd.execute(interaction).catch(console.error);
    }

    // --- BUTTONS (Verification & Tickets) ---
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_user') {
            const role = interaction.guild.roles.cache.find(r => r.name === "Verified");
            if (role) await interaction.member.roles.add(role);
            return interaction.reply({ content: '✅ Verified!', ephemeral: true });
        }
        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 Closing...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }
});

// -------------------- REGISTRATION --------------------

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = Array.from(client.commands.values()).map(c => c.data.toJSON());
    
    // Core utility commands
    commands.push(new SlashCommandBuilder().setName('setup').setDescription('Deploy Panels').toJSON());
    commands.push(new SlashCommandBuilder().setName('snipe').setDescription('View last deleted message').toJSON());
    commands.push(new SlashCommandBuilder().setName('balance').setDescription('Check coins').toJSON());
    commands.push(new SlashCommandBuilder().setName('work').setDescription('Earn coins').toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`🔥 ALASKA INFINITE (V3) ONLINE`);
});

client.login(process.env.TOKEN);
