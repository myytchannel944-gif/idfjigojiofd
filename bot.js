// -------------------- Bot Dependencies --------------------
require('dotenv').config();
const fs = require('fs');
const { 
    Client, GatewayIntentBits, Partials, Collection, SlashCommandBuilder, 
    EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, 
    ChannelType, PermissionsBitField, ButtonBuilder, ButtonStyle, REST, 
    Routes, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');
const express = require('express');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message]
});

const BOT_COLOR = "#de8ef4"; 
client.commands = new Collection();

// -------------------- Express server for Railway --------------------
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Alaska Management Bot is online.'));
app.listen(PORT, () => console.log(`🚀 Web server on port ${PORT}`));

// -------------------- Utility Functions --------------------
async function createTranscript(channel) {
    const messages = await channel.messages.fetch({ limit: 100 });
    let content = `Transcript for #${channel.name}\n${'='.repeat(30)}\n`;
    messages.reverse().forEach(msg => {
        content += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
    });
    const fileName = `transcript-${channel.id}.txt`;
    fs.writeFileSync(fileName, content);
    return fileName;
}

async function ensureCategoryAndLog(guild) {
    let category = guild.channels.cache.find(c => c.name === 'Tickets' && c.type === ChannelType.GuildCategory);
    if (!category) category = await guild.channels.create({ name: 'Tickets', type: ChannelType.GuildCategory });
    let logChannel = guild.channels.cache.find(c => c.name === 'ticket-logs' && c.type === ChannelType.GuildText);
    if (!logChannel) logChannel = await guild.channels.create({ name: 'ticket-logs', type: ChannelType.GuildText });
    let staffRole = guild.roles.cache.find(r => r.name === 'Staff' || r.permissions.has(PermissionsBitField.Flags.ManageChannels));
    return { category, logChannel, staffRole };
}

// -------------------- Commands --------------------

client.commands.set('panel', {
    data: new SlashCommandBuilder().setName('panel').setDescription('Send ticket panel'),
    async execute(interaction) {
        const embed = new EmbedBuilder().setTitle('🎫 Alaska Management Support').setDescription('Select a category below to open a ticket.').setColor(BOT_COLOR);
        const menu = new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('Select ticket type...')
            .addOptions([{ label: 'Support', value: 'support', emoji: '🛠️' }, { label: 'Report', value: 'report', emoji: '🚩' }, { label: 'Application', value: 'apply', emoji: '📝' }]);
        await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }
});

client.commands.set('embedbuilder', {
    data: new SlashCommandBuilder().setName('embedbuilder').setDescription('Discohook-style interactive creator'),
    async execute(interaction) {
        const embed = new EmbedBuilder().setTitle('Preview: New Embed').setDescription('Use the buttons below to customize this message.').setColor(BOT_COLOR);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('edit_main').setLabel('Edit Content').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('edit_media').setLabel('Add Media').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('edit_footer').setLabel('Edit Footer').setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('edit_color').setPlaceholder('Choose Embed Color')
                .addOptions([
                    { label: 'Purple', value: '#de8ef4' }, { label: 'Red', value: '#ff0000' }, 
                    { label: 'Green', value: '#00ff00' }, { label: 'Blue', value: '#0000ff' }, { label: 'Gold', value: '#ffd700' }
                ])
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('finish_embed').setLabel('🚀 Post to Channel').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('reset_embed').setLabel('🗑️ Reset').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ content: '### 🎨 Alaska Embed Designer', embeds: [embed], components: [row1, row2, row3], ephemeral: true });
    }
});

// -------------------- Interaction Handler --------------------
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction).catch(console.error);
    }

    if (interaction.isButton()) {
        const currentEmbed = interaction.message.embeds[0];
        if (!currentEmbed) return;

        if (interaction.customId === 'edit_main') {
            const modal = new ModalBuilder().setCustomId('modal_main').setTitle('Edit Content');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue(currentEmbed.title || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(currentEmbed.description || ''))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'edit_media') {
            const modal = new ModalBuilder().setCustomId('modal_media').setTitle('Edit Media');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumb').setLabel('Thumbnail URL').setStyle(TextInputStyle.Short).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel('Big Image URL').setStyle(TextInputStyle.Short).setRequired(false))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'edit_footer') {
            const modal = new ModalBuilder().setCustomId('modal_footer').setTitle('Edit Footer');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer').setLabel('Footer Text').setStyle(TextInputStyle.Short).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('icon').setLabel('Footer Icon URL').setStyle(TextInputStyle.Short).setRequired(false))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'reset_embed') {
            return await interaction.update({ embeds: [new EmbedBuilder().setTitle('Preview: New Embed').setDescription('Reset.').setColor(BOT_COLOR)] });
        }

        if (interaction.customId === 'finish_embed') {
            await interaction.channel.send({ embeds: [EmbedBuilder.from(currentEmbed)] });
            return await interaction.update({ content: '✅ Embed Posted!', components: [], embeds: [] });
        }

        // Ticket Closing
        if (interaction.customId === 'close_ticket') {
            const { logChannel } = await ensureCategoryAndLog(interaction.guild);
            await interaction.reply('Closing in 5 seconds... Generating transcript.');
            const file = await createTranscript(interaction.channel);
            await logChannel.send({ content: `Ticket closed by ${interaction.user.tag}`, files: [file] });
            setTimeout(() => { interaction.channel.delete().catch(() => {}); if (fs.existsSync(file)) fs.unlinkSync(file); }, 5000);
        }
    }

    if (interaction.isStringSelectMenu()) {
        const currentEmbed = interaction.message.embeds[0];

        if (interaction.customId === 'edit_color') {
            const updated = EmbedBuilder.from(currentEmbed).setColor(interaction.values[0]);
            return await interaction.update({ embeds: [updated] });
        }

        if (interaction.customId === 'ticket_menu') {
            const { category, staffRole } = await ensureCategoryAndLog(interaction.guild);
            const channel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                parent: category.id,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: staffRole?.id || interaction.guild.id, allow: [PermissionsBitField.Flags.ViewChannel] }
                ]
            });
            const closeBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger));
            await channel.send({ content: `Hey <@${interaction.user.id}>, help is on the way!`, components: [closeBtn] });
            await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
        }
    }

    if (interaction.isModalSubmit()) {
        const currentEmbed = interaction.message.embeds[0];
        const updated = EmbedBuilder.from(currentEmbed);

        if (interaction.customId === 'modal_main') {
            updated.setTitle(interaction.fields.getTextInputValue('title')).setDescription(interaction.fields.getTextInputValue('desc'));
        }
        if (interaction.customId === 'modal_media') {
            const t = interaction.fields.getTextInputValue('thumb');
            const i = interaction.fields.getTextInputValue('image');
            if (t) updated.setThumbnail(t);
            if (i) updated.setImage(i);
        }
        if (interaction.customId === 'modal_footer') {
            const f = interaction.fields.getTextInputValue('footer');
            const icon = interaction.fields.getTextInputValue('icon');
            updated.setFooter({ text: f || ' ', iconURL: icon || null });
        }
        await interaction.update({ embeds: [updated] });
    }
});

// -------------------- Ready & Registration --------------------
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Discohook-Style Builder Ready!');
    } catch (err) { console.error(err); }
});

client.login(process.env.TOKEN);
