// -------------------- Dependencies & Setup --------------------
require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, Collection, SlashCommandBuilder, 
    EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, 
    ChannelType, PermissionsBitField, ButtonBuilder, ButtonStyle, REST, 
    Routes, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');
const express = require('express');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();
const BOT_COLOR = "#de8ef4";

// Web Server for Railway
const app = express();
app.get('/', (req, res) => res.send('Alaska Discohook Clone is Online.'));
app.listen(process.env.PORT || 3000);

// -------------------- Commands --------------------

client.commands.set('discohook', {
    data: new SlashCommandBuilder()
        .setName('discohook')
        .setDescription('Open the all-in-one interactive embed creator'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Embed Title')
            .setDescription('This is your live preview. Use the buttons below to change any field.')
            .setColor(BOT_COLOR);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dh_edit_text').setLabel('Edit Text (Title/Desc/URL)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('dh_edit_media').setLabel('Edit Images (Thumb/Large)').setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dh_edit_footer').setLabel('Edit Author & Footer').setStyle(ButtonStyle.Primary),
            new StringSelectMenuBuilder().setCustomId('dh_color').setPlaceholder('Change Accent Color')
                .addOptions([
                    { label: 'Purple', value: '#de8ef4' }, { label: 'Red', value: '#ff0000' }, 
                    { label: 'Blue', value: '#00aaff' }, { label: 'Green', value: '#2ecc71' }, { label: 'Black', value: '#000000' }
                ])
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dh_post').setLabel('🚀 Send Message').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('dh_reset').setLabel('Clear All').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ 
            content: '## 🛠️ Alaska Discohook Designer\nConfigure your message below. Only you can see this menu.',
            embeds: [embed], 
            components: [row1, row2, row3], 
            ephemeral: true 
        });
    }
});

// -------------------- Interaction Logic --------------------

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction).catch(console.error);
    }

    // 1. BUTTON CLICKS (Opening the specific Discohook sections)
    if (interaction.isButton()) {
        const currentEmbed = interaction.message.embeds[0];

        if (interaction.customId === 'dh_edit_text') {
            const modal = new ModalBuilder().setCustomId('dh_modal_text').setTitle('Edit Content');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue(currentEmbed.title || '').setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('Title URL').setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.url || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(currentEmbed.description || '').setRequired(false))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'dh_edit_media') {
            const modal = new ModalBuilder().setCustomId('dh_modal_media').setTitle('Edit Images');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumb').setLabel('Thumbnail URL (Top Right)').setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.thumbnail?.url || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('img').setLabel('Main Image URL (Bottom)').setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.image?.url || ''))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'dh_edit_footer') {
            const modal = new ModalBuilder().setCustomId('dh_modal_footer').setTitle('Edit Author & Footer');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('author').setLabel('Author Name').setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.author?.name || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer').setLabel('Footer Text').setStyle(TextInputStyle.Short).setRequired(false).setValue(currentEmbed.footer?.text || ''))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'dh_post') {
            await interaction.channel.send({ embeds: [EmbedBuilder.from(currentEmbed)] });
            return await interaction.update({ content: '✅ Message sent successfully!', components: [], embeds: [] });
        }

        if (interaction.customId === 'dh_reset') {
            const reset = new EmbedBuilder().setTitle('Embed Title').setDescription('Cleared.').setColor(BOT_COLOR);
            return await interaction.update({ embeds: [reset] });
        }
    }

    // 2. DROPDOWN (Color Picker)
    if (interaction.isStringSelectMenu() && interaction.customId === 'dh_color') {
        const updated = EmbedBuilder.from(interaction.message.embeds[0]).setColor(interaction.values[0]);
        return await interaction.update({ embeds: [updated] });
    }

    // 3. MODAL SUBMISSIONS (Processing the inputs)
    if (interaction.isModalSubmit()) {
        const updated = EmbedBuilder.from(interaction.message.embeds[0]);

        if (interaction.customId === 'dh_modal_text') {
            updated.setTitle(interaction.fields.getTextInputValue('title') || null);
            updated.setURL(interaction.fields.getTextInputValue('url') || null);
            updated.setDescription(interaction.fields.getTextInputValue('desc') || null);
        }

        if (interaction.customId === 'dh_modal_media') {
            const t = interaction.fields.getTextInputValue('thumb');
            const i = interaction.fields.getTextInputValue('img');
            updated.setThumbnail(t || null);
            updated.setImage(i || null);
        }

        if (interaction.customId === 'dh_modal_footer') {
            const a = interaction.fields.getTextInputValue('author');
            const f = interaction.fields.getTextInputValue('footer');
            if (a) updated.setAuthor({ name: a });
            if (f) updated.setFooter({ text: f });
        }

        await interaction.update({ embeds: [updated] });
    }
});

// -------------------- Registration --------------------
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ Discohook Bot Online as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
