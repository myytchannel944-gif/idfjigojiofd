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
const PROMO_BANNER = "https://cdn.discordapp.com/attachments/1341148810620833894/1341584988775874621/0c3d9331-496c-4cd8-8f09-e9fbedc9429b.jpg";

// Data Persistence
const loadData = () => fs.existsSync('./config.json') ? JSON.parse(fs.readFileSync('./config.json')) : { logChannel: null };
const saveData = (data) => fs.writeFileSync('./config.json', JSON.stringify(data, null, 2));
let config = loadData();

// -------------------- COMMAND REGISTRY --------------------

const slashCommands = [
    new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Announce a staff promotion')
        .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
        .addStringOption(o => o.setName('rank').setDescription('New rank').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Promotion reason').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('infraction')
        .setDescription('Log a formal infraction')
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('Warning/Strike/Ban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),

    new SlashCommandBuilder().setName('roleplay-log').setDescription('Log a roleplay session'),
    new SlashCommandBuilder().setName('handbook').setDescription('View staff protocols'),
    new SlashCommandBuilder().setName('commands').setDescription('View command directory'),
    new SlashCommandBuilder().setName('help').setDescription('Get private assistance'),
    new SlashCommandBuilder().setName('snipe').setDescription('Recover last deleted message'),
    new SlashCommandBuilder().setName('embed').setDescription('System maintenance notice'),

    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ticket management suite')
        .addSubcommand(s => s.setName('claim').setDescription('Claim current ticket'))
        .addSubcommand(s => s.setName('close').setDescription('Archive & generate transcript'))
        .addSubcommand(s => s.setName('add').setDescription('Add user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s => s.setName('rename').setDescription('Rename channel').addStringOption(o => o.setName('name').setDescription('New name').setRequired(true))),

    new SlashCommandBuilder().setName('lockdown').setDescription('Lock channel'),
    new SlashCommandBuilder().setName('unlock').setDescription('Unlock channel'),
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure system')
        .addChannelOption(o => o.setName('logs').setDescription('Log channel').setRequired(true))
].map(c => c.toJSON());

// -------------------- INTERACTION HANDLER --------------------

client.on('interactionCreate', async (int) => {
    if (!int.guild) return;

    try {
        if (int.isChatInputCommand()) {
            const { commandName, options, subcommand } = int;

            // 1. PROMOTION
            if (commandName === 'promote') {
                const user = options.getUser('user');
                const embed = new EmbedBuilder()
                    .setTitle('🔔 Alaska State Staff Promotion')
                    .setDescription(`Congratulations, <@${user.id}>! Your hard work and dedication have earned you a promotion!`)
                    .addFields({ name: 'Reason', value: options.getString('reason'), inline: true }, { name: 'Rank', value: options.getString('rank'), inline: true })
                    .setImage(PROMO_BANNER).setColor("#3498db").setFooter({ text: `Signed, ${int.user.tag}` });
                return int.reply({ content: `<@${user.id}>`, embeds: [embed] });
            }

            // 2. INFRACTION
            if (commandName === 'infraction') {
                const embed = new EmbedBuilder()
                    .setTitle('⚖️ Formal Infraction Issued')
                    .addFields(
                        { name: 'User', value: `<@${options.getUser('user').id}>`, inline: true },
                        { name: 'Type', value: options.getString('type'), inline: true },
                        { name: 'Reason', value: options.getString('reason') }
                    ).setColor("#e74c3c").setTimestamp().setFooter({ text: `Officer: ${int.user.tag}` });
                return int.reply({ embeds: [embed] });
            }

            // 3. TICKET SUITE
            if (commandName === 'ticket') {
                if (subcommand === 'claim') {
                    return int.reply({ embeds: [new EmbedBuilder().setDescription(`💼 Handled by: **${int.user.tag}**`).setColor("#2ecc71")] });
                }
                if (subcommand === 'close') {
                    await int.reply("📑 **Generating Transcript & Archiving...**");
                    const messages = await int.channel.messages.fetch({ limit: 100 });
                    const transcript = messages.reverse().map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content || "[Attachment]"}`).join('\n');
                    const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `transcript-${int.channel.name}.txt` });

                    const logCh = int.guild.channels.cache.get(config.logChannel);
                    if (logCh) await logCh.send({ content: `📂 Archive for **${int.channel.name}**`, files: [attachment] });
                    return setTimeout(() => int.channel.delete().catch(() => {}), 3000);
                }
                if (subcommand === 'add') {
                    await int.channel.permissionOverwrites.edit(options.getUser('user').id, { ViewChannel: true, SendMessages: true });
                    return int.reply(`✅ User added.`);
                }
            }

            // 4. SETUP
            if (commandName === 'setup') {
                config.logChannel = options.getChannel('logs').id;
                saveData(config);
                return int.reply({ content: `✅ Log channel set to <#${config.logChannel}>.`, ephemeral: true });
            }

            // 5. LOCK/UNLOCK
            if (commandName === 'lockdown' || commandName === 'unlock') {
                const isLock = commandName === 'lockdown';
                await int.channel.permissionOverwrites.edit(int.guild.id, { SendMessages: isLock ? false : null });
                return int.reply(`${isLock ? '🔒' : '🔓'} **Channel ${isLock ? 'Locked' : 'Unlocked'}.**`);
            }

            // 6. SNIPE
            if (commandName === 'snipe') {
                const msg = snipes.get(int.channelId);
                if (!msg) return int.reply({ content: "Nothing to snipe.", ephemeral: true });
                return int.reply({ embeds: [new EmbedBuilder().setAuthor({ name: msg.author }).setDescription(msg.content).setColor(BOT_COLOR)] });
            }

            // 7. REMAINING (Handbook, Commands, Help, Embed)
            if (['handbook', 'commands', 'help'].includes(commandName)) {
                return int.reply({ content: "📖 **Staff Handbook & Commands:** Use `/promote`, `/infraction`, `/ticket`, and `/lockdown` to manage the server.", ephemeral: true });
            }
            if (commandName === 'embed') {
                return int.reply({ content: "⚠️ System maintenance: Embed tool offline.", ephemeral: true });
            }
        }
    } catch (e) {
        console.error(e);
        if (!int.replied) await int.reply({ content: "⚠️ Error executing command.", ephemeral: true });
    }
});

// -------------------- SYSTEM EVENTS --------------------

client.on('messageDelete', m => { if (!m.author?.bot && m.content) snipes.set(m.channelId, { content: m.content, author: m.author.tag }); });

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ All Systems Operational.');
    } catch (e) { console.error(e); }
    client.user.setActivity('Alaska State RP', { type: ActivityType.Watching });
});

client.login(process.env.TOKEN);
