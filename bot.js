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

// -------------------- COMMAND REGISTRY --------------------

const slashCommands = [
    new SlashCommandBuilder().setName('handbook').setDescription('View official staff protocols'),
    new SlashCommandBuilder().setName('commands').setDescription('View executive command list'),
    new SlashCommandBuilder().setName('help').setDescription('Private system assistance'),
    new SlashCommandBuilder().setName('roleplay-log').setDescription('Log a roleplay session'),
    new SlashCommandBuilder().setName('info').setDescription('View member file').addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)),
    new SlashCommandBuilder().setName('infraction-view').setDescription('View user history').addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)),
    new SlashCommandBuilder().setName('promotion-edit').setDescription('Edit a promotion post'),
    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Advanced ticket suite')
        .addSubcommand(s => s.setName('add').setDescription('Add user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Remove user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s => s.setName('rename').setDescription('Rename channel').addStringOption(o => o.setName('name').setDescription('New name').setRequired(true)))
        .addSubcommand(s => s.setName('claim').setDescription('Claim session'))
        .addSubcommand(s => s.setName('unclaim').setDescription('Unclaim session'))
        .addSubcommand(s => s.setName('close').setDescription('Close & Generate Transcript'))
        .addSubcommand(s => s.setName('escalate').setDescription('Alert Management')),
    new SlashCommandBuilder().setName('lockdown').setDescription('Restrict channel'),
    new SlashCommandBuilder().setName('unlock').setDescription('Restore channel'),
    new SlashCommandBuilder().setName('setup').setDescription('Deploy dashboard'),
    new SlashCommandBuilder().setName('snipe').setDescription('Recover message'),
    new SlashCommandBuilder().setName('embed').setDescription('Embed tool')
].map(c => c.toJSON());

// -------------------- INTERACTION HANDLER --------------------

client.on('interactionCreate', async (int) => {
    if (!int.guild) return;

    if (int.isChatInputCommand()) {
        const { commandName, options, subcommand } = int;

        // TICKET SUITE WITH TRANSCRIPTS
        if (commandName === 'ticket') {
            if (subcommand === 'close') {
                await int.reply("📑 **Generating transcript and archiving...**");

                try {
                    // Fetch messages for transcript
                    const messages = await int.channel.messages.fetch({ limit: 100 });
                    const transcript = messages.reverse().map(m => 
                        `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content || (m.attachments.size > 0 ? "[Attachment]" : "[No Content]")}`
                    ).join('\n');

                    const buffer = Buffer.from(transcript, 'utf-8');
                    const attachment = new AttachmentBuilder(buffer, { name: `transcript-${int.channel.name}.txt` });

                    // Log to the designated log channel
                    const logCh = int.guild.channels.cache.get(config.logChannel);
                    if (logCh) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📂 Ticket Archived')
                            .addFields(
                                { name: 'Channel', value: int.channel.name, inline: true },
                                { name: 'Closed By', value: int.user.tag, inline: true }
                            )
                            .setColor(BOT_COLOR)
                            .setTimestamp();
                        
                        await logCh.send({ embeds: [logEmbed], files: [attachment] });
                    }

                    // Delete the channel
                    setTimeout(() => int.channel.delete().catch(() => {}), 3000);
                } catch (err) {
                    console.error("Transcript Error:", err);
                    await int.followUp("⚠️ Failed to generate transcript, but channel will close.");
                    setTimeout(() => int.channel.delete().catch(() => {}), 5000);
                }
                return;
            }
            
            // ... (Other ticket subcommands like claim/add/remove here)
        }

        // STAFF HANDBOOK (Refined)
        if (commandName === 'handbook') {
            const handbook = new EmbedBuilder()
                .setTitle('🏛️ Alaska Executive | Staff Protocol')
                .setDescription('Standard operating procedures for all active staff.')
                .addFields(
                    { name: '1. Infractions', value: 'Use `/infraction-view` before issuing punishments to check for repeat offenses.' },
                    { name: '2. Tickets', value: 'Always `/ticket claim` before speaking. Use `/ticket close` to auto-log transcripts.' },
                    { name: '3. Roleplay', value: 'All sessions must be logged with `/roleplay-log` for activity points.' }
                )
                .setColor(BOT_COLOR);
            return int.reply({ embeds: [handbook], ephemeral: true });
        }

        // LOCKDOWN/UNLOCK (Confirmation UI)
        if (commandName === 'lockdown' || commandName === 'unlock') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirm_${commandName}`).setLabel('Confirm Action').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );
            return int.reply({ content: `⚠️ **Management override requested.** Confirm **${commandName}** for this channel?`, components: [row], ephemeral: true });
        }
    }

    // BUTTON INTERACTION LOGIC
    if (int.isButton()) {
        if (int.customId === 'confirm_lockdown') {
            await int.channel.permissionOverwrites.edit(int.guild.id, { SendMessages: false });
            return int.update({ content: "🔒 **Channel Locked by Executive Order.**", components: [] });
        }
        if (int.customId === 'confirm_unlock') {
            await int.channel.permissionOverwrites.edit(int.guild.id, { SendMessages: null });
            return int.update({ content: "🔓 **Communication Restored.**", components: [] });
        }
        if (int.customId === 'cancel') return int.update({ content: "❌ Action cancelled.", components: [] });
    }
});

// -------------------- DEPLOYMENT --------------------

client.on('messageDelete', m => { 
    if (!m.author?.bot && m.content) snipes.set(m.channelId, { content: m.content, author: m.author.tag }); 
});

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ Master Build Online | Transcripts Enabled.');
    } catch (e) { console.error(e); }
    client.user.setActivity('Alaska Operations', { type: ActivityType.Watching });
});

client.login(process.env.TOKEN);
