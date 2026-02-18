require('dotenv').config();
const fs = require('fs');
const { 
    Client, GatewayIntentBits, Partials, Collection, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, PermissionsBitField, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent 
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message]
});

const snipes = new Map(); 
const BOT_COLOR = "#f6b9bc"; 
const PREFIX = ".";
const BANNER_URL = "https://cdn.discordapp.com/attachments/1472295068231532808/1473557629749039155/ocbvKoC.jpg?ex=6996a4fc&is=6995537c&hm=e38629356f5050e338cf33bed692c2caed54a6970a54da2ae1a0a75396cb932f&";

// Data Management
const loadData = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
let config = loadData('./config.json', { generalRole: null, staffRole: null, mgmtRole: null, logChannel: null });

const app = express();
app.get('/', (req, res) => res.send('System Online.'));
app.listen(process.env.PORT || 3000);

// -------------------- Commands --------------------

const commands = {
    help: {
        async execute(message) {
            const help = new EmbedBuilder()
                .setTitle('🏛️ Command Directory')
                .addFields(
                    { name: '`.setup`', value: 'Deploy support panel. Requires: Admin' },
                    { name: '`.embed`', value: 'Create a custom executive embed message.' },
                    { name: '`.lockdown` / `.unlock`', value: 'Manage channel access.' },
                    { name: '`.snipe`', value: 'View recently deleted message.' }
                )
                .setColor(BOT_COLOR);
            await message.reply({ embeds: [help] });
        }
    },

    embed: {
        async execute(message) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
            
            const modal = new ModalBuilder().setCustomId('embed_builder_modal').setTitle('Executive Embed Creator');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e_title').setLabel("Title").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e_desc').setLabel("Description").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e_color').setLabel("Hex Color (Default: #f6b9bc)").setStyle(TextInputStyle.Short).setRequired(false))
            );
            // Modal can only be shown via Interaction. For Prefix, we'll use a simple argument method or prompt.
            // Simplified for Prefix usage:
            message.reply("💡 **Tip:** To build an embed, use `.embed [Title] | [Description]`\n*Example: .embed Welcome | Thanks for joining us!*");
            
            const args = message.content.slice(PREFIX.length + 5).split('|');
            if (args.length < 2) return;

            const customEmbed = new EmbedBuilder()
                .setTitle(args[0].trim())
                .setDescription(args[1].trim())
                .setColor(BOT_COLOR)
                .setTimestamp();
            
            await message.channel.send({ embeds: [customEmbed] });
            await message.delete();
        }
    },

    setup: {
        async execute(message) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply("❌ Admin access required.");
            }

            const roles = message.mentions.roles;
            const channel = message.mentions.channels.first();

            if (roles.size < 3 || !channel) {
                return message.reply("⚠️ **Setup Error:** Mention 3 roles and 1 log channel.\nOrder: `@General @IA @Mgmt #logs` ");
            }

            config = { generalRole: roles.at(0).id, staffRole: roles.at(1).id, mgmtRole: roles.at(2).id, logChannel: channel.id };
            saveData('./config.json', config);

            const panel = new EmbedBuilder()
                .setTitle('🏛️ Support & Relations')
                .setDescription('Select a department below to begin an inquiry.')
                .setImage(BANNER_URL)
                .setColor(BOT_COLOR);

            const row1 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('t_gen').setPlaceholder('General Support').addOptions([{ label: 'General Questions', value: 'q', emoji: '❓' }, { label: 'Reports', value: 'r', emoji: '👥' }]));
            const row2 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('t_ia').setPlaceholder('Internal Affairs').addOptions([{ label: 'Staff Reports', value: 'sr', emoji: '👮' }]));
            const row3 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('t_mgmt').setPlaceholder('Management').addOptions([{ label: 'Perks', value: 'p', emoji: '💎' }]));

            await message.channel.send({ embeds: [panel], components: [row1, row2, row3] });
            await message.reply("✅ System Deployed.");
        }
    }
};

// -------------------- Events --------------------

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // This checks if the bot can even see the message
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmd = args.shift().toLowerCase();
        if (commands[cmd]) await commands[cmd].execute(message, args);
    }
});

client.on('interactionCreate', async (int) => {
    if (int.isStringSelectMenu() && int.customId.startsWith('t_')) {
        let rId = int.customId === 't_gen' ? config.generalRole : (int.customId === 't_ia' ? config.staffRole : config.mgmtRole);
        
        const c = await int.guild.channels.create({
            name: `ticket-${int.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: int.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: int.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: rId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        await c.send({ content: `<@&${rId}>`, embeds: [new EmbedBuilder().setTitle("Support Requested").setDescription(`User: <@${int.user.id}>`).setColor(BOT_COLOR)] });
        await int.reply({ content: `✅ Created: ${c}`, ephemeral: true });
    }
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is Online.`);
    console.log(`Intents Enabled: ${client.options.intents}`);
});

client.login(process.env.TOKEN);
