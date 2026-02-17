const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ====== CONFIG ======
// Paste your bot token here:
const BOT_TOKEN = MTQ1MTMzOTI2MjYxNTA5MzM4Mg.GWUxPQ.TDa6GrSGLEVKPsalABID8jOLahoLoZmVMbmYtY; // <-- Replace with your token

// Your staff application channel ID
const staffAppChannelId = 1473081595945812049; // Replace with your channel ID

// =====================

// Create the client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// Store the ID of the message to edit
let staffAppMessageId = null;

// Helper function to create Staff App Embed
function getStaffEmbed(isOpen) {
    if (isOpen) {
        return {
            title: "📝 Staff Application",
            description: "🟢 **Staff Applications are Open**",
            color: 0x57F287,
            fields: [
                {
                    name: "⚠️ Agreement",
                    value: "- Do **not ping anyone** asking for your application to be read.\n- Applications **will be reviewed within 24 hours**. Please be patient.\n- Ignoring this rule may result in your application being **denied or delayed**."
                }
            ],
            footer: { text: "Alaska Management – Fill out the form carefully and completely." }
        };
    } else {
        return {
            title: "📝 Staff Application",
            description: "🔴 **Staff Applications are Closed**",
            color: 0xE74C3C,
            fields: [
                {
                    name: "Notice",
                    value: "Staff applications are currently closed. Please check back later for updates."
                }
            ],
            footer: { text: "Alaska Management – Thank you for your interest in joining the team." }
        };
    }
}

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const channel = interaction.guild.channels.cache.get(staffAppChannelId);
    if (!channel) return interaction.reply({ content: "Alaska Management: Staff application channel not found.", ephemeral: true });

    // Open command
    if (interaction.commandName === 'staffopen') {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel("Submit Application")
                    .setStyle(ButtonStyle.Link)
                    .setURL("https://melon.ly/form/7429303261795979264")
            );

        if (staffAppMessageId) {
            const message = await channel.messages.fetch(staffAppMessageId).catch(() => null);
            if (message) {
                await message.edit({ embeds: [getStaffEmbed(true)], components: [row] });
                return interaction.reply({ content: "Alaska Management: Staff Application is now open! ✅", ephemeral: true });
            }
        }

        const sentMessage = await channel.send({ embeds: [getStaffEmbed(true)], components: [row] });
        staffAppMessageId = sentMessage.id;
        return interaction.reply({ content: "Alaska Management: Staff Application is now open! ✅", ephemeral: true });
    }

    // Close command
    if (interaction.commandName === 'staffclose') {
        if (!staffAppMessageId) return interaction.reply({ content: "Alaska Management: No staff application message found to close.", ephemeral: true });

        const message = await channel.messages.fetch(staffAppMessageId).catch(() => null);
        if (message) {
            await message.edit({ embeds: [getStaffEmbed(false)], components: [] });
            return interaction.reply({ content: "Alaska Management: Staff Application is now closed. 🔴", ephemeral: true });
        } else {
            return interaction.reply({ content: "Alaska Management: Could not find the message to close.", ephemeral: true });
        }
    }
});

// Login directly with token
client.login(BOT_TOKEN);
